// profile.js — Profile page logic with clean SVGs, zero emojis and Tenge currency
import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, limit, getDocs,
  doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { showToast, openModal, closeModal, formatPrice, getPetIcon, starsHtml, recalculateRatings } from './utils.js';

let profileBookingsUnsub = null;
let currentFilter = 'all';
let editingPetId = null;
let selectedRating = 5;

export async function initProfilePage(user) {
  const nameEl = document.getElementById('profile-name-display');
  const emailEl = document.getElementById('profile-email-display');
  const avatarEl = document.getElementById('profile-avatar-display');
  const name = user.displayName || user.email?.split('@')[0] || 'Пользователь';

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = name[0].toUpperCase();

  if (!window.__profilePageListenersBound) {
    window.__profilePageListenersBound = true;

    // Navigation tabs
    document.querySelectorAll('.profile-nav-item[data-section]').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.profile-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(`section-${item.dataset.section}`)?.classList.add('active');
        if (item.dataset.section === 'pets') loadPets(user.uid);
        if (item.dataset.section === 'reviews') loadReviews(user.uid);
        if (item.dataset.section === 'settings') loadSettings(user);
      });
    });

    // Booking filters
    document.querySelectorAll('#section-bookings .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#section-bookings .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        if (window.lastBookingsDocs) renderBookings(window.lastBookingsDocs);
      });
    });

    setupPetModal(user.uid);
    setupReviewModal(user.uid, user.displayName || user.email);
    setupSettingsForm(user);
  }

  initBookingsRealtime(user.uid);
}

// ─── Bookings (real-time) ─────────────────────────────────────
function initBookingsRealtime(uid) {
  if (profileBookingsUnsub) profileBookingsUnsub();
  const q = query(collection(db, 'bookings'), where('userId', '==', uid));
  profileBookingsUnsub = onSnapshot(q, (snap) => {
    const sorted = snap.docs.slice().sort((a, b) => ((b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0)));
    window.lastBookingsDocs = sorted;
    renderBookings(sorted);
  }, (err) => {
    console.error(err);
    renderBookings([]);
  });
}

function renderBookings(docs) {
  const container = document.getElementById('bookings-list');
  let filtered = docs;
  if (currentFilter !== 'all') {
    filtered = docs.filter(d => d.data().status === currentFilter);
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">Записей нет</div><div class="empty-text">В данном статусе записи отсутствуют</div><a href="booking.html" class="btn btn-primary" style="margin-top:16px">Записаться на груминг</a></div>`;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const b = { id: d.id, ...d.data() };
    const dateStr = b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—';
    const [day, mon] = dateStr.split(' ');
    const canCancel = ['pending', 'confirmed'].includes(b.status);
    const canReview = b.status === 'completed';

    return `
      <div class="booking-item">
        <div class="booking-date-block">
          <div class="booking-day">${day}</div>
          <div class="booking-month">${mon || ''}</div>
        </div>
        <div class="booking-info">
          <div class="booking-service-name">${b.serviceName}</div>
          <div class="booking-meta-row">
            <span class="booking-meta-item">Питомец: ${b.petName}</span>
            <span class="booking-meta-item">Мастер: ${b.specialistName}</span>
            <span class="booking-meta-item">Время: ${b.timeSlot}</span>
            <span class="booking-meta-item" style="font-weight:700;color:var(--color-purple-light)">${formatPrice(b.servicePrice)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px">
            <span class="status status-${b.status}">${statusLabel(b.status)}</span>
            ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Отменить</button>` : ''}
            ${canReview ? `<button class="btn btn-outline btn-sm" data-review="${b.id}" data-service="${b.serviceId}" data-specialist="${b.specialistId}">Оставить отзыв</button>` : ''}
          </div>
          ${b.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px">Примечание: ${b.notes}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Отменить запись на прием?')) return;
      try {
        await updateDoc(doc(db, 'bookings', btn.dataset.cancel), {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });
        showToast('Запись отменена', 'info');
      } catch (err) {
        console.error(err);
        showToast('Ошибка при отмене', 'error');
      }
    });
  });

  container.querySelectorAll('[data-review]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('rv-booking-id').value = btn.dataset.review;
      document.getElementById('rv-service-id').value = btn.dataset.service;
      document.getElementById('rv-specialist-id').value = btn.dataset.specialist;
      const sub = document.getElementById('rv-modal-subtitle');
      if (sub) sub.textContent = `Отзыв к записи: ${btn.dataset.serviceName || ''}`;
      const dropdowns = document.getElementById('rv-dropdowns-row');
      if (dropdowns) dropdowns.style.display = 'none';
      selectedRating = 5;
      document.getElementById('rv-rating').value = '5';
      updateRatingStarsDisplay(5);
      openModal('review-modal');
    });
  });
}

