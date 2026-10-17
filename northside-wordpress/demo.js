(() => {
  const form = document.querySelector("[data-northside-form]");
  if (!form) return;
  const choice = new URLSearchParams(location.search).get("service");
  const select = form.querySelector("select");
  if ([...select.options].some((option) => option.value === choice))
    select.value = choice;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[role=status]");
    status.textContent =
      "Demo only: no message was sent. Your sample inquiry is complete.";
    status.tabIndex = -1;
    status.focus();
  });
})();
