// src/components/LabReportsViewer.js
import React, { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

function LabReportsViewer({ patientId }) {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const reportsRef = ref(storage, `lab_reports/${patientId}/`);
    listAll(reportsRef)
      .then((res) => {
        const fetchURLs = res.items.map((itemRef) => getDownloadURL(itemRef));
        return Promise.all(fetchURLs);
      })
      .then((urls) => setReports(urls))
      .catch((err) => console.error("Error loading lab reports:", err));
  }, [patientId]);

  return (
    <div>
      <h4>Lab Reports</h4>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {reports.length > 0 ? (
          reports.map((url, index) => (
            <div key={index}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Report ${index + 1}`} width="120" height="120" />
              </a>
            </div>
          ))
        ) : (
          <p>No reports uploaded.</p>
        )}
      </div>
    </div>
  );
}

export default LabReportsViewer;
