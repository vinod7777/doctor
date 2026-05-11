// Import necessary functions from Firebase SDKs
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js'; // Import the initialized Firebase app

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get form and error message elements
const registrationForm = document.getElementById('patient-registration-form');
const errorMessageDiv = document.getElementById('error-message');

registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent the default form submission

    // Get form data
    const fullName = document.getElementById('full-name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const terms = document.getElementById('terms').checked;

    // --- Basic Validation ---
    if (!terms) {
        errorMessageDiv.textContent = 'You must agree to the Terms of Service and Privacy Policy.';
        return;
    }
    if (password !== confirmPassword) {
        errorMessageDiv.textContent = 'Passwords do not match.';
        return;
    }

    try {
        // Step 1: Create user with Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Step 2: Store patient information in Firestore
        await setDoc(doc(db, "patients", user.uid), {
            uid: user.uid,
            fullName: fullName,
            email: email,
            createdAt: new Date()
        });

        // Step 3: Redirect to the patient dashboard on successful registration
        window.location.href = 'Patient_dashboard.html';

    } catch (error) {
        // Handle Firebase errors
        errorMessageDiv.textContent = error.message;
    }
});