// ─── Pets ─────────────────────────────────────────────────────
async function loadPets(uid) {
  const container = document.getElementById('pets-list');
  container.innerHTML = '<div class="spinner" style="margin:20px auto;grid-column:1/-1"></div>';
  try {
    const q = query(collection(db, 'pets'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    container.innerHTML = '';

    snap.forEach(d => {
      const pet = { id: d.id, ...d.data() };
      const card = document.createElement('div');
      card.className = 'pet-card';
      card.innerHTML = `
        <div style="color:var(--color-purple-light);margin-bottom:8px;display:flex;justify-content:center">${getPetIcon(pet.type)}</div>
        <div class="pet-name">${pet.name}</div>
        <div class="pet-breed">${pet.breed || ''}${pet.age ? ', ' + pet.age + ' лет' : ''}</div>
      `;
      card.addEventListener('click', () => openPetModal(pet));
      container.appendChild(card);
    });

    const addCard = document.createElement('div');
    addCard.className = 'pet-card pet-card-add';
    addCard.innerHTML = '<div class="add-icon">+</div><div>Добавить питомца</div>';
    addCard.addEventListener('click', () => openPetModal(null));
    container.appendChild(addCard);

    document.getElementById('open-add-pet')?.addEventListener('click', () => openPetModal(null));
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:var(--color-red);grid-column:1/-1">Ошибка загрузки</p>';
  }
}

function openPetModal(pet) {
  editingPetId = pet?.id || null;
  document.getElementById('pet-modal-title').textContent = pet ? `Редактирование: ${pet.name}` : 'Новый питомец';
  document.getElementById('pet-form-id').value = pet?.id || '';
  document.getElementById('pf-name').value = pet?.name || '';
  document.getElementById('pf-type').value = pet?.type || 'dog';
  document.getElementById('pf-breed').value = pet?.breed || '';
  document.getElementById('pf-age').value = pet?.age || '';
  document.getElementById('pf-weight').value = pet?.weight || '';
  document.getElementById('pf-notes').value = pet?.notes || '';
  document.getElementById('delete-pet-btn').style.display = pet ? 'inline-block' : 'none';
  openModal('pet-modal');
}

function setupPetModal(uid) {
  const form = document.getElementById('pet-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const data = {
      ownerId: uid,
      name: document.getElementById('pf-name').value.trim(),
      type: document.getElementById('pf-type').value,
      breed: document.getElementById('pf-breed').value.trim(),
      age: parseInt(document.getElementById('pf-age').value) || 0,
      weight: parseFloat(document.getElementById('pf-weight').value) || 0,
      notes: document.getElementById('pf-notes').value.trim(),
      updatedAt: serverTimestamp()
    };
    try {
      if (editingPetId) {
        await updateDoc(doc(db, 'pets', editingPetId), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'pets'), data);
      }
      showToast(editingPetId ? 'Данные обновлены' : 'Питомец добавлен', 'success');
      closeModal('pet-modal');
      loadPets(uid);
    } catch (err) {
      console.error(err);
      showToast('Ошибка сохранения', 'error');
    } finally {
      form.dataset.submitting = 'false';
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  });

  const delBtn = document.getElementById('delete-pet-btn');
  if (delBtn && !delBtn.dataset.bound) {
    delBtn.dataset.bound = 'true';
    delBtn.addEventListener('click', async () => {
      if (!editingPetId || !confirm('Удалить профиль питомца?')) return;
      try {
        await deleteDoc(doc(db, 'pets', editingPetId));
        showToast('Питомец удалён', 'info');
        closeModal('pet-modal');
        loadPets(uid);
      } catch (err) {
        console.error(err);
        showToast('Ошибка удаления', 'error');
      }
    });
  }
}

