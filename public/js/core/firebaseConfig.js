// Replace each value below with your Firebase project settings.
// Found in: Firebase Console → Project Settings → Your apps → SDK setup and configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  enableIndexedDbPersistence,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxZ6L3z8lv3lD5qkFs3Ssz2fxJpQliP5c",

  authDomain: "resqfood-ec8f5.firebaseapp.com",

  projectId: "resqfood-ec8f5",

  storageBucket: "resqfood-ec8f5.firebasestorage.app",

  messagingSenderId: "635865584832",

  appId: "1:635865584832:web:cf8f5a29c81780b3910925",

  measurementId: "G-KHT0ZD2MVM",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Enable offline persistence for Firestore (donations queue while offline)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Firestore persistence: multiple tabs open");
  } else if (err.code === "unimplemented") {
    console.warn("Firestore persistence: browser not supported");
  }
});

export { app, auth, db };
