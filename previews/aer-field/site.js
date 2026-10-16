(function () {
  const menuButton = document.querySelector(".menu-toggle"),
    menu = document.querySelector(".primary-nav");
  if (menuButton && menu) {
    const label = menuButton.querySelector(".menu-button-label");
    function setMenu(open) {
      menu.classList.toggle("is-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      if (label)
        label.textContent = open
          ? menuButton.dataset.closeLabel
          : menuButton.dataset.openLabel;
    }
    menuButton.addEventListener("click", () => {
      const open = !menu.classList.contains("is-open");
      setMenu(open);
      if (open) menu.querySelector("a")?.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setMenu(false);
        menuButton.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (
        menu.classList.contains("is-open") &&
        !menu.contains(e.target) &&
        !menuButton.contains(e.target)
      )
        setMenu(false);
    });
  }
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)"),
    data = window.matchMedia("(prefers-reduced-data: reduce)"),
    mobile = window.matchMedia("(max-width: 700px)");
  const hero = document.querySelector(".hero-video"),
    toggle = document.querySelector("[data-video-toggle]");
  let userPaused = false;
  function syncButton() {
    if (!toggle || !hero) return;
    let paused = hero.paused || !hero.classList.contains("is-playing");
    toggle.setAttribute(
      "aria-label",
      paused ? toggle.dataset.playLabel : toggle.dataset.pauseLabel,
    );
    toggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
  }
  function heroSource() {
    return mobile.matches
      ? hero.dataset.mobileSrc || hero.dataset.src
      : hero.dataset.src;
  }
  async function playHero(manual = false) {
    if (!hero || (!manual && motion.matches) || !heroSource()) return;
    if (
      !manual &&
      (userPaused || data.matches || mobile.matches || document.hidden)
    )
      return;
    if (hero.src !== new URL(heroSource(), location.href).href)
      hero.src = heroSource();
    try {
      await hero.play();
      hero.classList.add("is-playing");
    } catch (e) {
      hero.classList.remove("is-playing");
    }
    syncButton();
  }
  function stopHero() {
    if (!hero) return;
    hero.pause();
    hero.classList.remove("is-playing");
    syncButton();
  }
  if (hero) {
    playHero();
    syncButton();
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stopHero() : playHero(),
    );
    motion.addEventListener("change", () =>
      motion.matches ? stopHero() : playHero(),
    );
    data.addEventListener("change", () =>
      data.matches ? stopHero() : playHero(),
    );
    mobile.addEventListener("change", () => {
      stopHero();
      hero.removeAttribute("src");
      hero.load();
      userPaused = false;
      playHero();
    });
  }
  if (toggle && hero)
    toggle.addEventListener("click", () => {
      if (!hero.paused) {
        userPaused = true;
        stopHero();
      } else {
        userPaused = false;
        playHero(true);
      }
    });
  const servicesVideo = document.querySelector(".services-video"),
    servicesToggle = document.querySelector("[data-services-video-toggle]");
  let servicesPaused = false;
  function syncServices() {
    if (!servicesToggle || !servicesVideo) return;
    const paused =
      servicesVideo.paused || !servicesVideo.classList.contains("is-playing");
    servicesToggle.setAttribute(
      "aria-label",
      paused
        ? servicesToggle.dataset.playLabel
        : servicesToggle.dataset.pauseLabel,
    );
    servicesToggle.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
  }
  function stopServices() {
    if (!servicesVideo) return;
    servicesVideo.pause();
    servicesVideo.classList.remove("is-playing");
    syncServices();
  }
  async function playServices(manual = false) {
    if (
      !servicesVideo ||
      (!manual && motion.matches) ||
      !servicesVideo.dataset.src
    )
      return;
    if (
      !manual &&
      (servicesPaused || data.matches || mobile.matches || document.hidden)
    )
      return;
    if (!servicesVideo.src) servicesVideo.src = servicesVideo.dataset.src;
    try {
      await servicesVideo.play();
      servicesVideo.classList.add("is-playing");
    } catch (e) {
      servicesVideo.classList.remove("is-playing");
    }
    syncServices();
  }
  if (servicesVideo) {
    playServices();
    syncServices();
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stopServices() : playServices(),
    );
    motion.addEventListener("change", () =>
      motion.matches ? stopServices() : playServices(),
    );
    data.addEventListener("change", () =>
      data.matches ? stopServices() : playServices(),
    );
    mobile.addEventListener("change", () => {
      stopServices();
      if (mobile.matches) {
        servicesVideo.removeAttribute("src");
        servicesVideo.load();
      }
      servicesPaused = false;
      playServices();
    });
  }
  if (servicesToggle && servicesVideo)
    servicesToggle.addEventListener("click", () => {
      if (!servicesVideo.paused) {
        servicesPaused = true;
        stopServices();
      } else {
        servicesPaused = false;
        playServices(true);
      }
    });
  const reels = document.querySelectorAll(".film-video[data-src]");
  if (
    reels.length &&
    !motion.matches &&
    !data.matches &&
    !mobile.matches &&
    "IntersectionObserver" in window
  ) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(async (entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            if (!video.src) video.src = video.dataset.src;
            try {
              await video.play();
              video.classList.add("is-playing");
            } catch (e) {
              video.classList.remove("is-playing");
            }
          } else {
            video.pause();
            video.classList.remove("is-playing");
          }
        }),
      { rootMargin: "100px 0px" },
    );
    reels.forEach((v) => observer.observe(v));
  }
})();
