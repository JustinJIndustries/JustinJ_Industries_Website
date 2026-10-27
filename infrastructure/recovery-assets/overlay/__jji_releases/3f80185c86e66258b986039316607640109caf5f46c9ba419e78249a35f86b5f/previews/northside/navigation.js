/* One nonmodal menu enhancement for both static and native WordPress headers. */
(() => {
  const initialize = () => {
    const header = document.querySelector(".ns-header-inner");
    const nav = header?.querySelector(".ns-nav");
    if (!nav || header.querySelector(".ns-menu-toggle")) return;
    const media = window.matchMedia("(max-width: 760px)");
    nav.id = nav.id || "northside-main-menu";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ns-menu-toggle";
    button.setAttribute("aria-controls", nav.id);
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"></path></svg><span>Menu</span>';
    header.insertBefore(button, nav);
    let expanded = false;
    const render = () => {
      button.hidden = !media.matches;
      button.setAttribute("aria-expanded", String(media.matches && expanded));
      button.setAttribute(
        "aria-label",
        expanded ? "Close navigation menu" : "Open navigation menu",
      );
      button
        .querySelector("path")
        .setAttribute(
          "d",
          expanded ? "M6 6l12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16",
        );
      nav.hidden = media.matches && !expanded;
    };
    const close = (restoreFocus = false) => {
      expanded = false;
      if (restoreFocus) button.focus();
      render();
    };
    button.addEventListener("click", () => {
      if (expanded) close(true);
      else {
        expanded = true;
        render();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && media.matches && expanded) {
        event.preventDefault();
        close(true);
      }
    });
    nav.addEventListener("click", (event) => {
      if (media.matches && event.target.closest("a")) close();
    });
    media.addEventListener("change", () => {
      const focusInNav = nav.contains(document.activeElement);
      const focusOnButton = document.activeElement === button;
      expanded = false;
      render();
      if (media.matches && focusInNav) button.focus();
      if (!media.matches && focusOnButton) nav.querySelector("a")?.focus();
    });
    render();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
