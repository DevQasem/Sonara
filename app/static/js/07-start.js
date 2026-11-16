'use strict';
// Sonara player, part: everything is defined: start the app
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
