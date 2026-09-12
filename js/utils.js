// utils.js — Shared utilities (Clean SVG icons, Tenge currency, zero emojis)

// ─── Toast notifications ─────────────────────────────────────
const toastContainer = document.getElementById('toast-container');
export function showToast(message, type = 'info', duration = 3500) {
  if (!toastContainer) return;

  const svgIcons = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${svgIcons[type] || svgIcons.info}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all .3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Format date ─────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatDateShort(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}
export function getDay(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : new Date(ts));
  return d.getDate();
}
export function getMonth(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : new Date(ts));
  return d.toLocaleDateString('ru-RU', { month: 'short' });
}

// ─── Debounce ─────────────────────────────────────────────────
export function debounce(fn, delay = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ─── Star rating HTML (Clean SVG stars) ───────────────────────
export function starsHtml(rating, max = 5) {
  let html = '<span style="display:inline-flex;align-items:center;gap:2px">';
  const r = Math.round(Number(rating) || 5);
  for (let i = 1; i <= max; i++) {
    const isFilled = i <= r;
    html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="${isFilled ? '#f59e0b' : '#334155'}" stroke="${isFilled ? '#f59e0b' : '#475569'}" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
  html += '</span>';
  return html;
}

// ─── Category SVG Icons ───────────────────────────────────────
export function getCategoryIcon(cat) {
  switch (cat) {
    case 'Стрижка':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
    case 'Мытьё':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
    case 'Маникюр':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    case 'Уши':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    case 'Комплекс':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`;
    case 'Зубки':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5c0 3 2 7 5 13 3-6 5-10 5-13a5 5 0 0 0-5-5z"/></svg>`;
    default:
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>`;
  }
}

// ─── Pet SVG Icon (Replaces emojis) ──────────────────────────
export function getPetIcon(type) {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="4" cy="14" r="2"/><circle cx="20" cy="14" r="2"/></svg>`;
}

// ─── Modal helpers ────────────────────────────────────────────
export function openModal(id) { document.getElementById(id)?.classList.add('open'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
export function closeAllModals() { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); }

// ─── Navbar scroll effect & User dropdown ─────────────────────
// ─── Navbar scroll effect & User dropdown ─────────────────────
export function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (nav && !nav.dataset.scrollBound) {
    nav.dataset.scrollBound = 'true';
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));
  }

  // User menu dropdown (works reliably across ALL pages)
  const userBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userBtn && userDropdown) {
    userBtn.onclick = (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    };
    if (!document.dataset?.dropdownBound) {
      if (!document.dataset) document.dataset = {};
      document.dataset.dropdownBound = 'true';
      document.addEventListener('click', () => {
        document.querySelectorAll('#user-dropdown').forEach(d => d.classList.add('hidden'));
      });
    }
  }

  // Mobile menu
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (hamburger && mobileNav && !hamburger.dataset.bound) {
    hamburger.dataset.bound = 'true';
    hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) mobileNav.classList.remove('open');
    });
  }
}

// ─── Recalculate Ratings from real reviews ─────────────────────
export async function recalculateRatings(serviceId = null, specialistId = null) {
  try {
    const { db } = await import('./firebase-config.js');
    const { collection, query, where, getDocs, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    if (serviceId && serviceId !== 'undefined' && typeof serviceId === 'string' && serviceId.trim()) {
      try {
        const q = query(collection(db, 'reviews'), where('serviceId', '==', serviceId.trim()));
        const snap = await getDocs(q);
        const total = snap.docs.reduce((sum, d) => sum + (Number(d.data().rating) || 5), 0);
        const count = snap.docs.length;
        const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 5.0;
        await updateDoc(doc(db, 'services', serviceId.trim()), {
          rating: avg,
          reviewCount: count
        });
      } catch (err) {
        console.warn('Service rating update skipped:', err.message);
      }
    }

    if (specialistId && specialistId !== 'undefined' && typeof specialistId === 'string' && specialistId.trim()) {
      try {
        const q = query(collection(db, 'reviews'), where('specialistId', '==', specialistId.trim()));
        const snap = await getDocs(q);
        const total = snap.docs.reduce((sum, d) => sum + (Number(d.data().rating) || 5), 0);
        const count = snap.docs.length;
        const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 5.0;
        await updateDoc(doc(db, 'specialists', specialistId.trim()), {
          rating: avg,
          reviewCount: count
        });
      } catch (err) {
        console.warn('Specialist rating update skipped:', err.message);
      }
    }
  } catch (err) {
    console.warn('Recalculate ratings error:', err);
  }
}

// ─── Animate elements on scroll ──────────────────────────────
export function initScrollAnimations() {
  const els = document.querySelectorAll('[data-animate]');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('animate-in'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));
}

// ─── Generate time slots ──────────────────────────────────────
export function generateSlots(start = 9, end = 19, step = 30) {
  const slots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += step) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

// ─── Close modal on overlay click ────────────────────────────
export function initModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('open'));
  });
}

// ─── Truncate text ────────────────────────────────────────────
export function truncate(str, n = 80) { return str?.length > n ? str.slice(0, n) + '…' : (str || ''); }

// ─── Format price in Tenge (₸) ────────────────────────────────
export function formatPrice(p) {
  const num = typeof p === 'number' ? p : parseInt(p) || 0;
  return `${num.toLocaleString('ru-RU')} ₸`;
}
