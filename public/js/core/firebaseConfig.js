// Replace each value below with your Firebase project settings.
// Found in: Firebase Console → Project Settings → Your apps → SDK setup and configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  enableIndexedDbPersistence,
  getFirestore,
  connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  connectStorageEmulator,
  getStorage,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

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
const storage = getStorage(app);
const functions = getFunctions(app);
const hostname = location.hostname;
const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
const isPrivateLanIPv4 = /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/.test(hostname);
const isLocalDev = isLoopback || isPrivateLanIPv4;

if (isLocalDev) {
  try {
    connectAuthEmulator(auth, `http://${hostname}:9099`);
    connectFirestoreEmulator(db, hostname, 8080);
    connectStorageEmulator(storage, hostname, 9199);
    connectFunctionsEmulator(functions, hostname, 5001);
    console.log("Using Firebase emulators for local development.");
  } catch (err) {
    console.warn("Emulator connection skipped:", err);
  }
}

// Cache prior reads for offline viewing. Critical callable writes require a connection.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Firestore persistence: multiple tabs open");
  } else if (err.code === "unimplemented") {
    console.warn("Firestore persistence: browser not supported");
  }
});

export { app, auth, db, storage, functions, isLocalDev };
