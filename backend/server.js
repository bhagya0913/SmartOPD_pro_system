require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const bcrypt  = require('bcrypt');
const bwipjs  = require('bwip-js');
const nodemailer = require('nodemailer');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bhagya0913@gmail.com',
        pass: 'nfzunxjlstdszaba'
    }
});

// ── OTP store ────────────────────────────────────────────────────────────────
const otpStore = new Map();

// ── Database pool ────────────────────────────────────────────────────────────
// pool.promise() returns a promise-based pool.
// ALL routes use: const [rows] = await db.query(sql, params)
// Transactions:   const conn = await db.getConnection(); await conn.beginTransaction(); ...
const pool = mysql.createPool({
    host:             process.env.DB_HOST     || 'localhost',
    port:             3307,
    user:             process.env.DB_USER     || 'root',
    password:         process.env.DB_PASS     || '757135@bhagikLn',
    database:         process.env.DB_NAME     || 'hospital_db',
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0
});

const db = pool.promise(); // ← This IS the promise pool. Never call db.promise() again.

// ── DB init ──────────────────────────────────────────────────────────────────
async function initDB() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS otp_verification (
                email VARCHAR(255) PRIMARY KEY,
                otp_code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS patient_family (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                primary_patient_id BIGINT NOT NULL,
                member_patient_id  BIGINT NOT NULL,
                relation           VARCHAR(50) DEFAULT NULL,
                created_at         DATETIME DEFAULT NOW(),
                UNIQUE KEY uq_link (primary_patient_id, member_patient_id),
                KEY idx_primary    (primary_patient_id),
                KEY idx_member     (member_patient_id)
            )
        `);
        console.log('✅ Database tables verified.');
    } catch (err) {
        console.error('❌ Database init error:', err);
    }
}
initDB();



// ═══════════════════════════════════════════════════════════════════════════
//  AUTH — FORGOT / RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    try {
        const [users] = await db.query('SELECT user_id FROM user_account WHERE username = ?', [email]);
        if (!users.length) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 5 * 60000);

        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'email', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [email, otp, expires, otp, expires]);

        await transporter.sendMail({
            from: 'bhagya0913@gmail.com',
            to: email,
            subject: 'SmartOPD Password Reset Code',
            html: `<div style="font-family:Arial;max-width:480px;margin:auto;padding:25px;border:1px solid #eee;border-radius:10px">
                   <h2 style="color:#2563eb">SmartOPD Password Reset</h2>
                   <p>Your verification code:</p>
                   <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:8px;background:#eff6ff;padding:20px;border-radius:8px;margin:15px 0">${otp}</div>
                   <p>This code expires in <b>5 minutes</b>.</p></div>`
        });

        // ✅ ONLY send success – no undefined variables
        res.json({ success: true, message: 'OTP sent to email.' });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});






app.post('/api/verify-token', async (req, res) => {
    const { email, token } = req.body;
    if (!email || !token)
        return res.status(400).json({ success: false, message: 'Email and token required' });
    try {
        const [rows] = await db.query(`
            SELECT * FROM otp_verification
            WHERE contact_value=? AND otp_code=? AND expires_at > NOW()
        `, [email, token]);
        if (!rows.length)
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });
        res.json({ success: true, message: 'Code verified' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    try {
        const [rows] = await db.query(`
            SELECT * FROM otp_verification
            WHERE contact_value=? AND otp_code=? AND expires_at > NOW()
        `, [email, token]);
        if (!rows.length)
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE user_account SET password_hash=? WHERE username=?', [hashed, email]);
        await db.query('DELETE FROM otp_verification WHERE contact_value=?', [email]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    try {
        const [rows] = await db.query(`
            SELECT * FROM otp_verification
            WHERE contact_value=? AND otp_code=? AND expires_at > NOW()
        `, [email, token]);
        if (!rows.length)
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE user_account SET password_hash=? WHERE username=?', [hashed, email]);
        await db.query('DELETE FROM otp_verification WHERE contact_value=?', [email]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRATION OTP
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//  registration_routes.js
//  Paste these routes into your server.js
//  npm install nodemailer bcryptjs qrcode
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRATION OTP
// ═══════════════════════════════════════════════════════════════════════════

// ── Send OTP — Email ─────────────────────────────────────────────────────────
app.post('/api/send-registration-otp', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@'))
        return res.status(400).json({ success: false, error: 'Valid email is required.' });

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    try {
        const [existing] = await db.query(
            'SELECT user_id FROM user_account WHERE username = ? LIMIT 1', [email]
        );
        if (existing.length)
            return res.status(400).json({ success: false, error: 'This email is already registered.' });

        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'email', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [email, otp, expiresAt, otp, expiresAt]);

        await transporter.sendMail({
            from:    process.env.SMTP_USER || 'SmartOPD <bhagya0913@gmail.com>',
            to:      email,
            subject: 'SmartOPD — Your Verification Code',
            html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;text-align:center">
    <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-.02em">SmartOPD</div>
    <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">Base Hospital, Kiribathgoda</div>
  </div>
  <div style="padding:36px 40px;text-align:center">
    <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;border:3px solid #bfdbfe;font-size:28px">🔐</div>
    <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Verify your email address</h2>
    <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6">Enter the code below to complete your SmartOPD patient registration.</p>
    <div style="background:#eff6ff;border:2px dashed #93c5fd;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#1e40af;text-align:center">${otp}</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">Expires in <strong>5 minutes</strong></div>
    </div>
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;text-align:left;margin-bottom:20px">
      <p style="font-size:12px;color:#78350f;margin:0">⚠️ <strong>Never share this code</strong> with anyone. SmartOPD staff will never ask for it.</p>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin:0">If you didn't request this, you can safely ignore this email.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="font-size:11px;color:#94a3b8;margin:0">SmartOPD — Base Hospital, Kiribathgoda &nbsp;|&nbsp; For internal use only</p>
  </div>
</div>
</body></html>`
        });

        res.json({ success: true, message: 'OTP sent to email.' });
    } catch (error) {
        console.error('Send Email OTP Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send OTP.' });
    }
});








