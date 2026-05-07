const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/db');
const transporter = require('../config/email');
const { generateBarcode } = require('../utils/helpers');
const router = express.Router();

router.get('/api/receptionist/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        // Total bookings today (excluding cancelled)
        const [[{ totalToday }]] = await db.query(
            `SELECT COUNT(*) AS totalToday FROM appointments
             WHERE appointment_day = ? AND status NOT IN ('cancelled')`,
            [today]
        );

        // Patients who have physically arrived (is_present = 1)
        const [[{ arrived }]] = await db.query(
            `SELECT COUNT(*) AS arrived FROM appointments
             WHERE appointment_day = ? AND is_present = 1`,
            [today]
        );

        // Still pending: booked but not yet marked as arrived
        const [[{ pending }]] = await db.query(
            `SELECT COUNT(*) AS pending FROM appointments
             WHERE appointment_day = ? AND status = 'booked' AND is_present = 0`,
            [today]
        );

        // Consultations completed today
        const [[{ completed }]] = await db.query(
            `SELECT COUNT(*) AS completed FROM appointments
             WHERE appointment_day = ? AND status = 'completed'`,
            [today]
        );

        res.json({ success: true, stats: { totalToday, arrived, pending, completed } });
    } catch (err) {
        console.error('Receptionist stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/receptionist/queue', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [rows] = await db.query(`
            SELECT
                a.appointment_id, a.queue_no, a.visit_type, a.status, a.is_present,
                a.start_time, a.end_time, a.appointment_day,
                p.patient_id, p.full_name, p.nic, p.barcode,
                p.phone, p.blood_group, p.dob
            FROM appointments a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.appointment_day = ?
              AND a.status NOT IN ('cancelled', 'no_show')
            ORDER BY a.queue_no ASC
        `, [today]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        console.error('Reception queue error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/receptionist/verify-arrival', async (req, res) => {
    const { term } = req.query;
    if (!term)
        return res.status(400).json({ success: false, message: 'Search term required.' });

    const today = new Date().toISOString().split('T')[0];

    try {
        // Find patient by barcode or NIC (must be active)
        const [patients] = await db.query(`
            SELECT patient_id, full_name, nic, barcode, dob, gender,
                   phone, blood_group, allergies, address_line1, address, is_active
            FROM patient
            WHERE (barcode = ? OR nic = ?) AND is_active = 1
            LIMIT 5
        `, [term, term]);

        if (!patients.length)
            return res.json({
                success: false,
                message: 'No patient found with that barcode or NIC.'
            });

        const patient = patients[0];

        // Load appointments from last 6 months so receptionist can also see recent history
        const [appointments] = await db.query(`
            SELECT
                a.appointment_id, a.appointment_day, a.start_time, a.end_time,
                a.queue_no, a.visit_type, a.status, a.is_present,
                (a.appointment_day = ?) AS is_today   -- Flag if appointment is today
            FROM appointments a
            WHERE a.patient_id = ?
              AND a.appointment_day >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            ORDER BY a.appointment_day DESC, a.start_time ASC
            LIMIT 20
        `, [today, patient.patient_id]);

        res.json({ success: true, patient, appointments });

    } catch (err) {
        console.error('Verify arrival error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.post('/api/receptionist/mark-arrived', async (req, res) => {
    const { appointment_id } = req.body;
    if (!appointment_id)
        return res.status(400).json({ success: false, message: 'appointment_id required.' });

    try {
        const [result] = await db.query(
            `UPDATE appointments SET is_present = 1 WHERE appointment_id = ? AND status = 'booked'`,
            [appointment_id]
        );
        if (!result.affectedRows)
            return res.json({
                success: false,
                message: 'Appointment not found or already processed.'
            });

        res.json({ success: true, message: 'Patient marked as arrived.' });
    } catch (err) {
        console.error('Mark arrived error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.post('/api/receptionist/register-patient', async (req, res) => {
    const {
        full_name, nic, dob, gender, phone, email, address,
        blood_group, allergies, chronic_conditions,
        emergency_contact, civil_status,
        password = 'SmartOPD@123',   // Default password for walk-in registrations
        registered_by
    } = req.body;

    if (!full_name || !nic || !dob || !gender)
        return res.status(400).json({ success: false, message: 'Full name, NIC, DOB and gender are required.' });

    if (!/^([0-9]{9}[xXvV]|[0-9]{12})$/.test(nic))
        return res.status(400).json({ success: false, message: 'Invalid NIC format.' });

    // Normalize phone number to international format
    const normalizedPhone = phone?.trim()
        ? (phone.startsWith('0') ? '+94' + phone.slice(1) : phone.trim())
        : null;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Reject if NIC already registered
        const [existNic] = await conn.query(
            'SELECT patient_id FROM patient WHERE nic = ?', [nic]
        );
        if (existNic.length)
            return res.status(400).json({
                success: false,
                message: 'A patient with this NIC is already registered.'
            });

        // Reject if email already in use
        if (email && email.trim()) {
            const [existEmail] = await conn.query(
                'SELECT patient_id FROM patient WHERE email = ?', [email.trim()]
            );
            if (existEmail.length)
                return res.status(400).json({
                    success: false,
                    message: 'This email is already registered.'
                });
        }

        const barcodeValue   = `OPD-${Date.now()}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new patient record
        const [patientResult] = await conn.query(`
            INSERT INTO patient
            (full_name, nic, dob, gender, phone, email, address, address_line1,
             blood_group, allergies, chronic_conditions, emergency_contact,
             civil_status, barcode, is_active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
        `, [
            full_name, nic, dob, gender,
            normalizedPhone  || null,
            email?.trim()    || null,
            address || null, address || null,
            blood_group         || null,
            allergies           || null,
            chronic_conditions  || null,
            emergency_contact   || null,
            civil_status        || null,
            barcodeValue
        ]);
        const newPatientId = patientResult.insertId;

        // Determine the login username: prefer email, then phone, then fall back to NIC
        let username = email?.trim() || normalizedPhone;
        if (!username) {
            username = nic; // NIC as last resort username

            // Check that this NIC-based username isn't already taken (very unlikely)
            const [existing] = await conn.query(
                'SELECT user_id FROM user_account WHERE username = ?', [username]
            );
            if (existing.length) {
                username = `${username}_${Date.now()}`; // Ensure uniqueness
            }
        }

        if (username) {
            await conn.query(
                `INSERT INTO user_account (username, password_hash, patient_id, staff_id)
                 VALUES (?,?,?,NULL)`,
                [username, hashedPassword, newPatientId]
            );
        }

        await conn.commit();

        // Send welcome email in the background (non-fatal)
        if (email && email.trim()) {
            transporter.sendMail({
                from:    'bhagya0913@gmail.com',
                to:      email.trim(),
                subject: 'Welcome to SmartOPD – Registration Successful',
                html: `
                <div style="font-family:Arial;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
                    <h2 style="color:#0d9488">Registration Successful!</h2>
                    <p>Hello <strong>${full_name}</strong>,</p>
                    <p>You have been registered at <strong>Base Hospital, Kiribathgoda OPD</strong>.</p>
                    <div style="background:#f0fdfa;border-radius:8px;padding:16px;margin:16px 0">
                        <p style="margin:0;font-size:0.875rem;color:#374151">Your Patient Barcode:</p>
                        <p style="margin:4px 0 0;font-size:1.5rem;font-weight:bold;letter-spacing:4px;color:#0f766e">${barcodeValue}</p>
                    </div>
                    ${username ? `<div style="background:#f8fafc;border-radius:8px;padding:14px;margin-top:12px">
                        <p style="margin:0;font-size:0.8rem;color:#374151"><strong>Your login credentials:</strong></p>
                        <p style="margin:4px 0 0;font-size:0.85rem">Username: <code>${username}</code></p>
                        <p style="margin:2px 0 0;font-size:0.85rem">Password: <code>${password}</code></p>
                        <p style="margin:6px 0 0;font-size:0.75rem;color:#6b7280">Please change your password after first login.</p>
                    </div>` : ''}
                    <p style="color:#6b7280;font-size:0.875rem;margin-top:14px">Save your barcode — you will need it at the hospital.</p>
                </div>`
            }).catch(err => console.warn('Welcome email failed:', err.message));
        }

        res.status(201).json({
            success: true,
            patientId: newPatientId,
            qrCode: barcodeValue,
            message: 'Registered successfully!'
        });

    } catch (err) {
        await conn.rollback();
        console.error('Register patient error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});


router.get('/api/receptionist/appointments', async (req, res) => {
    const { date, from, to, status } = req.query;

    try {
        let sql = `
            SELECT
                a.appointment_id, a.queue_no, a.visit_type, a.status, a.is_present,
                a.start_time, a.end_time, a.appointment_day,
                p.patient_id, p.full_name, p.nic, p.barcode, p.phone
            FROM appointments a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            sql += ` AND a.appointment_day = ?`;
            params.push(date);
        } else if (from && to) {
            sql += ` AND a.appointment_day BETWEEN ? AND ?`;
            params.push(from, to);
        }
        // If neither: return all (history browsing mode)

        if (status && status !== 'all') {
            sql += ` AND a.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY a.appointment_day DESC, a.queue_no ASC`;

        // Safety limit when no date filter is applied (prevent loading entire history)
        if (!date && !from) sql += ` LIMIT 500`;

        const [rows] = await db.query(sql, params);
        res.json({ success: true, appointments: rows });
    } catch (err) {
        console.error('Appointments error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;