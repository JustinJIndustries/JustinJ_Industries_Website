(() => {
  const toggle = document.querySelector(".hl-menu"),
    nav = document.querySelector(".hl-nav");
  if (toggle && nav) {
    const media = matchMedia("(max-width:960px)");
    let open = false;
    const sync = () => {
      toggle.hidden = !media.matches;
      nav.hidden = media.matches && !open;
      toggle.setAttribute("aria-expanded", String(media.matches && open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.querySelector("span").textContent = open ? "Close" : "Menu";
    };
    toggle.addEventListener("click", () => {
      open = !open;
      sync();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        open = false;
        sync();
        toggle.focus();
      }
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        open = false;
        sync();
      }
    });
    media.addEventListener("change", () => {
      const active = document.activeElement;
      open = false;
      sync();
      if (media.matches && nav.contains(active)) toggle.focus();
      if (!media.matches && active === toggle) nav.querySelector("a").focus();
    });
    sync();
  }
  const openTargetIndustry = () => {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (target instanceof HTMLDetailsElement) target.open = true;
  };
  openTargetIndustry();
  addEventListener("hashchange", openTargetIndustry);
  // This preview has no delivery endpoint, named submitted controls, network call or storage.
  const form = document.querySelector("#hl-inquiry");
  if (!form) return;
  form.addEventListener("submit", (e) => e.preventDefault());
  const button = form.querySelector("#hl-review"),
    summary = form.querySelector(".hl-errors"),
    list = summary.querySelector("ul"),
    review = form.querySelector(".hl-review");
  const fields = ["name", "email", "service", "message"].map((k) =>
    document.querySelector("#hl-" + k),
  );
  const param = new URL(location.href).searchParams.get("service"),
    service = document.querySelector("#hl-service");
  if (param && [...service.options].some((o) => o.value === param))
    service.value = param;
  const validateAndReview = (event) => {
    event.preventDefault();
    let errors = [];
    list.replaceChildren();
    review.hidden = true;
    for (const field of fields) {
      let message = "";
      if (!field.value.trim()) message = "Please complete this field.";
      else if (field.type === "email" && field.validity.typeMismatch)
        message = "Please enter a valid email address.";
      else if (field.id === "hl-message" && field.value.trim().length < 10)
        message = "Please add a little more detail (at least 10 characters).";
      const error = document.querySelector("#" + field.id + "-error");
      error.textContent = message;
      error.hidden = !message;
      field.setAttribute("aria-invalid", String(!!message));
      if (message) {
        const li = document.createElement("li"),
          a = document.createElement("a");
        a.href = "#" + field.id;
        a.textContent =
          field.labels[0].textContent.replace("(required)", "").trim() +
          ": " +
          message;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          field.focus();
        });
        li.append(a);
        list.append(li);
        errors.push(field);
      }
    }
    summary.hidden = !errors.length;
    if (errors.length) {
      summary.focus();
      return;
    }
    review.hidden = false;
    review.focus();
  };
  button.addEventListener("click", validateAndReview);
  form.addEventListener("submit", validateAndReview);
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName === "INPUT")
      validateAndReview(event);
  });
  review.querySelector(".hl-edit").addEventListener("click", () => {
    review.hidden = true;
    fields[0].focus();
  });
  button.disabled = false;
})();
