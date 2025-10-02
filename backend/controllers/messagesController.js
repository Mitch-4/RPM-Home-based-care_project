const { ref, get, push } = require("firebase/database");
const { db } = require("../services/firebaseService");

// GET all messages
const getMessages = async (req, res) => {
  try {
    const snapshot = await get(ref(db, "messages"));
    const data = snapshot.val() || {};
    const messages = Object.keys(data).map((id) => ({ id, ...data[id] }));
    res.json({ messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST a new message
const createMessage = async (req, res) => {
  try {
    const message = req.body; // expect { patientId, sender, text, createdAt }
    if (!message || !message.patientId || !message.text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await push(ref(db, "messages"), message);

    // Emit via Socket.IO if io is available
    if (req.app.locals.io && message.patientId) {
      req.app.locals.io.to(message.patientId).emit("message", message);
    }

    res.json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getMessages, createMessage };
