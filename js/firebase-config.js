import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/**
 * Replace with your Firebase project settings:
 * Firebase Console → Project settings → Your apps → Web app
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBxYwmDyGGsqBZRLXflV2TOy_26lEciyQ8",

  authDomain: "resqfood1-2c00f.firebaseapp.com",

  projectId: "resqfood1-2c00f",

  storageBucket: "resqfood1-2c00f.firebasestorage.app",

  messagingSenderId: "482867575507",

  appId: "1:482867575507:web:ea34f1e92d3d7a7ba5f226",

  measurementId: "G-LZWVN21TH3",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
