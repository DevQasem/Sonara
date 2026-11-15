'use strict';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const audio = $('audio');
const root = document.documentElement;
// The now-playing section sits beside the list as the right-hand panel on
// wide screens (on phones it is a full-screen sheet).
document.querySelector('.app').append($('np'));

// ---------------------------------------------------------------- icons
const ICONS = {
  devices: 'M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  play: 'M8 5v14l11-7z', pause: 'M6 19h4V5H6zm8-14v14h4V5z',
  next: 'M6 18l8.5-6L6 6zm10-12v12h2V6z', prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
  shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
  more: 'M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  music: 'M12 3v10.55A4 4 0 1014 17V7h4V3z',
  folder: 'M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8z',
  tune: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z', plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  down: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  volume: 'M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z',
  lyrics: 'M3 5h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3z',
  trash: 'M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z',
  retry: 'M17.65 6.35A8 8 0 1019.73 14h-2.08A6 6 0 1112 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
  queue: 'M4 6h12v2H4zm0 4h12v2H4zm0 4h8v2H4zm10 0v6l5-3z',
  minus: 'M19 13H5v-2h14z',
  download: 'M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z',
  heartLine: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  history: 'M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 117 7 6.97 6.97 0 01-4.94-2.06l-1.42 1.42A8.95 8.95 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z',
  trending: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  video: 'M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  fullscreen: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
  drag: 'M3 15h18v-2H3zm0-6v2h18V9z',
  gear: 'M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.5.5 0 00.12-.61l-1.92-3.32a.5.5 0 00-.59-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58a7.4 7.4 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 00-.12-.61zM12 15.6a3.6 3.6 0 110-7.2 3.6 3.6 0 010 7.2z',
  palette: 'M12 3a9 9 0 000 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 005-5c0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  lock: 'M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9zm3 11a2 2 0 110-4 2 2 0 010 4z',
};
const svg = n => `<svg viewBox="0 0 24 24"><path d="${ICONS[n]}"/></svg>`;
const paint = (scope = document) => scope.querySelectorAll('i[data-ico]').forEach(i => { i.innerHTML = svg(i.dataset.ico); });
paint();

// ---------------------------------------------------------------- prefs
const ACCENTS = [['#8b5cf6', '#ec4899'], ['#3b82f6', '#06b6d4'], ['#10b981', '#84cc16'], ['#f59e0b', '#ef4444'], ['#ef4444', '#f97316'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#3b82f6']];
const EQ_F = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass boost': [7, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  'Bass reducer': [-7, -6, -4, -2, 0, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
  'Vocal boost': [-2, -3, -2, 1, 4, 5, 4, 2, 0, -1],
  Rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  Pop: [-1, 0, 2, 4, 5, 4, 2, 0, -1, -1],
  'Hip-hop': [6, 5, 2, 3, -1, -1, 1, 0, 2, 3],
  Electronic: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5],
  Jazz: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
  Classical: [5, 4, 3, 2, -1, -1, 0, 2, 3, 4],
  Acoustic: [5, 5, 3, 1, 2, 2, 3, 4, 3, 2],
  'Late night': [4, 3, 1, 0, 1, 2, 2, 1, -2, -4],
};
const prefs = Object.assign({ theme: 'dark', accent: ACCENTS[0][0], anim: true, compact: false, speed: 1, eq: EQ_PRESETS.Flat.slice(), eqOn: true, eqPreset: 'Flat', viz: 'bars', ytMode: 'ask', avMode: 'video', resume: true, sort: 'default', volume: 1, panel: true, src: 'all', coverTheme: true, studio: 'create', loud: true, xfade: 5 }, load('prefs', {}));
if (!Array.isArray(prefs.eq) || prefs.eq.length !== EQ_F.length) { prefs.eq = EQ_PRESETS.Flat.slice(); prefs.eqPreset = 'Flat'; }
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
let vizColors = ['#8b5cf6', '#ec4899'];
function applyPrefs() {
  root.dataset.theme = prefs.theme;
  document.body.classList.toggle('anim', prefs.anim);
  document.body.classList.toggle('compact', prefs.compact);
  document.body.classList.toggle('viz-circle', prefs.viz === 'circle');
  document.body.classList.toggle('viz-off', prefs.viz === 'off');
  applyRemix();
  setVolume(prefs.volume);
  applyEq();
  save('prefs', prefs);
  themeFromCover(current() || null);
}

// The whole app takes its colours from the cover of the song that is playing.
const hsl2hex = (h, s, l) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
};
function setAccent(c1, c2) {
  root.style.setProperty('--accent', c1); root.style.setProperty('--accent2', c2);
  if (c1.startsWith('#')) vizColors = [c1, c2.startsWith('#') ? c2 : c1];
}
function baseAccent() {
  const pair = ACCENTS.find(a => a[0] === prefs.accent);
  setAccent(prefs.accent, pair ? pair[1] : `color-mix(in srgb, ${prefs.accent} 55%, #ff4d8d)`);
}
let themeSeq = 0;
function themeFromCover(t) {
  const seq = ++themeSeq, url = t ? coverUrl(t) : '';
  // the blurred cover behind everything
  root.style.setProperty('--cover', t && !url.startsWith('data:') ? `url("${url}")` : 'none');
  if (!t || !prefs.coverTheme || url.startsWith('data:')) return baseAccent();
  const img = new Image();
  img.onerror = () => { if (seq === themeSeq) baseAccent(); };
  img.onload = () => {
    if (seq !== themeSeq) return;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true });
    let d;
    try { g.drawImage(img, 0, 0, 32, 32); d = g.getImageData(0, 0, 32, 32).data; } catch { return baseAccent(); }
    // weigh the colourful pixels by hue, in twelve 30-degree slices
    const bins = new Array(12).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gr = d[i + 1], b = d[i + 2], max = Math.max(r, gr, b), min = Math.min(r, gr, b);
      const l = (max + min) / 510, s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      if (s < 0.25 || l < 0.15 || l > 0.9) continue;
      let h = max === r ? ((gr - b) / (max - min)) % 6 : max === gr ? (b - r) / (max - min) + 2 : (r - gr) / (max - min) + 4;
      h = (h * 60 + 360) % 360;
      bins[Math.floor(h / 30) % 12] += s;
    }
    const order = bins.map((w, k) => [w, k]).sort((x, y) => y[0] - x[0]);
    if (order[0][0] < 12) return baseAccent();  // a grey cover: keep the chosen accent
    const k1 = order[0][1];
    const second = order.find(([w, k]) => w > order[0][0] * 0.25 && Math.min(Math.abs(k - k1), 12 - Math.abs(k - k1)) >= 2);
    const h1 = k1 * 30 + 15, h2 = second ? second[1] * 30 + 15 : (h1 + 45) % 360;
    setAccent(hsl2hex(h1, 74, 62), hsl2hex(h2, 76, 58));
  };
  // YouTube covers come through the server so their pixels may be read;
  // covers from other sites are asked for with permission to read them
  if (/^https?:/.test(url) && t.cover) img.crossOrigin = 'anonymous';
  img.src = !t.cover && t.video_id ? `/api/thumb/${t.video_id}` : url;
}

// ---------------------------------------------------------------- state
// Live remix of the song that is playing (set from the Remix tab).
const remix = { speed: 1, bass: 0, reverb: 0, pan: false };
let fx;  // the remix audio nodes, once the audio graph exists
const remixOn = () => remix.speed !== 1 || remix.bass > 0 || remix.reverb > 0 || remix.pan;
function applyRemix() {
  // a remix speed also moves the pitch (like a record); the plain speed setting does not
  audio.preservesPitch = remix.speed === 1;
  audio.playbackRate = remix.speed !== 1 ? remix.speed : prefs.speed;
  if (remixOn()) { ensureEq(); actx?.resume(); }
  if (fx) { fx.bass.gain.value = remix.bass; fx.wet.gain.value = remix.reverb * 0.7; fx.depth.gain.value = remix.pan ? 1 : 0; }
  paintFx();
}
// Quick effect buttons in the player: one click and the playing song
// changes straight away. They stay on from song to song until switched off.
const FX = [
  ['Slowed', () => remix.speed < 1, () => { remix.speed = remix.speed < 1 ? 1 : 0.85; }],
  ['Sped up', () => remix.speed > 1, () => { remix.speed = remix.speed > 1 ? 1 : 1.2; }],
  ['Reverb', () => remix.reverb > 0, () => { remix.reverb = remix.reverb ? 0 : 0.5; }],
  ['Bass', () => remix.bass > 0, () => { remix.bass = remix.bass ? 0 : 8; }],
  ['8D', () => remix.pan, () => { remix.pan = !remix.pan; }],
];
function fxChips(box) {
  box.classList.add('fx-chips');
  const changed = () => { remixNamed = false; applyRemix(); if (state.view.type === 'remix' && paintRemix) paintRemix(); };
  for (const [label, on, flip] of FX) {
    const b = el('button', 'chip', label); b.type = 'button'; b._on = on;
    b.onclick = e => { e.stopPropagation(); flip(); changed(); };
    box.append(b);
  }
  const off = el('button', 'chip fx-off', 'Off'); off.type = 'button'; off.title = 'Back to the original sound';
  off.onclick = e => { e.stopPropagation(); resetRemix(); };
  box.append(off);
}
function paintFx() {
  document.querySelectorAll('.fx-chips .chip').forEach(b => { if (b._on) b.classList.toggle('sel', b._on()); else b.hidden = !remixOn(); });
  document.getElementById('fxBtn')?.classList.toggle('on', remixOn());
}
// Volume goes past 100%: up to there it is the normal volume, above it the
// sound is made louder than the original (it can distort on loud songs).
function setVolume(v) {
  if (Math.abs(v - 1) < 0.04) v = 1;  // easy to land on exactly 100%
  prefs.volume = v; applyVol();
  if (v > 1) { ensureEq(); actx?.resume(); }
  if (fx) fx.boost.gain.value = Math.max(v, 1);
  const r = document.getElementById('vol');
  r.value = v; fill(r); r.classList.toggle('boost', v > 1);
  r.title = `Volume ${Math.round(v * 100)}%` + (v > 1 ? ' — louder than the original' : '');
  tellState();
  const pct = document.getElementById('volPct'), back = document.getElementById('volReset');
  pct.textContent = Math.round(v * 100) + '%'; pct.classList.toggle('boost', v > 1);
  back.hidden = v === 1;
}
const state = {
  view: { type: 'library' }, tracks: [], shown: [], tracksKey: '', filter: '',
  playlists: [], queue: [], index: -1, shuffle: false, repeat: false,
  lastEvent: 0, wasPending: false, sleepTimer: null, sleepMode: 'off', lyricsFor: null,
};
const current = () => state.queue[state.index];
// library tracks have an id; streamed (not downloaded) tracks only a video id
const tkey = t => t.id ?? t.key ?? 'yt:' + t.video_id;
// A song can have both sound and picture: library tracks with a video file,
// uploaded videos, and anything streamed from YouTube.
const canVideo = t => !t.id || t.kind === 'video';
const modeOf = t => !canVideo(t) ? 'audio' : t.id ? prefs.avMode : (t.kind === 'video' ? 'video' : 'audio');
// The video file carries the sound too, so one source serves both modes and
// switching between them never reloads (a stream moves to its video source
// the first time video is asked for, then stays on it).
const srcOf = t => t.id ? `/media/${t.id}${t.vfile ? '?v=1' : ''}`
  : `/api/stream/${t.video_id}${t.vsrc ? '?kind=video' : ''}`;
const showingVideo = () => document.body.classList.contains('is-video');
// A fake anchor so menus can open at the mouse position (right-click).
const at = e => ({ point: true, getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) });
const LISTS = {
  library: { kind: 'Your music', title: 'Library', icon: 'music', empty: 'Your library is empty. Search YouTube, paste a YouTube / Spotify link, or upload files from this device.' },
  liked: { kind: 'Favourites', title: 'Liked', icon: 'heart', q: '?view=liked', empty: 'No liked tracks yet. Tap the heart on any track.' },
  recent: { kind: 'History', title: 'Recently played', icon: 'history', q: '?view=recent', empty: 'Nothing played yet.' },
  top: { kind: 'History', title: 'Most played', icon: 'trending', q: '?view=top', empty: 'Nothing played yet.' },
};
const isList = v => v.type === 'playlist' || v.type === 'artist' || v.type in LISTS;
// "A, B & C feat. D" names four artists
const ARTIST_SEP = /(\s*,\s*|\s*&\s*|\s+x\s+|\s+(?:feat|ft)\.?\s+)/i;
const artistsOf = t => (t.artist || '').split(ARTIST_SEP).filter((p, i) => i % 2 === 0 && p.trim()).map(p => p.trim());
// progress of a track that is still downloading, from the last status poll
const dlText = t => { const d = (state.downloads || []).find(x => x.id === t.id); return t.status === 'error' ? 'failed' : d && d.pct != null ? `${d.stage || ''} ${d.pct}%`.trim() : t.status; };

// ---------------------------------------------------------------- utils
const fmt = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const grad = s => `linear-gradient(135deg,hsl(${hue(s)} 65% 48%),hsl(${(hue(s) + 50) % 360} 65% 32%))`;
function placeholder(t) {
  const h = hue(t.title + t.id);
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},65%,48%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},65%,30%)"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><path transform="translate(24 24) scale(2)" fill="rgba(255,255,255,.85)" d="${ICONS.music}"/></svg>`);
}
const coverUrl = t => t.cover ? t.cover : t.video_id ?`https://i.ytimg.com/vi/${t.video_id}/mqdefault.jpg` : t.source === 'upload' || t.source === 'remix' ? `/api/cover/${t.id}` : placeholder(t);
function setImg(img, t) { img.onerror = () => { img.onerror = null; img.src = placeholder(t); }; img.src = coverUrl(t); }
function fill(r) { const max = +r.max || 1, min = +r.min || 0; r.style.setProperty('--p', ((r.value - min) / (max - min) * 100) + '%'); }

// The profile in use on this browser; sent with every request.
const profile = { id: load('profile', 1), list: [] };
async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), 'X-Profile': profile.id };
  if (opts.body && !(opts.body instanceof Blob)) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
  const r = await fetch(path, opts);
  if (r.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Login required'); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch {} throw new Error(m); }
  return r.json();
}
const post = (p, body) => api(p, { method: 'POST', body });
function toast(msg, level = 'info', ms = 5000) {
  const t = el('div', 'toast ' + level, msg);
  $('toasts').append(t);
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}

