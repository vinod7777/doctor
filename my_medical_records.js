import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

const auth = getAuth(app);
const db = getFirestore(app);

const logoutButton = document.getElementById('logout-button');
const documentsTableBody = document.getElementById('documents-table-body');
const documentRowTemplate = document.getElementById('document-row-template');
const noDocumentsMessage = document.getElementById('no-documents-message');
const profilePicture = document.getElementById('profile-picture');

const appLogoLink = document.getElementById('app-logo-link');
if (appLogoLink) {
    appLogoLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error signing out:", error);
            window.location.href = 'index.html'; // Redirect even if sign out fails for a clean state
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "patients", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        // Handle logout
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default anchor behavior
                signOut(auth).catch(error => console.error('Sign out error', error));
            });
        }

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.profilePictureUrl) {
                profilePicture.style.backgroundImage = `url(${userData.profilePictureUrl})`;
            } else {
                profilePicture.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random')`;
            }
        }

        setupSharingPin(user.uid);
        await loadMedicalRecords(user.uid);
    } else {
        // User is not signed in, redirect to login page or show a message
        console.log("No user signed in. Redirecting to login.");
        window.location.href = 'Patient_login.html';
    }
});

async function loadMedicalRecords(userId) {
    documentsTableBody.innerHTML = ''; // Clear existing records

    try {
        const q = query(
            collection(db, "medicalRecords"),
            where("userId", "==", userId),
            orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            noDocumentsMessage.style.display = 'table-row';
            return;
        }

        noDocumentsMessage.style.display = 'none';

        querySnapshot.forEach((doc) => {
            const record = doc.data();
            const newRow = documentRowTemplate.cloneNode(true);
            newRow.removeAttribute('id');
            newRow.style.display = 'table-row';

            const docNameElement = newRow.querySelector('.doc-name');
            const docTypeElement = newRow.querySelector('.doc-type');
            const docDateElement = newRow.querySelector('.doc-date');
            const viewDocLink = newRow.querySelector('.view-doc-link');

            // Set document name (use file name for files, or a generic name for links)
            docNameElement.textContent = record.fileName || `${record.documentType} Document`;
            docTypeElement.textContent = record.documentType;

            // Format date
            if (record.timestamp && record.timestamp.toDate) {
                docDateElement.textContent = record.timestamp.toDate().toLocaleDateString();
            } else {
                docDateElement.textContent = 'N/A';
            }

            // Set the link for viewing the document
            if (record.fileUrl) {
                viewDocLink.href = record.fileUrl;
            } else {
                viewDocLink.style.display = 'none'; // Hide if no URL
            }

            documentsTableBody.appendChild(newRow);
        });
    } catch (error) {
        console.error("Error loading medical records:", error);
        documentsTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500">Error loading records: ${error.message}</td></tr>`;
    }
}

// Helper function to generate a time-based PIN from a secret (patient UID)
async function generatePin(secret) {
    const timeStep = Math.floor(Date.now() / 1000 / 60);
    const data = new TextEncoder().encode(secret + timeStep);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const view = new DataView(hashBuffer);
    const num = view.getUint32(0, true);
    return (num % 10000).toString().padStart(4, '0');
}

// Function to manage the PIN display and timer
function setupSharingPin(patientUid) {
    const pinCard = document.getElementById('sharing-pin-card');
    const pinElement = document.getElementById('sharing-pin');
    const timerElement = document.getElementById('pin-timer');
    if (!pinCard || !pinElement || !timerElement) return;

    pinCard.style.display = 'flex';

    const updatePin = async () => {
        const pin = await generatePin(patientUid);
        pinElement.textContent = pin;
    };

    const updateTimer = () => {
        const seconds = 60 - (Math.floor(Date.now() / 1000) % 60);
        timerElement.textContent = `${seconds}s`;
        if (seconds === 60) {
            updatePin();
        }
    };

    updatePin();
    setInterval(updateTimer, 1000);
}