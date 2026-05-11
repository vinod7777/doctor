// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, addDoc, serverTimestamp, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Element Selectors ---
const doctorsListContainer = document.getElementById('doctors-list');
const doctorCardTemplate = document.getElementById('doctor-card-template');
const noDoctorsMessage = document.getElementById('no-doctors-message');
const searchInput = document.getElementById('search-input');

// Modal Elements
const bookingModal = document.getElementById('booking-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalDoctorAvatar = document.getElementById('modal-doctor-avatar');
const modalDoctorName = document.getElementById('modal-doctor-name');
const modalDoctorSpecialization = document.getElementById('modal-doctor-specialization');
const appointmentDateInput = document.getElementById('appointment-date');
const timeInputContainer = document.getElementById('time-input-container');
const appointmentTimeInput = document.getElementById('appointment-time');
const chiefComplaintInput = document.getElementById('chief-complaint');
const confirmBookingBtn = document.getElementById('confirm-booking-btn');
const bookingMessage = document.getElementById('booking-message');

// Upload Elements
const fileUploadOptionBtn = document.getElementById('fileUploadOptionBtn');
const driveLinkOptionBtn = document.getElementById('driveLinkOptionBtn');
const fileInputContainer = document.getElementById('fileInputContainer');
const driveLinkInputContainer = document.getElementById('driveLinkInputContainer');
const fileInput = document.getElementById('fileInput');
const driveLinkInput = document.getElementById('driveLinkInput');
const uploadMethodInput = document.getElementById('uploadMethodInput');

const logoutButton = document.getElementById('logout-button');
let allDoctors = [];
let selectedDoctorId = null;
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

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadDoctors();

        // Handle Logout
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                signOut(auth).catch((error) => console.error('Sign out error', error));
            });
        }
    } else {
        // If not logged in, redirect to login page
        window.location.href = 'Patient_login.html';
    }
});

// --- Data Fetching and Display ---
async function loadDoctors() {
    try {
        const doctorsCollection = collection(db, "doctors");
        const querySnapshot = await getDocs(doctorsCollection);
        allDoctors = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayDoctors(allDoctors);
    } catch (error) {
        console.error("Error loading doctors:", error);
        noDoctorsMessage.classList.remove('hidden');
        noDoctorsMessage.textContent = 'Could not load doctors. Please try again later.';
    }
}

function displayDoctors(doctors) {
    doctorsListContainer.innerHTML = ''; // Clear existing list
    if (doctors.length === 0) {
        noDoctorsMessage.classList.remove('hidden');
    } else {
        noDoctorsMessage.classList.add('hidden');
    }

    doctors.forEach(doctor => {
        const card = doctorCardTemplate.cloneNode(true);
        card.removeAttribute('id');
        card.classList.remove('hidden');

        card.querySelector('.doctor-name').textContent = `Dr. ${doctor.fullName}`;
        card.querySelector('.doctor-specialization').textContent = doctor.specialization || 'General Practitioner';
        card.querySelector('.doctor-avatar').style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=random&color=fff')`;

        card.querySelector('.book-appointment-btn').addEventListener('click', () => {
            openBookingModal(doctor);
        });

        doctorsListContainer.appendChild(card);
    });
}

// --- Search and Filter ---
searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredDoctors = allDoctors.filter(doctor =>
        doctor.fullName.toLowerCase().includes(searchTerm) ||
        (doctor.specialization && doctor.specialization.toLowerCase().includes(searchTerm))
    );
    displayDoctors(filteredDoctors);
});

// --- Modal Logic ---
function openBookingModal(doctor) {
    selectedDoctorId = doctor.id;
    modalDoctorName.textContent = `Dr. ${doctor.fullName}`;
    modalDoctorSpecialization.textContent = doctor.specialization;
    modalDoctorAvatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=random&color=fff')`;

    // Reset form
    appointmentDateInput.value = '';
    appointmentTimeInput.value = '';
    chiefComplaintInput.value = '';
    fileInput.value = '';
    driveLinkInput.value = '';
    bookingMessage.textContent = '';
    confirmBookingBtn.disabled = false;
    timeInputContainer.classList.add('hidden');

    bookingModal.classList.remove('opacity-0', 'pointer-events-none');
    bookingModal.querySelector('.modal-content').classList.remove('scale-95');
}

