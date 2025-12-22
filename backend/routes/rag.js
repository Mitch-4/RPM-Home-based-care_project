const express = require("express");
const axios = require("axios");
const router = express.Router();

const { getVitals } = require("../services/firebaseService"); // ✅ FIXED PATH

router.post("/query", async (req, res) => {
  try {
    const { question, role, patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    // 🔹 Fetch vitals from Firebase
    const vitals = await getVitals(patientId, 20);

    if (!vitals.length) {
      return res.status(404).json({ error: "No vitals found" });
    }

    // 🔹 Convert to RAG-friendly arrays
    const patientContext = {
      heartRate: vitals.map(v => v.heartRate).filter(Boolean),
      respirationRate: vitals.map(v => v.respirationRate).filter(Boolean),
      movement: vitals.map(v => v.movement).filter(Boolean),
      timestamps: vitals.map(v => v.time)
    };

    // 🔹 Send to FastAPI
    const response = await axios.post("http://127.0.0.1:8000/query", {
      question,
      role,
      patient_context: patientContext
    });

    res.json(response.data);

  } catch (error) {
    console.error("RAG error:", error.message);
    res.status(500).json({ error: "RAG service unavailable" });
  }
});

module.exports = router;
