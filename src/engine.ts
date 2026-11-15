import type { Rules, Settings } from './rules';

// Sayfanın içinde çalışan gizleme motoru. window.__RZ_CONFIG içindeki kuralları uygular.
// Not: Bu kod uygulamanın değil web sayfasının içinde çalıştığı için düz metin olarak tutulur.
const ENGINE = String.raw`
(function () {
  if (window.__rzEngine) return;
  window.__rzEngine = true;

  var cfg = window.__RZ_CONFIG || {};
  var R = cfg.rules;
  var S = cfg.settings || {};
  if (!R) return;

  var HIDE = 'data-rz-hidden';

  function compile(list) {
    var out = [];
    (list || []).forEach(function (src) {
      try { out.push(new RegExp(src)); } catch (e) {}
    });
    return out;
  }
  function matchesAny(list, path) {
    for (var i = 0; i < list.length; i++) if (list[i].test(path)) return true;
    return false;
  }
  function all(selector, root) {
    if (!selector) return [];
    try { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
    catch (e) { return []; }
  }

  var blocked = compile(R.blockedPaths);
  var feedPaths = compile(R.feedPaths);
  var reelRe = null;
  try { reelRe = new RegExp(R.reelPath); } catch (e) {}

  function reelId(path) {
    var m = reelRe && path ? reelRe.exec(path) : null;
    return m ? m[1] : null;
  }

  // ---------- Sayfa yolu takibi ----------
  var lastPath = null;
  var lockedId = null;
  var lockedUrl = null;
  var FIX_KEY = '__rzLastFix';

  function goHome() { location.replace(R.home || '/'); }

  function onRoute() {
    var path = location.pathname;
    if (path === lastPath) return;
    var prev = lastPath;
    lastPath = path;

    if (S.blockReelsFeed && matchesAny(blocked, path)) { goHome(); return; }

    var id = reelId(path);
    if (!id) { lockedId = null; lockedUrl = null; schedule(); return; }

    if (S.lockReelScroll) {
      if (lockedId === null || reelId(prev) === null) {
        // Reels olmayan bir sayfadan (mesaj, profil vb.) tek bir videoya girildi: onu kilitle.
        lockedId = id;
        lockedUrl = path;
      } else if (id !== lockedId) {
        // Kaydırma engeline rağmen sonraki videoya geçildi: ilk videoya geri dön.
        var now = Date.now();
        var last = 0;
        try { last = Number(sessionStorage.getItem(FIX_KEY)) || 0; } catch (e) {}
        try { sessionStorage.setItem(FIX_KEY, String(now)); } catch (e) {}
        if (now - last > 4000) location.replace(lockedUrl);
        else goHome();
        return;
      }
    }
    schedule();
  }

  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    if (typeof orig !== 'function') return;
    history[name] = function () {
      var result = orig.apply(this, arguments);
      setTimeout(onRoute, 0);
      return result;
    };
  });
  window.addEventListener('popstate', function () { setTimeout(onRoute, 0); });
  setInterval(onRoute, 500);

  // ---------- Tek videoda kaydırma kilidi ----------
  function scrollAllowed(target) {
    if (!lockedId || !S.lockReelScroll) return true;
    try {
      return !!(target && target.closest && R.reelScrollAllow && target.closest(R.reelScrollAllow));
    } catch (e) { return false; }
  }
  document.addEventListener('touchmove', function (e) {
    if (scrollAllowed(e.target)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }, { capture: true, passive: false });
  document.addEventListener('wheel', function (e) {
    if (scrollAllowed(e.target)) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }, { capture: true, passive: false });
  document.addEventListener('keydown', function (e) {
    if (scrollAllowed(e.target)) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].indexOf(e.key) !== -1) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ---------- Öğe gizleme ----------
  function ensureStyle() {
    if (document.getElementById('rz-style')) return;
    var parent = document.head || document.documentElement;
    if (!parent) return;
    var style = document.createElement('style');
    style.id = 'rz-style';
    style.textContent = '[' + HIDE + ']{display:none!important}' + (R.css || '');
    parent.appendChild(style);
  }

  // Menü bağlantısının çevresindeki tek çocuklu sarmalayıcıları da gizle ki boşluk kalmasın.
  function navTarget(el) {
    var top = el;
    while (top.parentElement && top.parentElement !== document.body &&
           top.parentElement.children.length === 1) {
      top = top.parentElement;
    }
    return top;
  }

  // Gönderi olmayan bir Reels bloğu (ör. "önerilen Reels" şeridi): gönderilerle
  // kardeş olan en üst kapsayıcıyı bul.
  function stripTarget(link) {
    var el = link;
    for (var depth = 0; depth < 14 && el.parentElement; depth++) {
      var parent = el.parentElement;
      var kids = parent.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k === el) continue;
        if (k.matches(R.postSelector) || k.querySelector(R.postSelector)) {
          return el.querySelector(R.postSelector) ? null : el;
        }
      }
      el = parent;
    }
    return null;
  }

  function isSuggested(post) {
    var buttons = all('button, [role="button"]', post);
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      if (text && R.suggestedTexts.indexOf(text) !== -1) return true;
    }
    return false;
  }

  function pass() {
    pending = false;
    ensureStyle();
    var keep = [];

    if (S.hideReelsTab) {
      (R.navHide || []).forEach(function (sel) {
        all(sel).forEach(function (el) { keep.push(navTarget(el)); });
      });
    }

    if (matchesAny(feedPaths, location.pathname)) {
      if (S.hideFeedReels) {
        var navLinks = [];
        (R.navHide || []).forEach(function (sel) { navLinks = navLinks.concat(all(sel)); });
        all(R.feedReelLink).forEach(function (link) {
          // Menüdeki Reels bağlantısı akış içeriği değildir; yoksa bütün menü gizlenir.
          if (navLinks.indexOf(link) !== -1) return;
          var post = null;
          try { post = link.closest(R.postSelector); } catch (e) {}
          var target = post || stripTarget(link);
          if (target) keep.push(target);
        });
      }
      if (S.hideSuggested && R.suggestedTexts && R.suggestedTexts.length) {
        all(R.postSelector).forEach(function (post) {
          if (isSuggested(post)) keep.push(post);
        });
      }
    }

    // Instagram aynı öğeyi başka içerikle yeniden kullanabildiği için her seferinde
    // artık kurala uymayanları tekrar görünür yap.
    all('[' + HIDE + ']').forEach(function (el) {
      if (keep.indexOf(el) === -1) el.removeAttribute(HIDE);
    });
    keep.forEach(function (el) {
      if (!el.hasAttribute(HIDE)) el.setAttribute(HIDE, '');
    });
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(pass, 60);
  }

  new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', schedule);
  onRoute();
  schedule();
})();
true;
`;

export function buildEngineScript(rules: Rules, settings: Settings): string {
  const config = JSON.stringify({ rules, settings }).replace(/</g, '\\u003c');
  return `window.__RZ_CONFIG=${config};\n${ENGINE}`;
}
