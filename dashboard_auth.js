// Import necessary functions from Firebase SDKs
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot, Timestamp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js'; // Import the initialized Firebase app

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Get elements to update
const doctorNameElement = document.getElementById('doctor-name');
const welcomeMessageElement = document.getElementById('welcome-message');
const logoutButton = document.getElementById('logout-button');
const notificationsButton = document.getElementById('notifications-button');
const notificationDot = document.getElementById('notification-dot');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationList = document.getElementById('notification-list');
const noNotificationsMessage = document.getElementById('no-notifications-message');

// Stat elements
const consultationsTodayValue = document.getElementById('consultations-today-value');
const pendingApprovalsValue = document.getElementById('pending-approvals-value');
// Note: Earnings and percentages are set to 0 for now as the logic is more complex.
const weeklyEarningsValue = document.getElementById('weekly-earnings-value');

// Pending Appointments Elements
const pendingHeading = document.getElementById('pending-heading');
const pendingList = document.getElementById('pending-appointments-list');
const noPendingMessage = document.getElementById('no-pending-appointments');
const pendingTemplate = document.getElementById('pending-appointment-template');

// Upcoming Appointments Elements
const upcomingHeading = document.getElementById('upcoming-heading');
const upcomingList = document.getElementById('upcoming-appointments-list');
const noUpcomingMessage = document.getElementById('no-upcoming-appointments');
const upcomingTemplate = document.getElementById('upcoming-appointment-template');

// Calendar Elements
const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDaysGrid = document.getElementById('calendar-days-grid');
const prevMonthButton = document.getElementById('calendar-prev-month');
const nextMonthButton = document.getElementById('calendar-next-month');

// WARNING: Storing API keys in client-side code is insecure.
// This should be moved to a backend function for a production application.
const VIDEOSDK_API_KEY = "7ba911d6-7ce8-4d06-9577-5ba474f22b6e";

let currentCalendarDate = new Date();


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
            if (welcomeMessageElement) welcomeMessageElement.textContent = `Welcome back, ${fullName}!`;

            // Initial calendar render
            renderCalendar(currentCalendarDate, uid);

            // Set up real-time listeners
            listenForPendingAppointments(uid);
            listenForUpcomingAppointments(uid);

            // --- Handle Logout ---
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    signOut(auth).catch((error) => console.error('Sign out error', error));
                });
            }

            // --- Handle Notifications Dropdown ---
            if (notificationsButton && notificationsDropdown) {
                notificationsButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    notificationsDropdown.classList.toggle('hidden');
                });
                // Close dropdown if clicking outside
                window.addEventListener('click', (event) => {
                    if (!notificationsDropdown.contains(event.target) && !notificationsButton.contains(event.target)) {
                        notificationsDropdown.classList.add('hidden');
                    }
                });
            }


            // --- Fetch Dashboard Stats ---

            // Get consultations for today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const appointmentsRef = collection(db, "appointments");
            // Query appointments for today
            const todayQuery = query(appointmentsRef, where("doctorId", "==", uid), where("appointmentDate", ">=", today), where("appointmentDate", "<", tomorrow));
            const todaySnapshot = await getDocs(todayQuery);
            if (consultationsTodayValue) consultationsTodayValue.textContent = todaySnapshot.size;

            // Get weekly earnings
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyQuery = query(appointmentsRef, where("doctorId", "==", uid), where("status", "==", "completed"), where("appointmentDate", ">=", oneWeekAgo));
            const weeklySnapshot = await getDocs(weeklyQuery);

            let totalEarnings = 0;
            weeklySnapshot.forEach(doc => {
                totalEarnings += doc.data().fee || 0; // Assumes a 'fee' field on completed appointments
            });
            if (weeklyEarningsValue) weeklyEarningsValue.textContent = `$${totalEarnings.toFixed(2)}`;

        } else {
            // Update the UI to show the number of upcoming appointments
            const upcomingAppointmentsCount = upcomingSnapshot.size;
            const upcomingAppointmentsText = `Here's a look at your day. You have ${upcomingAppointmentsCount} upcoming appointments.`;
            document.querySelector('.text-neutral-subtext.dark\\:text-slate-400.text-base.font-normal.leading-normal.mt-2').textContent = upcomingAppointmentsText;

            // This could happen if a user is authenticated but has no doctor record
            console.log("No such document in doctors collection!");
            // Optional: redirect to a generic page or show an error
        }
    } else {
        // User is signed out, redirect to login page.
        // You will need to create a login page (e.g., Doctor_login.html)
        window.location.href = 'Doctor_login.html';
    }
});

