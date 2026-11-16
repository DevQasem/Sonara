'use strict';
// Sonara player, part: playback, now playing and lyrics, settings, sign-in, polling, phone gestures
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
  paintTags(t); paintHide(t);
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
  if (document.body.classList.contains('karaoke')) karaokeSong(t);
}
function paintMode(t) {
  const mode = modeOf(t), video = mode === 'video';
  document.body.classList.toggle('is-video', video);
  $('fsBtn').hidden = !video;
  $('avTabs').hidden = !canVideo(t) || !!t.stem;  // a vocals-only or music-only half has no picture
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
document.addEventListener('fullscreenchange', () => { audio.controls = document.fullscreenElement === audio; });
// Clicks on the cover or the video. Double-click (or double-tap) the left
// third to go back 10 seconds and the right third to go forward 10; keep
// tapping to keep skipping. The middle: one click plays or pauses a video,
// two make it full screen.
const SKIP = 10;
{
  const wrap = $('artWrap');
  let last = 0, lastSide = 0, timer = 0, total = 0;
  const tip = side => {
    wrap.querySelector('.skip-tip')?.remove();
    const d = el('div', 'skip-tip ' + (side < 0 ? 'left' : 'right'), (side < 0 ? '« ' : '') + Math.abs(total) + ' seconds' + (side > 0 ? ' »' : ''));
    wrap.append(d);
    setTimeout(() => d.remove(), 700);
  };
  wrap.addEventListener('click', e => {
    if (!current() || e.target.closest('button')) return;
    const full = document.fullscreenElement === audio, r = (full ? audio : wrap).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, side = x < 0.35 ? -1 : x > 0.65 ? 1 : 0, now = performance.now();
    const again = now - last < 350 && side === lastSide;
    last = now; lastSide = side;
    clearTimeout(timer);
    if (again && side) {
      const d = isFinite(audio.duration) ? audio.duration : 0, to = Math.max(0, Math.min(d ? d - 0.5 : Infinity, audio.currentTime + side * SKIP));
      total = (Math.sign(total) === side ? total : 0) + side * SKIP;
      audio.currentTime = to; tip(side);
      return;
    }
    total = 0;
    if (again) { last = 0; if (showingVideo()) $('fsBtn').onclick(); return; }
    // a single click on the video plays or pauses, once it is clear no second one follows
    if (e.target === audio && !full) timer = setTimeout(toggle, 360);
  });
}
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
function ensureEq(force) {
  const wantEq = prefs.eqOn && prefs.eq.some(g => g), wantViz = prefs.viz !== 'off' && npOpen() && !!current();
  if (actx || !(force || wantEq || wantViz || remixOn() || prefs.volume > 1 || normGain() !== 1)) return;
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
    fx = { bass, wet, depth, boost, norm, pan, verb };
    if (remixOn()) applyRemix();
    applyEq();
    if (!audio.paused) actx.resume();
  } catch { actx = null; }
}
// The echo of the reverb lasts a few seconds. After a jump to another time (or
// another song) that echo would still be of the old place and mix with the
// new one, so the reverb is swapped for a fresh, silent one.
function flushReverb() {
  if (!fx || !fx.verb) return;
  const fresh = actx.createConvolver();
  fresh.buffer = fx.verb.buffer;
  try { fx.pan.disconnect(fx.verb); fx.verb.disconnect(); } catch {}
  fx.pan.connect(fresh); fresh.connect(fx.wet);
  fx.verb = fresh;
}
// (the jump to the first beat that Auto DJ itself makes right after a switch does not count)
audio.addEventListener('seeking', () => { flushReverb(); if (xfading && performance.now() - xSwapAt > 1500) stopTail(); });
// iPhone, video mode: if a jump lands before the spot that was asked for, stay
// silent until the song reaches it, instead of playing the part before.
if (IOS) {
  let want = null, since = 0;
  const release = () => { if (want !== null) { want = null; audio.muted = false; } };
  audio.addEventListener('seeking', () => { want = audio.currentTime; since = performance.now(); });
  audio.addEventListener('seeked', () => { if (want !== null && audio.currentTime < want - 0.3) audio.muted = true; else release(); });
  audio.addEventListener('timeupdate', () => { if (want !== null && (audio.currentTime >= want - 0.05 || performance.now() - since > 9000)) release(); });
  audio.addEventListener('emptied', release);
}
audio.addEventListener('emptied', flushReverb);
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
  if (document.body.classList.contains('karaoke')) toggleKaraoke(false);
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
    if (t.id) { const b = el('button', 'btn ghost', 'Write them from the sound (AI)'), w = el('p', 'msg'); b.onclick = e => aiLyrics(t, e.currentTarget); w.append(b); box.append(w); }
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
      addTr(p, r.text, d);
      const idx = lyLines.length;
      p.onclick = () => {
        // light the clicked line up at once and keep it lit until the song gets there
        const to = Math.max(0, r.time + lyOffset);
        lyHold = { i: idx, until: performance.now() + 2000 };
        audio.currentTime = to; audio.play();
        syncLyrics(to);
      };
      box.append(p); lyLines.push({ time: r.time, p });
    }
    paintOffset();
    syncLyrics(audio.currentTime); lyLoop();
  } else {
    box.classList.add('plain');
    for (const line of d.lyrics.split('\n')) { const p = el('p', null, line || '\u00a0'); addTr(p, line.replace(/\[[^\]]*\]/g, ''), d); box.append(p); }
  }
}
let lyOffset = 0, lyRaf = 0, lyOffTimer, lyHold = null;
function syncLyrics(t) {
  if (!lyLines.length || !npOpen()) return;
  let i = -1;
  for (let k = 0; k < lyLines.length && lyLines[k].time + lyOffset <= t + 0.1; k++) i = k;
  if (lyHold) { if (performance.now() > lyHold.until || i >= lyHold.i || !lyLines[lyHold.i]) lyHold = null; else i = lyHold.i; }
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
    <div class="field"><div><b>Mode</b></div><div class="seg" id="setTheme"><button data-v="dark">Dark</button><button data-v="light">Light</button><button data-v="amoled">Black</button><button data-v="retro">Retro</button><button data-v="neon">Neon</button><button data-v="ocean">Ocean</button></div></div>
    <div class="field"><div><b>Background picture</b><small>Your own picture behind the player, kept in this browser</small></div><button class="btn ghost" id="wallPick">Choose…</button><button class="btn ghost" id="wallClear">Remove</button></div>
    <div class="field"><div><b>Picture brightness</b><small>How strongly the picture shows through</small></div><input type="range" id="wallDim" min="0.15" max="0.85" step="0.05"></div>
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
    <div class="field"><div><b>Auto DJ</b><small>Songs with a similar tempo are matched to the beat and mixed, like a DJ. Needs the AI tags (Settings → Library).</small></div>${sw('setDj')}</div>
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
    <div class="field"><div><b>Activity and recycle bin</b><small>What was added and deleted, and deleted songs to put back (kept 30 days)</small></div><button class="btn ghost" id="openActivity">Open</button></div>
    <div class="field"><div><b>AI tags</b><small>The AI listens to each song and notes its genre, mood, tempo and language. Used by the tag filter above lists and by Auto DJ.</small></div><button class="btn ghost" id="tagScan">Tag my songs</button></div>
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
  $('wallPick').onclick = pickWall;
  $('wallClear').onclick = () => { try { localStorage.removeItem('wall'); } catch {} applyWall(); };
  const wd = $('wallDim'); wd.value = 1 - (prefs.wallDim ?? 0.55); fill(wd);
  wd.oninput = () => { prefs.wallDim = Math.round((1 - wd.value) * 100) / 100; save('prefs', prefs); applyWall(); fill(wd); };
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
  $('setDj').checked = !!prefs.autoDj; $('setDj').onchange = e => { prefs.autoDj = e.target.checked; save('prefs', prefs); };
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
  $('openActivity').onclick = () => { closeSettings(); go({ type: 'activity' }); };
  $('tagScan').onclick = async () => { try { const r = await post('/api/tags/scan'); state.wasPending = true; toast(r.count ? `The AI is listening to ${r.count} song${r.count === 1 ? '' : 's'}. Tags appear as it goes.` : 'Every song is tagged already'); } catch (e) { toast(e.message, 'error', 9000); } };
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
    if (state.stemPoll) stemCheck();
    if (state.ai.length < before) { state.tracksKey = ''; lyricsCache.clear(); state.lyricsFor = null; if (npOpen()) showLyrics(); if (state.studioRefresh) state.studioRefresh(); }  // a studio job finished
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

