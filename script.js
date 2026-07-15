document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const doc = document.documentElement; // use root for CSS var overrides
  const menuButton = document.getElementById("menu-toggle");
  const overlay = document.getElementById("overlay");
  const brandLogo = document.getElementById("brand-logo");
  const themeBtn = document.getElementById("theme-toggle");
  const siteHeader = document.querySelector(".site-header");

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const LS_KEY = "theme"; // 'auto' | 'dark' | 'light'

  function getStoredTheme() {
    return localStorage.getItem(LS_KEY) || "auto";
  }

  function setStoredTheme(val) {
    localStorage.setItem(LS_KEY, val);
  }

  function applyTheme() {
    const pref = getStoredTheme();
    doc.classList.remove("theme-dark", "theme-light");
    if (pref === "dark") doc.classList.add("theme-dark");
    if (pref === "light") doc.classList.add("theme-light");

    // Set chip label
    const label =
      pref === "auto" ? "Auto" : pref[0].toUpperCase() + pref.slice(1);
    themeBtn.dataset.state = pref;
    themeBtn.setAttribute("aria-label", `Theme: ${label}`);
    themeBtn.title = `Theme: ${label} (click to change)`;
    themeBtn.querySelector(".chip__text").textContent = label;

    // Decide effective theme for logo (override wins, else system)
    const effectiveDark = pref === "dark" || (pref === "auto" && media.matches);
    brandLogo.src = effectiveDark
      ? "assets/logos/JJI-Logo-Only-white.png"
      : "assets/logos/JJI-Logo-Only-grey.png";
  }

  // Cycle Auto -> Dark -> Light -> Auto
  themeBtn.addEventListener("click", () => {
    const current = getStoredTheme();
    const next =
      current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
    setStoredTheme(next);
    applyTheme();
  });

  // React to OS changes only when Auto
  media.addEventListener("change", () => {
    if (getStoredTheme() === "auto") applyTheme();
  });

  // Menu toggle
  const focusableSelector =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const closeMenu = (restoreFocus = true) => {
    overlay.classList.remove("active");
    overlay.hidden = true;
    overlay.inert = true;
    menuButton.classList.remove("active");
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    if (restoreFocus) menuButton.focus();
  };

  menuButton.addEventListener("click", () => {
    const active = overlay.classList.toggle("active");
    overlay.hidden = !active;
    overlay.inert = !active;
    menuButton.classList.toggle("active", active);
    document.body.classList.toggle("menu-open", active);
    menuButton.setAttribute("aria-expanded", String(active));
    menuButton.setAttribute("aria-label", active ? "Close menu" : "Open menu");
    if (active) {
      const firstMenuLink = overlay.querySelector("a");
      window.setTimeout(() => {
        if (overlay.classList.contains("active")) {
          firstMenuLink?.focus({ preventScroll: true });
        }
      }, 100);
    }
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) {
      closeMenu();
      return;
    }

    if (e.key === "Tab" && overlay.classList.contains("active")) {
      const focusables = Array.from(
        overlay.querySelectorAll(focusableSelector),
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  const mobileMenuMedia = window.matchMedia("(max-width: 900px)");
  mobileMenuMedia.addEventListener("change", (event) => {
    if (!event.matches && overlay.classList.contains("active")) {
      closeMenu(false);
    }
  });

  // Keep the desktop and mobile homepage navigation on one shared location.
  const homepageNavLinks = document.body.classList.contains("page-home")
    ? Array.from(
        document.querySelectorAll(
          '.nav-links a[href^="#"], .overlay-menu a[href^="#"]',
        ),
      )
    : [];
  const homepageDestinations = [];

  homepageNavLinks.forEach((link) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    const section = document.getElementById(hash.slice(1));
    if (
      section &&
      !homepageDestinations.some((destination) => destination.hash === hash)
    ) {
      homepageDestinations.push({ hash, section });
    }
  });

  let activeSectionHash = "";
  let activeSectionObserver;
  let activeHeaderObserver;
  let activeSectionFrame = 0;
  let observerRefreshFrame = 0;
  let navigationTargetHash = "";
  let navigationTargetReleaseTimer = 0;
  let navigationTargetFallbackTimer = 0;

  const setActiveSection = (hash) => {
    if (
      !homepageDestinations.some((destination) => destination.hash === hash)
    ) {
      return;
    }
    const stateIsCurrent =
      activeSectionHash === hash &&
      homepageNavLinks.every((link) =>
        link.getAttribute("href") === hash
          ? link.getAttribute("aria-current") === "location"
          : !link.hasAttribute("aria-current"),
      );
    if (stateIsCurrent) return;

    homepageNavLinks.forEach((link) => {
      if (link.getAttribute("href") === hash) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    activeSectionHash = hash;
  };

  const getReadingLine = () =>
    Math.max(siteHeader?.getBoundingClientRect().bottom || 0, 0) + 16;

  const syncActiveSection = () => {
    activeSectionFrame = 0;
    if (!homepageDestinations.length) return;
    if (navigationTargetHash) {
      setActiveSection(navigationTargetHash);
      return;
    }

    const readingLine = getReadingLine();
    const positionedDestinations = homepageDestinations
      .map((destination) => ({
        ...destination,
        top: destination.section.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top);
    const pageBottom =
      Math.ceil(window.scrollY + window.innerHeight) >=
      document.documentElement.scrollHeight - 1;
    let activeDestination = positionedDestinations[0];

    if (pageBottom) {
      activeDestination = positionedDestinations.at(-1);
    } else {
      positionedDestinations.forEach((destination) => {
        if (destination.top <= readingLine + 1) {
          activeDestination = destination;
        }
      });
    }

    if (activeDestination.hash !== activeSectionHash) {
      setActiveSection(activeDestination.hash);
    }
  };

  const requestActiveSectionSync = () => {
    if (activeSectionFrame) return;
    activeSectionFrame = window.requestAnimationFrame(syncActiveSection);
  };

  const clearNavigationTarget = () => {
    navigationTargetHash = "";
    window.clearTimeout(navigationTargetReleaseTimer);
    window.clearTimeout(navigationTargetFallbackTimer);
    navigationTargetReleaseTimer = 0;
    navigationTargetFallbackTimer = 0;
  };

  const navigationTargetReached = () => {
    const destinationIndex = homepageDestinations.findIndex(
      ({ hash }) => hash === navigationTargetHash,
    );
    if (destinationIndex < 0) return false;
    const destination = homepageDestinations[destinationIndex];
    const nextDestination = homepageDestinations[destinationIndex + 1];
    const readingLine = getReadingLine();
    const isFinalDestination =
      destinationIndex === homepageDestinations.length - 1;
    const pageBottom =
      Math.ceil(window.scrollY + window.innerHeight) >=
      document.documentElement.scrollHeight - 1;

    return (
      (destination.section.getBoundingClientRect().top <= readingLine + 1 &&
        (!nextDestination ||
          nextDestination.section.getBoundingClientRect().top >
            readingLine + 1)) ||
      (isFinalDestination && pageBottom)
    );
  };

  const scheduleNavigationTargetRelease = (delay = 250) => {
    if (!navigationTargetHash) return;
    window.clearTimeout(navigationTargetReleaseTimer);
    navigationTargetReleaseTimer = window.setTimeout(() => {
      navigationTargetReleaseTimer = 0;
      if (!navigationTargetHash || !navigationTargetReached()) return;
      clearNavigationTarget();
      requestActiveSectionSync();
    }, delay);
  };

  const holdNavigationTarget = (hash) => {
    if (
      !homepageDestinations.some((destination) => destination.hash === hash)
    ) {
      return;
    }
    clearNavigationTarget();
    navigationTargetHash = hash;
    setActiveSection(hash);
    navigationTargetFallbackTimer = window.setTimeout(() => {
      clearNavigationTarget();
      requestActiveSectionSync();
    }, 10000);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scheduleNavigationTargetRelease(0);
    }
  };

  const rebuildActiveSectionObserver = () => {
    activeSectionObserver?.disconnect();
    if (!homepageDestinations.length || !("IntersectionObserver" in window)) {
      return;
    }

    const viewportHeight = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight,
    );
    const readingLine = Math.min(
      Math.max(Math.round(getReadingLine()), 0),
      Math.max(viewportHeight - 1, 0),
    );
    const bottomMargin = Math.max(viewportHeight - readingLine - 1, 0);
    activeSectionObserver = new IntersectionObserver(requestActiveSectionSync, {
      rootMargin: `-${readingLine}px 0px -${bottomMargin}px 0px`,
      threshold: 0,
    });
    homepageDestinations.forEach(({ section }) =>
      activeSectionObserver.observe(section),
    );
  };

  const refreshActiveSectionObserver = () => {
    if (observerRefreshFrame) return;
    observerRefreshFrame = window.requestAnimationFrame(() => {
      observerRefreshFrame = 0;
      rebuildActiveSectionObserver();
      requestActiveSectionSync();
    });
  };

  const syncActiveSectionFromHistory = () => {
    clearNavigationTarget();
    const destination = homepageDestinations.find(
      ({ hash }) => hash === window.location.hash,
    );
    if (destination) setActiveSection(destination.hash);
    requestActiveSectionSync();
  };

  if (homepageDestinations.length) {
    rebuildActiveSectionObserver();
    const initialDestination = homepageDestinations.find(
      ({ hash }) => hash === window.location.hash,
    );
    if (initialDestination) setActiveSection(initialDestination.hash);
    else syncActiveSection();

    window.addEventListener("hashchange", syncActiveSectionFromHistory);
    window.addEventListener("popstate", syncActiveSectionFromHistory);
    window.addEventListener("resize", refreshActiveSectionObserver);
    window.addEventListener("scrollend", () => {
      if (navigationTargetHash) scheduleNavigationTargetRelease();
    });
    ["wheel", "touchstart"].forEach((eventName) => {
      window.addEventListener(
        eventName,
        () => {
          if (!navigationTargetHash) return;
          clearNavigationTarget();
          requestActiveSectionSync();
        },
        { passive: true },
      );
    });
    document.addEventListener("keydown", (event) => {
      if (
        navigationTargetHash &&
        ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(
          event.key,
        )
      ) {
        clearNavigationTarget();
        requestActiveSectionSync();
      }
    });

    if ("ResizeObserver" in window && siteHeader) {
      activeHeaderObserver = new ResizeObserver(refreshActiveSectionObserver);
      activeHeaderObserver.observe(siteHeader);
    }

    window.addEventListener("scroll", requestActiveSectionSync, {
      passive: true,
    });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^=\"#\"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      if (a.classList.contains("skip-link")) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        if (overlay.classList.contains("active")) closeMenu();
        if (window.location.hash !== id) {
          window.history.pushState(null, "", id);
        }
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
        holdNavigationTarget(id);
      }
    });
  });

  // Intersection Observer reveal
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  // Year
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Initial
  if (!localStorage.getItem(LS_KEY)) setStoredTheme("auto");
  applyTheme();
});

