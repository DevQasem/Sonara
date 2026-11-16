'use strict';
// Sonara player, part: home, remix studio, Spotify preview, search and upload
// ----------------------------------------------- sources: YouTube / Spotify / Local
// Everything lives in one library; a small badge says where a song came
// from, and the filter chips narrow Home and the lists to one source.
const SOURCES = [['all', 'All'], ['youtube', 'YouTube'], ['spotify', 'Spotify'], ['local', 'Local'], ['video', 'Videos']];
const SRC_BADGE = { youtube: ['yt', 'YT'], spotify: ['sp', 'SP'], upload: ['local', 'LOCAL'], remix: ['remix', 'REMIX'], ai: ['ai', 'AI'] };
const srcMatch = (t, f) => f === 'all' || (f === 'video' ? t.kind === 'video' : f === 'local' ? ['upload', 'remix', 'ai'].includes(t.source) : t.source === f);
function srcBadge(t) { const b = SRC_BADGE[t.source]; return b ? el('span', 'src ' + b[0], b[1]) : null; }
function srcChips(redraw) {
  const bar = el('div', 'chips');
  for (const [v, label] of SOURCES) {
    const b = el('button', 'chip' + (prefs.src === v ? ' sel' : ''), label);
    b.onclick = () => {
      prefs.src = v; save('prefs', prefs);
      [...bar.children].forEach(c => c.classList.toggle('sel', c === b));
      redraw();
    };
    bar.append(b);
  }
  return bar;
}