// -------------------------------------------------------------- dialogs
// The app's own boxes for typing a name or confirming, instead of the
// browser's. Resolves to the typed values (or true), or null when cancelled.
function dialog({ title, text, fields = [], ok = 'Save', danger = false }) {
  return new Promise(resolve => {
    const wrap = el('div', 'modal dlg-wrap'), form = el('form', 'dlg');
    form.append(el('h3', null, title));
    if (text) form.append(el('p', null, text));
    const inputs = fields.map(f => {
      const lab = el('label', null, f.label), inp = el('input');
      inp.type = 'text'; inp.value = f.value || ''; inp.placeholder = f.placeholder || ''; inp.autocomplete = 'off';
      lab.append(inp); form.append(lab);
      return inp;
    });
    const row = el('div', 'dlg-act'), cancel = el('button', 'btn ghost', 'Cancel'), go = el('button', 'btn' + (danger ? ' danger' : ''), ok);
    cancel.type = 'button';
    row.append(cancel, go); form.append(row); wrap.append(form); document.body.append(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    cancel.onclick = () => done(null);
    wrap.onpointerdown = e => { if (e.target === wrap) done(null); };
    wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(null); };
    form.onsubmit = e => { e.preventDefault(); done(inputs.length ? inputs.map(i => i.value.trim()) : true); };
    (inputs[0] || go).focus(); inputs[0]?.select();
  });
}
const confirmBox = (title, text, ok) => dialog({ title, text, ok, danger: true });
// Asked before several songs are downloaded at once: a new folder, one that
// exists already, or no folder. Resolves to what to send with the download:
// {playlist: id}, {nofolder: true}, {} (the playlist's own folder), or null
// when cancelled. `name` is the suggested folder name; with `own` an empty
// name means "name it after the playlist".
function askFolder({ title, text, name = '', own = false }) {
  return new Promise(resolve => {
    const wrap = el('div', 'modal dlg-wrap'), form = el('form', 'dlg');
    form.append(el('h3', null, title));
    if (text) form.append(el('p', null, text));
    const opts = [];
    const option = (key, label, extra) => {
      const lab = el('label', 'dlg-opt'), r = el('input');
      r.type = 'radio'; r.name = 'where'; r.value = key;
      lab.append(r, el('span', null, label)); form.append(lab);
      if (extra) { extra.classList.add('dlg-sub'); form.append(extra); extra.onfocus = () => { r.checked = true; paint(); }; }
      r.onchange = () => { paint(); extra?.focus(); };
      opts.push({ r, lab, extra });
      return r;
    };
    const paint = () => opts.forEach(o => { o.lab.classList.toggle('sel', o.r.checked); if (o.extra) o.extra.classList.toggle('dim', !o.r.checked); });
    const inp = el('input'); inp.type = 'text'; inp.value = name; inp.autocomplete = 'off';
    inp.placeholder = own ? 'Empty = the playlist’s own name' : 'Folder name';
    const rNew = option('new', 'A new folder', inp);
    let sel = null, rOld = null;
    if (state.playlists.length) {
      sel = el('select');
      for (const p of state.playlists) { const o = el('option', null, p.name); o.value = p.id; sel.append(o); }
      rOld = option('old', 'A folder I already have', sel);
    }
    const rNone = option('none', 'No folder, just my library');
    rNew.checked = true; paint();
    const row = el('div', 'dlg-act'), cancel = el('button', 'btn ghost', 'Cancel'), go = el('button', 'btn', 'Download');
    cancel.type = 'button';
    row.append(cancel, go); form.append(row); wrap.append(form); document.body.append(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    cancel.onclick = () => done(null);
    wrap.onpointerdown = e => { if (e.target === wrap) done(null); };
    wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(null); };
    form.onsubmit = async e => {
      e.preventDefault();
      if (rNone.checked) return done({ nofolder: true });
      if (rOld && rOld.checked) return done({ playlist: +sel.value });
      const n = inp.value.trim();
      if (!n && own) return done({});
      if (!n) return inp.focus();
      // the same name as a folder that is already there: use that one
      const have = state.playlists.find(p => p.name.toLowerCase() === n.toLowerCase());
      if (have) return done({ playlist: have.id });
      if (own && n === name) return done({});
      go.disabled = true;
      try { const p = await post('/api/playlists', { name: n }); await loadPlaylists(); done({ playlist: p.id }); }
      catch (err) { go.disabled = false; toast(err.message, 'error'); }
    };
    inp.focus(); inp.select();
  });
}

// ---------------------------------------------------------------- menus
function openMenu(anchor, items, title) {
  const menu = $('menu');
  menu.replaceChildren();
  if (title) menu.append(el('h4', null, title));
  for (const it of items) {
    const b = el('button', it.danger ? 'danger' : '');
    b.innerHTML = svg(it.icon || 'music');
    b.append(el('span', null, it.label));
    b.onclick = e => { e.stopPropagation(); closeMenu(); it.fn(anchor); };
    menu.append(b);
  }
  menu.hidden = $('scrim').hidden = false;
  const r = anchor.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(anchor.point ? r.left : r.right - w, innerWidth - w - 8)) + 'px';
  menu.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
}
function closeMenu() { document.querySelectorAll('.menu-on').forEach(n => n.classList.remove('menu-on')); $('menu').hidden = $('scrim').hidden = true; }
$('scrim').onclick = closeMenu;
$('scrim').onpointerdown = e => { if (e.button === 0) closeMenu(); };
// Right-click while a menu is open: close it and open the menu of whatever is
// under the mouse, instead of the browser's own menu.
$('scrim').oncontextmenu = e => {
  e.preventDefault(); closeMenu();
  document.elementFromPoint(e.clientX, e.clientY)?.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
};
document.addEventListener('contextmenu', e => { if (!e.target.closest?.('input, textarea')) e.preventDefault(); });
addEventListener('blur', closeMenu);
addEventListener('resize', closeMenu);

