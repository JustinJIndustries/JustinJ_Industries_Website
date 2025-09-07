document.addEventListener('DOMContentLoaded', () => {
  const doc = document.documentElement;
  const menuButton = document.getElementById('menu-toggle');
  const overlay = document.getElementById('overlay');
  const brandLogo = document.getElementById('brand-logo');
  const segWrap = document.querySelector('.segmented');
  const segButtons = [...document.querySelectorAll('.segmented .seg')];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const LS_KEY = 'theme'; // 'auto'|'dark'|'light'

  const getTheme = () => localStorage.getItem(LS_KEY) || 'auto';
  const setTheme = (v) => localStorage.setItem(LS_KEY, v);

  function updateSegmentedActive(pref){
    segButtons.forEach(btn => {
      const active = btn.dataset.theme === pref;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function applyTheme(){
    const pref = getTheme();
    doc.classList.remove('theme-dark','theme-light');
    if (pref === 'dark') doc.classList.add('theme-dark');
    if (pref === 'light') doc.classList.add('theme-light');
    updateSegmentedActive(pref);

    const effectiveDark = pref === 'dark' || (pref === 'auto' && media.matches);
    brandLogo.src = effectiveDark ? 'JJI-Logo-Only-white.png' : 'JJI-Logo-Only-grey.png';
  }

  // Click handlers
  segButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.theme;
      setTheme(val);
      applyTheme();
    });
  });

  // Keyboard arrows cycle choices (within group)
  segWrap.addEventListener('keydown', (e) => {
    const idx = segButtons.findIndex(b => b.classList.contains('is-active'));
    if (['ArrowRight','ArrowLeft'].includes(e.key)){
      e.preventDefault();
      let next = idx + (e.key === 'ArrowRight' ? 1 : -1);
      if (next < 0) next = segButtons.length - 1;
      if (next >= segButtons.length) next = 0;
      segButtons[next].focus();
      segButtons[next].click();
    }
  });

  media.addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme();
  });

  // Menu
  menuButton?.addEventListener('click', () => {
    const active = overlay.classList.toggle('active');
    menuButton.classList.toggle('active', active);
    document.body.classList.toggle('menu-open', active);
    menuButton.setAttribute('aria-expanded', String(active));
    if (active) overlay.querySelector('a')?.focus();
  });
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      menuButton.classList.remove('active');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('active')) {
      overlay.classList.remove('active');
      menuButton.classList.remove('active');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false');
    }
  });

  // Smooth scroll
  document.querySelectorAll('a[href^=\"#\"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if(!id || id === '#') return;
      const el = document.querySelector(id);
      if(el){
        e.preventDefault();
        el.scrollIntoView({behavior:'smooth', block:'start'});
      }
      if(overlay?.classList.contains('active')){
        overlay.classList.remove('active');
        menuButton.classList.remove('active');
        document.body.classList.remove('menu-open');
        menuButton.setAttribute('aria-expanded','false');
      }
    });
  });

  // Reveal
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: .12});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Year
  const yearEl = document.getElementById('year');
  if(yearEl){ yearEl.textContent = new Date().getFullYear(); }

  // Init
  if (!localStorage.getItem(LS_KEY)) setTheme('auto');
  applyTheme();
});
