const express = require("express");
const { getMessages, createMessage, markMessagesAsRead } = require("../controllers/messagesController");
const router = express.Router();

// GET messages for a specific patient
router.get("/:patientId", getMessages);

// POST a new message
router.post("/", createMessage);

// PATCH: Mark all messages as read for a specific patient
router.patch("/:patientId/read", markMessagesAsRead);

module.exports = router;
