document.addEventListener('DOMContentLoaded', () => {
  const doc = document.documentElement;
  const menuButton = document.getElementById('menu-toggle');
  const overlay = document.getElementById('overlay');
  const brandLogo = document.getElementById('brand-logo');
  const themeBtn = document.getElementById('theme-toggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const LS_KEY = 'theme'; // 'auto'|'dark'|'light'

  const getTheme = () => localStorage.getItem(LS_KEY) || 'auto';
  const setTheme = (v) => localStorage.setItem(LS_KEY, v);

  function applyTheme(){
    const pref = getTheme();
    doc.classList.remove('theme-dark','theme-light');
    if (pref === 'dark') doc.classList.add('theme-dark');
    if (pref === 'light') doc.classList.add('theme-light');

    // Update icon visibility
    themeBtn.querySelector('.icon-auto').style.display = pref === 'auto' ? 'block' : 'none';
    themeBtn.querySelector('.icon-moon').style.display = pref === 'dark' ? 'block' : 'none';
    themeBtn.querySelector('.icon-sun').style.display = pref === 'light' ? 'block' : 'none';

    const label = pref.charAt(0).toUpperCase() + pref.slice(1);
    themeBtn.setAttribute('aria-label', `Theme: ${label} (click to change)`);
    themeBtn.title = `Theme: ${label} (click to change)`;

    const effectiveDark = pref === 'dark' || (pref === 'auto' && media.matches);
    brandLogo.src = effectiveDark ? 'JJI-Logo-Only-white.png' : 'JJI-Logo-Only-grey.png';
  }

  themeBtn.addEventListener('click', () => {
    const next = getTheme() === 'auto' ? 'dark' : getTheme() === 'dark' ? 'light' : 'auto';
    setTheme(next);
    applyTheme();
  });

  media.addEventListener('change', () => {
    if (getTheme() === 'auto') applyTheme();
  });

  // Menu
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