// ------------------------------------------------------------------ home
const sectionHead = (title, more) => {
  const h = el('div', 'sec-h'); h.append(el('h2', null, title));
  if (more) { const b = el('button', 'chip', 'Show all'); b.onclick = () => go(more); h.append(b); }
  return h;
};
function trackTile(t, list) {
  const c = el('button', 'card'), img = el('img', 'tile'), badge = srcBadge(t);
  img.loading = 'lazy'; img.alt = ''; setImg(img, t);
  c.append(img, el('b', null, t.title), el('small', null, t.artist || ' '));
  if (badge) c.append(badge);
  c.onclick = () => { state.queue = list.slice(); playIndex(list.indexOf(t)); };
  c.oncontextmenu = e => { e.preventDefault(); trackMenu(t, at(e)); };
  c._track = t;  // lets the card be dragged onto a folder
  return c;
}
// A wide 16:9 card for the video row; opens the song with its picture.
function videoTile(t, list) {
  const c = el('button', 'card wide'), thumb = el('div', 'thumb'), img = el('img');
  img.loading = 'lazy'; img.alt = ''; setImg(img, t);
  thumb.append(img, el('span', 'dur', t.duration ? fmt(t.duration) : ''));
  thumb.insertAdjacentHTML('beforeend', `<i class="play-ico">${svg('play')}</i>`);
  c.append(thumb, el('b', null, t.title), el('small', null, t.artist || ' '));
  c.onclick = () => {
    prefs.avMode = 'video'; save('prefs', prefs);
    state.queue = list.slice(); playIndex(list.indexOf(t));
    openNp();
  };
  c.oncontextmenu = e => { e.preventDefault(); trackMenu(t, at(e)); };
  c._track = t;
  return c;
}
async function renderHome() {
  const view = state.view, main = $('main'), hour = new Date().getHours();
  main.replaceChildren(hero('Home', hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening', 'home'));
  state.shown = [];
  let all, recent, top;
  try { [all, recent, top] = await Promise.all([api('/api/tracks'), api('/api/tracks?view=recent'), api('/api/tracks?view=top'), loadPlaylists()]); }
  catch (e) { if (state.view === view) main.append(el('div', 'empty', e.message)); return; }
  state.home = { all };
  if (state.view !== view) return;
  const videos = all.filter(t => t.kind === 'video').length;
  $('heroSub').textContent = `${all.length} song${all.length === 1 ? '' : 's'}${videos ? ` · ${videos} with video` : ''} from YouTube, Spotify and your own files`;
  if (!all.length) return main.append(el('div', 'empty', LISTS.library.empty));
  const body = el('div');
  const draw = () => {
    body.replaceChildren();
    const parts = {};
    const pick = l => l.filter(t => t.status === 'ready' && srcMatch(t, prefs.src));
    const shelf = (id, title, cards, more) => {
      if (!cards.length) return;
      const row = el('div', 'shelf'); row.append(...cards);
      parts[id] = [sectionHead(title, more), row];
    };
    const tiles = l => l.map(t => trackTile(t, l));
    shelf('recent', 'Jump back in', tiles(pick(recent).slice(0, 12)), { type: 'recent' });
    const vids = pick(all).filter(t => t.kind === 'video').slice(0, 12);
    shelf('videos', 'Videos', vids.map(t => videoTile(t, vids)));
    shelf('added', 'Recently added', tiles(pick(all).slice(0, 16)), { type: 'library' });
    shelf('top', 'Most played', tiles(pick(top).slice(0, 12)), { type: 'top' });
    const byArtist = new Map();
    for (const t of pick(all)) for (const a of artistsOf(t)) {
      const k = a.toLowerCase(), c = byArtist.get(k) || { name: a, n: 0, t };
      c.n++; byArtist.set(k, c);
    }
    shelf('artists', 'Your artists', [...byArtist.values()].sort((a, b) => b.n - a.n).slice(0, 14).map(a => {
      const c = el('button', 'card artist'), img = el('img', 'tile');
      img.loading = 'lazy'; img.alt = '';
      img.onerror = () => setImg(img, a.t);  // no artist photo found: use a cover of theirs
      img.src = '/api/artist/picture?name=' + encodeURIComponent(a.name);
      c.append(img, el('b', null, a.name), el('small', null, `${a.n} song${a.n === 1 ? '' : 's'}`));
      c.onclick = () => go({ type: 'artist', name: a.name });
      return c;
    }));
    if (prefs.src === 'all') shelf('folders', 'Folders', state.playlists.map(p => {
      const c = el('button', 'card'), t = el('div', 'tile');
      t.style.background = grad(p.name); t.innerHTML = svg(p.source === 'folder' ? 'folder' : 'music'); folderTile(t, p);
      c.append(t, el('b', null, p.name), el('small', null, `${p.count} track${p.count === 1 ? '' : 's'}`));
      c.onclick = () => go({ type: 'playlist', id: p.id, name: p.name, source: p.source });
      return c;
    }), { type: 'folders' });
    for (const h of homeOrder()) if (h.on && parts[h.id]) body.append(...parts[h.id]);  // the rows and order chosen under Customize
    if (!body.children.length) body.append(el('div', 'empty', 'Nothing to show here. Choose rows under Customize, or another source.'));
  };
  const chips = srcChips(draw), edit = el('button', 'chip home-edit', 'Customize');
  edit.title = 'Choose the rows of this page and their order';
  edit.onclick = () => homeDialog(draw);
  chips.append(edit);
  main.append(chips, body);
  draw();
}

// The AI jobs that are waiting or running, shown at the top of the studio.
const JOB_WORD = { tags: 'Tagging', translate: 'Translating the lyrics of', stems: 'Separating vocals and music of', lyrics: 'Writing the lyrics of', extend: 'Extending', song: 'Creating', cover: 'Covering', repaint: 'Re-making part of', split: 'Splitting', mashup: 'Mixing', generate: 'Creating' };
function paintAi() {
  const box = $('stJobs');
  if (!box) return;
  box.replaceChildren(...(state.ai || []).map(j => {
    const row = el('div', 'st-job ' + j.state);
    row.append(el('i', 'spin'), el('span', null, `${j.state === 'working' ? JOB_WORD[j.kind] || 'Working on' : 'Waiting:'} “${j.label}”`));
    return row;
  }));
}
function paintDownloads() {
  for (const d of state.downloads || []) $$(`#main .row[data-key="${d.id}"] .tag`).forEach(s => { s.textContent = dlText(d); });
}

// ----------------------------------------------------------------- remix
// Change the song that is playing (speed, bass, reverb, 8D) and hear it
// live; "Save" renders the same thing on the server as a new song.
const REMIX_PRESETS = [
  ['Original', { speed: 1, bass: 0, reverb: 0, pan: false }],
  ['Slowed + Reverb', { speed: 0.85, bass: 2, reverb: 0.5, pan: false }],
  ['Super slowed', { speed: 0.75, bass: 3, reverb: 0.65, pan: false }],
  ['Sped up', { speed: 1.2, bass: 0, reverb: 0, pan: false }],
  ['Nightcore', { speed: 1.3, bass: 0, reverb: 0.1, pan: false }],
  ['Bass boosted', { speed: 1, bass: 10, reverb: 0, pan: false }],
  ['8D audio', { speed: 1, bass: 2, reverb: 0.3, pan: true }],
];
const samePreset = v => v.speed === remix.speed && v.bass === remix.bass && v.reverb === remix.reverb && v.pan === remix.pan;
function remixLabel() {
  const p = REMIX_PRESETS.find(([, v]) => samePreset(v));
  if (p) return p[0];
  return [remix.speed < 1 ? 'Slowed' : remix.speed > 1 ? 'Sped up' : '', remix.reverb ? 'Reverb' : '', remix.bass ? 'Bass boosted' : '', remix.pan ? '8D' : ''].filter(Boolean).join(' + ') || 'Remix';
}
let paintRemix = null, remixNamed = false;
function resetRemix() {
  Object.assign(remix, REMIX_PRESETS[0][1]);
  remixNamed = false;
  applyRemix();
  if (state.view.type === 'remix' && paintRemix) paintRemix();
}
// The Remix page is a small studio with four parts:
//   Create     a new song from a style and lyrics (song engine)
//   Effects    change the playing song live and save the result
//   AI tools   cover, re-make a part, split vocals, mashup, quick beat
//   Creations  everything made here
const STYLE_IDEAS = ['Phonk', 'Arabic pop', 'Turkish pop', 'Trap', 'Drill', 'Lo-fi', 'EDM', 'Rock', 'Dabke', 'R&B', 'Synthwave', 'Piano ballad', 'Female vocals', 'Male vocals', 'Heavy bass', 'Slow and emotional', 'Fast and energetic'];
const LYRIC_TAGS = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Bridge]', '[Outro]'];
const SING_LANGS = [['', 'Let the song decide'], ['en', 'English'], ['ar', 'Arabic'], ['tr', 'Turkish'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['hi', 'Hindi'], ['ko', 'Korean'], ['ja', 'Japanese'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['it', 'Italian']];
const clock = v => { const p = String(v).trim().split(':').map(Number); return !String(v).trim() || p.some(isNaN) ? NaN : p.reduce((a, b) => a * 60 + b, 0); };
async function renderRemix() {
  const view = state.view, main = $('main');
  main.replaceChildren(hero('Studio', 'Remix', 'tune'));
  $('heroSub').textContent = 'Make new songs, change the ones you have, and mix them together.';
  state.shown = [];
  let all = [];
  try { all = await api('/api/tracks'); } catch (e) { toast(e.message, 'error'); }
  if (state.view !== view) return;
  const songs = all.filter(t => t.status === 'ready');
  const songSelect = (first, id) => {
    const s = el('select'); if (id) s.id = id;
    s.append(new Option(first, ''));
    for (const t of songs) s.append(new Option(t.title + (t.artist ? ' — ' + t.artist : ''), t.id));
    return s;
  };
  const tabs = el('div', 'seg studio-tabs'), jobs = el('div', 'st-jobs'), pages = {};
  jobs.id = 'stJobs';
  for (const [id, label, icon] of [['create', 'Create', 'plus'], ['effects', 'Effects', 'tune'], ['tools', 'AI tools', 'music'], ['made', 'Creations', 'folder']]) {
    const b = el('button'); b.dataset.tab = id; b.innerHTML = svg(icon); b.append(el('span', null, label));
    tabs.append(b);
    pages[id] = el('div', 'set remix'); pages[id].hidden = true;
  }
  main.append(tabs, jobs, ...Object.values(pages));
  const drawMade = async () => {
    const box = pages.made;
    let list = all;
    try { list = all = await api('/api/tracks'); } catch {}
    if (state.view !== view) return;
    list = list.filter(t => t.source === 'ai' || t.source === 'remix');
    box.replaceChildren();
    state.shown = list;
    if (!list.length) return box.append(el('div', 'empty', 'Nothing made yet. Songs you create, remix, cover, split or mash up appear here.'));
    list.forEach((t, i) => box.append(trackRow(t, i)));
    paintPicked();
  };
  const show = id => {
    prefs.studio = id; save('prefs', prefs);
    [...tabs.children].forEach(b => b.classList.toggle('sel', b.dataset.tab === id));
    for (const k in pages) pages[k].hidden = k !== id;
    state.shown = [];
    if (id === 'made') drawMade();
  };
  tabs.onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.tab); };
  state.studioRefresh = () => { if (state.view === view && prefs.studio === 'made') drawMade(); };

  // ---- Create: a new song from a style and lyrics
  pages.create.innerHTML = `
  <div class="box"><h3>New song</h3>
    <div class="field col"><label for="sgStyle">Style of music</label><textarea id="sgStyle" rows="2" placeholder="For example: Arabic pop, emotional male vocals, oud and strings, 95 bpm"></textarea><div class="st-chips" id="sgIdeas"></div></div>
    <div class="field"><div><b>Instrumental</b><small>Music only, no singing</small></div>${sw('sgInst')}</div>
    <div class="field col" id="sgLyricsBox"><label for="sgLyrics">Lyrics</label><textarea id="sgLyrics" rows="9" placeholder="[Verse]&#10;Write the words here, in any language&#10;&#10;[Chorus]&#10;The part that repeats"></textarea><div class="st-chips" id="sgTags"></div><small>The words are sung as you write them. Tags like [Verse] and [Chorus] shape the song.</small></div>
    <div class="field"><div><label for="sgTitle">Title</label></div><input type="text" id="sgTitle" placeholder="Name of the song" autocomplete="off"></div>
    <div class="field"><div><b>Length</b><small id="sgLenL"></small></div><input type="range" id="sgLen" min="30" max="300" step="10" value="120"></div>
  </div>
  <div class="box"><h3>More options</h3>
    <div class="field"><div><label for="sgLang">Language of the singing</label></div><select id="sgLang"></select></div>
    <div class="field"><div><label for="sgBpm">Tempo</label><small>Beats per minute; empty lets the style decide</small></div><input type="text" id="sgBpm" inputmode="numeric" placeholder="auto" autocomplete="off"></div>
    <div class="field"><div><label for="sgKey">Key</label><small>For example A minor; empty lets the style decide</small></div><input type="text" id="sgKey" placeholder="auto" autocomplete="off"></div>
  </div>
  <div class="st-go"><small class="st-state" data-need="songs"></small><button class="btn" id="sgGo" data-need="songs" disabled>Create song</button></div>`;
  for (const idea of STYLE_IDEAS) {
    const b = el('button', 'chip', idea);
    b.onclick = () => { const s = $('sgStyle'), v = s.value.trim(); s.value = v ? v.replace(/,\s*$/, '') + ', ' + idea.toLowerCase() : idea; };
    $('sgIdeas').append(b);
  }
  for (const tag of LYRIC_TAGS) {
    const b = el('button', 'chip', tag);
    b.onclick = () => { const s = $('sgLyrics'), at = s.selectionStart ?? s.value.length, lead = at && s.value[at - 1] !== '\n' ? '\n' : ''; s.setRangeText(lead + tag + '\n', at, s.selectionEnd ?? at, 'end'); s.focus(); };
    $('sgTags').append(b);
  }
  for (const [v, l] of SING_LANGS) $('sgLang').append(new Option(l, v));
  const lenLabel = () => { const v = +$('sgLen').value; $('sgLenL').textContent = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; fill($('sgLen')); };
  $('sgLen').oninput = lenLabel; lenLabel();
  $('sgInst').onchange = e => { $('sgLyricsBox').hidden = e.target.checked; };
  $('sgGo').onclick = async () => {
    const style = $('sgStyle').value.trim(), inst = $('sgInst').checked, lyrics = inst ? '' : $('sgLyrics').value.trim();
    if (!style) return toast('Describe the style of music first');
    if (!inst && !lyrics) return toast('Write some lyrics, or switch on Instrumental');
    const bpm = parseInt($('sgBpm').value, 10);
    try {
      await post('/api/studio/song', { title: $('sgTitle').value.trim(), style, lyrics, duration: +$('sgLen').value, bpm: bpm || null, key: $('sgKey').value.trim(), language: $('sgLang').value });
      state.wasPending = true;
      toast('Creating your song — it appears under Creations when it is done');
    } catch (e) { toast(e.message, 'error', 9000); }
  };

  // ---- Effects: change the playing song live, then save the result
  pages.effects.innerHTML = `
  <div class="box"><h3>Song</h3>
    <div class="field"><div><b id="rxNow"></b><small>Pick the song to change. It starts playing so you can hear every change.</small></div></div>
  </div>
  <div class="box"><h3>Style</h3>
    <div class="field"><div class="rx-presets" id="rxPresets"></div></div>
    <div class="field"><div><b>Speed</b><small id="rxSpeedL"></small></div><input type="range" id="rxSpeed" min="0.5" max="1.5" step="0.01"></div>
    <div class="field"><div><b>Bass</b><small id="rxBassL"></small></div><input type="range" id="rxBass" min="0" max="15" step="0.5"></div>
    <div class="field"><div><b>Reverb</b><small id="rxRevL"></small></div><input type="range" id="rxRev" min="0" max="1" step="0.05"></div>
    <div class="field"><div><b>8D</b><small>The sound circles slowly from ear to ear (best with headphones)</small></div>${sw('rxPan')}</div>
  </div>
  <div class="box"><h3>Save</h3>
    <div class="field"><div><label for="rxName">Name of the new song</label></div><input type="text" id="rxName" autocomplete="off"></div>
    <div class="field"><div><small>Saved as a new song in your library. Synced lyrics are re-timed to the new speed.</small></div><button class="btn" id="rxSave">Save as new song</button></div>
  </div>`;
  const sel = songSelect('Choose a song…', 'rxSong');
  $('rxNow').closest('.field').append(sel);
  sel.onchange = () => { const t = songs.find(x => x.id === +sel.value); if (t) { state.queue = [t]; playIndex(0); } };
  const song = () => { const t = current(); return t && t.id ? t : null; };
  // every control goes through here: apply, then redraw the controls
  const change = fn => {
    if (!song()) return toast('Pick a song from your library first');
    fn(); applyRemix(); paintRemix();
  };
  for (const [name, v] of REMIX_PRESETS) {
    const b = el('button', 'chip', name);
    b.onclick = () => change(() => Object.assign(remix, v));
    $('rxPresets').append(b);
  }
  $('rxSpeed').oninput = e => change(() => { remix.speed = +e.target.value; });
  $('rxBass').oninput = e => change(() => { remix.bass = +e.target.value; });
  $('rxRev').oninput = e => change(() => { remix.reverb = +e.target.value; });
  $('rxPan').onchange = e => change(() => { remix.pan = e.target.checked; });
  $('rxName').oninput = () => { remixNamed = true; };
  $('rxSave').onclick = async () => {
    const t = song();
    if (!t) return toast('Pick a song from your library first');
    if (!remixOn()) return toast('Change something first — it is still the original');
    const b = $('rxSave'); b.disabled = true;
    const note = toast('Saving the remix…', 'info', 0);
    try {
      const r = await post('/api/remix', { track_id: t.id, name: $('rxName').value.trim(), ...remix });
      toast(`Saved “${r.title}” to your library`);
      state.tracksKey = '';
    } catch (e) { toast(e.message, 'error'); }
    note.remove(); b.disabled = false;
  };
  paintRemix = () => {
    if (!$('rxSong')) return;
    const t = song(), cur = current();
    $('rxNow').textContent = t ? t.title : cur ? 'This song is not downloaded' : 'No song chosen';
    sel.value = t && songs.some(x => x.id === t.id) ? t.id : '';
    $('rxSpeed').value = remix.speed; $('rxBass').value = remix.bass; $('rxRev').value = remix.reverb; $('rxPan').checked = remix.pan;
    [$('rxSpeed'), $('rxBass'), $('rxRev')].forEach(fill);
    $('rxSpeedL').textContent = remix.speed === 1 ? 'Normal' : `${Math.round(remix.speed * 100)}% — ${remix.speed < 1 ? 'slower and deeper' : 'faster and higher'}`;
    $('rxBassL').textContent = remix.bass ? `+${remix.bass} dB` : 'Off';
    $('rxRevL').textContent = remix.reverb ? `${Math.round(remix.reverb * 100)}%` : 'Off';
    [...$('rxPresets').children].forEach((b, i) => b.classList.toggle('sel', samePreset(REMIX_PRESETS[i][1])));
    if (!remixNamed) $('rxName').value = t ? `${t.title} (${remixLabel()})` : '';
  };
  paintRemix();

  // ---- AI tools
  pages.tools.innerHTML = `
  <div class="box"><h3>Cover</h3>
    <div class="field"><div><b>The same song in another style</b><small>Keeps the tune and words of a song and performs it in the style you describe</small></div><span id="cvSongAt"></span></div>
    <div class="field col"><label for="cvStyle">New style</label><textarea id="cvStyle" rows="2" placeholder="For example: slow piano ballad, soft female vocals"></textarea></div>
    <div class="field"><div><b>How close to the original</b><small id="cvStrL"></small></div><input type="range" id="cvStr" min="0.2" max="1" step="0.1" value="0.6"></div>
    <div class="st-go"><small class="st-state" data-need="songs"></small><button class="btn ghost" id="cvGo" data-need="songs" disabled>Make cover</button></div>
  </div>
  <div class="box"><h3>Re-make a part</h3>
    <div class="field"><div><b>Change one stretch of a song</b><small>Only the time range you give is made again; the rest stays</small></div><span id="rpSongAt"></span></div>
    <div class="field"><div><label for="rpFrom">From</label><small>Minutes:seconds, for example 0:45</small></div><input type="text" id="rpFrom" placeholder="0:45" autocomplete="off"></div>
    <div class="field"><div><label for="rpTo">To</label></div><input type="text" id="rpTo" placeholder="1:10" autocomplete="off"></div>
    <div class="field col"><label for="rpStyle">Style of that part</label><textarea id="rpStyle" rows="2" placeholder="For example: energetic drop with heavy bass"></textarea></div>
    <div class="field col"><label for="rpLyrics">Words for that part (optional)</label><textarea id="rpLyrics" rows="3"></textarea></div>
    <div class="st-go"><small class="st-state" data-need="songs"></small><button class="btn ghost" id="rpGo" data-need="songs" disabled>Re-make it</button></div>
  </div>
  <div class="box"><h3>Make a song longer</h3>
    <div class="field"><div><b>Extend a song</b><small>New music is written onto the end, or as an intro before the start, in the song's own sound</small></div><span id="exSongAt"></span></div>
    <div class="field"><div><label for="exWhere">Where</label></div><select id="exWhere"><option value="end">A longer ending</option><option value="start">A new intro</option></select></div>
    <div class="field"><div><b>How much</b><small id="exLenL"></small></div><input type="range" id="exLen" min="10" max="60" step="5" value="30"></div>
    <div class="field col"><label for="exStyle">What it should sound like (optional)</label><textarea id="exStyle" rows="2" placeholder="Leave empty to continue in the same style"></textarea></div>
    <div class="st-go"><small class="st-state" data-need="songs"></small><button class="btn ghost" id="exGo" data-need="songs" disabled>Extend it</button></div>
  </div>
  <div class="box"><h3>Split vocals and music</h3>
    <div class="field"><div><b>Instrumental and vocals-only</b><small>Makes two new songs from the one you pick</small></div><span id="spSongAt"></span></div>
    <div class="st-go"><small class="st-state" data-need="available"></small><button class="btn ghost" id="aiSplit" data-need="available" disabled>Split</button></div>
  </div>
  <div class="box"><h3>Mashup</h3>
    <div class="field"><div><b>Combine songs</b><small>The music of one song with the singing of others on top, matched in tempo and key and lined up on the beat</small></div></div>
    <div class="field"><div><label>Music from</label></div><span id="mxBaseAt"></span></div>
    <div class="field"><div><label>Vocals from</label><small>Up to three songs; with more than one they take turns through the track</small></div><div class="mx-list" id="mxVoc"></div></div>
    <div class="field"><div><label for="mxName">Name</label></div><input type="text" id="mxName" placeholder="Leave empty to name it after the songs" autocomplete="off"></div>
    <div class="st-go"><small class="st-state" data-need="available"></small><button class="btn ghost" id="mxAdd">Add another voice</button><button class="btn ghost" id="mxGo" data-need="available" disabled>Create mashup</button></div>
  </div>
  <div class="box"><h3>Quick beat</h3>
    <div class="field col"><label for="aiPrompt">A short instrumental from a description</label><textarea id="aiPrompt" rows="2" placeholder="For example: dark phonk beat with heavy cowbell, 140 bpm"></textarea></div>
    <div class="field"><div><b>Length</b><small id="aiLenL"></small></div><input type="range" id="aiLen" min="5" max="30" step="1" value="20"></div>
    <div class="st-go"><small class="st-state" data-need="available"></small><button class="btn ghost" id="aiGen" data-need="available" disabled>Create beat</button></div>
  </div>`;
  const cvSong = songSelect('Choose a song…'), rpSong = songSelect('Choose a song…'), spSong = songSelect('Choose a song…'), mxBase = songSelect('Choose the song for the music…');
  $('cvSongAt').replaceWith(cvSong); $('rpSongAt').replaceWith(rpSong); $('spSongAt').replaceWith(spSong); $('mxBaseAt').replaceWith(mxBase);
  const sent = text => { state.wasPending = true; toast(text + ' — it appears under Creations when it is done'); };
  const strLabel = () => { const v = +$('cvStr').value; $('cvStrL').textContent = v >= 0.9 ? 'Very close' : v >= 0.6 ? 'Recognisable, new style' : v >= 0.4 ? 'Loose' : 'Only the feel'; fill($('cvStr')); };
  $('cvStr').oninput = strLabel; strLabel();
  $('cvGo').onclick = async () => {
    const id = +cvSong.value, style = $('cvStyle').value.trim();
    if (!id || !style) return toast('Choose a song and describe the new style');
    try { await post('/api/studio/cover', { track_id: id, style, strength: +$('cvStr').value }); sent('Making the cover'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };
  $('rpGo').onclick = async () => {
    const id = +rpSong.value, from = clock($('rpFrom').value), to = clock($('rpTo').value), style = $('rpStyle').value.trim();
    if (!id) return toast('Choose a song first');
    if (isNaN(from) || isNaN(to) || to <= from) return toast('Give the part as times, for example from 0:45 to 1:10');
    if (!style) return toast('Describe the style of that part');
    try { await post('/api/studio/repaint', { track_id: id, start: from, end: to, style, lyrics: $('rpLyrics').value.trim() }); sent('Re-making that part'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };
  const exSong = songSelect('Choose a song…');
  $('exSongAt').replaceWith(exSong);
  const exLabel = () => { $('exLenL').textContent = $('exLen').value + ' seconds more'; fill($('exLen')); };
  $('exLen').oninput = exLabel; exLabel();
  $('exGo').onclick = async () => {
    const id = +exSong.value;
    if (!id) return toast('Choose a song first');
    try { await post('/api/studio/extend', { track_id: id, where: $('exWhere').value, seconds: +$('exLen').value, style: $('exStyle').value.trim() }); sent('Extending the song'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };
  $('aiSplit').onclick = async () => {
    const id = +spSong.value;
    if (!id) return toast('Choose a song first');
    try { await post('/api/ai/split', { track_id: id }); sent('Splitting the song'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };
  const addVoice = () => { if ($('mxVoc').children.length < 3) $('mxVoc').append(songSelect('Choose a song for the vocals…')); $('mxAdd').hidden = $('mxVoc').children.length >= 3; };
  addVoice();
  $('mxAdd').onclick = addVoice;
  $('mxGo').onclick = async () => {
    const base = +mxBase.value, voices = [...$('mxVoc').children].map(s => +s.value).filter(Boolean);
    if (!base || !voices.length) return toast('Choose a song for the music and at least one for the vocals');
    if (new Set([base, ...voices]).size !== voices.length + 1) return toast('Choose different songs');
    try { await post('/api/ai/mashup', { base_id: base, vocal_ids: voices, name: $('mxName').value.trim() }); sent('Mixing your mashup'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };
  const beatLabel = () => { $('aiLenL').textContent = $('aiLen').value + ' seconds'; fill($('aiLen')); };
  $('aiLen').oninput = beatLabel; beatLabel();
  $('aiGen').onclick = async () => {
    const prompt = $('aiPrompt').value.trim();
    if (!prompt) return toast('Describe the beat first');
    try { await post('/api/ai/generate', { prompt, seconds: +$('aiLen').value }); sent('Creating your beat'); }
    catch (e) { toast(e.message, 'error', 9000); }
  };

  show(pages[prefs.studio] ? prefs.studio : 'create');
  paintAi();
  // which AI parts are running on the server decides which buttons work
  api('/api/ai').then(a => {
    if (state.view !== view) return;
    const start = 'Start it on the server with: docker compose --profile ai up -d --build';
    const text = {
      songs: a.songs ? '' : 'The song engine is not running. ' + start,
      available: a.available ? '' : 'The AI add-on is not running. ' + start,
    };
    main.querySelectorAll('[data-need]').forEach(n => {
      if (n.tagName === 'BUTTON') n.disabled = !a[n.dataset.need];
      else n.textContent = text[n.dataset.need];
    });
    state.ai = a.jobs; paintAi();
  }).catch(() => {});
}

// ------------------------------------------------------- spotify preview
// A Spotify link is shown as a wall of covers first, to check it is the
// right playlist and leave songs out, before anything is downloaded.
async function previewSpotify(url) {
  const s = state.spotify = { url, data: null, error: null, skip: new Set() };
  go({ type: 'spotify' });
  try { s.data = await api('/api/spotify/preview?url=' + encodeURIComponent(url)); }
  catch (e) { s.error = e.message; }
  if (state.spotify === s && state.view.type === 'spotify') renderSpotify();
}
function renderSpotify() {
  const s = state.spotify, main = $('main'), d = s && s.data;
  if (!s) return go({ type: 'home' });
  main.replaceChildren(hero('Spotify ' + (d ? d.kind : 'link'), d ? d.name : 'Reading Spotify…', 'music', 'linear-gradient(135deg,#1db954,#0f7a36)'));
  state.shown = [];
  if (s.error) return main.append(el('div', 'empty', s.error));
  if (!d) return main.append(el('div', 'empty', 'Reading the link…'));
  const chosen = () => d.tracks.filter(t => !s.skip.has(t.id));
  const dl = btn('btn', 'download', 'Download', async () => {
    let dest = {};
    if (d.kind !== 'track' && chosen().length > 1) {
      dest = await askFolder({ title: `Download ${chosen().length} songs`, text: `Where should the songs from “${d.name}” go?`, name: d.name, own: true });
      if (!dest) return;
    }
    try {
      await post('/api/import', { url: s.url, kind: 'video', skip: [...s.skip], ...dest });
      toast(`Downloading ${chosen().length} song(s) from “${d.name}”`);
      state.wasPending = true; state.spotify = null;
      go({ type: 'library' });
    } catch (e) { toast(e.message, 'error'); }
  });
  const label = () => { const n = chosen().length; dl.querySelector('span').textContent = n === d.tracks.length ? `Download all ${n}` : `Download ${n} of ${d.tracks.length}`; dl.disabled = !n; };
  $('heroAct').append(dl, btn('btn ghost', 'close', 'Not this', () => { state.spotify = null; go({ type: 'home' }); }));
  $('heroSub').textContent = `${d.tracks.length} song${d.tracks.length === 1 ? '' : 's'} — is this the right one? Click a cover to leave that song out.`;
  const grid = el('div', 'grid');
  for (const t of d.tracks) {
    const c = el('button', 'card sp' + (s.skip.has(t.id) ? ' off' : '')), img = el('img', 'tile');
    img.loading = 'lazy'; img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = placeholder(t); };
    img.src = t.cover || `/api/spotify/cover/${t.id}`;
    c.append(img, el('b', null, t.title), el('small', null, (t.in_library ? '✓ in library · ' : '') + (t.artist || '')));
    c.onclick = () => { s.skip.has(t.id) ? s.skip.delete(t.id) : s.skip.add(t.id); c.classList.toggle('off', s.skip.has(t.id)); label(); };
    grid.append(c);
  }
  main.append(grid);
  label();
}

// ------------------------------------------------------ search / import
$('form').onsubmit = async e => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  $('q').blur();
  if (/open\.spotify\.com\//i.test(q)) { $('q').value = ''; return previewSpotify(/^https?:/i.test(q) ? q : 'https://' + q); }
  if (/^https?:\/\//i.test(q)) {
    // a link to a whole playlist or channel: ask which folder it goes to
    let dest = {};
    if (!/watch\?v=|youtu\.be\/|\/shorts\//i.test(q)) {
      dest = await askFolder({ title: 'Download this playlist', text: 'Where should its songs go? Songs without a video are saved as sound only.', own: true });
      if (!dest) return;
    }
    try {
      await post('/api/import', { url: q, kind: 'video', ...dest });
      toast('Importing… tracks appear as they download');
      $('q').value = ''; state.wasPending = true;
      if (state.view.type !== 'library') go({ type: 'library' });
    } catch (err) { toast(err.message, 'error'); }
    return;
  }
  // One search for everything: the library, YouTube and Spotify are asked at
  // the same time and each group fills in when its answer arrives. The
  // results are kept, so the Search tab can be left and come back to.
  const s = state.search = { q, lib: null, yt: null, sp: null, ytError: null, spError: null, spOff: false };
  go({ type: 'search' });
  const enc = encodeURIComponent(q);
  const done = () => { if (state.search === s && state.view.type === 'search') renderSearch(); };
  api('/api/library/search?q=' + enc).then(r => { s.lib = r; }, () => { s.lib = []; }).then(done);
  api('/api/search?q=' + enc).then(r => {
    r.forEach(t => { t.status = 'ready'; t.stream = true; t.source = 'youtube'; });
    s.yt = r;
  }, err => { s.yt = []; s.ytError = err.message; }).then(done);
  api('/api/spotify/search?q=' + enc).then(r => {
    s.spOff = !r.available;
    // a Spotify song has no video yet; it is matched on YouTube when played
    s.sp = r.tracks.map(t => ({ key: 'sp:' + t.id, sp_id: t.id, title: t.title, artist: t.artist, duration: t.duration, cover: t.cover, in_library: t.in_library, status: 'ready', stream: true, source: 'spotify' }));
  }, err => { s.sp = []; s.spError = err.message; }).then(done);
};
function renderSearch() {
  const s = state.search, main = $('main');
  main.replaceChildren(hero('Search', s ? s.q : 'Search', 'search'));
  state.shown = [];
  if (!s) return main.append(el('div', 'empty', 'Type in the box at the top to search your library, YouTube and Spotify at once. Your results stay here while you look around.'));
  $('heroSub').textContent = 'Your library, YouTube and Spotify at once — tap to play, ⬇ to keep, or drag onto a folder';
  const note = text => el('div', 'snote', text);
  const group = (title, cls) => {
    const h = sectionHead(title), box = el('div');
    h.querySelector('h2').prepend(el('span', 'dot ' + cls));
    main.append(h, box);
    return box;
  };
  let n = 0;  // rows are numbered across the three groups
  const lib = group('In your library', 'local');
  if (!s.lib) lib.append(note('Searching…'));
  else if (!s.lib.length) lib.append(note('Nothing in your library matches.'));
  else for (const t of s.lib) lib.append(trackRow(t, n++));
  const yt = group('YouTube', 'yt');
  if (!s.yt) yt.append(note('Searching YouTube…'));
  else if (s.ytError) yt.append(note('YouTube search failed: ' + s.ytError));
  else if (!s.yt.length) yt.append(note('No results.'));
  else for (const t of s.yt) yt.append(streamRow(t, n++, s.yt));
  const sp = group('Spotify', 'sp');
  if (!s.sp) sp.append(note('Searching Spotify…'));
  else if (s.spError) sp.append(note(s.spError));
  else if (s.spOff) {
    const box = note('Searching Spotify needs your free Spotify API keys. Pasting a Spotify link works without them. ');
    const b = el('button', 'chip', 'Add keys in Settings');
    b.onclick = () => openSettings('accounts');
    box.append(b); sp.append(box);
  } else if (!s.sp.length) sp.append(note('No results.'));
  else for (const t of s.sp) sp.append(streamRow(t, n++, s.sp));
  state.shown = [...(s.lib || []), ...(s.yt || []), ...(s.sp || [])];
  paintPicked();
}
// A row for a song that is not downloaded (a YouTube or Spotify result).
function streamRow(t, i, list) {
  const row = el('div', 'row playable'), cur = current();
  row.style.animationDelay = Math.min(i, 12) * 14 + 'ms';
  row.dataset.key = tkey(t);
  row.oncontextmenu = e => { e.preventDefault(); trackMenu(t, at(e)); };
  if (cur && tkey(cur) === tkey(t)) row.classList.add('current');
  row.onclick = () => askKind(row, t.title, ['Listen (audio only)', 'Watch video'], kind => {
    state.queue = list.map(x => ({ ...x, kind }));
    playIndex(list.indexOf(t));
  });
  const img = el('img'); img.loading = 'lazy'; img.alt = ''; setImg(img, t);
  const title = el('div', 't', t.title), badge = srcBadge(t);
  if (badge) title.append(badge);
  const meta = el('div'); meta.append(title, el('div', 'a', t.artist));
  const b = el('button', 'chip', t.in_library ? '✓ Added' : '⬇ Download');
  if (t.in_library) b.title = 'Show it in your library';
  b.onclick = e => { e.stopPropagation(); t.in_library ? locate(t) : saveStream(t); };
  const act = el('div'); act.append(b);
  row.append(el('div', 'n', i + 1), img, meta, act, el('div', 'd', t.duration ? fmt(t.duration) : ''), el('div'));
  return row;
}
// Open the place a downloaded song is kept (its folder, else the library)
// and point at it.
async function locate(t) {
  let w;
  prefs.src = 'all';  // a source filter must not hide the song being shown
  if (!t.video_id) {  // a Spotify result: find it in the library by name
    await go({ type: 'library' });
    const hit = state.tracks.find(x => x.title === t.title && (x.artist || '') === (t.artist || ''));
    if (!hit) return;
    w = { id: hit.id };
  } else {
    try { w = await api('/api/where/' + t.video_id); }
    catch { return toast('That song is not in your library any more', 'error'); }
    await go(w.playlist ? { type: 'playlist', ...w.playlist } : { type: 'library' });
  }
  const row = document.querySelector(`#main .row[data-key="${w.id}"]`);
  if (!row) return;
  pickAnchor = String(w.id); setPicked([pickAnchor]);
  row.scrollIntoView({ block: 'center', behavior: 'instant' });
}

// ---------------------------------------------------------------- upload
$('uploadBtn').onclick = () => $('file').click();
$('file').onchange = () => { uploadFiles([...$('file').files]); $('file').value = ''; };
async function uploadFiles(files) {
  files = files.filter(f => f.size);
  if (!files.length) return;
  const pl = state.view.type === 'playlist' ? state.view.id : null;
  const t = toast('', 'info', 0);
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    t.textContent = `Uploading ${i + 1}/${files.length}: ${files[i].name}`;
    try {
      await api(`/api/upload?name=${encodeURIComponent(files[i].name)}${pl ? '&playlist=' + pl : ''}`, { method: 'POST', body: files[i] });
      ok++;
    } catch (err) { toast(err.message, 'error'); }
  }
  t.remove();
  if (ok) toast(`Added ${ok} file${ok === 1 ? '' : 's'}${pl ? ' to “' + state.view.name + '”' : ' to your library'}`);
  if (state.view.type === 'library' || state.view.type === 'playlist') reload(true); else go({ type: 'library' });
  state.tracksKey = '';
}
let dragDepth = 0;
addEventListener('dragenter', e => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; document.body.classList.add('dragging'); } });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); if (e.dataTransfer?.files.length) uploadFiles([...e.dataTransfer.files]); });

