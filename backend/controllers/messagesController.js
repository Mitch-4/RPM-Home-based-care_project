const { ref, get, push, update } = require("firebase/database");
const { db } = require("../services/firebaseService");

// GET messages for a specific patient
const getMessages = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit || "100", 10);

    const snapshot = await get(ref(db, `messages/${patientId}`));
    const data = snapshot.val() || {};

    // Convert to array and sort by timestamp
    const messages = Object.keys(data)
      .map((id) => ({ id, ...data[id] }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);

    res.json({ ok: true, messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// POST a new message
const createMessage = async (req, res) => {
  try {
    const message = req.body;
    if (!message || !message.patientId || !message.text || !message.senderId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const fullMessage = {
      ...message,
      read: false,
      timestamp: Date.now(),
    };

    const newRef = await push(ref(db, `messages/${message.patientId}`), fullMessage);

    // Emit message to the patient room
    if (req.app.locals.io && message.patientId) {
      req.app.locals.io.to(message.patientId).emit("message", { id: newRef.key, ...fullMessage });
    }

    res.json({ ok: true, message: "Message sent successfully", id: newRef.key });
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// PATCH: Mark all messages as read for a patient
const markMessagesAsRead = async (req, res) => {
  try {
    const { patientId } = req.params;

    const snapshot = await get(ref(db, `messages/${patientId}`));
    const data = snapshot.val() || {};

    const updates = {};
    Object.keys(data).forEach((id) => {
      if (!data[id].read) {
        updates[`${id}/read`] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(db, `messages/${patientId}`), updates);

      // Emit real-time update
      if (req.app.locals.io) {
        req.app.locals.io.to(patientId).emit("messagesRead");
      }
    }

    res.json({ ok: true, message: "All messages marked as read" });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { getMessages, createMessage, markMessagesAsRead };