function trackMenu(t, anchor) {
  if (!t.id) {  // streaming-only track
    const items = [
      { icon: 'queue', label: 'Play next', fn: () => playNext(t) },
      { icon: 'plus', label: 'Add to queue', fn: () => addToQueue(t) },
      { icon: 'folder', label: 'Download to folder…', fn: a => folderPicker([t], a) },
    ];
    if (!t.in_library) items.unshift({ icon: 'download', label: 'Download to library', fn: () => saveStream(t) });
    return openMenu(anchor, items, t.title);
  }
  const items = [];
  if (t.status === 'ready') {
    items.push({ icon: 'play', label: 'Play now', fn: () => { if (state.shown.some(x => x.id === t.id)) playFrom(t.id); else { state.queue = [t]; playIndex(0); } } });
    items.push({ icon: 'queue', label: 'Play next', fn: () => playNext(t) });
    items.push({ icon: 'plus', label: 'Add to queue', fn: () => addToQueue(t) });
    items.push(...deviceItems(t));
    items.push({ icon: t.liked ? 'heart' : 'heartLine', label: t.liked ? 'Remove from Liked' : 'Like', fn: () => toggleLike(t) });
    items.push({ icon: 'lyrics', label: 'Show lyrics', fn: () => { if (!current() || current().id !== t.id) playFrom(t.id); openNp(); } });
  }
  items.push({ icon: 'folder', label: 'Add to folder…', fn: a => folderPicker([t], a) });
  if (state.view.type === 'playlist') items.push({ icon: 'minus', label: 'Remove from this folder', fn: async () => {
    const pid = state.view.id;
    dropFromList(t.id);
    try { await api(`/api/playlists/${pid}/tracks/${t.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message, 'error'); }
    reload(true);
  } });
  if (t.video_id && t.kind !== 'video' && t.status === 'ready') items.push({ icon: 'video', label: 'Download the video too', fn: async () => {
    try { await post('/api/add', { video_id: t.video_id, title: t.title, artist: t.artist, duration: t.duration, kind: 'video' }); state.wasPending = true; toast(`Downloading the video for “${t.title}”`); reload(true); }
    catch (e) { toast(e.message, 'error'); }
  } });
  if (t.status === 'ready') items.push({ icon: 'download', label: 'Save file to this device', fn: () => {
    const a = el('a'); a.href = `/media/${t.id}`; a.download = `${t.artist ? t.artist + ' - ' : ''}${t.title}`.replace(/[\\/:*?"<>|]/g, '_');
    a.click();
  } });
  items.push({ icon: 'edit', label: 'Edit title / artist', fn: () => editTrack(t) });
  if (t.status === 'error') items.push({ icon: 'retry', label: 'Retry download', fn: async () => { await post(`/api/tracks/${t.id}/retry`); state.wasPending = true; reload(true); } });
  items.push({ icon: 'trash', label: 'Delete from library', danger: true, fn: () => deleteTrack(t) });
  openMenu(anchor, items, t.title);
}

// Remove a track from the screen straight away, then confirm with the server.
const gone = new Set();  // ids being deleted: never let a stale response re-add them
function dropFromList(id) {
  reloadSeq++;  // discard any list request already in flight
  state.tracks = state.tracks.filter(x => x.id !== id);
  state.tracksKey = '';
  drawTracks();
}
function dropFromPlayer(id) { removeQueueAt(state.queue.findIndex(x => x.id === id)); }
function removeQueueAt(i) {
  if (i < 0) return;
  const wasPlaying = !audio.paused;
  state.queue.splice(i, 1);
  if (i < state.index) state.index--;
  else if (i === state.index) {
    if (state.queue.length) playIndex(state.index % state.queue.length, wasPlaying);
    else stopPlayer();
  }
  renderQueue();
}
function stopPlayer() {
  state.index = -1; state.queue = []; state.lyricsFor = null;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  $('nowT').textContent = $('npT').textContent = 'Nothing playing';
  $('nowA').textContent = 'Pick a song to start'; $('npA').textContent = '';
  $('art').removeAttribute('src'); $('npArt').removeAttribute('src');
  themeFromCover(null);
  $('npBg').style.backgroundImage = '';
  $('saveBtn').hidden = $('npSave').hidden = $('likeBtn').hidden = $('npLike').hidden = $('fsBtn').hidden = true;
  document.body.classList.remove('is-video'); $('avTabs').hidden = true;
  renderQueue();
  if (wide()) { $('np').classList.remove('full'); showLyrics(); } else closeNp();
  markCurrent();
}
async function deleteTrack(t) {
  if (!await confirmBox('Delete from library?', `“${t.title}” and its files are removed.`, 'Delete')) return;
  gone.add(t.id);
  dropFromList(t.id);
  dropFromPlayer(t.id);
  lyricsCache.delete(t.id);
  if (load('last', {})?.id === t.id) save('last', null);
  try { await api(`/api/tracks/${t.id}`, { method: 'DELETE' }); toast(`Deleted “${t.title}”`); }
  catch (e) { gone.delete(t.id); toast('Delete failed: ' + e.message, 'error'); }
  await reload(true).catch(() => {});
  gone.delete(t.id);
}
// YouTube items can be played or saved as audio or as video.
function askKind(anchor, title, labels, fn) {
  if (prefs.ytMode !== 'ask') return fn(prefs.ytMode);
  openMenu(anchor, [
    { icon: 'music', label: labels[0], fn: () => fn('audio') },
    { icon: 'video', label: labels[1], fn: () => fn('video') },
  ], title);
}
// Download a streamed song (with its video when there is one), optionally
// straight into a folder.
async function saveStream(t, folder = null, quiet = false) {
  try {
    if (t.sp_id) await post('/api/spotify/add', { id: t.sp_id, title: t.title, artist: t.artist, duration: t.duration, playlist: folder });
    else await post('/api/add', { video_id: t.video_id, title: t.title, artist: t.artist, duration: t.duration, kind: 'video', playlist: folder });
    t.in_library = true; state.wasPending = true;
    if (!quiet) toast(`Downloading “${t.title}” to your library`);
    if (current() && tkey(current()) === tkey(t)) $('saveBtn').hidden = $('npSave').hidden = true;
    $$(`.row[data-key="${tkey(t)}"] .chip`).forEach(b => { b.textContent = '✓ Added'; b.title = 'Show it in your library'; });
    return true;
  } catch (e) { toast(e.message, 'error'); return false; }
}

function folderPicker(list, anchor) {
  const items = state.playlists.map(p => ({ icon: 'folder', label: p.name, fn: () => addToFolder(p, list) }));
  items.push({ icon: 'plus', label: 'New folder…', fn: async () => { const p = await newFolder(); if (p) addToFolder(p, list); } });
  openMenu(anchor, items, 'Add to folder');
}
// Put tracks into a folder; ones that are only being streamed are downloaded.
async function addToFolder(p, list) {
  let added = 0, fetched = 0;
  for (const t of list) {
    if (!t.id) { if (await saveStream(t, p.id, true)) fetched++; continue; }
    try { await post(`/api/playlists/${p.id}/tracks`, { track_id: t.id }); added++; }
    catch (e) { toast(e.message, 'error'); }
  }
  const n = (k, w) => `${k} track${k === 1 ? '' : 's'} ${w}`;
  if (added || fetched) toast([fetched && 'Downloading ' + n(fetched, 'into'), added && (fetched ? 'added ' : 'Added ') + n(added, 'to')].filter(Boolean).join(', ') + ` “${p.name}”`);
  loadPlaylists();
  if (state.view.type === 'playlist' && state.view.id === p.id) reload(true);
}
async function deleteTracks(list) {
  if (!await confirmBox(`Delete ${list.length} tracks?`, 'They are removed from the library along with their files.', 'Delete')) return;
  for (const t of list) { gone.add(t.id); dropFromPlayer(t.id); lyricsCache.delete(t.id); }
  reloadSeq++;
  state.tracks = state.tracks.filter(x => !gone.has(x.id)); state.tracksKey = '';
  drawTracks();
  let ok = 0;
  for (const t of list) {
    try { await api(`/api/tracks/${t.id}`, { method: 'DELETE' }); ok++; }
    catch (e) { toast('Delete failed: ' + e.message, 'error'); }
  }
  if (ok) toast(`Deleted ${ok} track${ok === 1 ? '' : 's'}`);
  await reload(true).catch(() => {});
  for (const t of list) gone.delete(t.id);
}
// Menu for several selected rows at once.
function bulkMenu(list, anchor) {
  const lib = list.filter(t => t.id), ready = list.filter(t => t.status === 'ready'), fresh = list.filter(t => !t.id && !t.in_library);
  const items = [];
  if (ready.length) {
    items.push({ icon: 'play', label: 'Play selected', fn: () => { state.queue = ready.slice(); playIndex(0); } });
    items.push({ icon: 'plus', label: 'Add to queue', fn: () => {
      const idle = !current();
      for (const t of ready) if (!state.queue.some(x => tkey(x) === tkey(t))) state.queue.push(t);
      if (idle) playIndex(0); else { toast(`Added ${ready.length} tracks to the queue`); renderQueue(); }
    } });
  }
  if (fresh.length) items.push({ icon: 'download', label: `Download ${fresh.length} to library`, fn: async () => {
    let dest = {};
    if (fresh.length > 1) {
      dest = await askFolder({ title: `Download ${fresh.length} songs`, text: 'Where should they go?' });
      if (!dest) return;
    }
    let ok = 0;
    for (const t of fresh) if (await saveStream(t, dest.playlist || null, true)) ok++;
    if (dest.playlist) loadPlaylists();
    if (ok) toast(`Downloading ${ok} track${ok === 1 ? '' : 's'} to your library`);
  } });
  items.push({ icon: 'folder', label: lib.length === list.length ? 'Add to folder…' : 'Download to folder…', fn: a => folderPicker(list, a) });
  if (state.view.type === 'playlist' && lib.length) items.push({ icon: 'minus', label: 'Remove from this folder', fn: async () => {
    const pid = state.view.id;
    for (const t of lib) {
      dropFromList(t.id);
      try { await api(`/api/playlists/${pid}/tracks/${t.id}`, { method: 'DELETE' }); } catch (e) { toast(e.message, 'error'); }
    }
    reload(true);
  } });
  if (lib.length) items.push({ icon: 'trash', label: `Delete ${lib.length} from library`, danger: true, fn: () => deleteTracks(lib) });
  openMenu(anchor, items, `${list.length} tracks selected`);
}
async function newFolder() {
  const r = await dialog({ title: 'New folder', fields: [{ label: 'Name', placeholder: 'Folder name' }], ok: 'Create' });
  const name = r && r[0];
  if (!name) return null;
  try { const p = await post('/api/playlists', { name }); await loadPlaylists(); if (state.view.type === 'folders') renderFolders(); return p; }
  catch (e) { toast(e.message, 'error'); return null; }
}
async function editTrack(t) {
  const r = await dialog({ title: 'Edit song', fields: [{ label: 'Title', value: t.title }, { label: 'Artist', value: t.artist || '' }] });
  if (!r) return;
  const [title, artist] = r;
  try { await api(`/api/tracks/${t.id}`, { method: 'PATCH', body: { title, artist } }); }
  catch (e) { return toast(e.message, 'error'); }
  for (const x of state.queue) if (x.id === t.id) { if (title) x.title = title; x.artist = artist; }
  if (current()?.id === t.id) { const c = current(); $('nowT').textContent = $('npT').textContent = c.title; $('nowA').textContent = $('npA').textContent = c.artist || ''; state.lyricsFor = null; }
  lyricsCache.delete(t.id);
  reload(true);
}

// ---------------------------------------------------------------- likes
function paintHeart(b, on) { b.classList.toggle('on', !!on); b.innerHTML = svg(on ? 'heart' : 'heartLine'); b.title = on ? 'Remove from Liked' : 'Like'; }
function paintLikes() {
  const t = current(), show = !!(t && t.id);
  for (const b of [$('likeBtn'), $('npLike')]) { b.hidden = !show; if (show) paintHeart(b, t.liked); }
}
async function toggleLike(t) {
  const liked = t.liked ? 0 : 1;
  for (const x of [...state.tracks, ...state.queue]) if (x.id === t.id) x.liked = liked;
  $$(`.row[data-key="${t.id}"] .heart`).forEach(b => paintHeart(b, liked));
  paintLikes();
  if (state.view.type === 'liked' && !liked) dropFromList(t.id);
  try { await post(`/api/tracks/${t.id}/like`, { liked: !!liked }); } catch (e) { toast(e.message, 'error'); }
  state.tracksKey = '';
}

// ------------------------------------- selection, drag box, drag to folder
// Works like a file manager: drag across the list to draw a selection box,
// Ctrl/Shift-click to add to it, and drag selected tracks (or a track by its
// cover or name) onto a folder in the sidebar.
const picked = new Set();  // keys of the selected rows
let pickAnchor = null, drag = null, dragEnd = 0;
const rowEls = () => [...$$('#main .row')];
const pickedTracks = () => state.shown.filter(t => picked.has(String(tkey(t))));
function paintPicked() { rowEls().forEach(r => r.classList.toggle('sel', picked.has(r.dataset.key))); }
function setPicked(keys) { picked.clear(); for (const k of keys) picked.add(k); paintPicked(); }

document.addEventListener('click', e => {
  if (performance.now() - dragEnd < 100) { e.stopPropagation(); e.preventDefault(); return; }  // the click that ends a drag
  const row = e.target.closest?.('#main .row');
  if (!row || e.target.closest('button')) return;
  const key = row.dataset.key;
  if (e.ctrlKey || e.metaKey) { picked.has(key) ? picked.delete(key) : picked.add(key); pickAnchor = key; }
  else if (e.shiftKey) {
    const keys = rowEls().map(r => r.dataset.key), a = Math.max(0, keys.indexOf(pickAnchor)), b = keys.indexOf(key);
    picked.clear(); for (const k of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) picked.add(k);
  } else { pickAnchor = key; if (picked.size) setPicked([]); return; }
  e.stopPropagation(); e.preventDefault(); paintPicked();
}, true);

// Right-click: on a selected row it acts on the whole selection, otherwise
// the row under the mouse becomes the selection.
$('main').addEventListener('contextmenu', e => {
  const row = e.target.closest('.row');
  if (!row) return;
  if (picked.has(row.dataset.key) && picked.size > 1) { e.preventDefault(); e.stopPropagation(); bulkMenu(pickedTracks(), at(e)); }
  else { pickAnchor = row.dataset.key; setPicked([row.dataset.key]); }
}, true);

$('main').addEventListener('pointerdown', e => {
  const main = $('main');
  if (e.button !== 0 || e.pointerType !== 'mouse') return;
  const base = { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, top: e.clientY + main.scrollTop, id: e.pointerId };
  // a card that carries a song (Home shelves) is picked up whole
  const card = e.target.closest('.card');
  if (card && card._track) { drag = { ...base, card, grab: true }; return; }
  if (!main.querySelector('.row')) return;
  if (e.target.closest('button, input, select, a')) return;
  if (e.clientX >= main.getBoundingClientRect().left + main.clientWidth) return;  // the scrollbar
  const row = e.target.closest('.row'), add = e.ctrlKey || e.metaKey || e.shiftKey;
  drag = {
    ...base, row, add,
    // a selected row, or a track's cover / name, is picked up; anywhere else draws the box
    grab: !!row && !add && (picked.has(row.dataset.key) || !!e.target.closest('img, .t, .a')),
  };
});
// What follows the mouse while songs are dragged: cover, name, how many.
function makeGhost(tracks) {
  const g = el('div', 'drag-ghost'), img = el('img'), txt = el('div'), one = tracks[0];
  img.alt = ''; setImg(img, one);
  txt.append(el('b', null, tracks.length === 1 ? one.title : `${tracks.length} songs`), el('small'));
  g.append(img, txt);
  if (tracks.length > 1) g.append(el('span', 'count', tracks.length));
  return g;
}
// Songs can be dropped between the rows of an open folder shown in its own order.
const canPlace = () => state.view.type === 'playlist' && prefs.sort === 'default' && prefs.src === 'all' && !state.filter.trim() && drag.tracks.every(t => t.id);
addEventListener('pointermove', e => {
  if (!drag) return;
  drag.cx = e.clientX; drag.cy = e.clientY;
  if (!drag.mode) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.mode = drag.grab ? 'move' : 'box';
    try { $('main').setPointerCapture(drag.id); } catch {}
    getSelection()?.removeAllRanges();
    if (drag.mode === 'box') {
      drag.base = drag.add ? new Set(picked) : new Set();
      drag.el = el('div', 'marquee');
      document.body.classList.add('dragsel');
    } else {
      const key = drag.row && drag.row.dataset.key;
      drag.tracks = drag.card ? [drag.card._track] : picked.has(key) ? pickedTracks() : state.shown.filter(t => String(tkey(t)) === key);
      drag.el = makeGhost(drag.tracks);
      drag.line = el('div', 'drop-line'); drag.line.hidden = true;
      document.body.append(drag.line);
      document.body.classList.add('dragsel', 'moving');
      // the songs being carried fade where they were
      drag.lifted = drag.card ? [drag.card] : rowEls().filter(r => drag.tracks.some(t => String(tkey(t)) === r.dataset.key));
      drag.lifted.forEach(n => n.classList.add('lifted'));
    }
    document.body.append(drag.el);
    requestAnimationFrame(boxScroll);
  }
  if (drag.mode === 'box') return drawBox();
  drag.el.style.left = e.clientX + 14 + 'px'; drag.el.style.top = e.clientY + 12 + 'px';
  const over = dropTarget(e);
  if (over !== drag.over) {  // moved onto or off a folder
    clearTimeout(drag.spring);
    $$('.drop-on').forEach(n => n.classList.remove('drop-on', 'spring'));
    drag.over = over;
    if (over) {
      over.classList.add('drop-on');
      // resting on a folder opens it, so the songs can be put at an exact place
      const pid = +over.dataset.id, p = state.playlists.find(x => x.id === pid);
      if (p && !(state.view.type === 'playlist' && state.view.id === pid) && drag.tracks.every(t => t.id)) {
        over.classList.add('spring');
        drag.spring = setTimeout(() => {
          if (!drag || drag.over !== over) return;
          over.classList.remove('spring');
          go({ type: 'playlist', id: p.id, name: p.name, source: p.source });
        }, 900);
      }
    }
  }
  drag.at = null;
  const rows = rowEls(), m = $('main').getBoundingClientRect();
  if (!over && canPlace() && e.clientX > m.left && e.clientX < m.right && e.clientY > m.top && e.clientY < m.bottom) {
    let i = rows.findIndex(r => e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
    if (i < 0) i = rows.length;
    drag.at = i;
    const q = rows.length ? rows[Math.min(i, rows.length - 1)].getBoundingClientRect() : $('rows').getBoundingClientRect();
    Object.assign(drag.line.style, { left: q.left + 'px', width: q.width + 'px', top: (i < rows.length || !rows.length ? q.top : q.bottom) - 1 + 'px' });
  }
  drag.line.hidden = drag.at == null;
  // the label under the title says what letting go will do
  const one = drag.tracks[0], folder = over && state.playlists.find(x => x.id === +over.dataset.id);
  drag.el.querySelector('small').textContent = folder ? `Add to “${folder.name}”` : over ? 'Add to a new folder' : drag.at != null ? `Put here in “${state.view.name}”` : drag.tracks.length === 1 ? (one.artist || '') : `${one.title} and more`;
});
// Move tracks to a new place in the folder that is open.
async function reorder(moved, at) {
  const pid = state.view.id, ids = new Set(moved.map(t => t.id)), list = state.shown;
  const next = [...list.slice(0, at).filter(t => !ids.has(t.id)), ...moved, ...list.slice(at).filter(t => !ids.has(t.id))];
  if (next.every((t, i) => t === list[i])) return;
  reloadSeq++;
  state.tracks = next; state.tracksKey = '';
  drawTracks();
  try { await api(`/api/playlists/${pid}/order`, { method: 'PUT', body: { track_ids: next.map(t => t.id) } }); }
  catch (e) { toast(e.message, 'error'); }
  reload(true);
}
// Drop songs at a chosen place in the open folder; ones that are not in the
// folder yet are added to it first.
async function placeInFolder(moved, at) {
  const v = state.view, have = new Set(state.shown.map(t => t.id)), fresh = moved.filter(t => !have.has(t.id));
  if (fresh.length) {
    let ok = 0;
    for (const t of fresh) {
      try { await post(`/api/playlists/${v.id}/tracks`, { track_id: t.id }); ok++; }
      catch (e) { toast(e.message, 'error'); }
    }
    if (ok) toast(`Added ${ok} song${ok === 1 ? '' : 's'} to “${v.name}”`);
    await reload(true);
    if (state.view !== v) return;
  }
  const order = moved.map(t => state.shown.find(x => x.id === t.id)).filter(Boolean);
  if (order.length) reorder(order, Math.min(at, state.shown.length));
}
function dropTarget(e) { return document.elementFromPoint(e.clientX, e.clientY)?.closest('#pls .nav, .side-h') || null; }
function drawBox() {
  const main = $('main'), m = main.getBoundingClientRect(), y0 = drag.top - main.scrollTop;
  const l = Math.min(drag.x, drag.cx), r = Math.max(drag.x, drag.cx), t = Math.min(y0, drag.cy), b = Math.max(y0, drag.cy);
  const cl = Math.max(l, m.left), ct = Math.max(t, m.top), cr = Math.min(r, m.left + main.clientWidth), cb = Math.min(b, m.bottom);
  Object.assign(drag.el.style, { left: cl + 'px', top: ct + 'px', width: Math.max(0, cr - cl) + 'px', height: Math.max(0, cb - ct) + 'px' });
  const hit = new Set(drag.base);
  for (const row of rowEls()) { const q = row.getBoundingClientRect(); if (q.left < r && q.right > l && q.top < b && q.bottom > t) hit.add(row.dataset.key); }
  setPicked(hit);
}
function boxScroll() {  // keep scrolling while the mouse is held near the top or bottom edge
  if (!drag || !drag.mode) return;
  const edge = (box, x, y) => { const m = box.getBoundingClientRect(); return x > m.left && x < m.right ? (y < m.top + 28 ? -16 : y > m.bottom - 28 ? 16 : 0) : 0; };
  const main = $('main'), side = document.querySelector('.side');
  let step = edge(main, drag.cx, drag.cy);
  if (step) { main.scrollBy({ top: step, behavior: 'instant' }); if (drag.mode === 'box') drawBox(); }
  else if (drag.mode === 'move' && (step = edge(side, drag.cx, drag.cy))) side.scrollBy({ top: step / 2, behavior: 'instant' });  // a long folder list
  requestAnimationFrame(boxScroll);
}
// The carried songs shrink into the folder they were dropped on.
const settle = (anim, ms) => Promise.race([anim.finished.catch(() => {}), new Promise(r => setTimeout(r, ms + 150))]);
function flyInto(ghost, target) {
  const g = ghost.getBoundingClientRect(), t = target.getBoundingClientRect();
  const dx = t.left + 22 - g.left, dy = t.top + t.height / 2 - (g.top + 20);
  const a = ghost.animate([
    { transform: 'rotate(-2deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.6}px,${dy * 0.6 - 14}px) rotate(-6deg) scale(.6)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(.12)`, opacity: 0.2 },
  ], { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  return settle(a, 360).then(() => ghost.remove());
}
function ghostAway(ghost) {
  const a = ghost.animate([{ opacity: 1, transform: 'rotate(-2deg) scale(1)' }, { opacity: 0, transform: 'rotate(0deg) scale(.85)' }], { duration: 170, fill: 'forwards' });
  settle(a, 170).then(() => ghost.remove());
}
function endDrag(e) {
  const d = drag; drag = null;
  if (!d) return;
  if (!d.mode) {  // a plain click: on empty space it clears the selection
    if (!d.row && !d.card && !d.add && picked.size) setPicked([]);
    return;
  }
  dragEnd = performance.now();
  clearTimeout(d.spring);
  d.line?.remove();
  (d.lifted || []).forEach(n => n.classList.remove('lifted'));
  document.body.classList.remove('dragsel', 'moving');
  $$('.drop-on').forEach(n => n.classList.remove('drop-on', 'spring'));
  if (d.mode !== 'move') { d.el.remove(); return; }
  const dropped = e.type === 'pointerup', over = dropped ? dropTarget(e) : null;
  if (!over) {
    if (dropped && d.at != null) { d.el.remove(); placeInFolder(d.tracks, d.at); } else ghostAway(d.el);
    return;
  }
  if (over.matches('.side-h')) { ghostAway(d.el); newFolder().then(p => { if (p) addToFolder(p, d.tracks); }); return; }
  const p = state.playlists.find(x => x.id === +over.dataset.id);
  if (!p) return ghostAway(d.el);
  flyInto(d.el, over).then(() => { state.pulse = p.id; addToFolder(p, d.tracks); });
}
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);

// ---------------------------------------------------------------- views
function setActive() {
  const v = state.view;
  $$('.side .nav[data-view], .tabs button').forEach(b => b.classList.toggle('active',
    b.dataset.view === v.type || (b.dataset.view === 'folders' && b.closest('.tabs') && ['playlist', 'recent', 'top'].includes(v.type))));
  $$('#pls .nav').forEach(b => b.classList.toggle('active', v.type === 'playlist' && +b.dataset.id === v.id));
  $('navMore').classList.toggle('active', (prefs.unpinned || []).includes(v.type));
}

// Pin or unpin the pages of the sidebar. An unpinned page leaves the list
// but is not lost: it moves under "More", from where it can be opened or
// pinned again. Home always stays.
const NAV_ICON = { home: 'home', search: 'search', library: 'music', liked: 'heart', recent: 'history', top: 'trending', folders: 'folder', remix: 'tune' };
const navBtns = () => [...document.querySelectorAll('.side .nav[data-view]')];
const navName = b => b.querySelector('span').textContent;
function applyNav() {
  const off = prefs.unpinned || [];
  navBtns().forEach(b => { b.hidden = off.includes(b.dataset.view); });
  $('navMore').hidden = !off.length;
  setActive();
}
function setPinned(view, on) {
  prefs.unpinned = (prefs.unpinned || []).filter(v => v !== view);
  if (!on && view !== 'home') prefs.unpinned.push(view);
  save('prefs', prefs); applyNav();
}
function navDialog() {
  const wrap = el('div', 'modal dlg-wrap'), form = el('form', 'dlg');
  form.append(el('h3', null, 'Sidebar pages'), el('p', null, 'Pinned pages show in the sidebar. The others wait under “More”.'));
  for (const b of navBtns()) {
    const lab = el('label', 'dlg-opt'), c = el('input'), view = b.dataset.view;
    c.type = 'checkbox'; c.checked = !b.hidden; c.disabled = view === 'home';
    const ico = el('i', 'dlg-ico'); ico.innerHTML = svg(NAV_ICON[view]);
    lab.append(c, ico, el('span', null, navName(b) + (view === 'home' ? ' (always shown)' : '')));
    lab.classList.toggle('sel', c.checked);
    c.onchange = () => { setPinned(view, c.checked); lab.classList.toggle('sel', c.checked); };
    form.append(lab);
  }
  const row = el('div', 'dlg-act'), all = el('button', 'btn ghost', 'Pin all'), ok = el('button', 'btn', 'Done');
  all.type = 'button';
  all.onclick = () => { prefs.unpinned = []; save('prefs', prefs); applyNav(); form.querySelectorAll('input').forEach(c => { c.checked = true; c.parentNode.classList.add('sel'); }); };
  row.append(all, ok); form.append(row); wrap.append(form); document.body.append(wrap);
  const done = () => wrap.remove();
  wrap.onpointerdown = e => { if (e.target === wrap) done(); };
  wrap.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(); };
  form.onsubmit = e => { e.preventDefault(); done(); };
  ok.focus();
}
function navMenu(b, anchor) {
  const items = [];
  if (b.dataset.view !== 'home') items.push({ icon: 'minus', label: 'Unpin from the sidebar', fn: () => { setPinned(b.dataset.view, false); toast(`“${navName(b)}” moved under More`); } });
  items.push({ icon: 'tune', label: 'Choose sidebar pages…', fn: navDialog });
  openMenu(anchor, items, navName(b));
  b.classList.add('menu-on');
}
function moreMenu(anchor) {
  const items = navBtns().filter(b => b.hidden).map(b => ({ icon: NAV_ICON[b.dataset.view], label: navName(b), fn: () => b.click() }));
  items.push({ icon: 'tune', label: 'Pin or unpin pages…', fn: navDialog });
  openMenu(anchor, items, 'More');
}

// Pages are kept in the browser's history, so the back and forward buttons
// at the top, the browser's own Back, a mouse back button and the back
// gesture on a phone all return to the page before.
let navI = 0, navMax = 0;
function paintNav() { $('backBtn').disabled = navI <= 0; $('fwdBtn').disabled = navI >= navMax; }
window.addEventListener('popstate', e => {
  if (!e.state?.view) return;
  navI = e.state.i; navMax = Math.max(navMax, navI);
  closeMenu();
  go(e.state.view, e.state);
});
async function go(view, hist) {
  if (!hist) {
    const at = history.state;
    if (!at?.view) history.replaceState({ view, i: navI }, '');  // the first page
    else if (JSON.stringify(at.view) !== JSON.stringify(view)) {
      history.replaceState({ ...at, y: $('main').scrollTop }, '');  // remember how far this page was scrolled
      history.pushState({ view, i: ++navI }, ''); navMax = navI;
    }
  }
  paintNav();
  state.view = view; state.filter = ''; state.tracksKey = '';
  setPicked([]);
  setActive();
  $('main').scrollTop = 0;
  if (isList(view)) { renderTrackShell(); await reload(true); }
  else if (view.type === 'folders') { await loadPlaylists(); renderFolders(); }
  else if (view.type === 'search') renderSearch();
  else if (view.type === 'home') await renderHome();
  else if (view.type === 'remix') await renderRemix();
  else if (view.type === 'spotify') renderSpotify();
  else if (view.type === 'cleanup') await renderCleanup();
  if (hist?.y && state.view === view) $('main').scrollTop = hist.y;
}

function hero(kind, title, icon, bg) {
  const h = el('div', 'hero');
  const art = el('div', 'hero-art'); art.innerHTML = svg(icon); if (bg) art.style.background = bg;
  const txt = el('div', 'hero-txt');
  txt.append(el('small', null, kind), el('h1', null, title), Object.assign(el('p'), { id: 'heroSub' }));
  const act = el('div', 'hero-act'); act.id = 'heroAct';
  h.append(art, txt, act);
  return h;
}
function btn(cls, icon, label, fn) { const b = el('button', cls); b.innerHTML = icon ? svg(icon) : ''; if (label) b.append(el('span', null, label)); b.onclick = fn; return b; }

// Fill an artist page's header with their photo and facts (genres, country,
// years active, fans), looked up by the server from Deezer and MusicBrainz.
const compact = n => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
async function showArtistInfo(v, h) {
  let d;
  try { d = await api('/api/artist?name=' + encodeURIComponent(v.name)); } catch { return; }
  if (state.view !== v || !h.isConnected) return;
  if (d.picture) {
    const art = h.querySelector('.hero-art'), img = el('img');
    img.alt = '';
    img.onload = () => { art.replaceChildren(img); art.classList.add('photo'); };
    img.src = d.picture;
  }
  const bits = [
    d.about, d.genres && d.genres.length ? d.genres.join(', ') : null,
    d.type && d.type !== 'Person' ? d.type : null, d.country,
    d.since ? (d.type === 'Person' ? `Born ${d.since}` : d.ended ? `Active from ${d.since}` : `Since ${d.since}`) : null,
    d.fans ? `${compact(d.fans)} fans on Deezer` : null, d.albums ? `${d.albums} albums` : null,
  ].filter(Boolean);
  if (bits.length) h.querySelector('.hero-txt').append(el('p', 'hero-meta', bits.join(' · ')));
}

function renderTrackShell() {
  const v = state.view, main = $('main');
  main.replaceChildren();
  const isPl = v.type === 'playlist';
  const L = v.type === 'artist' ? { kind: 'Artist', title: v.name, icon: 'person' } : LISTS[v.type];
  const h = hero(isPl ? (v.source === 'folder' ? 'Folder' : v.source + ' playlist') : L.kind, isPl ? v.name : L.title, isPl ? 'folder' : L.icon, isPl ? grad(v.name) : null);
  main.append(h);
  if (v.type === 'artist') showArtistInfo(v, h);
  const act = h.querySelector('#heroAct');
  act.append(btn('btn', 'play', 'Play', () => playFrom(null)), btn('btn ghost', 'shuffle', 'Shuffle', () => { setShuffle(true); playFrom(null, true); }));
  if (isPl) act.append(btn('icon-btn', 'more', '', e => openMenu(e.currentTarget, [
    { icon: 'upload', label: 'Upload files into this folder', fn: () => $('file').click() },
    { icon: 'edit', label: 'Rename', fn: async () => { const r = await dialog({ title: 'Rename folder', fields: [{ label: 'Name', value: v.name }] }); const n = r && r[0]; if (!n) return; await api(`/api/playlists/${v.id}`, { method: 'PATCH', body: { name: n } }); v.name = n; await loadPlaylists(); renderTrackShell(); reload(true); } },
    { icon: 'trash', label: 'Delete folder (keeps tracks)', danger: true, fn: async () => { if (!await confirmBox('Delete folder?', `“${v.name}” is removed. Its tracks stay in the library.`, 'Delete')) return; await api(`/api/playlists/${v.id}`, { method: 'DELETE' }); go({ type: 'folders' }); } },
  ], v.name)));
  const tools = el('div', 'tools');
  const f = el('input'); f.placeholder = 'Filter…'; f.type = 'search';
  f.oninput = () => { state.filter = f.value; drawTracks(); };
  const s = el('select');
  for (const [v2, l] of [['default', isPl ? 'Folder order' : v.type === 'library' || v.type === 'liked' ? 'Recently added' : 'Default order'], ['title', 'Title A–Z'], ['artist', 'Artist A–Z'], ['duration', 'Duration']]) s.append(new Option(l, v2));
  s.value = prefs.sort; s.onchange = () => { prefs.sort = s.value; save('prefs', prefs); drawTracks(); };
  tools.append(f, s);
  const rows = el('div'); rows.id = 'rows';
  main.append(srcChips(drawTracks), tools, rows);
}

let reloadSeq = 0;
async function reload(force) {
  loadPlaylists();
  const v = state.view;
  if (!isList(v)) return;
  // Only the newest request may update the list: an older one that was already
  // in flight (e.g. the background poll) would bring back a deleted track.
  const seq = ++reloadSeq;
  let data = await api('/api/tracks' + (v.type === 'playlist' ? '?playlist=' + v.id : v.type === 'artist' ? '' : LISTS[v.type].q || ''));
  if (v.type === 'artist') data = data.filter(t => artistsOf(t).some(a => a.toLowerCase() === v.name.toLowerCase()));
  if (seq !== reloadSeq) return;
  if (gone.size) data = data.filter(t => !gone.has(t.id));
  const key = JSON.stringify(data);
  if (v !== state.view || (!force && key === state.tracksKey)) return;
  state.tracksKey = key; state.tracks = data;
  drawTracks();
}

// One row for a song in the library.
function trackRow(t, i) {
  const row = el('div', 'row'), cur = current();
  row.dataset.key = tkey(t);
  row.style.animationDelay = Math.min(i, 10) * 12 + 'ms';
  const img = el('img'); img.loading = 'lazy'; img.alt = ''; setImg(img, t);
  const meta = el('div');
  const title = el('div', 't', t.title), badge = srcBadge(t);
  if (badge) title.append(badge);
  if (t.kind === 'video') title.append(el('span', 'badge', 'VIDEO'));
  let sub = t.artist || (t.source === 'upload' ? 'Local file' : '');
  if (state.view.type === 'top' && t.plays) sub += `${sub ? ' · ' : ''}${t.plays} play${t.plays === 1 ? '' : 's'}`;
  const a = el('div', 'a');
  if (t.artist) { artistLinks(a, t.artist); a.append(sub.slice(t.artist.length)); } else a.textContent = sub;
  meta.append(title, a);
  const tag = el('div');
  if (t.status === 'ready') {
    const h = el('button', 'icon-btn heart'); paintHeart(h, t.liked);
    h.onclick = e => { e.stopPropagation(); toggleLike(t); };
    tag.append(h);
  }
  if (t.status !== 'ready') { const s = el('span', 'tag ' + t.status, dlText(t)); if (t.error) s.title = t.error; tag.append(s); row.classList.add('dim'); }
  const more = btn('icon-btn', 'more', '', e => { e.stopPropagation(); trackMenu(t, e.currentTarget); });
  more.title = 'More';
  if (t.status === 'ready') { row.classList.add('playable'); row.onclick = () => playFrom(tkey(t)); }
  row.oncontextmenu = e => { e.preventDefault(); trackMenu(t, at(e)); };
  if (cur && tkey(cur) === tkey(t)) row.classList.add('current');
  row.append(el('div', 'n', i + 1), img, meta, tag, el('div', 'd', t.duration ? fmt(t.duration) : ''), more);
  return row;
}

function drawTracks() {
  const box = $('rows'); if (!box) return;
  let list = state.tracks;
  const f = state.filter.trim().toLowerCase();
  if (f) list = list.filter(t => (t.title + ' ' + (t.artist || '')).toLowerCase().includes(f));
  if (prefs.src !== 'all') list = list.filter(t => srcMatch(t, prefs.src));
  const cmp = { title: (a, b) => a.title.localeCompare(b.title), artist: (a, b) => (a.artist || '').localeCompare(b.artist || ''), duration: (a, b) => a.duration - b.duration }[prefs.sort];
  if (cmp) list = [...list].sort(cmp);
  state.shown = list;
  const total = state.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const sub = $('heroSub'); if (sub) sub.textContent = `${state.tracks.length} track${state.tracks.length === 1 ? '' : 's'}${total ? ' · ' + Math.round(total / 60) + ' min' : ''}`;
  box.replaceChildren();
  if (!list.length) {
    const e = el('div', 'empty'); e.innerHTML = svg('music');
    e.append(el('div', null, f || (prefs.src !== 'all' && state.tracks.length) ? 'Nothing matches that filter.' : state.view.type === 'playlist' ? 'This folder is empty. Use ⋯ on any track to add it here, or upload files.' : (LISTS[state.view.type] || { empty: 'No songs by this artist in your library.' }).empty));
    box.append(e); return;
  }
  list.forEach((t, i) => box.append(trackRow(t, i)));
  const keys = new Set(list.map(t => String(tkey(t))));
  for (const k of [...picked]) if (!keys.has(k)) picked.delete(k);
  paintPicked();
}
function markCurrent() {
  const cur = current();
  $$('#main .row').forEach(r => r.classList.toggle('current', !!cur && r.dataset.key === String(tkey(cur))));
}

async function loadPlaylists() {
  let list;
  try { list = await api('/api/playlists'); } catch { return; }
  // a folder, or songs, are being dragged: do not redraw the list under them
  if (plDrag || (drag && drag.mode === 'move')) return;
  state.playlists = list;
  const box = $('pls'); box.replaceChildren();
  for (const p of state.playlists) {
    const b = el('button', 'nav'); b.dataset.id = p.id;
    b.innerHTML = svg('folder'); b.append(el('span', null, p.name), el('small', null, p.count));
    b.onclick = () => go({ type: 'playlist', id: p.id, name: p.name, source: p.source });
    b.onpointerdown = e => cardDrag(e, b, box, ".nav", true);
    b.oncontextmenu = e => { e.preventDefault(); folderMenu(p, at(e), b); };
    if (state.pulse === p.id) b.classList.add('got');  // songs were just dropped in
    box.append(b);
  }
  state.pulse = null;
  setActive();
}
// Right-click menu of a folder, in the sidebar and on the Folders page.
function folderMenu(p, anchor, mark) {
  const here = () => state.view.type === 'playlist' && state.view.id === p.id;
  const redraw = async () => { await loadPlaylists(); if (state.view.type === 'folders') renderFolders(); };
  const play = async mix => {
    let list = [];
    try { list = (await api('/api/tracks?playlist=' + p.id)).filter(t => t.status === 'ready'); } catch (e) { return toast(e.message, 'error'); }
    if (!list.length) return toast('This folder has no songs to play yet');
    if (mix) list.sort(() => Math.random() - 0.5);
    state.queue = list; playIndex(0);
  };
  openMenu(anchor, [
    { icon: 'folder', label: 'Open', fn: () => go({ type: 'playlist', id: p.id, name: p.name, source: p.source }) },
    { icon: 'play', label: 'Play', fn: () => play(false) },
    { icon: 'shuffle', label: 'Shuffle', fn: () => play(true) },
    { icon: 'edit', label: 'Rename', fn: async () => {
      const r = await dialog({ title: 'Rename folder', fields: [{ label: 'Name', value: p.name }] }); const n = r && r[0];
      if (!n || n === p.name) return;
      try { await api(`/api/playlists/${p.id}`, { method: 'PATCH', body: { name: n } }); } catch (e) { return toast(e.message, 'error'); }
      await redraw();
      if (here()) { state.view.name = n; renderTrackShell(); reload(true); }
    } },
    { icon: 'trash', label: 'Delete folder (keeps songs)', danger: true, fn: async () => {
      if (!await confirmBox('Delete folder?', `“${p.name}” is removed. Its songs stay in the library.`, 'Delete')) return;
      try { await api(`/api/playlists/${p.id}`, { method: 'DELETE' }); } catch (e) { return toast(e.message, 'error'); }
      toast(`Deleted the folder “${p.name}”`);
      if (here()) go({ type: 'folders' }); else redraw();
    } },
  ], p.name);
  document.querySelectorAll('.menu-on').forEach(n => n.classList.remove('menu-on'));
  mark?.classList.add('menu-on');  // shows which folder the menu belongs to, until it closes
}
// True while a folder is being dragged (sidebar or Folders page).
let plDrag = false;

function renderFolders() {
  const main = $('main'); main.replaceChildren();
  const h = hero('Organise', 'Folders', 'folder');
  main.append(h);
  $('heroSub').textContent = `${state.playlists.length} folder${state.playlists.length === 1 ? '' : 's'} & playlists`;
  const grid = el('div', 'grid');
  const add = el('button', 'card new');
  const tile = el('div', 'tile'); tile.innerHTML = svg('plus');
  add.append(tile, el('b', null, 'New folder'), el('small', null, 'Group your tracks'));
  add.onclick = newFolder;
  for (const k of ['liked', 'recent', 'top']) {
    const c = el('button', 'card'), t = el('div', 'tile');
    t.style.background = 'linear-gradient(135deg,var(--accent),var(--accent2))'; t.innerHTML = svg(LISTS[k].icon);
    c.append(t, el('b', null, LISTS[k].title), el('small', null, LISTS[k].kind));
    c.onclick = () => go({ type: k });
    grid.append(c);
  }
  grid.append(add);
  state.playlists.forEach((p, i) => {
    const c = el('button', 'card'); c.style.animationDelay = i * 25 + 'ms';
    const t = el('div', 'tile'); t.style.background = grad(p.name); t.innerHTML = svg(p.source === 'folder' ? 'folder' : 'music');
    c.append(t, el('b', null, p.name), el('small', null, `${p.count} track${p.count === 1 ? '' : 's'}${p.source === 'folder' ? '' : ' · ' + p.source}`));
    c.onclick = () => go({ type: 'playlist', id: p.id, name: p.name, source: p.source });
    c.dataset.id = p.id; c.title = 'Drag to move this folder';
    c.onpointerdown = e => cardDrag(e, c, grid);
    c.oncontextmenu = e => { e.preventDefault(); folderMenu(p, at(e), c); };
    grid.append(c);
  });
  main.append(grid);
}
// Drag a folder card on the Folders page to put the folders in any order
// (press and hold it first on a touch screen). The other cards slide aside.
function cardDrag(e, c, grid, sel = ".card[data-id]", col = false) {
  const touch = e.pointerType !== 'mouse';
  if (!touch && e.button !== 0) return;
  e.stopPropagation();
  const x0 = e.clientX, y0 = e.clientY, main = $('main');
  let on = false, gx = 0, gy = 0, lock = 0, last = e, timer = 0, raf = 0;
  const others = () => [...grid.querySelectorAll(sel)].filter(x => x !== c);
  const follow = () => {  // keep the card under the pointer wherever it sits in the grid
    c.style.transform = '';
    const r = c.getBoundingClientRect();
    c.style.transform = col ? `translateY(${last.clientY - gy - r.top}px) scale(1.03)` : `translate(${last.clientX - gx - r.left}px,${last.clientY - gy - r.top}px) scale(1.06)`;
  };
  const start = () => {
    c.style.animation = 'none';
    c.classList.add('lifting');
    const r = c.getBoundingClientRect();
    gx = last.clientX - r.left; gy = last.clientY - r.top;
    on = plDrag = true;
    try { c.setPointerCapture(e.pointerId); } catch {}
    follow();
    raf = requestAnimationFrame(scroll);
  };
  const scroll = () => {  // near the top or bottom edge the page keeps scrolling
    const m = main.getBoundingClientRect(), y = last.clientY;
    const step = y < m.top + 40 ? -14 : y > m.bottom - 40 ? 14 : 0;
    if (step) { main.scrollBy({ top: step, behavior: 'instant' }); place(); }
    raf = requestAnimationFrame(scroll);
  };
  const place = () => {
    follow();
    if (performance.now() < lock) return;
    const x = last.clientX, y = last.clientY;
    const hit = others().find(o => { const r = o.getBoundingClientRect(); return (col || (x > r.left && x < r.right)) && y > r.top && y < r.bottom; });
    if (!hit) return;
    const list = others(), was = new Map(list.map(o => [o, o.getBoundingClientRect()]));
    const after = c.compareDocumentPosition(hit) & Node.DOCUMENT_POSITION_FOLLOWING;
    grid.insertBefore(c, after ? hit.nextSibling : hit);
    for (const o of list) {
      const a = was.get(o), b = o.getBoundingClientRect();
      if (a.left !== b.left || a.top !== b.top) o.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    lock = performance.now() + 240;
    follow();
  };
  const move = ev => {
    last = ev;
    if (!on) {
      const far = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (touch) { if (far > 10) clearTimeout(timer); return; }  // moved before the hold: a scroll
      if (far < 6) return;
      start();
    }
    place();
  };
  const noScroll = ev => { if (on) ev.preventDefault(); };
  const noMenu = ev => { if (on || touch) ev.preventDefault(); };
  const up = async () => {
    clearTimeout(timer); cancelAnimationFrame(raf);
    for (const k of ['pointermove', 'pointerup', 'pointercancel']) c.removeEventListener(k, k === 'pointermove' ? move : up);
    c.removeEventListener('touchmove', noScroll); c.removeEventListener('contextmenu', noMenu);
    if (!on) return;
    dragEnd = performance.now();  // the click that ends the drag must not open the folder
    const from = c.style.transform;
    c.classList.remove('lifting'); c.style.transform = '';
    const drop = c.animate([{ transform: from }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });  // settle into the gap
    const ids = [...grid.querySelectorAll(sel)].map(x => +x.dataset.id);
    state.playlists.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
    try { await api('/api/playlists/order', { method: 'PUT', body: { ids } }); }
    catch (err) { toast(err.message, 'error'); }
    plDrag = false;
    if (col) { await settle(drop, 200); await loadPlaylists(); if (state.view.type === 'folders') renderFolders(); }
    else loadPlaylists();
  };
  c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('touchmove', noScroll, { passive: false }); c.addEventListener('contextmenu', noMenu);
  if (touch) timer = setTimeout(() => { start(); navigator.vibrate?.(15); }, 350);
}

// Each artist name in a line of text opens that artist's page.
function artistLinks(box, artist) {
  artist.split(ARTIST_SEP).forEach((p, i) => {
    if (i % 2 || !p.trim()) return box.append(p);
    const s = el('span', 'artist-link', p);
    s.title = 'Show songs by ' + p.trim();
    s.onclick = e => { e.stopPropagation(); go({ type: 'artist', name: p.trim() }); };
    box.append(s);
  });
}
$('npA').onclick = () => {
  const a = current() && artistsOf(current())[0];
  if (!a) return;
  $('np').classList.remove('full'); if (!wide()) closeNp();
  go({ type: 'artist', name: a });
};

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
    const pick = l => l.filter(t => t.status === 'ready' && srcMatch(t, prefs.src));
    const shelf = (title, cards, more) => {
      if (!cards.length) return;
      const row = el('div', 'shelf'); row.append(...cards);
      body.append(sectionHead(title, more), row);
    };
    const tiles = l => l.map(t => trackTile(t, l));
    shelf('Jump back in', tiles(pick(recent).slice(0, 12)), { type: 'recent' });
    const vids = pick(all).filter(t => t.kind === 'video').slice(0, 12);
    shelf('Videos', vids.map(t => videoTile(t, vids)));
    shelf('Recently added', tiles(pick(all).slice(0, 16)), { type: 'library' });
    shelf('Most played', tiles(pick(top).slice(0, 12)), { type: 'top' });
    const byArtist = new Map();
    for (const t of pick(all)) for (const a of artistsOf(t)) {
      const k = a.toLowerCase(), c = byArtist.get(k) || { name: a, n: 0, t };
      c.n++; byArtist.set(k, c);
    }
    shelf('Your artists', [...byArtist.values()].sort((a, b) => b.n - a.n).slice(0, 14).map(a => {
      const c = el('button', 'card artist'), img = el('img', 'tile');
      img.loading = 'lazy'; img.alt = '';
      img.onerror = () => setImg(img, a.t);  // no artist photo found: use a cover of theirs
      img.src = '/api/artist/picture?name=' + encodeURIComponent(a.name);
      c.append(img, el('b', null, a.name), el('small', null, `${a.n} song${a.n === 1 ? '' : 's'}`));
      c.onclick = () => go({ type: 'artist', name: a.name });
      return c;
    }));
    if (prefs.src === 'all') shelf('Folders', state.playlists.map(p => {
      const c = el('button', 'card'), t = el('div', 'tile');
      t.style.background = grad(p.name); t.innerHTML = svg(p.source === 'folder' ? 'folder' : 'music');
      c.append(t, el('b', null, p.name), el('small', null, `${p.count} track${p.count === 1 ? '' : 's'}`));
      c.onclick = () => go({ type: 'playlist', id: p.id, name: p.name, source: p.source });
      return c;
    }), { type: 'folders' });
    if (!body.children.length) body.append(el('div', 'empty', 'Nothing from this source yet.'));
  };
  main.append(srcChips(draw), body);
  draw();
}

// The AI jobs that are waiting or running, shown at the top of the studio.
const JOB_WORD = { song: 'Creating', cover: 'Covering', repaint: 'Re-making part of', split: 'Splitting', mashup: 'Mixing', generate: 'Creating' };
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

// -------------------------------------------------------------- playback
function playFrom(id, random = false) {
  const q = state.shown.filter(t => t.status === 'ready');
  if (!q.length) return toast('Nothing downloaded to play here yet');
  state.queue = q.slice();
  let i = q.findIndex(t => tkey(t) === id);
  if (i < 0) i = random ? Math.floor(Math.random() * q.length) : 0;
  playIndex(i);
}
function playNext(t) {
  if (!current()) { state.queue = [t]; return playIndex(0); }
  const cur = current();
  if (tkey(cur) === tkey(t)) return;
  state.queue = state.queue.filter(x => tkey(x) !== tkey(t));
  state.index = state.queue.indexOf(cur);
  state.queue.splice(state.index + 1, 0, t);
  toast(`“${t.title}” plays next`);
  renderQueue();
}
function addToQueue(t) {
  if (!current()) { state.queue = [t]; return playIndex(0); }
  if (state.queue.some(x => tkey(x) === tkey(t))) return toast('Already in the queue');
  state.queue.push(t);
  toast(`Added “${t.title}” to the queue`);
  renderQueue();
}
function playIndex(i, autoplay = true, startAt = 0) {
  state.index = i;
  const t = state.queue[i];
  if (!t.id && !t.video_id && t.sp_id) {  // a Spotify result: find its match on YouTube first
    $('nowT').textContent = t.title; $('nowA').textContent = 'Finding it on YouTube…';
    api(`/api/spotify/match?title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist || '')}&duration=${t.duration || 0}`).then(r => {
      t.video_id = r.video_id;
      if (state.queue[state.index] === t) playIndex(i, autoplay, startAt);
    }, e => toast('Could not play that song: ' + e.message, 'error'));
    return;
  }
  if (!t.id && t.kind === 'video') t.vsrc = true;
  remixNamed = false; if (state.view.type === 'remix' && paintRemix) paintRemix();  // effects stay on for the next song
  audio.src = srcOf(t);
  applyRemix();
  applyNorm();
  if (!xfading) { fadeMul = 1; applyVol(); }
  if (startAt) audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt; }, { once: true });
  if (autoplay) audio.play().catch(() => {});
  $('nowT').textContent = $('npT').textContent = t.title;
  $('npA').textContent = t.artist || '';
  $('nowA').textContent = t.id ? (t.artist || '') : `${t.artist ? t.artist + ' · ' : ''}streaming, not downloaded`;
  $('saveBtn').hidden = $('npSave').hidden = !!t.id || !!t.in_library;
  const isVideo = modeOf(t) === 'video';
  paintMode(t);
  t.counted = false;
  paintLikes(); renderQueue();
  if (isVideo && autoplay && !wide()) openNp();
  setImg($('art'), t); setImg($('npArt'), t);
  $('npBg').style.backgroundImage = `url("${coverUrl(t)}")`;
  themeFromCover(t);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || '', artwork: [{ src: coverUrl(t), sizes: '320x180' }] });
  }
  markCurrent();
  if ($('np').classList.contains('open')) showLyrics();
}
function paintMode(t) {
  const mode = modeOf(t), video = mode === 'video';
  document.body.classList.toggle('is-video', video);
  $('fsBtn').hidden = !video;
  $('avTabs').hidden = !canVideo(t);
  $('avTabs').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.m === mode));
  if (!video) vizStart();
}
// Switch the current song between sound only and video, keeping the position.
function setMode(mode) {
  const t = current();
  if (!t || !canVideo(t) || modeOf(t) === mode) return;
  const before = srcOf(t), time = audio.currentTime, playing = !audio.paused;
  if (t.id) { prefs.avMode = mode; save('prefs', prefs); } else { t.kind = mode; if (mode === 'video') t.vsrc = true; }
  const after = srcOf(t);
  if (after !== before) {  // only a stream's first switch to video
    audio.src = after; applyRemix();
    audio.addEventListener('loadedmetadata', () => { audio.currentTime = time; }, { once: true });
    if (playing) audio.play().catch(() => {});
  }
  paintMode(t);
}
$('avTabs').onclick = e => { const m = e.target.closest('button')?.dataset.m; if (m) setMode(m); };

