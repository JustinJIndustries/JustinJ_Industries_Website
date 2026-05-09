document.addEventListener("DOMContentLoaded", () => {
  const doc = document.documentElement; // use root for CSS var overrides
  const menuButton = document.getElementById("menu-toggle");
  const overlay = document.getElementById("overlay");
  const brandLogo = document.getElementById("brand-logo");
  const themeBtn = document.getElementById("theme-toggle");

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

  const closeMenu = () => {
    overlay.classList.remove("active");
    overlay.hidden = true;
    overlay.inert = true;
    menuButton.classList.remove("active");
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    menuButton.focus();
  };

  menuButton.addEventListener("click", () => {
    const active = overlay.classList.toggle("active");
    overlay.hidden = !active;
    overlay.inert = !active;
    menuButton.classList.toggle("active", active);
    document.body.classList.toggle("menu-open", active);
    menuButton.setAttribute("aria-expanded", String(active));
    menuButton.setAttribute("aria-label", active ? "Close menu" : "Open menu");
    if (active) overlay.querySelector("a")?.focus();
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

  // Smooth scroll
  document.querySelectorAll('a[href^=\"#\"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }
      if (overlay.classList.contains("active")) closeMenu();
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

// Form success/error logic
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("form-status");
  const inquiryTypeField = document.getElementById("inquiry-type");
  if (!form || !statusEl) return;

  const resetFieldError = (field) =>
    field.setAttribute("aria-invalid", "false");
  const markFieldError = (field) => field.setAttribute("aria-invalid", "true");

  const setStatus = (message, type) => {
    statusEl.textContent = message;
    statusEl.classList.remove("is-success", "is-error");
    if (type) statusEl.classList.add(type);
  };

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

  // Optional support for direct links like #contact?inquiry_type=RFQ/RFP
  const url = new URL(window.location.href);
  const inquiryTypeParam = url.searchParams.get("inquiry_type");
  if (inquiryTypeParam) setInquiryType(inquiryTypeParam);

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      if (field.checkValidity()) resetFieldError(field);
    });
    field.addEventListener("blur", () => {
      if (!field.checkValidity()) markFieldError(field);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    const invalidFields = Array.from(
      form.querySelectorAll("input, select, textarea"),
    ).filter((field) => !field.checkValidity());

    invalidFields.forEach(markFieldError);
    if (invalidFields.length) {
      setStatus(
        "Please complete the required fields and correct any invalid values.",
        "is-error",
      );
      invalidFields[0].focus();
      return;
    }

    // Honeypot: if filled, drop the submission silently.
    if (form.querySelector('[name="_website"]').value) {
      setStatus("Thanks. Your message was received.", "is-success");
      form.reset();
      return;
    }

    const data = new FormData(form);

    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        form.reset();
        setStatus(
          "Thanks. Your inquiry was received. JustinJ Industries will follow up with next steps.",
          "is-success",
        );
      } else {
        const json = await res.json().catch(() => ({}));
        const msg =
          json?.errors?.map((err) => err.message).join(" ") ||
          "Submission failed.";
        setStatus(
          `${msg} You can also email info@justinjindustries.com.`,
          "is-error",
        );
      }
    } catch {
      setStatus(
        "Network error. Please try again or email info@justinjindustries.com.",
        "is-error",
      );
    }
  });
});
