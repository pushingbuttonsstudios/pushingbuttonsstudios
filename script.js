/* script.js
 - Exact 3.5s slideshow (non-blocking brightness), right-panel menu, keyboard nav,
 - no hover-to-pause, production posters move only slightly left on desktop (no scale/blur),
 - on narrow screens (<=880px) the production layout stacks and the animation is disabled,
 - nav clicks align section top beneath fixed header exactly.
*/

/* ========== CONFIG ========== */
const IMAGE_PATH = 'assets/images/';
const IMAGES = [
  'antariksh.jpg',
  'doggie.jpg',
  'ghumakkadi.jpg',
  'girls.jpg',
  'gulnaz.jpg',
  'jigyaasa.jpg',
  'lucky.jpg',
  'mujhse.jpg',
  'palmolive.jpg',
  'papita.jpg',
  'phalke.jpg',
  'pinky.jpg',
  'secret.jpg',
  'sline.jpg',
  // new posters added
  'aakhri.jpg',
  'betul.jpg',
  'kinara.jpg'
];

const INTERVAL = 3500; // EXACT 3.5s between slides
const BRIGHTNESS_THRESHOLD = 130;

/* ========== DOM REFS ========== */
const slideshowEl = document.getElementById('slideshow');
const heroContent = document.getElementById('heroContent');
const menuBtn = document.getElementById('menuToggle');
const navOverlay = document.getElementById('siteNav');

/* ========== SLIDESHOW STATE ========== */
let slides = [];
let current = 0;
let timer = null;
const brightnessCache = new Map();

/* ---------- BUILD SLIDES ---------- */
function buildSlides() {
  IMAGES.forEach((filename, idx) => {
    const div = document.createElement('div');
    div.className = 'slide';
    div.dataset.src = IMAGE_PATH + filename;
    div.style.backgroundImage = `url('${IMAGE_PATH + filename}')`;
    div.dataset.index = idx;

    // preload image object for brightness calc (no crossOrigin)
    const img = new Image();
    img.src = IMAGE_PATH + filename;
    img.decoding = 'async';

    slides.push({ el: div, img, filename, index: idx });
    slideshowEl.appendChild(div);
  });
}

/* ---------- BRIGHTNESS (async, cached) ---------- */
function computeBrightness(img, filename) {
  if (brightnessCache.has(filename)) return Promise.resolve(brightnessCache.get(filename));

  return new Promise((resolve) => {
    function calculate() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = 40, h = 40;
        canvas.width = w;
        canvas.height = h;

        const iw = img.naturalWidth || img.width || 1;
        const ih = img.naturalHeight || img.height || 1;
        const ratio = Math.max(w / iw, h / ih);
        const drawW = iw * ratio;
        const drawH = ih * ratio;
        const dx = (w - drawW) / 2;
        const dy = (h - drawH) / 2;

        ctx.drawImage(img, dx, dy, drawW, drawH);
        const data = ctx.getImageData(0, 0, w, h).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          total += lum;
        }
        const avg = total / (data.length / 4);
        brightnessCache.set(filename, avg);
        resolve(avg);
      } catch (err) {
        brightnessCache.set(filename, 80);
        resolve(80);
      }
    }

    if (img.complete && img.naturalWidth) {
      calculate();
    } else {
      let done = false;
      const onLoad = () => { if (!done) { done = true; calculate(); cleanup(); } };
      const onErr  = () => { if (!done) { done = true; brightnessCache.set(filename, 80); resolve(80); cleanup(); } };
      const to = setTimeout(() => { if (!done) { done = true; brightnessCache.set(filename, 80); resolve(80); cleanup(); } }, 3000);

      function cleanup() {
        clearTimeout(to);
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onErr);
      }

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onErr);
    }
  });
}

/* ---------- SLIDESHOW: showSlide (synchronous) ---------- */
function applyContrast(brightness) {
  if (brightness < BRIGHTNESS_THRESHOLD) {
    heroContent.classList.remove('dark'); heroContent.classList.add('light');
  } else {
    heroContent.classList.remove('light'); heroContent.classList.add('dark');
  }
}

function showSlide(index, resetTimer = true) {
  if (!slides[index]) return;
  current = index;

  slides.forEach((s, idx) => s.el.classList.toggle('show', idx === index));

  const s = slides[index];
  if (brightnessCache.has(s.filename)) {
    applyContrast(brightnessCache.get(s.filename));
  } else {
    computeBrightness(s.img, s.filename).then(b => {
      if (current === index) applyContrast(b);
    }).catch(()=>{});
  }

  if (resetTimer) restartSlideshowInterval();
}