function next(auto = false) { const i = pickNext(auto); if (i >= 0) playIndex(i); }
function prev() {
  if (audio.currentTime > 3 || state.index <= 0) { audio.currentTime = 0; return; }
  playIndex(state.index - 1);
}
function toggle() {
  if (!current()) return playFrom(null);
  audio.paused ? audio.play() : audio.pause();
}
function setShuffle(v) { state.shuffle = v; $$('.js-shuf').forEach(b => b.classList.toggle('on', v)); }
function setRepeat(v) { state.repeat = v; $$('.js-rep').forEach(b => b.classList.toggle('on', v)); }

audio.onended = () => {
  if (state.sleepMode === 'end') { setSleep('off'); toast('Sleep timer: stopped after this track'); return; }
  next(true);
};
audio.onerror = () => { const t = current(); if (t) toast(t.id ? 'Could not play this track' : 'Could not stream this track from YouTube', 'error'); };
$('saveBtn').onclick = $('npSave').onclick = () => { const t = current(); if (t && !t.id) saveStream(t); };
$('likeBtn').onclick = $('npLike').onclick = () => { const t = current(); if (t && t.id) toggleLike(t); };
$('fsBtn').onclick = () => { (audio.requestFullscreen || audio.webkitEnterFullscreen || (() => {})).call(audio); };
audio.ondblclick = () => $('fsBtn').onclick();
document.addEventListener('fullscreenchange', () => { audio.controls = document.fullscreenElement === audio; });
audio.onclick = () => toggle();
audio.onplay = audio.onpause = () => {
  $$('.js-play').forEach(b => { b.innerHTML = svg(audio.paused ? 'play' : 'pause'); });
  document.body.classList.toggle('playing', !audio.paused);
  if (!audio.paused) { ensureEq(); actx?.resume(); vizStart(); lyLoop(); }
};
let seeking = false, lastSave = 0;
audio.ontimeupdate = () => {
  const t = audio.currentTime, d = isFinite(audio.duration) ? audio.duration : 0;
  if (!seeking) $$('.js-seek').forEach(s => { s.value = t; fill(s); });
  $$('.js-cur').forEach(e => { e.textContent = fmt(t); });
  $('pbar').style.width = (d ? t / d * 100 : 0) + '%';
  syncLyrics(t);
  const cur = current();
  if (cur && cur.id && !cur.counted && t > 10) { cur.counted = true; post(`/api/tracks/${cur.id}/played`).catch(() => {}); state.tracksKey = ''; }
  maybeCrossfade(t, d);
};
audio.ondurationchange = () => {
  const d = isFinite(audio.duration) ? audio.duration : 0;
  $$('.js-seek').forEach(s => { s.max = d || 1; fill(s); });
  $$('.js-dur').forEach(e => { e.textContent = fmt(d); });
};
$$('.js-seek').forEach(s => {
  s.oninput = () => { seeking = true; fill(s); $$('.js-cur').forEach(e => { e.textContent = fmt(s.value); }); };
  s.onchange = () => { audio.currentTime = s.value; seeking = false; };
});
$('vol').oninput = () => { setVolume(+$('vol').value); save('prefs', prefs); };
$('volReset').onclick = () => { setVolume(1); save('prefs', prefs); };
$$('.js-play').forEach(b => { b.onclick = toggle; });
$$('.js-next').forEach(b => { b.onclick = () => next(); });
$$('.js-prev').forEach(b => { b.onclick = prev; });
$$('.js-shuf').forEach(b => { b.onclick = () => setShuffle(!state.shuffle); });
$$('.js-rep').forEach(b => { b.onclick = () => setRepeat(!state.repeat); });

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => audio.play());
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('nexttrack', () => next());
  ms.setActionHandler('previoustrack', prev);
  try { ms.setActionHandler('seekto', e => { audio.currentTime = e.seekTime; }); } catch {}
}
addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { if (rowEls().length) { e.preventDefault(); setPicked(rowEls().map(r => r.dataset.key)); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && picked.size && $('menu').hidden) return setPicked([]);
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  else if (e.code === 'ArrowRight') audio.currentTime += 5;
  else if (e.code === 'ArrowLeft') audio.currentTime -= 5;
  else if (e.key === 'n') next();
  else if (e.key === 'p') prev();
  else if (e.key === 'l') $('np').classList.contains('open') ? closeNp() : openNp();
  else if (e.key === 'q') toggleQueue();
  else if (e.key === 'Escape' && !$('settings').hidden) closeSettings();
  else if (e.key === 'Escape') { closeMenu(); if ($('queue').classList.contains('open')) toggleQueue(false); else if (!wide() || $('np').classList.contains('full')) closeNp(); }
  else if (e.key === '/') { e.preventDefault(); $('q').focus(); }
});

