(() => {
  document.querySelectorAll("[data-northside-form]").forEach((form) => {
    // Prevent network submission even if an older saved template is still in use.
    form.addEventListener("submit", (event) => event.preventDefault());
    if (!form.querySelector('[data-ns-field="service"]')) {
      const button = form.querySelector("button");
      const showLegacyDemo = () => {
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const status = form.querySelector('[role="status"]');
        if (status) {
          status.textContent =
            "Demo only: no heating inquiry was sent or stored, and no service visit was requested.";
          status.tabIndex = -1;
          status.focus();
        }
      };
      if (button) {
        button.type = "button";
        button.addEventListener("click", showLegacyDemo);
      }
      form.addEventListener("submit", showLegacyDemo);
      return;
    }
    const controls = [...form.querySelectorAll("[data-ns-field]")];
    const field = (key) => form.querySelector(`[data-ns-field="${key}"]`);
    const status = form.querySelector('[role="status"]');
    const summary = form.querySelector("[data-ns-errors]");
    const button = form.querySelector("[data-northside-submit]");
    const errorFor = (input) => form.querySelector(`#${input.id}-error`);
    const choice = new URLSearchParams(location.search).get("service");
    if ([...field("service").options].some((option) => option.value === choice))
      field("service").value = choice;
    const clearErrors = () => {
      summary.hidden = true;
      summary.querySelector("ul").replaceChildren();
      controls.forEach((input) => {
        input.removeAttribute("aria-invalid");
        errorFor(input).hidden = true;
        errorFor(input).textContent = "";
      });
    };
    const contactRules = () => {
      const preference = field("preference").value;
      for (const key of ["email", "phone"]) {
        const required = preference === key;
        field(key).required = required;
        form.querySelector(`[data-ns-requirement="${key}"]`).textContent =
          `(${required ? form.dataset.nsRequiredLabel : form.dataset.nsOptionalLabel})`;
      }
      if (!summary.hidden) clearErrors();
    };
    field("preference").addEventListener("change", contactRules);
    contactRules();
    const messageFor = (input) => {
      const value = input.value.trim(),
        key = input.dataset.nsField;
      if (input.required && !value)
        return input.tagName === "SELECT"
          ? form.dataset.nsChoiceError
          : form.dataset.nsRequiredError;
      if (key === "email" && value && input.validity.typeMismatch)
        return form.dataset.nsEmailError;
      if (key === "phone" && value && !/^\+?[0-9\s().-]{7,40}$/.test(value))
        return form.dataset.nsPhoneError;
      if (key === "phone" && value && value.replace(/\D/g, "").length < 7)
        return form.dataset.nsPhoneError;
      if (key === "message" && value.length < 10)
        return form.dataset.nsIssueError;
      if (key === "area" && value.length < 2) return form.dataset.nsAreaError;
      if (input.validity.tooLong || input.validity.tooShort)
        return form.dataset.nsRequiredError;
      return "";
    };
    const validate = () => {
      clearErrors();
      status.textContent = "";
      const errors = [];
      controls.forEach((input) => {
        const message = messageFor(input);
        if (message) errors.push({ input, message });
      });
      if (
        field("preference").value === "either" &&
        !field("email").value.trim() &&
        !field("phone").value.trim()
      )
        errors.push({
          input: field("email"),
          message: form.dataset.nsEitherError,
        });
      if (errors.length) {
        const list = summary.querySelector("ul");
        errors.forEach(({ input, message }) => {
          input.setAttribute("aria-invalid", "true");
          const error = errorFor(input);
          error.textContent = message;
          error.hidden = false;
          const li = document.createElement("li"),
            a = document.createElement("a");
          a.href = "#" + input.id;
          a.textContent =
            form
              .querySelector(`label[for="${input.id}"]`)
              .childNodes[0].textContent.trim() +
            ": " +
            message;
          a.addEventListener("click", (event) => {
            event.preventDefault();
            input.focus();
          });
          li.append(a);
          list.append(li);
        });
        summary.hidden = false;
        summary.focus();
        return false;
      }
      // Deliberately no FormData, request, storage, email or booking operation.
      status.textContent = form.dataset.nsSuccess;
      status.focus();
      return true;
    };
    button.addEventListener("click", validate);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      validate();
    });
    form.addEventListener("reset", () => {
      clearErrors();
      status.textContent = form.dataset.nsCleared;
      queueMicrotask(contactRules);
    });
    controls.forEach((input) =>
      input.addEventListener("input", () => {
        if (input.hasAttribute("aria-invalid")) {
          input.removeAttribute("aria-invalid");
          errorFor(input).hidden = true;
        }
        status.textContent = "";
      }),
    );
    button.disabled = false;
  });
})();
