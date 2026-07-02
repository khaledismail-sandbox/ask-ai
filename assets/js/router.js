/* Minimal client-side router using the History API — real paths, no query strings,
   no hash routing. Works out of the box on GitHub Pages project sites
   (https://user.github.io/repo/...) by auto-detecting the base path. */
(function () {
  var ROUTES = ['/', '/signup', '/login', '/chat', '/trial', '/upgrade', '/upgrade-v2'];
  var listener = null;

  function detectBase(pathname) {
    var named = ROUTES.filter(function (r) { return r !== '/'; })
      .sort(function (a, b) { return b.length - a.length; });

    for (var i = 0; i < named.length; i++) {
      var r = named[i];
      if (pathname === r) return '';
      if (pathname.length > r.length && pathname.slice(-r.length) === r) {
        return pathname.slice(0, pathname.length - r.length);
      }
    }
    if (pathname.charAt(pathname.length - 1) === '/') return pathname.slice(0, -1);
    return '';
  }

  var BASE = detectBase(window.location.pathname);

  function currentRoute() {
    var p = window.location.pathname;
    if (BASE && p.indexOf(BASE) === 0) p = p.slice(BASE.length);
    if (p === '') p = '/';
    if (ROUTES.indexOf(p) === -1) p = '/';
    return p;
  }

  function navigate(route, opts) {
    opts = opts || {};
    var full = (BASE + route) || '/';
    try {
      if (opts.replace) history.replaceState({ route: route }, '', full);
      else history.pushState({ route: route }, '', full);
    } catch (e) {
      /* Opened via file:// or a sandboxed origin — pushState is blocked there.
         Fall back to in-memory routing only; the address bar just won't update. */
    }
    if (listener) listener(route);
  }

  window.addEventListener('popstate', function () {
    if (listener) listener(currentRoute());
  });

  window.Router = {
    ROUTES: ROUTES,
    base: BASE,
    current: currentRoute,
    navigate: navigate,
    onRoute: function (fn) { listener = fn; }
  };
})();
