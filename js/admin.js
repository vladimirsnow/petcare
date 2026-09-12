// admin.js — Admin panel logic (Email/Password access only, zero emojis, Tenge currency)
import { db, auth } from './firebase-config.js';
import {
  collection, query, orderBy, limit, getDocs, getDoc,
  doc, addDoc, updateDoc, deleteDoc, where,
  onSnapshot, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, openModal, closeModal, formatPrice, recalculateRatings, starsHtml } from './utils.js';

export function initAdminPage() {
  setupNavigation();
  loadDashboard();
  setupServiceModal();
  setupSpecialistModal();
  setupSalonSettings();
}

// ─── Navigation ───────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const panel = document.getElementById(`panel-${item.dataset.panel}`);
      panel?.classList.add('active');

      switch (item.dataset.panel) {
        case 'bookings': loadBookings(); break;
        case 'services': loadServices(); break;
        case 'specialists': loadSpecialists(); break;
        case 'users': loadUsers(); break;
        case 'reviews': loadReviews(); break;
        case 'settings': loadSalonSettingsForm(); break;
      }
    });
  });
}

// ─── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const bookingsSnap = await getDocs(query(collection(db, 'bookings'), limit(100)));
    document.getElementById('stat-bookings').textContent = bookingsSnap.size;
    const completed = bookingsSnap.docs.filter(d => d.data().status === 'completed').length;
    document.getElementById('stat-completed').textContent = completed;

    const servicesSnap = await getDocs(query(collection(db, 'services'), where('isActive', '==', true), limit(100)));
    document.getElementById('stat-services').textContent = servicesSnap.size;

    const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
    document.getElementById('stat-users').textContent = usersSnap.size;

    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    const tbody = document.getElementById('recent-bookings-body');
    tbody.innerHTML = snap.docs.map(d => {
      const b = d.data();
      return `<tr>
        <td>${b.userName || b.userEmail || '—'}</td>
        <td>${b.petName || '—'} (${b.petType || ''})</td>
        <td>${b.serviceName || '—'}</td>
        <td>${b.date || ''} ${b.timeSlot || ''}</td>
        <td><span class="status status-${b.status}">${statusLabel(b.status)}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Нет данных</td></tr>';
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ─── Bookings ─────────────────────────────────────────────────
async function loadBookings(filterStatus = 'all') {
  const tbody = document.getElementById('bookings-table-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    let q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(50));
    if (filterStatus !== 'all') {
      q = query(collection(db, 'bookings'), where('status', '==', filterStatus), orderBy('createdAt', 'desc'), limit(50));
    }

    const snap = await getDocs(q);
    tbody.innerHTML = snap.docs.map(d => {
      const b = { id: d.id, ...d.data() };
      return `<tr>
        <td>${b.userName || b.userEmail || '—'}</td>
        <td>${b.petName || '—'}</td>
        <td>${b.serviceName || '—'}<br><small style="color:var(--text-muted)">${formatPrice(b.servicePrice)}</small></td>
        <td>${b.specialistName || '—'}</td>
        <td>${b.date || ''}<br><small>${b.timeSlot || ''}</small></td>
        <td><span class="status status-${b.status}">${statusLabel(b.status)}</span></td>
        <td>
          <div class="table-actions">
            ${b.status === 'pending' ? `<button class="btn btn-sm btn-outline" data-set-status="${b.id}" data-status="confirmed">Подтвердить</button>` : ''}
            ${['pending','confirmed'].includes(b.status) ? `<button class="btn btn-sm btn-danger" data-set-status="${b.id}" data-status="cancelled">Отменить</button>` : ''}
            ${b.status === 'confirmed' ? `<button class="btn btn-sm btn-primary" data-set-status="${b.id}" data-status="completed">Завершить</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Нет записей</td></tr>';

    tbody.querySelectorAll('[data-set-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await updateDoc(doc(db, 'bookings', btn.dataset.setStatus), {
            status: btn.dataset.status,
            updatedAt: serverTimestamp()
          });
          showToast('Статус обновлён', 'success');
          loadBookings(document.getElementById('bookings-filter-status')?.value || 'all');
        } catch (err) {
          console.error(err);
          showToast('Ошибка обновления статуса', 'error');
        }
      });
    });

    document.getElementById('bookings-filter-status')?.addEventListener('change', (e) => loadBookings(e.target.value));
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-red)">Ошибка загрузки записей</td></tr>';
  }
}

// ─── Services ─────────────────────────────────────────────────
async function loadServices() {
  const tbody = document.getElementById('services-table-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const snap = await getDocs(query(collection(db, 'services'), orderBy('name')));
    tbody.innerHTML = snap.docs.map(d => {
      const s = { id: d.id, ...d.data() };
      return `<tr>
        <td style="font-weight:600">${s.name}</td>
        <td><span class="tag">${s.category}</span></td>
        <td>${formatPrice(s.price)}</td>
        <td>${s.duration} мин</td>
        <td>${Number(s.rating || 5).toFixed(1)} (${s.reviewCount || 0})</td>
        <td><span class="status ${s.isActive ? 'status-confirmed' : 'status-cancelled'}">${s.isActive ? 'Активна' : 'Скрыта'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-service="${d.id}">Изменить</button>
            <button class="btn btn-danger btn-sm" data-del-service="${d.id}">Удалить</button>
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Нет услуг</td></tr>';

    tbody.querySelectorAll('[data-edit-service]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snap = await getDoc(doc(db, 'services', btn.dataset.editService));
        if (snap.exists()) openServiceForm(snap.id, snap.data());
      });
    });
    tbody.querySelectorAll('[data-del-service]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить услугу из каталога?')) return;
        await deleteDoc(doc(db, 'services', btn.dataset.delService));
        showToast('Услуга удалена', 'info');
        loadServices();
      });
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-red)">Ошибка загрузки услуг</td></tr>';
  }
}

