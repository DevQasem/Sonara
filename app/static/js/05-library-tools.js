'use strict';
// Sonara player, part: loudness, clean-up, remote control, profiles, recycle bin, AI lyrics
// ------------------------------------------------ even loudness + crossfade
// Even loudness: the server measures every song once and the player turns
// quiet songs up and loud ones down, so they all play at the same level.
const normGain = () => { const t = current(); return prefs.loud && t && t.gain ? Math.pow(10, t.gain / 20) : 1; };
function applyNorm() {
  const g = normGain();
  if (g !== 1) ensureEq();
  if (fx) fx.norm.gain.setTargetAtTime(g, actx.currentTime, 0.04);
}
// Crossfade: near the end of a song a second, hidden player takes over its
// last seconds and fades them out while the next song fades in on the main
// player (for a video the picture changes when the fade starts). Songs that
// are only streamed are not crossfaded.
const tail = new Audio(); tail.preload = 'auto';
let fadeMul = 1, xfading = false, xTimer = 0, tailFor = null;
function applyVol() { audio.volume = Math.min(prefs.volume, 1) * fadeMul; }
function pickNext(auto) {
  const n = state.queue.length;
  if (!n) return -1;
  let i;
  if (state.shuffle && n > 1) { do { i = Math.floor(Math.random() * n); } while (i === state.index); }
  else i = state.index + 1;
  if (i >= n) { if (auto && !state.repeat) return -1; i = 0; }
  return i;
}
function stopTail() {
  clearInterval(xTimer); xfading = false; tailFor = null;
  tail.pause(); tail.removeAttribute('src');
  fadeMul = 1; applyVol();
}
// ----------------------------------------------------------------- clean-up
// Duplicates, failed downloads, leftover files and what uses the disk.
async function renderCleanup() {
  const view = state.view, main = $('main');
  main.replaceChildren(hero('Library', 'Clean up', 'trash'));
  state.shown = [];
  $('heroSub').textContent = 'Looking through your library…';
  let d;
  try { d = await api('/api/cleanup'); } catch (e) { if (state.view === view) main.append(el('div', 'empty', e.message)); return; }
  if (state.view !== view) return;
  const u = d.usage, again = () => { if (state.view === view) renderCleanup(); };
  $('heroSub').textContent = `${u.songs} songs · ${bytes(u.audio)} of sound · ${bytes(u.video)} of video`;
  const box = (title, note) => {
    const b = el('div', 'box cl-box'), h = el('div', 'cl-h');
    h.append(el('h3', null, title)); b.append(h);
    if (note) b.append(el('p', 'cl-note', note));
    main.append(b);
    return b;
  };
  const act = (b, label, cls, fn) => { const x = el('button', 'btn ' + cls, label); x.onclick = fn; b.querySelector('.cl-h').append(x); return x; };
  const line = (t, info, extra) => {
    const r = el('div', 'cl-row'), img = el('img'), m = el('div', 'm');
    img.loading = 'lazy'; img.alt = ''; setImg(img, t);
    m.append(el('b', null, t.title), el('small', null, [t.artist, info].filter(Boolean).join(' · ')));
    r.append(img, m);
    if (extra) r.append(extra);
    return r;
  };
  const about = t => [t.vfile ? 'with video' : 'sound only', bytes(t.bytes), `${t.plays} play${t.plays === 1 ? '' : 's'}`, t.folders ? `in ${t.folders} folder${t.folders === 1 ? '' : 's'}` : '', t.liked ? 'liked' : ''].filter(Boolean).join(' · ');
  const merge = g => post('/api/cleanup/merge', { keep: g.keep, remove: g.list.filter(t => t.id !== g.keep).map(t => t.id) });

  // duplicates
  const groups = d.duplicates.map(list => ({ list, keep: list[0].id }));
  const extra = groups.reduce((n, g) => n + g.list.length - 1, 0);
  const dup = box(groups.length ? `Duplicates — ${extra} extra cop${extra === 1 ? 'y' : 'ies'}` : 'Duplicates',
    groups.length ? 'The same song saved more than once. The copy marked “Keep” stays and takes over the folders, likes and play counts of the others. Click another copy to keep that one instead.' : 'No song is saved twice.');
  if (groups.length) act(dup, 'Remove all duplicates', '', async () => {
    if (!await confirmBox('Remove all duplicates?', `${extra} extra cop${extra === 1 ? 'y is' : 'ies are'} deleted. One copy of every song stays, with its folders and likes.`, 'Remove')) return;
    let n = 0;
    for (const g of groups) { try { n += (await merge(g)).deleted; } catch (e) { toast(e.message, 'error'); } }
    toast(`Removed ${n} duplicate${n === 1 ? '' : 's'}`); state.tracksKey = ''; again();
  });
  for (const g of groups) {
    const gb = el('div', 'cl-group');
    const paint = () => [...gb.querySelectorAll('.cl-row')].forEach((r, i) => { const on = g.list[i].id === g.keep; r.classList.toggle('keep', on); r.querySelector('.cl-tag').textContent = on ? 'Keep' : 'Remove'; });
    for (const t of g.list) {
      const r = line(t, about(t), el('span', 'cl-tag'));
      r.onclick = () => { g.keep = t.id; paint(); };
      gb.append(r);
    }
    const go1 = el('button', 'btn ghost', `Remove ${g.list.length - 1} cop${g.list.length === 2 ? 'y' : 'ies'}`);
    go1.onclick = async () => { go1.disabled = true; try { await merge(g); toast('Duplicate removed'); state.tracksKey = ''; again(); } catch (e) { go1.disabled = false; toast(e.message, 'error'); } };
    gb.append(go1); paint(); dup.append(gb);
  }

  // failed downloads
  if (d.failed.length) {
    const f = box(`Failed downloads — ${d.failed.length}`, 'These never finished downloading.');
    act(f, 'Try again', 'ghost', async () => { try { await post('/api/retry-failed'); state.wasPending = true; toast('Trying those downloads again'); again(); } catch (e) { toast(e.message, 'error'); } });
    act(f, 'Delete them', '', async () => {
      if (!await confirmBox('Delete the failed downloads?', `${d.failed.length} entr${d.failed.length === 1 ? 'y is' : 'ies are'} removed from the library.`, 'Delete')) return;
      for (const t of d.failed) { try { await api(`/api/tracks/${t.id}`, { method: 'DELETE' }); } catch {} }
      state.tracksKey = ''; again();
    });
    for (const t of d.failed) f.append(line(t, t.error || 'failed'));
  }

  // leftover files
  if (u.unused_files) {
    const l = box('Leftover files', `${u.unused_files} file${u.unused_files === 1 ? '' : 's'} in the music folder (${bytes(u.unused)}) belong to no song: remains of interrupted downloads or older versions.`);
    act(l, 'Delete them', '', async () => { try { const r = await post('/api/cleanup/unused'); toast(`Freed ${bytes(r.bytes)}`); again(); } catch (e) { toast(e.message, 'error'); } });
  }

  // biggest songs
  if (d.big.length) {
    const b = box('Biggest songs', 'What takes the most space.');
    for (const t of d.big) {
      const del = el('button', 'icon-btn'); del.innerHTML = svg('trash'); del.title = 'Delete from library';
      del.onclick = async () => {
        if (!await confirmBox('Delete from library?', `“${t.title}” goes to the recycle bin and can be put back for 30 days.`, 'Delete')) return;
        try { await api(`/api/tracks/${t.id}`, { method: 'DELETE' }); dropFromPlayer(t.id); state.tracksKey = ''; again(); } catch (e) { toast(e.message, 'error'); }
      };
      b.append(line(t, about(t), del));
    }
  }

  // folders by size
  if (d.folders.length) {
    const f = box('Folders by size'), max = Math.max(1, ...d.folders.map(x => x.bytes));
    for (const x of d.folders) {
      const r = el('div', 'cl-bar'), bar = el('i');
      bar.style.width = Math.max(2, x.bytes / max * 100) + '%';
      r.append(el('b', null, x.name), el('small', null, `${x.count} song${x.count === 1 ? '' : 's'} · ${bytes(x.bytes)}`), bar);
      f.append(r);
    }
  }
}

