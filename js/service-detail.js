// service-detail.js — Dedicated service detail page with clean SVGs, Tenge currency and real-time reviews
import { db } from './firebase-config.js';
import {
  doc, getDoc, collection, query, where, orderBy, limit, getDocs, addDoc, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { initAuth, currentUser } from './auth.js';
import { initNavbar, showToast, formatPrice, starsHtml, getCategoryIcon, recalculateRatings } from './utils.js';

let currentService = null;
let selectedRating = 5;
let relatedPage = 1;
const RELATED_PER_PAGE = 3;
let allRelatedServices = [];
let reviewsUnsub = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initAuth(() => {});
  initDetailPage();
});

async function initDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const serviceId = params.get('id') || 'srv-1';
  await loadServiceDetail(serviceId);
}

async function loadServiceDetail(id) {
  const container = document.getElementById('service-detail-content');
  let service = null;

  try {
    const snap = await getDoc(doc(db, 'services', id));
    if (snap.exists()) {
      service = { id: snap.id, ...snap.data() };
    }
  } catch (err) {
    console.error('Error fetching service:', err);
  }

  if (!service) {
    container.innerHTML = '<div class="empty-state"><div class="empty-title">Услуга не найдена</div><a href="index.html" class="btn btn-primary" style="margin-top:16px">Вернуться в каталог</a></div>';
    return;
  }

  currentService = service;
  document.title = `${service.name} — PetCare`;

  renderServiceDetail(service);
  loadRelatedServices(service);
  initRealtimeReviews(service.id);
}

function renderServiceDetail(s) {
  const container = document.getElementById('service-detail-content');
  const iconSvg = getCategoryIcon(s.category);

  container.innerHTML = `
    <div class="detail-card">
      <div class="detail-grid">
        <div class="detail-visual">
          ${s.imageUrl ? `<img src="${s.imageUrl}" alt="${s.name}" style="width:100%;height:100%;object-fit:cover">` : `<div style="color:var(--color-purple-light);transform:scale(2.2);">${iconSvg}</div>`}
          <span class="card-badge badge-popular" style="position:absolute;top:16px;left:16px">${s.category}</span>
        </div>

        <div>
          <div class="detail-meta-pills">
            <span class="meta-pill">${s.category}</span>
            <span class="meta-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${s.duration || 60} минут
            </span>
            <span class="meta-pill">
              ${starsHtml(s.rating || 5)}
              <span style="font-weight:600;margin-left:4px">${Number(s.rating || 5).toFixed(1)}</span>
              <span style="color:var(--text-muted);font-size:.76rem">(${s.reviewCount || 0} отзывов)</span>
            </span>
          </div>

          <h1 style="font-size:clamp(1.8rem, 3.5vw, 2.4rem);font-weight:900;margin-bottom:16px;line-height:1.2">${s.name}</h1>
          
          <p style="font-size:1.02rem;color:var(--text-secondary);line-height:1.7;margin-bottom:20px">
            ${s.description || 'Профессиональная процедура груминга с использованием сертифицированной гипоаллергенной косметики.'}
          </p>

          <div class="detail-price-box">
            <div>
              <div style="font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Стоимость процедуры</div>
              <div class="detail-price-value">${formatPrice(s.price)}</div>
            </div>
            <a href="booking.html?service=${s.id}" class="btn btn-primary btn-xl" id="book-cta-btn">
              Записаться на процедуру
            </a>
          </div>

          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
              <div>
                <strong style="font-size:.86rem;display:block">Безопасная косметика</strong>
                <span style="font-size:.76rem;color:var(--text-muted)">Гипоаллергенные шампуни премиум-класса</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/></svg>
              </span>
              <div>
                <strong style="font-size:.86rem;display:block">Стерильный инструмент</strong>
                <span style="font-size:.76rem;color:var(--text-muted)">Сухожаровая обработка перед каждым клиентом</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </span>
              <div>
                <strong style="font-size:.86rem;display:block">Бережный подход</strong>
                <span style="font-size:.76rem;color:var(--text-muted)">Работаем без грубости и седации</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
              </span>
              <div>
                <strong style="font-size:.86rem;display:block">Точно ко времени</strong>
                <span style="font-size:.76rem;color:var(--text-muted)">Без очередей по предварительной записи</span>
              </div>
            </div>
          </div>

          ${s.tags && s.tags.length ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:20px;align-items:center">
              <span style="font-size:.8rem;color:var(--text-muted)">Теги:</span>
              ${s.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- REVIEWS SECTION -->
      <div class="reviews-section">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:1.35rem;font-weight:800;margin-bottom:4px">Отзывы клиентов</h2>
            <p style="font-size:.85rem;color:var(--text-secondary)">Мнения владельцев питомцев о данной процедуре</p>
          </div>
        </div>

        <!-- Add Review Form -->
        <div class="add-review-box">
          <h3 style="font-size:1.02rem;font-weight:700;margin-bottom:14px">Оставить отзыв</h3>
          <form id="detail-review-form">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px" class="form-row">
              <div>
                <label class="form-label">Ваше имя</label>
                <input class="form-control" type="text" id="rev-author" placeholder="Иван" required>
              </div>
              <div>
                <label class="form-label">Оценка</label>
                <div class="star-rating-input" id="detail-star-picker" style="padding-top:4px;display:flex;align-items:center;gap:4px">
                  ${[1, 2, 3, 4, 5].map(n => `
                    <button type="button" class="star-btn active" data-val="${n}" style="cursor:pointer;background:none;border:none;padding:2px">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                  `).join('')}
                  <span id="detail-star-label" style="font-weight:700;font-size:.84rem;color:#f59e0b;margin-left:8px">5 из 5 (Превосходно!)</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Текст отзыва</label>
              <textarea class="form-control" id="rev-text-input" placeholder="Опишите ваши впечатления от качества услуги..." rows="3" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" id="submit-review-btn">
              Опубликовать отзыв
            </button>
          </form>
        </div>

        <!-- Reviews List -->
        <div id="detail-reviews-list">
          <div class="spinner" style="margin:20px auto"></div>
        </div>
      </div>
    </div>
  `;

  setupStarPicker();
  setupReviewForm(s.id);
}