// Audio graph: source -> 10-band EQ -> analyser -> speakers. It is created
// only once the EQ or the visualizer is actually needed.
let actx, eqNodes, analyser;
const npOpen = () => $('np').classList.contains('open');
function ensureEq() {
  const wantEq = prefs.eqOn && prefs.eq.some(g => g), wantViz = prefs.viz !== 'off' && npOpen() && !!current();
  if (actx || !(wantEq || wantViz || remixOn() || prefs.volume > 1 || normGain() !== 1)) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    let node = actx.createMediaElementSource(audio);
    const norm = actx.createGain(); norm.gain.value = normGain();  // even loudness
    node.connect(norm); node = norm;
    eqNodes = EQ_F.map((f, i) => {
      const n = actx.createBiquadFilter();
      n.type = i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking';
      n.frequency.value = f; n.Q.value = 1.4;
      node.connect(n); node = n;
      return n;
    });
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .8;
    // remix stage: bass shelf -> slow auto-pan -> dry signal + reverb
    const bass = actx.createBiquadFilter(), pan = actx.createStereoPanner(), verb = actx.createConvolver();
    const wet = actx.createGain(), lfo = actx.createOscillator(), depth = actx.createGain();
    bass.type = 'lowshelf'; bass.frequency.value = 110; bass.gain.value = 0;
    const len = Math.floor(actx.sampleRate * 2.6), ir = actx.createBuffer(2, len, actx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    verb.buffer = ir; wet.gain.value = 0; depth.gain.value = 0; lfo.frequency.value = 0.09;
    lfo.connect(depth); depth.connect(pan.pan); lfo.start();
    node.connect(bass); bass.connect(pan); pan.connect(analyser); pan.connect(verb); verb.connect(wet); wet.connect(analyser);
    const boost = actx.createGain(); boost.gain.value = Math.max(prefs.volume, 1);
    analyser.connect(boost); boost.connect(actx.destination);
    fx = { bass, wet, depth, boost, norm };
    if (remixOn()) applyRemix();
    applyEq();
    if (!audio.paused) actx.resume();
  } catch { actx = null; }
}
function applyEq() { if (eqNodes) eqNodes.forEach((n, i) => { n.gain.value = prefs.eqOn ? prefs.eq[i] : 0; }); }

