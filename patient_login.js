// Import necessary functions from Firebase SDKs
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);

// Get form and error message elements
const loginForm = document.getElementById('patient-login-form');
const errorMessageDiv = document.getElementById('error-message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    // Get form data
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // Sign in the user with email and password
        await signInWithEmailAndPassword(auth, email, password);
        // On successful login, redirect to the patient dashboard
        window.location.href = 'Patient_dashboard.html';
    } catch (error) {
        // Display any errors to the user
        errorMessageDiv.textContent = error.message;
    }
});