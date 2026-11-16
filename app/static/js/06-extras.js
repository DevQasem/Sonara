'use strict';
// Sonara player, part: lyric cards, themes, home rows, Auto DJ, pictures, tags, translation, karaoke
// ------------------------------------------------------------- lyric cards
// A picture (or a short video with the music) of one to four lyric lines
// over the song's cover, to save or share.
const CARD_SIZES = { Portrait: [1080, 1350], Square: [1080, 1080], Story: [1080, 1920] };
function loadCardCover(t) {
  const url = !t.cover && !t.nocover && !t.ccover && t.video_id ? `/api/thumb/${t.video_id}` : coverUrl(t);
  return new Promise(res => {
    const im = new Image();
    if (/^https?:/.test(url)) im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = url;
  });
}
function wrapText(g, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const tryLine = line ? line + ' ' + w : w;
    if (line && g.measureText(tryLine).width > maxW) { out.push(line); line = w; } else line = tryLine;
  }
  if (line) out.push(line);
  return out;
}
const rtlText = s => /[֐-ࣿ]/.test(s);
function drawCard(cv, o) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, font = 'system-ui, "Segoe UI", Tahoma, sans-serif';
  g.globalAlpha = 1; g.shadowBlur = 0; g.filter = 'none';
  const bgc = g.createLinearGradient(0, 0, W, H);
  const cs0 = getComputedStyle(root);
  bgc.addColorStop(0, cs0.getPropertyValue('--accent').trim() || '#8b5cf6'); bgc.addColorStop(1, cs0.getPropertyValue('--accent2').trim() || '#ec4899');
  g.fillStyle = bgc; g.fillRect(0, 0, W, H);
  if (o.img) {
    const s = Math.max(W / o.img.width, H / o.img.height) * 1.2 * (o.zoom || 1);
    g.save(); g.filter = 'blur(34px) saturate(1.5)';
    g.drawImage(o.img, (W - o.img.width * s) / 2, (H - o.img.height * s) / 2, o.img.width * s, o.img.height * s);
    g.restore();
  }
  const dim = g.createLinearGradient(0, 0, 0, H);
  dim.addColorStop(0, 'rgba(0,0,0,.38)'); dim.addColorStop(1, 'rgba(0,0,0,.74)');
  g.fillStyle = dim; g.fillRect(0, 0, W, H);
  // the lyric lines
  const size = Math.round(W * (o.lines.length > 2 ? 0.056 : 0.068));
  g.font = `800 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rows = [];
  o.lines.forEach((text, i) => { g.direction = rtlText(text) ? 'rtl' : 'ltr'; for (const w of wrapText(g, text, W * 0.84)) rows.push({ w, i, dir: g.direction }); });
  const lh = size * 1.34, top = H * 0.43 - rows.length * lh / 2;
  g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 22;
  rows.forEach((r, k) => {
    const a = o.alpha ? o.alpha[r.i] : 1;
    g.globalAlpha = a * (o.active == null || o.active === r.i ? 1 : 0.45);
    g.direction = r.dir;
    g.fillText(r.w, W / 2, top + k * lh + lh / 2 + (1 - a) * size * 0.4);
  });
  g.globalAlpha = 1; g.shadowBlur = 0;
  // the song: small cover, title and artist
  const c = W * 0.13, x = W * 0.08, y = H - c - W * 0.08;
  if (o.img) {
    const m = Math.min(o.img.width, o.img.height);
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, c, c, c * 0.18) : g.rect(x, y, c, c); g.clip();
    g.drawImage(o.img, (o.img.width - m) / 2, (o.img.height - m) / 2, m, m, x, y, c, c);
    g.restore();
  }
  const tx = o.img ? x + c + W * 0.03 : x, fit = (s, f) => { g.font = f; let v = s; while (v.length > 4 && g.measureText(v).width > W - tx - x) v = v.slice(0, -2); return v === s ? s : v.trimEnd() + '…'; };
  g.textAlign = 'left'; g.direction = 'ltr'; g.fillStyle = '#fff';
  const f1 = `700 ${Math.round(W * 0.036)}px ${font}`, f2 = `500 ${Math.round(W * 0.029)}px ${font}`;
  g.fillText(fit(o.title, f1), tx, y + c * 0.34);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillText(fit(o.artist || '', f2), tx, y + c * 0.7);
}
// Which video format this browser can really record (some say they can make
// MP4 and then fail), found once by recording for half a second.
let recType;
async function pickRecType(stream) {
  if (recType !== undefined) return recType;
  for (const type of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm']) {
    if (!MediaRecorder.isTypeSupported(type)) continue;
    try {
      const rec = new MediaRecorder(stream, { mimeType: type });
      let size = 0, bad = false;
      rec.ondataavailable = e => { size += e.data.size; };
      rec.onerror = () => { bad = true; };
      const end = new Promise(res => { rec.onstop = res; });
      rec.start();
      await new Promise(res => setTimeout(res, 500));
      if (rec.state !== 'inactive') rec.stop();
      await Promise.race([end, new Promise(res => setTimeout(res, 1500))]);
      if (size && !bad) return (recType = type);
    } catch {}
  }
  return (recType = null);
}
async function lyricCard(index) {
  const t = current();
  const ps = [...$('lyrics').children].filter(p => !p.classList.contains('msg'));
  if (!t || !ps.length) return toast('Play a song with lyrics first');
  const synced = lyLines.length === ps.length;
  const all = ps.map((p, i) => ({ text: (p.firstChild ? p.firstChild.textContent : '').trim(), time: synced ? lyLines[i].time : null }));
  let start = Math.max(0, Math.min(index, all.length - 1)), count = 2, shape = 'Portrait';
  while (start < all.length - 1 && (!all[start].text || all[start].text === '♪')) start++;
  const img = await loadCardCover(t);
  const wrap = el('div', 'modal dlg-wrap'), box = el('div', 'dlg card-dlg'), cv = el('canvas', 'card-cv');
  const picked = () => all.slice(start, start + count).filter(l => l.text && l.text !== '♪');
  const draw = extra => { [cv.width, cv.height] = CARD_SIZES[shape]; drawCard(cv, { img, lines: picked().map(l => l.text), title: t.title, artist: t.artist, ...extra }); };
  const bar = el('div', 'card-bar'), seg = el('div', 'seg'), less = el('button', 'chip', '− line'), more = el('button', 'chip', '+ line'), up = el('button', 'chip', '↑'), down = el('button', 'chip', '↓');
  for (const k of Object.keys(CARD_SIZES)) { const b = el('button', k === shape ? 'sel' : '', k); b.type = 'button'; b.onclick = () => { shape = k; [...seg.children].forEach(x => x.classList.toggle('sel', x === b)); draw(); }; seg.append(b); }
  less.onclick = () => { count = Math.max(1, count - 1); draw(); };
  more.onclick = () => { count = Math.min(4, count + 1); draw(); };
  up.onclick = () => { start = Math.max(0, start - 1); draw(); }; up.title = 'Start one line earlier';
  down.onclick = () => { start = Math.min(all.length - 1, start + 1); draw(); }; down.title = 'Start one line later';
  bar.append(seg, up, down, less, more);
  const row = el('div', 'dlg-act'), note = el('small', 'card-note'), close = el('button', 'btn ghost', 'Close'), vid = el('button', 'btn ghost', 'Make video'), share = el('button', 'btn ghost', 'Share'), savePic = el('button', 'btn', 'Save picture');
  const name = ext => `${t.title} - lyrics.${ext}`.replace(/[\\/:*?"<>|]/g, '_');
  const give = (blob, ext) => { const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name(ext); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  const png = () => new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error('Could not make the picture')), 'image/png'); } catch (e) { rej(e); } });
  savePic.onclick = () => png().then(b => give(b, 'png'), e => toast(e.message, 'error'));
  share.onclick = async () => {
    try {
      const file = new File([await png()], name('png'), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: t.title });
      else if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]); toast('Picture copied: paste it into a chat'); }
      else give(file, 'png');
    } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'error'); }
  };
  vid.hidden = !(synced && t.id && window.MediaRecorder && cv.captureStream);
  vid.onclick = async () => {
    const lines = picked();
    if (!lines.length) return;
    const next = all[start + count], from = lines[0].time + lyOffset, len = Math.max(3, Math.min(20, (next ? next.time + lyOffset : lines[lines.length - 1].time + lyOffset + 4) - from));
    ensureEq(true);
    if (!actx || !fx) return toast('Video needs sound processing, which this browser did not allow', 'error');
    for (const b of [vid, share, savePic, less, more, up, down]) b.disabled = true;
    note.textContent = `Recording ${Math.round(len)} seconds with the music. Keep this window in front…`;
    const dest = actx.createMediaStreamDestination(); fx.boost.connect(dest);
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    draw();
    const type = await pickRecType(stream);
    if (!type) { fx.boost.disconnect(dest); for (const b of [vid, share, savePic, less, more, up, down]) b.disabled = false; note.textContent = ''; return toast('This browser cannot record video', 'error'); }
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const finished = new Promise(res => { rec.onstop = res; });
    audio.currentTime = Math.max(0, from - 0.35);
    try { await actx.resume(); await audio.play(); } catch {}
    rec.start();
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const now = audio.currentTime, p = Math.max(0, Math.min(1, (now - from) / len));
        const alpha = lines.map(l => Math.max(0, Math.min(1, (now - (l.time + lyOffset) + 0.2) / 0.45)));
        let active = 0; lines.forEach((l, i) => { if (now >= l.time + lyOffset - 0.05) active = i; });
        draw({ alpha, active, zoom: 1 + 0.1 * p });
        if (now >= from + len || performance.now() - t0 > (len + 6) * 1000 || !wrap.isConnected) return res();
        setTimeout(step, 33);  // a timer, so it keeps going if the window is covered
      };
      step();
    });
    rec.stop(); await finished;
    audio.pause(); fx.boost.disconnect(dest);
    for (const b of [vid, share, savePic, less, more, up, down]) b.disabled = false;
    draw();
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    if (!blob.size) { note.textContent = ''; return toast('The recording came out empty', 'error'); }
    note.textContent = 'Video saved to your downloads.';
    give(blob, type.startsWith('video/mp4') ? 'mp4' : 'webm');
  };
  row.append(note, close, vid, share, savePic);
  box.append(el('h3', null, 'Lyric card'), cv, bar, row); wrap.append(box); document.body.append(wrap);
  const done = () => wrap.remove();
  close.onclick = done;
  wrap.onpointerdown = e => { if (e.target === wrap) done(); };
  wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(); };
  draw();
}
$('lyrics').oncontextmenu = e => {
  const p = e.target.closest('p');
  if (!p || p.classList.contains('msg') || p.parentNode !== $('lyrics')) return;
  e.preventDefault();
  const i = [...$('lyrics').children].filter(x => !x.classList.contains('msg')).indexOf(p);
  const items = [];
  // lyrics that run early or late: say "this line is being sung now" and all lines move with it
  if (lyLines[i] && lyLines.length === $('lyrics').querySelectorAll('p:not(.msg)').length) items.push({ icon: 'history', label: 'This line is being sung now (fix the timing)', fn: () => { nudgeLyrics(audio.currentTime - lyLines[i].time - lyOffset); toast('Lyrics timing moved for this song'); } });
  items.push({ icon: 'lyrics', label: 'Make a lyric card from this line', fn: () => lyricCard(i) });
  openMenu(at(e), items, 'Lyrics');
};
$('lyCard').onclick = () => lyricCard(lyActive >= 0 ? lyActive : 0);

// ---------------------------------------------- themes: own background picture
function applyWall() {
  const pic = load('wall', null);
  document.body.classList.toggle('has-wall', !!pic);
  root.style.setProperty('--wall', pic ? `url("${pic}")` : 'none');
  root.style.setProperty('--wall-dim', String(prefs.wallDim ?? 0.55));
}
function pickWall() {
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const im = new Image();
    im.onload = () => {
      // kept in this browser, scaled down so it fits its storage
      const s = Math.min(1, 1920 / Math.max(im.width, im.height)), c = el('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      try { localStorage.setItem('wall', JSON.stringify(c.toDataURL('image/jpeg', 0.82))); applyWall(); toast('Background picture set'); }
      catch { toast('That picture is too large to keep in this browser', 'error'); }
      URL.revokeObjectURL(im.src);
    };
    im.onerror = () => toast('Could not read that picture', 'error');
    im.src = URL.createObjectURL(f);
  };
  inp.click();
}

// ---------------------------------------------------- custom Home shelves
const HOME_SHELVES = { recent: 'Jump back in', videos: 'Videos', added: 'Recently added', top: 'Most played', artists: 'Your artists', folders: 'Folders' };
function homeOrder() {
  const saved = Array.isArray(prefs.home) ? prefs.home.filter(h => HOME_SHELVES[h.id]) : [];
  for (const id of Object.keys(HOME_SHELVES)) if (!saved.some(h => h.id === id)) saved.push({ id, on: true });
  return saved;
}
function homeDialog(redraw) {
  const wrap = el('div', 'modal dlg-wrap'), form = el('form', 'dlg'), list = el('div', 'home-list');
  form.append(el('h3', null, 'Your Home page'), el('p', null, 'Tick the rows you want and drag them into your order.'), list);
  const keep = () => { prefs.home = [...list.children].map(r => ({ id: r.dataset.hid, on: r.querySelector('input').checked })); save('prefs', prefs); redraw(); };
  for (const h of homeOrder()) {
    const r = el('div', 'dlg-opt home-row' + (h.on ? ' sel' : '')), c = el('input'), grip = el('span', 'grip');
    r.dataset.hid = h.id; c.type = 'checkbox'; c.checked = h.on;
    c.onchange = () => { r.classList.toggle('sel', c.checked); keep(); };
    grip.innerHTML = svg('more'); grip.title = 'Drag to move';
    grip.onpointerdown = e => cardDrag(e, r, list, '.home-row', true, keep);
    r.append(c, el('span', null, HOME_SHELVES[h.id]), grip);
    list.append(r);
  }
  const row = el('div', 'dlg-act'), reset = el('button', 'btn ghost', 'Reset'), ok = el('button', 'btn', 'Done');
  reset.type = 'button';
  reset.onclick = () => { delete prefs.home; save('prefs', prefs); redraw(); wrap.remove(); homeDialog(redraw); };
  row.append(reset, ok); form.append(row); wrap.append(form); document.body.append(wrap);
  const done = () => wrap.remove();
  wrap.onpointerdown = e => { if (e.target === wrap) done(); };
  wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(); };
  form.onsubmit = e => { e.preventDefault(); done(); };
  ok.focus();
}

// Every profile has its own library. This puts songs into another profile's
// library as well, without downloading them a second time.
function shareTo(list, anchor) {
  openMenu(anchor, profile.list.filter(p => p.id !== profile.id).map(p => ({ icon: 'person', label: p.name, fn: async () => {
    let n = 0;
    for (const t of list) { try { await post(`/api/tracks/${t.id}/share`, { profile: p.id }); n++; } catch (e) { toast(e.message, 'error'); break; } }
    if (n) toast(`${n} song${n === 1 ? '' : 's'} copied to ${p.name}'s library`);
  } })), 'Copy to which profile?');
}