// ----------------------------------------------------------- remote control
// Every open player stays connected to the server and reports what it is
// playing, so any of them can control another: play, pause, skip, seek,
// volume, or send it songs to play.
const device = { id: null, name: load('deviceName', null) };
try { device.id = sessionStorage.getItem('deviceId'); } catch {}
if (!device.id) { device.id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); try { sessionStorage.setItem('deviceId', device.id); } catch {} }
if (!device.name) {
  const u = navigator.userAgent;
  const os = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone' : /Windows/.test(u) ? 'Windows PC' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Device';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox/.test(u) ? 'Firefox' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'browser';
  device.name = `${os} · ${br}`;
}
let sock = null, others = [], stateTimer = 0, devBox = null, devTicks = [];
function wsSend(m) { if (sock && sock.readyState === 1) sock.send(JSON.stringify(m)); }
function myState() {
  const t = current();
  if (!t) return null;
  const cover = coverUrl(t);
  return { id: t.id || null, title: t.title, artist: t.artist || '', cover: cover.startsWith('data:') ? null : cover, paused: audio.paused, time: audio.currentTime || 0, duration: isFinite(audio.duration) ? audio.duration : (t.duration || 0), volume: prefs.volume };
}
function tellState() { clearTimeout(stateTimer); stateTimer = setTimeout(() => wsSend({ type: 'state', state: myState() }), 150); }
function wsConnect() {
  try { sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch { return; }
  sock.onopen = () => { wsSend({ type: 'hello', id: device.id, name: device.name }); tellState(); };
  sock.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'devices') { const now = performance.now(); others = m.devices.filter(x => x.id !== device.id).map(x => ({ ...x, got: now })); paintDevices(); }
    else if (m.type === 'cmd') runCmd(m.cmd, m.value);
  };
  sock.onclose = () => { sock = null; others = []; paintDevices(); setTimeout(wsConnect, 4000); };
}
async function runCmd(cmd, v) {
  if (cmd === 'toggle') toggle();
  else if (cmd === 'next') next();
  else if (cmd === 'prev') prev();
  else if (cmd === 'seek' && isFinite(v)) audio.currentTime = +v;
  else if (cmd === 'volume' && isFinite(v)) { setVolume(Math.max(0, Math.min(2, +v))); save('prefs', prefs); }
  else if (cmd === 'playTracks' && v && Array.isArray(v.ids)) {
    let all = [];
    try { all = await api('/api/tracks?ids=' + v.ids.slice(0, 300).join(',')); } catch { return; }
    const byId = new Map(all.map(t => [t.id, t])), q = v.ids.map(i => byId.get(i)).filter(t => t && t.status === 'ready');
    if (!q.length) return;
    state.queue = q; playIndex(Math.max(0, q.findIndex(t => t.id === v.start)));
    audio.play().catch(() => toast('Another device sent music here. Click this page once to let it start.', 'info', 9000));
  }
}
const sendCmd = (to, cmd, value) => wsSend({ type: 'cmd', to, cmd, value });
// "Play on <device>" entries for a song's menu
function deviceItems(t) {
  return others.map(d => ({ icon: 'devices', label: `Play on ${d.name}`, fn: () => {
    const ids = state.shown.filter(x => x.id && x.status === 'ready').map(x => x.id).slice(0, 300);
    sendCmd(d.id, 'playTracks', { ids: ids.includes(t.id) ? ids : [t.id], start: t.id });
    toast(`Playing “${t.title}” on ${d.name}`);
  } }));
}
function openDevices() {
  const wrap = el('div', 'modal dlg-wrap'), box = el('div', 'dlg dev-dlg');
  box.append(el('h3', null, 'Devices'));
  const me = el('label', null, 'This device is called'), name = el('input');
  name.type = 'text'; name.value = device.name; name.maxLength = 40; name.autocomplete = 'off';
  name.onchange = () => { device.name = name.value.trim() || device.name; name.value = device.name; save('deviceName', device.name); wsSend({ type: 'name', name: device.name }); };
  me.append(name);
  const list = el('div', 'dev-list'), row = el('div', 'dlg-act'), ok = el('button', 'btn', 'Done');
  row.append(ok); box.append(me, list, row); wrap.append(box); document.body.append(wrap);
  devBox = list;
  const timer = setInterval(() => devTicks.forEach(f => f()), 1000);
  const done = () => { clearInterval(timer); devBox = null; devTicks = []; wrap.remove(); };
  ok.onclick = done;
  wrap.onpointerdown = e => { if (e.target === wrap) done(); };
  wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(); };
  paintDevices();
  ok.focus();
}
function paintDevices() {
  for (const id of ['devBtn', 'npDev']) { const b = $(id); b.classList.toggle('on', others.length > 0); b.title = others.length ? `Devices: ${others.length} other device${others.length === 1 ? '' : 's'} open` : 'Devices: control another device'; }
  if (!devBox || devBox.dataset.busy) return;
  devBox.replaceChildren(); devTicks = [];
  if (!others.length) return devBox.append(el('p', 'cl-note', sock ? 'No other device has Sonara open right now. Open this same address on a phone, TV or another computer and it shows up here, ready to be controlled.' : 'Not connected to the server. Trying again…'));
  const hold = inp => { inp.addEventListener('pointerdown', () => { devBox.dataset.busy = '1'; }); const free = () => { delete devBox.dataset.busy; }; inp.addEventListener('change', free); inp.addEventListener('pointerup', () => setTimeout(free, 300)); };
  for (const d of others) {
    const s = d.state, card = el('div', 'dev-card'), head = el('div', 'dev-head');
    head.innerHTML = svg('devices'); head.append(el('b', null, d.name));
    card.append(head);
    if (!s) { card.append(el('p', 'cl-note', 'Nothing playing there. Right-click a song here and choose “Play on ' + d.name + '”.')); devBox.append(card); continue; }
    const now = el('div', 'cl-row'), img = el('img'), m = el('div', 'm');
    img.alt = ''; img.src = s.cover || placeholder({ title: s.title, id: s.id }); img.onerror = () => { img.onerror = null; img.src = placeholder({ title: s.title, id: s.id }); };
    m.append(el('b', null, s.title), el('small', null, s.artist || ''));
    now.append(img, m);
    const ctl = el('div', 'dev-ctl');
    for (const [ico, cmd, cls] of [['prev', 'prev', 'icon-btn'], [s.paused ? 'play' : 'pause', 'toggle', 'play'], ['next', 'next', 'icon-btn']]) {
      const b = el('button', cls); b.innerHTML = svg(ico); b.onclick = () => sendCmd(d.id, cmd); ctl.append(b);
    }
    const pos = () => Math.min(s.duration || 0, s.time + (s.paused ? 0 : (performance.now() - d.got) / 1000));
    const seek = el('div', 'seek'), cur = el('span', null, fmt(pos())), bar = el('input'), dur = el('span', null, fmt(s.duration));
    bar.type = 'range'; bar.min = 0; bar.max = s.duration || 1; bar.step = 0.1; bar.value = pos(); fill(bar);
    bar.oninput = () => { cur.textContent = fmt(bar.value); fill(bar); };
    bar.onchange = () => sendCmd(d.id, 'seek', +bar.value);
    hold(bar);
    seek.append(cur, bar, dur);
    devTicks.push(() => { if (devBox && !devBox.dataset.busy) { bar.value = pos(); fill(bar); cur.textContent = fmt(pos()); } });
    const vol = el('div', 'dev-vol'), vr = el('input'), vp = el('span', null, Math.round((s.volume ?? 1) * 100) + '%');
    vol.innerHTML = svg('volume');
    vr.type = 'range'; vr.min = 0; vr.max = 2; vr.step = 0.01; vr.value = s.volume ?? 1; fill(vr);
    vr.oninput = () => { vp.textContent = Math.round(vr.value * 100) + '%'; fill(vr); sendCmd(d.id, 'volume', +vr.value); };
    hold(vr);
    vol.append(vr, vp);
    card.append(now, ctl, seek, vol);
    devBox.append(card);
  }
}
for (const k of ['play', 'pause', 'seeked', 'loadedmetadata', 'ended', 'emptied']) audio.addEventListener(k, tellState);
setInterval(() => { if (!audio.paused) tellState(); }, 5000);
$('devBtn').onclick = $('npDev').onclick = openDevices;