// Visualizer for audio tracks: bars, wave or a ring around the cover.
let vizRaf = 0, vizBuf;
function vizStart() {
  if (vizRaf || prefs.viz === 'off' || !npOpen() || audio.paused || showingVideo()) return;
  ensureEq();
  if (!analyser) return;
  actx.resume();
  vizBuf = vizBuf || new Uint8Array(analyser.frequencyBinCount);
  const step = () => {
    vizRaf = 0;
    const c = $('viz'), g = c.getContext('2d');
    if (prefs.viz === 'off' || !npOpen() || audio.paused || showingVideo()) { g.clearRect(0, 0, c.width, c.height); return; }
    drawViz(c, g);
    vizRaf = requestAnimationFrame(step);
  };
  vizRaf = requestAnimationFrame(step);
}
function drawViz(c, g) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (!w || !h) return;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  g.clearRect(0, 0, w, h);
  const [c1, c2] = vizColors;
  if (prefs.viz === 'wave') {
    analyser.getByteTimeDomainData(vizBuf);
    const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    g.lineWidth = 3 * dpr; g.strokeStyle = grad; g.lineJoin = 'round'; g.shadowColor = c1; g.shadowBlur = 12 * dpr;
    g.beginPath();
    const n = vizBuf.length;
    for (let i = 0; i < n; i += 2) { const x = i / (n - 1) * w, y = h * .55 + (vizBuf[i] - 128) / 128 * h * .42; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
    return;
  }
  analyser.getByteFrequencyData(vizBuf);
  if (prefs.viz === 'circle') {
    const n = 72, cx = w / 2, cy = h / 2, r0 = w / 2.8 + 4 * dpr, max = w / 2 - r0;
    g.lineWidth = Math.max(2, w / 190); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const k = i < n / 2 ? i : n - 1 - i;            // mirror so the ring is symmetric
      const v = vizBuf[2 + Math.floor(k * 1.6)] / 255, a = i / n * Math.PI * 2 - Math.PI / 2;
      const len = 3 * dpr + v * v * max;
      g.strokeStyle = i % 2 ? c1 : c2; g.globalAlpha = .45 + v * .55;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
    }
    g.globalAlpha = 1;
    return;
  }
  const n = 40, gap = w * .012, bw = (w - gap * (n + 1)) / n;
  const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, c1); grad.addColorStop(1, c2);
  g.fillStyle = grad;
  for (let i = 0; i < n; i++) {
    const v = vizBuf[1 + Math.floor(i * 2.2)] / 255, bh = Math.max(2 * dpr, v * v * h * .95), x = gap + i * (bw + gap);
    g.globalAlpha = .55 + v * .45;
    g.beginPath(); g.roundRect ? g.roundRect(x, h - bh, bw, bh, bw / 2) : g.rect(x, h - bh, bw, bh); g.fill();
  }
  g.globalAlpha = 1;
}

// Queue panel
function toggleQueue(open) {
  const q = $('queue'); open = open ?? !q.classList.contains('open');
  q.classList.toggle('open', open); q.setAttribute('aria-hidden', String(!open));
  if (open) renderQueue();
}
function renderQueue() {
  const list = $('qList');
  if (!$('queue').classList.contains('open')) return;
  list.replaceChildren();
  if (!state.queue.length) { list.append(el('div', 'dr-empty', 'The queue is empty. Play something, or use ⋯ → Add to queue.')); return; }
  state.queue.forEach((t, i) => {
    const it = el('div', 'q-item' + (i === state.index ? ' current' : i < state.index ? ' done' : '')); it.dataset.i = i;
    const handle = el('button', 'icon-btn q-drag'); handle.innerHTML = svg('drag'); handle.title = 'Drag to reorder';
    const img = el('img'); img.alt = ''; img.loading = 'lazy'; setImg(img, t);
    const meta = el('div'); meta.append(el('div', 't', t.title), el('div', 'a', t.artist || ''));
    const rm = btn('icon-btn', 'close', '', e => { e.stopPropagation(); removeQueueAt(i); }); rm.title = 'Remove from queue';
    it.onclick = () => playIndex(i);
    it.oncontextmenu = e => { e.preventDefault(); trackMenu(t, at(e)); };
    handle.onclick = e => e.stopPropagation();
    handle.onpointerdown = e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); it.classList.add('dragging');
      const move = ev => {
        const before = [...list.children].find(c => c !== it && ev.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        list.insertBefore(it, before || null);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        const cur = current();
        state.queue = [...list.children].map(c => state.queue[+c.dataset.i]);
        state.index = state.queue.indexOf(cur);
        renderQueue();
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    };
    it.append(handle, img, meta, rm);
    list.append(it);
  });
  list.querySelector('.current')?.scrollIntoView({ block: 'nearest' });
}
$('queueBtn').onclick = $('npQueue').onclick = () => toggleQueue();
$('qClose').onclick = () => toggleQueue(false);
$('qClear').onclick = () => { const cur = current(); state.queue = cur ? [cur] : []; state.index = cur ? 0 : -1; renderQueue(); };

// Graphic EQ: a response curve whose band handles are dragged up and down.
function buildEq(host, onChange) {
  const W = 600, H = 250, L = 34, R = 12, T = 18, B = 34, n = EQ_F.length, cw = (W - L - R) / n;
  const X = i => L + cw * (i + .5), Y = g => T + (12 - g) / 24 * (H - T - B);
  const label = f => f >= 1000 ? f / 1000 + 'k' : String(f);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="eq" role="group" aria-label="Equaliser"><defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient><linearGradient id="eql" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent2)"/></linearGradient></defs>`;
  for (const db of [12, 6, 0, -6, -12]) s += `<line class="eq-grid${db ? '' : ' zero'}" x1="${L}" x2="${W - R}" y1="${Y(db)}" y2="${Y(db)}"/><text class="eq-db" x="${L - 8}" y="${Y(db) + 4}" text-anchor="end">${db > 0 ? '+' : ''}${db}</text>`;
  s += '<path class="eq-fill" fill="url(#eqg)"/><path class="eq-line" stroke="url(#eql)"/>';
  EQ_F.forEach((f, i) => {
    s += `<line class="eq-track" x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}"/><text class="eq-f" x="${X(i)}" y="${H - 10}" text-anchor="middle">${label(f)}</text><circle class="eq-dot" cx="${X(i)}" r="7" data-i="${i}" tabindex="0" role="slider" aria-label="${f} Hz" aria-valuemin="-12" aria-valuemax="12"/><rect class="eq-hit" data-i="${i}" x="${X(i) - cw / 2}" y="0" width="${cw}" height="${H - B + 8}"/>`;
  });
  host.innerHTML = s + '</svg>';
  const el2 = host.firstChild, line = el2.querySelector('.eq-line'), area = el2.querySelector('.eq-fill'), dots = [...el2.querySelectorAll('.eq-dot')];
  const update = () => {
    const pts = prefs.eq.map((g, i) => [X(i), Y(g)]);
    const P = [[L, pts[0][1]], ...pts, [W - R, pts[n - 1][1]]];
    const cl = y => Math.max(T, Math.min(H - B, y));
    let d = `M${P[0]}`;
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[k - 1] || P[k], p1 = P[k], p2 = P[k + 1], p3 = P[k + 2] || p2;
      d += `C${p1[0] + (p2[0] - p0[0]) / 6},${cl(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${cl(p2[1] - (p3[1] - p1[1]) / 6)} ${p2}`;
    }
    line.setAttribute('d', d);
    area.setAttribute('d', `${d}L${W - R},${H - B}L${L},${H - B}Z`);
    dots.forEach((c, i) => { c.setAttribute('cy', Y(prefs.eq[i])); c.setAttribute('aria-valuenow', prefs.eq[i]); });
    el2.classList.toggle('off', !prefs.eqOn);
  };
  const set = (i, g) => { prefs.eq[i] = Math.max(-12, Math.min(12, Math.round(g))); update(); onChange(i); };
  let drag = -1;
  const fromEvent = e => { const r = el2.getBoundingClientRect(); set(drag, 12 - ((e.clientY - r.top) / r.height * H - T) / (H - T - B) * 24); };
  el2.addEventListener('pointerdown', e => {
    const i = e.target.dataset?.i; if (i == null) return;
    drag = +i; el2.setPointerCapture(e.pointerId); dots[drag].classList.add('drag'); fromEvent(e); e.preventDefault();
  });
  el2.addEventListener('pointermove', e => { if (drag >= 0) fromEvent(e); });
  const end = () => { if (drag >= 0) dots[drag].classList.remove('drag'); drag = -1; };
  el2.addEventListener('pointerup', end); el2.addEventListener('pointercancel', end);
  el2.addEventListener('dblclick', e => { const i = e.target.dataset?.i; if (i != null) set(+i, 0); });
  el2.addEventListener('keydown', e => {
    const i = e.target.dataset?.i; if (i == null) return;
    const step = { ArrowUp: 1, ArrowDown: -1 }[e.key]; if (!step) return;
    e.preventDefault(); e.stopPropagation(); set(+i, prefs.eq[+i] + step);
  });
  update();
  return update;
}

// sleep timer
function setSleep(mode) {
  clearTimeout(state.sleepTimer); state.sleepMode = mode;
  if (+mode) state.sleepTimer = setTimeout(() => { audio.pause(); state.sleepMode = 'off'; toast('Sleep timer: playback paused'); const s = $('setSleep'); if (s) s.value = 'off'; }, mode * 60000);
}

