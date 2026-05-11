// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// --- Element Selectors ---
const messageArea = document.getElementById('message-area');
const rescheduleContent = document.getElementById('reschedule-content');
const doctorAvatar = document.getElementById('doctor-avatar');
const doctorNameEl = document.getElementById('doctor-name');
const doctorSpecializationEl = document.getElementById('doctor-specialization');
const currentAppointmentTimeEl = document.getElementById('current-appointment-time');
const appointmentDateInput = document.getElementById('appointment-date');
const timeInputContainer = document.getElementById('time-input-container');
const appointmentTimeInput = document.getElementById('appointment-time');
const confirmRescheduleBtn = document.getElementById('confirm-reschedule-btn');

let appointmentId = null;
let appointment = null;
let doctor = null;

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

onAuthStateChanged(auth, (user) => {
    if (user) {
        const urlParams = new URLSearchParams(window.location.search);
        appointmentId = urlParams.get('appointmentId');
        if (appointmentId) {
            loadAppointmentDetails(appointmentId, user.uid);
        } else {
            showMessage("Error: No appointment ID provided.", true);
        }
    } else {
        window.location.href = 'Patient_login.html';
    }
});

function showMessage(msg, isError = false) {
    messageArea.textContent = msg;
    messageArea.className = isError ? 'text-center p-4 text-red-500' : 'text-center p-4 text-blue-500';
    rescheduleContent.classList.add('hidden');
}

async function loadAppointmentDetails(id, userId) {
    showMessage("Loading appointment details...");
    const appointmentRef = doc(db, "appointments", id);
    const appointmentSnap = await getDoc(appointmentRef);

    if (!appointmentSnap.exists() || appointmentSnap.data().patientId !== userId) {
        showMessage("Error: Appointment not found or access denied.", true);
        return;
    }

    appointment = { id: appointmentSnap.id, ...appointmentSnap.data() };

    const doctorRef = doc(db, "doctors", appointment.doctorId);
    const doctorSnap = await getDoc(doctorRef);

    if (!doctorSnap.exists()) {
        showMessage("Error: Doctor information could not be loaded.", true);
        return;
    }

    doctor = { id: doctorSnap.id, ...doctorSnap.data() };

    // Populate UI
    doctorAvatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=random')`;
    doctorNameEl.textContent = `Dr. ${doctor.fullName}`;
    doctorSpecializationEl.textContent = doctor.specialization || 'General Practitioner';
    currentAppointmentTimeEl.textContent = appointment.appointmentDate.toDate().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    // Set up date input
    const today = new Date().toISOString().split('T')[0];
    appointmentDateInput.setAttribute('min', today);
    confirmRescheduleBtn.disabled = true;

    // Show content
    messageArea.textContent = '';
    rescheduleContent.classList.remove('hidden');
}

appointmentDateInput.addEventListener('change', async () => {
    if (appointmentDateInput.value) {
        timeInputContainer.classList.remove('hidden');
        if (appointmentTimeInput.value) {
            confirmRescheduleBtn.disabled = false;
        }
    } else {
        timeInputContainer.classList.add('hidden');
        confirmRescheduleBtn.disabled = true;
    }
});

appointmentTimeInput.addEventListener('change', () => {
    if (appointmentDateInput.value && appointmentTimeInput.value) {
        confirmRescheduleBtn.disabled = false;
    } else {
        confirmRescheduleBtn.disabled = true;
    }
});

confirmRescheduleBtn.addEventListener('click', async () => {
    if (!appointmentId || !appointmentTimeInput.value || !appointmentDateInput.value) {
        alert("Please select a new date and time.");
        return;
    }

    confirmRescheduleBtn.disabled = true;
    confirmRescheduleBtn.textContent = "Rescheduling...";

    const [hours, minutes] = appointmentTimeInput.value.split(':');
    const newAppointmentDate = new Date(appointmentDateInput.value);
    newAppointmentDate.setHours(hours, minutes, 0, 0);

    try {
        const appointmentRef = doc(db, "appointments", appointmentId);
        await updateDoc(appointmentRef, {
            appointmentDate: Timestamp.fromDate(newAppointmentDate),
            status: "pending" // Reset status so doctor must re-confirm
        });

        confirmRescheduleBtn.textContent = "Rescheduled!";
        confirmRescheduleBtn.classList.replace('bg-secondary', 'bg-green-500');

        setTimeout(() => {
            window.location.href = 'My_Appointments_patient.html';
        }, 2000);

    } catch (error) {
        console.error("Error rescheduling appointment: ", error);
        alert("Failed to reschedule. Please try again.");
        confirmRescheduleBtn.disabled = false;
        confirmRescheduleBtn.textContent = "Confirm Reschedule";
    }
});