// ----------------------------------------------------------------- profiles
// One library for the whole house; each profile keeps its own likes,
// history, most played and folders. The choice is remembered per browser.
async function loadProfiles() {
  try {
    const r = await api('/api/profiles');
    profile.list = r.profiles;
    if (!r.profiles.some(p => p.id === profile.id)) { profile.id = 1; save('profile', 1); }
  } catch {}
  paintProfile();
}
const profileName = () => (profile.list.find(p => p.id === profile.id) || { name: 'Me' }).name;
function paintProfile() {
  const n = profileName();
  $('profAv').textContent = (n.trim()[0] || '?').toUpperCase();
  $('profAv').style.background = grad(n);
  $('profName').textContent = n;
  document.body.classList.toggle('kid', !!(profile.list.find(p => p.id === profile.id) || {}).kid);
}
async function useProfile(id, quiet) {
  const target = profile.list.find(x => x.id === id);
  if (target && target.locked && !profileKeys[id] && !await askPin(target)) return;
  profile.id = id; save('profile', id); paintProfile();
  state.tracksKey = ''; state.search = null;
  await loadPlaylists();
  await go({ type: 'home' });
  if (!quiet) toast(`Now listening as ${profileName()}`);
}
$('profBtn').onclick = e => {
  const items = profile.list.map(p => ({ icon: p.id === profile.id ? 'check' : p.locked ? 'lock' : 'person', label: p.name + (p.kid ? ' (listen-only)' : ''), fn: () => { if (p.id !== profile.id) useProfile(p.id); } }));
  items.push({ icon: 'plus', label: 'Add a profile…', fn: async () => {
    const r = await dialog({ title: 'New profile', text: 'A profile has its own likes, history and folders. Everyone shares the same songs.', fields: [{ label: 'Name', placeholder: 'For example: Sara' }], ok: 'Create' });
    if (!r || !r[0]) return;
    try { const p = await post('/api/profiles', { name: r[0] }); await loadProfiles(); useProfile(p.id); } catch (err) { toast(err.message, 'error'); }
  } });
  if (!document.body.classList.contains('kid')) items.push({ icon: 'tune', label: 'Manage profiles…', fn: a => openMenu(a, profile.list.map(p => ({ icon: p.locked ? 'lock' : 'person', label: p.name + (p.kid ? ' (listen-only)' : ''), fn: a2 => profileActions(p, a2) })), 'Manage profiles') });
  openMenu(e.currentTarget, items, 'Who is listening?');
};

