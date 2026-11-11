(function () {
  const gallery = document.querySelector(".v4v-gallery");
  if (!gallery) return;

  const overlay = document.createElement("div");
  overlay.className = "v4v-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Photo viewer");
  overlay.innerHTML = '<button type="button" class="v4v-lightbox-close" aria-label="Close">&times;</button><img alt="">';
  document.body.appendChild(overlay);

  const img = overlay.querySelector("img");
  const closeBtn = overlay.querySelector(".v4v-lightbox-close");

  function open(src, alt) {
    img.src = src;
    img.alt = alt || "";
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }
  function close() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    img.removeAttribute("src");
  }

  gallery.addEventListener("click", function (e) {
    const link = e.target.closest("a[data-full]");
    if (!link) return;
    e.preventDefault();
    const thumb = link.querySelector("img");
    open(link.getAttribute("data-full"), thumb ? thumb.getAttribute("alt") : "");
  });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target === closeBtn) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });
})();
