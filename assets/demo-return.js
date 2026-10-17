/* Runs in the head on every demo route, including internal iframe navigation. */
(() => {
  if (window.self !== window.top) {
    document.documentElement.classList.add("jji-demo-embedded");
  }
})();
