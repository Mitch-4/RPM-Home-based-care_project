const firebaseService = require('../services/firebaseService');

// Get alerts for a patient
exports.getAlerts = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit || '200', 10);
    const alerts = await firebaseService.getAlerts(patientId, limit);
    return res.json({ ok: true, alerts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Get all alerts for all patients
exports.getAllAlerts = async (req, res) => {
  try {
    const allAlerts = await firebaseService.getAllPatientsAlerts();
    return res.json({ ok: true, patients: allAlerts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Create manual alert and emit via Socket.IO
exports.createAlert = async (req, res) => {
  try {
    const alert = req.body;
    const savedAlert = await firebaseService.pushAlert(alert);

    // Emit to Socket.IO room
    const io = req.app.locals.io;
    if (io) io.to(alert.patientId).emit('alert', savedAlert);

    return res.json({ ok: true, alert: savedAlert });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// Mark all alerts as read for a patient
exports.markAlertsRead = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { alertIds } = req.body; // use IDs sent from frontend

    // Get existing alerts directly from the correct path
    const alertsRef = firebaseService.db.ref(`patients/${patientId}/alerts`);
    const snapshot = await alertsRef.once('value');
    const alertsData = snapshot.val();

    if (!alertsData) {
      return res.status(404).json({ ok: false, message: "No alerts found" });
    }

    // Only update the alerts whose IDs were sent
    alertIds.forEach(id => {
      if (alertsData[id]) {
        alertsData[id].read = true;
      }
    });

    // Write the updated alerts back to Firebase
    await alertsRef.set(alertsData);

    return res.json({ ok: true, message: "Alerts marked as read" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};


