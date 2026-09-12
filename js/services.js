// services.js — Fast Services catalog with clean SVGs, Tenge currency and real-time review ratings
import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, getDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, debounce, starsHtml, formatPrice, getCategoryIcon } from './utils.js';

let cachedServices = null;
let cachedReviews = [];
let reviewsUnsub = null;
let currentCategory = 'all';
let currentSort = 'rating';
let searchQuery = '';

export function initServicesPage() {
  setupFilters();
  setupSearch();
  loadServices();
  loadSalonMetrics();
}

export async function loadSalonMetrics() {
  try {
    let data = null;

    // 1. Primary: settings/salon
    try {
      const snap = await getDoc(doc(db, 'settings', 'salon'));
      if (snap.exists()) data = snap.data();
    } catch (e) {
      // Handled by cloud fallback
    }

    // 2. Cloud Fallback: services/salon_settings
    if (!data) {
      try {
        const snap = await getDoc(doc(db, 'services', 'salon_settings'));
        if (snap.exists()) data = snap.data();
      } catch (e) {
        // Handled by localStorage fallback
      }
    }

    // 3. LocalStorage Fallback
    if (!data) {
      try {
        const saved = localStorage.getItem('petcare_salon_settings');
        if (saved) data = JSON.parse(saved);
      } catch (e) {}
    }

    if (data) {
      const happyPets = document.getElementById('stat-happy-pets');
      const rating = document.getElementById('stat-rating');
      const specs = document.getElementById('stat-specialists');
      if (happyPets && data.happyPetsCount !== undefined) {
        happyPets.textContent = `${Number(data.happyPetsCount).toLocaleString('ru-RU')}+`;
      }
      if (rating && data.averageRating !== undefined) {
        rating.textContent = `${Number(data.averageRating).toFixed(1)} ★`;
      }
      if (specs && data.specialistsCount !== undefined) {
        specs.textContent = `${data.specialistsCount}`;
      }
      const fPhone = document.getElementById('footer-phone');
      const fEmail = document.getElementById('footer-email');
      const fAddr = document.getElementById('footer-address');
      const fHours = document.getElementById('footer-hours');
      if (fPhone && data.phone) { fPhone.textContent = data.phone; fPhone.href = `tel:${data.phone.replace(/[^+\d]/g, '')}`; }
      if (fEmail && data.email) { fEmail.textContent = data.email; fEmail.href = `mailto:${data.email}`; }
      if (fAddr && data.address) { fAddr.textContent = data.address; }
      if (fHours && data.hours) { fHours.textContent = data.hours; }
    }
  } catch (err) {
    console.warn('Failed to load salon metrics:', err);
  }
}

// ─── Filters ────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat;
      renderServices();
    });
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderServices();
  });
}

// ─── Search ────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderServices();
  }, 150));
}

// ─── Fetch Services ───────────────────────────────────────────
async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;
  grid.innerHTML = skeletons(6);

  try {
    const snap = await getDocs(collection(db, 'services'));
    cachedServices = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Listen to real-time reviews to always compute dynamic rating & reviewCount
    if (!reviewsUnsub) {
      reviewsUnsub = onSnapshot(collection(db, 'reviews'), (revSnap) => {
        cachedReviews = revSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderServices();
      }, (err) => {
        console.warn('Reviews real-time listener skipped:', err.message);
        renderServices();
      });
    } else {
      renderServices();
    }
  } catch (err) {
    console.error('Services load error:', err);
    grid.innerHTML = errorState();
  }
}

function renderServices() {
  const grid = document.getElementById('services-grid');
  const paginationWrap = document.getElementById('pagination-wrap');
  const paginationInfo = document.getElementById('pagination-info');
  if (!grid || !cachedServices) return;

  let items = cachedServices.filter(s => s.id !== 'salon_settings' && s.isActive !== false && s.name).map(s => {
    const sReviews = cachedReviews.filter(r => r.serviceId === s.id);
    const count = sReviews.length;
    let avg = 5.0;
    if (count > 0) {
      const sum = sReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      avg = Math.round((sum / count) * 10) / 10;
    }
    return {
      ...s,
      rating: avg,
      reviewCount: count
    };
  });

  if (currentCategory !== 'all') {
    items = items.filter(s => s.category === currentCategory);
  }

  if (searchQuery) {
    items = items.filter(s => (
      s.name?.toLowerCase().includes(searchQuery) ||
      s.description?.toLowerCase().includes(searchQuery) ||
      s.tags?.some(t => t.toLowerCase().includes(searchQuery))
    ));
  }

  // Sort
  if (currentSort === 'rating') items.sort((a, b) => (b.rating || 5) - (a.rating || 5));
  else if (currentSort === 'price-asc') items.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (currentSort === 'price-desc') items.sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (currentSort === 'name') items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (items.length === 0) {
    grid.innerHTML = emptyState();
    if (paginationWrap) paginationWrap.style.display = 'none';
    return;
  }

  grid.innerHTML = '';
  items.forEach((item, i) => {
    const card = createServiceCard(item.id, item, i);
    grid.appendChild(card);
  });

  if (paginationWrap) {
    paginationWrap.style.display = 'flex';
    if (paginationInfo) {
      paginationInfo.textContent = `Показано ${items.length} услуг`;
    }
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  }
}

// ─── Card Element ─────────────────────────────────────────────
function createServiceCard(id, data, index = 0) {
  const isNew = data.tags?.includes('новинка') || data.isNew;
  const isPopular = (data.rating >= 4.8 && (data.reviewCount || 0) >= 30);
  const iconSvg = getCategoryIcon(data.category);
  const imgHtml = data.imageUrl
    ? `<img src="${data.imageUrl}" alt="${data.name}" class="card-img-photo" loading="lazy">`
    : `<div class="card-img-placeholder" style="color: var(--color-purple-light)">${iconSvg}</div>`;

  const card = document.createElement('div');
  card.className = 'service-card';
  card.dataset.id = id;

  card.innerHTML = `
    <div class="card-img">
      ${imgHtml}
      ${isNew ? '<span class="card-badge badge-new">Новинка</span>' : ''}
      ${isPopular && !isNew ? '<span class="card-badge badge-popular">Популярное</span>' : ''}
    </div>
    <div class="card-body">
      <div class="card-category">${data.category || 'Услуга'}</div>
      <h3 class="card-title">${data.name}</h3>
      <p class="card-desc">${data.description || ''}</p>
      <div class="card-meta">
        <div class="card-price">${formatPrice(data.price)}</div>
        <div class="card-rating">${starsHtml(data.rating || 5)} <span>${Number(data.rating || 5).toFixed(1)}</span> <span style="color:var(--text-muted)">(${data.reviewCount || 0})</span></div>
      </div>
      <div class="card-duration">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${data.duration || 60} мин
      </div>
    </div>
    <div class="card-footer">
      <a href="service.html?id=${id}" class="btn btn-outline btn-sm">Подробнее</a>
      <a href="booking.html?service=${id}" class="btn btn-primary btn-sm">Записаться</a>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    window.location.href = `service.html?id=${id}`;
  });

  return card;
}

function skeletons(n) { return Array(n).fill('<div class="skeleton skel-card"></div>').join(''); }
function emptyState() { return `<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">Услуги не найдены</div><div class="empty-text">Попробуйте изменить категорию или поисковый запрос</div></div>`; }
function errorState() { return `<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">Ошибка связи с базой данных</div><div class="empty-text">Проверьте соединение с интернетом</div></div>`; }
