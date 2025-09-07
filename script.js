document.addEventListener('DOMContentLoaded', () => {
  const doc = document.documentElement; // root for theme override classes
  const menuButton = document.getElementById('menu-toggle');
  const overlay = document.getElementById('overlay');
  const brandLogo = document.getElementById('brand-logo');
  const themeBtn = document.getElementById('theme-toggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const LS_KEY = 'theme'; // 'auto'|'dark'|'light'

  // --- Theme helpers
  const getTheme = () => localStorage.getItem(LS_KEY) || 'auto';
  const setTheme = (v) => localStorage.setItem(LS_KEY, v);

  function applyTheme(){
    const pref = getTheme();
    // reset
    doc.classList.remove('theme-dark','theme-light');
    if (pref === 'dark') doc.classList.add('theme-dark');
    if (pref === 'light') doc.classList.add('theme-light');

    // Update button label + accessibility
    const label = pref.charAt(0).toUpperCase() + pref.slice(1);
    if (themeBtn){
      themeBtn.textContent = label;
      themeBtn.setAttribute('aria-label', `Theme: ${label} (click to change)`);
      themeBtn.title = `Theme: ${label} (click to change)`;
    }

    // Effective theme decides logo
    const effectiveDark = pref === 'dark' || (pref === 'auto' && media.matches);
    if (brandLogo){
      brandLogo.src = effectiveDark ? 'JJI-Logo-Only-white.png' : 'JJI-Logo-Only-grey.png';
    }
  }

  // Cycle Auto -> Dark -> Light -> Auto
  if (themeBtn){
    themeBtn.addEventListener('click', () => {
      const cur = getTheme();
      const next = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
      setTheme(next);
      applyTheme();
    });
  }

  // React to system changes only when Auto
  media.addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme();
  });

  // Initialize theme
  if (!localStorage.getItem(LS_KEY)) setTheme('auto');
  applyTheme();

  // --- Menu toggle (mobile overlay)
  if (menuButton && overlay){
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
  }

  // --- Smooth scroll for hash links
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
        menuButton?.classList.remove('active');
        document.body.classList.remove('menu-open');
        menuButton?.setAttribute('aria-expanded','false');
      }
    });
  });

  // --- Reveal on scroll
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: .12});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // --- Year in footer
  const yearEl = document.getElementById('year');
  if(yearEl){ yearEl.textContent = new Date().getFullYear(); }
});
