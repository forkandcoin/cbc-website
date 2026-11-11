(function () {
  var nav = document.querySelector(".navbar.w-nav") || document.querySelector(".navbar");
  if (!nav) return;

  nav.classList.add("cbc-nav-auto-hide");

  var lastY = window.scrollY || 0;
  var hidden = false;
  var threshold = 8;
  var topShow = 16;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function menuOpen() {
    return !!(
      nav.querySelector(".w-nav-button.w--open") ||
      nav.querySelector(".w-nav-menu.w--open") ||
      nav.classList.contains("w--open")
    );
  }

  function setHidden(next) {
    if (next === hidden) return;
    hidden = next;
    nav.classList.toggle("is-hidden", hidden);
  }

  function onScroll() {
    var y = window.scrollY || 0;
    if (menuOpen() || y <= topShow) {
      setHidden(false);
      lastY = y;
      return;
    }
    // Still hide and show when the user prefers reduced motion,
    // but CSS turns off the slide animation.
    var delta = y - lastY;
    if (delta > threshold) setHidden(true);
    else if (delta < -threshold) setHidden(false);
    lastY = y;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  void reduce;
})();