function listenForPendingAppointments(doctorId) {
    const appointmentsRef = collection(db, "appointments");
    const pendingQuery = query(appointmentsRef, where("doctorId", "==", doctorId), where("status", "==", "pending"));

    onSnapshot(pendingQuery, async (snapshot) => {
        const pendingCount = snapshot.size;

        if (pendingApprovalsValue) pendingApprovalsValue.textContent = pendingCount;
        if (pendingHeading) pendingHeading.textContent = `Pending (${pendingCount})`;

        // Update notification UI
        notificationList.innerHTML = '';
        if (notificationDot) {
            if (pendingCount > 0) {
                notificationDot.classList.remove('hidden');
                if (noNotificationsMessage) noNotificationsMessage.classList.add('hidden');
            } else {
                notificationDot.classList.add('hidden');
                if (noNotificationsMessage) noNotificationsMessage.classList.remove('hidden');
            }
        }

        // Update pending list UI
        pendingList.innerHTML = '';
        if (pendingCount === 0) {
            if (noPendingMessage) noPendingMessage.style.display = 'block';
        } else {
            if (noPendingMessage) noPendingMessage.style.display = 'none';

            for (const appointmentDoc of snapshot.docs) {
                const appointmentData = appointmentDoc.data();
                const patientId = appointmentData.patientId;
                const patientDocRef = doc(db, "patients", patientId);
                const patientDocSnap = await getDoc(patientDocRef);

                if (patientDocSnap.exists()) {
                    const patientData = patientDocSnap.data();

                    // Create notification item for the dropdown
                    const notificationItem = document.createElement('div');
                    notificationItem.className = 'p-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer';
                    notificationItem.innerHTML = `
                        <div class="patient-avatar bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style="background-image: url('https://ui-avatars.com/api/?name=${encodeURIComponent(patientData.fullName)}&background=random')"></div>
                        <div>
                            <p class="text-sm font-medium text-neutral-text dark:text-slate-100">${patientData.fullName}</p>
                            <p class="text-xs text-neutral-subtext dark:text-slate-400">New appointment request</p>
                        </div>
                    `;
                    notificationList.appendChild(notificationItem);

                    // Create and populate the main pending list card
                    const card = pendingTemplate.cloneNode(true);
                    card.style.display = 'flex';
                    card.setAttribute('id', `pending-${appointmentDoc.id}`);
                    
                    card.querySelector('.patient-name').textContent = patientData.fullName;
                    card.querySelector('.request-type').textContent = appointmentData.type || 'Consultation Request';
                    
                    const avatar = card.querySelector('.patient-avatar');
                    avatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(patientData.fullName)}&background=random&color=fff')`;

                    // Add event listeners for buttons
                    card.querySelector('.accept-button').addEventListener('click', async () => {
                        await updateDoc(doc(db, "appointments", appointmentDoc.id), { status: 'confirmed' });
                        // The real-time listener will automatically handle UI updates
                    });

                    card.querySelector('.decline-button').addEventListener('click', async () => {
                        await updateDoc(doc(db, "appointments", appointmentDoc.id), { status: 'declined' });
                        // The real-time listener will automatically handle UI updates
                    });

                    pendingList.appendChild(card);
                }
            }
        }
    });
}

