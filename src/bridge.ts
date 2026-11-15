// Sayfa yüklenmeden önce enjekte edilen kod.
// 1. aşama: Android'de "aşağı çekip yenile" hareketi (iOS bunu kendi desteğiyle yapar).
// 2. aşamada Reels gizleme motoru buraya eklenecek.
export const BRIDGE_SCRIPT = `
(function () {
  if (window.__reelssiz) return;
  window.__reelssiz = true;

  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!isIOS) {
    var startY = null;
    var pulled = 0;
    var THRESHOLD = 220;

    function atTop(target) {
      if ((window.scrollY || document.documentElement.scrollTop) > 0) return false;
      // Parmağın altındaki kaydırılabilir bir kutu (mesaj listesi vb.) en üstte değilse sayma.
      for (var el = target; el && el !== document.body; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
      }
      return true;
    }

    document.addEventListener('touchstart', function (e) {
      startY = e.touches.length === 1 && atTop(e.target) ? e.touches[0].clientY : null;
      pulled = 0;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      pulled = e.touches[0].clientY - startY;
      if (pulled < 0) startY = null;
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (startY !== null && pulled > THRESHOLD && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('refresh');
      }
      startY = null;
    }, { passive: true });
  }
})();
true;
`;
