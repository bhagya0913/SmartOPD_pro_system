const express = require('express');
const { db } = require('../config/db');
const router = express.Router();


app.post('/api/pharmacist/save-note', async (req, res) => {
    const { record_id, note } = req.body;
    if (!record_id)
        return res.status(400).json({ success: false, message: 'record_id required.' });
    try {
        await db.query(
            `UPDATE treatment_records SET pharmacist_note = ? WHERE record_id = ?`,
            [note || null, record_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


app.get('/api/pharmacist/reports/generate', async (req, res) => {
    const { type, from, to } = req.query;
    if (!type || !from || !to)
        return res.status(400).json({ success: false, message: 'type, from, and to are required.' });

    try {
        let data = { success: true };

        switch (type) {

            // Count of prescriptions received per day in range
            case 'daily_received': {
                const [daily] = await db.query(`
                    SELECT DATE(tr.consultation_day) AS date, COUNT(*) AS count
                    FROM treatment_records tr
                    WHERE tr.prescription_details IS NOT NULL
                      AND tr.prescription_details != ''
                      AND tr.consultation_day BETWEEN ? AND ?
                    GROUP BY DATE(tr.consultation_day)
                    ORDER BY date
                `, [from, to]);
                data = { ...data, daily };
                break;
            }

            // List of prescriptions that have been dispensed (fulfilled) in range
            case 'dispensed': {
                const [prescriptions] = await db.query(`
                    SELECT
                        p.full_name  AS patient_name,
                        p.nic,
                        CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                        tr.consultation_day,
                        pf.fulfilled_at
                    FROM prescription_fulfillment pf
                    JOIN  treatment_records tr ON tr.record_id = pf.prescription_id
                    JOIN  patient p  ON tr.patient_id  = p.patient_id
                    LEFT JOIN staff s  ON tr.created_by   = s.staff_id
                    WHERE pf.fulfilled_at BETWEEN ? AND ?
                    ORDER BY pf.fulfilled_at DESC
                    LIMIT 300
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, prescriptions };
                break;
            }

            // List of prescriptions NOT yet dispensed in range
            case 'pending': {
                const [prescriptions] = await db.query(`
                    SELECT
                        p.full_name  AS patient_name,
                        p.nic,
                        CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                        tr.consultation_day
                    FROM treatment_records tr
                    JOIN  patient p  ON tr.patient_id  = p.patient_id
                    LEFT JOIN staff s  ON tr.created_by   = s.staff_id
                    LEFT JOIN prescription_fulfillment pf ON pf.prescription_id = tr.record_id
                    WHERE tr.prescription_details IS NOT NULL
                      AND tr.prescription_details != ''
                      AND tr.consultation_day BETWEEN ? AND ?
                      AND pf.fulfillment_id IS NULL          -- Not yet fulfilled
                    ORDER BY tr.consultation_day ASC
                    LIMIT 300
                `, [from, to]);
                data = { ...data, prescriptions };
                break;
            }

            // Top medications by prescription frequency (uses medication table if available)
            case 'most_prescribed': {
                try {
                    const [medications] = await db.query(`
                        SELECT m.medication_name, COUNT(*) AS count
                        FROM prescription pr
                        JOIN medication m ON pr.medication_id = m.medication_id
                        WHERE pr.prescribed_date BETWEEN ? AND ?
                        GROUP BY pr.medication_id
                        ORDER BY count DESC
                        LIMIT 30
                    `, [from, to]);
                    data = { ...data, medications };
                } catch {
                    // Graceful fallback if the prescription/medication table doesn't exist
                    data = { ...data, medications: [] };
                }
                break;
            }

            // Number of prescriptions written by each doctor in range
            case 'freq_by_doctor': {
                const [doctors] = await db.query(`
                    SELECT
                        CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                        s.staff_id AS doctor_staff_id,
                        COUNT(*) AS count
                    FROM treatment_records tr
                    LEFT JOIN staff s ON tr.created_by = s.staff_id
                    LEFT JOIN prescription_fulfillment pf ON pf.prescription_id = tr.record_id
                    WHERE tr.prescription_details IS NOT NULL
                      AND tr.prescription_details != ''
                      AND tr.consultation_day BETWEEN ? AND ?
                    GROUP BY tr.created_by
                    ORDER BY count DESC
                `, [from, to]);
                data = { ...data, doctors };
                break;
            }

            default:
                return res.status(400).json({
                    success: false,
                    message: `Unknown report type: ${type}`
                });
        }

        res.json(data);

    } catch (err) {
        console.error('Pharmacy report error:', err);
        // Return empty arrays instead of crashing so the UI can still render
        res.json({
            success: true,
            daily: [], prescriptions: [], medications: [], doctors: [],
            message: 'Partial data returned.'
        });
    }
});


app.get('/api/staff/feedback/:staff_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                f.feedback_id,
                f.comment,
                f.admin_note,
                f.status,
                f.date_submitted,
                f.user_id
            FROM feedback f
            JOIN user_account ua ON f.user_id = ua.user_id
            WHERE ua.staff_id = ?
            ORDER BY f.date_submitted DESC
            LIMIT 50
        `, [req.params.staff_id]);
        res.json({ success: true, feedback: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


app.get('/api/pharmacist/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

        // Count prescriptions with no fulfillment record at all
        const [pendingResult] = await db.query(`
            SELECT COUNT(*) AS pending
            FROM treatment_records tr
            WHERE tr.prescription_details IS NOT NULL
              AND tr.prescription_details != ''
              AND NOT EXISTS (
                  SELECT 1 FROM prescription_fulfillment pf
                  WHERE pf.prescription_id = tr.record_id
              )
        `);

        // Count prescriptions dispensed today
        const [fulfilledResult] = await db.query(`
            SELECT COUNT(*) AS fulfilled
            FROM prescription_fulfillment pf
            WHERE DATE(pf.fulfilled_at) = ?
        `, [today]);

        // Count new prescriptions written today
        const [totalResult] = await db.query(`
            SELECT COUNT(*) AS total
            FROM treatment_records tr
            WHERE DATE(tr.consultation_day) = ?
              AND tr.prescription_details IS NOT NULL
              AND tr.prescription_details != ''
        `, [today]);

        res.json({
            success: true,
            stats: {
                pending:   pendingResult[0]?.pending   || 0,
                fulfilled: fulfilledResult[0]?.fulfilled || 0,
                total:     totalResult[0]?.total       || 0
            }
        });
    } catch (err) {
        console.error('stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


app.get('/api/pharmacist/pending-queue', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                tr.record_id,
                tr.consultation_day,
                p.full_name AS patient_name,
                p.nic,
                p.barcode,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                s.staff_id AS doctor_staff_id
            FROM treatment_records tr
            JOIN patient p ON tr.patient_id = p.patient_id
            LEFT JOIN staff s ON tr.created_by = s.staff_id
            WHERE tr.prescription_details IS NOT NULL
              AND tr.prescription_details != ''
              AND NOT EXISTS (
                  SELECT 1 FROM prescription_fulfillment pf
                  WHERE pf.prescription_id = tr.record_id
              )
            ORDER BY tr.consultation_day ASC   -- Oldest first (FCFS queue)
            LIMIT 100
        `);
        res.json(rows); // Frontend expects a plain array
    } catch (err) {
        console.error('pending-queue error:', err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/pharmacist/all-prescriptions', async (req, res) => {
    const { status } = req.query;
    try {
        let query = `
            SELECT
                tr.record_id,
                tr.consultation_day,
                p.full_name AS patient_name,
                p.nic,
                p.barcode,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                s.staff_id AS doctor_staff_id,
                pf.fulfilled_at,
                CASE WHEN pf.fulfillment_id IS NOT NULL THEN 1 ELSE 0 END AS fulfilled
            FROM treatment_records tr
            JOIN patient p ON tr.patient_id = p.patient_id
            LEFT JOIN staff s ON tr.created_by = s.staff_id
            LEFT JOIN prescription_fulfillment pf ON pf.prescription_id = tr.record_id
            WHERE tr.prescription_details IS NOT NULL
              AND tr.prescription_details != ''
        `;
        const params = [];

        // Append filter if requested
        if (status === 'pending') {
            query += ` AND pf.fulfillment_id IS NULL`;
        } else if (status === 'fulfilled') {
            query += ` AND pf.fulfillment_id IS NOT NULL`;
        }

        query += ` ORDER BY tr.consultation_day DESC LIMIT 500`;
        const [rows] = await db.query(query, params);
        res.json({ success: true, prescriptions: rows });
    } catch (err) {
        console.error('all-prescriptions error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


app.get('/api/pharmacist/prescriptions-by-patient', async (req, res) => {
    const { term } = req.query;
    if (!term)
        return res.status(400).json({ success: false, message: 'Missing search term.' });

    try {
        // Find patient by exact barcode or NIC match
        const [patients] = await db.query(`
            SELECT patient_id, full_name, nic, barcode, gender, dob, phone
            FROM patient
            WHERE barcode = ? OR nic = ?
            LIMIT 1
        `, [term, term]);

        if (patients.length === 0)
            return res.json({ success: false, message: 'Patient not found.' });

        const patient = patients[0];

        // Get all prescriptions written for this patient
        const [prescriptions] = await db.query(`
            SELECT
                tr.record_id,
                tr.consultation_day,
                tr.prescription_details,
                CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                s.staff_id AS doctor_staff_id,
                pf.fulfilled_at,
                CASE WHEN pf.fulfillment_id IS NOT NULL THEN 1 ELSE 0 END AS fulfilled
            FROM treatment_records tr
            LEFT JOIN staff s ON tr.created_by = s.staff_id
            LEFT JOIN prescription_fulfillment pf ON pf.prescription_id = tr.record_id
            WHERE tr.patient_id = ?
              AND tr.prescription_details IS NOT NULL
              AND tr.prescription_details != ''
            ORDER BY tr.consultation_day DESC
        `, [patient.patient_id]);

        res.json({ success: true, patient, prescriptions });
    } catch (err) {
        console.error('prescriptions-by-patient error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


app.post('/api/pharmacist/fulfill-record', async (req, res) => {
    const { record_id, pharmacist_id, notes } = req.body;
    if (!record_id || !pharmacist_id) {
        return res.status(400).json({
            success: false,
            message: 'record_id and pharmacist_id required.'
        });
    }

    try {
        // Prevent double-dispensing: check if already fulfilled
        const [existing] = await db.query(
            `SELECT fulfillment_id FROM prescription_fulfillment WHERE prescription_id = ?`,
            [record_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Prescription already dispensed.'
            });
        }

        // Record the dispensing event
        await db.query(
            `INSERT INTO prescription_fulfillment (prescription_id, pharmacist_id, fulfilled_at, notes)
             VALUES (?, ?, NOW(), ?)`,
            [record_id, pharmacist_id, notes || null]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('fulfill-record error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;