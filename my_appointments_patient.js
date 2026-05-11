import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

const auth = getAuth(app);
const db = getFirestore(app);

const upcomingTab = document.getElementById('upcoming-tab');
const pastTab = document.getElementById('past-tab');
const missedTab = document.getElementById('missed-tab');
const appointmentsContainer = document.getElementById('appointments-container');
const appointmentCardTemplate = document.getElementById('appointment-card-template');
const emptyState = document.getElementById('empty-state');
const emptyStateText = document.getElementById('empty-state-text');
const searchInput = document.getElementById('search-input');
const bookNewAppointmentBtn = document.getElementById('book-new-appointment-btn');
const profilePicture = document.getElementById('profile-picture');
const logoutButton = document.getElementById('logout-button');

let allAppointments = [];
let currentFilter = 'upcoming';
let currentUserId = null;

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
        currentUserId = user.uid;
        const userDocRef = doc(db, "patients", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.profilePictureUrl) {
                profilePicture.style.backgroundImage = `url(${userData.profilePictureUrl})`;
            } else {
                profilePicture.style.backgroundImage = `url('https://via.placeholder.com/40')`;
            }
        }
        await fetchAppointments();
        displayAppointments();
    } else {
        window.location.href = 'Patient_login.html';
    }
});

async function fetchAppointments() {
    if (!currentUserId) return;

    const appointmentsQuery = query(collection(db, "appointments"), where("patientId", "==", currentUserId));
    const querySnapshot = await getDocs(appointmentsQuery);
    
    const appointmentPromises = querySnapshot.docs.map(async (appointmentDoc) => {
        const appointment = { id: appointmentDoc.id, ...appointmentDoc.data() };
        const doctorDocRef = doc(db, "doctors", appointment.doctorId);
        const doctorDocSnap = await getDoc(doctorDocRef);
        if (doctorDocSnap.exists()) {
            appointment.doctor = doctorDocSnap.data();
        }
        return appointment;
    });

    allAppointments = await Promise.all(appointmentPromises);
}

function displayAppointments() {
    appointmentsContainer.innerHTML = ''; // Clear existing cards

    const now = new Date();
    let filteredAppointments = [];
    const searchTerm = searchInput.value.toLowerCase();

    if (currentFilter === 'upcoming') {
        filteredAppointments = allAppointments.filter(appt => 
            (appt.status === 'confirmed' || appt.status === 'in-progress') && appt.appointmentDate.toDate() >= now
        );
        emptyStateText.textContent = "No upcoming appointments found";
    } else if (currentFilter === 'past') {
        filteredAppointments = allAppointments.filter(appt => {
            const apptDate = appt.appointmentDate.toDate();
            // Considered "past" if the appointment is in the past and was joined, OR if it's marked as completed.
            return (apptDate < now && appt.patientJoined) || appt.status === 'completed';
        });
        emptyStateText.textContent = "No past appointments found";
    } else if (currentFilter === 'missed') {
        filteredAppointments = allAppointments.filter(appt => {
            const apptDate = appt.appointmentDate.toDate();
            // Considered "missed" if it was approved, confirmed, or in-progress, is in the past, and the patient did NOT join.
            return (appt.status === 'approved' || appt.status === 'confirmed' || appt.status === 'in-progress') && apptDate < now && !appt.patientJoined;
        });
        emptyStateText.textContent = "No missed appointments found";
    }

    // Apply search filter
    if (searchTerm) {
        filteredAppointments = filteredAppointments.filter(appt =>
            appt.doctor?.fullName.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredAppointments.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        filteredAppointments.sort((a, b) => a.appointmentDate.toDate() - b.appointmentDate.toDate());
        filteredAppointments.forEach(createAppointmentCard);
    }
}

function createAppointmentCard(appointment) {
    const card = appointmentCardTemplate.cloneNode(true);
    card.id = `appointment-${appointment.id}`;
    card.style.display = 'flex';

    const doctorNameEl = card.querySelector('.doctor-name');
    const specializationEl = card.querySelector('.doctor-specialization');
    const dateTimeEl = card.querySelector('.appointment-datetime');
    const avatarEl = card.querySelector('.doctor-avatar');
    const statusBadgeEl = card.querySelector('.status-badge');
    const statusIconEl = card.querySelector('.status-icon');
    const joinCallBtn = card.querySelector('.join-call-btn');
    const rescheduleBtn = card.querySelector('.reschedule-btn');

    doctorNameEl.textContent = appointment.doctor?.fullName || 'Dr. Unknown';
    specializationEl.textContent = appointment.doctor?.specialization || 'General';
    avatarEl.style.backgroundImage = `url(${appointment.doctor?.profilePictureUrl || 'https://via.placeholder.com/112'})`;

    const apptDate = appointment.appointmentDate.toDate();
    dateTimeEl.textContent = apptDate.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Configure card based on filter type
    if (currentFilter === 'upcoming') {
        statusBadgeEl.classList.add('bg-blue-100', 'text-blue-800', 'dark:bg-blue-900/50', 'dark:text-blue-300');
        statusIconEl.textContent = 'event_upcoming';
        statusBadgeEl.querySelector('span:last-child').textContent = 'Upcoming';
        joinCallBtn.href = `WEB_UIKITS.html?roomID=${appointment.id}&role=Participant`;
        joinCallBtn.style.display = 'flex';
        rescheduleBtn.href = `reschedule_appointment.html?appointmentId=${appointment.id}`;
        rescheduleBtn.style.display = 'flex';
    } else if (currentFilter === 'past') {
        statusBadgeEl.classList.add('bg-green-100', 'text-green-800', 'dark:bg-green-900/50', 'dark:text-green-300');
        statusIconEl.textContent = 'check_circle';
        statusBadgeEl.querySelector('span:last-child').textContent = 'Attended';
        joinCallBtn.style.display = 'none';
        rescheduleBtn.style.display = 'none';
    } else if (currentFilter === 'missed') {
        statusBadgeEl.classList.add('bg-red-100', 'text-red-800', 'dark:bg-red-900/50', 'dark:text-red-300');
        statusIconEl.textContent = 'cancel';
        statusBadgeEl.querySelector('span:last-child').textContent = 'Missed';
        joinCallBtn.style.display = 'none';
        rescheduleBtn.style.display = 'none';
    }

    appointmentsContainer.appendChild(card);
}

function setActiveTab(tab) {
    [upcomingTab, pastTab, missedTab].forEach(t => {
        t.classList.remove('border-b-primary');
        t.classList.add('border-b-transparent');
        t.querySelector('.tab-text').classList.remove('text-primary');
        t.querySelector('.tab-text').classList.add('text-text-light-secondary', 'dark:text-dark-secondary');
    });
    tab.classList.add('border-b-primary');
    tab.classList.remove('border-b-transparent');
    tab.querySelector('.tab-text').classList.add('text-primary');
    tab.querySelector('.tab-text').classList.remove('text-text-light-secondary', 'dark:text-dark-secondary');
}

upcomingTab.addEventListener('click', () => {
    currentFilter = 'upcoming';
    setActiveTab(upcomingTab);
    displayAppointments();
});

pastTab.addEventListener('click', () => {
    currentFilter = 'past';
    setActiveTab(pastTab);
    displayAppointments();
});

missedTab.addEventListener('click', () => {
    currentFilter = 'missed';
    setActiveTab(missedTab);
    displayAppointments();
});

searchInput.addEventListener('input', displayAppointments);

bookNewAppointmentBtn.addEventListener('click', () => {
    window.location.href = 'find_doctor.html';
});

logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'Patient_login.html';
    }).catch((error) => {
        console.error('Sign out error', error);
    });
});