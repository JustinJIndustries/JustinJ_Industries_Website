(() => {
  document.documentElement.classList.add('js');
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  if (!button || !nav) return;
  const close = (restoreFocus = false) => {
    button.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    if (restoreFocus) button.focus();
  };
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') close(true);
  });
  const year = document.querySelector('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
