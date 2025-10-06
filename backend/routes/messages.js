const express = require("express");
const { getMessages, createMessage } = require("../controllers/messagesController");
const router = express.Router();

// GET messages for a specific patient
router.get("/:patientId", getMessages);  //  CHANGE THIS

// POST a new message
router.post("/", createMessage);

module.exports = router;