// ------------------------------------------- recycle bin and activity log
const ago = ts => { const s = Date.now() / 1000 - ts; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' day' + (Math.round(s / 86400) === 1 ? '' : 's') + ' ago'; };
// A "Deleted …" message with an Undo button (the item waits in the bin).
function undoToast(msg, trashId) {
  const t = toast(msg, 'info', 9000);
  if (!trashId) return t;
  const b = el('button', 'toast-btn', 'Undo');
  b.onclick = async () => {
    t.remove();
    try { await post(`/api/trash/${trashId}/restore`); toast('Put back'); state.tracksKey = ''; await loadPlaylists(); if (isList(state.view)) reload(true); else if (['folders', 'home', 'activity'].includes(state.view.type)) go(state.view, {}); }
    catch (e) { toast(e.message, 'error'); }
  };
  t.append(b);
  return t;
}
async function renderActivity() {
  const view = state.view, main = $('main');
  main.replaceChildren(hero('Library', 'Activity', 'history'));
  state.shown = [];
  $('heroSub').textContent = 'What was added, changed and deleted. Deleted songs and folders wait in the recycle bin for 30 days.';
  let bin, log;
  try { [bin, log] = await Promise.all([api('/api/trash'), api('/api/activity')]); }
  catch (e) { if (state.view === view) main.append(el('div', 'empty', e.message)); return; }
  if (state.view !== view) return;
  const again = () => { if (state.view === view) renderActivity(); };
  const box = title => { const b = el('div', 'box cl-box'), h = el('div', 'cl-h'); h.append(el('h3', null, title)); b.append(h); main.append(b); return b; };
  const who = id => (profile.list.find(p => p.id === id) || { name: 'someone' }).name;
  const b = box(bin.length ? `Recycle bin — ${bin.length}` : 'Recycle bin');
  if (!bin.length) b.append(el('p', 'cl-note', 'Empty. Songs and folders you delete come here first, so a mistake can be undone.'));
  else {
    const empty = el('button', 'btn', 'Empty the bin');
    empty.onclick = async () => {
      if (!await confirmBox('Empty the recycle bin?', `${bin.length} item${bin.length === 1 ? ' is' : 's are'} deleted for good. This cannot be undone.`, 'Delete for good')) return;
      try { await api('/api/trash', { method: 'DELETE' }); toast('The recycle bin is empty'); again(); } catch (e) { toast(e.message, 'error'); }
    };
    b.querySelector('.cl-h').append(empty);
    for (const x of bin) {
      const r = el('div', 'cl-row'), m = el('div', 'm');
      if (x.kind === 'song') { const img = el('img'); img.alt = ''; img.loading = 'lazy'; setImg(img, { title: x.name, id: 'bin' + x.id, video_id: x.video_id }); r.append(img); }
      else { const ico = el('span', 'cl-ico'); ico.innerHTML = svg('folder'); r.append(ico); }
      m.append(el('b', null, x.name), el('small', null, [x.kind === 'song' ? x.artist : `folder · ${x.count} song${x.count === 1 ? '' : 's'}`, `deleted ${ago(x.at)} by ${who(x.profile_id)}`, `${x.days_left} day${x.days_left === 1 ? '' : 's'} left`, x.bytes ? bytes(x.bytes) : ''].filter(Boolean).join(' · ')));
      const back = el('button', 'btn ghost', 'Put back'), del = el('button', 'icon-btn');
      del.innerHTML = svg('trash'); del.title = 'Delete for good';
      back.onclick = async () => { try { await post(`/api/trash/${x.id}/restore`); toast(`“${x.name}” is back`); state.tracksKey = ''; loadPlaylists(); again(); } catch (e) { toast(e.message, 'error'); } };
      del.onclick = async () => {
        if (!await confirmBox('Delete for good?', `“${x.name}” cannot be brought back after this.`, 'Delete for good')) return;
        try { await api(`/api/trash/${x.id}`, { method: 'DELETE' }); again(); } catch (e) { toast(e.message, 'error'); }
      };
      r.append(m, back, del); b.append(r);
    }
  }
  const a = box('What happened');
  if (!log.length) a.append(el('p', 'cl-note', 'Nothing yet.'));
  for (const x of log) {
    const r = el('div', 'act-row');
    r.append(el('span', 'act-t', ago(x.at)), el('span', 'act-p', x.profile || 'someone'), el('span', null, x.text));
    a.append(r);
  }
}

