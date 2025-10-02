import { ref, onChildAdded } from "firebase/database";
import { db } from "../utils/firebase.js";

export const setupRealtime = (io) => {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Listen for vitals changes
    socket.on("subscribe-patient", (patientId) => {
      const vitalsRef = ref(db, `vitals/${patientId}`);
      onChildAdded(vitalsRef, (snapshot) => {
        const data = snapshot.val();
        io.emit("new-vital", { patientId, ...data });
      });
    });

    // Example for alerts/messages
    const alertsRef = ref(db, "alerts");
    onChildAdded(alertsRef, (snapshot) => {
      io.emit("new-alert", snapshot.val());
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
