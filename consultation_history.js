// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// --- Element Selectors ---
const doctorNameElement = document.getElementById('doctor-name');
const logoutButton = document.getElementById('logout-button');

// Consultation List (Left Column)
const consultationListContainer = document.getElementById('consultation-list-container');
const consultationItemTemplate = document.getElementById('consultation-item-template');

// Detailed View (Right Column)
const detailPatientName = document.getElementById('detail-patient-name');
const detailPatientInfo = document.getElementById('detail-patient-info');
const detailPatientAvatar = document.getElementById('detail-patient-avatar');
const detailSymptoms = document.getElementById('detail-symptoms');
const detailDiagnosis = document.getElementById('detail-diagnosis');
const detailTreatment = document.getElementById('detail-treatment');
const detailFollowUp = document.getElementById('detail-follow-up');
const downloadReportBtn = document.querySelector('#detailed-view-container button:first-of-type');
const noHistoryMessage = document.getElementById('no-history-message');
const detailedViewContainer = document.getElementById('detailed-view-container');
const searchInput = document.getElementById('search-input');
const dateFilter = document.getElementById('date-filter');
const typeFilter = document.getElementById('type-filter');
const detailTabs = document.getElementById('detail-tabs');

// Document/History templates
const documentItemTemplate = document.getElementById('document-item-template');

let allConsultations = [];
let currentlySelectedPatient = null;

const style = document.createElement('style');
style.innerHTML = `.detail-panel { display: none; } .detail-panel.active { display: flex; }`;
document.head.appendChild(style);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, get their data
        const uid = user.uid;
        const docRef = doc(db, "doctors", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const doctorData = docSnap.data();
            if (doctorNameElement) doctorNameElement.textContent = doctorData.fullName;

            // Load the consultation history
            await loadConsultationHistory(uid);

        } else {
            // Doctor document doesn't exist, sign out and redirect
            console.error("Doctor data not found for authenticated user.");
            signOut(auth);
        }

        // Handle logout
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                signOut(auth).catch((error) => console.error('Sign out error', error));
            });
        }

    } else {
        // User is signed out, redirect to login page.
        window.location.href = 'Doctor_login.html';
    }
});

async function loadConsultationHistory(doctorId) {
    const appointmentsRef = collection(db, "appointments");
    // Query for all past and concluded appointments, ordered by the most recent first.
    const q = query(
        appointmentsRef, 
        where("doctorId", "==", doctorId), 
        where("status", "in", ["completed", "in-progress", "declined", "canceled"]), 
        orderBy("appointmentDate", "desc"));

    const querySnapshot = await getDocs(q);

    // Clear the list before populating
    consultationListContainer.innerHTML = '';

    if (querySnapshot.empty) {
        // Show a message if there's no history
        if (noHistoryMessage) noHistoryMessage.style.display = 'block';
        if (detailedViewContainer) detailedViewContainer.style.display = 'none';
        return;
    }

    if (noHistoryMessage) noHistoryMessage.style.display = 'none';
    if (detailedViewContainer) detailedViewContainer.style.display = 'flex';

    allConsultations = [];
    for (const appointmentDoc of querySnapshot.docs) {
        const appointmentData = appointmentDoc.data();
        const patientDocRef = doc(db, "patients", appointmentData.patientId);
        const patientDocSnap = await getDoc(patientDocRef);

        if (patientDocSnap.exists()) {
            allConsultations.push({ appointment: appointmentData, patient: patientDocSnap.data() });
        }
    }
    
    displayConsultations(allConsultations);
    // Display the first item's details by default if the list is not empty
    if (allConsultations.length > 0) { 
        const firstConsult = allConsultations[0];
        currentlySelectedPatient = firstConsult.patient;
        displayConsultationDetails(firstConsult.appointment, firstConsult.patient);
        // When a new list is loaded, default to the main consultation tab
        handleTabClick('consultation-details');

        // We'll handle the active state in displayConsultations
    }
}

function displayConsultations(consultations) {
    consultationListContainer.innerHTML = '';
    consultations.forEach((consult, index) => {
        const card = consultationItemTemplate.cloneNode(true);
        card.removeAttribute('id');
        card.style.display = 'flex';

        card.querySelector('.list-patient-name').textContent = consult.patient.fullName;
        card.querySelector('.list-patient-complaint').textContent = consult.appointment.chiefComplaint || 'No chief complaint provided.';
        const appointmentDate = consult.appointment.appointmentDate.toDate();
        card.querySelector('.list-patient-details').textContent = `ID: ${consult.patient.uid.substring(0, 6)} | ${appointmentDate.toLocaleDateString()} ${appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        card.querySelector('.list-patient-avatar').style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(consult.patient.fullName)}&background=random')`;

        card.addEventListener('click', () => {
            currentlySelectedPatient = consult.patient;
            displayConsultationDetails(consult.appointment, consult.patient);
            handleTabClick('consultation-details'); // Default to details tab on click
            // Handle active state
            document.querySelectorAll('.consultation-item').forEach(item => item.classList.remove('active-item'));
            card.classList.add('active-item');
        });

        consultationListContainer.appendChild(card);
        if (index === 0) card.classList.add('active-item'); // Highlight the first item
    });
}

