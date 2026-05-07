const express = require('express');
const { db } = require('../config/db');
const router = express.Router();

 
app.get('/api/lab/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [[{ pending }]]    = await db.query(
            `SELECT COUNT(*) AS pending FROM medical_tests WHERE status='requested'`
        );
        const [[{ inProgress }]] = await db.query(
            `SELECT COUNT(*) AS inProgress FROM medical_tests WHERE status='in_progress'`
        );
        // Only count tests completed today, not historical
        const [[{ completed }]]  = await db.query(
            `SELECT COUNT(*) AS completed FROM medical_tests
             WHERE status='completed' AND DATE(updated_at) = ?`, [today]
        );
        res.json({ success: true, stats: { pending, inProgress, completed } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

 
app.get('/api/lab/worklist', async (req, res) => {
    const { status = 'requested' } = req.query;
    try {
        let sql = `
        SELECT
            mt.test_id, mt.test_type, mt.test_name, mt.status,
            mt.requested_at, mt.updated_at, mt.sample_collected_at,
            p.patient_id, p.full_name AS patient_name, p.nic,
            p.barcode, p.dob AS patient_dob, p.gender AS patient_gender,
            p.phone AS patient_phone,
            s.staff_id AS doctor_id,
            CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
            r.role_name AS doctor_dept
        FROM medical_tests mt
        JOIN patient p ON mt.patient_id = p.patient_id
        LEFT JOIN staff  s ON mt.requested_by = s.staff_id
        LEFT JOIN roles  r ON s.role_id = r.role_id
        WHERE mt.status != 'cancelled'   -- Never show cancelled tests
    `;

        // Map frontend status labels to DB status values
        const statusMap = {
            pending:     'requested',
            in_progress: 'in_progress',
            completed:   'completed',
            requested:   'requested',
        };
        const dbStatus = statusMap[status] || status;

        if (dbStatus !== 'all') {
            sql += ` AND mt.status = ?`;
        }
        sql += ` ORDER BY mt.test_id DESC LIMIT 200`;

        const params = dbStatus !== 'all' ? [dbStatus] : [];
        const [rows] = await db.query(sql, params);
        res.json({ success: true, tests: rows });
    } catch (err) {
        console.error('Worklist error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

 
app.get('/api/lab/patient-tests', async (req, res) => {
    const { term } = req.query;
    if (!term)
        return res.status(400).json({ success: false, message: 'Search term required.' });

    try {
        const [patients] = await db.query(
            `SELECT patient_id, full_name, nic, barcode FROM patient
             WHERE (barcode=? OR nic=?) AND is_active=1 LIMIT 1`,
            [term, term]
        );
        if (!patients.length)
            return res.json({ success: false, message: 'No patient found.' });

        const patient = patients[0];

        const [tests] = await db.query(`
            SELECT mt.test_id, mt.test_type, mt.test_name, mt.status,
                   CONCAT(s.first_name,' ',s.surname) AS doctor_name
            FROM medical_tests mt
            LEFT JOIN staff s ON mt.requested_by = s.staff_id
            WHERE mt.patient_id = ? AND mt.status != 'cancelled'
            ORDER BY mt.test_id DESC LIMIT 20
        `, [patient.patient_id]);

        res.json({ success: true, patient, tests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

 
app.post('/api/lab/update-status', async (req, res) => {
    const { test_id, status, technician_id } = req.body;
    if (!test_id || !status)
        return res.status(400).json({ success: false, message: 'test_id and status required.' });

    const allowed = ['in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status))
        return res.status(400).json({ success: false, message: 'Invalid status.' });

    try {
        if (status === 'in_progress') {
            // Record the time the sample was collected
            await db.query(
                `UPDATE medical_tests
                 SET status = ?, sample_collected_at = NOW(), updated_at = NOW()
                 WHERE test_id = ?`,
                [status, test_id]
            );
        } else {
            await db.query(
                `UPDATE medical_tests SET status = ?, updated_at = NOW() WHERE test_id = ?`,
                [status, test_id]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

 
app.post('/api/lab/upload-result',
    async (req, res) => {
        const { test_id, summary, remarks, uploaded_by } = req.body;

        if (!test_id)
            return res.status(400).json({ success: false, message: 'test_id is required.' });
        if (!summary?.trim())
            return res.status(400).json({ success: false, message: 'Findings/summary is required.' });

        try {
            const filePath = req.file ? req.file.path : null; // Optional file attachment (upload middleware not active)

            // Insert result or update if already exists for this test
            await db.query(`
                INSERT INTO test_results
                    (test_id, summary, remarks, file_path, uploaded_by, uploaded_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    summary     = VALUES(summary),
                    remarks     = VALUES(remarks),
                    file_path   = VALUES(file_path),
                    uploaded_by = VALUES(uploaded_by),
                    uploaded_at = NOW()
            `, [
                test_id,
                summary.trim(),
                remarks?.trim() || null,
                filePath,
                uploaded_by || null,
            ]);

            // Automatically mark the test as completed when results are uploaded
            await db.query(
                `UPDATE medical_tests SET status = 'completed', updated_at = NOW() WHERE test_id = ?`,
                [test_id]
            );

            res.json({ success: true, message: 'Results submitted successfully.' });
        } catch (err) {
            console.error('Upload result error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);


module.exports = router;