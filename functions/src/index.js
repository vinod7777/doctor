const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const APPOINTMENT_STATUSES = new Set([
  "pending",
  "confirmed",
  "in-progress",
  "completed",
  "declined",
  "canceled",
]);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    return next();
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "book-a-doctor-api" });
});

app.get("/doctors", authenticate, async (req, res) => {
  const { q = "", specialization = "" } = req.query;

  try {
    const snapshot = await db
      .collection("doctors")
      .where("approvalStatus", "==", "approved")
      .get();

    const term = String(q).trim().toLowerCase();
    const filterSpecialization = String(specialization).trim().toLowerCase();

    const doctors = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doctor) => {
        const name = String(doctor.fullName || "").toLowerCase();
        const spec = String(doctor.specialization || "").toLowerCase();
        const nameMatch = !term || name.includes(term);
        const specMatch = !filterSpecialization || spec.includes(filterSpecialization);
        return nameMatch && specMatch;
      });

    return res.json({ data: doctors });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/appointments", authenticate, requireRole(["patient", "admin"]), async (req, res) => {
  const {
    doctorId,
    appointmentDate,
    type = "Video Call",
    chiefComplaint = "",
    attachedDocumentUrl = null,
    documentFileName = null,
  } = req.body || {};

  if (!doctorId || !appointmentDate) {
    return badRequest(res, "doctorId and appointmentDate are required");
  }

  const parsedDate = new Date(appointmentDate);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
    return badRequest(res, "appointmentDate must be a valid future date");
  }

  try {
    const doctorSnap = await db.collection("doctors").doc(doctorId).get();
    if (!doctorSnap.exists) {
      return badRequest(res, "Doctor not found");
    }

    const doctorData = doctorSnap.data();
    if (doctorData.approvalStatus !== "approved") {
      return badRequest(res, "Doctor is not approved for booking");
    }

    const patientId = req.user.role === "admin" && req.body.patientId
      ? req.body.patientId
      : req.user.uid;

    const appointment = {
      patientId,
      doctorId,
      appointmentDate: admin.firestore.Timestamp.fromDate(parsedDate),
      type,
      chiefComplaint,
      attachedDocumentUrl,
      documentFileName,
      status: "pending",
      patientJoined: false,
      doctorJoined: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const result = await db.collection("appointments").add(appointment);
    return res.status(201).json({ id: result.id, message: "Appointment created" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.patch("/appointments/:id/reschedule", authenticate, requireRole(["patient", "admin"]), async (req, res) => {
  const appointmentId = req.params.id;
  const { appointmentDate } = req.body || {};

  if (!appointmentDate) {
    return badRequest(res, "appointmentDate is required");
  }

  const parsedDate = new Date(appointmentDate);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
    return badRequest(res, "appointmentDate must be a valid future date");
  }

  try {
    const ref = db.collection("appointments").doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const appointment = snap.data();
    const isOwner = appointment.patientId === req.user.uid;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Cannot reschedule this appointment" });
    }

    await ref.update({
      appointmentDate: admin.firestore.Timestamp.fromDate(parsedDate),
      status: "pending",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ message: "Appointment rescheduled and set to pending" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.patch("/appointments/:id/status", authenticate, requireRole(["doctor", "admin"]), async (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body || {};

  if (!status || !APPOINTMENT_STATUSES.has(status)) {
    return badRequest(res, "Valid status is required");
  }

  try {
    const ref = db.collection("appointments").doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const appointment = snap.data();
    const isAssignedDoctor = appointment.doctorId === req.user.uid;
    if (!isAssignedDoctor && req.user.role !== "admin") {
      return res.status(403).json({ error: "Cannot update this appointment" });
    }

    await ref.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ message: "Appointment status updated" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/appointments", authenticate, async (req, res) => {
  const role = req.user.role;
  const status = req.query.status ? String(req.query.status) : null;

  try {
    let q;
    if (role === "patient") {
      q = db.collection("appointments").where("patientId", "==", req.user.uid);
    } else if (role === "doctor") {
      q = db.collection("appointments").where("doctorId", "==", req.user.uid);
    } else if (role === "admin") {
      q = db.collection("appointments");
    } else {
      return res.status(403).json({ error: "Role not allowed" });
    }

    const snapshot = await q.get();
    let appointments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (status) {
      appointments = appointments.filter((a) => a.status === status);
    }

    appointments.sort((a, b) => {
      const da = a.appointmentDate?.toDate?.() || new Date(0);
      const dbt = b.appointmentDate?.toDate?.() || new Date(0);
      return dbt - da;
    });

    return res.json({ data: appointments });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.patch("/admin/doctors/:uid/approve", authenticate, requireRole(["admin"]), async (req, res) => {
  const doctorUid = req.params.uid;
  const { approvalStatus = "approved" } = req.body || {};

  if (!["approved", "rejected", "pending"].includes(approvalStatus)) {
    return badRequest(res, "approvalStatus must be approved, rejected, or pending");
  }

  try {
    await db.collection("doctors").doc(doctorUid).set(
      {
        approvalStatus,
        approvedAt: approvalStatus === "approved"
          ? admin.firestore.FieldValue.serverTimestamp()
          : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (approvalStatus === "approved") {
      await admin.auth().setCustomUserClaims(doctorUid, { role: "doctor" });
    }

    return res.json({ message: "Doctor approval status updated" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/admin/users/:uid/role", authenticate, requireRole(["admin"]), async (req, res) => {
  const uid = req.params.uid;
  const { role } = req.body || {};

  if (!["patient", "doctor", "admin"].includes(role)) {
    return badRequest(res, "role must be patient, doctor, or admin");
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { role });
    await db.collection("users").doc(uid).set(
      {
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return res.json({ message: "Role updated" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/documents/metadata", authenticate, requireRole(["patient", "doctor", "admin"]), async (req, res) => {
  const {
    userId,
    documentType,
    fileName,
    fileUrl,
    uploadMethod = "file",
  } = req.body || {};

  if (!userId || !documentType || !fileUrl) {
    return badRequest(res, "userId, documentType, and fileUrl are required");
  }

  const canWriteForUser = req.user.uid === userId || req.user.role === "doctor" || req.user.role === "admin";
  if (!canWriteForUser) {
    return res.status(403).json({ error: "Cannot create records for this user" });
  }

  try {
    const result = await db.collection("medicalRecords").add({
      userId,
      documentType,
      fileName: fileName || `${documentType} Document`,
      fileUrl,
      uploadMethod,
      createdBy: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ id: result.id, message: "Document metadata saved" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

exports.api = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  app
);

exports.onAppointmentStatusChange = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after || before.status === after.status) {
      return;
    }

    const doctorId = after.doctorId;
    const patientId = after.patientId;
    const status = after.status;

    const payloads = [
      {
        userId: patientId,
        role: "patient",
        title: "Appointment Update",
        message: `Your appointment is now ${status}.`,
      },
      {
        userId: doctorId,
        role: "doctor",
        title: "Appointment Update",
        message: `Appointment status changed to ${status}.`,
      },
    ];

    const writes = payloads.map((payload) =>
      db.collection("notifications").add({
        ...payload,
        appointmentId: event.params.appointmentId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    );

    await Promise.all(writes);
  }
);
