// backend/dummyVitals.js
const { db } = require("./services/firebaseService");

// Configure your patient ID here
const patientId = "OLQmCyBwsoS8QHjgsh1aktQ8Fcc2";

// Function to generate realistic vitals
function generateVitals() {
  return {
    heartRate: Math.floor(Math.random() * 40) + 60,       // 60–100 bpm
    respirationRate: Math.floor(Math.random() * 8) + 12,  // 12–20 br/min
    movement: Math.floor(Math.random() * 5),              // 0–4
    movementRange: Math.floor(Math.random() * 100),       // 0–100
    presence: Math.random() > 0.1 ? 1 : 0,               // 90% chance present
    timeRecorded: new Date().toISOString(),
  };
}

// Push vitals to Firebase every 5 seconds
setInterval(() => {
  const newVital = generateVitals();
  const ref = db.ref(`patients/${patientId}/logs`).push();
  ref.set(newVital)
    .then(() => console.log("Pushed new vitals:", newVital))
    .catch(err => console.error("Error pushing vitals:", err));
}, 5000);

console.log("Dummy vitals generator running...");
