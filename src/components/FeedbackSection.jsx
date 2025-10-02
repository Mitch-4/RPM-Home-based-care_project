// src/components/FeedbackSection.js
import React, { useState, useEffect } from "react";
import { ref, set, onValue } from "firebase/database";
import { db } from "../firebase";

function FeedbackSection({ patientId }) {
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const feedbackRef = ref(db, `patients/${patientId}/feedback`);
    onValue(feedbackRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFeedback(data);
      }
    });
  }, [patientId]);

  const handleSave = () => {
    const feedbackRef = ref(db, `patients/${patientId}/feedback`);
    set(feedbackRef, feedback);
  };

  return (
    <div>
      <h4>Doctor Feedback / Notes</h4>
      <textarea
        rows="5"
        cols="60"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Write your recommendations or notes here..."
      />
      <br />
      <button onClick={handleSave}>Save Feedback</button>
    </div>
  );
}

export default FeedbackSection;