function closeModal() {
    bookingModal.classList.add('opacity-0', 'pointer-events-none');
    bookingModal.querySelector('.modal-content').classList.add('scale-95');
}

closeModalBtn.addEventListener('click', closeModal);
bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
        closeModal();
    }
});

appointmentDateInput.addEventListener('change', () => {
    if (appointmentDateInput.value) {
        timeInputContainer.classList.remove('hidden');
    } else {
        timeInputContainer.classList.add('hidden');
    }
});

// --- Upload Toggle Logic ---
fileUploadOptionBtn.addEventListener('click', () => {
    fileInputContainer.classList.remove('hidden');
    driveLinkInputContainer.classList.add('hidden');
    uploadMethodInput.value = 'file';
    // Style buttons
    fileUploadOptionBtn.classList.add('bg-primary', 'text-white');
    fileUploadOptionBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    driveLinkOptionBtn.classList.remove('bg-primary', 'text-white');
    driveLinkOptionBtn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
});

driveLinkOptionBtn.addEventListener('click', () => {
    driveLinkInputContainer.classList.remove('hidden');
    fileInputContainer.classList.add('hidden');
    uploadMethodInput.value = 'link';
    // Style buttons
    driveLinkOptionBtn.classList.add('bg-primary', 'text-white');
    driveLinkOptionBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    fileUploadOptionBtn.classList.remove('bg-primary', 'text-white');
    fileUploadOptionBtn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
});

// --- Booking Submission ---
confirmBookingBtn.addEventListener('click', async () => {
    if (!appointmentDateInput.value || !appointmentTimeInput.value || !chiefComplaintInput.value) {
        bookingMessage.textContent = 'Please fill in all fields.';
        bookingMessage.style.color = '#F94144';
        return;
    }

    confirmBookingBtn.disabled = true;
    bookingMessage.textContent = 'Processing your request...';
    bookingMessage.style.color = '#3A86FF';

    try {
        let attachedDocumentUrl = null;
        let documentFileName = null;
        const uploadMethod = uploadMethodInput.value;

        // Handle document upload
        if (uploadMethod === 'file' && fileInput.files[0]) {
            const file = fileInput.files[0];
            documentFileName = file.name;
            bookingMessage.textContent = 'Uploading document...';
            const storageRef = ref(storage, `appointment_attachments/${currentUserId}/${Date.now()}_${file.name}`);
            const uploadTask = await uploadBytes(storageRef, file);
            attachedDocumentUrl = await getDownloadURL(uploadTask.ref);
        } else if (uploadMethod === 'link' && driveLinkInput.value.trim()) {
            attachedDocumentUrl = driveLinkInput.value.trim();
            documentFileName = 'Google Drive Link';
        }

        bookingMessage.textContent = 'Finalizing appointment...';

        // Combine date and time
        const [year, month, day] = appointmentDateInput.value.split('-');
        const [hour, minute] = appointmentTimeInput.value.split(':');
        const appointmentDate = new Date(year, month - 1, day, hour, minute);

        // Create appointment document
        const appointmentData = {
            patientId: currentUserId,
            doctorId: selectedDoctorId,
            appointmentDate: appointmentDate,
            chiefComplaint: chiefComplaintInput.value,
            status: 'pending', // Doctors will need to confirm
            createdAt: serverTimestamp(),
            type: 'Video Call',
        };

        // Add document URL if it exists
        if (attachedDocumentUrl) {
            appointmentData.attachedDocumentUrl = attachedDocumentUrl;
            appointmentData.attachedDocumentName = documentFileName;

            // Also add to medicalRecords collection for centralized access
            await addDoc(collection(db, "medicalRecords"), {
                userId: currentUserId,
                documentType: 'Pre-consultation Document',
                fileName: documentFileName,
                fileUrl: attachedDocumentUrl,
                uploadMethod: uploadMethod,
                timestamp: serverTimestamp()
            });
        }

        await addDoc(collection(db, "appointments"), appointmentData);

        bookingMessage.textContent = 'Appointment requested successfully! You will be notified upon confirmation.';
        bookingMessage.style.color = '#43AA8B';

        setTimeout(() => {
            closeModal();
        }, 2500);

    } catch (error) {
        console.error("Error booking appointment:", error);
        bookingMessage.textContent = `Error: ${error.message}`;
        bookingMessage.style.color = '#F94144';
        confirmBookingBtn.disabled = false;
    }
});