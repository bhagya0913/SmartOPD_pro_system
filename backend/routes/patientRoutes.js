const express = require('express');
const { db } = require('../config/db');
const { calcEstimatedTime, sendBookingEmail } = require('../utils/helpers');
const router = express.Router();

// ============================================================
// PATIENT DASHBOARD ROUTES
// Purpose: Endpoints for the patient-facing dashboard.
//          Covers appointment booking, medical records, prescriptions,
//          lab results, referrals, profile updates, and feedback.
// ============================================================

// HELPER: generateBarcode
// Purpose:  Generates a short unique barcode string using the current
//           timestamp in base-36 and a random suffix. Used for family
//           members who don't go through the main OTP registration flow.
function generateBarcode() {
    const ts  = Date.now().toString(36).toUpperCase();           // Timestamp in base-36
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 random chars
    return `BHK-${ts}-${rnd}`;
}

// HELPER: calcEstimatedTime
// Purpose:  Calculates the estimated consultation time window for a
//           given token number based on OPD settings stored in the DB
//           (start hour and slot duration in minutes).
// Returns:  A string like "08:00 AM – 08:10 AM", or null on error.
async function calcEstimatedTime(tokenNo) {
    try {
        const [rows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','slot_duration_minutes')`
        );
        const cfg = {};
        rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

        const startHour   = parseInt(cfg.opd_start_hour)        || 8;   // Default 8 AM
        const slotMinutes = parseInt(cfg.slot_duration_minutes) || 10;  // Default 10 min slots

        // Convert token position to minutes from midnight
        const startTotal = startHour * 60 + (tokenNo - 1) * slotMinutes;
        const endTotal   = startTotal + slotMinutes;

        // Format minutes-from-midnight to "HH:MM AM/PM"
        const fmt = (mins) => {
            const h = Math.floor(mins / 60), m = mins % 60;
            const hr = h % 12 || 12, ampm = h < 12 ? 'AM' : 'PM';
            return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
        };

        return `${fmt(startTotal)} – ${fmt(endTotal)}`;
    } catch {
        return null;
    }
}

