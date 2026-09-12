// booking.js — Booking page with clean SVGs, Tenge currency and direct Firestore queries
import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, limit, getDocs, addDoc,
  doc, updateDoc, onSnapshot, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, openModal, closeModal, generateSlots, formatPrice, getCategoryIcon, getPetIcon, debounce } from './utils.js';

let selectedPet = null;
let selectedService = null;
let selectedSpecialist = null;
let selectedDate = null;
let selectedTime = null;
let currentStep = 1;
let cancelBookingId = null;
let myBookingsUnsub = null;

export async function initBookingPage(user) {
  await loadPets(user);
  await loadServices();

  if (!window.__bookingPageListenersBound) {
    window.__bookingPageListenersBound = true;
    setupDateInput();
    setupConfirmButton(user);
    setupAddPetForm(user);
    setupCancelModal();
    initMyBookingsRealtime(user.uid);
  }

  const params = new URLSearchParams(window.location.search);
  const preService = params.get('service');
  const preSpecialist = params.get('specialist');
  if (preSpecialist) {
    window.preselectedSpecialistId = preSpecialist;
  }
  if (preService) {
    setTimeout(() => preselectService(preService), 300);
  }
}

// ─── Steps ────────────────────────────────────────────────────
function goToStep(n) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`step-${i}`)?.classList.toggle('hidden', i !== n && i > currentStep);
    const stepEl = document.querySelector(`[data-step="${i}"]`);
    stepEl?.classList.toggle('active', i === n);
    stepEl?.classList.toggle('done', i < n);
  }
  if (n > currentStep) {
    document.getElementById(`step-${n}`)?.classList.remove('hidden');
  }
  currentStep = n;
}

// ─── Step 1: Pets ─────────────────────────────────────────────
async function loadPets(user) {
  const container = document.getElementById('pet-selection');
  try {
    const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    container.innerHTML = '';

    if (!snap.empty) {
      snap.forEach(docSnap => {
        const pet = { id: docSnap.id, ...docSnap.data() };
        container.appendChild(createPetSelectCard(pet));
      });
    } else {
      const promptCard = document.createElement('div');
      promptCard.style.cssText = 'grid-column: 1/-1; padding: 18px; background: var(--bg-glass-strong); border-radius: var(--radius-md); border: 1px dashed var(--border-accent); text-align: center; font-size: .88rem;';
      promptCard.innerHTML = 'У вас пока нет сохранённых питомцев. Нажмите «Добавить питомца» ниже, чтобы продолжить запись.';
      container.appendChild(promptCard);
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'pet-card pet-card-add';
    addBtn.innerHTML = '<div class="add-icon">+</div><div>Добавить питомца</div>';
    addBtn.addEventListener('click', () => openModal('add-pet-modal'));
    container.appendChild(addBtn);

    document.getElementById('add-pet-quick')?.addEventListener('click', () => openModal('add-pet-modal'));
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:var(--color-red)">Ошибка загрузки питомцев</p>';
  }
}

function createPetSelectCard(pet) {
  const card = document.createElement('div');
  card.className = 'pet-card';
  card.innerHTML = `
    <div style="color:var(--color-purple-light);margin-bottom:8px;display:flex;justify-content:center">${getPetIcon(pet.type)}</div>
    <div class="pet-name">${pet.name}</div>
    <div class="pet-breed">${pet.breed || pet.type}</div>
  `;
  card.addEventListener('click', () => {
    document.querySelectorAll('#pet-selection .pet-card').forEach(c => {
      c.style.borderColor = '';
      c.style.background = '';
    });
    card.style.borderColor = 'var(--color-purple)';
    card.style.background = 'rgba(124,58,237,.15)';
    selectedPet = pet;
    document.getElementById('s-pet').textContent = pet.name;
    goToStep(2);
  });
  return card;
}

// ─── Step 2: Services ─────────────────────────────────────────
async function loadServices(filter = '') {
  const container = document.getElementById('service-selection');
  if (!container) return;
  container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';

  try {
    const snap = await getDocs(collection(db, 'services'));
    container.innerHTML = '';

    let items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false);
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (filter) {
      items = items.filter(s => s.name.toLowerCase().includes(filter));
    }

    items.forEach(s => {
      container.appendChild(createServiceSelectItem(s));
    });

    if (!items.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;padding:10px">Услуги не найдены</p>';
    }

    document.getElementById('service-search')?.addEventListener('input', debounce((e) => {
      loadServices(e.target.value.trim().toLowerCase());
    }, 250));
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:var(--color-red)">Ошибка загрузки услуг</p>';
  }
}

