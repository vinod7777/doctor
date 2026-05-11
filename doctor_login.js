// Import necessary functions from Firebase SDKs
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js'; // Import the initialized Firebase app

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get form and error message elements
const loginForm = document.getElementById('doctor-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessageDiv = document.getElementById('error-message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        // Sign in the user with email and password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Verify that the user is a doctor by checking the 'doctors' collection
        const docRef = doc(db, "doctors", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // The user is a doctor, proceed to the dashboard.
            window.location.href = 'Doctor_dashboard.html';
        } else {
            // This user is not in the 'doctors' collection. They might be a patient or another user type.
            // Sign them out to prevent access and show an error.
            await auth.signOut();
            errorMessageDiv.textContent = "Access denied. This portal is for doctors only.";
        }
    } catch (error) {
        // Handle login errors (e.g., wrong password, user not found)
        errorMessageDiv.textContent = "Invalid email or password. Please try again.";
        console.error("Login Error:", error.message);
    }
});