const DETAIL_RATING_LABELS = {
  1: '1 из 5 (Ужасно)',
  2: '2 из 5 (Плохо)',
  3: '3 из 5 (Нормально)',
  4: '4 из 5 (Хорошо)',
  5: '5 из 5 (Превосходно!)'
};

function updateDetailStars(val) {
  const stars = document.querySelectorAll('#detail-star-picker .star-btn');
  const label = document.getElementById('detail-star-label');
  stars.forEach((s) => {
    const starVal = parseInt(s.dataset.val);
    const svg = s.querySelector('svg');
    const filled = starVal <= val;
    if (svg) {
      svg.setAttribute('fill', filled ? '#f59e0b' : '#334155');
      svg.setAttribute('stroke', filled ? '#f59e0b' : '#64748b');
      svg.style.transform = filled ? 'scale(1.15)' : 'scale(1)';
      svg.style.transition = 'all 0.15s ease';
    }
  });
  if (label) {
    label.textContent = DETAIL_RATING_LABELS[val] || `${val} из 5`;
  }
}

function setupStarPicker() {
  const stars = document.querySelectorAll('#detail-star-picker .star-btn');
  stars.forEach(btn => {
    const val = parseInt(btn.dataset.val);
    btn.onmouseenter = () => updateDetailStars(val);
    btn.onmouseleave = () => updateDetailStars(selectedRating);
    btn.addEventListener('click', () => {
      selectedRating = val;
      updateDetailStars(selectedRating);
    });
  });
}

function setupReviewForm(serviceId) {
  const form = document.getElementById('detail-review-form');
  const nameInput = document.getElementById('rev-author');

  if (currentUser) {
    nameInput.value = currentUser.displayName || currentUser.email?.split('@')[0] || '';
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-review-btn');
    const author = nameInput.value.trim();
    const text = document.getElementById('rev-text-input').value.trim();

    if (!text || !author) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Отправка...';

    const newRev = {
      serviceId,
      userName: author,
      rating: selectedRating,
      text,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'reviews'), newRev);
      await recalculateRatings(serviceId, null);
      showToast('Отзыв опубликован! Рейтинг услуги обновлён', 'success');
      form.reset();
      selectedRating = 5;
    } catch (err) {
      console.error('Error adding review:', err);
      showToast('Ошибка публикации отзыва', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Опубликовать отзыв';
    }
  });
}