function createServiceSelectItem(s) {
  const iconSvg = getCategoryIcon(s.category);
  const item = document.createElement('div');
  item.dataset.serviceId = s.id;
  item.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--border);cursor:pointer;transition:var(--transition-fast);background:var(--bg-glass)';
  item.innerHTML = `
    <div style="color:var(--color-purple-light);flex-shrink:0">${iconSvg}</div>
    <div style="flex:1">
      <div style="font-weight:700;font-size:.92rem">${s.name}</div>
      <div style="font-size:.78rem;color:var(--text-muted)">${s.category} · ${s.duration || 60} мин</div>
    </div>
    <div style="font-weight:800;font-size:1rem;background:var(--gradient-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap">${formatPrice(s.price)}</div>
  `;

  item.addEventListener('mouseenter', () => item.style.borderColor = 'rgba(124,58,237,.4)');
  item.addEventListener('mouseleave', () => { if (selectedService?.id !== s.id) item.style.borderColor = 'var(--border)'; });
  item.addEventListener('click', () => {
    document.querySelectorAll('#service-selection > div').forEach(el => {
      el.style.borderColor = 'var(--border)';
      el.style.background = 'var(--bg-glass)';
    });
    item.style.borderColor = 'var(--color-purple)';
    item.style.background = 'rgba(124,58,237,.12)';
    selectedService = s;
    document.getElementById('s-service').textContent = s.name;
    document.getElementById('s-price').textContent = formatPrice(s.price);
    document.getElementById('booking-duration').value = `${s.duration || 60} минут`;
    goToStep(3);
    loadSpecialists();
  });
  return item;
}

async function preselectService(serviceId) {
  const existing = document.querySelector(`[data-service-id="${serviceId}"]`);
  if (existing) {
    existing.click();
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'services', serviceId));
    if (snap.exists()) {
      createServiceSelectItem({ id: snap.id, ...snap.data() }).click();
    }
  } catch {}
}

// ─── Step 3: Specialists ──────────────────────────────────────
async function loadSpecialists() {
  const container = document.getElementById('specialist-selection');
  container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';

  try {
    const snap = await getDocs(collection(db, 'specialists'));
    container.innerHTML = '';

    let items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false);
    items.sort((a, b) => (b.rating || 5) - (a.rating || 5));

    items.forEach(s => {
      container.appendChild(createSpecialistSelectItem(s));
    });

    if (window.preselectedSpecialistId) {
      const target = container.querySelector(`[data-specialist-id="${window.preselectedSpecialistId}"]`);
      if (target) {
        target.click();
        window.preselectedSpecialistId = null;
      }
    }

    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--text-muted)">Специалисты не найдены</p>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:var(--color-red)">Ошибка загрузки специалистов</p>';
  }
}

