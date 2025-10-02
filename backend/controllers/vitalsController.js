// controllers/vitalsController.js
const firebaseService = require('../services/firebaseService');

function determineStatus(heartRate, respirationRate) {
  if (heartRate < 50 || heartRate > 110 || respirationRate < 9 || respirationRate > 24) {
    return { severity: 'red', reason: 'critical' };
  }
  if (
    (heartRate > 100 && heartRate <= 110) ||
    (heartRate >= 50 && heartRate < 60) ||
    (respirationRate > 20 && respirationRate <= 24) ||
    (respirationRate >= 9 && respirationRate < 12)
  ) {
    return { severity: 'yellow', reason: 'warning' };
  }
  return { severity: 'green', reason: 'ok' };
}

// ==================== INGEST ====================
exports.ingest = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { heartRate, respirationRate, deviceId, timestamp } = req.body || {};

    if (!patientId) return res.status(400).json({ error: 'patientId required in path' });
    if (heartRate == null || respirationRate == null) {
      return res.status(400).json({ error: 'heartRate and respirationRate are required in body' });
    }

    const entry = {
      heartRate: Number(heartRate),
      respirationRate: Number(respirationRate),
      deviceId: deviceId || null,
      timestamp: timestamp || new Date().toISOString()
    };

    // Store in Firebase
    const timeKey = await firebaseService.pushVital(patientId, entry);

    // Determine alert status
    const status = determineStatus(entry.heartRate, entry.respirationRate);
    if (status.severity === 'red' || status.severity === 'yellow') {
      const alert = {
        patientId,
        heartRate: entry.heartRate,
        respirationRate: entry.respirationRate,
        severity: status.severity,
        reason: status.reason,
        createdAt: new Date().toISOString()
      };
      await firebaseService.pushAlert(alert);

      // Emit alert only to patient room
      const io = req.app.locals.io;
      if (io) io.to(patientId).emit('alert', alert);
    }

    // Emit new vitals to patient room
    const io = req.app.locals.io;
    const payload = {
      time: timeKey,
      heartRate: entry.heartRate,
      respiration: entry.respirationRate,
      movement: entry.movement || 0,
      deviceId: entry.deviceId,
      timestamp: entry.timestamp
    };
    if (io) io.to(patientId).emit('new-vital', payload);

    return res.json({ ok: true, timeKey });
  } catch (err) {
    console.error('ingest error', err);
    return res.status(500).json({ error: 'server error', details: err.message });
  }
};

// ==================== GET VITALS ====================
exports.getVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const vitals = await firebaseService.getVitals(patientId, limit);
    res.json(vitals);
  } catch (err) {
    console.error('getVitals error:', err);
    res.status(500).json({ error: 'server error' });
  }
};

// ==================== GET LATEST VITALS ====================
exports.getLatestVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const vitals = await firebaseService.getLatestVitals(patientId);
    res.json(vitals);
  } catch (err) {
    console.error('getLatestVitals error:', err);
    res.status(500).json({ error: 'server error' });
  }
};

// ==================== UPDATE VITALS ====================
exports.updateVitals = async (req, res) => {
  try {
    const { patientId, time } = req.params;
    await firebaseService.updateVitals(patientId, time, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('updateVitals error:', err);
    res.status(500).json({ error: 'server error' });
  }
};

// ==================== GET ALL PATIENTS VITALS ====================
exports.getAllVitals = async (req, res) => {
  try {
    const all = await firebaseService.getAllPatientsVitals();
    res.json(all);
  } catch (err) {
    console.error('getAllVitals error:', err);
    res.status(500).json({ error: 'server error' });
  }
};
