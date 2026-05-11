// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBXzpbosH8h_0fQEGnyRPXHRMamDUL33ls",
  authDomain: "doctor-c8c72.firebaseapp.com",
  projectId: "doctor-c8c72",
  storageBucket: "doctor-c8c72.firebasestorage.app",
  messagingSenderId: "246481479591",
  appId: "1:246481479591:web:9ed0b9419510857aadb882",
  measurementId: "G-0WF4Q4V4VB"
};
// Initialize Firebase and export the instances
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app); // Keep analytics if used elsewhere
export const storage = getStorage(app); // Export Firebase Storage
