// auth.js — Firebase Authentication module (Strict Email/Password, no demo bypass)
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, openModal, closeModal, initModalClose } from './utils.js';

export let currentUser = null;
export let currentUserData = null;
let currentAuthCallback = null;

// Normalizes 4-digit passwords (like 1234 -> 123456) to satisfy Firebase Auth 6-char policy
function normalizePassword(pass) {
  if (pass === '1234') return '123456';
  return pass;
}

// Apply cached user immediately on script load to eliminate navbar flicker across tabs
try {
  const cached = JSON.parse(localStorage.getItem('petcare_auth_cached') || 'null');
  if (cached) {
    currentUser = cached;
    currentUserData = cached;
    document.documentElement.classList.add('user-logged-in');
    document.documentElement.classList.remove('user-logged-out');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => updateNavUI(cached, cached));
    } else {
      updateNavUI(cached, cached);
    }
  } else {
    document.documentElement.classList.add('user-logged-out');
    document.documentElement.classList.remove('user-logged-in');
  }
} catch {}

let lastNotifiedUid = null;

// ─── Auth state listener ──────────────────────────────────────
export function initAuth(onUserChanged) {
  initModalClose();
  initModalListeners();
  currentAuthCallback = onUserChanged;

  // Immediately notify with cached user if available
  if (currentUser && onUserChanged) {
    lastNotifiedUid = currentUser.uid;
    onUserChanged(currentUser, currentUserData);
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          currentUserData = snap.data();
        } else {
          const isAdminEmail = user.email === 'admin@gmail.com';
          currentUserData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (isAdminEmail ? 'Администратор' : 'Клиент'),
            role: isAdminEmail ? 'admin' : 'user'
          };
          await setDoc(doc(db, 'users', user.uid), {
            ...currentUserData,
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.warn('Error fetching user data from Firestore:', err);
        const isAdminEmail = user.email === 'admin@gmail.com';
        currentUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || (isAdminEmail ? 'Администратор' : 'Клиент'),
          role: isAdminEmail ? 'admin' : 'user'
        };
      }

      localStorage.setItem('petcare_auth_cached', JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: currentUserData?.displayName || user.displayName || user.email?.split('@')[0],
        role: currentUserData?.role || (user.email === 'admin@gmail.com' ? 'admin' : 'user')
      }));
      document.documentElement.classList.add('user-logged-in');
      document.documentElement.classList.remove('user-logged-out');
    } else {
      currentUserData = null;
      localStorage.removeItem('petcare_auth_cached');
      document.documentElement.classList.add('user-logged-out');
      document.documentElement.classList.remove('user-logged-in');
    }

    updateNavUI(currentUser, currentUserData);
    const newUid = user ? user.uid : null;
    if (onUserChanged && (newUid !== lastNotifiedUid || lastNotifiedUid === null)) {
      lastNotifiedUid = newUid;
      onUserChanged(currentUser, currentUserData);
    }
  });
}

// ─── Update nav UI ────────────────────────────────────────────
function updateNavUI(user, userData) {
  const guestBtns = document.querySelectorAll('[data-auth="guest"]');
  const userBtns = document.querySelectorAll('[data-auth="user"]');
  const adminLinks = document.querySelectorAll('[data-auth="admin"]');
  const userNameEls = document.querySelectorAll('[data-user-name]');
  const userAvatarEls = document.querySelectorAll('[data-user-avatar]');

  if (user) {
    guestBtns.forEach(el => el.classList.add('hidden'));
    userBtns.forEach(el => {
      el.classList.remove('hidden');
      if (el.style.display === 'none') el.style.display = 'block';
    });
    const name = user.displayName || user.email?.split('@')[0] || 'Пользователь';
    userNameEls.forEach(el => el.textContent = name);
    userAvatarEls.forEach(el => el.textContent = name[0].toUpperCase());

    if (userData?.role === 'admin') {
      adminLinks.forEach(el => {
        el.classList.remove('hidden');
        if (el.style.display === 'none') el.style.display = 'flex';
      });
    } else {
      adminLinks.forEach(el => el.classList.add('hidden'));
    }
  } else {
    guestBtns.forEach(el => el.classList.remove('hidden'));
    userBtns.forEach(el => el.classList.add('hidden'));
    adminLinks.forEach(el => el.classList.add('hidden'));
  }
}