function listenForUpcomingAppointments(doctorId) {
    const appointmentsRef = collection(db, "appointments");
    const now = Timestamp.now();
    const upcomingQuery = query(
        appointmentsRef, 
        where("doctorId", "==", doctorId), 
        where("status", "==", "confirmed"), 
        where("appointmentDate", ">=", now)
    );

    onSnapshot(upcomingQuery, async (snapshot) => {
        const upcomingCount = snapshot.size;

        if (upcomingHeading) upcomingHeading.textContent = `Upcoming (${upcomingCount})`;
        upcomingList.innerHTML = '';

        if (upcomingCount === 0) {
            if (noUpcomingMessage) noUpcomingMessage.style.display = 'block';
        } else {
            if (noUpcomingMessage) noUpcomingMessage.style.display = 'none';

            for (const appointmentDoc of snapshot.docs) {
                    
                const appointmentData = appointmentDoc.data();
                    const appointmentDate = appointmentData.appointmentDate.toDate();
                    // If the appointment is in the past and no one joined, skip it.
                    if (appointmentDate < new Date() && !appointmentData.patientJoined && !appointmentData.doctorJoined) continue;

                const patientId = appointmentData.patientId;

                const patientDocRef = doc(db, "patients", patientId);
                const patientDocSnap = await getDoc(patientDocRef);

                if (patientDocSnap.exists()) {
                    const patientData = patientDocSnap.data();
                    const card = upcomingTemplate.cloneNode(true);
                    card.classList.remove('hidden');
                    card.classList.add('flex');
                    card.setAttribute('id', `upcoming-${appointmentDoc.id}`);

                    // Populate patient info
                    card.querySelector('.upcoming-patient-name').textContent = patientData.fullName;
                    card.querySelector('.upcoming-patient-details').textContent = patientData.age ? `${patientData.age}, ${patientData.gender}` : 'Details unavailable';
                    
                    const avatar = card.querySelector('.upcoming-patient-avatar');
                    avatar.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(patientData.fullName)}&background=random')`;

                    // Populate appointment info
                    card.querySelector('.upcoming-date').textContent = appointmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    card.querySelector('.upcoming-time').textContent = appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const type = appointmentData.type || 'Video Call';
                    const typeIcon = card.querySelector('.upcoming-type-icon .material-symbols-outlined');
                    const typeText = card.querySelector('.upcoming-type-text');
                    const actionButton = card.querySelector('.upcoming-action-button');

                    typeText.textContent = type;
                    actionButton.textContent = type === 'Chat' ? 'Start Chat' : 'Join Call';
                    typeIcon.textContent = type === 'Chat' ? 'chat' : 'videocam';

                    actionButton.addEventListener('click', async () => {
                        if (type !== 'Chat') {
                            await startVideoCall(appointmentDoc.id);
                        }
                    });

                    upcomingList.appendChild(card);
                }
            }
        }
    });
}

async function startVideoCall(appointmentId) {
    // The roomID should be unique for each appointment. Using the appointmentId is a good approach.
    const roomID = appointmentId;

    if (!roomID) {
        alert("Could not create a video session. Appointment ID is missing.");
        return;
    }

    const appointmentRef = doc(db, "appointments", appointmentId);
    await updateDoc(appointmentRef, {
        // Use a distinct field for the Zego room ID
        zegoRoomId: roomID,
        status: 'in-progress' // This status will trigger the patient's notification
    });

    // Redirect to the ZegoUIKit page
    window.location.href = `WEB_UIKITS.html?roomID=${roomID}&role=Host`;
}

async function renderCalendar(date, uid) {
    if (!calendarMonthYear || !calendarDaysGrid) return;

    const month = date.getMonth();
    const year = date.getFullYear();

    calendarMonthYear.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    calendarDaysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // --- Fetch appointments for the current calendar view ---
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const appointmentsRef = collection(db, "appointments");
    const appointmentsQuery = query(appointmentsRef, where("doctorId", "==", uid), where("appointmentDate", ">=", monthStart), where("appointmentDate", "<=", monthEnd));
    const appointmentSnapshot = await getDocs(appointmentsQuery);
    const appointmentDays = new Set(appointmentSnapshot.docs.map(doc => doc.data().appointmentDate.toDate().getDate()));

    // Add blank spaces for days before the 1st of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDaysGrid.insertAdjacentHTML('beforeend', '<span class="p-1.5"></span>');
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const today = new Date();
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const hasAppointment = appointmentDays.has(day);

        let dayClasses = 'p-1.5 rounded-full flex items-center justify-center aspect-square relative cursor-pointer';
        if (isToday) {
            dayClasses += ' bg-primary text-white font-semibold';
        } else if (hasAppointment) {
            dayClasses += ' bg-secondary/20 dark:bg-secondary/30 text-secondary font-semibold';
        } else {
            dayClasses += ' hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer';
        }

        let dayHTML = `<span class="${dayClasses}">${day}`;
        // The dot is no longer needed as we are changing the background color.
        // if (hasAppointment && !isToday) {
        //     // Add a dot for days with appointments
        //     dayHTML += '<div class="absolute bottom-1.5 h-1 w-1 bg-secondary rounded-full"></div>';
        // }
        dayHTML += '</span>';

        calendarDaysGrid.insertAdjacentHTML('beforeend', dayHTML);
    }
}

if (prevMonthButton && nextMonthButton) {
    prevMonthButton.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        const user = auth.currentUser;
        if (user) renderCalendar(currentCalendarDate, user.uid);
    });

    nextMonthButton.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        const user = auth.currentUser;
        if (user) renderCalendar(currentCalendarDate, user.uid);
    });
}