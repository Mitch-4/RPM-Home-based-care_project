// src/components/AlertHistory.js
import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

function AlertHistory({ patientId }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const alertRef = ref(db, `patients/${patientId}/alerts`);
    const unsubscribe = onValue(alertRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.entries(data).map(([time, val]) => ({
          time,
          ...val
        })).reverse();
        setAlerts(parsed);
      }
    });

    return () => unsubscribe();
  }, [patientId]);

  return (
    <div>
      <h4>Alert History</h4>
      <ul>
        {alerts.length > 0 ? (
          alerts.map((alert, index) => (
            <li key={index} style={{ color: alert.type === "critical" ? "red" : "orange" }}>
              {alert.message} @ {alert.time}
            </li>
          ))
        ) : (
          <p>No alerts yet.</p>
        )}
      </ul>
    </div>
  );
}

export default AlertHistory;