// ---------------------------------------------------- now playing/lyrics
const lyricsCache = new Map();
let lyLines = [], lyActive = -1;
// On wide screens this is the right-hand panel: open, collapsed to a strip
// with an arrow, or expanded over the whole window ("full").
const wideMq = matchMedia('(min-width:1001px)');
const wide = () => wideMq.matches;
function openNp(full = false) {
  const np = $('np');
  np.classList.add('open'); np.classList.toggle('full', full === true && wide());
  np.setAttribute('aria-hidden', 'false');
  if (wide() && !prefs.panel) { prefs.panel = true; save('prefs', prefs); }
  showLyrics(); vizStart(); lyLoop();
}
function closeNp() {
  const np = $('np');
  if (np.classList.contains('full')) { np.classList.remove('full'); return; }  // back to the side panel
  np.classList.remove('open'); np.setAttribute('aria-hidden', 'true');
  np.style.removeProperty('--npw');  // a resized panel reopens at its normal size
  if (wide() && prefs.panel) { prefs.panel = false; save('prefs', prefs); }
}
// Drag the panel's left edge to make it wider or narrower (double-click: normal).
{
  const np = $('np'), grip = el('div', 'np-grip');
  grip.title = 'Drag to resize';
  np.append(grip);
  grip.onpointerdown = e => {
    if (e.button !== 0) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId); np.classList.add('resizing');
    const move = ev => np.style.setProperty('--npw', Math.max(260, Math.min(innerWidth - ev.clientX, innerWidth - 620)) + 'px');
    const up = () => { np.classList.remove('resizing'); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  };
  grip.ondblclick = () => np.style.removeProperty('--npw');
}
$('openNp').onclick = () => npOpen() && wide() ? $('np').classList.toggle('full') : openNp();
$('lyricsBtn').onclick = () => npOpen() ? closeNp() : openNp();
$('npRail').onclick = () => openNp();
$('npFull').onclick = () => $('np').classList.toggle('full');
wideMq.addEventListener('change', () => {
  $('np').classList.remove('full', 'open');
  if (wide() && prefs.panel) openNp();
});
$('closeNp').onclick = closeNp;
$('npMore').onclick = e => { const t = current(); if (t) trackMenu(t, e.currentTarget); };
$('lyRefetch').onclick = () => showLyrics(true);
$('lySave').onclick = () => {
  const t = current(), d = t && lyricsCache.get(tkey(t));
  if (!d || !d.lyrics) return toast('No lyrics to save');
  const a = el('a'); a.href = URL.createObjectURL(new Blob([d.lyrics], { type: 'text/plain' }));
  a.download = `${t.artist ? t.artist + ' - ' : ''}${t.title}.${d.state === 'synced' ? 'lrc' : 'txt'}`.replace(/[\\/:*?"<>|]/g, '_');
  a.click(); URL.revokeObjectURL(a.href);
};

async function showLyrics(refresh = false) {
  const t = current(), box = $('lyrics');
  if (!t) { box.className = 'lyrics'; box.replaceChildren(el('p', 'msg', 'Play something to see its lyrics.')); return; }
  const key = tkey(t);
  if (!refresh && state.lyricsFor === key) return;
  state.lyricsFor = key; lyLines = []; lyActive = -1; lyOffset = 0; paintOffset();
  box.className = 'lyrics'; box.replaceChildren(el('p', 'msg', 'Looking for lyrics…'));
  let d = !refresh && lyricsCache.get(key);
  if (!d) {
    const url = t.id ? `/api/tracks/${t.id}/lyrics${refresh ? '?refresh=1' : ''}`
      : `/api/lyrics/lookup?title=${encodeURIComponent(t.title)}&artist=${encodeURIComponent(t.artist || '')}&duration=${t.duration || 0}`;
    try { d = await api(url); lyricsCache.set(key, d); }
    catch (err) { if (state.lyricsFor === key) { state.lyricsFor = null; box.replaceChildren(el('p', 'msg', err.message)); } return; }
  }
  if (state.lyricsFor !== key) return;
  lyOffset = d.offset || 0;
  box.replaceChildren(); box.scrollTop = 0;
  if (!d.lyrics) {
    box.append(el('p', 'msg', 'No lyrics found for this track. If the title or artist looks wrong, fix it with ⋯ → Edit title / artist, then Re-fetch.'));
    return;
  }
  if (d.state === 'synced') {
    box.classList.add('synced');
    // LRC files may carry an [offset:ms] tag, several time stamps on one
    // line, and word-level <mm:ss.xx> stamps; handle all three.
    let tagOffset = 0;
    const rows = [];
    for (const line of d.lyrics.split('\n')) {
      const off = line.match(/^\[offset:\s*([+-]?\d+)\]/i);
      if (off) { tagOffset = -off[1] / 1000; continue; }
      const stamps = [...line.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
      if (!stamps.length) continue;
      const text = line.replace(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').replace(/\s+/g, ' ').trim();
      for (const m of stamps) rows.push({ time: m[1] * 60 + parseFloat(m[2].replace(':', '.')) + tagOffset, text });
    }
    rows.sort((a, b) => a.time - b.time);
    for (const r of rows) {
      const p = el('p', null, r.text || '♪');
      p.onclick = () => { audio.currentTime = Math.max(0, r.time + lyOffset); audio.play(); };
      box.append(p); lyLines.push({ time: r.time, p });
    }
    paintOffset();
    syncLyrics(audio.currentTime); lyLoop();
  } else {
    box.classList.add('plain');
    for (const line of d.lyrics.split('\n')) box.append(el('p', null, line || ' '));
  }
}
let lyOffset = 0, lyRaf = 0, lyOffTimer;
function syncLyrics(t) {
  if (!lyLines.length || !npOpen()) return;
  let i = -1;
  for (let k = 0; k < lyLines.length && lyLines[k].time + lyOffset <= t + 0.1; k++) i = k;
  if (i === lyActive) return;
  if (lyActive >= 0 && lyLines[lyActive]) lyLines[lyActive].p.classList.remove('on');
  lyActive = i;
  if (i < 0) return;
  const p = lyLines[i].p, box = $('lyrics');
  p.classList.add('on');
  // Scroll only the lyrics box (scrollIntoView would also move the whole sheet).
  box.scrollTo({ top: p.offsetTop - box.clientHeight / 2 + p.offsetHeight / 2, behavior: 'smooth' });
}
// timeupdate only fires a few times a second; follow the song every frame instead.
function lyLoop() {
  if (lyRaf) return;
  const step = () => {
    lyRaf = 0;
    if (!npOpen() || audio.paused || !lyLines.length) return;
    syncLyrics(audio.currentTime);
    lyRaf = requestAnimationFrame(step);
  };
  lyRaf = requestAnimationFrame(step);
}
function paintOffset() {
  $('lySync').hidden = !lyLines.length;
  $('lyOff').textContent = (lyOffset > 0 ? '+' : '') + lyOffset.toFixed(1) + 's';
}
function nudgeLyrics(d) {
  const t = current(); if (!t) return;
  lyOffset = Math.max(-30, Math.min(30, Math.round((lyOffset + d) * 10) / 10));
  paintOffset(); syncLyrics(audio.currentTime);
  const c = lyricsCache.get(tkey(t)); if (c) c.offset = lyOffset;
  if (t.id) { clearTimeout(lyOffTimer); lyOffTimer = setTimeout(() => api(`/api/tracks/${t.id}/lyrics`, { method: 'PUT', body: { offset: lyOffset } }).catch(() => {}), 500); }
}
$('lyEarlier').onclick = () => nudgeLyrics(-0.5);
$('lyLater').onclick = () => nudgeLyrics(0.5);
$('lyUpload').onclick = () => { if (!current()) return toast('Play a song first'); $('lyFile').click(); };
$('lyFile').onchange = async () => {
  const f = $('lyFile').files[0], t = current(); $('lyFile').value = '';
  if (!f || !t) return;
  if (f.size > 500000) return toast('That file is too large to be lyrics', 'error');
  try {
    const text = (await f.text()).replace(/\r\n/g, '\n').trim();
    const d = t.id ? await api(`/api/tracks/${t.id}/lyrics`, { method: 'PUT', body: { lyrics: text } })
      : { state: /^\[\d+:\d+/m.test(text) ? 'synced' : 'plain', lyrics: text, offset: 0 };
    lyricsCache.set(tkey(t), d); state.lyricsFor = null; showLyrics();
    toast(d.state === 'synced' ? 'Synced lyrics added' : 'Lyrics added (no time stamps, so they will not scroll)');
  } catch (e) { toast(e.message, 'error'); }
};

// -------------------------------------------------------------- settings
const bytes = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : (n / 1e6).toFixed(1) + ' MB';
const sw = id => `<span class="switch"><input type="checkbox" id="${id}"><i></i></span>`;
const SET_CATS = [
  ['appearance', 'Appearance', 'palette', 'How the player looks on this device.'],
  ['playback', 'Playback', 'play', 'How music plays on this device.'],
  ['equaliser', 'Equaliser', 'tune', 'Shape the sound. Saved on this device.'],
  ['downloads', 'Downloads', 'download', 'What gets saved to the server from YouTube and Spotify.'],
  ['lyrics', 'Lyrics', 'lyrics', 'Where lyrics come from.'],
  ['accounts', 'Accounts & security', 'lock', 'Spotify access and the password lock.'],
  ['library', 'Library', 'music', 'What is stored on the server.'],
];
function openSettings(cat) {
  if (cat) state.setCat = cat;
  $('settings').hidden = false;
  renderSettings();
}
function closeSettings() { $('settings').hidden = true; }
$('setBtn').onclick = () => openSettings();
$('setClose').onclick = closeSettings;
$('settings').onclick = e => { if (e.target === $('settings')) closeSettings(); };
function showSetCat(cat) {
  state.setCat = cat;
  const info = SET_CATS.find(c => c[0] === cat);
  $$('#setNav button').forEach(b => b.classList.toggle('sel', b.dataset.cat === cat));
  $$('#setPane [data-cat]').forEach(b => { b.hidden = b.dataset.cat !== cat; });
  $('catTitle').textContent = info[1]; $('catSub').textContent = info[3];
  $('setPane').scrollTop = 0;
}
async function renderSettings() {
  const pane = $('setPane'), nav = $('setNav');
  pane.replaceChildren(); nav.replaceChildren();
  for (const [id, label, icon] of SET_CATS) {
    const b = el('button'); b.dataset.cat = id; b.innerHTML = svg(icon); b.append(el('span', null, label));
    b.onclick = () => showSetCat(id); nav.append(b);
  }
  const wrap = el('div', 'set');
  wrap.innerHTML = `
  <div><h2 class="cat-title" id="catTitle"></h2><p class="cat-sub" id="catSub"></p></div>
  <div class="box" data-cat="appearance"><h3>Theme</h3>
    <div class="field"><div><b>Mode</b></div><div class="seg" id="setTheme"><button data-v="dark">Dark</button><button data-v="light">Light</button><button data-v="amoled">Black</button></div></div>
    <div class="field"><div><b>Accent colour</b></div><div class="swatches" id="setAccent"></div></div>
  </div>
  <div class="box" data-cat="appearance"><h3>Layout &amp; effects</h3>
    <div class="field"><div><b>Colours follow the cover</b><small>The whole player takes its colours from the song that is playing</small></div>${sw('setCover')}</div>
    <div class="field"><div><b>Animated background</b><small>Slow drifting colour glow</small></div>${sw('setAnim')}</div>
    <div class="field"><div><b>Compact rows</b><small>Fit more tracks on screen</small></div>${sw('setCompact')}</div>
    <div class="field"><div><b>Visualizer</b><small>Sound effect shown for audio in Now Playing</small></div><div class="seg" id="setViz"><button data-v="bars">Bars</button><button data-v="circle">Ring</button><button data-v="wave">Wave</button><button data-v="off">Off</button></div></div>
  </div>
  <div class="box" data-cat="playback"><h3>Listening</h3>
    <div class="field"><div><b>Speed</b><small id="spdLbl"></small></div><input type="range" id="setSpeed" min="0.5" max="2" step="0.05"></div>
    <div class="field"><div><b>Crossfade</b><small id="xfLbl"></small></div><input type="range" id="setXfade" min="0" max="12" step="1"></div>
    <div class="field"><div><b>Even loudness</b><small>Quiet and loud songs play at the same level</small></div>${sw('setLoud')}</div>
    <div class="field"><div><b>Sleep timer</b><small>Pause playback automatically</small></div><select id="setSleep"><option value="off">Off</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="end">End of this track</option></select></div>
  </div>
  <div class="box" data-cat="playback"><h3>Keyboard &amp; mouse</h3>
    <div class="field"><div><small><kbd>Space</kbd> play/pause · <kbd>←</kbd> <kbd>→</kbd> seek 5s · <kbd>N</kbd> next · <kbd>P</kbd> previous · <kbd>L</kbd> lyrics · <kbd>Q</kbd> queue · <kbd>/</kbd> search · right-click a track for its menu · drag across the list to select, <kbd>Ctrl</kbd>/<kbd>Shift</kbd>-click to add, <kbd>Ctrl</kbd>+<kbd>A</kbd> for all · drag tracks onto a folder to put them there</small></div></div>
  </div>
  <div class="box" data-cat="equaliser"><h3>10-band equaliser</h3>
    <div class="field"><div><b>Enable equaliser</b><small id="eqRead">Drag the points up or down · double-tap a point to reset it</small></div>${sw('eqOn')}</div>
    <div class="eq-bar"><select id="eqPreset" aria-label="Preset"></select><button class="chip" id="eqReset">Reset</button></div>
    <div id="eqBox" class="eq-box"></div>
  </div>
  <div class="box" data-cat="downloads"><h3>YouTube</h3>
    <div class="field"><div><b>Downloads</b><small>Always saved with the video when there is one (sound only otherwise), so you can switch any time</small></div></div>
    <div class="field"><div><b>Playing a search result</b><small>What a tap does before the song is downloaded</small></div><select id="setYt"><option value="ask">Ask every time</option><option value="audio">Listen (audio)</option><option value="video">Watch (video)</option></select></div>
    <div class="field"><div><b>Audio format</b><small>Applies to new downloads</small></div><select id="setFormat"><option value="best">Best — YouTube's top stream, untouched</option><option value="m4a">M4A / AAC — plays everywhere</option><option value="mp3">MP3 — most compatible, larger</option><option value="opus">Opus — smallest, newer devices</option></select></div>
  </div>
  <div class="box" data-cat="downloads"><h3>Maintenance</h3>
    <div class="field"><div><b>Retry failed downloads</b><small id="failLbl"></small></div><button class="btn ghost" id="retryAll">Retry</button></div>
    <div class="field"><div><b>Upgrade old songs</b><small>Downloads again every song that was saved below the best quality. A song is unavailable for the few seconds it is being replaced; if its download fails, the old file is kept.</small></div><button class="btn ghost" id="upAll">Upgrade</button></div>
  </div>
  <div class="box" data-cat="downloads"><h3>Song names</h3>
    <div class="field"><div><b>Tidy names of new downloads</b><small>Drops clutter such as “(Official Video)”, “| lyrics” and #tags from YouTube titles, and reads “Artist - Title”. Version notes like (Remix) or (Slowed) stay.</small></div>${sw('setClean')}</div>
    <div class="field"><div><b>Songs already in the library</b><small>Tidy them the same way, or put back the names they were downloaded with</small></div><button class="btn ghost" id="restoreNames">Restore originals</button><button class="btn ghost" id="cleanAll">Tidy now</button></div>
    <div class="field"><div><b>Clean up</b><small>Find duplicates, failed downloads and what uses the disk</small></div><button class="btn ghost" id="openCleanup">Open</button></div>
  </div>
  <div class="box" data-cat="lyrics"><h3>Automatic lyrics</h3>
    <div class="field"><div><b>Download lyrics automatically</b><small>Looks up each new track on LRCLIB</small></div>${sw('setAutoLy')}</div>
    <div class="field"><div><b>Fetch missing lyrics</b><small>For tracks already in the library</small></div><button class="btn ghost" id="lyAll">Fetch now</button></div>
  </div>
  <div class="box" data-cat="lyrics"><h3>Your own lyrics</h3>
    <div class="field"><div><small>Open a song's Now Playing screen and press <b style="display:inline">Upload</b> to use a .lrc or .txt file from this device. If lyrics run early or late, the − and + buttons there shift them; the shift is remembered per song.</small></div></div>
  </div>
  <div class="box" data-cat="accounts"><h3>Spotify</h3>
    <div class="field"><div><b>API credentials (optional)</b><small>Only needed for playlists over 100 tracks. Create an app at developer.spotify.com/dashboard.</small></div></div>
    <div class="field"><div><label for="spId">Client ID</label></div><input type="text" id="spId" autocomplete="off"></div>
    <div class="field"><div><label for="spSecret">Client secret</label></div><input type="password" id="spSecret" autocomplete="new-password"></div>
    <div class="field"><div></div><button class="btn" id="spSave">Save</button></div>
  </div>
  <div class="box" data-cat="accounts"><h3>Password lock</h3>
    <div class="field"><div><b>Status</b><small id="pwState">Checking…</small></div></div>
    <div class="field"><div><label for="pwNew">New password</label><small>At least 4 characters. Other devices are signed out when it changes.</small></div><input type="password" id="pwNew" autocomplete="new-password"></div>
    <div class="field"><div></div><button class="btn ghost" id="pwRemove" hidden>Remove password</button><button class="btn ghost" id="logout" hidden>Log out</button><button class="btn" id="pwSave">Save password</button></div>
  </div>
  <div class="box" data-cat="library"><h3>Storage</h3><div class="stats" id="stats"></div></div>
  <div class="box" data-cat="library"><h3>Watched folder</h3>
    <div class="field"><div><b>Add files by copying them</b><small id="impLbl">Checking…</small></div><button class="btn ghost" id="impScan" disabled>Scan now</button></div>
  </div>`;
  pane.append(wrap);
  showSetCat(state.setCat || 'appearance');

  // appearance
  const seg = $('setTheme');
  const paintSeg = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === prefs.theme));
  seg.onclick = e => { const v = e.target.dataset.v; if (!v) return; prefs.theme = v; applyPrefs(); paintSeg(); };
  paintSeg();
  const sws = $('setAccent');
  const paintSw = () => sws.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.c === prefs.accent));
  for (const [c, c2] of ACCENTS) { const b = el('button'); b.dataset.c = c; b.style.background = `linear-gradient(135deg,${c},${c2})`; b.title = c; b.onclick = () => { prefs.accent = c; applyPrefs(); paintSw(); }; sws.append(b); }
  const custom = el('input'); custom.type = 'color'; custom.value = prefs.accent; custom.title = 'Custom colour';
  custom.oninput = () => { prefs.accent = custom.value; applyPrefs(); paintSw(); };
  sws.append(custom); paintSw();
  const bind = (id, key) => { const c = $(id); c.checked = prefs[key]; c.onchange = () => { prefs[key] = c.checked; applyPrefs(); }; };
  bind('setAnim', 'anim'); bind('setCompact', 'compact'); bind('setCover', 'coverTheme');
  const vz = $('setViz');
  const paintVz = () => vz.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === prefs.viz));
  vz.onclick = e => { const v = e.target.dataset.v; if (!v) return; prefs.viz = v; applyPrefs(); paintVz(); vizStart(); };
  paintVz();
  $('setYt').value = prefs.ytMode; $('setYt').onchange = e => { prefs.ytMode = e.target.value; applyPrefs(); };

  // playback
  const spd = $('setSpeed'); spd.value = prefs.speed;
  const spdLbl = () => { $('spdLbl').textContent = (+spd.value).toFixed(2) + '×'; fill(spd); };
  spd.oninput = () => { prefs.speed = +spd.value; applyPrefs(); spdLbl(); }; spdLbl();
  const xf = $('setXfade'); xf.value = prefs.xfade;
  const xfLbl = () => { $('xfLbl').textContent = +xf.value ? `Songs blend into each other for ${xf.value} seconds` : 'Off: each song ends before the next starts'; fill(xf); };
  xf.oninput = () => { prefs.xfade = +xf.value; save('prefs', prefs); xfLbl(); }; xfLbl();
  $('setLoud').checked = prefs.loud; $('setLoud').onchange = e => { prefs.loud = e.target.checked; save('prefs', prefs); applyNorm(); };
  const preset = $('eqPreset');
  for (const name of [...Object.keys(EQ_PRESETS), 'Custom']) preset.append(new Option(name, name));
  const eqCommit = () => { preset.value = prefs.eqPreset; $('eqOn').checked = prefs.eqOn; ensureEq(); applyPrefs(); };
  const eqDraw = buildEq($('eqBox'), i => {
    prefs.eqPreset = 'Custom'; prefs.eqOn = true; eqCommit(); eqDraw();
    const f = EQ_F[i], g = prefs.eq[i];
    $('eqRead').textContent = `${f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'}  ${g > 0 ? '+' : ''}${g} dB`;
  });
  const usePreset = name => { prefs.eq = EQ_PRESETS[name].slice(); prefs.eqPreset = name; eqCommit(); eqDraw(); };
  preset.onchange = () => { if (EQ_PRESETS[preset.value]) { prefs.eqOn = true; usePreset(preset.value); } };
  $('eqReset').onclick = () => usePreset('Flat');
  $('eqOn').onchange = e => { prefs.eqOn = e.target.checked; eqCommit(); eqDraw(); };
  eqCommit();
  $('setSleep').value = state.sleepMode;
  $('setSleep').onchange = e => { setSleep(e.target.value); if (e.target.value !== 'off') toast('Sleep timer set'); };

  // server settings
  let s;
  try { s = await api('/api/settings'); } catch (err) { return toast(err.message, 'error'); }
  if ($('settings').hidden) return;
  const put = body => api('/api/settings', { method: 'PUT', body }).then(() => toast('Saved')).catch(e => toast(e.message, 'error'));
  $('setFormat').value = s.format; $('setFormat').onchange = e => put({ format: e.target.value });
  $('setAutoLy').checked = s.auto_lyrics; $('setAutoLy').onchange = e => put({ auto_lyrics: e.target.checked });
  $('spId').value = s.spotify_client_id || '';
  $('spSecret').placeholder = s.spotify_secret_set ? '•••••••• (saved)' : '';
  $('spSave').onclick = () => { const body = { spotify_client_id: $('spId').value }; if ($('spSecret').value) body.spotify_client_secret = $('spSecret').value; put(body); $('spSecret').value = ''; };
  const pwUi = on => { $('pwState').textContent = on ? 'On — a password is required to open this library.' : 'Off — anyone on your network can open this library.'; $('pwRemove').hidden = $('logout').hidden = !on; };
  pwUi(s.password_set);
  const setPw = async password => {
    try { const r = await api('/api/password', { method: 'PUT', body: { password } }); $('pwNew').value = ''; pwUi(r.password_set); toast(r.password_set ? 'Password saved' : 'Password removed'); }
    catch (e) { toast(e.message, 'error'); }
  };
  $('pwSave').onclick = () => { const v = $('pwNew').value; if (v.length < 4) return toast('Password must be at least 4 characters', 'error'); setPw(v); };
  $('pwRemove').onclick = async () => { if (await confirmBox('Remove the password?', 'Anyone on your network will be able to open this library.', 'Remove')) setPw(''); };
  $('logout').onclick = async () => { await post('/api/logout'); location.reload(); };
  $('failLbl').textContent = `${s.stats.failed} failed track${s.stats.failed === 1 ? '' : 's'}`;
  $('setClean').checked = s.clean_names; $('setClean').onchange = e => put({ clean_names: e.target.checked });
  const after = () => { state.tracksKey = ''; lyricsCache.clear(); if (isList(state.view)) reload(true); };
  $('upAll').onclick = async () => { try { await post('/api/upgrade'); state.wasPending = true; toast('Checking which songs can be upgraded…'); } catch (e) { toast(e.message, 'error'); } };
  $('cleanAll').onclick = async () => { try { const r = await post('/api/clean-names'); toast(r.count ? `Tidied ${r.count} name(s)` : 'Every name is already tidy'); after(); } catch (e) { toast(e.message, 'error'); } };
  $('openCleanup').onclick = () => { closeSettings(); go({ type: 'cleanup' }); };
  $('restoreNames').onclick = async () => { try { const r = await post('/api/restore-names'); toast(r.count ? `Restored ${r.count} name(s)` : 'Nothing to restore'); after(); } catch (e) { toast(e.message, 'error'); } };
  $('retryAll').onclick = async () => { const r = await post('/api/retry-failed'); state.wasPending = true; toast(`Retrying ${r.count} track(s)`); };
  $('lyAll').onclick = async () => { const r = await post('/api/lyrics/all'); toast(r.count ? `Looking up lyrics for ${r.count} track(s) in the background` : 'Every track has already been checked'); };
  $('impLbl').textContent = s.import_dir
    ? 'Music and video files put in the “import” folder next to docker-compose.yml join the library within a minute, marked Local. A sub-folder becomes a folder here. Your files are never moved or deleted.'
    : 'Not set up on this server (the “import” folder is not mounted).';
  $('impScan').disabled = !s.import_dir;
  $('impScan').onclick = async () => {
    try { const r = await post('/api/import/scan'); toast(r.count ? `Added ${r.count} file(s)` : 'Nothing new in the watched folder'); state.tracksKey = ''; if (isList(state.view)) reload(true); }
    catch (e) { toast(e.message, 'error'); }
  };
  const st = $('stats');
  for (const [v, l] of [[s.stats.tracks, 'Tracks'], [s.stats.folders, 'Folders'], [s.stats.lyrics, 'With lyrics'], [bytes(s.stats.bytes), 'Storage used']]) { const d = el('div'); d.append(el('b', null, v), el('small', null, l)); st.append(d); }
}