function displayConsultationDetails(appointment, patient) {
    if (!detailedViewContainer) return;

    // Populate patient header
    detailPatientName.textContent = patient.fullName;
    detailPatientInfo.textContent = `${patient.age || 'N/A'} years old, ${patient.gender || 'N/A'}`;
    detailPatientAvatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(patient.fullName)}&background=random')`;

    // Populate consultation details
    // These fields (symptoms, diagnosis, etc.) should be saved on the appointment document
    // when the doctor concludes a consultation.
    detailSymptoms.textContent = appointment.symptoms || "No symptoms were recorded for this consultation.";
    detailDiagnosis.textContent = appointment.diagnosis || "No diagnosis was recorded for this consultation.";
    detailTreatment.textContent = appointment.treatmentPlan || "No treatment plan was recorded for this consultation.";
    detailFollowUp.textContent = appointment.followUpAdvice || "No follow-up advice was provided.";

    // Handle the "Download Report" button
    if (downloadReportBtn) {
        if (appointment.attachedDocumentUrl) {
            downloadReportBtn.disabled = false;
            downloadReportBtn.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-50');
            downloadReportBtn.classList.add('hover:bg-slate-200', 'dark:hover:bg-slate-700');
            downloadReportBtn.onclick = () => {
                window.open(appointment.attachedDocumentUrl, '_blank');
            };
        } else {
            downloadReportBtn.disabled = true;
            downloadReportBtn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-50');
        }
    }
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const dateValue = dateFilter.value;
    const typeValue = typeFilter.value;

    let filtered = allConsultations.filter(consult => {
        const patientName = consult.patient.fullName.toLowerCase();
        const matchesSearch = patientName.includes(searchTerm);

        const appointmentType = consult.appointment.type || 'Video Call';
        const matchesType = typeValue === 'all' || appointmentType === typeValue;

        let matchesDate = true;
        if (dateValue !== 'all') {
            const days = parseInt(dateValue, 10);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            matchesDate = consult.appointment.appointmentDate.toDate() >= cutoffDate;
        }

        return matchesSearch && matchesType && matchesDate;
    });

    displayConsultations(filtered);
}

function handleTabClick(tabId) {
    // Hide all panels and remove active styles from tabs
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.classList.remove('text-primary', 'border-primary', 'font-semibold');
        tab.classList.add('text-slate-500', 'dark:text-slate-400', 'border-transparent');
    });
    document.querySelectorAll('.detail-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    // Show the selected panel and apply active styles to the tab
    const activeTab = document.getElementById(`tab-${tabId}`);
    const activePanel = document.getElementById(`panel-${tabId}`);
    if (activeTab && activePanel) {
        activeTab.classList.add('text-primary', 'border-primary', 'font-semibold');
        activeTab.classList.remove('text-slate-500', 'dark:text-slate-400', 'border-transparent');
        activePanel.classList.add('active');
    }

    // Load data for the active tab if it's not the default details tab
    if (currentlySelectedPatient) {
        switch (tabId) {
            case 'patient-history':
                renderPatientHistory(currentlySelectedPatient.uid);
                break;
            case 'prescriptions':
                renderPatientDocuments(currentlySelectedPatient.uid, 'Prescription');
                break;
            case 'lab-reports':
                renderPatientDocuments(currentlySelectedePatient.uid, 'Lab Result');
                break;
        }
    }
}

async function renderPatientHistory(patientId) {
    const panel = document.getElementById('panel-patient-history');
    panel.innerHTML = '<p>Loading history...</p>';
    // This reuses the global list, which is already sorted by date.
    const patientHistory = allConsultations.filter(c => c.patient.uid === patientId);
    panel.innerHTML = '';
    if (patientHistory.length === 0) {
        panel.innerHTML = '<p>No other history found.</p>';
        return;
    }
    patientHistory.forEach(consult => {
        const date = consult.appointment.appointmentDate.toDate().toLocaleDateString();
        const item = document.createElement('div');
        item.className = 'p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50';
        item.innerHTML = `<p class="font-semibold">${consult.appointment.chiefComplaint}</p><p class="text-sm text-slate-500">${date} - Status: ${consult.appointment.status}</p>`;
        panel.appendChild(item);
    });
}

async function renderPatientDocuments(patientId, docType) {
    const panelId = `panel-${docType === 'Prescription' ? 'prescriptions' : 'lab-reports'}`;
    const panel = document.getElementById(panelId);
    panel.innerHTML = `<p>Loading ${docType.toLowerCase()}s...</p>`;

    const q = query(collection(db, "medicalRecords"), where("userId", "==", patientId), where("documentType", "==", docType), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    panel.innerHTML = '';
    if (snapshot.empty) {
        panel.innerHTML = `<p>No ${docType.toLowerCase()}s found.</p>`;
        return;
    }
    snapshot.forEach(doc => {
        const record = doc.data();
        const item = documentItemTemplate.content.cloneNode(true);
        item.querySelector('.document-name').textContent = record.fileName || `${record.documentType} Document`;
        item.querySelector('.document-date').textContent = `Uploaded on ${record.timestamp.toDate().toLocaleDateString()}`;
        item.querySelector('.document-link').href = record.fileUrl;
        panel.appendChild(item);
    });
}

// Add a simple style for the active item
const activeItemStyle = document.createElement('style');
activeItemStyle.innerHTML = `
    .active-item { background-color: #3A86FF1A; border-left: 4px solid #3A86FF; }
    .dark .active-item { background-color: #3A86FF33; }
`;
document.head.appendChild(activeItemStyle);

// --- Event Listeners for Filters ---
searchInput.addEventListener('input', applyFilters);
dateFilter.addEventListener('change', applyFilters);
typeFilter.addEventListener('change', applyFilters);

detailTabs.addEventListener('click', (e) => {
    e.preventDefault();
    const targetTab = e.target.closest('.history-tab');
    if (targetTab) {
        const tabId = targetTab.id.replace('tab-', '');
        handleTabClick(tabId);
    }
});