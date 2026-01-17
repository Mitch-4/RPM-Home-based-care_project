import { ref, onChildAdded } from "firebase/database";
import { db } from "../utils/firebase.js";

export const setupRealtime = (io) => {
  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);
    
    // ✅ FIXED: Correct event name that frontend uses
    socket.on("join-patient-room", (patientId) => {
      console.log(`🏠 Client ${socket.id} joining room: ${patientId}`); // ⚠️ FIXED
      
      // ✅ Join socket.io room
      socket.join(patientId);
      
      // Listen to vitals for this patient
      const vitalsRef = ref(db, `vitals/${patientId}`);
      onChildAdded(vitalsRef, (snapshot) => {
        const data = snapshot.val();
        console.log(`📊 New vital for ${patientId}:`, data); // ⚠️ FIXED
        
        // ✅ FIXED: Emit to room only, not globally
        io.to(patientId).emit("new-vital", { 
          patientId, 
          ...data,
          timeRecorded: data.timeRecorded || data.timestamp 
        });
      });
    });
    
    // Handle leaving room
    socket.on("leave-patient-room", (patientId) => {
      console.log(`🚪 Client ${socket.id} leaving room: ${patientId}`); // ⚠️ FIXED
      socket.leave(patientId);
    });
    
    // Alerts
    const alertsRef = ref(db, "alerts");
    onChildAdded(alertsRef, (snapshot) => {
      const alert = snapshot.val();
      console.log("🚨 New alert:", alert);
      
      // ✅ FIXED: Send to specific patient room
      if (alert.patientId) {
        io.to(alert.patientId).emit("alert", alert);
      } else {
        io.emit("new-alert", alert);
      }
    });
    
    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
};