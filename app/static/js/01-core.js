// Sonara player. The script is split into parts that are loaded in order
// (see index.html); they share one scope, so a later part can use what an
// earlier one defines.
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
  album: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z',
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  eyeOff: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
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
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// On an iPhone the sound-only mode is the default (exact jumps); Video is one tap away.
if (IOS && !prefs.iosAudio) { prefs.avMode = 'audio'; prefs.iosAudio = 1; }
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
  applyWall();
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
  img.src = !t.cover && !t.nocover && !t.ccover && t.video_id ? `/api/thumb/${t.video_id}` : url;
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
// Slowed and Sped up come in five strengths (3 is the classic amount).
const SLOW = [0.95, 0.9, 0.85, 0.8, 0.7], FAST = [1.05, 1.1, 1.2, 1.3, 1.5];
const FX = [
  ['Slowed', () => remix.speed < 1, () => { remix.speed = remix.speed < 1 ? 1 : SLOW[(prefs.slowLv || 3) - 1]; }],
  ['Sped up', () => remix.speed > 1, () => { remix.speed = remix.speed > 1 ? 1 : FAST[(prefs.fastLv || 3) - 1]; }],
  ['Reverb', () => remix.reverb > 0, () => { remix.reverb = remix.reverb ? 0 : 0.5; }],
  ['Bass', () => remix.bass > 0, () => { remix.bass = remix.bass ? 0 : 8; }],
  ['8D', () => remix.pan, () => { remix.pan = !remix.pan; }],
];
// "No vocals" plays the song's music without the singing, "Vocals only" the
// singing without the music: the same song, at the same spot.
const STEMS = [['No vocals', 'music', 'Take the singing out of this song'], ['Vocals only', 'vocals', 'Take the music out and keep only the singing']];
function fxChips(box) {
  box.classList.add('fx-chips');
  const changed = () => { remixNamed = false; applyRemix(); if (state.view.type === 'remix' && paintRemix) paintRemix(); };
  for (const [label, on, flip] of FX) {
    const b = el('button', 'chip', label); b.type = 'button'; b._on = on;
    b.onclick = e => { e.stopPropagation(); flip(); changed(); };
    box.append(b);
  }
  for (const [label, kind, tip] of STEMS) {
    const b = el('button', 'chip stem', label); b.type = 'button'; b.title = tip;
    b._on = () => current()?.stem === kind; b._wait = () => current()?.stemWant === kind;
    b.onclick = e => { e.stopPropagation(); setStem(kind); };
    box.append(b);
  }
  const off = el('button', 'chip fx-off', 'Off'); off.type = 'button'; off.title = 'Back to the original sound';
  off.onclick = e => { e.stopPropagation(); const t = current(); if (t && (t.stem || t.stemWant)) { t.stemWant = null; if (t.stem) swapStem(t, null); } resetRemix(); };
  box.append(off);
  // strength of Slowed / Sped up, shown while one of them is on
  const lv = el('div', 'fx-level'); lv.append(el('span'));
  for (let n = 1; n <= 5; n++) {
    const b = el('button', 'lv', n); b.type = 'button';
    b.onclick = e => {
      e.stopPropagation();
      if (remix.speed < 1) { prefs.slowLv = n; remix.speed = SLOW[n - 1]; } else if (remix.speed > 1) { prefs.fastLv = n; remix.speed = FAST[n - 1]; }
      save('prefs', prefs); changed();
    };
    lv.append(b);
  }
  box.append(lv);
}
const fxOn = () => remixOn() || !!(current() && (current().stem || current().stemWant));
function paintFx() {
  document.querySelectorAll('.fx-chips .chip').forEach(b => {
    if (b._on) { b.classList.toggle('sel', b._on()); b.classList.toggle('wait', !!(b._wait && b._wait())); }
    else b.hidden = !fxOn();
  });
  document.querySelectorAll('.fx-level').forEach(l => {
    const on = remix.speed !== 1, list = remix.speed < 1 ? SLOW : FAST;
    l.hidden = !on;
    if (!on) return;
    let k = 0; list.forEach((v, i) => { if (Math.abs(v - remix.speed) < Math.abs(list[k] - remix.speed)) k = i; });
    l.firstChild.textContent = (remix.speed < 1 ? 'Slowed' : 'Sped up') + ' strength';
    [...l.querySelectorAll('.lv')].forEach((b, i) => b.classList.toggle('sel', i === k));
  });
  document.getElementById('fxBtn')?.classList.toggle('on', fxOn());
}
// Switch the playing song to one of its halves (or back) without losing the place.
function swapStem(t, kind) {
  const here = current() === t, time = audio.currentTime, playing = !audio.paused;
  t.stem = kind; t.stemWant = null;
  if (!here) return;
  audio.src = srcOf(t); applyRemix(); applyNorm();
  audio.addEventListener('loadedmetadata', () => { audio.currentTime = time; }, { once: true });
  if (playing) audio.play().catch(() => {});
  paintMode(t); paintFx();
}
async function setStem(kind, quiet) {
  const t = current();
  if (!t) return toast('Play a song first');
  if (!t.id) return toast('Download this song first: only songs in your library can be split');
  if (t.stem === kind || t.stemWant === kind) { t.stemWant = null; if (t.stem) swapStem(t, null); else paintFx(); return; }
  let r;
  try { r = await post(`/api/tracks/${t.id}/stems`); } catch (e) { return toast(e.message, 'error', 9000); }
  if (r.ready) return swapStem(t, kind);
  t.stemWant = kind; state.stemPoll = true; paintFx();
  if (!quiet) toast(`Separating the vocals and the music of “${t.title}”. It switches by itself in about a minute; after that it is instant for this song.`, 'info', 9000);
}
// Called while a split is being made: switch as soon as it is ready.
async function stemCheck() {
  const t = current();
  if (!t || !t.stemWant) { state.stemPoll = !!state.queue.find(x => x.stemWant); return; }
  try { if ((await api(`/api/tracks/${t.id}/stems`)).ready) swapStem(t, t.stemWant); } catch {}
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
const canVideo = t => !t.nocover && (!t.id || t.kind === 'video');
const modeOf = t => !canVideo(t) || t.stem ? 'audio' : t.id ? prefs.avMode : (t.kind === 'video' ? 'video' : 'audio');
// The video file carries the sound too, so one source serves both modes and
// switching between them never reloads (a stream moves to its video source
// the first time video is asked for, then stays on it).
// iPhones and iPads jump inexactly in the video files (they land on the
// picture's last keyframe, seconds early), so in audio mode they play an AAC
// copy of the sound instead, in which every jump is exact.
const srcOf = t => t.id && t.stem ? `/media/${t.id}?stem=${t.stem}` : t.id ? (IOS && modeOf(t) !== 'video' ? `/media/${t.id}?fmt=aac` : `/media/${t.id}${t.vfile ? '?v=1' : ''}`)
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
const isList = v => v.type === 'playlist' || v.type === 'artist' || v.type === 'album' || v.type in LISTS;
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
const coverUrl = t => t.nocover ? placeholder(t) : t.ccover ? `/api/tracks/${t.id}/cover?v=${t.ccover}` : t.cover ? t.cover : t.video_id ?`https://i.ytimg.com/vi/${t.video_id}/mqdefault.jpg` : t.source === 'upload' || t.source === 'remix' ? `/api/cover/${t.id}` : placeholder(t);
function setImg(img, t) { img.onerror = () => { img.onerror = null; img.src = placeholder(t); }; img.src = coverUrl(t); }
function fill(r) { const max = +r.max || 1, min = +r.min || 0; r.style.setProperty('--p', ((r.value - min) / (max - min) * 100) + '%'); }

// The profile in use on this browser; sent with every request.
const profile = { id: load('profile', 1), list: [] };
async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), 'X-Profile': profile.id, 'X-Profile-Key': load('profileKeys', {})[profile.id] || '' };
  if (opts.body && !(opts.body instanceof Blob)) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
  const r = await fetch(path, opts);
  if (r.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Login required'); }
  if (r.status === 423 && !path.startsWith('/api/profiles')) { profileLocked(); throw new Error('This profile is locked with a PIN'); }
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
      inp.type = f.type || 'text'; if (f.mode) inp.inputMode = f.mode; inp.value = f.value || ''; inp.placeholder = f.placeholder || ''; inp.autocomplete = 'off';
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
    if (profile.list.length > 1 && !document.body.classList.contains('kid')) items.push({ icon: 'person', label: 'Copy to another profile…', fn: a => shareTo([t], a) });
    items.push({ icon: t.liked ? 'heart' : 'heartLine', label: t.liked ? 'Remove from Liked' : 'Like', fn: () => toggleLike(t) });
    items.push({ icon: 'lyrics', label: 'Show lyrics', fn: () => { if (!current() || current().id !== t.id) playFrom(t.id); openNp(); } });
    items.push({ icon: 'lyrics', label: 'Write lyrics from the sound (AI)', fn: a => aiLyrics(t, a) });
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
  items.push(...pictureItems(t));
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
  if (!await confirmBox('Delete from library?', `“${t.title}” goes to the recycle bin and can be put back for 30 days.`, 'Delete')) return;
  gone.add(t.id);
  dropFromList(t.id);
  dropFromPlayer(t.id);
  lyricsCache.delete(t.id);
  if (load('last', {})?.id === t.id) save('last', null);
  try { const r = await api(`/api/tracks/${t.id}`, { method: 'DELETE' }); undoToast(`Deleted “${t.title}”`, r.trash); }
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
  if (!await confirmBox(`Delete ${list.length} tracks?`, 'They go to the recycle bin and can be put back for 30 days.', 'Delete')) return;
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
  if (lib.length && profile.list.length > 1 && !document.body.classList.contains('kid')) items.push({ icon: 'person', label: 'Copy to another profile…', fn: a => shareTo(lib, a) });
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

