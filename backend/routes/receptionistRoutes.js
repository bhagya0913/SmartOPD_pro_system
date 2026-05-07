const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/db');
const transporter = require('../config/email');
const { generateBarcode } = require('../utils/helpers');
const router = express.Router();

// GET /api/receptionist/stats
router.get('/stats', async (req, res) => { ... });

// GET /api/receptionist/queue
router.get('/queue', async (req, res) => { ... });

// GET /api/receptionist/verify-arrival
router.get('/verify-arrival', async (req, res) => { ... });

// POST /api/receptionist/mark-arrived
router.post('/mark-arrived', async (req, res) => { ... });

// POST /api/receptionist/register-patient
router.post('/register-patient', async (req, res) => { ... }); // uses generateBarcode, bcrypt, email

// GET /api/receptionist/appointments
router.get('/appointments', async (req, res) => { ... });

module.exports = router;