// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get elements from the DOM
const welcomeMessageElement = document.getElementById('welcome-message');
const profilePictureElement = document.getElementById('profile-picture');
const appointmentsList = document.getElementById('appointments-list');
const appointmentTemplate = document.getElementById('appointment-template');
const noAppointmentsMessage = document.getElementById('no-appointments-message');
const logoutButton = document.getElementById('logout-button');

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
        // User is signed in
        const uid = user.uid;
        const patientDocRef = doc(db, "patients", uid);
        const patientDocSnap = await getDoc(patientDocRef);

        if (patientDocSnap.exists()) {
            const patientData = patientDocSnap.data();

            // Update welcome message and profile picture
            if (welcomeMessageElement) {
                welcomeMessageElement.textContent = `Welcome back, ${patientData.fullName.split(' ')[0]}!`;
            }
            if (profilePictureElement) {
                const avatarUrl = patientData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(patientData.fullName)}&background=random`;
                profilePictureElement.style.backgroundImage = `url('${avatarUrl}')`;
            }

            // Load upcoming appointments
            await loadUpcomingAppointments(uid);

            // Listen for real-time call notifications
            listenForCallNotifications(uid);

        } else {
            console.log("No such patient document!");
            // Redirect if patient data doesn't exist
            window.location.href = 'Patient_login.html';
        }

        // Handle logout
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                signOut(auth).catch(error => console.error('Sign out error', error));
            });
        }
    } else {
        // User is not signed in, redirect to login page
        window.location.href = 'Patient_login.html';
    }
});

async function loadUpcomingAppointments(patientId) {
    const today = new Date();
    const appointmentsRef = collection(db, "appointments");
    const q = query(appointmentsRef, where("patientId", "==", patientId), where("status", "==", "confirmed"), where("appointmentDate", ">=", today), orderBy("appointmentDate"));

    const querySnapshot = await getDocs(q);
    appointmentsList.innerHTML = ''; // Clear list

    if (querySnapshot.empty) {
        if (noAppointmentsMessage) noAppointmentsMessage.style.display = 'block';
        return;
    }

    if (noAppointmentsMessage) noAppointmentsMessage.style.display = 'none';

    for (const appointmentDoc of querySnapshot.docs) {
        const appointmentData = appointmentDoc.data();
        const doctorDocRef = doc(db, "doctors", appointmentData.doctorId);
        const doctorDocSnap = await getDoc(doctorDocRef);

        if (doctorDocSnap.exists()) {
            const doctorData = doctorDocSnap.data();
            const card = appointmentTemplate.cloneNode(true);
            card.removeAttribute('id');
            card.style.display = 'flex';

            card.querySelector('.doctor-name').textContent = doctorData.fullName;
            card.querySelector('.doctor-specialization').textContent = doctorData.specialization || 'General';
            card.querySelector('.appointment-time').textContent = appointmentData.appointmentDate.toDate().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: true });
            card.querySelector('.doctor-avatar').style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(doctorData.fullName)}&background=random')`;

            const joinCallLink = card.querySelector('.join-call-link');
            // The roomID for the video call is the same as the appointment's document ID.
            // Make the join button always available for confirmed appointments.
            joinCallLink.href = `WEB_UIKITS.html?roomID=${appointmentDoc.id}&role=Participant`;
            
            appointmentsList.appendChild(card);
        }
    }
}

function listenForCallNotifications(patientId) {
    const appointmentsRef = collection(db, "appointments");
    const q = query(appointmentsRef, where("patientId", "==", patientId), where("status", "==", "in-progress"));

    let isInitialLoad = true;

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            // Only show notification for changes after the initial data load
            if (!isInitialLoad && (change.type === "added" || change.type === "modified")) {
                const appointment = change.doc.data();
                const roomID = appointment.zegoRoomId; // Listen for the Zego room ID
                if (roomID) {
                    const doctorDocRef = doc(db, "doctors", appointment.doctorId);
                    const doctorDocSnap = await getDoc(doctorDocRef);
                    const doctorName = doctorDocSnap.exists() ? doctorDocSnap.data().fullName : "your doctor";
                    showCallNotification(roomID, doctorName);
                }
            }
        });

        // After processing the initial documents, set the flag to false
        isInitialLoad = false;
    });
}

function showCallNotification(roomID, doctorName) {
    // Create and show a modal for the notification
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-card-dark rounded-lg shadow-xl p-6 max-w-sm mx-auto text-center">
            <h3 class="text-xl font-bold text-text-light-primary dark:text-dark-primary">Call Started</h3>
            <p class="my-4 text-text-light-secondary dark:text-dark-secondary">Dr. ${doctorName} has started the video call.</p>
            <div class="flex justify-center gap-4">
                <button id="decline-call" class="px-4 py-2 rounded-lg border">Later</button>
                <a href="WEB_UIKITS.html?roomID=${roomID}&role=Participant" class="px-4 py-2 rounded-lg bg-secondary text-white font-semibold">Join Now</a>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#decline-call').addEventListener('click', () => {
        modal.remove();
    });
}