// ----------------------------------------------------------------- login
function showLogin() {
  if (!$('login').hidden) return;
  audio.pause(); $('login').hidden = false; $('loginPw').focus();
}
$('loginForm').onsubmit = async e => {
  e.preventDefault(); $('loginErr').textContent = '';
  try { await post('/api/login', { password: $('loginPw').value }); location.reload(); }
  catch (err) { $('loginErr').textContent = err.message; $('loginPw').select(); }
};

// ------------------------------------------------------------ navigation
$$('.side .nav[data-view], .tabs button').forEach(b => { b.onclick = () => b.dataset.view === 'settings' ? openSettings() : go({ type: b.dataset.view }); });
$('newFolder').onclick = newFolder;

// ------------------------------------------------------------------ poll
let firstPoll = true;
async function poll() {
  try {
    const s = await api('/api/status');
    for (const ev of s.events) if (ev.id > state.lastEvent) { state.lastEvent = ev.id; if (!firstPoll) toast(ev.msg, ev.level); }
    state.downloads = (s.downloads || []).filter(d => !gone.has(d.id));
    paintDownloads();
    const before = (state.ai || []).length;
    state.ai = s.ai || []; paintAi();
    if (state.ai.length < before && state.studioRefresh) state.studioRefresh();  // a studio job finished
    if (s.pending || state.wasPending) await reload();
    state.wasPending = s.pending > 0;
  } catch {}
  firstPoll = false;
  setTimeout(poll, state.wasPending ? 1000 : 2500);  // faster while something downloads
}

// --------------------------------------------------------- phone gestures
// Swipe the mini player up to open the full player and sideways to change
// song; swipe the full player down to close it, sideways on the cover to skip.
function onSwipe(target, fn) {
  let start = null;
  target.addEventListener('touchstart', e => { start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, el: e.target } : null; }, { passive: true });
  target.addEventListener('touchend', e => {
    if (!start) return;
    const p = e.changedTouches[0], s = start;
    start = null;
    fn(p.clientX - s.x, p.clientY - s.y, s.el);
  }, { passive: true });
}
onSwipe($('player'), (dx, dy, from) => {
  if (wide() || from.closest('input')) return;
  if (dy < -40 && Math.abs(dy) > Math.abs(dx)) openNp();
  else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && current()) dx < 0 ? next() : prev();
});
onSwipe($('np'), (dx, dy, from) => {
  if (wide() || !npOpen() || from.closest('input, .lyrics, .ly-head')) return;
  if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5 && $('np').querySelector('.np-body').scrollTop < 5) closeNp();
  else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && from.closest('.art-wrap')) dx < 0 ? next() : prev();
});

// Effect buttons: a row in the Now Playing panel and a pop-up on the bar.
fxChips($('npFx'));
{
  const pop = el('div', 'fx-pop'); pop.hidden = true;
  pop.append(el('b', null, 'Effects')); const row = el('div'); fxChips(row); pop.append(row);
  document.body.append(pop);
  $('fxBtn').onclick = e => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    if (pop.hidden) return;
    const r = $('fxBtn').getBoundingClientRect();
    pop.style.bottom = innerHeight - r.top + 12 + 'px';
    pop.style.right = Math.max(8, innerWidth - r.right - 60) + 'px';
  };
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !$('fxBtn').contains(e.target)) pop.hidden = true; }, true);
  paintFx();
}

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
function maybeCrossfade(t, d) {
  const x = prefs.xfade, cur = current();
  if (!x || xfading || !cur || !cur.id || cur.noFade || !d || d < x * 4 || audio.paused || audio.seeking || state.sleepMode === 'end') return;
  const left = (d - t) / (audio.playbackRate || 1);
  if (left > x + 8) return;
  if (tailFor !== cur) {  // get the helper player ready a few seconds early
    tailFor = cur; tail.muted = true; tail.src = srcOf(cur); tail.currentTime = Math.max(0, d - x - 1);
    return;
  }
  if (left > x || left < 0.4) return;
  const i = pickNext(true);
  if (i < 0 || i === state.index) return;
  xfading = true;
  const level = audio.volume * Math.min(1, normGain()), secs = Math.min(x, left);
  let switched = false;
  const swap = () => {
    if (switched) return;
    switched = true;
    tail.volume = level; fadeMul = 0; applyVol();
    playIndex(i);
    const t0 = performance.now();
    clearInterval(xTimer);
    xTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / (secs * 1000));
      fadeMul = Math.sin(p * Math.PI / 2); applyVol();
      tail.volume = level * Math.cos(p * Math.PI / 2);
      if (p >= 1 || tail.ended) stopTail();
    }, 40);
  };
  tail.playbackRate = audio.playbackRate; tail.preservesPitch = audio.preservesPitch;
  tail.currentTime = audio.currentTime; tail.muted = false; tail.volume = 0;
  tail.addEventListener('playing', swap, { once: true });
  tail.play().then(() => setTimeout(swap, 700), () => { switched = true; xfading = false; cur.noFade = true; });
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
        if (!await confirmBox('Delete from library?', `“${t.title}” and its files are removed.`, 'Delete')) return;
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
    try { all = await api('/api/tracks'); } catch { return; }
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
}
async function useProfile(id, quiet) {
  profile.id = id; save('profile', id); paintProfile();
  state.tracksKey = ''; state.search = null;
  await loadPlaylists();
  await go({ type: 'home' });
  if (!quiet) toast(`Now listening as ${profileName()}`);
}
$('profBtn').onclick = e => {
  const items = profile.list.map(p => ({ icon: p.id === profile.id ? 'check' : 'person', label: p.name, fn: () => { if (p.id !== profile.id) useProfile(p.id); } }));
  items.push({ icon: 'plus', label: 'Add a profile…', fn: async () => {
    const r = await dialog({ title: 'New profile', text: 'A profile has its own likes, history and folders. Everyone shares the same songs.', fields: [{ label: 'Name', placeholder: 'For example: Sara' }], ok: 'Create' });
    if (!r || !r[0]) return;
    try { const p = await post('/api/profiles', { name: r[0] }); await loadProfiles(); useProfile(p.id); } catch (err) { toast(err.message, 'error'); }
  } });
  items.push({ icon: 'edit', label: `Rename “${profileName()}”`, fn: async () => {
    const r = await dialog({ title: 'Rename profile', fields: [{ label: 'Name', value: profileName() }] });
    if (!r || !r[0]) return;
    try { await api('/api/profiles/' + profile.id, { method: 'PATCH', body: { name: r[0] } }); await loadProfiles(); } catch (err) { toast(err.message, 'error'); }
  } });
  if (profile.id !== 1) items.push({ icon: 'trash', label: `Delete “${profileName()}”`, danger: true, fn: async () => {
    if (!await confirmBox('Delete this profile?', `“${profileName()}” loses its likes, history and folders. The songs stay in the library.`, 'Delete')) return;
    try { await api('/api/profiles/' + profile.id, { method: 'DELETE' }); profile.id = 1; await loadProfiles(); useProfile(1); } catch (err) { toast(err.message, 'error'); }
  } });
  openMenu(e.currentTarget, items, 'Who is listening?');
};

// ------------------------------------------------------------------ init
applyPrefs();
navBtns().forEach(b => { b.oncontextmenu = e => { e.preventDefault(); navMenu(b, at(e)); }; });
$('navMore').onclick = e => moreMenu(e.currentTarget);
$('navMore').oncontextmenu = e => { e.preventDefault(); navDialog(); };
document.querySelector('.side .logo').oncontextmenu = e => { e.preventDefault(); navDialog(); };
applyNav();
history.replaceState(null, '');  // a reload starts a fresh trail of pages
$('backBtn').onclick = () => history.back();
$('fwdBtn').onclick = () => history.forward();
$$('input[type=range]').forEach(fill);
if (wide() && prefs.panel) openNp();
(async () => {
  try { const a = await api('/api/auth'); if (a.required && !a.authed) return showLogin(); } catch {}
  await loadProfiles();
  await go({ type: 'home' });
  try { localStorage.removeItem('last'); } catch {}  // nothing is remembered between visits
  wsConnect();
  poll();
})();