/* ---------- SLIDESHOW INTERVAL CONTROL ---------- */
function nextSlide() {
  const next = (current + 1) % slides.length;
  showSlide(next, false); // auto advance doesn't reset interval
}
function startSlideshowInterval() { if (timer) return; timer = setInterval(nextSlide, INTERVAL); }
function stopSlideshowInterval() { if (!timer) return; clearInterval(timer); timer = null; }
function restartSlideshowInterval() { stopSlideshowInterval(); timer = setInterval(nextSlide, INTERVAL); }

/* ========== MENU (right panel) ========== */
function openMenu() {
  navOverlay.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  navOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  navOverlay.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  navOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (navOverlay.classList.contains('open')) closeMenu(); else openMenu();
});
document.addEventListener('click', (e) => {
  if (!navOverlay.classList.contains('open')) return;
  if (navOverlay.contains(e.target) || menuBtn.contains(e.target)) return;
  closeMenu();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navOverlay.classList.contains('open')) closeMenu();
});

/* Nav clicks: precise scroll accounting for fixed header height */
function scrollToElementAccountingHeader(el) {
  const header = document.querySelector('.topbar');
  const headerHeight = header ? header.offsetHeight : 70;
  const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
  window.scrollTo({ top, behavior: 'smooth' });
}

document.querySelectorAll('#siteNav a').forEach(a => {
  a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const href = a.getAttribute('href');
    const target = document.querySelector(href);
    if (target) {
      scrollToElementAccountingHeader(target);
      closeMenu();
      restartSlideshowInterval();
    }
  });
});

/* Keyboard left/right navigation (resets timer) */
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { const next = (current + 1) % slides.length; showSlide(next, true); }
  if (e.key === 'ArrowLeft')  { const prev = (current - 1 + slides.length) % slides.length; showSlide(prev, true); }
});

/* ========== PRODUCTIONS SCROLL ANIMATION ========== */

/*
  Behavior:
  - Desktop (>880px): poster starts visually centered (grid column 2). As you scroll it translates left slightly (up to -10%).
  - Mobile (<=880px): animation disabled; poster stacks above details and details are visible.
*/

function productionItems() { return Array.from(document.querySelectorAll('.production-item')); }
let prodTicking = false;

function updateProductionAnimations() {
  const items = productionItems();
  const vh = window.innerHeight;
  const narrow = window.innerWidth <= 880;

  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    // progress 0..1 where 0 = item top at bottom of viewport, 1 = item top at top of viewport
    let progress = (vh - rect.top) / vh;
    progress = Math.max(0, Math.min(1, progress));

    const poster = item.querySelector('.production-poster');
    const details = item.querySelector('.production-details');

    if (narrow) {
      // Mobile: disable transforms; ensure stacked layout shows details
      if (poster) { poster.style.transform = ''; }
      if (details) { details.style.opacity = 1; details.style.transform = 'translateX(0)'; }
      item.classList.add('revealed');
      return;
    }

    // Desktop: small left translate from 0 -> -10% (gentle)
    const translateX = -10 * progress; // percent of poster width
    if (poster) {
      poster.style.transform = `translateX(${translateX}%)`;
    }

    if (details) {
      const opacity = Math.min(1, progress * 1.25);
      const detailsTranslate = 8 * (1 - progress);
      details.style.opacity = opacity;
      details.style.transform = `translateX(${detailsTranslate}%)`;
    }

    if (progress > 0.28) item.classList.add('revealed'); else item.classList.remove('revealed');
  });
}

function requestProdUpdate() {
  if (!prodTicking) {
    prodTicking = true;
    requestAnimationFrame(() => {
      updateProductionAnimations();
      prodTicking = false;
    });
  }
}

function setupProductionScrollHandlers() {
  window.addEventListener('scroll', requestProdUpdate, { passive: true });
  window.addEventListener('resize', requestProdUpdate);
  requestProdUpdate();
}

/* ========== INIT ========== */
async function init() {
  // Build slideshow
  buildSlides();

  // Preload slide images via Image objects (non-blocking)
  const preload = slides.map(s => new Promise(res => {
    if (s.img.complete) return res();
    s.img.onload = () => res();
    s.img.onerror = () => res();
  }));
  await Promise.all(preload);

  // Kick off background brightness computations
  slides.forEach(s => computeBrightness(s.img, s.filename).catch(()=>{}));

  // Show first slide synchronously and start interval
  showSlide(0, false);
  restartSlideshowInterval();

  // ensure hero text initial visibility
  if (heroContent) heroContent.classList.add('light');

  // setup production scroll interactions if present
  if (document.querySelectorAll('.production-item').length > 0) {
    setupProductionScrollHandlers();
  }
}

document.addEventListener('DOMContentLoaded', init);
