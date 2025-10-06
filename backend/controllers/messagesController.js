const { ref, get, push } = require("firebase/database");
const { db } = require("../services/firebaseService");

// GET messages for a specific patient
const getMessages = async (req, res) => {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit || '100', 10);
    
    const snapshot = await get(ref(db, `messages/${patientId}`));
    const data = snapshot.val() || {};
    const messages = Object.keys(data).map((id) => ({ id, ...data[id] }));
    
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
    if (!message || !message.patientId || !message.text) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    await push(ref(db, `messages/${message.patientId}`), message);
    
    if (req.app.locals.io && message.patientId) {
      req.app.locals.io.to(message.patientId).emit("message", message);
    }
    
    res.json({ ok: true, message: "Message sent successfully" });
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { getMessages, createMessage };