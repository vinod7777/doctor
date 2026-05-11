// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get table body and template elements
const doctorNameElement = document.getElementById('doctor-name');
const patientTableBody = document.getElementById('patient-table-body');
const patientRowTemplate = document.getElementById('patient-row-template');
const noPatientsMessage = document.getElementById('no-patients-message');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const dateFilter = document.getElementById('date-filter');

// Modal Elements
const documentModal = document.getElementById('document-modal');
const documentModalContent = document.getElementById('document-modal-content');
const closeDocumentModalBtn = document.getElementById('close-document-modal');
const modalPatientName = document.getElementById('modal-patient-name');
const documentListContainer = document.getElementById('document-list');
const documentItemTemplate = document.getElementById('document-item-template');

// PIN Modal Elements
const pinModal = document.getElementById('pin-modal');
const pinModalContent = document.getElementById('pin-modal-content');
const pinForm = document.getElementById('pin-form');
const pinInput = document.getElementById('pin-input');
const pinError = document.getElementById('pin-error-message');
const cancelPinBtn = document.getElementById('cancel-pin-btn');
const closePinModalBtn = document.getElementById('close-pin-modal');

let allPatients = []; // To store all patients for filtering
let currentPatientForPin = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, get their data
        const uid = user.uid;
        const docRef = doc(db, "doctors", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const doctorData = docSnap.data();
            const fullName = doctorData.fullName;

            // Update the UI with the doctor's name
            if (doctorNameElement) doctorNameElement.textContent = fullName;
        }
        // User is signed in, fetch their patients
        await loadPatients(user.uid);
    } else {
        // No user is signed in, redirect to login
        window.location.href = 'Doctor_login.html';
    }
});

async function loadPatients(doctorId) {
    if (!patientTableBody || !patientRowTemplate) return;

    try {
        // 1. Find all unique patient IDs from the doctor's appointments
        const appointmentsRef = collection(db, "appointments");
        const q = query(appointmentsRef, where("doctorId", "==", doctorId));
        const appointmentSnapshot = await getDocs(q);
        const patientIds = [...new Set(appointmentSnapshot.docs.map(doc => doc.data().patientId))];
        
        if (patientIds.length === 0) {
            displayPatients([]); // Show empty state
            return;
        }

        // 2. Fetch details for each unique patient
        const patientPromises = patientIds.map(id => getDoc(doc(db, "patients", id)));
        const patientDocs = await Promise.all(patientPromises);
        
        allPatients = patientDocs
            .filter(doc => doc.exists())
            .map(doc => ({ id: doc.id, ...doc.data(), hasDocuments: false })); // Add hasDocuments flag

        // 3. Check for medical records for each patient
        const recordChecks = allPatients.map(patient => 
            getDocs(query(collection(db, "medicalRecords"), where("userId", "==", patient.id)))
        );
        const recordSnapshots = await Promise.all(recordChecks);

        recordSnapshots.forEach((snapshot, index) => { if (!snapshot.empty) allPatients[index].hasDocuments = true; });
            
        displayPatients(allPatients);
        
    } catch (error) {
        console.error("Error loading patients:", error);
        displayPatients([]); // Show empty state on error
    }
}

function displayPatients(patients) {
    patientTableBody.innerHTML = ''; // Clear existing rows

    if (patients.length === 0) {
        if (noPatientsMessage) noPatientsMessage.style.display = 'table-row';
    } else {
        if (noPatientsMessage) noPatientsMessage.style.display = 'none';
        patients.forEach(patientData => {
            const row = patientRowTemplate.cloneNode(true);
            row.removeAttribute('id');
            row.style.display = 'table-row';

            row.querySelector('.patient-name').textContent = patientData.fullName;
            row.querySelector('.patient-id').textContent = `ID: ${patientData.id.substring(0, 8)}`;
            row.querySelector('.patient-email').textContent = patientData.email;
            row.querySelector('.patient-joined-date').textContent = patientData.createdAt.toDate().toLocaleDateString();

            const docStatusCell = row.querySelector('.patient-documents-status');
            if (patientData.hasDocuments) {
                const docIcon = document.createElement('span');
                docIcon.className = "material-symbols-outlined text-secondary cursor-pointer";
                docIcon.title = "Documents available";
                docIcon.textContent = 'description';
                docIcon.addEventListener('click', () => showPinModal(patientData));
                docStatusCell.appendChild(docIcon);
            }

            patientTableBody.appendChild(row);
        });
    }
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const dateValue = parseInt(dateFilter.value, 10);

    let filteredPatients = allPatients.filter(patient => {
        // Search filter
        const matchesSearch = patient.fullName.toLowerCase().includes(searchTerm) || 
                              patient.id.toLowerCase().includes(searchTerm);

        // Status filter (assuming all current patients are 'active' for this example)
        const matchesStatus = statusValue === 'all' || (statusValue === 'active' && (patient.status === 'active' || !patient.status)) || (statusValue === 'inactive' && patient.status === 'inactive');

        // Date filter
        let matchesDate = true;
        if (!isNaN(dateValue)) {
            const joinDate = patient.createdAt.toDate();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - dateValue);
            matchesDate = joinDate >= cutoffDate;
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });

    displayPatients(filteredPatients);
}

