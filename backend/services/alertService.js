// services/alertService.js
const firebaseService = require("./firebaseService");

async function createAlert(patientId, type, message) {
  const alert = {
    patientId,
    type, // e.g. "critical", "warning"
    message,
    timestamp: new Date().toISOString()
  };

  // save to Firebase or DB
  await firebaseService.saveData(`alerts/${patientId}`, alert);

  return alert;
}

async function getAlerts(patientId) {
  return await firebaseService.getData(`alerts/${patientId}`);
}

module.exports = { createAlert, getAlerts };
