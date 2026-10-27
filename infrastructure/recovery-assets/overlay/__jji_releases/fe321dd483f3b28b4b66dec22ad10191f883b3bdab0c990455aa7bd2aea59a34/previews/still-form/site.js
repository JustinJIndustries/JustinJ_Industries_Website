(() => {
  const nav = document.querySelector(".site-nav");
  nav?.querySelectorAll(".menu-item-has-children").forEach((item, index) => {
    const link = item.querySelector(":scope > a");
    const submenu = item.querySelector(":scope > .sub-menu");
    if (!link || !submenu) return;
    const button = document.createElement("button");
    const name = link.textContent.trim();
    submenu.id ||= `sf-submenu-${index + 1}`;
    button.type = "button";
    button.className = "submenu-toggle";
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>';
    button.setAttribute("aria-controls", submenu.id);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", `${nav.dataset.submenuShow} ${name}`);
    item.insertBefore(button, submenu);
    const close = () => {
      item.classList.remove("submenu-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", `${nav.dataset.submenuShow} ${name}`);
    };
    button.addEventListener("click", () => {
      const open = !item.classList.contains("submenu-open");
      item.classList.toggle("submenu-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute(
        "aria-label",
        `${open ? nav.dataset.submenuHide : nav.dataset.submenuShow} ${name}`,
      );
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && item.classList.contains("submenu-open")) {
        event.preventDefault();
        close();
        button.focus();
      }
    });
    item.addEventListener("focusout", (event) => {
      if (!item.contains(event.relatedTarget)) close();
    });
  });

  document.querySelectorAll(".quick-view[data-dialog]").forEach((button) => {
    const dialog = document.getElementById(button.dataset.dialog);
    if (!dialog || typeof dialog.showModal !== "function") return;
    button.classList.add("dialog-ready");

    button.addEventListener("click", () => {
      // Images inside a closed dialog may never trigger native lazy loading.
      dialog.querySelector("img")?.setAttribute("loading", "eager");
      dialog.showModal();
      dialog.querySelector(".dialog-close")?.focus();
    });

    dialog
      .querySelector(".dialog-close")
      ?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => button.focus());

    // Explicitly contain Tab focus even in engines that do not trap it for <dialog>.
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  });

  document.getElementById("form-notice")?.focus();
})();

// The public static export keeps category URLs meaningful without a CMS server.
(() => {
  const status = document.getElementById("sf-filter-status");
  if (!status) return;
  const category = new URLSearchParams(location.search).get("category") || "";
  const cards = [...document.querySelectorAll(".work-grid .project-card")];
  let visible = 0;
  cards.forEach((card) => {
    card.hidden = !!category && card.dataset.category !== category;
    if (!card.hidden) visible++;
  });
  document.querySelectorAll(".work-filters a").forEach((link) => {
    const match =
      (new URL(link.href).searchParams.get("category") || "") === category;
    if (match) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  status.textContent = visible
    ? `${visible} ${visible === 1 ? "project" : "projects"} shown${category ? " in " + category : ""}.`
    : "No projects in this category. Choose All to return to the complete collection.";
})();
