(() => {
  const section = document.querySelector(".business-stories");
  if (!section) return;
  const tabs = [...section.querySelectorAll(".journeys__tab")].map((link) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = link.id;
    button.className = link.className;
    button.textContent = link.textContent;
    link.replaceWith(button);
    return button;
  });
  const panels = [...section.querySelectorAll(".journeys__panel")];
  const tablist = section.querySelector(".journeys__tabs");
  const play = section.querySelector(".journeys__play");
  const count = section.querySelector(".journeys__count");
  const announcement = section.querySelector(".journeys__announcement");
  const viewport = section.querySelector(".journeys__viewport");
  const desktop = matchMedia(
    "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = 0,
    timer,
    inView = false,
    hovering = false,
    focused = false,
    stopped = false,
    touchStart;

  const eligible = () => desktop.matches && !reduced.matches;
  const updateRotation = () => {
    clearTimeout(timer);
    play.hidden = !eligible();
    play.dataset.stopped = String(stopped);
    play.querySelector("span").textContent = stopped
      ? "Play stories"
      : "Pause rotation";
    const running =
      eligible() &&
      inView &&
      !document.hidden &&
      !hovering &&
      !focused &&
      !stopped;
    section.dataset.rotation = running
      ? "playing"
      : stopped || !eligible()
        ? "manual"
        : "paused";
    if (running) timer = setTimeout(() => select(selected + 1, false), 9000);
  };
  const select = (
    index,
    manual = true,
    moveFocus = false,
    revealStory = false,
  ) => {
    selected = (index + panels.length) % panels.length;
    if (manual) stopped = true;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === selected));
      tab.tabIndex = i === selected ? 0 : -1;
      panels[i].hidden = i !== selected;
    });
    count.textContent = `${selected + 1} / ${panels.length}`;
    if (manual)
      announcement.textContent = `${panels[selected].dataset.brand}, ${selected + 1} of ${panels.length}. ${panels[selected].querySelector("h3").textContent}`;
    if (moveFocus) tabs[selected].focus({ preventScroll: true });
    if (revealStory && !desktop.matches) {
      const heading = panels[selected].querySelector("h3");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start", behavior: "instant" });
    }
    updateRotation();
  };

  tablist.setAttribute("role", "tablist");
  tabs.forEach((tab, index) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[index].id);
    panels[index].setAttribute("role", "tabpanel");
    panels[index].setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      select(index);
    });
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = selected + 1;
      else if (event.key === "ArrowLeft") next = selected - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else if (event.key === " ") next = index;
      if (next !== undefined) {
        event.preventDefault();
        select(next, true, true);
      }
    });
  });
  section.querySelector(".journeys__controls").hidden = false;
  section
    .querySelector(".journeys__previous")
    .addEventListener("click", () => select(selected - 1, true, false, true));
  section
    .querySelector(".journeys__next")
    .addEventListener("click", () => select(selected + 1, true, false, true));
  play.addEventListener("click", () => {
    stopped = !stopped;
    announcement.textContent = stopped
      ? "Story rotation paused."
      : "Story rotation enabled. It will continue when focus and pointer leave this section.";
    updateRotation();
  });
  section.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") {
      hovering = true;
      updateRotation();
    }
  });
  section.addEventListener("pointerleave", () => {
    hovering = false;
    updateRotation();
  });
  section.addEventListener("focusin", () => {
    focused = true;
    updateRotation();
  });
  section.addEventListener("focusout", (event) => {
    focused = section.contains(event.relatedTarget);
    updateRotation();
  });
  section.addEventListener("click", (event) => {
    if (event.target.closest("a") && !event.target.closest(".journeys__tab")) {
      stopped = true;
      updateRotation();
    }
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch")
      touchStart = { x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener("pointercancel", () => {
    touchStart = undefined;
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!touchStart || event.pointerType !== "touch") return;
    const dx = event.clientX - touchStart.x,
      dy = event.clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
      select(selected + (dx < 0 ? 1 : -1), true, false, true);
  });
  desktop.addEventListener("change", updateRotation);
  reduced.addEventListener("change", updateRotation);
  document.addEventListener("visibilitychange", updateRotation);
  const observer = new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting;
      updateRotation();
    },
    { rootMargin: "-80px 0px 0px 0px", threshold: 0.35 },
  );
  section.classList.add("journeys--ready");
  const fromHash = panels.findIndex(
    (panel) => `#${panel.id}` === location.hash,
  );
  select(fromHash < 0 ? 0 : fromHash, fromHash >= 0);
  window.addEventListener("hashchange", () => {
    const target = panels.findIndex(
      (panel) => `#${panel.id}` === location.hash,
    );
    if (target >= 0) {
      select(target);
      panels[target].scrollIntoView({ block: "start", behavior: "instant" });
    }
  });
  const reserveSpace = () => {
    if (innerWidth < 1024) {
      viewport.style.minHeight = "";
      return;
    }
    const width = viewport.clientWidth;
    let height = 0;
    for (const panel of panels) {
      const copy = panel.cloneNode(true);
      copy.hidden = false;
      copy.inert = true;
      copy.removeAttribute("id");
      copy.setAttribute("aria-hidden", "true");
      copy
        .querySelectorAll("[id]")
        .forEach((node) => node.removeAttribute("id"));
      copy.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;visibility:hidden;pointer-events:none;animation:none`;
      viewport.append(copy);
      height = Math.max(height, copy.getBoundingClientRect().height);
      copy.remove();
    }
    viewport.style.minHeight = `${Math.ceil(height)}px`;
  };
  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(reserveSpace);
  });
  reserveSpace();
  observer.observe(viewport);
})();