// ------------------------------------------------ Auto DJ and the crossfade
// Auto DJ: when the AI knows the tempo of both songs and they are close, the
// next song is sped up or slowed a little to the same tempo, started on a
// beat of the song that is ending, mixed in over 16 beats, and then eased
// back to its own tempo. Otherwise songs simply fade into each other.
let xSwapAt = 0, djLag = 0.15;   // how long a song takes to start sounding, learned as it goes
function djPlan(cur, nxt) {
  if (!prefs.autoDj || remix.speed !== 1 || !cur.bpm || !nxt || !nxt.id || !nxt.bpm) return null;
  for (const f of [1, 2, 0.5]) {
    const rate = cur.bpm / nxt.bpm * f;
    if (rate > 0.92 && rate < 1.08) return { rate, period: 60 / cur.bpm, x: Math.max(6, Math.min(14, 16 * 60 / cur.bpm)) };
  }
  return null;
}
function maybeCrossfade(t, d) {
  const cur = current();
  if (xfading || !cur || !cur.id || cur.noFade || !d || audio.paused || audio.seeking || state.sleepMode === 'end') return;
  const left = (d - t) / (audio.playbackRate || 1);
  if (left > 40) { cur._nx = undefined; return; }
  if (cur._nx === undefined || !state.queue[cur._nx]) cur._nx = pickNext(true);
  const i = cur._nx, nxt = state.queue[i], plan = i >= 0 && i !== state.index ? djPlan(cur, nxt) : null;
  const x = plan ? plan.x : prefs.xfade;
  if (!x || d < x * 4 || left > x + 8) return;
  if (tailFor !== cur) {  // get the helper player ready a few seconds early
    tailFor = cur; tail.muted = true; tail.src = srcOf(cur); tail.currentTime = Math.max(0, d - x - 1);
    return;
  }
  if (left > x || left < 0.4 || i < 0 || i === state.index || !nxt) return;
  xfading = true;
  const level = audio.volume * Math.min(1, normGain()), secs = Math.min(x, left);
  let switched = false;
  const swap = () => {
    if (switched) return;
    switched = true;
    xSwapAt = performance.now();
    tail.volume = level; fadeMul = 0; applyVol();
    const asked = performance.now();
    playIndex(i, true, plan ? ((nxt.beat0 || 0) % (60 / nxt.bpm)) + djLag * plan.rate : 0);  // from its first beat, not skipping an intro
    if (plan) {
      const base = audio.playbackRate;
      audio.playbackRate = base * plan.rate;
      audio.addEventListener('playing', () => { djLag = Math.min(0.5, (djLag + (performance.now() - asked) / 1000) / 2); }, { once: true });
      setTimeout(() => {  // the mix is over: ease back to the song's own tempo
        const t1 = performance.now(), iv = setInterval(() => {
          const p = Math.min(1, (performance.now() - t1) / 8000);
          if (current() !== nxt || remix.speed !== 1) return clearInterval(iv);
          audio.playbackRate = base * (plan.rate + (1 - plan.rate) * p);
          if (p >= 1) clearInterval(iv);
        }, 200);
      }, secs * 1000);
    }
    const t0 = performance.now();
    clearInterval(xTimer);
    xTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / (secs * 1000));
      fadeMul = Math.sin(p * Math.PI / 2); applyVol();
      tail.volume = level * Math.cos(p * Math.PI / 2);
      if (p >= 1 || tail.ended) stopTail();
    }, 40);
  };
  // with Auto DJ the switch waits for the next beat of the song that is ending
  const onBeat = () => {
    if (!plan || cur.beat0 == null) return swap();
    const phase = (((audio.currentTime - cur.beat0) % plan.period) + plan.period) % plan.period;
    setTimeout(swap, ((plan.period - phase) % plan.period) * 1000);
  };
  tail.playbackRate = audio.playbackRate; tail.preservesPitch = audio.preservesPitch;
  tail.currentTime = audio.currentTime; tail.muted = false; tail.volume = 0;
  tail.addEventListener('playing', onBeat, { once: true });
  tail.play().then(() => setTimeout(swap, 1600), () => { switched = true; xfading = false; cur.noFade = true; });
}

