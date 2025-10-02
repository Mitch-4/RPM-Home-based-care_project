// services/deviceAuthService.js
const authorizedDevices = {
  "device-123": "PatientA",
  "device-456": "PatientB"
};

function isAuthorized(deviceKey) {
  return authorizedDevices.hasOwnProperty(deviceKey);
}

function getPatientForDevice(deviceKey) {
  return authorizedDevices[deviceKey];
}

module.exports = { isAuthorized, getPatientForDevice };
