// src/components/TestRealtime.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", { transports: ["websocket"] });

export default function TestRealtime() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [vitals, setVitals] = useState([]);
  const [latest, setLatest] = useState({});
  const [alerts, setAlerts] = useState([]);

  // Fetch patients on load
  useEffect(() => {
    console.log("Fetching patients from backend...");
    axios.get("http://localhost:5000/api/v1/patients")
      .then(res => {
        console.log("Patients response:", res.data);
        const pts = res.data.patients || [];
        setPatients(pts);
      })
      .catch(err => console.error("Error fetching patients:", err));
  }, []);

  // Fetch vitals and alerts when a patient is selected
  useEffect(() => {
    if (!selectedPatient) return;

    console.log("Selected patient:", selectedPatient);

    // Fetch last 50 vitals
    axios.get(`http://localhost:5000/api/v1/vitals/${selectedPatient}?limit=50`)
      .then(res => {
        console.log("Vitals response:", res.data);
        const data = res.data.data || [];
        setVitals(data);
        if (data.length) setLatest(data[data.length - 1]);
      })
      .catch(err => console.error("Error fetching vitals:", err));

    // Fetch alerts
    axios.get(`http://localhost:5000/api/v1/alerts/${selectedPatient}?limit=50`)
      .then(res => {
        console.log("Alerts response:", res.data);
        setAlerts(res.data.alerts || []);
      })
      .catch(err => console.error("Error fetching alerts:", err));

    // Join socket room
    socket.emit("join-patient-room", selectedPatient);
    console.log(`Joined socket room for patient ${selectedPatient}`);

    // Handle incoming real-time vitals
    const vitalsHandler = (data) => {
      console.log("Real-time vital received:", data);
      setVitals(prev => [...prev.slice(-49), data]);
      setLatest(data);
    };

    // Handle incoming alerts
    const alertHandler = (alert) => {
      console.log("Real-time alert received:", alert);
      setAlerts(prev => [...prev, alert]);
    };

    socket.on("new-vital", vitalsHandler);
    socket.on("alert", alertHandler);

    return () => {
      socket.emit("leave-patient-room", selectedPatient);
      socket.off("new-vital", vitalsHandler);
      socket.off("alert", alertHandler);
      console.log(`Left socket room for patient ${selectedPatient}`);
    };
  }, [selectedPatient]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Realtime Test</h1>

      <div style={{ marginBottom: "20px" }}>
        <label>Select Patient: </label>
        <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}>
          <option value="">-- Select --</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.name || p.id}</option>
          ))}
        </select>
      </div>

      <h2>Vitals (latest 50)</h2>
      <pre>{JSON.stringify(vitals, null, 2)}</pre>

      <h2>Latest Vital</h2>
      <pre>{JSON.stringify(latest, null, 2)}</pre>

      <h2>Alerts</h2>
      <pre>{JSON.stringify(alerts, null, 2)}</pre>
    </div>
  );
}
