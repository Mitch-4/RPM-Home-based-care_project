const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

// Resolve path to service account JSON
const serviceAccountPath = path.resolve(__dirname, process.env.SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// --- Patient CRUD ---
const getPatients = async () => {
  const snapshot = await db.ref("patients").once("value");
  const val = snapshot.val() || {};
  return Object.entries(val).map(([id, data]) => ({
    id,
    profile: data.profile || {}  // ✅ Keep it nested!
  }));
};

const getPatientById = async (id) => {
  const snapshot = await db.ref(`patients/${id}`).once("value");
  return snapshot.val() ? { id, ...snapshot.val() } : null;
};

const getPatientProfile = async (id) => {
  const snapshot = await db.ref(`patients/${id}/profile`).once("value");
  return snapshot.val() ? { id, ...snapshot.val() } : null;
};

const addPatient = async (id, data) => {
  await db.ref(`patients/${id}/profile`).set(data);
  return { id, ...data };
};

const updatePatient = async (id, data) => {
  await db.ref(`patients/${id}/profile`).update(data);
  return { id, ...data };
};

const deletePatient = async (id) => {
  await db.ref(`patients/${id}`).remove();
  return { success: true };
};

// --- Vitals management ---
const getVitals = async (patientId, limit = 200) => {
  const snapshot = await db
    .ref(`patients/${patientId}/logs`)
    .limitToLast(limit)
    .once("value");
  const val = snapshot.val();
  if (!val) return [];

  return Object.keys(val)
    .sort() // chronological order
    .map((key) => ({
      time: key,
      ...val[key],
    }));
};

const getLatestVitals = async (patientId) => {
  const snapshot = await db
    .ref(`patients/${patientId}/logs`)
    .limitToLast(1)
    .once("value");
  const val = snapshot.val();
  if (!val) return null;
  const key = Object.keys(val)[0];
  return { time: key, ...val[key] };
};

// --- Alerts management ---
const getAlerts = async (patientId, limit = 200) => {
  const snapshot = await db.ref(`alerts/${patientId}`).limitToLast(limit).once("value");
  const val = snapshot.val() || {};
  return Object.keys(val).map((key) => ({ id: key, ...val[key] }));
};

const getAllPatientsAlerts = async () => {
  const snapshot = await db.ref("alerts").once("value");
  const val = snapshot.val() || {};
  const result = {};
  for (const [patientId, alerts] of Object.entries(val)) {
    result[patientId] = Object.keys(alerts).map((key) => ({ id: key, ...alerts[key] }));
  }
  return result;
};

const pushAlert = async (alert) => {
  const ref = db.ref(`alerts/${alert.patientId}`).push();
  await ref.set(alert);
  return { id: ref.key, ...alert };
};


// ✅ New helper: mark multiple alerts as read
const updateAlerts = async (patientId, updates) => {
  const ref = db.ref(`alerts/${patientId}`);
  return ref.update(updates);
};

// --- Exports ---
module.exports = {
  db,
  getPatients,
  getPatientById,
  getPatientProfile,
  addPatient,
  updatePatient,
  deletePatient,
  getVitals,
  getLatestVitals,
  getAlerts,
  getAllPatientsAlerts,
  pushAlert,
  updateAlerts,
};
