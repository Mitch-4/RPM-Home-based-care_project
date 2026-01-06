// routes/alerts.js
const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');


router.get('/:patientId', alertsController.getAlerts);
router.post('/:patientId/mark-read', alertsController.markAlertsRead);

module.exports = router;