// ---------------------------------------------- profile PIN and kids mode
const profileKeys = load('profileKeys', {});
async function askPin(p) {
  for (;;) {
    const r = await dialog({ title: `PIN for ${p.name}`, text: 'This profile is locked.', fields: [{ label: 'PIN', type: 'password', mode: 'numeric' }], ok: 'Unlock' });
    if (!r) return false;
    try {
      const k = await api(`/api/profiles/${p.id}/unlock`, { method: 'POST', body: { pin: r[0] } });
      profileKeys[p.id] = k.key; save('profileKeys', profileKeys);
      return true;
    } catch (e) { toast(e.message, 'error'); }
  }
}
// The server refused because the profile in use has a PIN this browser has
// not entered yet: ask for it, or fall back to a profile without one.
let pinAsking = null;
function profileLocked() {
  if (pinAsking) return pinAsking;
  pinAsking = (async () => {
    await loadProfiles();
    const me = profile.list.find(p => p.id === profile.id);
    if (!(me && await askPin(me))) {
      const free = profile.list.find(p => !p.locked);
      if (free) { profile.id = free.id; save('profile', free.id); }
    }
    pinAsking = null;
    paintProfile(); state.tracksKey = '';
    await loadPlaylists(); go({ type: 'home' }, {});
  })();
  return pinAsking;
}
// Rename, PIN, kids mode and delete for one profile.
function profileActions(p, anchor) {
  const reload2 = async () => { await loadProfiles(); };
  const fail = e => toast(e.message, 'error');
  const items = [{ icon: 'edit', label: 'Rename', fn: async () => {
    const r = await dialog({ title: 'Rename profile', fields: [{ label: 'Name', value: p.name }] });
    if (r && r[0]) api('/api/profiles/' + p.id, { method: 'PATCH', body: { name: r[0] } }).then(reload2, fail);
  } }];
  items.push({ icon: 'lock', label: p.locked ? 'Change the PIN…' : 'Set a PIN…', fn: async () => {
    const r = await dialog({ title: `PIN for ${p.name}`, text: '4 to 8 digits. It is asked for when someone switches to this profile.', fields: [{ label: 'New PIN', type: 'password', mode: 'numeric' }], ok: 'Set PIN' });
    if (!r || !r[0]) return;
    try { const k = await api(`/api/profiles/${p.id}/pin`, { method: 'PUT', body: { pin: r[0] } }); profileKeys[p.id] = k.key; save('profileKeys', profileKeys); toast(`${p.name} now has a PIN`); reload2(); } catch (e) { fail(e); }
  } });
  if (p.locked) items.push({ icon: 'close', label: 'Remove the PIN', fn: () => api(`/api/profiles/${p.id}/pin`, { method: 'PUT', body: { pin: '' } }).then(() => { toast('PIN removed'); reload2(); }, fail) });
  if (p.id !== 1) {
    items.push({ icon: p.kid ? 'check' : 'heart', label: p.kid ? 'Listen-only: on (turn off)' : 'Make listen-only (for kids)', fn: () => api(`/api/profiles/${p.id}/kid`, { method: 'PUT', body: { kid: !p.kid } }).then(() => { toast(p.kid ? `${p.name} has full access again` : `${p.name} can now only listen: no downloading, deleting or changing`); reload2(); }, fail) });
    items.push({ icon: 'trash', label: 'Delete this profile', danger: true, fn: async () => {
      if (!await confirmBox('Delete this profile?', `“${p.name}” loses its likes, history and folders. The songs stay in the library.`, 'Delete')) return;
      try { await api('/api/profiles/' + p.id, { method: 'DELETE' }); const mine = p.id === profile.id; await loadProfiles(); if (mine) useProfile(1); } catch (e) { fail(e); }
    } });
  }
  openMenu(anchor, items, p.name);
}

// ------------------------------------------------ lyrics from the sound (AI)
function aiLyrics(t, anchor) {
  const go1 = language => post(`/api/tracks/${t.id}/lyrics/transcribe`, { language }).then(
    () => { state.wasPending = true; toast(`Listening to “${t.title}” and writing its lyrics. This takes a few minutes.`, 'info', 8000); },
    e => toast(e.message, 'error', 9000));
  openMenu(anchor, [
    { icon: 'lyrics', label: 'Detect the language', fn: () => go1('') },
    { icon: 'lyrics', label: 'Arabic', fn: () => go1('arabic') },
    { icon: 'lyrics', label: 'Turkish', fn: () => go1('turkish') },
    { icon: 'lyrics', label: 'English', fn: () => go1('english') },
  ], 'Write lyrics from the sound');
}

