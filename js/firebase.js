// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, ref, push, onValue, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDut3AnvIY81bzkZT8vTRVrU5-9zXIJSFo",
    authDomain: "tpm-utility.firebaseapp.com",
    databaseURL: "https://tpm-utility-default-rtdb.firebaseio.com",
    projectId: "tpm-utility",
    storageBucket: "tpm-utility.appspot.com",
    messagingSenderId: "467156319343",
    appId: "1:467156319343:web:baf3048911971bb07ca19a"
};

// Inisialisasi Firebase
export const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export helper Firebase
export { db, ref, push, onValue, query, orderByChild };
