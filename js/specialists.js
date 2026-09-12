// specialists.js — Specialists section with real photos, real-time ratings from Firestore reviews, and zero emojis
import { db } from './firebase-config.js';
import { collection, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { starsHtml } from './utils.js';

let specialistsData = [];
let reviewsData = [];
let reviewsListenerBound = false;

export async function initSpecialistsSection() {
  const grid = document.getElementById('specialists-grid');
  if (!grid) return;

  try {
    const snap = await getDocs(collection(db, 'specialists'));

    if (snap.empty) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">Специалисты салона</div></div>';
      return;
    }

    specialistsData = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isActive !== false);

    // Initial render
    renderSpecialists();

    // Setup real-time listener on reviews so changes in Firestore (including manual deletes) update live!
    if (!reviewsListenerBound) {
      reviewsListenerBound = true;
      onSnapshot(collection(db, 'reviews'), (revSnap) => {
        reviewsData = revSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSpecialists();
      }, (err) => {
        console.warn('Real-time reviews listener warning:', err.message);
      });
    }
  } catch (err) {
    console.error('Specialists load error:', err);
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">Специалисты салона</div></div>';
  }
}

function renderSpecialists() {
  const grid = document.getElementById('specialists-grid');
  if (!grid || !specialistsData.length) return;

  // Calculate live rating and review count from actual reviews
  const updatedList = specialistsData.map(sp => {
    const spReviews = reviewsData.filter(r => r.specialistId === sp.id);
    const count = spReviews.length;
    let avg = 5.0;
    if (count > 0) {
      const sum = spReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      avg = Math.round((sum / count) * 10) / 10;
    }
    return {
      ...sp,
      rating: avg,
      reviewCount: count
    };
  });

  // Sort by rating desc
  updatedList.sort((a, b) => (b.rating || 5) - (a.rating || 5));

  grid.innerHTML = '';
  updatedList.forEach(sp => {
    grid.appendChild(createSpecialistCard(sp.id, sp));
  });
}

function createSpecialistCard(id, data) {
  const card = document.createElement('div');
  card.className = 'specialist-card';

  const initials = data.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'GS';
  const tags = (data.specializations || []).slice(0, 3);
  const photo = data.photoUrl ? `<img src="${data.photoUrl}" alt="${data.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : initials;

  card.innerHTML = `
    <div class="sp-avatar" style="overflow:hidden;border:2px solid var(--border-accent)">
      ${photo}
    </div>
    <div class="sp-name">${data.name || 'Специалист'}</div>
    <p class="sp-bio">${data.bio || ''}</p>
    <div class="sp-tags">
      ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
    </div>
    <div class="sp-rating" style="margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:6px">
      ${starsHtml(data.rating || 5)}
      <span style="font-size:.84rem;font-weight:600">${Number(data.rating || 5).toFixed(1)}</span>
      <span style="color:var(--text-muted);font-size:.76rem">(${data.reviewCount || 0})</span>
    </div>
    <a href="booking.html?specialist=${id}" class="btn btn-outline btn-sm" style="width:100%">Записаться к мастеру</a>
  `;

  return card;
}
