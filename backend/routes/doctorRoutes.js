const express = require('express');
const { db } = require('../config/db');
const router = express.Router();

// POST /api/staff/feedback (first definition — for legacy staff_feedback table)
// Purpose:  Allows a staff member to submit feedback to administration.
//           This version inserts into the staff_feedback table.
app.post('/api/staff/feedback', async (req, res) => {
    const { staff_id, comment } = req.body;
    if (!staff_id || !comment?.trim())
        return res.status(400).json({ success: false, message: 'staff_id and comment required.' });

    try {
        await db.query(
            `INSERT INTO staff_feedback (staff_id, comment, status, submitted_at)
             VALUES (?, ?, 'pending', NOW())`,
            [staff_id, comment.trim()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Staff feedback submit error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// DOCTOR ROUTES
// Purpose: Endpoints for the doctor's dashboard — patient lookup,
//          appointment queue, consultation recording, test orders,
//          and referrals.
// ============================================================

// GET /api/doctor/patient-lookup
// Purpose:  Searches for patient(s) by barcode (exact) or NIC (which
//           also returns linked family members). Used by the doctor
//           during walk-in or ad-hoc consultations.
// Query params:
//   mode — 'barcode' (exact match) | 'nic' (also fetches family)
//   q    — the search value
app.get('/api/doctor/patient-lookup', async (req, res) => {
    const { mode, q } = req.query;
    if (!mode || !q)
        return res.status(400).json({ success: false, message: 'mode and q required' });

    // Columns to select for each patient
    const cols = `patient_id, barcode, full_name, nic, dob, gender, blood_group,
                  phone, allergies, chronic_conditions, address_line1, address,
                  emergency_contact, civil_status, height_cm, weight_kg`;

    try {
        let rows = [];

        if (mode === 'barcode') {
            // Barcode is unique — return single exact match
            [rows] = await db.query(
                `SELECT ${cols} FROM patient WHERE barcode = ? AND is_active = 1 LIMIT 1`,
                [q.trim()]
            );
        } else {
            // NIC search — also fetches family members registered under this NIC's account
            const [patients] = await db.query(
                `SELECT ${cols} FROM patient WHERE nic = ? AND is_active = 1 ORDER BY patient_id ASC`,
                [q.trim()]
            );

            if (patients.length === 0) {
                rows = [];
            } else {
                const allPatients = [];
                for (const patient of patients) {
                    // Add the primary patient with relation label 'Self'
                    allPatients.push({ ...patient, relation: 'Self' });

                    // Fetch family members linked to this patient's account
                    const [members] = await db.query(`
                        SELECT p.patient_id, p.barcode, p.full_name, p.nic, p.dob, p.gender,
                               p.blood_group, p.phone, p.allergies, p.chronic_conditions,
                               p.address_line1, p.address, p.emergency_contact, p.civil_status,
                               p.height_cm, p.weight_kg,
                               pf.relation          -- e.g., "Spouse", "Child"
                        FROM patient_family pf
                        JOIN patient p ON pf.member_patient_id = p.patient_id
                        WHERE pf.primary_patient_id = ? AND p.is_active = 1
                        ORDER BY pf.relation, p.full_name
                    `, [patient.patient_id]);

                    allPatients.push(...members);
                }
                rows = allPatients;
            }
        }

        res.json({ success: true, patients: rows });
    } catch (err) {
        console.error('patient-lookup error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/doctor/today-queue
// Purpose:  Returns all appointments scheduled for today, including
//           basic patient details. Used for the doctor's main queue view
//           and the stat cards at the top of their dashboard.
app.get('/api/doctor/today-queue', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [rows] = await db.query(`
            SELECT
                a.appointment_id, a.patient_id, a.appointment_day,
                a.start_time, a.end_time, a.queue_no, a.visit_type,
                a.status, a.is_present,
                p.full_name   AS patient_name,
                p.barcode     AS patient_barcode,
                p.allergies, p.blood_group, p.dob, p.gender, p.nic, p.phone,
                p.chronic_conditions
            FROM appointments a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.appointment_day = ?
            ORDER BY a.queue_no ASC   -- Show in queue order
        `, [today]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/doctor/appointments-by-date
// Purpose:  Returns all appointments for a specific single date.
//           Useful when the doctor needs to review another day's schedule.
// Query params:
//   date — YYYY-MM-DD
app.get('/api/doctor/appointments-by-date', async (req, res) => {
    const { date } = req.query;
    if (!date)
        return res.status(400).json({ success: false, message: 'date required' });

    try {
        const [rows] = await db.query(`
            SELECT
                a.appointment_id, a.patient_id, a.appointment_day,
                a.start_time, a.end_time, a.queue_no, a.visit_type,
                a.status, a.is_present,
                p.full_name AS patient_name, p.barcode AS patient_barcode,
                p.allergies, p.blood_group, p.dob, p.gender, p.nic, p.phone,
                p.chronic_conditions
            FROM appointments a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.appointment_day = ?
            ORDER BY a.queue_no ASC
        `, [date]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/doctor/appointments-by-range
// Purpose:  Returns all appointments within a date range.
//           Used for the doctor's historical or scheduled view.
// Query params:
//   from — start date (YYYY-MM-DD)
//   to   — end date (YYYY-MM-DD)
app.get('/api/doctor/appointments-by-range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to)
        return res.status(400).json({ success: false, message: 'from and to are required' });

    try {
        const [rows] = await db.query(`
            SELECT
                a.appointment_id, a.patient_id, a.appointment_day,
                a.start_time, a.end_time, a.queue_no, a.visit_type,
                a.status, a.is_present,
                p.full_name AS patient_name, p.barcode AS patient_barcode,
                p.allergies, p.blood_group, p.dob, p.gender, p.nic, p.phone,
                p.chronic_conditions
            FROM appointments a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.appointment_day BETWEEN ? AND ?
            ORDER BY a.appointment_day ASC, a.queue_no ASC
        `, [from, to]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/doctor/patient-appointments/:patientId
// Purpose:  Returns a specific patient's own appointment history.
//           Used in the consultation dialog to select which appointment
//           a treatment record belongs to.
app.get('/api/doctor/patient-appointments/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                appointment_id, appointment_day, start_time, end_time,
                queue_no, visit_type, status,
                CONCAT(DATE_FORMAT(start_time,'%H:%i'),' – ',DATE_FORMAT(end_time,'%H:%i')) AS time_slot
            FROM appointments
            WHERE patient_id = ?
              AND status IN ('booked','active','completed')
            ORDER BY appointment_day DESC, start_time ASC
            LIMIT 30
        `, [req.params.patientId]);
        res.json({ success: true, appointments: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/doctor/patient-history/:patientId
// Purpose:  Returns a patient's full treatment history — all
//           consultation records with diagnoses, prescriptions,
//           and the treating doctor's name. Used for clinical context.
app.get('/api/doctor/patient-history/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                tr.record_id, tr.consultation_day,
                tr.chief_complaint, tr.clinical_findings, tr.diagnosis,
                tr.treatment_details, tr.prescription_details,
                tr.weight_kg, tr.height_cm, tr.follow_up_date,
                CONCAT(s.first_name,' ',s.surname) AS doctor_name
            FROM treatment_records tr
            LEFT JOIN staff s ON tr.created_by = s.staff_id
            WHERE tr.patient_id = ?
            ORDER BY tr.consultation_day DESC
        `, [req.params.patientId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/doctor/treatment-record
// Purpose:  Saves a consultation/treatment record written by a doctor.
//           Stores vitals, diagnosis, treatment plan, and prescription.
//           Also marks the corresponding appointment as 'completed'.
// Body params: appointment_id, patient_id, staff_id, weight_kg,
//              height_cm, chief_complaint, clinical_findings,
//              diagnosis (required), treatment_details, prescription_details
app.post('/api/doctor/treatment-record', async (req, res) => {
    const {
        appointment_id, patient_id, staff_id,
        weight_kg, height_cm, chief_complaint, clinical_findings,
        diagnosis, treatment_details, prescription_details
    } = req.body;

    if (!appointment_id || !patient_id || !staff_id || !diagnosis)
        return res.status(400).json({
            success: false,
            message: 'appointment_id, patient_id, staff_id and diagnosis are required.'
        });

    try {
        // Insert the treatment record
        const [result] = await db.query(`
            INSERT INTO treatment_records
                (appointment_id, patient_id, consultation_day,
                 weight_kg, height_cm, chief_complaint, clinical_findings,
                 diagnosis, treatment_details, prescription_details,
                 follow_up_date, created_by)
            VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        `, [
            appointment_id, patient_id,
            weight_kg         || null,
            height_cm         || null,
            chief_complaint   || null,
            clinical_findings || null,
            diagnosis,
            treatment_details    || null,
            prescription_details || null,
            staff_id
        ]);

        // Mark the appointment as completed with a timestamp
        await db.query(
            `UPDATE appointments SET status='completed', completed_at=NOW()
             WHERE appointment_id = ?`,
            [appointment_id]
        );

        res.json({ success: true, record_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/doctor/referral
// Purpose:  Issues a referral for a patient to another clinic or specialist.
//           Stores urgency level, target clinic, and clinical summary.
// Body params: appointment_id, patient_id, staff_id (all required),
//              target_clinic (required), reason (required),
//              consultant_name, urgency (optional, defaults to 'Routine')
app.post('/api/doctor/referral', async (req, res) => {
    const {
        appointment_id, patient_id, staff_id,
        target_clinic, consultant_name, urgency, reason, clinical_summary
    } = req.body;

    if (!appointment_id || !patient_id || !staff_id || !target_clinic || !reason)
        return res.status(400).json({
            success: false,
            message: 'appointment_id, patient_id, staff_id, target_clinic and reason are required.'
        });

    try {
        await db.query(`
            INSERT INTO referrals
                (appointment_id, patient_id, issued_by,
                target_clinic, consultant_name, urgency,
                referral_date, reason)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
            appointment_id, patient_id, staff_id,
            target_clinic,
            consultant_name || null,
            urgency         || 'Routine',  // Default urgency level
            reason
        ]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/doctor/order-tests
// Purpose:  Allows a doctor to order one or more lab/diagnostic tests
//           for a patient during or after a consultation.
//           Each test in the array is inserted as a separate row.
// Body params:
//   appointment_id, patient_id, staff_id — required context
//   tests — array of { test_type, test_name, clinical_notes }
app.post('/api/doctor/order-tests', async (req, res) => {
    const { appointment_id, patient_id, staff_id, tests } = req.body;
    if (!appointment_id || !patient_id || !staff_id || !Array.isArray(tests) || !tests.length)
        return res.status(400).json({ success: false, message: 'Missing required fields.' });

    try {
        // Insert each valid test as a separate DB row, executed in parallel
        const insertions = tests
            .filter(t => t.test_name?.trim())   // Skip blank test names
            .map(t => db.query(
                `INSERT INTO medical_tests
                    (appointment_id, patient_id, test_type, test_name, status, requested_by, clinical_notes, requested_at)
                VALUES (?, ?, ?, ?, 'requested', ?, ?, NOW())`,
                [
                    appointment_id, patient_id,
                    t.test_type      || 'Lab',
                    t.test_name.trim(),
                    staff_id,
                    t.clinical_notes?.trim() || null,
                ]
            ));

        await Promise.all(insertions); // Run all inserts concurrently
        res.json({ success: true });
    } catch (err) {
        console.error('order-tests error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/doctor/lab-findings
// Purpose:  Allows a doctor to add clinical notes to a specific test order
//           (before or after results are uploaded). Used to annotate
//           what the doctor was looking for.
// Body params:
//   test_id       — the test to annotate
//   patient_id    — used for security (ensures the test belongs to this patient)
//   clinical_notes — doctor's notes
app.post('/api/doctor/lab-findings', async (req, res) => {
    const { test_id, patient_id, clinical_notes } = req.body;
    const notes = clinical_notes || req.body.doctor_findings; // Accept both field names

    if (!test_id || !notes?.trim())
        return res.status(400).json({
            success: false,
            message: 'test_id and clinical notes are required.'
        });

    try {
        const [result] = await db.query(
            `UPDATE medical_tests
            SET clinical_notes = ?, updated_at = NOW()
            WHERE test_id = ? AND patient_id = ?`,
            [notes.trim(), test_id, patient_id]
        );

        if (!result.affectedRows)
            return res.json({ success: false, message: 'Test not found or patient mismatch.' });

        res.json({ success: true });
    } catch (err) {
        console.error('lab-findings error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/lab-results/:patientId
// Purpose:  Returns all lab test orders and their results for a
//           specific patient. Used by both the doctor (to review results)
//           and the patient dashboard (to see their own results).
//           Joins medical_tests → test_results and staff for doctor name.
app.get('/api/lab-results/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                mt.test_id, mt.appointment_id, mt.patient_id,
                mt.test_type, mt.test_name, mt.status,
                mt.requested_by, mt.requested_at, mt.sample_collected_at,
                mt.clinical_notes,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                tr.result_id, tr.summary AS result_summary,
                tr.file_path, tr.uploaded_at AS result_uploaded_at
            FROM medical_tests mt
            LEFT JOIN staff s      ON mt.requested_by = s.staff_id
            LEFT JOIN test_results tr ON tr.test_id   = mt.test_id
            WHERE mt.patient_id = ?
            ORDER BY mt.test_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, tests: rows });
    } catch (err) {
        console.error('lab-results error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/doctor/update-profile
// Purpose:  Allows a doctor (or any staff) to update their own
//           profile details: first name, surname, and phone.
app.post('/api/doctor/update-profile', async (req, res) => {
    const { staff_id, first_name, surname, phone } = req.body;
    if (!staff_id)
        return res.status(400).json({ success: false, message: 'staff_id required.' });

    try {
        await db.query(
            'UPDATE staff SET first_name=?, surname=?, phone=? WHERE staff_id=?',
            [first_name, surname, phone || null, staff_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/doctor/change-password
// Purpose:  Allows a staff member to change their own login password.
//           Verifies the current password with bcrypt before updating.
// Body params:
//   staff_id — identifies which user_account to update
//   current  — the existing password (must match)
//   next     — the new desired password
app.post('/api/doctor/change-password', async (req, res) => {
    const { staff_id, current, next } = req.body;
    if (!staff_id || !current || !next)
        return res.status(400).json({ success: false, message: 'All fields required.' });

    try {
        // Retrieve the current password hash for this staff member
        const [[account]] = await db.query(
            'SELECT password_hash FROM user_account WHERE staff_id=? LIMIT 1',
            [staff_id]
        );
        if (!account)
            return res.json({ success: false, message: 'Account not found.' });

        // Verify the user knows their current password
        const ok = await bcrypt.compare(current, account.password_hash);
        if (!ok)
            return res.json({ success: false, message: 'Current password is incorrect.' });

        // Hash and store the new password
        const hash = await bcrypt.hash(next, 10);
        await db.query(
            'UPDATE user_account SET password_hash=? WHERE staff_id=?', [hash, staff_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/staff/notifications/:staffId
// Purpose:  Returns recent notifications sent to a specific staff member.
//           Filters to only sent/delivered/opened notifications.
app.get('/api/staff/notifications/:staffId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT notification_id, email_subject, message, status, sent_at
            FROM notifications
            WHERE recipient_type='staff' AND staff_id=?
              AND status IN ('sent','delivered','opened')
            ORDER BY sent_at DESC LIMIT 50
        `, [req.params.staffId]);
        res.json({ success: true, notifications: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/staff/feedback/:staffId
// Purpose:  Returns feedback submitted via the patient feedback table
//           that is associated with a staff member's user_account.
//           (This is a different feedback table than staff_feedback.)
app.get('/api/staff/feedback/:staffId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT feedback_id, comments AS comment, date_submitted, status
            FROM feedback
            WHERE user_id = (
                SELECT user_id FROM user_account WHERE staff_id=? LIMIT 1
            )
            ORDER BY date_submitted DESC LIMIT 50
        `, [req.params.staffId]);
        res.json({ success: true, feedback: rows });
    } catch (err) {
        // Fail gracefully if the table does not exist in this deployment
        res.json({ success: true, feedback: [] });
    }
});

// POST /api/staff/feedback (second definition)
// Purpose:  Allows a staff member to submit feedback via the main
//           feedback table (linked to user_account, not staff_feedback).
//           Looks up the user_id for the given staff_id before inserting.
app.post('/api/staff/feedback', async (req, res) => {
    const { staff_id, comment } = req.body;
    if (!staff_id || !comment?.trim())
        return res.status(400).json({ success: false, message: 'staff_id and comment required.' });

    try {
        // Resolve user_id from staff_id (feedback table uses user_id, not staff_id)
        const [[ua]] = await db.query(
            'SELECT user_id FROM user_account WHERE staff_id=? LIMIT 1', [staff_id]
        );
        if (!ua)
            return res.json({ success: false, message: 'User account not found.' });

        await db.query(
            `INSERT INTO feedback (user_id, comments, date_submitted, status)
             VALUES (?, ?, NOW(), 'new')`,
            [ua.user_id, comment.trim()]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;