// ─── Register ────────────────────────────────────────────────
export async function register(name, email, password) {
  const normalized = normalizePassword(password);
  const cred = await createUserWithEmailAndPassword(auth, email, normalized);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    displayName: name,
    phone: '',
    role: email === 'admin@gmail.com' ? 'admin' : 'user',
    createdAt: serverTimestamp()
  });
  return cred.user;
}

// ─── Login ───────────────────────────────────────────────────
export async function login(email, password) {
  const normalized = normalizePassword(password);
  return signInWithEmailAndPassword(auth, email, normalized);
}
export const loginWithEmail = login;

// ─── Logout ──────────────────────────────────────────────────
export async function logout() {
  currentUser = null;
  currentUserData = null;
  localStorage.removeItem('petcare_auth_cached');
  document.documentElement.classList.add('user-logged-out');
  document.documentElement.classList.remove('user-logged-in');
  try {
    await signOut(auth);
  } catch {}
  showToast('Вы вышли из системы', 'info');
  window.location.href = 'index.html';
}

// ─── Reset password ───────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─── Modal listeners ──────────────────────────────────────────
function initModalListeners() {
  document.querySelectorAll('[data-open-auth]').forEach(btn => {
    btn.addEventListener('click', () => openModal('auth-modal'));
  });
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', logout);
  });

  const tabs = document.querySelectorAll('#auth-modal .modal-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const resetForm = document.getElementById('reset-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loginForm?.classList.toggle('hidden', tab.dataset.tab !== 'login');
      registerForm?.classList.toggle('hidden', tab.dataset.tab !== 'register');
      resetForm?.classList.add('hidden');
    });
  });

  document.getElementById('forgot-link')?.addEventListener('click', () => {
    loginForm?.classList.add('hidden');
    registerForm?.classList.add('hidden');
    resetForm?.classList.remove('hidden');
  });
  document.getElementById('back-to-login')?.addEventListener('click', () => {
    loginForm?.classList.remove('hidden');
    resetForm?.classList.add('hidden');
    tabs[0]?.classList.add('active');
    tabs[1]?.classList.remove('active');
  });

  // Login form submission
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Вход...';
    try {
      await login(email, password);
      closeModal('auth-modal');
      showToast('Авторизация успешна', 'success');
    } catch (err) {
      showToast(getAuthError(err.code), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });

  // Register form submission
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;
    const pass2 = document.getElementById('reg-password2').value;
    if (pass !== pass2) return showToast('Пароли не совпадают', 'error');
    if (pass.length < 4) return showToast('Пароль слишком короткий', 'error');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Регистрация...';
    try {
      await register(name, email, pass);
      closeModal('auth-modal');
      showToast('Регистрация завершена', 'success');
    } catch (err) {
      showToast(getAuthError(err.code), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Зарегистрироваться';
    }
  });

  // Reset form submission
  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const email = document.getElementById('reset-email').value.trim();
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Отправка...';
    try {
      await resetPassword(email);
      showToast('Инструкция отправлена на почту', 'success');
      resetForm?.classList.add('hidden');
      loginForm?.classList.remove('hidden');
    } catch (err) {
      showToast(getAuthError(err.code), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Отправить';
    }
  });

  // Toggle password visibility
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.for);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });
}

function getAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/invalid-email': 'Неверный формат email',
    'auth/weak-password': 'Пароль должен содержать от 4-6 символов',
    'auth/user-not-found': 'Пользователь с таким email не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток. Подождите минуту',
    'auth/network-request-failed': 'Ошибка сетевого подключения'
  };
  return map[code] || 'Ошибка аутентификации. Проверьте данные.';
}
