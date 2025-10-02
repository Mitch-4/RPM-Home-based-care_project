const express = require('express');
const router = express.Router();
const vitalsController = require('../controllers/vitalsController');
const deviceAuth = require('../middlewares/deviceAuth');

// POST ingest by device: POST /api/v1/vitals/:patientId
router.post('/:patientId', deviceAuth, vitalsController.ingest);

// GET vitals for a patient: GET /api/v1/vitals/:patientId?limit=50
router.get('/:patientId', vitalsController.getVitals);

// GET latest vitals for a patient: GET /api/v1/vitals/:patientId/latest
router.get('/:patientId/latest', vitalsController.getLatestVitals);

// PUT update a specific vitals record: PUT /api/v1/vitals/:patientId/:time
router.put('/:patientId/:time', vitalsController.updateVitals);

// GET vitals for all patients: GET /api/v1/vitals/all
router.get('/all', vitalsController.getAllVitals);

module.exports = router;