function initRealtimeReviews(serviceId) {
  if (reviewsUnsub) reviewsUnsub();

  const container = document.getElementById('detail-reviews-list');

  try {
    const q = query(
      collection(db, 'reviews'),
      where('serviceId', '==', serviceId)
    );

    reviewsUnsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:10px 0">Пока нет отзывов к этой услуге. Будьте первыми!</p>';
        return;
      }
      container.innerHTML = '';
      const sorted = snap.docs.slice().sort((a, b) => {
        const timeA = a.data().createdAt?.seconds || 0;
        const timeB = b.data().createdAt?.seconds || 0;
        return timeB - timeA;
      });
      sorted.forEach(docSnap => {
        container.appendChild(createReviewCard(docSnap.data()));
      });
    }, (err) => {
      console.error('Reviews realtime listener error:', err);
      container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:10px 0">Пока нет отзывов к этой услуге.</p>';
    });
  } catch (err) {
    console.error(err);
  }
}

function createReviewCard(r) {
  const el = document.createElement('div');
  el.className = 'review-card';
  const dateStr = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ru-RU') : 'Недавно';

  el.innerHTML = `
    <div class="review-head">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:.8rem">
          ${(r.userName || 'К')[0].toUpperCase()}
        </div>
        <div>
          <div class="review-user-name">${r.userName || 'Клиент'}</div>
          <div class="review-date">${dateStr}</div>
        </div>
      </div>
      <div class="review-stars">${starsHtml(r.rating || 5)}</div>
    </div>
    <p class="review-text" style="margin-top:8px">${r.text || ''}</p>
  `;
  return el;
}

// ─── Related Services ─────────────────────────────────────────
async function loadRelatedServices(currentSrv) {
  const grid = document.getElementById('related-services-grid');
  const pagWrap = document.getElementById('related-pagination-wrap');
  const loadMoreBtn = document.getElementById('related-load-more-btn');

  let list = [];
  try {
    const q = query(
      collection(db, 'services'),
      where('isActive', '==', true),
      limit(10)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      if (d.id !== currentSrv.id) list.push({ id: d.id, ...d.data() });
    });
  } catch (err) {
    console.error(err);
  }

  allRelatedServices = list;
  relatedPage = 1;
  renderRelatedPage(true);

  if (loadMoreBtn) {
    loadMoreBtn.onclick = () => {
      relatedPage++;
      renderRelatedPage(false);
    };
  }
}

function renderRelatedPage(reset = false) {
  const grid = document.getElementById('related-services-grid');
  const pagWrap = document.getElementById('related-pagination-wrap');

  if (reset) grid.innerHTML = '';

  const start = (relatedPage - 1) * RELATED_PER_PAGE;
  const pageItems = allRelatedServices.slice(start, start + RELATED_PER_PAGE);

  if (!pageItems.length && reset) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center">Нет похожих услуг</p>';
    pagWrap.style.display = 'none';
    return;
  }

  pageItems.forEach(s => {
    grid.appendChild(createRelatedCard(s));
  });

  const hasMore = start + RELATED_PER_PAGE < allRelatedServices.length;
  pagWrap.style.display = hasMore ? 'flex' : 'none';
}

function createRelatedCard(s) {
  const iconSvg = getCategoryIcon(s.category);
  const card = document.createElement('div');
  card.className = 'service-card';
  card.innerHTML = `
    <div class="card-img">
      <div class="card-img-placeholder" style="color:var(--color-purple-light)">${iconSvg}</div>
    </div>
    <div class="card-body">
      <div class="card-category">${s.category}</div>
      <h3 class="card-title">${s.name}</h3>
      <p class="card-desc">${s.description || ''}</p>
      <div class="card-meta">
        <div class="card-price">${formatPrice(s.price)}</div>
        <div class="card-rating">${starsHtml(s.rating || 5)} <span>${Number(s.rating || 5).toFixed(1)}</span></div>
      </div>
    </div>
    <div class="card-footer">
      <a href="service.html?id=${s.id}" class="btn btn-outline btn-sm">Подробнее</a>
      <a href="booking.html?service=${s.id}" class="btn btn-primary btn-sm">Записаться</a>
    </div>
  `;
  return card;
}