// ── Send OTP — SMS ───────────────────────────────────────────────────────────
app.post('/api/send-registration-sms-otp', async (req, res) => {
    const { phone } = req.body;
    const phoneRegex = /^(?:\+94|0)[0-9]{9}$/;
    if (!phone || !phoneRegex.test(phone))
        return res.status(400).json({ success: false, error: 'Valid Sri Lankan mobile number required.' });

    const normalizedPhone = phone.startsWith('0') ? '+94' + phone.slice(1) : phone;
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    try {
        const [existing] = await db.query(
            'SELECT patient_id FROM patient WHERE phone = ?', [normalizedPhone]
        );
        if (existing.length)
            return res.status(400).json({ success: false, error: 'This phone number is already registered.' });

        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'phone', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [normalizedPhone, otp, expiresAt, otp, expiresAt]);

        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: `Your SmartOPD registration code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to:   normalizedPhone
        });

        res.json({ success: true, message: 'OTP sent via SMS.' });
    } catch (error) {
        console.error('Send SMS OTP Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send SMS OTP.' });
    }
});







// ── Verify OTP — Email ───────────────────────────────────────────────────────
app.post('/api/verify-registration-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp)
        return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    try {
        const [rows] = await db.query(
            `SELECT * FROM otp_verification WHERE contact_value=? AND otp_code=? AND expires_at > NOW()`,
            [email, otp]
        );
        if (rows.length) res.json({ success: true, message: 'OTP verified successfully.' });
        else res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Verify OTP — SMS ─────────────────────────────────────────────────────────
app.post('/api/verify-registration-sms-otp', async (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp)
        return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    const normalizedPhone = phone.startsWith('0') ? '+94' + phone.slice(1) : phone;
    try {
        const [rows] = await db.query(
            `SELECT * FROM otp_verification WHERE contact_value=? AND otp_code=? AND expires_at > NOW()`,
            [normalizedPhone, otp]
        );
        if (rows.length) res.json({ success: true, message: 'Phone verified successfully.' });
        else res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PATIENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//  PATIENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/register', async (req, res) => {
    let connection;
    try {
        // ✅ FIX 1: was `promisePool.getConnection()` — `promisePool` is not defined.
        //           The promise pool is `db` throughout this file.
        connection = await db.getConnection();

        const { full_name, nic, dob, gender, email, phone, password } = req.body;

        // 1. Check existing user
        const [existingUser] = await connection.query(
            'SELECT * FROM user_account WHERE username = ?', [email]
        );
        if (existingUser.length > 0) {
            connection.release();
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // 2. Check OTP is valid and not expired
        // ✅ FIX 4: was `WHERE email = ?` — the column is `contact_value`
        const [otpValid] = await connection.query(
            'SELECT * FROM otp_verification WHERE contact_value = ? AND expires_at > NOW()', [email]
        );
        if (otpValid.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, message: 'Email not verified. Please request OTP.' });
        }

        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, 10);
        const barcodeValue   = `OPD-${Date.now()}`;

        // 3. Insert Patient
        const [patientResult] = await connection.query(
            'INSERT INTO patient (full_name, nic, dob, gender, email, phone, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [full_name, nic, dob, gender, email, phone, barcodeValue]
        );

        // 4. Insert User Account
        await connection.query(
            'INSERT INTO user_account (username, password_hash, patient_id) VALUES (?, ?, ?)',
            [email, hashedPassword, patientResult.insertId]
        );

        // 5. Cleanup OTP
        // ✅ FIX 4 (same column fix): was `WHERE email = ?`
        await connection.query(
            'DELETE FROM otp_verification WHERE contact_value = ?', [email]
        );

        await connection.commit();
        connection.release();

        res.status(201).json({ success: true, barcode: barcodeValue, message: 'Registered successfully!' });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});



// ═══════════════════════════════════════════════════════════════════════════
//  LOGIN
//  ✅ FIX 2: duplicate /api/login route removed — only ONE definition below
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
    const { username, password, selectedRole } = req.body;

    if (!username || !password)
        return res.status(400).json({ success: false, message: 'Email and password are required.' });

    // ── HARDCODED ADMIN BYPASS (dev/demo only — remove before production) ─────
    // NOTE: Must stay in sync with devLogins in Login.jsx
    if (username.trim() === 'admin' && password.trim() === 'admin') {
        return res.json({
            success: true,
            message: 'Login successful',
            requiresRoleSelection: false,
            user: {
                id: 1, username: 'admin', role: 'Admin', full_name: 'Administrator',
                patient_id: null, patientId: null, staff_id: null,
                availableRoles: ['Admin'],
            },
        });
    }

    try {
        // 1. Get user account
        const [users] = await db.query(
            `SELECT user_id, username, password_hash, patient_id, staff_id
             FROM user_account WHERE username = ? LIMIT 1`,
            [username.trim()]
        );
        if (!users.length)
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const account = users[0];
        const isMatch = await bcrypt.compare(password.trim(), account.password_hash);
        if (!isMatch)
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        // 2. Collect all active roles for this account
        let staffRole = null;
        let staffData = null;
        let patientData = null;
        const availableRoles = [];

        if (account.staff_id) {
            const [staffRows] = await db.query(
                `SELECT s.staff_id, s.first_name, s.surname, s.phone, s.email, s.is_active, r.role_name
                 FROM staff s
                 LEFT JOIN roles r ON s.role_id = r.role_id
                 WHERE s.staff_id = ? AND s.is_active = 1`,
                [account.staff_id]
            );
            if (staffRows.length) {
                staffData = staffRows[0];
                staffRole = staffData.role_name;
                availableRoles.push(staffRole);
            }
        }

        if (account.patient_id) {
            const [patientRows] = await db.query(
                `SELECT patient_id, barcode, full_name, nic, dob, gender, civil_status,
                        blood_group, phone, address_line1, address, emergency_contact,
                        chronic_conditions, allergies,height_cm, weight_kg,  email, is_active
                 FROM patient WHERE patient_id = ? AND is_active = 1 LIMIT 1`,
                [account.patient_id]
            );
            if (patientRows.length) {
                patientData = patientRows[0];
                availableRoles.push('Patient');
            }
        }

        if (availableRoles.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Account deactivated. Contact hospital administration.'
            });
        }

        // 3. Determine primary role
        //    FIX: Honour the client's selectedRole when the account has multiple roles,
        //         so a doctor-patient can log in as "Patient" without being overridden.
        const roleMap = {
            'patient':                'Patient',
            'doctor':                 staffRole,   // use actual DB role_name
            'receptionist':           staffRole,
            'pharmacist':             staffRole,
            'lab':                    staffRole,
            'diagnostics technician': staffRole,
            'admin':                  staffRole,
        };

        let primaryRole;

        if (availableRoles.length > 1) {
            // Multi-role account: if the client sent a valid selectedRole, use it.
            // Otherwise fall back to staff role (or patient).
            const clientRole = (selectedRole || '').toLowerCase();
            const clientRoleLabel = roleMap[clientRole];
            primaryRole = (clientRoleLabel && availableRoles.includes(clientRoleLabel))
                ? clientRoleLabel
                : (staffRole || 'Patient');
        } else {
            // Single-role account — just use whichever role exists
            primaryRole = availableRoles[0];
        }

        // 4. Build the user object
        const userObj = {
            id:             account.user_id,
            username:       account.username,
            role:           primaryRole,
            availableRoles,
            patient_id:     account.patient_id  || null,
            patientId:      account.patient_id  || null,
            staff_id:       account.staff_id    || null,
        };

        if (patientData) {
            Object.assign(userObj, {
                full_name:          patientData.full_name,
                barcode:            patientData.barcode,
                nic:                patientData.nic,
                dob:                patientData.dob,
                gender:             patientData.gender,
                civil_status:       patientData.civil_status,
                blood_group:        patientData.blood_group,
                phone:              patientData.phone,
                address_line1:      patientData.address_line1,
                address:            patientData.address,
                emergency_contact:  patientData.emergency_contact,
                chronic_conditions: patientData.chronic_conditions,
                allergies:          patientData.allergies,
                email:              patientData.email || account.username,
            });
        }

        if (staffData) {
            userObj.staff_name  = `${staffData.first_name} ${staffData.surname}`.trim();
            userObj.staff_email = staffData.email || account.username;
            userObj.staff_phone = staffData.phone;
            // Only override name/email with staff details when the user is NOT logging in as Patient
            if (!patientData || primaryRole.toLowerCase() !== 'patient') {
                userObj.full_name = userObj.staff_name;
                userObj.email     = userObj.staff_email;
                userObj.phone     = userObj.staff_phone;
            }
        }

        // FIX: Only prompt role picker when there are genuinely multiple roles
        //      AND the client did not already resolve the choice via selectedRole.
        const requiresRoleSelection = availableRoles.length > 1 && !selectedRole;

        res.json({
            success: true,
            message: 'Login successful',
            requiresRoleSelection,
            user: userObj,
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  OPD SLOTS
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//  ADD TO server.js — replace or add these routes
//  These implement:
//    • Date-only booking (no slot picker — token is FCFS)
//    • Max 60 patients/day enforced
//    • Estimated time slot auto-calculated from token number
//    • Booking confirmation email with OPD slip details
// ═══════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
//  PHARMACIST STATS
//  GET /api/pharmacist/stats
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
//  PHARMACIST ROUTES PATCH
//
//  WHAT CHANGED:
//    GET /api/pharmacist/pending-queue    — now includes s.staff_id AS doctor_staff_id
//    GET /api/pharmacist/all-prescriptions — now includes s.staff_id AS doctor_staff_id
//    GET /api/pharmacist/prescriptions-by-patient — now includes s.staff_id AS doctor_staff_id
//
//  Replace these 3 routes in your server.js.
//  Everything else (stats, fulfill-record) is unchanged.
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
//  PHARMACIST BACKEND ADDITIONS
//  Add/replace these routes in your server.js
// ═══════════════════════════════════════════════════════════════════════════


// ── Save pharmacist note on a prescription ────────────────────────────────
// POST /api/pharmacist/save-note
// Body: { record_id, note }
app.post('/api/pharmacist/save-note', async (req, res) => {
    const { record_id, note } = req.body;
    if (!record_id) return res.status(400).json({ success: false, message: 'record_id required.' });
    try {
        // Add a pharmacist_note column if you don't have one:
        // ALTER TABLE treatment_records ADD COLUMN pharmacist_note TEXT NULL;
        await db.query(
            `UPDATE treatment_records SET pharmacist_note = ? WHERE record_id = ?`,
            [note || null, record_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── GET /api/pharmacist/reports/generate ──────────────────────────────────
// Query: type, from, to
app.get('/api/pharmacist/reports/generate', async (req, res) => {
    const { type, from, to } = req.query;
    if (!type || !from || !to)
        return res.status(400).json({ success: false, message: 'type, from, and to are required.' });

    try {
        let data = { success: true };

        switch (type) {

            // ── Prescription: daily_received ─────────────────────────────
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

            // ── Prescription: dispensed ───────────────────────────────────
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

            // ── Prescription: pending ─────────────────────────────────────
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
                      AND pf.fulfillment_id IS NULL
                    ORDER BY tr.consultation_day ASC
                    LIMIT 300
                `, [from, to]);
                data = { ...data, prescriptions };
                break;
            }

            // ── Medication: most_prescribed ───────────────────────────────
            case 'most_prescribed': {
                // Try medication table first, fall back to parsing treatment_records
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
                    // Fallback if prescription table doesn't exist
                    data = { ...data, medications: [] };
                }
                break;
            }

            // ── Medication: freq_by_doctor ────────────────────────────────
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
                return res.status(400).json({ success: false, message: `Unknown report type: ${type}` });
        }

        res.json(data);

    } catch (err) {
        console.error('Pharmacy report error:', err);
        // Graceful fallback so UI can still render with empty data
        res.json({
            success: true,
            daily: [], prescriptions: [], medications: [], doctors: [],
            message: 'Partial data returned.'
        });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  FEEDBACK ROUTE FIX — column mismatch
//  The feedback table uses `date_submitted` not `submitted_at`.
//  Replace the existing GET /api/staff/feedback/:staff_id route with this:
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/staff/feedback/:staff_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                f.feedback_id,
                f.comment,
                f.admin_note,
                f.status,
                f.date_submitted,           -- correct column name
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

// ═══════════════════════════════════════════════════════════════════════════
// PHARMACIST DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /api/pharmacist/stats ─────────────────────────────────────────────
// Returns counts: pending, fulfilled today, total today
app.get('/api/pharmacist/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        // Pending: prescriptions with no fulfillment record
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
        // Fulfilled today
        const [fulfilledResult] = await db.query(`
            SELECT COUNT(*) AS fulfilled
            FROM prescription_fulfillment pf
            WHERE DATE(pf.fulfilled_at) = ?
        `, [today]);
        // Total prescriptions created today
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
                pending: pendingResult[0]?.pending || 0,
                fulfilled: fulfilledResult[0]?.fulfilled || 0,
                total: totalResult[0]?.total || 0
            }
        });
    } catch (err) {
        console.error('stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pharmacist/pending-queue ─────────────────────────────────────
// Returns list of pending prescriptions with patient & doctor info
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
            ORDER BY tr.consultation_day ASC
            LIMIT 100
        `);
        res.json(rows); // frontend expects array directly
    } catch (err) {
        console.error('pending-queue error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/pharmacist/all-prescriptions ─────────────────────────────────
// Supports ?status=pending|fulfilled|all
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

// ── GET /api/pharmacist/prescriptions-by-patient ─────────────────────────
// Searches by barcode OR NIC (term can be either)
app.get('/api/pharmacist/prescriptions-by-patient', async (req, res) => {
    const { term } = req.query;
    if (!term) return res.status(400).json({ success: false, message: 'Missing search term.' });

    try {
        // First find patient by barcode or NIC
        const [patients] = await db.query(`
            SELECT patient_id, full_name, nic, barcode, gender, dob, phone
            FROM patient
            WHERE barcode = ? OR nic = ?
            LIMIT 1
        `, [term, term]);

        if (patients.length === 0) {
            return res.json({ success: false, message: 'Patient not found.' });
        }
        const patient = patients[0];

        // Get all prescriptions for this patient
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

        res.json({
            success: true,
            patient,
            prescriptions
        });
    } catch (err) {
        console.error('prescriptions-by-patient error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/pharmacist/fulfill-record ──────────────────────────────────
// Marks an entire prescription as dispensed (creates fulfillment record)
app.post('/api/pharmacist/fulfill-record', async (req, res) => {
    const { record_id, pharmacist_id, notes } = req.body;
    if (!record_id || !pharmacist_id) {
        return res.status(400).json({ success: false, message: 'record_id and pharmacist_id required.' });
    }

    try {
        // Check if already fulfilled
        const [existing] = await db.query(
            `SELECT fulfillment_id FROM prescription_fulfillment WHERE prescription_id = ?`,
            [record_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Prescription already dispensed.' });
        }

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

// ═══════════════════════════════════════════════════════════════════════════
//  MIGRATION NOTE
//  If treatment_records doesn't have pharmacist_note column, run:
//  ALTER TABLE treatment_records ADD COLUMN pharmacist_note TEXT NULL;
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
//  LAB STATS
//  GET /api/lab/stats
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  LAB STATS
//  GET /api/lab/stats
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/lab/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [[{ pending }]]    = await db.query(
            `SELECT COUNT(*) AS pending FROM medical_tests WHERE status='requested'`
        );
        const [[{ inProgress }]] = await db.query(
            `SELECT COUNT(*) AS inProgress FROM medical_tests WHERE status='in_progress'`
        );
        const [[{ completed }]]  = await db.query(
            `SELECT COUNT(*) AS completed FROM medical_tests
             WHERE status='completed' AND DATE(updated_at) = ?`, [today]
        );
        res.json({ success: true, stats: { pending, inProgress, completed } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
//  LAB WORKLIST
//  GET /api/lab/worklist?status=requested|in_progress|completed|all
//  ENHANCED: Returns full patient details (age, gender, phone, barcode),
//            full doctor details (id, name, department),
//            and full request context (priority, clinical_notes, requested_at).
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/lab/worklist', async (req, res) => {
    const { status = 'requested' } = req.query;
    try {
        let sql = `
        SELECT
            mt.test_id,
            mt.test_type,
            mt.test_name,
            mt.status,
            mt.requested_at,
            mt.updated_at,
            mt.sample_collected_at,

            -- Patient full details
            p.patient_id,
            p.full_name   AS patient_name,
            p.nic,
            p.barcode,
            p.dob         AS patient_dob,
            p.gender      AS patient_gender,
            p.phone       AS patient_phone,

            -- Doctor full details
            s.staff_id    AS doctor_id,
            CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
            r.role_name   AS doctor_dept

        FROM medical_tests mt
        JOIN patient p ON mt.patient_id = p.patient_id
        LEFT JOIN staff  s ON mt.requested_by = s.staff_id
        LEFT JOIN roles  r ON s.role_id = r.role_id
        WHERE mt.status != 'cancelled'
    `;

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


// ─────────────────────────────────────────────────────────────────────────────
//  LAB PATIENT TESTS + APPOINTMENTS
//  GET /api/lab/patient-tests?term=XXX   (barcode or NIC)
//  ENHANCED: Returns full patient profile, all tests with complete doctor
//            and request context, plus appointment history.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/lab/patient-tests', async (req, res) => {
    const { term } = req.query;
    if (!term) return res.status(400).json({ success: false, message: 'Search term required.' });
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


// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE TEST STATUS
//  POST /api/lab/update-status
//  Body: { test_id, status, technician_id }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/lab/update-status', async (req, res) => {
    const { test_id, status, technician_id } = req.body;
    if (!test_id || !status)
        return res.status(400).json({ success: false, message: 'test_id and status required.' });

    const allowed = ['in_progress', 'completed', 'cancelled'];
    if (!allowed.includes(status))
        return res.status(400).json({ success: false, message: 'Invalid status.' });

    try {
        if (status === 'in_progress') {
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


// ─────────────────────────────────────────────────────────────────────────────
//  UPLOAD / SUBMIT TEST RESULT
//  POST /api/lab/upload-result  (multipart/form-data)
//  Fields: test_id, summary (required), remarks (optional), uploaded_by,
//          result_file (optional binary)
//
//  NOTES FIELD IS OPTIONAL — system allows submission without remarks.
//
//  Setup multer in server.js if not already done:
//    const multer = require('multer');
//    const storage = multer.diskStorage({
//        destination: 'uploads/lab/',
//        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
//    });
//    const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
//    Then change the route to:
//    app.post('/api/lab/upload-result', upload.single('result_file'), async (req, res) => { ... });
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/lab/upload-result',
    // upload.single('result_file'),   // Uncomment after multer setup
    async (req, res) => {
        const { test_id, summary, remarks, uploaded_by } = req.body;

        if (!test_id)
            return res.status(400).json({ success: false, message: 'test_id is required.' });
        if (!summary?.trim())
            return res.status(400).json({ success: false, message: 'Findings/summary is required.' });

        try {
            const filePath = req.file ? req.file.path : null;

            // Upsert result (replace if already exists for this test)
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
                remarks?.trim() || null,   // remarks is optional — stored as NULL if omitted
                filePath,
                uploaded_by || null,
            ]);

            // Mark test as completed
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


// ─────────────────────────────────────────────────────────────────────────────
//  STAFF FEEDBACK — Submit
//  POST /api/staff/feedback
// ─────────────────────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────────────────────
//  STAFF FEEDBACK — History
//  GET /api/staff/feedback/:staffId
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/staff/feedback/:staffId', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT feedback_id, comment, status, admin_note, submitted_at
             FROM staff_feedback
             WHERE staff_id = ?
             ORDER BY submitted_at DESC LIMIT 50`,
            [req.params.staffId]
        );
        res.json({ success: true, feedback: rows });
    } catch (err) {
        console.error('Staff feedback get error:', err);
        res.json({ success: true, feedback: [] });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DOCTOR ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//  DOCTOR ROUTES — paste these into your server.js
//  after your existing doctor routes block.
//
//  Endpoints provided:
//    GET  /api/doctor/patient-lookup        (NIC / barcode search)
//    GET  /api/doctor/today-queue           (today's appointments + stats)
//    GET  /api/doctor/appointments-by-date  (single date filter)
//    GET  /api/doctor/appointments-by-range (date range filter)
//    GET  /api/doctor/patient-appointments/:patientId
//    GET  /api/doctor/patient-history/:patientId  (returns weight/height too)
//    POST /api/doctor/treatment-record      (saves with NOW() + doctor id)
//    POST /api/doctor/order-tests           (Lab/Imaging/ECG + Routine/Emergency)
//    POST /api/doctor/referral
//    POST /api/doctor/lab-findings
//    POST /api/doctor/update-profile
//    POST /api/doctor/change-password
//    GET  /api/staff/notifications/:staffId
//    GET  /api/staff/feedback/:staffId
//    POST /api/staff/feedback
// ═══════════════════════════════════════════════════════════════════════════


// ── 1. Patient Lookup ─────────────────────────────────────────────────────────
// GET /api/doctor/patient-lookup?mode=barcode|nic&q=<value>
app.get('/api/doctor/patient-lookup', async (req, res) => {
    const { mode, q } = req.query;
    if (!mode || !q)
        return res.status(400).json({ success: false, message: 'mode and q required' });

    const cols = `patient_id, barcode, full_name, nic, dob, gender, blood_group,
                  phone, allergies, chronic_conditions, address_line1, address,
                  emergency_contact, civil_status, height_cm, weight_kg`;

    try {
        let rows = [];

        if (mode === 'barcode') {
            // Barcode search: exact match, return single patient
            [rows] = await db.query(
                `SELECT ${cols} FROM patient WHERE barcode = ? AND is_active = 1 LIMIT 1`,
                [q.trim()]
            );
        } else {
            // NIC search: find patient(s) with this NIC, then also include their family members
            const [patients] = await db.query(
                `SELECT ${cols} FROM patient WHERE nic = ? AND is_active = 1 ORDER BY patient_id ASC`,
                [q.trim()]
            );

            if (patients.length === 0) {
                rows = [];
            } else {
                // Usually one patient, but loop in case of multiple (though NIC should be unique)
                const allPatients = [];

                for (const patient of patients) {
                    // Add the patient itself with relation 'Self'
                    allPatients.push({ ...patient, relation: 'Self' });

                    // Find family members linked to this patient (primary account holder)
                    const [members] = await db.query(`
                        SELECT p.patient_id, p.barcode, p.full_name, p.nic, p.dob, p.gender,
                               p.blood_group, p.phone, p.allergies, p.chronic_conditions,
                               p.address_line1, p.address, p.emergency_contact, p.civil_status, p.height_cm, p.weight_kg,
                               pf.relation
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


// ── 2. Today's queue (used for stat cards + default table view) ───────────────
// GET /api/doctor/today-queue
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
            ORDER BY a.queue_no ASC
        `, [today]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── 3. Appointments by a single date ─────────────────────────────────────────
// GET /api/doctor/appointments-by-date?date=YYYY-MM-DD
app.get('/api/doctor/appointments-by-date', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date required' });
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
            ORDER BY a.queue_no ASC
        `, [date]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── 4. Appointments by date range ─────────────────────────────────────────────
// GET /api/doctor/appointments-by-range?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/doctor/appointments-by-range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, message: 'from and to are required' });
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
            WHERE a.appointment_day BETWEEN ? AND ?
            ORDER BY a.appointment_day ASC, a.queue_no ASC
        `, [from, to]);
        res.json({ success: true, queue: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── 5. Patient's own appointments (for consultation appointment selector) ──────
// GET /api/doctor/patient-appointments/:patientId
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


// ── 6. Patient treatment history (includes latest weight/height) ───────────────
// GET /api/doctor/patient-history/:patientId
// Used by PatientLookup to fetch the most recent vitals for the health card
app.get('/api/doctor/patient-history/:patientId', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                tr.record_id,
                tr.consultation_day,      -- stored as datetime via NOW()
                tr.chief_complaint,
                tr.clinical_findings,
                tr.diagnosis,
                tr.treatment_details,
                tr.prescription_details,
                tr.weight_kg,
                tr.height_cm,
                tr.follow_up_date,
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


// ── 7. Save treatment record ──────────────────────────────────────────────────
// POST /api/doctor/treatment-record
// consultation_day stored as NOW() (full datetime).
// follow_up_date removed from UI but column still accepts null.
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

        // Mark appointment as completed
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


// ── 8. Order diagnostic tests ─────────────────────────────────────────────────
// POST /api/doctor/order-tests
// test_type: 'Lab' | 'Imaging' | 'ECG'
// priority:  'Routine' | 'Emergency'
// (specimen and clinical_info removed from UI — not passed)
   


    // ── 9. Issue referral ─────────────────────────────────────────────────────────
    // POST /api/doctor/referral
    // referral_date stored as NOW() for full datetime
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
                appointment_id,
                patient_id,
                staff_id,
                target_clinic,
                consultant_name  || null,
                urgency          || 'Routine',
                reason
            ]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });



    // FIX: now saves clinical_notes per test (uses existing column in medical_tests)
    app.post('/api/doctor/order-tests', async (req, res) => {
        const { appointment_id, patient_id, staff_id, tests } = req.body;
        if (!appointment_id || !patient_id || !staff_id || !Array.isArray(tests) || !tests.length)
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
    
        try {
            const insertions = tests
                .filter(t => t.test_name?.trim())
                .map(t => db.query(
                    `INSERT INTO medical_tests
                        (appointment_id, patient_id, test_type, test_name, status, requested_by, clinical_notes, requested_at)
                    VALUES (?, ?, ?, ?, 'requested', ?, ?, NOW())`,
                    [
                        appointment_id,
                        patient_id,
                        t.test_type     || 'Lab',
                        t.test_name.trim(),
                        staff_id,
                        t.clinical_notes?.trim() || null,   // ← doctor's notes sent at order time
                    ]
                ));
    
            await Promise.all(insertions);
            res.json({ success: true });
        } catch (err) {
            console.error('order-tests error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });
    
    
    // ── POST /api/doctor/lab-findings ─────────────────────────────────────────────
    // FIX: uses clinical_notes column (already exists in medical_tests table).
    // The previous version referenced a non-existent 'doctor_findings' column.
    // No migration needed — clinical_notes TEXT already exists.
    app.post('/api/doctor/lab-findings', async (req, res) => {
        const { test_id, patient_id, clinical_notes } = req.body;
    
        // Accept both field names for backwards compat (old code sent doctor_findings)
        const notes = clinical_notes || req.body.doctor_findings;
    
        if (!test_id || !notes?.trim())
            return res.status(400).json({ success: false, message: 'test_id and clinical notes are required.' });
    
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
    
    
    // ── GET /api/lab-results/:patientId ──────────────────────────────────────────
    // UPDATE: now includes clinical_notes in the response so the frontend can show it
    app.get('/api/lab-results/:patientId', async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT
                    mt.test_id, mt.appointment_id, mt.patient_id,
                    mt.test_type, mt.test_name, mt.status,
                    mt.requested_by, mt.requested_at, mt.sample_collected_at,
                    mt.clinical_notes,                          -- ← included now
                    CONCAT(s.first_name, ' ', s.surname) AS doctor_name,
                    tr.result_id, tr.summary AS result_summary,
                    tr.file_path, tr.uploaded_at AS result_uploaded_at
                FROM medical_tests mt
                LEFT JOIN staff s     ON mt.requested_by = s.staff_id
                LEFT JOIN test_results tr ON tr.test_id  = mt.test_id
                WHERE mt.patient_id = ?
                ORDER BY mt.test_id DESC
            `, [req.params.patientId]);
            res.json({ success: true, tests: rows });
        } catch (err) {
            console.error('lab-results error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });
    
    


// ── 11. Update doctor profile ─────────────────────────────────────────────────
app.post('/api/doctor/update-profile', async (req, res) => {
    const { staff_id, first_name, surname, phone } = req.body;
    if (!staff_id) return res.status(400).json({ success: false, message: 'staff_id required.' });
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


// ── 12. Change password ───────────────────────────────────────────────────────
app.post('/api/doctor/change-password', async (req, res) => {
    const { staff_id, current, next } = req.body;
    if (!staff_id || !current || !next)
        return res.status(400).json({ success: false, message: 'All fields required.' });
    try {
        const [[account]] = await db.query(
            'SELECT password_hash FROM user_account WHERE staff_id=? LIMIT 1',
            [staff_id]
        );
        if (!account) return res.json({ success: false, message: 'Account not found.' });
        const ok = await bcrypt.compare(current, account.password_hash);
        if (!ok) return res.json({ success: false, message: 'Current password is incorrect.' });
        const hash = await bcrypt.hash(next, 10);
        await db.query('UPDATE user_account SET password_hash=? WHERE staff_id=?', [hash, staff_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── 13. Staff notifications ───────────────────────────────────────────────────
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


// ── 14. Get staff feedback ────────────────────────────────────────────────────
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
        res.json({ success: true, feedback: [] });
    }
});


// ── 15. Submit staff feedback ─────────────────────────────────────────────────
app.post('/api/staff/feedback', async (req, res) => {
    const { staff_id, comment } = req.body;
    if (!staff_id || !comment?.trim())
        return res.status(400).json({ success: false, message: 'staff_id and comment required.' });
    try {
        // Get user_id for this staff member
        const [[ua]] = await db.query(
            'SELECT user_id FROM user_account WHERE staff_id=? LIMIT 1',
            [staff_id]
        );
        if (!ua) return res.json({ success: false, message: 'User account not found.' });

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


// ═══════════════════════════════════════════════════════════════════════════
//  ONE-TIME MIGRATION — run this SQL once in your MySQL client
//  to add the doctor_findings column if it doesn't exist yet:
//
//  ALTER TABLE medical_tests
//    ADD COLUMN doctor_findings TEXT NULL AFTER clinical_notes;
//
// ═══════════════════════════════════════════════════════════════════════════

//═════════════════════════════════════
//  BACKEND API ADDITIONS — Add these routes to your existing server file
//  Place these AFTER the existing routes (before app.listen)
// ══════════════════════════════════════════════════════════════════════════════





// ══════════════════════════════════════════════════════════════════════════════
//  NOTE ON DATABASE COLUMN: patient.is_active
//  If your patient table doesn't have is_active, run this migration:
//
//  ALTER TABLE patient ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
//
//  NOTE ON DATABASE COLUMN: patient.created_at
//  If missing:
//  ALTER TABLE patient ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
//  BACKEND API ADDITIONS — Add these routes to your existing server file
//  Place these AFTER the existing routes (before app.listen)
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Check if email already exists (patient or staff)
// GET /api/admin/check-email?email=xxx
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
//  PATIENT DASHBOARD — ALL ROUTES
//  Replace your existing patient routes block with this entire file.
//  Works with the updated PatientDashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════

// ── Helper: barcode generator ─────────────────────────────────────────────────
function generateBarcode() {
    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BHK-${ts}-${rnd}`;
}

// ── Helper: estimated time from token number ──────────────────────────────────
async function calcEstimatedTime(tokenNo) {
    try {
        const [rows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','slot_duration_minutes')`
        );
        const cfg = {};
        rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
        const startHour   = parseInt(cfg.opd_start_hour)        || 8;
        const slotMinutes = parseInt(cfg.slot_duration_minutes) || 10;
        const startTotal  = startHour * 60 + (tokenNo - 1) * slotMinutes;
        const endTotal    = startTotal + slotMinutes;
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


// ═══════════════════════════════════════════════════════════════════════════
//  OPD SLOTS — capacity check (date-only mode, no individual slot picker)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/opd-slots', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date required' });
    try {
        const [settingRows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','opd_end_hour','slot_capacity','closed_dates','slot_duration_minutes')`
        );
        const cfg = {};
        settingRows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

        const closedDates = (cfg.closed_dates || '').split(',').map(s => s.trim()).filter(Boolean);
        if (closedDates.includes(date))
            return res.json({ success: true, slots: [], closed: true });

        const [[{ booked }]] = await db.query(
            `SELECT COUNT(*) AS booked FROM appointments
             WHERE appointment_day=? AND status NOT IN ('cancelled','no_show')`,
            [date]
        );

        const MAX_PER_DAY = 60;
        const remaining   = Math.max(0, MAX_PER_DAY - parseInt(booked));

        res.json({
            success:   true,
            closed:    false,
            booked:    parseInt(booked),
            remaining,
            capacity:  MAX_PER_DAY,
            slots: [{ time_slot: 'All Day (FCFS)', capacity: MAX_PER_DAY, booked: parseInt(booked), remaining }]
        });
    } catch (err) {
        console.error('OPD slots error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  BOOK APPOINTMENT
//  Date-only · FCFS token · 60/day max · auto-calculated time slot · email
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/book-appointment', async (req, res) => {
    const { patientId, date, visitType = 'New' } = req.body;
    if (!patientId || !date)
        return res.status(400).json({ success: false, message: 'patientId and date are required.' });

    try {
        // 1. Closed date check
        const [settingRows] = await db.query(
            `SELECT setting_value FROM system_settings WHERE setting_key='closed_dates'`
        );
        const closedDates = (settingRows[0]?.setting_value || '').split(',').map(s => s.trim()).filter(Boolean);
        if (closedDates.includes(date))
            return res.json({ success: false, message: 'OPD is closed on this date.' });

        // 2. Daily cap check (max 60)
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM appointments
             WHERE appointment_day=? AND status NOT IN ('cancelled','no_show')`,
            [date]
        );
        const MAX_PER_DAY = 60;
        if (parseInt(total) >= MAX_PER_DAY)
            return res.json({ success: false, message: `This date is fully booked (${MAX_PER_DAY}/day limit). Please choose another date.` });

        // 3. Duplicate booking check
        const [dupes] = await db.query(
            `SELECT appointment_id FROM appointments
             WHERE patient_id=? AND appointment_day=? AND status NOT IN ('cancelled','no_show') LIMIT 1`,
            [patientId, date]
        );
        if (dupes.length)
            return res.json({ success: false, message: 'You already have an appointment on this date.' });

        // 4. Assign FCFS token
        const tokenNo = parseInt(total) + 1;

        // 5. Calculate start/end time from token position
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
        const toTimeStr = (mins) =>
            `${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}:00`;

        const startTime = toTimeStr(startTotalMin);
        const endTime   = toTimeStr(endTotalMin);

        // 6. Insert appointment
        const [result] = await db.query(
            `INSERT INTO appointments
                (patient_id, appointment_day, start_time, end_time, queue_no, visit_type, status, is_present, created_at)
             VALUES (?,?,?,?,?,?,'booked',0,NOW())`,
            [patientId, date, startTime, endTime, tokenNo, visitType]
        );
        const appointmentId = result.insertId;

        // 7. Human-readable estimated time
        const estimatedTime = await calcEstimatedTime(tokenNo);

        // 8. Send confirmation email (non-blocking — never crashes the response)
        sendBookingEmail(patientId, appointmentId, date, tokenNo, estimatedTime, visitType).catch(console.error);

        res.json({ success: true, tokenNo, appointmentId, estimatedTime });

    } catch (err) {
        console.error('Book appointment error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  BOOKING CONFIRMATION EMAIL
// ═══════════════════════════════════════════════════════════════════════════
async function sendBookingEmail(patientId, appointmentId, date, tokenNo, estimatedTime, visitType) {
    try {
        const [pRows] = await db.query(
            `SELECT full_name, email, barcode, nic FROM patient WHERE patient_id=? LIMIT 1`,
            [patientId]
        );
        if (!pRows.length || !pRows[0].email) return;
        const { full_name, email, barcode, nic } = pRows[0];

        const formattedDate = new Date(date).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const rows = [
            ['Date',            formattedDate],
            ['Estimated Time',  estimatedTime || 'Determined on arrival'],
            ['Token Number',    `#${tokenNo}`],
            ['Visit Type',      visitType],
            ['Patient Barcode', barcode || '—'],
            ['NIC',             nic     || '—'],
        ];

        const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <div style="background:#0f172a;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:34px;height:34px;background:#2563eb;border-radius:8px;font-size:20px;font-weight:900;color:white;display:flex;align-items:center;justify-content:center;">+</div>
      <div>
        <div style="color:white;font-size:11px;font-weight:700;letter-spacing:.5px;">BASE HOSPITAL, KIRIBATHGODA</div>
        <div style="color:#475569;font-size:9px;margin-top:1px;">Base Hospital, Kiribathgoda· Sri Lanka</div>
      </div>
    </div>
    <div style="color:#22c55e;font-size:10px;font-weight:700;letter-spacing:1px;">✓ APPOINTMENT CONFIRMED</div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,#2563eb,#7c3aed);"></div>

  <div style="background:#eff6ff;padding:28px 28px 20px;text-align:center;border-bottom:1px solid #dbeafe;">
    <div style="font-size:11px;color:#3b82f6;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Your Queue Token</div>
    <div style="font-size:72px;font-weight:900;color:#1e40af;line-height:1;letter-spacing:-3px;">#${tokenNo}</div>
    <div style="font-size:11px;color:#3b82f6;margin-top:8px;">First Come, First Served · OPD System</div>
  </div>

  <div style="padding:24px 28px;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px;">Dear ${full_name},</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:20px;line-height:1.6;">Your OPD appointment has been confirmed. Please arrive on time and present this email at the nursing station.</div>

    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
      ${rows.map(([l,v],i) => `
      <div style="padding:10px 16px;background:${i%2===0?'#f8fafc':'white'};border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:#64748b;font-weight:600;">${l}</span>
        <span style="font-size:12px;color:#0f172a;font-weight:700;">${v}</span>
      </div>`).join('')}
    </div>

    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:8px;">
      <div style="font-size:11px;color:#78350f;font-weight:700;margin-bottom:5px;">ℹ️ Important Instructions</div>
      <ul style="font-size:11px;color:#92400e;margin:0;padding-left:16px;line-height:1.9;">
        <li>Arrive at least 10 minutes before your estimated time.</li>
        <li>Bring this email or your patient barcode card to the OPD counter.</li>
        <li>Bring all previous medical records and reports.</li>
        <li>Your actual call time may vary depending on earlier patients.</li>
      </ul>
    </div>
  </div>

  <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;text-align:center;">
    <div style="font-size:10px;color:#94a3b8;">SmartOPD · Base Hospital, Kiribathgoda · Ministry of Health, Sri Lanka</div>
    <div style="font-size:9px;color:#cbd5e1;margin-top:3px;">This is an automated email. Please do not reply.</div>
  </div>
</div>
</body></html>`;

        await transporter.sendMail({
            from:    process.env.SMTP_USER || 'SmartOPD <bhagya0913@gmail.com>',
            to:      email,
            subject: `✓ OPD Appointment Confirmed — Token #${tokenNo} · ${date}`,
            html
        });

        // Log to notifications table (fail silently if table doesn't exist)
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


// ═══════════════════════════════════════════════════════════════════════════
//  MY APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/my-appointments', async (req, res) => {
    const { patientId } = req.query;
    if (!patientId) return res.status(400).json({ success: false, message: 'patientId required' });
    try {
        const [rows] = await db.query(`
            SELECT appointment_id, patient_id, doctor_id, appointment_day,
                   start_time, end_time, queue_no, visit_type, status, is_present,
                   created_at, completed_at,
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


// ═══════════════════════════════════════════════════════════════════════════
//  CANCEL APPOINTMENT
// ═══════════════════════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════════════════════
//  MEDICAL RECORDS  (clinical history / treatment records)
// ═══════════════════════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════════════════════
//  PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════
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
              AND TRIM(tr.prescription_details) != ''
            ORDER BY tr.consultation_day DESC, tr.record_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, prescriptions: rows });
    } catch (err) {
        console.error('prescriptions error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  LAB / DIAGNOSTIC TESTS
// ═══════════════════════════════════════════════════════════════════════════
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
            LEFT JOIN staff s     ON mt.requested_by = s.staff_id
            LEFT JOIN test_results tr ON tr.test_id  = mt.test_id
            WHERE mt.patient_id = ?
            ORDER BY mt.test_id DESC
        `, [req.params.patientId]);
        res.json({ success: true, tests: rows });
    } catch (err) {
        console.error('lab-results error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  LAB TEST FILE DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/test-file/:testId', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT file_path FROM test_results WHERE test_id=? LIMIT 1`,
            [req.params.testId]
        );
        if (!rows.length)
            return res.status(404).json({ message: 'File not found.' });
        const filePath = rows[0].file_path;
        if (!fs.existsSync(filePath))
            return res.status(404).json({ message: 'File missing on server.' });
        res.download(filePath, path.basename(filePath));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  REFERRALS
// ═══════════════════════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
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
        // ── FIX: if notifications table doesn't exist yet, return empty rather than crashing
        console.warn('notifications fetch error (table may not exist yet):', err.message);
        res.json({ success: true, notifications: [] });
    }
});


// ═══════════════════════════════════════════════════════════════════════════
//  UPDATE PROFILE
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/update-profile', async (req, res) => {
    const {
        patientId, full_name, nic, dob, gender, civil_status, blood_group,
        phone, address_line1, address, emergency_contact, chronic_conditions, allergies, height_cm, weight_kg
    } = req.body;

    if (!patientId)
        return res.status(400).json({ success: false, message: 'patientId required' });

    try {
        // Keep both address columns in sync; prefer address_line1 if both supplied
        const addr = address_line1 || address || null;

        const [result] = await db.query(`
            UPDATE patient
            SET full_name=?, nic=?, dob=?, gender=?, civil_status=?, blood_group=?,
                phone=?, address_line1=?, address=?,
                emergency_contact=?, chronic_conditions=?, allergies=?,  height_cm=?, weight_kg=?
            WHERE patient_id=?
        `, [
            full_name          || null,
            nic                || null,
            dob                || null,
            gender             || null,
            civil_status       || null,
            blood_group        || null,
            phone              || null,
            addr, addr,
            emergency_contact  || null,
            chronic_conditions || null,
            allergies          || null,
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


// ═══════════════════════════════════════════════════════════════════════════
//  FEEDBACK
//  FIX: removed `rating` as required field — dashboard sends null for rating
// ═══════════════════════════════════════════════════════════════════════════
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
        // Fail silently — feedback table may not exist in all deployments
        console.warn('feedback fetch error:', err.message);
        res.json({ success: true, feedback: [] });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { patientId, rating, comment } = req.body;

    // ── FIX: was `if (!patientId || !rating)` — rating can legitimately be null/0
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


// ═══════════════════════════════════════════════════════════════════════════
//  FAMILY MEMBERS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/family-members?email=xxx
app.get('/api/family-members', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'email required' });
    try {
        const [uRows] = await db.query(
            `SELECT patient_id FROM user_account
             WHERE username=? AND patient_id IS NOT NULL LIMIT 1`,
            [email]
        );
        if (!uRows.length) return res.json({ success: true, members: [] });
        const primaryId = uRows[0].patient_id;

        const cols = `patient_id, barcode, full_name, nic, dob, gender, civil_status,
                      blood_group, phone, address_line1, address, emergency_contact,
                      chronic_conditions, allergies, email, is_active`;

        const [primaryRows] = await db.query(
            `SELECT ${cols} FROM patient WHERE patient_id=? AND is_active=1`, [primaryId]
        );
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
        res.json({ success: true, members: [...primaryRows, ...familyRows] });
    } catch (err) {
        console.error('family-members error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/add-family-member
app.post('/api/add-family-member', async (req, res) => {
    const { email, full_name, dob, gender, relation, nic, phone } = req.body;
    if (!email || !full_name || !dob || !gender)
        return res.status(400).json({ success: false, message: 'Full name, DOB and gender are required.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

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

        if (nic && nic.trim()) {
            const [existNic] = await conn.query(
                `SELECT patient_id FROM patient WHERE nic=? LIMIT 1`, [nic.trim()]
            );
            if (existNic.length) {
                await conn.rollback(); conn.release();
                return res.json({ success: false, message: 'A patient with this NIC is already registered.' });
            }
        }

        const normalizedPhone = phone?.trim()
            ? (phone.trim().startsWith('0') ? '+94' + phone.trim().slice(1) : phone.trim())
            : null;

        const barcode = generateBarcode();
        const [result] = await conn.query(
            `INSERT INTO patient (barcode, full_name, dob, gender, nic, phone, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [barcode, full_name.trim(), dob, gender, nic?.trim() || null, normalizedPhone]
        );
        const newPatientId = result.insertId;

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
        conn.release();
    }
});

// DELETE /api/remove-family-member
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
        if (parseInt(memberPatientId) === parseInt(primaryId))
            return res.status(400).json({ success: false, message: 'Cannot remove the primary account.' });

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


// ═══════════════════════════════════════════════════════════════════════════
//  DB SEED — run once to ensure system_settings rows exist
//  You can paste this directly into MySQL / phpMyAdmin
// ═══════════════════════════════════════════════════════════════════════════
/*
INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('opd_start_hour',        '8'),
  ('opd_end_hour',          '18'),
  ('slot_duration_minutes', '10'),
  ('closed_dates',          '');
*/
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Add new staff member (with professional email & password)
// POST /api/admin/add-staff
// Body: { staffId?, firstName, surname, email, phone, nic, roleName }
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Check if email already exists (in user_account, patient, or staff)
// GET /api/admin/check-email?email=xxx
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get all staff (with role names)
// GET /api/admin/staff
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/staff', async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Add new staff member (with professional email & temp password)
// POST /api/admin/add-staff
// Body: { staffId?, firstName, surname, email, phone, nic, roleName }
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/check-email?email=xxx
// Returns: { hasPatientAccount, hasStaffAccount, existingRole }
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/check-email', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });

    try {
        // Single source of truth: user_account.username holds the login email
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
            return res.json({
                success: true,
                hasPatientAccount: false,
                hasStaffAccount:   false,
                scenario:          'A',          // Brand new person
                message:           'No existing account. A new staff account will be created.'
            });
        }

        const u = userRows[0];

        if (u.staff_id) {
            // Already a staff member — reject
            return res.json({
                success: true,
                hasPatientAccount: !!u.patient_id,
                hasStaffAccount:   true,
                scenario:          'C',          // Already staff — will be rejected
                existingRole:      u.role_name,
                staffName:         u.staff_name,
                message:           `This email is already registered as ${u.role_name} (${u.staff_name}). Cannot register again.`
            });
        }

        if (u.patient_id) {
            // Existing patient — will be promoted to dual-role
            return res.json({
                success: true,
                hasPatientAccount: true,
                hasStaffAccount:   false,
                scenario:          'B',          // Patient → also Staff
                patientName:       u.patient_name,
                message:           `Patient account found for ${u.patient_name}. Staff role will be added to their existing login. No new password needed.`
            });
        }

        // Edge case: user_account exists but has neither patient_id nor staff_id
        return res.json({
            success: true,
            hasPatientAccount: false,
            hasStaffAccount:   false,
            scenario:          'A',
            message:           'Orphaned account found. A new staff entry will be created and linked.'
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/add-staff
// Body: { staffId?, firstName, surname, email, phone, nic, roleName }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/admin/add-staff', async (req, res) => {
    const { staffId, firstName, surname, email, phone, nic, roleName } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!firstName || !surname || !email || !nic || !roleName) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (!/^([0-9]{9}[xXvV]|[0-9]{12})$/.test(nic)) {
        return res.status(400).json({ success: false, message: 'Invalid NIC format.' });
    }

    const normalizedPhone = phone?.trim()
        ? (phone.trim().startsWith('0') ? '+94' + phone.trim().slice(1) : phone.trim())
        : null;

    // Map role names to role_id — adjust these to match your roles table
    const roleMap = { Doctor: 1, Pharmacist: 2, Receptionist: 3, 'Diagnostic Technician': 4, Admin: 5 };
    const roleId  = roleMap[roleName];
    if (!roleId) {
        return res.status(400).json({ success: false, message: `Unknown role: ${roleName}` });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // ── Check for existing user_account ─────────────────────────────────
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

        // ── SCENARIO C: already registered as staff — hard reject ────────────
        if (existingUser.length && existingUser[0].staff_id) {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: `This email is already registered as ${existingUser[0].existing_role} `
                       + `(${existingUser[0].existing_staff_name}). `
                       + `A staff member cannot be registered twice.`
            });
        }

        // ── Check NIC uniqueness in staff table ──────────────────────────────
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

        // ── Insert into staff table ──────────────────────────────────────────
        let newStaffId;
        const manualId = staffId?.trim() ? parseInt(staffId.trim()) : null;

        if (manualId) {
            // Check manual ID not already taken
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

        // ── SCENARIO A: Brand new person — create user_account ───────────────
        let isScenarioB = false;
        let tempPassword = null;

        if (!existingUser.length) {
            // Generate temp password and hash it
            tempPassword = Math.random().toString(36).slice(-6).toUpperCase()
                         + Math.random().toString(36).slice(-4)
                         + 'A1!';
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            await conn.query(
                `INSERT INTO user_account (username, password_hash, staff_id, patient_id)
                 VALUES (?, ?, ?, NULL)`,
                [email, hashedPassword, newStaffId]
            );

        } else {
            // ── SCENARIO B: Existing patient → add staff_id to their account ─
            isScenarioB = true;
            await conn.query(
                `UPDATE user_account SET staff_id = ? WHERE user_id = ?`,
                [newStaffId, existingUser[0].user_id]
            );
            // patient_id stays — they can still log in as a patient too
        }

        await conn.commit();

        // ── Send appropriate email ───────────────────────────────────────────
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000/login';

        const emailHtml = isScenarioB
            // Scenario B email: no password, just notify of new access
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

            // Scenario A email: include temp password
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
            success:   true,
            scenario:  isScenarioB ? 'B' : 'A',
            staffId:   newStaffId,
            message:   `${firstName} ${surname} registered as ${roleName}. `
                     + `(${scenarioLabel}) Notification sent to ${email}.`
        });

    } catch (err) {
        await conn.rollback();
        console.error('Add staff error:', err);

        // Friendly duplicate key message
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Deactivate staff member (soft delete)
// DELETE /api/admin/remove-staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Deactivate staff member (soft delete)
// DELETE /api/admin/remove-staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/admin/remove-staff/:staffId', async (req, res) => {
    const staffId = req.params.staffId;
    try {
        const [result] = await db.query(`UPDATE staff SET is_active = 0 WHERE staff_id = ?`, [staffId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Staff not found.' });
        }
        res.json({ success: true, message: 'Staff deactivated.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Reactivate staff member
// PATCH /api/admin/reactivate-staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────
app.patch('/api/admin/reactivate-staff/:staffId', async (req, res) => {
    const staffId = req.params.staffId;
    console.log(`Reactivating staff ID: ${staffId}`);
    try {
        const [result] = await db.query(`UPDATE staff SET is_active = 1 WHERE staff_id = ?`, [staffId]);
        console.log(`Rows affected: ${result.affectedRows}`);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Staff not found.' });
        }
        res.json({ success: true, message: 'Staff reactivated.' });
    } catch (err) {
        console.error('Reactivation error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Deactivate staff member (soft delete)
// DELETE /api/admin/remove-staff/:staffId
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get all staff (with roles)
// GET /api/admin/staff
// ─────────────────────────────────────────────────────────────────────────────

// ── Get all patients (admin view) ─────────────────────────────────────────────
app.get('/api/admin/patients', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
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

app.get('/api/admin/dashboard-stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [[apptRow]] = await db.query(
            `SELECT COUNT(*) AS todayAppts FROM appointments WHERE appointment_day = ?`, [today]);
        const [[pendingRow]] = await db.query(
            `SELECT COUNT(*) AS pendingAppts FROM appointments WHERE status = 'booked'`);
        const [[staffRow]] = await db.query(
            `SELECT COUNT(*) AS totalStaff FROM staff WHERE is_active = 1`);
        let opdHours = '—';
        try {
            const [[s]] = await db.query(
                `SELECT setting_value FROM system_settings WHERE setting_key='opd_start_hour' LIMIT 1`);
            const [[e]] = await db.query(
                `SELECT setting_value FROM system_settings WHERE setting_key='opd_end_hour' LIMIT 1`);
            if (s && e) opdHours = `${String(s.setting_value).padStart(2,'0')}:00 – ${String(e.setting_value).padStart(2,'0')}:00`;
        } catch (_) { opdHours = '08:00 – 18:00'; }
        res.json({ success: true, stats: {
            todayAppts: apptRow.todayAppts,
            pendingAppts: pendingRow.pendingAppts,
            totalStaff: staffRow.totalStaff,
            opdHours
        }});
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Toggle patient record status (disable / re-enable) ────────────────────────
// PATCH /api/admin/patient-status/:id
// Body: { is_active: 0|1, reason: string }
app.patch('/api/admin/patient-status/:id', async (req, res) => {
    const { is_active, reason } = req.body;
    const patientId = req.params.id;
    try {
        await db.query(`UPDATE patient SET is_active = ? WHERE patient_id = ?`, [is_active, patientId]);
        try {
            const action = is_active ? 'REACTIVATED' : ('DISABLED' + (reason ? ' - ' + reason : ''));
            await db.query(
                `INSERT INTO audit_log (table_name, action, record_id, changed_by, changed_at)
                 VALUES ('patient', ?, ?, 'admin', NOW())`,
                [action.slice(0, 200), patientId]   // Parameterized — safe
            );
        } catch (_) {}
        res.json({ success: true, message: `Patient record ${is_active ? 'reactivated' : 'disabled'}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── Patient-specific report data ──────────────────────────────────────────────
// GET /api/admin/patient-report/:id?type=patient_history|patient_prescriptions|patient_lab_tests
app.get('/api/admin/patient-report/:id', async (req, res) => {
    const patientId = req.params.id;
    const type = req.query.type || 'patient_history';

    try {
        if (type === 'patient_history') {
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


// ══════════════════════════════════════════════════════════════════════════════
//  REPORT GENERATOR — Main endpoint for all 14 report types
//  GET /api/admin/reports/generate?type=<id>&from=<date>&to=<date>
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/admin/reports/generate', async (req, res) => {
    const { type, from, to } = req.query;
    if (!type || !from || !to) {
        return res.status(400).json({ success: false, message: 'type, from, and to are required.' });
    }

    try {
        let data = { success: true };

        switch (type) {

            // ── Operational ────────────────────────────────────────────────
            case 'opd_patient_count': {
                const [daily] = await db.query(`
                    SELECT appointment_day AS date, COUNT(DISTINCT patient_id) AS count
                    FROM appointments
                    WHERE appointment_day BETWEEN ? AND ?
                    GROUP BY appointment_day
                    ORDER BY appointment_day
                `, [from, to]);
                const [[summary]] = await db.query(`
                    SELECT COUNT(DISTINCT patient_id) AS total
                    FROM appointments WHERE appointment_day BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, daily, total: summary.total };
                break;
            }

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
                const [byDoctor] = await db.query(`
                    SELECT CONCAT(s.first_name,' ',s.surname) AS doctor_name,
                           COUNT(*) AS total,
                           SUM(a.status='completed') AS completed,
                           SUM(a.status='cancelled') AS cancelled
                    FROM appointments a
                    LEFT JOIN staff s ON a.doctor_id = s.staff_id
                    WHERE a.appointment_day BETWEEN ? AND ?
                    GROUP BY a.doctor_id
                    ORDER BY total DESC
                `, [from, to]);
                data = { ...data, summary, byDoctor };
                break;
            }

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
                    GROUP BY a.doctor_id
                    ORDER BY total DESC
                `, [from, to]);
                data = { ...data, workload };
                break;
            }

            case 'staff_activity': {
                const [staff] = await db.query(`
                    SELECT CONCAT(s.first_name,' ',s.surname) AS name,
                           r.role_name AS role,
                           COUNT(al.log_id) AS action_count,
                           MAX(al.changed_at) AS last_active
                    FROM staff s
                    LEFT JOIN roles r ON s.role_id = r.role_id
                    LEFT JOIN audit_log al ON al.changed_by = s.email
                        AND al.changed_at BETWEEN ? AND ?
                    WHERE s.is_active = 1
                    GROUP BY s.staff_id
                    ORDER BY action_count DESC
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, staff };
                break;
            }

            case 'system_usage': {
                const [usage] = await db.query(`
                    SELECT log_id, action, changed_by AS user, changed_at AS timestamp,
                           table_name AS resource
                    FROM audit_log
                    WHERE changed_at BETWEEN ? AND ?
                    ORDER BY changed_at DESC
                    LIMIT 200
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, usage, total_logins: usage.length };
                break;
            }

            // ── Clinical ───────────────────────────────────────────────────
            case 'treatments_per_doctor': {
                const [treatments] = await db.query(`
                    SELECT CONCAT(s.first_name,' ',s.surname) AS doctor_name,
                           COUNT(DISTINCT a.appointment_id) AS total_treatments,
                           COUNT(DISTINCT pr.prescription_id) AS prescriptions,
                           COUNT(DISTINCT lt.test_id) AS lab_orders
                    FROM staff s
                    LEFT JOIN appointments a ON a.doctor_id = s.staff_id
                        AND a.appointment_day BETWEEN ? AND ?
                        AND a.status = 'completed'
                    LEFT JOIN prescription pr ON pr.prescribed_by = s.staff_id
                        AND pr.prescribed_date BETWEEN ? AND ?
                    LEFT JOIN lab_test lt ON lt.requested_by = s.staff_id
                        AND lt.test_date BETWEEN ? AND ?
                    WHERE s.role_id = (SELECT role_id FROM roles WHERE role_name='Doctor' LIMIT 1)
                      AND s.is_active = 1
                    GROUP BY s.staff_id
                    ORDER BY total_treatments DESC
                `, [from, to, from, to, from, to]);
                data = { ...data, treatments };
                break;
            }

            case 'prescription_statistics': {
                const [medications] = await db.query(`
                    SELECT m.medication_name, COUNT(*) AS count
                    FROM prescription pr
                    LEFT JOIN medication m ON pr.medication_id = m.medication_id
                    WHERE pr.prescribed_date BETWEEN ? AND ?
                    GROUP BY pr.medication_id
                    ORDER BY count DESC
                    LIMIT 30
                `, [from, to]);
                const [[totals]] = await db.query(`
                    SELECT COUNT(*) AS total FROM prescription
                    WHERE prescribed_date BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, medications, total: totals.total };
                break;
            }

            case 'lab_test_statistics': {
                const [tests] = await db.query(`
                    SELECT t.test_name, COUNT(*) AS count,
                           SUM(lt.status='completed') AS completed
                    FROM lab_test lt
                    LEFT JOIN test_catalog t ON lt.test_catalog_id = t.test_catalog_id
                    WHERE lt.test_date BETWEEN ? AND ?
                    GROUP BY lt.test_catalog_id
                    ORDER BY count DESC
                `, [from, to]);
                const [[totals]] = await db.query(`
                    SELECT COUNT(*) AS total, SUM(status='completed') AS completed
                    FROM lab_test WHERE test_date BETWEEN ? AND ?
                `, [from, to]);
                data = { ...data, tests, total: totals.total, completed: totals.completed };
                break;
            }

            // ── Management ─────────────────────────────────────────────────
            case 'patient_registration_growth': {
                // Try created_at first, fall back to patient_id ordering
                let growth;
                try {
                    [growth] = await db.query(`
                        SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, COUNT(*) AS count
                        FROM patient
                        WHERE created_at BETWEEN ? AND ?
                        GROUP BY period ORDER BY period
                    `, [from + ' 00:00:00', to + ' 23:59:59']);
                } catch (e) {
                    // If created_at column doesn't exist, use patient_id ranges as proxy
                    [growth] = await db.query(`
                        SELECT CONCAT('Record #', FLOOR(patient_id/10)*10, '-', FLOOR(patient_id/10)*10+9) AS period,
                            COUNT(*) AS count
                        FROM patient GROUP BY FLOOR(patient_id/10) ORDER BY patient_id
                    `);
                }
                data = { ...data, growth };
                break;
            }

            case 'feedback_complaint': {
                const [feedback] = await db.query(`
                    SELECT f.feedback_id, f.comment, f.admin_note,
                           f.date_submitted, f.status,
                           p.full_name AS patient_name,
                           CONCAT(s.first_name,' ',s.surname) AS user_name
                    FROM feedback f
                    LEFT JOIN patient p ON f.patient_id = p.patient_id
                    LEFT JOIN user_account ua ON f.user_id = ua.user_id
                    LEFT JOIN staff s ON ua.staff_id = s.staff_id
                    WHERE f.date_submitted BETWEEN ? AND ?
                    ORDER BY f.date_submitted DESC
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, feedback };
                break;
            }

            case 'opd_capacity_utilization': {
                const [slots] = await db.query(`
                    SELECT
                        a.appointment_day AS date,
                        a.start_time AS slot,
                        COUNT(*) AS booked,
                        COALESCE(
                            (SELECT CAST(setting_value AS UNSIGNED) FROM system_settings WHERE setting_key='slot_capacity' LIMIT 1),
                            6
                        ) AS capacity
                    FROM appointments a
                    WHERE a.appointment_day BETWEEN ? AND ?
                    GROUP BY a.appointment_day, a.start_time
                    ORDER BY a.appointment_day, a.start_time
                `, [from, to]);
                // Compute utilization percentage
                const enriched = slots.map(s => ({
                    ...s,
                    utilization_pct: s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0
                }));
                data = { ...data, slots: enriched };
                break;
            }

            // ── Audit ──────────────────────────────────────────────────────
            case 'login_activity': {
                const [logins] = await db.query(`
                    SELECT log_id, changed_by AS username, action,
                           record_id, changed_at AS timestamp
                    FROM audit_log
                    WHERE (action LIKE '%login%' OR action LIKE '%LOGIN%' OR action LIKE '%signin%')
                      AND changed_at BETWEEN ? AND ?
                    ORDER BY changed_at DESC
                    LIMIT 300
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                const unique_users = [...new Set(logins.map(l => l.username))].length;
                data = { ...data, logins, unique_users };
                break;
            }

            case 'password_reset_otp': {
                const [events] = await db.query(`
                    SELECT log_id, changed_by AS username, action,
                           record_id, changed_at AS timestamp
                    FROM audit_log
                    WHERE (action LIKE '%password%' OR action LIKE '%otp%' OR action LIKE '%reset%')
                      AND changed_at BETWEEN ? AND ?
                    ORDER BY changed_at DESC
                    LIMIT 200
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, events,
                    password_resets: events.filter(e => /password|reset/i.test(e.action || '')).length,
                    otp_events:      events.filter(e => /otp/i.test(e.action || '')).length,
                };
                break;
            }

            case 'data_modification_logs': {
                const [logs] = await db.query(`
                    SELECT log_id, table_name, action, record_id, changed_by, changed_at
                    FROM audit_log
                    WHERE changed_at BETWEEN ? AND ?
                    ORDER BY changed_at DESC
                    LIMIT 500
                `, [from + ' 00:00:00', to + ' 23:59:59']);
                data = { ...data, logs };
                break;
            }

            default:
                return res.status(400).json({ success: false, message: `Unknown report type: ${type}` });
        }

        res.json(data);

    } catch (err) {
        console.error('Report generation error:', err);
        // Return partial data with empty arrays instead of error, so UI can still render
        res.json({ success: true, summary: {}, daily: [], workload: [], staff: [], doctors: [],
                   medications: [], tests: [], growth: [], feedback: [], slots: [], logins: [],
                   events: [], logs: [], message: 'Partial data — some tables may not exist yet.' });
    }
});


// ── Enhanced Logs with date filtering ────────────────────────────────────────
// REPLACE existing /api/admin/logs with this version:
app.get('/api/admin/logs', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    const { from, to } = req.query;
    try {
        let query = `SELECT log_id, table_name, action, record_id, changed_by, changed_at FROM audit_log`;
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

app.get('/api/admin/opd-settings', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT setting_key, setting_value FROM system_settings`);
        const settings = {
            opd_start_hour: '8',
            opd_end_hour: '18',
            slot_capacity: '6',
            consultation_duration: '10',
            closed_dates: ''
        };
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json({ success: true, settings });
    } catch (err) {
        res.json({ success: true, settings: {} });
    }
});
app.post('/api/admin/opd-settings', async (req, res) => {
    const { opd_start_hour, opd_end_hour, slot_capacity, consultation_duration, closed_dates } = req.body;
    const keys = ['opd_start_hour', 'opd_end_hour', 'slot_capacity', 'consultation_duration', 'closed_dates'];
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
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get all feedback
// GET /api/admin/feedback
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/feedback', async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Update feedback (admin note, status)
// PATCH /api/admin/feedback/:id
// Body: { admin_note, status }
// ─────────────────────────────────────────────────────────────────────────────
app.patch('/api/admin/feedback/:id', async (req, res) => {
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
// ══════════════════════════════════════════════════════════════════════════════
//  NOTE ON DATABASE COLUMN: patient.is_active
//  If your patient table doesn't have is_active, run this migration:
//
//  ALTER TABLE patient ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
//
//  NOTE ON DATABASE COLUMN: patient.created_at
//  If missing:
//  ALTER TABLE patient ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
// ══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//  SmartOPD — Receptionist API Routes
//  Add these to server.js alongside your existing routes.
//  db = pool.promise()  →  const [rows] = await db.query(sql, params)
// ═══════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
// RECEPTION DASHBOARD STATS
// GET /api/receptionist/stats
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// RECEPTIONIST STATS
// GET /api/receptionist/stats
// FIX: replaced broken "new registrations" query with real completed count
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/receptionist/stats', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [[{ totalToday }]] = await db.query(
            `SELECT COUNT(*) AS totalToday
             FROM appointments
             WHERE appointment_day = ? AND status NOT IN ('cancelled')`,
            [today]
        );
        const [[{ arrived }]] = await db.query(
            `SELECT COUNT(*) AS arrived
             FROM appointments
             WHERE appointment_day = ? AND is_present = 1`,
            [today]
        );
        const [[{ pending }]] = await db.query(
            `SELECT COUNT(*) AS pending
             FROM appointments
             WHERE appointment_day = ? AND status = 'booked' AND is_present = 0`,
            [today]
        );
        // FIX: "New Registrations" replaced with "Completed Today" — a real, queryable value
        const [[{ completed }]] = await db.query(
            `SELECT COUNT(*) AS completed
             FROM appointments
             WHERE appointment_day = ? AND status = 'completed'`,
            [today]
        );

        res.json({ success: true, stats: { totalToday, arrived, pending, completed } });
    } catch (err) {
        console.error('Receptionist stats error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S QUEUE
// GET /api/receptionist/queue
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/receptionist/queue', async (req, res) => {
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


// ─────────────────────────────────────────────────────────────────────────────
// VERIFY ARRIVAL — search by NIC or barcode
// GET /api/receptionist/verify-arrival?term=XXX
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/receptionist/verify-arrival', async (req, res) => {
    const { term } = req.query;
    if (!term) return res.status(400).json({ success: false, message: 'Search term required.' });

    const today = new Date().toISOString().split('T')[0];

    try {
        const [patients] = await db.query(`
            SELECT patient_id, full_name, nic, barcode, dob, gender,
                   phone, blood_group, allergies, address_line1, address, is_active
            FROM patient
            WHERE (barcode = ? OR nic = ?) AND is_active = 1
            LIMIT 5
        `, [term, term]);

        if (!patients.length)
            return res.json({ success: false, message: 'No patient found with that barcode or NIC.' });

        const patient = patients[0];

        const [appointments] = await db.query(`
            SELECT
                a.appointment_id, a.appointment_day, a.start_time, a.end_time,
                a.queue_no, a.visit_type, a.status, a.is_present,
                (a.appointment_day = ?) AS is_today
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


// ─────────────────────────────────────────────────────────────────────────────
// MARK ARRIVED
// POST /api/receptionist/mark-arrived
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/receptionist/mark-arrived', async (req, res) => {
    const { appointment_id } = req.body;
    if (!appointment_id)
        return res.status(400).json({ success: false, message: 'appointment_id required.' });

    try {
        const [result] = await db.query(
            `UPDATE appointments SET is_present = 1 WHERE appointment_id = ? AND status = 'booked'`,
            [appointment_id]
        );
        if (!result.affectedRows)
            return res.json({ success: false, message: 'Appointment not found or already processed.' });

        res.json({ success: true, message: 'Patient marked as arrived.' });
    } catch (err) {
        console.error('Mark arrived error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// REGISTER PATIENT
// POST /api/receptionist/register-patient
// ENHANCEMENT: Now accepts all fields including medical info
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/receptionist/register-patient', async (req, res) => {
    const {
        full_name, nic, dob, gender, phone, email, address,
        blood_group, allergies, chronic_conditions,
        emergency_contact, civil_status,
        password = 'SmartOPD@123',
        registered_by
    } = req.body;

    if (!full_name || !nic || !dob || !gender)
        return res.status(400).json({ success: false, message: 'Full name, NIC, DOB and gender are required.' });

    if (!/^([0-9]{9}[xXvV]|[0-9]{12})$/.test(nic))
        return res.status(400).json({ success: false, message: 'Invalid NIC format.' });

    const normalizedPhone = phone?.trim()
        ? (phone.startsWith('0') ? '+94' + phone.slice(1) : phone.trim())
        : null;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Duplicate NIC check
        const [existNic] = await conn.query('SELECT patient_id FROM patient WHERE nic = ?', [nic]);
        if (existNic.length)
            return res.status(400).json({ success: false, message: 'A patient with this NIC is already registered.' });

        // Duplicate email check
        if (email && email.trim()) {
            const [existEmail] = await conn.query('SELECT patient_id FROM patient WHERE email = ?', [email.trim()]);
            if (existEmail.length)
                return res.status(400).json({ success: false, message: 'This email is already registered.' });
        }

        const barcodeValue   = `OPD-${Date.now()}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const [patientResult] = await conn.query(`
            INSERT INTO patient
            (full_name, nic, dob, gender, phone, email, address, address_line1,
             blood_group, allergies, chronic_conditions, emergency_contact,
             civil_status, barcode, is_active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
        `, [
            full_name, nic, dob, gender,
            normalizedPhone || null,
            email?.trim()   || null,
            address || null, address || null,
            blood_group         || null,
            allergies           || null,
            chronic_conditions  || null,
            emergency_contact   || null,
            civil_status        || null,
            barcodeValue
        ]);
        const newPatientId = patientResult.insertId;

        // Create login account if identifier is available
        
        let username = email?.trim() || normalizedPhone;
            if (!username) {
                // Generate a unique username from NIC or barcode
                // Option 1: Use NIC (if unique)
                username = nic;   // e.g., "200375713581" or "990234567V"
                // Option 2: Use barcode (guaranteed unique)
                // username = barcodeValue;
                
                // Ensure uniqueness (very low collision, but add check)
                const [existing] = await conn.query(
                    'SELECT user_id FROM user_account WHERE username = ?',
                    [username]
                );
                if (existing.length) {
                    username = `${username}_${Date.now()}`;
                }
            }
        if (username) {
            await conn.query(
                `INSERT INTO user_account (username, password_hash, patient_id, staff_id) VALUES (?,?,?,NULL)`,
                [username, hashedPassword, newPatientId]
            );
        }

        await conn.commit();

        // Send welcome email (non-fatal)
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

        res.status(201).json({ success: true, patientId: newPatientId, qrCode: barcodeValue, message: 'Registered successfully!' });

    } catch (err) {
        await conn.rollback();
        console.error('Register patient error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ALL APPOINTMENTS
// GET /api/receptionist/appointments
// ENHANCEMENT: Supports single date, date range (from/to), or all history
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/receptionist/appointments', async (req, res) => {
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
            // Single date filter
            sql += ` AND a.appointment_day = ?`;
            params.push(date);
        } else if (from && to) {
            // Date range filter
            sql += ` AND a.appointment_day BETWEEN ? AND ?`;
            params.push(from, to);
        }
        // If neither date nor range: return all (history mode)

        if (status && status !== 'all') {
            sql += ` AND a.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY a.appointment_day DESC, a.queue_no ASC`;

        // Safety limit when fetching all history
        if (!date && !from) sql += ` LIMIT 500`;

        const [rows] = await db.query(sql, params);
        res.json({ success: true, appointments: rows });
    } catch (err) {
        console.error('Appointments error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// STAFF FEEDBACK — submit
// POST /api/staff/feedback
// ENHANCEMENT: Accepts rating and category fields
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/staff/feedback', async (req, res) => {
    const { staff_id, comment, rating, category } = req.body;

    if (!staff_id || !comment?.trim())
        return res.status(400).json({ success: false, message: 'staff_id and comment are required.' });

    if (comment.trim().length > 500)
        return res.status(400).json({ success: false, message: 'Comment must be 500 characters or less.' });

    if (rating !== undefined && rating !== null) {
        const r = Number(rating);
        if (!Number.isInteger(r) || r < 1 || r > 5)
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    try {
        // Use column names that exist in your feedback table.
        // Add `rating` and `category` columns if they don't already exist:
        //   ALTER TABLE staff_feedback ADD COLUMN rating TINYINT NULL;
        //   ALTER TABLE staff_feedback ADD COLUMN category VARCHAR(50) DEFAULT 'general';
        await db.query(
            `INSERT INTO staff_feedback (staff_id, comment, rating, category, status, submitted_at)
             VALUES (?, ?, ?, ?, 'pending', NOW())`,
            [staff_id, comment.trim(), rating || null, category || 'general']
        );
        res.json({ success: true, message: 'Feedback submitted.' });
    } catch (err) {
        console.error('Feedback submit error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// STAFF FEEDBACK — history
// GET /api/staff/feedback/:staff_id
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/staff/feedback/:staff_id', async (req, res) => {
    const { staff_id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT feedback_id, comment, rating, category, status, admin_note, submitted_at
             FROM staff_feedback
             WHERE staff_id = ?
             ORDER BY submitted_at DESC
             LIMIT 50`,
            [staff_id]
        );
        res.json({ success: true, feedback: rows });
    } catch (err) {
        console.error('Feedback history error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
});