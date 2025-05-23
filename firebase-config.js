import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJhK28e9SQnbIfBAnrMoGCSmRXBo0bFlw",
  authDomain: "lostcities-26967.firebaseapp.com",
  databaseURL: "https://lostcities-26967-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lostcities-26967",
  storageBucket: "lostcities-26967.appspot.com",
  messagingSenderId: "622409076274",
  appId: "1:622409076274:web:57f344b158c54862dbb62b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, onValue };
