// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get elements
const doctorNameElement = document.getElementById('doctor-name');
const logoutButton = document.getElementById('logout-button');
const settingsForm = document.getElementById('doctor-settings-form');
const messageDisplay = document.getElementById('message-display');

let currentUserId = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        const docRef = doc(db, "doctors", currentUserId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const doctorData = docSnap.data();
            // Populate sidebar name
            if (doctorNameElement) doctorNameElement.textContent = doctorData.fullName;

            // Populate form fields
            document.getElementById('full-name').value = doctorData.fullName || '';
            document.getElementById('email').value = doctorData.email || '';
            document.getElementById('license-number').value = doctorData.medicalLicenseNumber || '';
            document.getElementById('specialization').value = doctorData.specialization || '';
        }
    } else {
        window.location.href = 'Doctor_login.html';
    }
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return;

    const docRef = doc(db, "doctors", currentUserId);
    const updatedData = {
        fullName: document.getElementById('full-name').value,
        medicalLicenseNumber: document.getElementById('license-number').value,
        specialization: document.getElementById('specialization').value,
    };

    try {
        await updateDoc(docRef, updatedData);
        messageDisplay.textContent = 'Profile updated successfully!';
        messageDisplay.className = 'p-3 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
        messageDisplay.style.display = 'block';

        // Also update the sidebar name in real-time
        if (doctorNameElement) doctorNameElement.textContent = updatedData.fullName;
    } catch (error) {
        console.error("Error updating document: ", error);
        messageDisplay.textContent = 'Error updating profile. Please try again.';
        messageDisplay.className = 'p-3 rounded-lg text-sm bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
        messageDisplay.style.display = 'block';
    }
});