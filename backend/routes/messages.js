const express = require("express");
const { getMessages, createMessage } = require("../controllers/messagesController");

const router = express.Router();

// GET all messages
router.get("/", getMessages);

// POST a new message
router.post("/", createMessage);

module.exports = router;