function createSpecialistSelectItem(s) {
  const initials = s.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'GS';
  const photo = s.photoUrl ? `<img src="${s.photoUrl}" alt="${s.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initials;
  const item = document.createElement('div');
  item.dataset.specialistId = s.id;
  item.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px;border-radius:var(--radius-md);border:1px solid var(--border);cursor:pointer;transition:var(--transition-fast);background:var(--bg-glass)';
  item.innerHTML = `
    <div style="width:48px;height:48px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden">${photo}</div>
    <div style="flex:1">
      <div style="font-weight:700;font-size:.92rem">${s.name}</div>
      <div style="font-size:.78rem;color:var(--text-muted)">Рейтинг: ${Number(s.rating || 5).toFixed(1)} · ${(s.specializations || []).slice(0, 2).join(', ')}</div>
    </div>
    <div style="font-size:.75rem;color:var(--text-muted)">${s.reviewCount || 0} отз.</div>
  `;

  item.addEventListener('mouseenter', () => item.style.borderColor = 'rgba(124,58,237,.4)');
  item.addEventListener('mouseleave', () => { if (selectedSpecialist?.id !== s.id) item.style.borderColor = 'var(--border)'; });
  item.addEventListener('click', () => {
    document.querySelectorAll('#specialist-selection > div').forEach(el => {
      el.style.borderColor = 'var(--border)';
      el.style.background = 'var(--bg-glass)';
    });
    item.style.borderColor = 'var(--color-purple)';
    item.style.background = 'rgba(124,58,237,.12)';
    selectedSpecialist = s;
    document.getElementById('s-specialist').textContent = s.name;
    goToStep(4);
  });
  return item;
}

// ─── Step 4: Date & Time ──────────────────────────────────────
function setupDateInput() {
  const dateInput = document.getElementById('booking-date');
  if (!dateInput) return;
  const today = new Date();
  dateInput.min = today.toISOString().split('T')[0];
  dateInput.addEventListener('change', async () => {
    selectedDate = dateInput.value;
    selectedTime = null;
    document.getElementById('s-date').textContent = new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    document.getElementById('s-time').textContent = '—';
    document.getElementById('confirm-booking').disabled = true;
    await loadTimeSlots(selectedDate);
  });
}

async function loadTimeSlots(date) {
  const container = document.getElementById('time-slots');
  container.innerHTML = '<div class="spinner" style="grid-column:1/-1;margin:10px auto"></div>';

  let takenSlots = new Set();
  try {
    if (selectedSpecialist && selectedSpecialist.id) {
      try {
        const q = query(collection(db, 'bookings'), where('date', '==', date));
        const snap = await getDocs(q);
        takenSlots = new Set(
          snap.docs
            .map(d => d.data())
            .filter(b => b.specialistId === selectedSpecialist.id && ['pending', 'confirmed'].includes(b.status))
            .map(b => b.timeSlot)
        );
      } catch (errQ) {
        console.warn('Could not query bookings on date:', errQ);
      }
    }
  } catch (err) {
    console.warn('loadTimeSlots error:', err);
  }

  const slots = generateSlots(9, 19, 30);
  container.innerHTML = '';

  slots.forEach(slot => {
    const isTaken = takenSlots.has(slot);
    const btn = document.createElement('div');
    btn.className = `slot${isTaken ? ' slot-taken' : ''}`;
    btn.textContent = slot;
    if (!isTaken) {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.slot').forEach(s => s.classList.remove('slot-selected'));
        btn.classList.add('slot-selected');
        selectedTime = slot;
        document.getElementById('s-time').textContent = slot;
        document.getElementById('confirm-booking').disabled = false;
      });
    }
    container.appendChild(btn);
  });
}

// ─── Confirm booking ──────────────────────────────────────────
function setupConfirmButton(user) {
  document.getElementById('confirm-booking')?.addEventListener('click', async () => {
    if (!selectedPet || !selectedService || !selectedSpecialist || !selectedDate || !selectedTime) {
      return showToast('Заполните все шаги для бронирования', 'warning');
    }
    const btn = document.getElementById('confirm-booking');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Создаём запись...';

    const bookingPayload = {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || user.email,
      petId: selectedPet.id,
      petName: selectedPet.name,
      petType: selectedPet.type,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      specialistId: selectedSpecialist.id,
      specialistName: selectedSpecialist.name,
      date: selectedDate,
      timeSlot: selectedTime,
      duration: selectedService.duration || 60,
      notes: document.getElementById('booking-notes')?.value || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'bookings'), bookingPayload);
      showToast('Запись оформлена. Ждём вас в салоне', 'success');
      resetBookingForm();
    } catch (err) {
      console.error('Booking addDoc error:', err);
      showToast('Ошибка при создании записи', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Подтвердить запись';
    }
  });
}

function resetBookingForm() {
  selectedPet = selectedService = selectedSpecialist = selectedDate = selectedTime = null;
  currentStep = 1;
  ['s-pet', 's-service', 's-specialist', 's-date', 's-time', 's-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  for (let i = 1; i <= 4; i++) document.getElementById(`step-${i}`)?.classList.toggle('hidden', i !== 1);
  document.querySelectorAll('[data-step]').forEach((s, i) => {
    s.classList.toggle('active', i === 0);
    s.classList.remove('done');
  });
  document.getElementById('confirm-booking').disabled = true;
  document.getElementById('confirm-booking').textContent = 'Подтвердить запись';
}

// ─── My Bookings (real-time) ──────────────────────────────────
function initMyBookingsRealtime(uid) {
  if (myBookingsUnsub) myBookingsUnsub();
  try {
    const q = query(collection(db, 'bookings'), where('userId', '==', uid));
    myBookingsUnsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs.slice().sort((a, b) => ((b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0)));
      renderMyBookings(sorted);
    }, (err) => {
      console.error(err);
      renderMyBookings([]);
    });
  } catch {
    renderMyBookings([]);
  }
}

function renderMyBookings(docs) {
  const container = document.getElementById('my-bookings');
  if (!container) return;

  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px 16px"><div class="empty-title" style="font-size:.95rem">Нет активных записей</div><div style="font-size:.78rem;color:var(--text-muted)">Заполните форму слева, чтобы записаться</div></div>';
    return;
  }

  container.innerHTML = docs.map(d => {
    const b = { id: d.id, ...d.data() };
    const dateStr = b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—';
    const [day, mon] = dateStr.split(' ');
    const canCancel = ['pending', 'confirmed'].includes(b.status);
    return `
      <div class="booking-item">
        <div class="booking-date-block"><div class="booking-day">${day}</div><div class="booking-month">${mon || ''}</div></div>
        <div class="booking-info">
          <div class="booking-service-name">${b.serviceName}</div>
          <div class="booking-meta-row">
            <span class="booking-meta-item">${b.petName}</span>
            <span class="booking-meta-item">${b.specialistName}</span>
            <span class="booking-meta-item">${b.timeSlot}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span class="status status-${b.status}">${statusLabel(b.status)}</span>
            ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Отменить</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      cancelBookingId = btn.dataset.cancel;
      openModal('cancel-modal');
    });
  });
}

