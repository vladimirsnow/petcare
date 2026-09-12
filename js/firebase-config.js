// firebase-config.js
// !!! ЗАПОЛНИ СВОИМИ ДАННЫМИ ИЗ FIREBASE CONSOLE !!!
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyC0QVdfQ6BMtjjzeKgIRCg6sgAHlY_PVqk",
  authDomain: "petsim-51d9f.firebaseapp.com",
  projectId: "petsim-51d9f",
  storageBucket: "petsim-51d9f.firebasestorage.app",
  messagingSenderId: "203091726416",
  appId: "1:203091726416:web:fecb5674e13bc6bff48155",
  measurementId: "G-ZWBHCY28DH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