// Helper function to generate a time-based PIN from a secret (patient UID)
async function generatePin(secret, minuteOffset = 0) { // minuteOffset is used to check previous PIN
    const timeStep = Math.floor(Date.now() / 1000 / 60) + minuteOffset; // Apply offset to the current time step
    const data = new TextEncoder().encode(secret + timeStep);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const view = new DataView(hashBuffer);
    const num = view.getUint32(0, true);
    return (num % 10000).toString().padStart(4, '0');
}

function showPinModal(patient) {
    currentPatientForPin = { uid: patient.id, name: patient.fullName };
    pinInput.value = '';
    pinError.textContent = '';
    pinModal.classList.remove('opacity-0', 'pointer-events-none');
    pinModalContent.classList.remove('scale-95');
    pinInput.focus();
}

function hidePinModal() {
    pinModal.classList.add('opacity-0', 'pointer-events-none');
    pinModalContent.classList.add('scale-95');
    currentPatientForPin = null;
}

if (pinModal) {
    cancelPinBtn.addEventListener('click', hidePinModal);
    closePinModalBtn.addEventListener('click', hidePinModal);
    pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) hidePinModal();
    });

    pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPatientForPin) return;

        const enteredPin = pinInput.value;
        
        // Generate PIN for the current minute and the previous minute to handle the 60-second rollover.
        const currentPin = await generatePin(currentPatientForPin.uid);
        const previousPin = await generatePin(currentPatientForPin.uid, -1); // -1 minute offset

        if (enteredPin === currentPin || enteredPin === previousPin) {
            const patientUidToOpen = currentPatientForPin.uid; // Store the UID before it gets cleared
            hidePinModal();
            
            // Find the full patient object to pass to the document modal
            const patientData = allPatients.find(p => p.id === patientUidToOpen);
            if (patientData) {
                openDocumentModal(patientData);
            } else {
                console.error("Could not find patient data to open document modal.");
            }
        } else {
            pinError.textContent = 'Invalid PIN. Please try again.';
            pinInput.select();
        }
    });
}

async function openDocumentModal(patientData) {
    modalPatientName.textContent = `${patientData.fullName}'s Documents`;
    documentListContainer.innerHTML = '<p class="text-center text-slate-500">Loading documents...</p>';

    documentModal.classList.remove('opacity-0', 'pointer-events-none');
    documentModalContent.classList.remove('scale-95');

    try {
        const recordsRef = collection(db, "medicalRecords");
        const q = query(recordsRef, where("userId", "==", patientData.id), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        documentListContainer.innerHTML = ''; // Clear loading message

        if (querySnapshot.empty) {
            documentListContainer.innerHTML = '<p class="text-center text-slate-500">No documents found for this patient.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            const record = doc.data();
            const item = documentItemTemplate.content.cloneNode(true);

            const docName = record.fileName || record.documentType || 'Untitled Document';
            const docDate = record.timestamp.toDate().toLocaleDateString();

            item.querySelector('.document-name').textContent = docName;
            item.querySelector('.document-details').textContent = `${record.documentType} - Uploaded on ${docDate}`;
            item.querySelector('.view-link').href = record.fileUrl;

            documentListContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Error fetching patient documents:", error);
        documentListContainer.innerHTML = '<p class="text-center text-red-500">Could not load documents.</p>';
    }
}

function closeDocumentModal() {
    documentModal.classList.add('opacity-0', 'pointer-events-none');
    documentModalContent.classList.add('scale-95');
}

if (documentModal) {
    closeDocumentModalBtn.addEventListener('click', closeDocumentModal);
    documentModal.addEventListener('click', (e) => {
        if (e.target === documentModal) {
            closeDocumentModal();
        }
    });
}

if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
}
if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
}
if(dateFilter) {
    dateFilter.addEventListener('change', applyFilters);
}