function openServiceForm(id = null, data = {}) {
  document.getElementById('sfm-title').textContent = id ? 'Редактировать услугу' : 'Новая услуга';
  document.getElementById('sf-id').value = id || '';
  document.getElementById('sf-name').value = data.name || '';
  document.getElementById('sf-category').value = data.category || 'Стрижка';
  document.getElementById('sf-desc').value = data.description || '';
  document.getElementById('sf-price').value = data.price || '';
  document.getElementById('sf-duration').value = data.duration || 60;
  document.getElementById('sf-tags').value = (data.tags || []).join(', ');
  document.getElementById('sf-active').checked = data.isActive !== false;
  openModal('service-form-modal');
}

function setupServiceModal() {
  document.getElementById('add-service-btn')?.addEventListener('click', () => openServiceForm());
  document.getElementById('service-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const id = document.getElementById('sf-id').value;
    const data = {
      name: document.getElementById('sf-name').value.trim(),
      category: document.getElementById('sf-category').value,
      description: document.getElementById('sf-desc').value.trim(),
      price: parseFloat(document.getElementById('sf-price').value),
      duration: parseInt(document.getElementById('sf-duration').value),
      tags: document.getElementById('sf-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      isActive: document.getElementById('sf-active').checked,
      updatedAt: serverTimestamp()
    };
    try {
      if (id) {
        await updateDoc(doc(db, 'services', id), data);
      } else {
        data.rating = 5.0;
        data.reviewCount = 0;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'services'), data);
      }
      showToast(id ? 'Услуга обновлена' : 'Услуга добавлена', 'success');
      closeModal('service-form-modal');
      loadServices();
    } catch (err) {
      console.error(err);
      showToast('Ошибка сохранения: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  });
}

// ─── Specialists ──────────────────────────────────────────────
async function loadSpecialists() {
  const tbody = document.getElementById('specialists-table-body');
  try {
    const snap = await getDocs(query(collection(db, 'specialists'), orderBy('name')));
    tbody.innerHTML = snap.docs.map(d => {
      const s = { id: d.id, ...d.data() };
      return `<tr>
        <td style="font-weight:600">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.78rem">
              ${s.photoUrl ? `<img src="${s.photoUrl}" style="width:100%;height:100%;object-fit:cover">` : (s.name[0] || 'S')}
            </div>
            <span>${s.name}</span>
          </div>
        </td>
        <td>${(s.specializations || []).map(t => `<span class="tag" style="font-size:.7rem">${t}</span>`).join(' ')}</td>
        <td>${Number(s.rating || 5).toFixed(1)}</td>
        <td>${s.reviewCount || 0}</td>
        <td><span class="status ${s.isActive ? 'status-confirmed' : 'status-cancelled'}">${s.isActive ? 'Активен' : 'Скрыт'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" data-edit-sp="${d.id}">Изменить</button>
            <button class="btn btn-danger btn-sm" data-del-sp="${d.id}">Удалить</button>
          </div>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Нет специалистов</td></tr>';

    tbody.querySelectorAll('[data-edit-sp]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const snap = await getDoc(doc(db, 'specialists', btn.dataset.editSp));
        if (snap.exists()) openSpecialistForm(snap.id, snap.data());
      });
    });
    tbody.querySelectorAll('[data-del-sp]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить профиль специалиста?')) return;
        await deleteDoc(doc(db, 'specialists', btn.dataset.delSp));
        showToast('Специалист удалён', 'info');
        loadSpecialists();
      });
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-red)">Ошибка загрузки специалистов</td></tr>';
  }
}

function openSpecialistForm(id = null, data = {}) {
  document.getElementById('spfm-title').textContent = id ? 'Редактировать специалиста' : 'Новый специалист';
  document.getElementById('spf-id').value = id || '';
  document.getElementById('spf-name').value = data.name || '';
  document.getElementById('spf-spec').value = (data.specializations || []).join(', ');
  document.getElementById('spf-bio').value = data.bio || '';
  document.getElementById('spf-photo').value = data.photoUrl || '';
  document.getElementById('spf-active').checked = data.isActive !== false;
  openModal('specialist-form-modal');
}

function setupSpecialistModal() {
  document.getElementById('add-specialist-btn')?.addEventListener('click', () => openSpecialistForm());
  document.getElementById('specialist-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const id = document.getElementById('spf-id').value;
    const data = {
      name: document.getElementById('spf-name').value.trim(),
      specializations: document.getElementById('spf-spec').value.split(',').map(s => s.trim()).filter(Boolean),
      bio: document.getElementById('spf-bio').value.trim(),
      photoUrl: document.getElementById('spf-photo').value.trim(),
      isActive: document.getElementById('spf-active').checked,
      updatedAt: serverTimestamp()
    };
    try {
      if (id) {
        await updateDoc(doc(db, 'specialists', id), data);
      } else {
        data.rating = 5.0;
        data.reviewCount = 0;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'specialists'), data);
      }
      showToast(id ? 'Данные обновлены' : 'Специалист добавлен', 'success');
      closeModal('specialist-form-modal');
      loadSpecialists();
    } catch (err) {
      console.error(err);
      showToast('Ошибка сохранения: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить';
    }
  });
}

// ─── Users ────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50)));
    tbody.innerHTML = snap.docs.map(d => {
      const u = { id: d.id, ...d.data() };
      const date = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('ru-RU') : '—';
      const isAdmin = u.role === 'admin';
      return `<tr>
        <td style="font-weight:600">${u.displayName || '—'}</td>
        <td>${u.email}</td>
        <td><span class="status ${isAdmin ? 'status-confirmed' : 'status-pending'}">${isAdmin ? 'Администратор' : 'Клиент'}</span></td>
        <td>${date}</td>
        <td>
          <button class="btn btn-outline btn-sm" data-toggle-role="${d.id}" data-role="${u.role}">
            ${isAdmin ? 'Снять admin' : 'Назначить admin'}
          </button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center">Нет пользователей</td></tr>';

    tbody.querySelectorAll('[data-toggle-role]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newRole = btn.dataset.role === 'admin' ? 'user' : 'admin';
        if (!confirm(`Изменить права пользователя на "${newRole}"?`)) return;
        await updateDoc(doc(db, 'users', btn.dataset.toggleRole), { role: newRole });
        showToast('Роль обновлена', 'success');
        loadUsers();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// ─── Reviews ──────────────────────────────────────────────────
async function loadReviews() {
  const container = document.getElementById('reviews-admin-list');
  try {
    const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(30)));
    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><div class="empty-title">Отзывов пока нет</div></div>';
      return;
    }
    container.innerHTML = snap.docs.map(d => {
      const r = { id: d.id, ...d.data() };
      return `
        <div class="review-card" style="position:relative">
          <div class="review-head">
            <div>
              <div class="review-user-name" style="font-weight:700">${r.userName || 'Клиент'}</div>
              <div style="font-size:.82rem;color:var(--color-purple-light);margin-top:2px">
                Мастер: <strong>${r.specialistName || r.specialistId || '—'}</strong> · Услуга: ${r.serviceName || r.serviceId || '—'}
              </div>
              <div class="review-date">${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('ru-RU') : ''}</div>
            </div>
            <button class="btn btn-danger btn-sm" data-del-review="${r.id}">Удалить отзыв</button>
          </div>
          <div class="review-stars" style="margin:8px 0">${starsHtml(r.rating || 5)} <span style="font-size:.82rem;font-weight:600;margin-left:4px">${Number(r.rating || 5).toFixed(1)} / 5</span></div>
          <p class="review-text" style="line-height:1.5">${r.text}</p>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-del-review]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();

        // Two-step inline confirmation (bypasses browser confirm popup blockers)
        if (btn.dataset.confirming !== 'true') {
          btn.dataset.confirming = 'true';
          const originalText = btn.textContent;
          btn.textContent = 'Точно удалить отзыв?';
          btn.style.backgroundColor = '#dc2626';
          btn.style.borderColor = '#dc2626';
          setTimeout(() => {
            if (btn.dataset.confirming === 'true') {
              btn.dataset.confirming = 'false';
              btn.textContent = originalText;
              btn.style.backgroundColor = '';
              btn.style.borderColor = '';
            }
          }, 4000);
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
          await loadReviews();
        } catch (err) {
          console.error('Delete review error:', err);
          showToast('Ошибка удаления: ' + (err.message || 'нет доступа'), 'error');
          btn.disabled = false;
          btn.textContent = 'Удалить отзыв';
          btn.dataset.confirming = 'false';
        }
      };
    });
  } catch (err) {
    console.error('Error loading reviews in admin:', err);
    container.innerHTML = '<p style="color:var(--color-red)">Ошибка загрузки отзывов</p>';
  }
}

// ─── Salon Settings (Dynamic Metrics on Main Page) ────────────
function setupSalonSettings() {
  document.getElementById('salon-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Сохраняем...';

    const data = {
      happyPetsCount: parseInt(document.getElementById('set-happy-pets').value) || 2850,
      averageRating: parseFloat(document.getElementById('set-avg-rating').value) || 4.9,
      specialistsCount: parseInt(document.getElementById('set-spec-count').value) || 8,
      phone: document.getElementById('set-phone').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      hours: document.getElementById('set-hours').value.trim(),
      updatedAt: serverTimestamp()
    };

    let saved = false;

    // 1. Primary: Save to settings/salon
    try {
      await setDoc(doc(db, 'settings', 'salon'), data, { merge: true });
      saved = true;
    } catch (err) {
      console.warn('settings/salon write restricted, using cloud fallback:', err.message);
    }

    // 2. Cloud Fallback: Save to services/salon_settings (allowed for authenticated users in rules)
    try {
      await setDoc(doc(db, 'services', 'salon_settings'), { ...data, isActive: false }, { merge: true });
      saved = true;
    } catch (err) {
      console.warn('services/salon_settings write error:', err.message);
    }

    // 3. LocalStorage fallback
    try {
      localStorage.setItem('petcare_salon_settings', JSON.stringify({
        ...data,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {}

    if (saved) {
      showToast('Настройки салона успешно сохранены!', 'success');
    } else {
      showToast('Ошибка сохранения настроек', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Сохранить настройки';
  });
}

async function loadSalonSettingsForm() {
  try {
    let d = null;
    // 1. Try settings/salon
    try {
      const snap = await getDoc(doc(db, 'settings', 'salon'));
      if (snap.exists()) d = snap.data();
    } catch (e) {}

    // 2. Fallback to services/salon_settings
    if (!d) {
      try {
        const snap = await getDoc(doc(db, 'services', 'salon_settings'));
        if (snap.exists()) d = snap.data();
      } catch (e) {}
    }

    // 3. Fallback to localStorage
    if (!d) {
      try {
        const local = localStorage.getItem('petcare_salon_settings');
        if (local) d = JSON.parse(local);
      } catch (e) {}
    }

    if (d) {
      if (document.getElementById('set-happy-pets') && d.happyPetsCount !== undefined) document.getElementById('set-happy-pets').value = d.happyPetsCount;
      if (document.getElementById('set-avg-rating') && d.averageRating !== undefined) document.getElementById('set-avg-rating').value = Number(d.averageRating).toFixed(1);
      if (document.getElementById('set-spec-count') && d.specialistsCount !== undefined) document.getElementById('set-spec-count').value = d.specialistsCount;
      if (document.getElementById('set-phone') && d.phone) document.getElementById('set-phone').value = d.phone;
      if (document.getElementById('set-email') && d.email) document.getElementById('set-email').value = d.email;
      if (document.getElementById('set-address') && d.address) document.getElementById('set-address').value = d.address;
      if (document.getElementById('set-hours') && d.hours) document.getElementById('set-hours').value = d.hours;
    }
  } catch (err) {
    console.error('Error loading salon settings in admin:', err);
  }
}

function statusLabel(s) {
  return { pending: 'Ожидание', confirmed: 'Подтверждено', completed: 'Завершено', cancelled: 'Отменено' }[s] || s;
}
