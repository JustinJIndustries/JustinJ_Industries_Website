document.addEventListener('DOMContentLoaded', () => {
  const doc = document.documentElement; // use root for CSS var overrides
  const menuButton = document.getElementById('menu-toggle');
  const overlay = document.getElementById('overlay');
  const brandLogo = document.getElementById('brand-logo');
  const themeBtn = document.getElementById('theme-toggle');

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const LS_KEY = 'theme'; // 'auto' | 'dark' | 'light'

  function getStoredTheme() {
    return localStorage.getItem(LS_KEY) || 'auto';
  }

  function setStoredTheme(val) {
    localStorage.setItem(LS_KEY, val);
  }

  function applyTheme() {
    const pref = getStoredTheme();
    doc.classList.remove('theme-dark','theme-light');
    if (pref === 'dark') doc.classList.add('theme-dark');
    if (pref === 'light') doc.classList.add('theme-light');

    // Set chip label
    const label = pref === 'auto' ? 'Auto' : (pref[0].toUpperCase() + pref.slice(1));
    themeBtn.dataset.state = pref;
    themeBtn.setAttribute('aria-label', `Theme: ${label}`);
    themeBtn.title = `Theme: ${label} (click to change)`;
    themeBtn.querySelector('.chip__text').textContent = label;

    // Decide effective theme for logo (override wins, else system)
    const effectiveDark = pref === 'dark' || (pref === 'auto' && media.matches);
    brandLogo.src = effectiveDark ? 'assets/logos/JJI-Logo-Only-white.png' : 'assets/logos/JJI-Logo-Only-grey.png';
  }

  // Cycle Auto -> Dark -> Light -> Auto
  themeBtn.addEventListener('click', () => {
    const current = getStoredTheme();
    const next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
    setStoredTheme(next);
    applyTheme();
  });

  // React to OS changes only when Auto
  media.addEventListener('change', () => {
    if (getStoredTheme() === 'auto') applyTheme();
  });

  // Menu toggle
  menuButton.addEventListener('click', () => {
    const active = overlay.classList.toggle('active');
    menuButton.classList.toggle('active', active);
    document.body.classList.toggle('menu-open', active);
    menuButton.setAttribute('aria-expanded', String(active));
    if (active) overlay.querySelector('a')?.focus();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      menuButton.classList.remove('active');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
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
      if(overlay.classList.contains('active')){
        overlay.classList.remove('active');
        menuButton.classList.remove('active');
        document.body.classList.remove('menu-open');
        menuButton.setAttribute('aria-expanded','false');
      }
    });
  });

  // Intersection Observer reveal
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

  // Initial
  if (!localStorage.getItem(LS_KEY)) setStoredTheme('auto');
  applyTheme();
});
