import { initializeApp }
from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

const firebaseConfig = {

apiKey: "AIzaSyAd7VpIuHJEHc5qNwDoZ0vRsBd7vjzip10",

authDomain: "wedding-checkin-86d79.firebaseapp.com",

projectId: "wedding-checkin-86d79",

storageBucket: "wedding-checkin-86d79.firebasestorage.app",

messagingSenderId: "702309944497",

appId: "1:702309944497:web:7b1c2b6256778aea03e690"

};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export { db };