import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { app } from './firebase_config.js';

const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const notificationsButton = document.getElementById('notifications-button');
    const notificationsDropdown = document.getElementById('notifications-dropdown');
    const notificationDot = document.getElementById('notification-dot');
    const notificationList = document.getElementById('notification-list');
    const noNotificationsMessage = document.getElementById('no-notifications-message');

    if (notificationsButton && notificationsDropdown) {
        notificationsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            notificationsDropdown.classList.toggle('hidden');
        });

        window.addEventListener('click', (event) => {
            if (!notificationsDropdown.contains(event.target) && !notificationsButton.contains(event.target)) {
                notificationsDropdown.classList.add('hidden');
            }
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            listenForNotifications(user.uid);
        }
    });

    function listenForNotifications(patientId) {
        const appointmentsRef = collection(db, "appointments");
        const q = query(
            appointmentsRef,
            where("patientId", "==", patientId),
            where("status", "in", ["confirmed", "declined", "completed"])
        );

        onSnapshot(q, async (snapshot) => {
            const notifications = [];
            for (const appointmentDoc of snapshot.docs) {
                const data = appointmentDoc.data();
                const doctorDoc = await getDoc(doc(db, "doctors", data.doctorId));
                const doctorName = doctorDoc.exists() ? doctorDoc.data().fullName : "A doctor";

                let message = '';
                if (data.status === 'confirmed') {
                    message = `${doctorName} confirmed your appointment.`;
                } else if (data.status === 'declined') {
                    message = `${doctorName} declined your appointment.`;
                } else if (data.status === 'completed') {
                    message = `Your appointment with ${doctorName} is complete.`;
                }

                if (message) {
                    notifications.push({
                        id: appointmentDoc.id,
                        message: message,
                        doctorName: doctorName,
                        timestamp: data.appointmentDate.toDate()
                    });
                }
            }

            notifications.sort((a, b) => b.timestamp - a.timestamp);

            if (notificationList) {
                notificationList.innerHTML = '';
                if (notifications.length > 0) {
                    notificationDot?.classList.remove('hidden');
                    noNotificationsMessage?.classList.add('hidden');
                    notifications.forEach(notif => {
                        const item = document.createElement('div');
                        item.className = 'p-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer';
                        item.innerHTML = `
                            <div class="patient-avatar bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style="background-image: url('https://ui-avatars.com/api/?name=${encodeURIComponent(notif.doctorName)}&background=random')"></div>
                            <div>
                                <p class="text-sm font-medium text-neutral-text dark:text-slate-100">${notif.message}</p>
                                <p class="text-xs text-neutral-subtext dark:text-slate-400">${notif.timestamp.toLocaleDateString()}</p>
                            </div>`;
                        notificationList.appendChild(item);
                    });
                } else {
                    notificationDot?.classList.add('hidden');
                    noNotificationsMessage?.classList.remove('hidden');
                }
            }
        });
    }
});