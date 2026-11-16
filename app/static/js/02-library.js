'use strict';
// Sonara player, part: likes, selecting and dragging songs, lists and folders
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
const NAV_ICON = { albums: 'album', home: 'home', search: 'search', library: 'music', liked: 'heart', recent: 'history', top: 'trending', folders: 'folder', remix: 'tune' };
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
  state.view = view; state.filter = ''; state.tag = ''; state.tracksKey = '';
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
  else if (view.type === 'albums') await renderAlbums();
  else if (view.type === 'activity') await renderActivity();
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
  const L = v.type === 'artist' ? { kind: 'Artist', title: v.name, icon: 'person' } : v.type === 'album' ? { kind: 'Album', title: v.name, icon: 'album' } : LISTS[v.type];
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
  const tg = el('select'); tg.id = 'tagSel'; tg.title = 'Show only songs with this AI tag'; tg.hidden = true;
  tg.onchange = () => { state.tag = tg.value; drawTracks(); };
  tools.append(f, s, tg);
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
  let data = await api('/api/tracks' + (v.type === 'playlist' ? '?playlist=' + v.id : v.type === 'artist' || v.type === 'album' ? '' : LISTS[v.type].q || ''));
  if (v.type === 'album') data = data.filter(t => (t.album || '').toLowerCase() === v.name.toLowerCase());
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
  fillTags();
  if (state.tag) list = list.filter(t => tagList(t).includes(state.tag));
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
    ...folderPictureItems(p, redraw),
    { icon: 'trash', label: 'Delete folder (keeps songs)', danger: true, fn: async () => {
      if (!await confirmBox('Delete folder?', `“${p.name}” is removed. Its songs stay in the library.`, 'Delete')) return;
      let r;
      try { r = await api(`/api/playlists/${p.id}`, { method: 'DELETE' }); } catch (e) { return toast(e.message, 'error'); }
      undoToast(`Deleted the folder “${p.name}”`, r.trash);
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
    const t = el('div', 'tile'); t.style.background = grad(p.name); t.innerHTML = svg(p.source === 'folder' ? 'folder' : 'music'); folderTile(t, p);
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
function cardDrag(e, c, grid, sel = ".card[data-id]", col = false, done = null) {
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
    if (done) { plDrag = false; return done(); }  // a list that is not the folders
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

