const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/db');
const transporter = require('../config/email');
const router = express.Router();


router.get('/api/admin/staff', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.staff_id, s.first_name, s.surname, s.email, s.phone, s.nic, s.is_active,
                   r.role_name
            FROM staff s
            LEFT JOIN roles r ON s.role_id = r.role_id
            ORDER BY s.staff_id ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});


router.get('/api/admin/check-email', async (req, res) => {
    const { email } = req.query;
    if (!email)
        return res.status(400).json({ success: false, message: 'Email required.' });

    try {
        const [userRows] = await db.query(
            `SELECT ua.user_id, ua.patient_id, ua.staff_id,
                    p.full_name  AS patient_name,
                    CONCAT(s.first_name,' ',s.surname) AS staff_name,
                    r.role_name
             FROM user_account ua
             LEFT JOIN patient p ON ua.patient_id = p.patient_id
             LEFT JOIN staff   s ON ua.staff_id   = s.staff_id
             LEFT JOIN roles   r ON s.role_id     = r.role_id
             WHERE ua.username = ? LIMIT 1`,
            [email]
        );

        if (!userRows.length) {
            // Scenario A: completely new person
            return res.json({
                success: true,
                hasPatientAccount: false, hasStaffAccount: false,
                scenario: 'A',
                message: 'No existing account. A new staff account will be created.'
            });
        }

        const u = userRows[0];

        if (u.staff_id) {
            // Scenario C: already registered as staff — block
            return res.json({
                success: true,
                hasPatientAccount: !!u.patient_id, hasStaffAccount: true,
                scenario: 'C',
                existingRole: u.role_name, staffName: u.staff_name,
                message: `This email is already registered as ${u.role_name} (${u.staff_name}). Cannot register again.`
            });
        }

        if (u.patient_id) {
            // Scenario B: existing patient — will gain staff role
            return res.json({
                success: true,
                hasPatientAccount: true, hasStaffAccount: false,
                scenario: 'B',
                patientName: u.patient_name,
                message: `Patient account found for ${u.patient_name}. Staff role will be added to their existing login. No new password needed.`
            });
        }

        // Edge case: orphaned account (no patient, no staff)
        return res.json({
            success: true,
            hasPatientAccount: false, hasStaffAccount: false,
            scenario: 'A',
            message: 'Orphaned account found. A new staff entry will be created and linked.'
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.post('/api/admin/add-staff', async (req, res) => {
    const { staffId, firstName, surname, email, phone, nic, roleName } = req.body;

    // Validate required fields
    if (!firstName || !surname || !email || !nic || !roleName) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Validate NIC format: 9 digits + X/V, or 12 digits (new NIC)
    if (!/^([0-9]{9}[xXvV]|[0-9]{12})$/.test(nic)) {
        return res.status(400).json({ success: false, message: 'Invalid NIC format.' });
    }

    // Normalize phone to +94 format
    const normalizedPhone = phone?.trim()
        ? (phone.trim().startsWith('0') ? '+94' + phone.trim().slice(1) : phone.trim())
        : null;

    // Map role names to role_id values matching the roles DB table
    const roleMap = { Doctor: 1, Pharmacist: 2, Receptionist: 3, 'Diagnostic Technician': 4, Admin: 5 };
    const roleId  = roleMap[roleName];
    if (!roleId) {
        return res.status(400).json({ success: false, message: `Unknown role: ${roleName}` });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check for an existing user_account with this email
        const [existingUser] = await conn.query(
            `SELECT ua.user_id, ua.patient_id, ua.staff_id,
                    CONCAT(s.first_name,' ',s.surname) AS existing_staff_name,
                    r.role_name AS existing_role
             FROM user_account ua
             LEFT JOIN staff s ON ua.staff_id = s.staff_id
             LEFT JOIN roles r ON s.role_id   = r.role_id
             WHERE ua.username = ? LIMIT 1`,
            [email]
        );

        // Scenario C: already a staff member — hard reject
        if (existingUser.length && existingUser[0].staff_id) {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: `This email is already registered as ${existingUser[0].existing_role} `
                       + `(${existingUser[0].existing_staff_name}). `
                       + `A staff member cannot be registered twice.`
            });
        }

        // Ensure NIC is not already in use by another staff member
        const [nicCheck] = await conn.query(
            'SELECT staff_id FROM staff WHERE nic = ? LIMIT 1', [nic]
        );
        if (nicCheck.length) {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: 'A staff member with this NIC is already registered.'
            });
        }

        // Insert into staff table — use provided staffId if given, else auto-increment
        let newStaffId;
        const manualId = staffId?.trim() ? parseInt(staffId.trim()) : null;

        if (manualId) {
            const [idCheck] = await conn.query(
                'SELECT staff_id FROM staff WHERE staff_id = ? LIMIT 1', [manualId]
            );
            if (idCheck.length) {
                await conn.rollback();
                return res.status(409).json({
                    success: false,
                    message: `Staff ID ${manualId} is already in use.`
                });
            }
            await conn.query(
                `INSERT INTO staff (staff_id, first_name, surname, email, phone, nic, role_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [manualId, firstName, surname, email, normalizedPhone, nic, roleId]
            );
            newStaffId = manualId;
        } else {
            const [result] = await conn.query(
                `INSERT INTO staff (first_name, surname, email, phone, nic, role_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [firstName, surname, email, normalizedPhone, nic, roleId]
            );
            newStaffId = result.insertId;
        }

        let isScenarioB  = false;
        let tempPassword = null;

        if (!existingUser.length) {
            // Scenario A: Create a new user account with a generated temporary password
            tempPassword = Math.random().toString(36).slice(-6).toUpperCase()
                         + Math.random().toString(36).slice(-4)
                         + 'A1!'; // Ensures meets basic complexity requirements
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            await conn.query(
                `INSERT INTO user_account (username, password_hash, staff_id, patient_id)
                 VALUES (?, ?, ?, NULL)`,
                [email, hashedPassword, newStaffId]
            );
        } else {
            // Scenario B: Existing patient account — link new staff_id to it
            isScenarioB = true;
            await conn.query(
                `UPDATE user_account SET staff_id = ? WHERE user_id = ?`,
                [newStaffId, existingUser[0].user_id]
            );
            // patient_id is preserved — dual-role account
        }

        await conn.commit();

        // Send onboarding email based on scenario
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000/login';

        // Scenario B email: no new password — uses existing credentials
        // Scenario A email: includes temporary password and prompt to change it
        const emailHtml = isScenarioB
            ? `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;
                           border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
                <div style="background:#0f172a;padding:20px 28px;color:white">
                    <h2 style="margin:0;font-weight:600">SmartOPD · Staff Access Granted</h2>
                    <p style="margin:6px 0 0;opacity:0.7">Base Hospital, Kiribathgoda</p>
                </div>
                <div style="padding:24px 28px;background:#ffffff">
                    <p style="margin:0 0 8px;font-size:15px">
                        Dear <strong>${firstName} ${surname}</strong>,
                    </p>
                    <p style="margin:0 0 20px;color:#334155">
                        You have been registered as a <strong>${roleName}</strong> in the SmartOPD system.
                    </p>
                    <div style="background:#f0fdf4;border-radius:12px;padding:16px 20px;
                                margin:0 0 20px;border-left:4px solid #16a34a">
                        <p style="margin:0 0 8px;font-weight:600;color:#166534">
                            ✓ Your existing account has been updated
                        </p>
                        <p style="margin:0;font-size:14px;color:#334155">
                            <strong>Login:</strong> ${email}
                        </p>
                        <p style="margin:4px 0 0;font-size:14px;color:#334155">
                            <strong>Password:</strong> Your existing password — unchanged
                        </p>
                    </div>
                    <div style="background:#fffbeb;border-radius:10px;padding:14px 18px;
                                margin:0 0 20px;border-left:4px solid #d97706">
                        <p style="margin:0;font-size:13px;color:#78350f">
                            <strong>Important:</strong> When you log in, you will be asked to choose 
                            which role to use — <strong>Patient</strong> or <strong>${roleName}</strong>. 
                            Each role opens a different dashboard.
                        </p>
                    </div>
                    <p style="margin:0;font-size:13px;color:#475569">
                        Log in at <a href="${loginUrl}" style="color:#92400e">${loginUrl}</a>
                    </p>
                    <hr style="margin:24px 0 16px;border:none;border-top:1px solid #e2e8f0"/>
                    <p style="margin:0;font-size:12px;color:#94a3b8">
                        This is an automated message. For support, contact hospital IT.
                    </p>
                </div>
               </div>`

            : `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;
                            border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
                <div style="background:#0f172a;padding:20px 28px;color:white">
                    <h2 style="margin:0;font-weight:600">SmartOPD · Staff Account Created</h2>
                    <p style="margin:6px 0 0;opacity:0.7">Base Hospital, Kiribathgoda</p>
                </div>
                <div style="padding:24px 28px;background:#ffffff">
                    <p style="margin:0 0 8px;font-size:15px">
                        Dear <strong>${firstName} ${surname}</strong>,
                    </p>
                    <p style="margin:0 0 20px;color:#334155">
                        You have been registered as a <strong>${roleName}</strong> in the SmartOPD system.
                    </p>
                    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;
                                margin:0 0 20px;border-left:4px solid #92400e">
                        <p style="margin:0 0 10px;font-weight:600">🔐 Your login credentials</p>
                        <p style="margin:4px 0;font-size:14px">
                            <strong>Username:</strong> ${email}
                        </p>
                        <p style="margin:4px 0;font-size:14px">
                            <strong>Temporary password:</strong>
                            <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;
                                         font-size:14px;letter-spacing:1px">${tempPassword}</code>
                        </p>
                    </div>
                    <div style="background:#fef2f2;border-radius:10px;padding:12px 16px;
                                margin:0 0 20px;border-left:4px solid #dc2626">
                        <p style="margin:0;font-size:13px;color:#991b1b">
                            <strong>Action required:</strong> Please log in and change your 
                            password immediately.
                        </p>
                    </div>
                    <p style="margin:0;font-size:13px;color:#475569">
                        Log in at <a href="${loginUrl}" style="color:#92400e">${loginUrl}</a>
                    </p>
                    <hr style="margin:24px 0 16px;border:none;border-top:1px solid #e2e8f0"/>
                    <p style="margin:0;font-size:12px;color:#94a3b8">
                        This is an automated message. For support, contact hospital IT.
                    </p>
                </div>
               </div>`;

        // Send email (non-fatal — warn but don't crash if it fails)
        await transporter.sendMail({
            from:    `"SmartOPD" <${process.env.MAIL_FROM || 'bhagya0913@gmail.com'}>`,
            to:      email,
            subject: isScenarioB
                ? `SmartOPD: You now have ${roleName} access`
                : `SmartOPD: Your ${roleName} account has been created`,
            html: emailHtml
        }).catch(err => console.warn('Staff email failed:', err.message));

        const scenarioLabel = isScenarioB ? 'existing patient account updated' : 'new account created';
        res.json({
            success:  true,
            scenario: isScenarioB ? 'B' : 'A',
            staffId:  newStaffId,
            message:  `${firstName} ${surname} registered as ${roleName}. `
                    + `(${scenarioLabel}) Notification sent to ${email}.`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Add staff error:', err);

        // Provide a more readable error for unique key violations
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'A staff record with this email or NIC already exists.'
            });
        }
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});


router.delete('/api/admin/remove-staff/:staffId', async (req, res) => {
    const staffId = req.params.staffId;
    try {
        const [result] = await db.query(
            `UPDATE staff SET is_active = 0 WHERE staff_id = ?`, [staffId]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ success: false, message: 'Staff not found.' });

        res.json({ success: true, message: 'Staff deactivated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.patch('/api/admin/reactivate-staff/:staffId', async (req, res) => {
    const staffId = req.params.staffId;
    console.log(`Reactivating staff ID: ${staffId}`);
    try {
        const [result] = await db.query(
            `UPDATE staff SET is_active = 1 WHERE staff_id = ?`, [staffId]
        );
        console.log(`Rows affected: ${result.affectedRows}`);
        if (result.affectedRows === 0)
            return res.status(404).json({ success: false, message: 'Staff not found.' });

        res.json({ success: true, message: 'Staff reactivated.' });
    } catch (err) {
        console.error('Reactivation error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/patients', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500); // Cap at 500 for safety
    try {
        const [rows] = await db.query(`
            SELECT p.patient_id, p.full_name, p.date_of_birth, p.nic, p.phone,
                   p.is_active,
                   u.username AS email,
                   (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.patient_id) AS total_appointments
            FROM patient p
            LEFT JOIN user_account u ON u.patient_id = p.patient_id
            ORDER BY p.patient_id DESC
            LIMIT ?
        `, [limit]);
        res.json({ success: true, patients: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/dashboard-stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [[apptRow]]    = await db.query(
            `SELECT COUNT(*) AS todayAppts FROM appointments WHERE appointment_day = ?`, [today]
        );
        const [[pendingRow]] = await db.query(
            `SELECT COUNT(*) AS pendingAppts FROM appointments WHERE status = 'booked'`
        );
        const [[staffRow]]   = await db.query(
            `SELECT COUNT(*) AS totalStaff FROM staff WHERE is_active = 1`
        );

        // Load OPD hours from system_settings; fallback if settings missing
        let opdHours = '—';
        try {
            const [[s]] = await db.query(
                `SELECT setting_value FROM system_settings WHERE setting_key='opd_start_hour' LIMIT 1`
            );
            const [[e]] = await db.query(
                `SELECT setting_value FROM system_settings WHERE setting_key='opd_end_hour' LIMIT 1`
            );
            if (s && e)
                opdHours = `${String(s.setting_value).padStart(2,'0')}:00 – ${String(e.setting_value).padStart(2,'0')}:00`;
        } catch (_) {
            opdHours = '08:00 – 18:00'; // Hardcoded fallback
        }

        res.json({ success: true, stats: {
            todayAppts:   apptRow.todayAppts,
            pendingAppts: pendingRow.pendingAppts,
            totalStaff:   staffRow.totalStaff,
            opdHours
        }});
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.patch('/api/admin/patient-status/:id', async (req, res) => {
    const { is_active, reason } = req.body;
    const patientId = req.params.id;
    try {
        await db.query(
            `UPDATE patient SET is_active = ? WHERE patient_id = ?`, [is_active, patientId]
        );

        // Audit log (non-critical — swallowed if audit_log table doesn't exist)
        try {
            const action = is_active
                ? 'REACTIVATED'
                : ('DISABLED' + (reason ? ' - ' + reason : ''));
            await db.query(
                `INSERT INTO audit_log (table_name, action, record_id, changed_by, changed_at)
                 VALUES ('patient', ?, ?, 'admin', NOW())`,
                [action.slice(0, 200), patientId]   // Truncate to 200 chars for safety
            );
        } catch (_) {}

        res.json({
            success: true,
            message: `Patient record ${is_active ? 'reactivated' : 'disabled'}.`
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/patient-report/:id', async (req, res) => {
    const patientId = req.params.id;
    const type      = req.query.type || 'patient_history';

    try {
        if (type === 'patient_history') {
            // All appointments for this patient with doctor info
            const [appointments] = await db.query(`
                SELECT
                    a.appointment_id, a.appointment_day, a.start_time, a.end_time,
                    a.status, a.visit_type,
                    CONCAT(s.first_name, ' ', s.surname) AS doctor_name
                FROM appointments a
                LEFT JOIN staff s ON a.doctor_id = s.staff_id
                WHERE a.patient_id = ?
                ORDER BY a.appointment_day DESC, a.start_time DESC
            `, [patientId]);
            return res.json({ success: true, appointments });

        } else if (type === 'patient_prescriptions') {
            // All prescriptions with medication and doctor info
            const [prescriptions] = await db.query(`
                SELECT
                    pr.prescription_id, pr.prescribed_date,
                    m.medication_name, pr.dosage, pr.duration,
                    CONCAT(s.first_name, ' ', s.surname) AS doctor_name
                FROM prescription pr
                LEFT JOIN medication m ON pr.medication_id = m.medication_id
                LEFT JOIN staff s ON pr.prescribed_by = s.staff_id
                WHERE pr.patient_id = ?
                ORDER BY pr.prescribed_date DESC
            `, [patientId]);
            return res.json({ success: true, prescriptions });

        } else if (type === 'patient_lab_tests') {
            // All lab tests ordered for this patient
            const [tests] = await db.query(`
                SELECT
                    lt.test_id, lt.test_date, lt.status, lt.result,
                    t.test_name,
                    CONCAT(s.first_name, ' ', s.surname) AS doctor_name
                FROM lab_test lt
                LEFT JOIN test_catalog t ON lt.test_catalog_id = t.test_catalog_id
                LEFT JOIN staff s ON lt.requested_by = s.staff_id
                WHERE lt.patient_id = ?
                ORDER BY lt.test_date DESC
            `, [patientId]);
            return res.json({ success: true, tests });
        }

        res.status(400).json({ success: false, message: 'Invalid report type.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/reports/generate', async (req, res) => {
    const { type, from, to } = req.query;
    if (!type || !from || !to)
        return res.status(400).json({ success: false, message: 'type, from, and to are required.' });

    try {
        let data = { success: true };

        switch (type) {

            // Unique patient visit count per day
            case 'opd_patient_count': {
                const [daily] = await db.query(`
                    SELECT appointment_day AS date, COUNT(DISTINCT patient_id) AS count
                    FROM appointments
                    WHERE appointment_day BETWEEN ? AND ?
                    GROUP BY appointment_day ORDER BY appointment_day
                `, [from, to]);
                const [[summary]] = await db.query(`
                    SELECT COUNT(DISTINCT patient_id) AS total
                    FROM appointments WHERE appointment_day BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, daily, total: summary.total };
                break;
            }

            // Appointment breakdown by status + comparison with previous equivalent period
            case 'appointment_statistics': {
                const [[summary]] = await db.query(`
                    SELECT COUNT(*) AS total,
                        SUM(status='completed') AS completed,
                        SUM(status='cancelled') AS cancelled,
                        SUM(status='no_show')   AS no_show,
                        SUM(status='booked')    AS booked
                    FROM appointments
                    WHERE appointment_day BETWEEN ? AND ?
                `, [from, to]);

                // Calculate the equivalent prior period for trend comparison
                const duration  = new Date(to) - new Date(from);
                const prevTo    = new Date(new Date(from) - 1);
                const prevFrom  = new Date(prevTo - duration);
                const prevFromStr = prevFrom.toISOString().split('T')[0];
                const prevToStr   = prevTo.toISOString().split('T')[0];

                const [[prevSummary]] = await db.query(`
                    SELECT COUNT(*) AS total,
                        SUM(status='completed') AS completed,
                        SUM(status='cancelled') AS cancelled,
                        SUM(status='no_show')   AS no_show,
                        SUM(status='booked')    AS booked
                    FROM appointments
                    WHERE appointment_day BETWEEN ? AND ?
                `, [prevFromStr, prevToStr]);

                // Appointments per doctor
                const [byDoctor] = await db.query(`
                    SELECT CONCAT(s.first_name,' ',s.surname) AS doctor_name,
                        COUNT(*) AS total,
                        SUM(a.status='completed') AS completed,
                        SUM(a.status='cancelled') AS cancelled
                    FROM appointments a
                    LEFT JOIN staff s ON a.doctor_id = s.staff_id
                    WHERE a.appointment_day BETWEEN ? AND ?
                    GROUP BY a.doctor_id ORDER BY total DESC
                `, [from, to]);

                data = { ...data, summary, prevSummary, byDoctor };
                break;
            }

            // Appointment counts and completion rates per doctor
            case 'doctor_workload': {
                const [workload] = await db.query(`
                    SELECT CONCAT(s.first_name,' ',s.surname) AS doctor_name,
                        COUNT(*) AS total,
                        SUM(a.status='completed') AS completed,
                        SUM(a.status='cancelled') AS cancelled,
                        SUM(a.status='no_show')   AS no_show
                    FROM appointments a
                    LEFT JOIN staff s ON a.doctor_id = s.staff_id
                    WHERE a.appointment_day BETWEEN ? AND ?
                    AND s.role_id = (SELECT role_id FROM roles WHERE role_name='Doctor' LIMIT 1)
                    GROUP BY a.doctor_id ORDER BY total DESC
                `, [from, to]);
                data = { ...data, workload };
                break;
            }

            // Most frequently prescribed medications in period
            case 'prescription_statistics': {
                const [medications] = await db.query(`
                    SELECT m.medication_name, COUNT(*) AS count
                    FROM prescription pr
                    LEFT JOIN medication m ON pr.medication_id = m.medication_id
                    WHERE pr.prescribed_date BETWEEN ? AND ?
                    GROUP BY pr.medication_id ORDER BY count DESC LIMIT 30
                `, [from, to]);
                const [[totals]] = await db.query(`
                    SELECT COUNT(*) AS total FROM prescription
                    WHERE prescribed_date BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, medications, total: totals.total };
                break;
            }

            // Most requested lab tests and their completion rate
            case 'lab_test_statistics': {
                const [tests] = await db.query(`
                    SELECT t.test_name, COUNT(*) AS count,
                        SUM(lt.status='completed') AS completed
                    FROM lab_test lt
                    LEFT JOIN test_catalog t ON lt.test_catalog_id = t.test_catalog_id
                    WHERE lt.test_date BETWEEN ? AND ?
                    GROUP BY lt.test_catalog_id ORDER BY count DESC
                `, [from, to]);
                const [[totals]] = await db.query(`
                    SELECT COUNT(*) AS total, SUM(status='completed') AS completed
                    FROM lab_test WHERE test_date BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, tests, total: totals.total, completed: totals.completed };
                break;
            }

            // Monthly new patient registrations (requires created_at column in patient table)
            case 'patient_registration_growth': {
                let growth;
                try {
                    [growth] = await db.query(`
                        SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, COUNT(*) AS count
                        FROM patient
                        WHERE created_at BETWEEN ? AND ?
                        GROUP BY period ORDER BY period
                    `, [from + ' 00:00:00', to + ' 23:59:59']);
                } catch (e) {
                    // Fallback: group by patient_id range if created_at doesn't exist
                    [growth] = await db.query(`
                        SELECT CONCAT('Record #', FLOOR(patient_id/10)*10, '-', FLOOR(patient_id/10)*10+9) AS period,
                            COUNT(*) AS count
                        FROM patient GROUP BY FLOOR(patient_id/10) ORDER BY patient_id
                    `);
                }
                data = { ...data, growth };
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
        console.error('Report generation error:', err);
        // Return empty data so the UI renders gracefully even on partial failure
        res.json({
            success: true,
            summary: {}, daily: [], workload: [], staff: [], doctors: [],
            medications: [], tests: [], growth: [], feedback: [], slots: [], logins: [],
            events: [], logs: [],
            message: 'Partial data — some tables may not exist yet.'
        });
    }
});


router.get('/api/admin/export-data', async (req, res) => {
    const { table, columns, date_from, date_to } = req.query;

    // Security: only allow known safe tables
    const allowedTables = ['appointments', 'patient', 'staff', 'prescriptions', 'lab_test', 'feedback'];
    if (!allowedTables.includes(table))
        return res.status(400).json({ success: false, message: 'Invalid table name' });

    // Map each table to its date filter column
    const dateColumnMap = {
        appointments: 'appointment_day',
        patient:      'created_at',
        staff:        'created_at',
        prescriptions:'prescribed_date',
        lab_test:     'test_date',
        feedback:     'date_submitted'
    };
    const dateCol = dateColumnMap[table];

    // Security: validate requested columns against per-table whitelist
    const allowedColumnsMap = {
        appointments: ['appointment_id', 'patient_id', 'doctor_id', 'appointment_day', 'start_time', 'end_time', 'queue_no', 'visit_type', 'status', 'is_present', 'created_at', 'completed_at'],
        patient:      ['patient_id', 'full_name', 'nic', 'dob', 'gender', 'phone', 'email', 'address', 'blood_group', 'allergies', 'chronic_conditions', 'emergency_contact', 'civil_status', 'barcode', 'is_active', 'created_at'],
        staff:        ['staff_id', 'first_name', 'surname', 'email', 'phone', 'nic', 'role_id', 'is_active', 'created_at'],
        prescriptions:['prescription_id', 'patient_id', 'prescribed_by', 'prescribed_date', 'medication_id', 'dosage', 'duration', 'fulfilled_at', 'pharmacist_id'],
        medical_test: ['test_id', 'patient_id', 'requested_by', 'test_date', 'test_catalog_id', 'status', 'result', 'sample_collected_at', 'completed_at'],
        feedback:     ['feedback_id', 'patient_id', 'user_id', 'comment', 'rating', 'date_submitted', 'status', 'admin_note']
    };

    let selectedColumns = '*'; // Default: all columns
    if (columns) {
        const requested = columns.split(',');
        const allowed   = allowedColumnsMap[table];
        const valid     = requested.filter(col => allowed.includes(col));
        if (valid.length > 0)
            selectedColumns = valid.join(',');
    }

    // Build parameterized SQL query
    let sql    = `SELECT ${selectedColumns} FROM ${table} WHERE 1=1`;
    const params = [];

    if (date_from && date_to && dateCol) {
        sql += ` AND ${dateCol} BETWEEN ? AND ?`;
        params.push(date_from, date_to);
    }

    try {
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/logs', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const { from, to } = req.query;
    try {
        let query = `
            SELECT log_id, table_name, action, record_id, changed_by, changed_at
            FROM audit_log
        `;
        const params = [];
        if (from && to) {
            query += ` WHERE changed_at BETWEEN ? AND ?`;
            params.push(from + ' 00:00:00', to + ' 23:59:59');
        }
        query += ` ORDER BY changed_at DESC LIMIT ?`;
        params.push(limit);
        const [logs] = await db.query(query, params);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/opd-settings', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings`
        );
        // Default values in case the DB has no entries yet
        const settings = {
            opd_start_hour:        '8',
            opd_end_hour:          '18',
            slot_capacity:         '6',
            consultation_duration: '10',
            closed_dates:          ''
        };
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json({ success: true, settings });
    } catch (err) {
        res.json({ success: true, settings: {} });
    }
});


router.post('/api/admin/opd-settings', async (req, res) => {
    const {
        opd_start_hour, opd_end_hour, slot_capacity,
        consultation_duration, closed_dates
    } = req.body;

    const keys   = ['opd_start_hour', 'opd_end_hour', 'slot_capacity', 'consultation_duration', 'closed_dates'];
    const values = [opd_start_hour, opd_end_hour, slot_capacity, consultation_duration, closed_dates || ''];

    try {
        for (let i = 0; i < keys.length; i++) {
            await db.query(
                `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [keys[i], String(values[i] || '')]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.get('/api/admin/feedback', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT f.feedback_id, f.comment, f.admin_note, f.date_submitted, f.status,
                   p.full_name AS patient_name,
                   CONCAT(s.first_name, ' ', s.surname) AS user_name,
                   f.user_id, f.patient_id
            FROM feedback f
            LEFT JOIN patient p ON f.patient_id = p.patient_id
            LEFT JOIN user_account ua ON f.user_id = ua.user_id
            LEFT JOIN staff s ON ua.staff_id = s.staff_id
            ORDER BY f.date_submitted DESC
        `);
        res.json({ success: true, feedback: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


router.patch('/api/admin/feedback/:id', async (req, res) => {
    const { admin_note, status } = req.body;
    try {
        await db.query(
            `UPDATE feedback SET admin_note = ?, status = ? WHERE feedback_id = ?`,
            [admin_note || null, status || 'reviewed', req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;