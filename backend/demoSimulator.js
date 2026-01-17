// backend/demoSimulator.js
// CLEAN + SYNCHRONIZED VERSION (GRAPH + TIMESTAMP FIXED)
// Values displayed = alerts generated (1:1 mapping)

const { db } = require("./services/firebaseService");

// DEMO PATIENT ID
const DEMO_PATIENT_ID = "ZXVqNFx1pcRhxRx2VQMz3zNLaVJ3";

// Clinical thresholds
const THRESHOLDS = {
  heartRate: { min: 60, max: 100 },
  respirationRate: { min: 12, max: 20 }
};

// Scenarios
const SCENARIOS = [
  {
    name: "NORMAL - Baseline",
    duration: 6,
    heartRate: 75,
    respirationRate: 16,
    movement: 2,
    movementRange: 50
  },
  {
    name: "ELEVATED - Rising Fast",
    duration: 6,
    heartRate: 105,
    respirationRate: 21,
    movement: 3,
    movementRange: 70
  },
  {
    name: "TACHYCARDIA + TACHYPNEA - ALERTS!",
    duration: 12,
    heartRate: 120,
    respirationRate: 25,
    movement: 4,
    movementRange: 85
  },
  {
    name: "CRITICAL - Multiple Alerts",
    duration: 10,
    heartRate: 130,
    respirationRate: 28,
    movement: 4,
    movementRange: 95
  },
  {
    name: "RECOVERY - Stabilizing",
    duration: 10,
    heartRate: 80,
    respirationRate: 17,
    movement: 2,
    movementRange: 55
  },
  {
    name: "NORMAL - Stable",
    duration: 999,
    heartRate: 75,
    respirationRate: 16,
    movement: 2,
    movementRange: 50
  }
];

// Timing
const INTERVAL_SECONDS = 5;
let readingCounter = 0;

// Simulator state
let currentScenarioIndex = 0;
let scenarioStep = 0;

// Utility: small realistic variation
function vary(base, range = 2) {
  return base + (Math.random() * range * 2 - range);
}

// Startup logs
console.log("\n⚡ ========================================");
console.log("🏥 DEMO SIMULATOR (GRAPH MODE) STARTED");
console.log("========================================");
console.log(`📍 Patient ID: ${DEMO_PATIENT_ID}`);
console.log(`⏱️ Interval: ${INTERVAL_SECONDS}s`);
console.log("========================================\n");

// Generate vitals (graph-friendly)
function generateVitals(scenario) {
  const now = new Date();

  const heartRate = Math.round(vary(scenario.heartRate, 3));
  const respirationRate = Math.round(vary(scenario.respirationRate, 2));
  const movement = Math.max(0, Math.round(vary(scenario.movement, 1)));

  return {
    patientId: DEMO_PATIENT_ID,

    // Chart values
    heartRate,
    respirationRate,
    movement,
    movementRange: scenario.movementRange,

    presence: 1,

    // Time (BOTH formats — frontend can use either)
    timestamp: now.toISOString(),
    timeRecorded: now.toISOString(),
    epoch: now.getTime(),

    source: "simulator"
  };
}

// Alert generation (unchanged logic)
function checkAndCreateAlerts(vitals) {
  const alerts = [];

  if (vitals.heartRate > THRESHOLDS.heartRate.max) {
    alerts.push({
      type: vitals.heartRate >= 120 ? "CRITICAL" : "WARNING",
      parameter: "Heart Rate",
      message: `Tachycardia detected: ${vitals.heartRate} bpm`,
      value: vitals.heartRate,
      threshold: "60-100",
      patientId: DEMO_PATIENT_ID,
      timestamp: vitals.timestamp,
      acknowledged: false,
      source: "simulator"
    });
  }

  if (vitals.respirationRate > THRESHOLDS.respirationRate.max) {
    alerts.push({
      type: vitals.respirationRate >= 24 ? "CRITICAL" : "WARNING",
      parameter: "Respiration Rate",
      message: `Tachypnea detected: ${vitals.respirationRate} breaths/min`,
      value: vitals.respirationRate,
      threshold: "12-20",
      patientId: DEMO_PATIENT_ID,
      timestamp: vitals.timestamp,
      acknowledged: false,
      source: "simulator"
    });
  }

  alerts.forEach(alert => {
    db.ref(`alerts`)
      .push(alert)
      .then(() =>
        console.log(`🚨 ALERT → ${alert.parameter}: ${alert.value}`)
      )
      .catch(err =>
        console.error("❌ Alert write failed:", err.message)
      );
  });
}

// Main loop
const interval = setInterval(() => {
  const scenario = SCENARIOS[currentScenarioIndex];

  if (scenarioStep === 0) {
    console.log(`\n🎬 ===== ${scenario.name} =====`);
  }

  readingCounter++;
  scenarioStep++;

  const vitals = generateVitals(scenario);

  // Push to logs AND update "latest" for frontend cards
  const logsRef = db.ref(`patients/${DEMO_PATIENT_ID}/logs`);
  const latestRef = db.ref(`patients/${DEMO_PATIENT_ID}/latest`);

  logsRef.push(vitals)
    .then(() => latestRef.set(vitals))  // ✅ Update latest
    .then(() => {
      console.log(
        `📊 [${readingCounter}] HR:${vitals.heartRate} RR:${vitals.respirationRate} MOV:${vitals.movement} → latest updated`
      );
      checkAndCreateAlerts(vitals);
    })
    .catch(err =>
      console.error("❌ Vitals write failed:", err.message)
    );

  if (scenarioStep >= scenario.duration) {
    scenarioStep = 0;
    if (currentScenarioIndex < SCENARIOS.length - 1) {
      currentScenarioIndex++;
    }
  }
}, INTERVAL_SECONDS * 1000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️ Stopping simulator...");
  clearInterval(interval);
  process.exit(0);
});