// ─── Cancel modal ─────────────────────────────────────────────
function setupCancelModal() {
  document.getElementById('cancel-no')?.addEventListener('click', () => closeModal('cancel-modal'));
  document.getElementById('cancel-yes')?.addEventListener('click', async () => {
    if (!cancelBookingId) return;
    try {
      await updateDoc(doc(db, 'bookings', cancelBookingId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      showToast('Запись отменена', 'info');
      closeModal('cancel-modal');
      cancelBookingId = null;
    } catch {
      showToast('Ошибка отмены записи', 'error');
    }
  });
}

// ─── Add Pet Form ─────────────────────────────────────────────
function setupAddPetForm(user) {
  const form = document.getElementById('add-pet-form');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const petObj = {
      ownerId: user.uid,
      name: document.getElementById('pet-name').value.trim(),
      type: document.getElementById('pet-type').value,
      breed: document.getElementById('pet-breed').value.trim(),
      age: parseInt(document.getElementById('pet-age').value) || 0,
      notes: document.getElementById('pet-notes').value.trim(),
      createdAt: serverTimestamp()
    };
    try {
      const docRef = await addDoc(collection(db, 'pets'), petObj);
      showToast('Питомец добавлен', 'success');
      closeModal('add-pet-modal');
      form.reset();
      await loadPets(user);
      selectedPet = { id: docRef.id, ...petObj };
      document.getElementById('s-pet').textContent = petObj.name;
      goToStep(2);
    } catch (err) {
      console.error(err);
      showToast('Ошибка сохранения питомца', 'error');
    } finally {
      form.dataset.submitting = 'false';
      btn.disabled = false;
      btn.textContent = 'Сохранить питомца';
    }
  });
}

function statusLabel(s) {
  return { pending: 'Ожидание', confirmed: 'Подтверждено', completed: 'Завершено', cancelled: 'Отменено' }[s] || s;
}