// Form setup (Formspree AJAX + local accessibility helpers)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("form-status");
  const errorEl = document.getElementById("form-error");
  const inquiryTypeField = document.getElementById("inquiry-type");
  const loadedAtField = document.getElementById("form-loaded-at");
  if (!form || !statusEl) return;

  const formLoadedAt = Date.now();
  const MIN_SUBMIT_DELAY_MS = 3000;
  const touchedFields = new WeakSet();
  const resetFieldError = (field) => field.removeAttribute("aria-invalid");
  const markFieldError = (field) => field.setAttribute("aria-invalid", "true");

  // Ensure neutral status and neutral field state on initial load.
  statusEl.textContent = "";
  if (errorEl) errorEl.textContent = "";
  if (loadedAtField) loadedAtField.value = new Date(formLoadedAt).toISOString();
  form
    .querySelectorAll(
      "input[aria-invalid], select[aria-invalid], textarea[aria-invalid]",
    )
    .forEach((field) => resetFieldError(field));

  const setInquiryType = (value) => {
    if (!inquiryTypeField || !value) return;
    const optionValues = Array.from(inquiryTypeField.options).map(
      (opt) => opt.value,
    );
    if (optionValues.includes(value)) {
      inquiryTypeField.value = value;
      resetFieldError(inquiryTypeField);
    }
  };

  // Route government-buyer CTAs into a matching inquiry type.
  document
    .querySelectorAll(".gov-inquiry-link[data-inquiry-type]")
    .forEach((link) => {
      link.addEventListener("click", () => {
        setInquiryType(link.dataset.inquiryType);
      });
    });

  // Optional support for direct links like ?inquiry_type=RFQ/RFP#contact
  const url = new URL(window.location.href);
  const inquiryTypeParam = url.searchParams.get("inquiry_type");
  if (inquiryTypeParam) setInquiryType(inquiryTypeParam);

  // Keep field-level accessible invalid state without overriding submit behavior.
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      touchedFields.add(field);
      if (field.checkValidity()) resetFieldError(field);
      else if (touchedFields.has(field)) markFieldError(field);
    });
    field.addEventListener("blur", () => {
      touchedFields.add(field);
      if (!field.checkValidity()) markFieldError(field);
      else resetFieldError(field);
    });
  });

  // Lightweight anti-spam guard: block very fast submits.
  form.addEventListener(
    "submit",
    (event) => {
      const elapsed = Date.now() - formLoadedAt;
      if (elapsed >= MIN_SUBMIT_DELAY_MS) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (errorEl) {
        errorEl.textContent =
          "Submission failed. Please email info@justinjindustries.com or try again later.";
      }
      statusEl.textContent = "";
    },
    true,
  );

  // Do not override submit; Formspree AJAX handles submission.
  // Add diagnostics when Formspree writes to the form error area.
  if (errorEl) {
    const observer = new MutationObserver(() => {
      const message = errorEl.textContent?.trim();
      if (!message) return;
      console.warn("Formspree form error:", message);
      if (!message.includes("Please email info@justinjindustries.com")) {
        errorEl.textContent =
          "Submission failed. Please email info@justinjindustries.com or try again later.";
      }
    });
    observer.observe(errorEl, { childList: true, subtree: true });
  }
});
