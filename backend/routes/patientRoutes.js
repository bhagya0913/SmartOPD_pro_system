const express = require('express');
const { db } = require('../config/db');
const { calcEstimatedTime, sendBookingEmail } = require('../utils/helpers');
const router = express.Router();

// GET /api/opd-slots
router.get('/opd-slots', async (req, res) => { ... });

// POST /api/book-appointment
router.post('/book-appointment', async (req, res) => { ... }); // uses calcEstimatedTime, sendBookingEmail

// GET /api/my-appointments
router.get('/my-appointments', async (req, res) => { ... });

// DELETE /api/cancel-appointment/:id
router.delete('/cancel-appointment/:id', async (req, res) => { ... });

// GET /api/medical-records/:patientId
router.get('/medical-records/:patientId', async (req, res) => { ... });

// GET /api/prescriptions/:patientId
router.get('/prescriptions/:patientId', async (req, res) => { ... });

// GET /api/lab-results/:patientId
router.get('/lab-results/:patientId', async (req, res) => { ... }); // patient view

// GET /api/test-file/:testId
router.get('/test-file/:testId', async (req, res) => { ... }); // serves uploaded file

// GET /api/referrals/:patientId
router.get('/referrals/:patientId', async (req, res) => { ... });

// GET /api/notifications/:patientId
router.get('/notifications/:patientId', async (req, res) => { ... });

// POST /api/update-profile
router.post('/update-profile', async (req, res) => { ... });

// GET /api/feedback/:patientId
router.get('/feedback/:patientId', async (req, res) => { ... });

// POST /api/feedback (patient submits)
router.post('/feedback', async (req, res) => { ... });

// GET /api/family-members
router.get('/family-members', async (req, res) => { ... });

// POST /api/add-family-member
router.post('/add-family-member', async (req, res) => { ... }); // uses generateBarcode from helpers

// DELETE /api/remove-family-member
router.delete('/remove-family-member', async (req, res) => { ... });

module.exports = router;