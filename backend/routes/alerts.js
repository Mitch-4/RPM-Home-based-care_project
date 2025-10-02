// routes/alerts.js
const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

router.get('/:patientId', alertsController.getAlerts);

module.exports = router;