// ─── Reviews ──────────────────────────────────────────────────
const RATING_DESCRIPTIONS = {
  1: '1 из 5 · Ужасно',
  2: '2 из 5 · Плохо',
  3: '3 из 5 · Нормально',
  4: '4 из 5 · Хорошо',
  5: '5 из 5 · Превосходно!'
};

function updateRatingStarsDisplay(val) {
  const stars = document.querySelectorAll('#star-rating .star-btn');
  const label = document.getElementById('star-rating-label');
  stars.forEach((s) => {
    const starVal = parseInt(s.dataset.val);
    const svg = s.querySelector('svg');
    const filled = starVal <= val;
    if (svg) {
      svg.setAttribute('fill', filled ? '#f59e0b' : '#334155');
      svg.setAttribute('stroke', filled ? '#f59e0b' : '#64748b');
      svg.style.transform = filled ? 'scale(1.12)' : 'scale(1)';
      svg.style.transition = 'all 0.15s ease';
    }
  });
  if (label) {
    label.textContent = RATING_DESCRIPTIONS[val] || `${val} из 5`;
  }
}

async function loadReviews(uid) {
  const container = document.getElementById('reviews-list');
  container.innerHTML = '<div class="spinner" style="margin:20px auto;display:block;width:fit-content"></div>';
  try {
    const q = query(collection(db, 'reviews'), where('userId', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><div class="empty-title">Нет отзывов</div><div class="empty-text">Вы пока не оставляли отзывов. Нажмите кнопку «+ Написать отзыв» выше.</div></div>';
      return;
    }
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    reviews.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));

    container.innerHTML = reviews.map(r => {
      return `
        <div class="review-card">
          <div class="review-head">
            <div>
              <div class="review-user-name" style="font-weight:700">${r.serviceName || 'Процедура груминга'}</div>
              <div style="font-size:.82rem;color:var(--color-purple-light);margin-top:2px">Мастер: <strong>${r.specialistName || 'Специалист PetCare'}</strong></div>
              <div class="review-date">${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ru-RU') : ''}</div>
            </div>
            <button class="btn btn-danger btn-sm" data-del-review="${r.id}">Удалить</button>
          </div>
          <div class="review-stars" style="margin:8px 0">${starsHtml(r.rating || 5)} <span style="font-size:.82rem;font-weight:600;margin-left:4px">${Number(r.rating || 5).toFixed(1)} / 5</span></div>
          <p class="review-text" style="line-height:1.5">${r.text}</p>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-del-review]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        
        // Two-step inline confirmation (bypasses blocked confirm dialogs)
        if (btn.dataset.confirming !== 'true') {
          btn.dataset.confirming = 'true';
          const originalText = btn.textContent;
          btn.textContent = 'Точно удалить?';
          btn.style.backgroundColor = '#dc2626';
          btn.style.borderColor = '#dc2626';
          setTimeout(() => {
            if (btn.dataset.confirming === 'true') {
              btn.dataset.confirming = 'false';
              btn.textContent = originalText;
              btn.style.backgroundColor = '';
              btn.style.borderColor = '';
            }
          }, 3500);
          return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>';
        try {
          const revId = btn.dataset.delReview;
          let revData = null;
          try {
            const revSnap = await getDoc(doc(db, 'reviews', revId));
            if (revSnap.exists()) revData = revSnap.data();
          } catch {}

          await deleteDoc(doc(db, 'reviews', revId));

          if (revData) {
            try {
              await recalculateRatings(revData.serviceId, revData.specialistId);
            } catch (rErr) {
              console.warn('Recalculate error:', rErr);
            }
          }

          showToast('Отзыв успешно удалён', 'info');
          loadReviews(uid);
        } catch (err) {
          console.error('Delete review error:', err);
          showToast('Ошибка удаления: ' + (err.message || 'нет доступа'), 'error');
          btn.disabled = false;
          btn.textContent = 'Удалить';
          btn.dataset.confirming = 'false';
        }
      };
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:var(--color-red)">Ошибка загрузки отзывов</p>';
  }
}

function setupReviewModal(uid, userName) {
  // Wire manual add review button
  const manualAddBtn = document.getElementById('open-add-review-btn');
  if (manualAddBtn && !manualAddBtn.dataset.bound) {
    manualAddBtn.dataset.bound = 'true';
    manualAddBtn.addEventListener('click', () => {
      document.getElementById('rv-booking-id').value = '';
      document.getElementById('rv-service-id').value = '';
      document.getElementById('rv-specialist-id').value = '';
      const sub = document.getElementById('rv-modal-subtitle');
      if (sub) sub.textContent = 'Оцените мастера и качество услуг PetCare';
      const dropdowns = document.getElementById('rv-dropdowns-row');
      if (dropdowns) dropdowns.style.display = 'flex';
      selectedRating = 5;
      document.getElementById('rv-rating').value = '5';
      updateRatingStarsDisplay(5);
      openModal('review-modal');
    });
  }

  const form = document.getElementById('review-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  const stars = document.querySelectorAll('#star-rating .star-btn');
  stars.forEach(star => {
    const val = parseInt(star.dataset.val);
    star.onmouseenter = () => updateRatingStarsDisplay(val);
    star.onmouseleave = () => updateRatingStarsDisplay(selectedRating);
    star.onclick = () => {
      selectedRating = val;
      document.getElementById('rv-rating').value = selectedRating;
      updateRatingStarsDisplay(selectedRating);
    };
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Публикуем...';
    try {
      const bookingId = document.getElementById('rv-booking-id').value || null;
      let serviceId = document.getElementById('rv-service-id').value;
      let specialistId = document.getElementById('rv-specialist-id').value;
      let serviceName = '';
      let specialistName = '';

      if (!serviceId) {
        const sSelect = document.getElementById('rv-service-select');
        serviceId = sSelect.value;
        const opt = sSelect.options[sSelect.selectedIndex];
        serviceName = opt?.dataset.name || opt?.text || 'Услуга груминга';
      }
      if (!specialistId) {
        const spSelect = document.getElementById('rv-specialist-select');
        specialistId = spSelect.value;
        const opt = spSelect.options[spSelect.selectedIndex];
        specialistName = opt?.dataset.name || opt?.text || 'Специалист салона';
      }

      await addDoc(collection(db, 'reviews'), {
        bookingId: bookingId || '',
        serviceId,
        serviceName: serviceName || 'Процедура груминга',
        specialistId,
        specialistName: specialistName || 'Мастер PetCare',
        userId: uid,
        userName: userName || 'Клиент PetCare',
        rating: selectedRating,
        text: document.getElementById('rv-text').value.trim(),
        createdAt: serverTimestamp()
      });

      if (serviceId || specialistId) {
        try {
          await recalculateRatings(serviceId, specialistId);
        } catch (rErr) {
          console.warn('Recalculate error:', rErr);
        }
      }

      showToast('Отзыв опубликован! Рейтинг обновлен', 'success');
      closeModal('review-modal');
      document.getElementById('rv-text').value = '';
      loadReviews(uid);
    } catch (err) {
      console.error(err);
      showToast('Ошибка публикации отзыва', 'error');
    } finally {
      form.dataset.submitting = 'false';
      btn.disabled = false;
      btn.textContent = 'Опубликовать отзыв';
    }
  });
}

// ─── Settings ─────────────────────────────────────────────────
async function loadSettings(user) {
  document.getElementById('settings-name').value = user.displayName || '';
  document.getElementById('settings-email').value = user.email || '';
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      document.getElementById('settings-phone').value = snap.data().phone || '';
    }
  } catch {}
}

function setupSettingsForm(user) {
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Сохраняем...';
    const name = document.getElementById('settings-name').value.trim();
    const phone = document.getElementById('settings-phone').value.trim();
    try {
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        phone,
        updatedAt: serverTimestamp()
      });
      document.getElementById('profile-name-display').textContent = name;
      document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = name);
      showToast('Профиль успешно обновлён', 'success');
    } catch (err) {
      console.error(err);
      showToast('Ошибка сохранения профиля', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить изменения';
    }
  });
}

function statusLabel(s) {
  return { pending: 'Ожидание', confirmed: 'Подтверждено', completed: 'Завершено', cancelled: 'Отменено' }[s] || s;
}
