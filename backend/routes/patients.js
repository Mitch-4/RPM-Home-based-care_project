const express = require('express');
const router = express.Router();
const patientsController = require('../controllers/patientsController');

// Fetch all patients
router.get('/', patientsController.list);

// Fetch single patient profile
router.get('/:patientId', patientsController.get);

// Fetch all vitals for a patient
router.get('/:patientId/vitals', patientsController.getVitals);

// Fetch latest vitals for a patient
router.get('/:patientId/latest', patientsController.getLatestVitals);

// Update a specific vitals entry
router.put('/:patientId/vitals/:time', patientsController.updateVitals);

module.exports = router;
