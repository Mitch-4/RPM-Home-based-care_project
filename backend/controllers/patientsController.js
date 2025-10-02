// src/controllers/patientsController.js
const firebaseService = require('../services/firebaseService');

// Helper to convert Firebase object to array
const toArray = (obj) => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return Object.keys(obj).map(key => ({ id: key, ...obj[key] }));
};


// List all patients
exports.list = async (req, res) => {
  try {
    const patientsObj = await firebaseService.getPatients();
    const patients = toArray(patientsObj);
    return res.json({ ok: true, patients });
  } catch (err) {
    console.error("patientsController.list error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Get a single patient profile
exports.get = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ ok: false, error: "patientId is required" });
    }

    const profile = await firebaseService.getPatientProfile(patientId);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "Patient not found" });
    }

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("patientsController.get error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Get all vitals for a patient
exports.getVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit || "200", 10);

    if (!patientId) {
      return res.status(400).json({ ok: false, error: "patientId is required" });
    }

    const vitals = await firebaseService.getVitals(patientId, limit);
    const adapted = (vitals || []).map(v => ({
      time: v.timeRecorded || v.time,
      heartRate: v.heartRate ?? 0,
      respiration: v.respirationRate ?? 0,
      movement: v.movement ?? 0,
    }));

    return res.json({ ok: true, data: adapted });
  } catch (err) {
    console.error("patientsController.getVitals error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Get latest vitals for a patient
exports.getLatestVitals = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ ok: false, error: "patientId is required" });
    }

    const latest = await firebaseService.getLatestVitals(patientId);
    if (!latest) {
      return res.status(404).json({ ok: false, error: "No vitals found" });
    }

    return res.json({ ok: true, latest });
  } catch (err) {
    console.error("patientsController.getLatestVitals error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};


// Update a specific vitals entry
exports.updateVitals = async (req, res) => {
  try {
    const { patientId, time } = req.params;
    const data = req.body;

    if (!patientId || !time) {
      return res.status(400).json({ ok: false, error: "patientId and time are required" });
    }

    await firebaseService.updateVitals(patientId, time, data);
    return res.json({ ok: true, message: "Vitals updated successfully" });
  } catch (err) {
    console.error("patientsController.updateVitals error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