// ----------------------------------------------- pictures: hide, change, folders
function patchTrack(id, fields) {
  for (const list of [state.queue, state.tracks, state.shown, (state.home && state.home.all) || []]) for (const x of list) if (x.id === id) Object.assign(x, fields);
}
function refreshPictures(t) {
  state.tracksKey = '';
  const c = current();
  if (c && c.id === t.id) {
    setImg($('art'), c); setImg($('npArt'), c);
    $('npBg').style.backgroundImage = `url("${coverUrl(c)}")`;
    themeFromCover(c); paintMode(c); paintHide(c); renderQueue();
  }
  if (isList(state.view)) drawTracks();
  else if (['home', 'albums', 'search', 'cleanup'].includes(state.view.type)) go(state.view, {});
}
// Hide a song's picture (and its video) everywhere, for example when it is
// not one you want on screen. Only the same button brings it back.
async function setHidden(t, hidden) {
  try { await api(`/api/tracks/${t.id}/picture`, { method: 'PUT', body: { hidden } }); } catch (e) { return toast(e.message, 'error'); }
  t.nocover = hidden ? 1 : 0; patchTrack(t.id, { nocover: t.nocover });
  refreshPictures(t);
  toast(hidden ? 'Picture hidden. The same button shows it again.' : 'Picture shown again');
}
function pickImage(fn) {
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files[0]) fn(inp.files[0]); };
  inp.click();
}
function pictureItems(t) {
  if (!t.id) return [];
  const setOwn = v => { t.ccover = v; patchTrack(t.id, { ccover: v }); refreshPictures(t); };
  const items = [
    { icon: t.nocover ? 'eye' : 'eyeOff', label: t.nocover ? 'Show the picture' : 'Hide the picture', fn: () => setHidden(t, !t.nocover) },
    { icon: 'upload', label: 'Use my own picture…', fn: () => pickImage(async f => {
      try { await api(`/api/tracks/${t.id}/cover`, { method: 'POST', body: f }); } catch (e) { return toast(e.message, 'error'); }
      setOwn(Math.floor(Date.now() / 1000)); toast('Picture changed');
    }) },
  ];
  if (t.ccover) items.push({ icon: 'close', label: 'Back to the original picture', fn: async () => {
    try { await api(`/api/tracks/${t.id}/cover`, { method: 'DELETE' }); } catch (e) { return toast(e.message, 'error'); }
    setOwn(0);
  } });
  return items;
}
function paintHide(t) {
  const b = $('npHide');
  b.hidden = !t || !t.id;
  if (b.hidden) return;
  b.innerHTML = svg(t.nocover ? 'eye' : 'eyeOff');
  b.title = t.nocover ? 'Show this song’s picture again' : 'Hide this song’s picture';
  b.classList.toggle('on', !!t.nocover);
}
$('npHide').onclick = () => { const t = current(); if (t && t.id) setHidden(t, !t.nocover); };
function folderTile(tile, p) {
  if (!p.cover) return;
  tile.style.background = `center / cover no-repeat url("/api/playlists/${p.id}/cover?v=${p.cover}")`;
  tile.innerHTML = '';
}
function folderPictureItems(p, redraw) {
  const items = [{ icon: 'upload', label: 'Set a picture…', fn: () => pickImage(async f => {
    try { await api(`/api/playlists/${p.id}/cover`, { method: 'POST', body: f }); toast('Folder picture set'); redraw(); } catch (e) { toast(e.message, 'error'); }
  }) }];
  if (p.cover) items.push({ icon: 'close', label: 'Remove the picture', fn: () => api(`/api/playlists/${p.id}/cover`, { method: 'DELETE' }).then(redraw, e => toast(e.message, 'error')) });
  return items;
}