// GET /api/opd-slots
// Purpose:  Returns the available appointment capacity for a given date.
//           Checks if the date is closed (holiday), counts existing bookings,
//           and returns remaining slots. Used by the booking calendar UI.
// Query params:
//   date — YYYY-MM-DD
app.get('/api/opd-slots', async (req, res) => {
    const { date } = req.query;
    if (!date)
        return res.status(400).json({ success: false, message: 'date required' });

    try {
        // Load OPD configuration from system_settings
        const [settingRows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','opd_end_hour','slot_capacity','closed_dates','slot_duration_minutes')`
        );
        const cfg = {};
        settingRows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

        // Check if this date is in the closed_dates list (comma-separated YYYY-MM-DD)
        const closedDates = (cfg.closed_dates || '').split(',').map(s => s.trim()).filter(Boolean);
        if (closedDates.includes(date))
            return res.json({ success: true, slots: [], closed: true });

        // Count existing active bookings for this date
        const [[{ booked }]] = await db.query(
            `SELECT COUNT(*) AS booked FROM appointments
             WHERE appointment_day=? AND status NOT IN ('cancelled','no_show')`,
            [date]
        );

        const MAX_PER_DAY = 60;                                   // Hard daily cap
        const remaining   = Math.max(0, MAX_PER_DAY - parseInt(booked));

        res.json({
            success:  true,
            closed:   false,
            booked:   parseInt(booked),
            remaining,
            capacity: MAX_PER_DAY,
            slots: [{
                time_slot:  'All Day (FCFS)',
                capacity:   MAX_PER_DAY,
                booked:     parseInt(booked),
                remaining
            }]
        });
    } catch (err) {
        console.error('OPD slots error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/book-appointment
// Purpose:  Books an OPD appointment for a patient.
//           Enforces business rules:
//             1. Date must not be closed
//             2. Daily cap of 60 must not be exceeded
//             3. Patient must not already have a booking on that day
//             4. Assigns the next FCFS queue token
//             5. Calculates start/end time based on token position
//             6. Sends an appointment confirmation email (non-blocking)
// Body params:
//   patientId — patient's DB ID
//   date      — YYYY-MM-DD
//   visitType — 'New' (default) | 'Follow-up'
app.post('/api/book-appointment', async (req, res) => {
    const { patientId, date, visitType = 'New' } = req.body;
    if (!patientId || !date)
        return res.status(400).json({ success: false, message: 'patientId and date are required.' });

    try {
        // Rule 1: Check if the date is administratively closed
        const [settingRows] = await db.query(
            `SELECT setting_value FROM system_settings WHERE setting_key='closed_dates'`
        );
        const closedDates = (settingRows[0]?.setting_value || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        if (closedDates.includes(date))
            return res.json({ success: false, message: 'OPD is closed on this date.' });

        // Rule 2: Enforce daily cap
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM appointments
             WHERE appointment_day=? AND status NOT IN ('cancelled','no_show')`,
            [date]
        );
        const MAX_PER_DAY = 60;
        if (parseInt(total) >= MAX_PER_DAY)
            return res.json({
                success: false,
                message: `This date is fully booked (${MAX_PER_DAY}/day limit). Please choose another date.`
            });

        // Rule 3: No duplicate booking for same patient on same day
        const [dupes] = await db.query(
            `SELECT appointment_id FROM appointments
             WHERE patient_id=? AND appointment_day=? AND status NOT IN ('cancelled','no_show') LIMIT 1`,
            [patientId, date]
        );
        if (dupes.length)
            return res.json({ success: false, message: 'You already have an appointment on this date.' });

        // Rule 4: Assign FCFS token (next available number)
        const tokenNo = parseInt(total) + 1;

        // Rule 5: Calculate time slot based on token position
        const [cfgRows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','slot_duration_minutes')`
        );
        const cfg = {};
        cfgRows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
        const startHour   = parseInt(cfg.opd_start_hour)        || 8;
        const slotMinutes = parseInt(cfg.slot_duration_minutes) || 10;

        const startTotalMin = startHour * 60 + (tokenNo - 1) * slotMinutes;
        const endTotalMin   = startTotalMin + slotMinutes;

        // Convert minutes-from-midnight to "HH:MM:SS" format for TIME column
        const toTimeStr = (mins) =>
            `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}:00`;

        const startTime = toTimeStr(startTotalMin);
        const endTime   = toTimeStr(endTotalMin);

        // Insert the appointment record
        const [result] = await db.query(
            `INSERT INTO appointments
                (patient_id, appointment_day, start_time, end_time, queue_no, visit_type, status, is_present, created_at)
             VALUES (?,?,?,?,?,?,'booked',0,NOW())`,
            [patientId, date, startTime, endTime, tokenNo, visitType]
        );
        const appointmentId = result.insertId;

        // Human-readable estimated time string for the response
        const estimatedTime = await calcEstimatedTime(tokenNo);

        // Send email confirmation in the background (non-blocking — won't delay the response)
        sendBookingEmail(patientId, appointmentId, date, tokenNo, estimatedTime, visitType)
            .catch(console.error);

        res.json({ success: true, tokenNo, appointmentId, estimatedTime });

    } catch (err) {
        console.error('Book appointment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// HELPER: sendBookingEmail
// Purpose:  Fetches patient details, generates the OPD slip HTML,
//           and sends the confirmation email with the barcode.
//           Also logs the notification to the notifications table.
//           Called asynchronously after booking — failures are logged
//           but do not affect the booking response.
async function sendBookingEmail(patientId, appointmentId, date, tokenNo, estimatedTime, visitType) {
    try {
        // Load patient contact info and barcode
        const [pRows] = await db.query(
            `SELECT full_name, email, barcode, nic, patient_id FROM patient WHERE patient_id=? LIMIT 1`,
            [patientId]
        );
        if (!pRows.length || !pRows[0].email) return; // Skip if no email on file

        const patient = pRows[0];

        // Generate barcode image for the email
        let barcodeImage = '';
        try {
            barcodeImage = await generateBarcodeDataURL(patient.barcode);
        } catch (bErr) {
            console.warn('Barcode image generation failed:', bErr.message);
        }

        // Build the appointment object expected by buildOpdSlipEmail
        const appointment = {
            queue_no:        tokenNo,
            appointment_day: date,
            time_slot:       estimatedTime,
            visit_type:      visitType,
        };

        const emailHtml = buildOpdSlipEmail(appointment, patient, barcodeImage);

        await transporter.sendMail({
            from:    'bhagya0913@gmail.com',
            to:      patient.email,
            subject: `SmartOPD OPD Slip — Token #${tokenNo} · ${date}`,
            html:    emailHtml
        });

        // Log the notification to the DB (silently ignore if table doesn't exist)
        await db.query(
            `INSERT INTO notifications (patient_id, recipient_type, email_subject, message, status, sent_at)
             VALUES (?, 'patient', ?, ?, 'sent', NOW())`,
            [
                patientId,
                `OPD Appointment Confirmed — Token #${tokenNo}`,
                `Your appointment on ${date} is confirmed. Token: #${tokenNo}. Estimated time: ${estimatedTime || 'TBD'}.`
            ]
        ).catch(() => {});

    } catch (err) {
        console.error('Booking email error:', err);
    }
}

// GET /api/my-appointments
// Purpose:  Returns all non-cancelled appointments for a patient.
//           Used on the patient dashboard's "My Appointments" tab.
// Query params:
//   patientId — the patient's DB ID
app.get('/api/my-appointments', async (req, res) => {
    const { patientId } = req.query;
    if (!patientId)
        return res.status(400).json({ success: false, message: 'patientId required' });

    try {
        const [rows] = await db.query(`
            SELECT appointment_id, patient_id, doctor_id, appointment_day,
                   start_time, end_time, queue_no, visit_type, status, is_present,
                   created_at, completed_at,
                   -- Build a formatted time slot string for display
                   CONCAT(DATE_FORMAT(start_time,'%h:%i'),' ',
                          IF(HOUR(start_time)<12,'AM','PM'),
                          ' – ',
                          DATE_FORMAT(end_time,'%h:%i'),' ',
                          IF(HOUR(end_time)<12,'AM','PM')) AS time_slot
            FROM appointments
            WHERE patient_id=? AND status != 'cancelled'
            ORDER BY appointment_day DESC, start_time ASC
        `, [patientId]);
        res.json({ success: true, appointments: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/cancel-appointment/:id
// Purpose:  Cancels a patient's booked appointment.
//           Only works for appointments still in 'booked' status —
//           completed or already cancelled appointments are rejected.
app.delete('/api/cancel-appointment/:id', async (req, res) => {
    try {
        const [result] = await db.query(
            `UPDATE appointments SET status='cancelled' WHERE appointment_id=? AND status='booked'`,
            [req.params.id]
        );
        if (!result.affectedRows)
            return res.json({ success: false, message: 'Appointment not found or already processed.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/medical-records/:patientId
// Purpose:  Returns all treatment/consultation records for a patient.
//           Includes diagnosis, prescription, vitals, and the doctor's name.
//           Used on the patient's "Medical Records" tab.
app.get('/api/medical-records/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                tr.record_id, tr.appointment_id, tr.patient_id,
                tr.consultation_day, tr.weight_kg, tr.height_cm,
                tr.chief_complaint, tr.clinical_findings, tr.diagnosis,
                tr.treatment_details, tr.prescription_details,
                tr.follow_up_date, tr.created_by,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name
            FROM treatment_records tr
            LEFT JOIN staff s ON tr.created_by = s.staff_id
            WHERE tr.patient_id = ?
            ORDER BY tr.consultation_day DESC, tr.record_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, records: rows });
    } catch (err) {
        console.error('medical-records error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/prescriptions/:patientId
// Purpose:  Returns all prescriptions for a patient, including
//           fulfillment status (dispensed or pending).
//           Used on the patient's "Prescriptions" tab.
app.get('/api/prescriptions/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                tr.record_id, tr.appointment_id,
                tr.consultation_day, tr.prescription_details,
                pf.fulfillment_id, pf.fulfilled_at,
                pf.notes AS fulfillment_notes,
                CONCAT(s.first_name, ' ', s.surname) AS pharmacist_name
            FROM treatment_records tr
            LEFT JOIN prescription_fulfillment pf ON pf.prescription_id = tr.record_id
            LEFT JOIN staff s ON pf.pharmacist_id = s.staff_id
            WHERE tr.patient_id = ?
              AND tr.prescription_details IS NOT NULL
              AND TRIM(tr.prescription_details) != ''  -- Exclude blank prescription fields
            ORDER BY tr.consultation_day DESC, tr.record_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, prescriptions: rows });
    } catch (err) {
        console.error('prescriptions error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/lab-results/:patientId  (second definition — for patient dashboard)
// Purpose:  Returns a patient's lab test orders with results.
//           Note: This is a duplicate route path with the doctor route above.
//           In Express, this second definition will override the first.
app.get('/api/lab-results/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                mt.test_id, mt.appointment_id, mt.patient_id,
                mt.test_type, mt.test_name, mt.status,
                mt.requested_by, mt.requested_at, mt.sample_collected_at,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                tr.result_id, tr.summary AS result_summary,
                tr.file_path, tr.uploaded_at
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

// GET /api/test-file/:testId
// Purpose:  Serves the uploaded file (e.g., PDF report) attached to a
//           lab test result. Streams the file as a download.
app.get('/api/test-file/:testId', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT file_path FROM test_results WHERE test_id=? LIMIT 1`,
            [req.params.testId]
        );
        if (!rows.length)
            return res.status(404).json({ message: 'File not found.' });

        const filePath = rows[0].file_path;

        // Verify the file actually exists on disk before attempting to download
        if (!fs.existsSync(filePath))
            return res.status(404).json({ message: 'File missing on server.' });

        res.download(filePath, path.basename(filePath)); // Trigger browser file download
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/referrals/:patientId
// Purpose:  Returns all referrals issued for a patient, including
//           the issuing doctor's name and target clinic/urgency.
app.get('/api/referrals/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                r.referral_id, r.appointment_id, r.patient_id,
                r.issued_by, r.referred_to_id, r.consultant_name,
                r.target_clinic, r.urgency, r.referral_date, r.reason,
                CONCAT(s.first_name, ' ', s.surname) AS issued_by_name
            FROM referrals r
            LEFT JOIN staff s ON r.issued_by = s.staff_id
            WHERE r.patient_id = ?
            ORDER BY r.referral_date DESC, r.referral_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, referrals: rows });
    } catch (err) {
        console.error('referrals error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/notifications/:patientId
// Purpose:  Returns notification history for a patient (e.g., booking
//           confirmations). Fails silently if the table doesn't exist yet.
app.get('/api/notifications/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT notification_id, email_subject, message, status, sent_at
            FROM notifications
            WHERE patient_id = ?
              AND recipient_type = 'patient'
              AND status IN ('sent','delivered','opened')
            ORDER BY sent_at DESC
        `, [req.params.patientId]);
        res.json({ success: true, notifications: rows });
    } catch (err) {
        // Graceful degradation — return empty array if table doesn't exist
        console.warn('notifications fetch error (table may not exist yet):', err.message);
        res.json({ success: true, notifications: [] });
    }
});

// POST /api/update-profile
// Purpose:  Allows a patient to update their profile information:
//           demographics, contact details, medical background (allergies,
//           conditions), and emergency contact.
//           Keeps address_line1 and address columns in sync.
app.post('/api/update-profile', async (req, res) => {
    const {
        patientId, full_name, nic, dob, gender, civil_status, blood_group,
        phone, address_line1, address, emergency_contact,
        chronic_conditions, allergies, height_cm, weight_kg
    } = req.body;

    if (!patientId)
        return res.status(400).json({ success: false, message: 'patientId required' });

    try {
        // Use address_line1 if provided, fall back to address (both kept in sync)
        const addr = address_line1 || address || null;

        const [result] = await db.query(`
            UPDATE patient
            SET full_name=?, nic=?, dob=?, gender=?, civil_status=?, blood_group=?,
                phone=?, address_line1=?, address=?,
                emergency_contact=?, chronic_conditions=?, allergies=?,
                height_cm=?, weight_kg=?
            WHERE patient_id=?
        `, [
            full_name || null, nic || null, dob || null, gender || null,
            civil_status || null, blood_group || null, phone || null,
            addr, addr,
            emergency_contact || null, chronic_conditions || null, allergies || null,
            height_cm || null, weight_kg || null,
            patientId
        ]);

        if (!result.affectedRows)
            return res.json({ success: false, message: 'Patient not found.' });

        res.json({ success: true });
    } catch (err) {
        console.error('update-profile error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/feedback/:patientId
// Purpose:  Returns a patient's own feedback submission history.
//           Fails silently if the feedback table doesn't exist.
app.get('/api/feedback/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT feedback_id, rating, comment, submitted_at, created_at
            FROM feedback
            WHERE patient_id = ?
            ORDER BY COALESCE(submitted_at, created_at) DESC
        `, [req.params.patientId]);
        res.json({ success: true, feedback: rows });
    } catch (err) {
        console.warn('feedback fetch error:', err.message);
        res.json({ success: true, feedback: [] });
    }
});

// POST /api/feedback
// Purpose:  Submits a new feedback entry from a patient.
//           Rating is optional; comment is required.
// Body params:
//   patientId — required
//   rating    — optional integer (1–5)
//   comment   — required non-empty string
app.post('/api/feedback', async (req, res) => {
    const { patientId, rating, comment } = req.body;

    if (!patientId)
        return res.status(400).json({ success: false, message: 'patientId required.' });
    if (!comment || !comment.trim())
        return res.status(400).json({ success: false, message: 'Comment is required.' });

    try {
        await db.query(
            `INSERT INTO feedback (patient_id, rating, comment, submitted_at)
             VALUES (?, ?, ?, NOW())`,
            [patientId, rating || null, comment.trim()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('feedback post error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/family-members
// Purpose:  Returns all patients linked to an account (the primary
//           patient + their family members). Used on the patient
//           dashboard's family management section.
// Query params:
//   email — the logged-in user's email/username
app.get('/api/family-members', async (req, res) => {
    const { email } = req.query;
    if (!email)
        return res.status(400).json({ success: false, message: 'email required' });

    try {
        // Find the primary patient linked to this account
        const [uRows] = await db.query(
            `SELECT patient_id FROM user_account
             WHERE username=? AND patient_id IS NOT NULL LIMIT 1`,
            [email]
        );
        if (!uRows.length)
            return res.json({ success: true, members: [] });

        const primaryId = uRows[0].patient_id;

        const cols = `patient_id, barcode, full_name, nic, dob, gender, civil_status,
                      blood_group, phone, address_line1, address, emergency_contact,
                      chronic_conditions, allergies, email, is_active`;

        // Load the primary patient's own record
        const [primaryRows] = await db.query(
            `SELECT ${cols} FROM patient WHERE patient_id=? AND is_active=1`, [primaryId]
        );

        // Load all family members linked to the primary patient
        const [familyRows] = await db.query(
            `SELECT p.patient_id, p.barcode, p.full_name, p.nic, p.dob, p.gender,
                    p.civil_status, p.blood_group, p.phone, p.address_line1, p.address,
                    p.emergency_contact, p.chronic_conditions, p.allergies, p.email,
                    p.is_active, pf.relation
             FROM patient_family pf
             JOIN patient p ON pf.member_patient_id = p.patient_id
             WHERE pf.primary_patient_id=? AND p.is_active=1
             ORDER BY pf.id ASC`,
            [primaryId]
        );

        // Return primary first, then family members
        res.json({ success: true, members: [...primaryRows, ...familyRows] });
    } catch (err) {
        console.error('family-members error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/add-family-member
// Purpose:  Registers a new patient as a family member linked to
//           the logged-in patient's account.
//           Creates a new patient record with a generated barcode
//           and inserts a patient_family link.
//           Uses a transaction to keep patient and link creation atomic.
// Body params:
//   email     — account holder's email (identifies the primary patient)
//   full_name, dob, gender — required
//   relation  — e.g., "Spouse", "Child"
//   nic, phone — optional
app.post('/api/add-family-member', async (req, res) => {
    const { email, full_name, dob, gender, relation, nic, phone } = req.body;
    if (!email || !full_name || !dob || !gender)
        return res.status(400).json({
            success: false,
            message: 'Full name, DOB and gender are required.'
        });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Look up the primary patient for this account
        const [uRows] = await conn.query(
            `SELECT patient_id FROM user_account
             WHERE username=? AND patient_id IS NOT NULL LIMIT 1`,
            [email]
        );
        if (!uRows.length) {
            await conn.rollback(); conn.release();
            return res.status(404).json({ success: false, message: 'No account found for this email.' });
        }
        const primaryPatientId = uRows[0].patient_id;

        // Prevent duplicate NIC across all patients
        if (nic && nic.trim()) {
            const [existNic] = await conn.query(
                `SELECT patient_id FROM patient WHERE nic=? LIMIT 1`, [nic.trim()]
            );
            if (existNic.length) {
                await conn.rollback(); conn.release();
                return res.json({ success: false, message: 'A patient with this NIC is already registered.' });
            }
        }

        // Normalize phone to international format (+94XXXXXXXXX)
        const normalizedPhone = phone?.trim()
            ? (phone.trim().startsWith('0') ? '+94' + phone.trim().slice(1) : phone.trim())
            : null;

        // Generate a unique barcode for the new family member
        const barcode = generateBarcode();

        // Insert the family member as a new patient record
        const [result] = await conn.query(
            `INSERT INTO patient (barcode, full_name, dob, gender, nic, phone, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [barcode, full_name.trim(), dob, gender, nic?.trim() || null, normalizedPhone]
        );
        const newPatientId = result.insertId;

        // Link the new patient to the primary patient's account
        await conn.query(
            `INSERT INTO patient_family (primary_patient_id, member_patient_id, relation)
             VALUES (?, ?, ?)`,
            [primaryPatientId, newPatientId, relation?.trim() || null]
        );

        await conn.commit();
        res.json({ success: true, barcode, patientId: newPatientId });
    } catch (err) {
        await conn.rollback();
        console.error('add-family-member error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release(); // Always return the connection to the pool
    }
});

// DELETE /api/remove-family-member
// Purpose:  Removes the link between a primary patient and a family
//           member. Does NOT delete the family member's patient record —
//           only removes the association. Prevents removal of self.
// Body params:
//   email         — account holder's email (identifies primary)
//   memberPatientId — the family member's patient_id to unlink
app.delete('/api/remove-family-member', async (req, res) => {
    const { email, memberPatientId } = req.body;
    if (!email || !memberPatientId)
        return res.status(400).json({ success: false, message: 'email and memberPatientId required.' });

    try {
        const [uRows] = await db.query(
            `SELECT patient_id FROM user_account
             WHERE username=? AND patient_id IS NOT NULL LIMIT 1`,
            [email]
        );
        if (!uRows.length)
            return res.status(404).json({ success: false, message: 'Account not found.' });

        const primaryId = uRows[0].patient_id;

        // Safety check: do not allow removing the primary account holder themselves
        if (parseInt(memberPatientId) === parseInt(primaryId))
            return res.status(400).json({
                success: false,
                message: 'Cannot remove the primary account.'
            });

        // Delete just the family link, not the patient record itself
        await db.query(
            `DELETE FROM patient_family
             WHERE primary_patient_id=? AND member_patient_id=?`,
            [primaryId, memberPatientId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('remove-family-member error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;