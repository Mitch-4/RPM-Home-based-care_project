// src/components/VitalsChart.js
import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

function VitalsChart({ patientId }) {
  const [vitals, setVitals] = useState([]);

  useEffect(() => {
    // Connect to backend WebSocket
    const socket = new WebSocket("ws://localhost:4000"); // change port if needed

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
      // Tell backend which patient we are interested in
      socket.send(JSON.stringify({ type: "subscribe", patientId }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Only update if this data is for the current patient
      if (data.patientId === patientId) {
        setVitals((prev) => [
          ...prev,
          {
            time: new Date(data.timestamp).toLocaleString(),
            heartRate: data.heartRate,
            respiration: data.respirationRate,
          },
        ]);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    return () => socket.close();
  }, [patientId]);

  return (
    <div>
      <h4>Vitals Trend</h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={vitals} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="heartRate" stroke="#e74c3c" name="Heart Rate" />
          <Line type="monotone" dataKey="respiration" stroke="#2980b9" name="Breathing Rate" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default VitalsChart;