// ------------------------------------------------------- AI tags and albums
function tagsOf(t) {
  if (t._tags === undefined) { try { t._tags = t.tags ? JSON.parse(t.tags) : null; } catch { t._tags = null; } }
  return t._tags;
}
const tagList = t => { const g = tagsOf(t); return g ? [...(g.genre || []), g.mood, g.language].filter(Boolean) : []; };
function paintTags(t) {
  const bits = t ? tagList(t) : [];
  if (t && t.bpm) bits.push(Math.round(t.bpm) + ' BPM');
  if (t && t.album) bits.push(t.album + (t.year ? ` (${t.year})` : ''));
  $('npTags').textContent = bits.join(' · ');
}
// The "All tags" box above a list: genres, moods and languages found in it.
function fillTags() {
  const sel = $('tagSel');
  if (!sel) return;
  const all = new Map();
  for (const t of state.tracks) for (const x of tagList(t)) all.set(x, (all.get(x) || 0) + 1);
  sel.replaceChildren(new Option('All tags', ''));
  [...all].sort((a, b) => b[1] - a[1]).forEach(([x, n]) => sel.append(new Option(`${x} (${n})`, x)));
  if (!all.has(state.tag)) state.tag = '';
  sel.value = state.tag || '';
  sel.hidden = !all.size;
}
async function renderAlbums() {
  const view = state.view, main = $('main');
  main.replaceChildren(hero('Your music', 'Albums', 'album'));
  state.shown = [];
  let d;
  try { d = await api('/api/albums'); } catch (e) { if (state.view === view) main.append(el('div', 'empty', e.message)); return; }
  if (state.view !== view) return;
  const n = d.albums.length;
  $('heroSub').textContent = `${n} album${n === 1 ? '' : 's'}` + (d.waiting ? ` · still looking up ${d.waiting} song${d.waiting === 1 ? '' : 's'}` : '');
  if (!n) return main.append(el('div', 'empty', d.waiting ? 'Looking up which albums your songs are from. This fills in by itself over the next minutes.' : 'No albums were found for your songs.'));
  const grid = el('div', 'grid');
  d.albums.forEach((a, i) => {
    const c = el('button', 'card'), img = el('img', 'tile');
    c.style.animationDelay = Math.min(i, 20) * 20 + 'ms';
    img.loading = 'lazy'; img.alt = ''; setImg(img, a.cover);
    c.append(img, el('b', null, a.album), el('small', null, [a.artist, a.year, `${a.count} song${a.count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')));
    c.onclick = () => go({ type: 'album', name: a.album });
    grid.append(c);
  });
  main.append(grid);
}

// --------------------------------------------------------- lyrics translation
const TR_LANGS = [['en', 'English'], ['ar', 'Arabic'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['ru', 'Russian']];
const trKey = s => String(s).replace(/\s+/g, ' ').trim();
// the translated line, shown small under the original one
function addTr(p, text, d) {
  const m = prefs.trLang && d.tr && d.tr.lang === prefs.trLang && d.tr.map[trKey(text)];
  if (m) p.append(el('span', 'tr', m));
}
const redrawLyrics = () => { state.lyricsFor = null; showLyrics(); };
function translateTo(code) {
  const t = current();
  prefs.trLang = code; save('prefs', prefs);
  const d = t && lyricsCache.get(tkey(t));
  if (d && d.tr && d.tr.lang === code) return redrawLyrics();
  if (!t || !t.id) return toast('Download this song first: translation works on songs in your library');
  post(`/api/tracks/${t.id}/lyrics/translate`, { target: code }).then(
    () => { state.wasPending = true; toast('Translating the lyrics. They appear under each line in a minute (the first time ever also downloads the language model).', 'info', 9000); },
    e => toast(e.message, 'error', 9000));
}
$('lyTr').onclick = e => {
  if (!current()) return toast('Play a song first');
  const items = TR_LANGS.map(([code, name]) => ({ icon: prefs.trLang === code ? 'check' : 'lyrics', label: name, fn: () => translateTo(code) }));
  if (prefs.trLang) items.push({ icon: 'close', label: 'Hide the translation', fn: () => { prefs.trLang = null; save('prefs', prefs); redrawLyrics(); } });
  openMenu(e.currentTarget, items, 'Translate the lyrics to');
};

// --------------------------------------------------------------- karaoke mode
// The singing is taken out and the lyrics fill the screen. It stays on from
// song to song and gets the next song ready ahead of time.
function karaokeSong(t) {
  if (t.id && !t.stem && !t.stemWant) setStem('music', true);
  const n = state.queue[state.index + 1];
  if (n && n.id) post(`/api/tracks/${n.id}/stems`).catch(() => {});
}
function toggleKaraoke(on = !document.body.classList.contains('karaoke')) {
  const t = current();
  if (on && !t) return toast('Play a song first');
  document.body.classList.toggle('karaoke', on);
  $('npKara').classList.toggle('on', on);
  if (on) {
    openNp(true);
    karaokeSong(t);
    toast('Karaoke: the singing is taken out and the words are big. The microphone button leaves it.', 'info', 7000);
  } else if (t && (t.stem === 'music' || t.stemWant)) {
    t.stemWant = null;
    if (t.stem) swapStem(t, null); else paintFx();
  }
}
$('npKara').onclick = () => toggleKaraoke();

