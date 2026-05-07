/*
This simplified single-file structure was adopted for ease of development,
testing, and academic purposes. In future enhancements, the application
can be refactored into a modular and scalable architecture by separating
concerns into routes, controllers, and models following best practices.
*/
jhu
// ============================================================
// server.js — SmartOPD Backend API
// Purpose: Main Express server for the SmartOPD hospital OPD
//          management system at Base Hospital, Kiribathgoda.
//          Handles authentication, patient registration,
//          appointment booking, doctor/pharmacist/lab/admin
//          operations, and email notifications.
// ============================================================

// Load environment variables from .env file into process.env
// (e.g., DB_HOST, DB_USER, DB_PASS, TWILIO keys, etc.)
require('dotenv').config();

// Import core framework and middleware packages
const express    = require('express');       // Web framework for building REST APIs
const mysql      = require('mysql2');        // MySQL database driver with Promise support
const cors       = require('cors');          // Cross-Origin Resource Sharing — allows the React frontend to call this API
const bcrypt     = require('bcrypt');        // Password hashing library (one-way encryption)
const bwipjs     = require('bwip-js');       // Barcode generator — creates Code128 barcodes as PNG images
const nodemailer = require('nodemailer');    // Email sending library used for OTP, registration, and appointment emails
const path       = require('path');          // Node.js built-in: handles file system paths
const fs         = require('fs');            // Node.js built-in: reads/writes files (used for lab result downloads)

// Create the Express application instance
const app = express();

// Apply global middleware
app.use(cors());           // Allow all cross-origin requests (frontend on a different port can call this API)
app.use(express.json());   // Parse incoming JSON request bodies so req.body is populated

// ============================================================
// EMAIL TRANSPORTER SETUP
// Purpose: Configures nodemailer to send emails via Gmail SMTP.
//          Used for OTP codes, registration confirmations,
//          appointment slips, and staff account notifications.
// ============================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bhagya0913@gmail.com',  // Sender Gmail address
        pass: 'nfzunxjlstdszaba'       // Gmail App Password (not the account password)
    }
});

// ============================================================
// FUNCTION: generateBarcodeDataURL
// Purpose:  Generates a Code128 barcode image from a text string
//           and returns it as a Base64-encoded PNG Data URL,
//           suitable for embedding directly in HTML emails.
// Parameters:
//   barcodeText (string) — the text to encode in the barcode
// Returns:   Promise<string> — "data:image/png;base64,..."
// ============================================================
function generateBarcodeDataURL(barcodeText) {
    return new Promise((resolve, reject) => {
        bwipjs.toBuffer({
            bcid:        'code128',   // Barcode format: Code 128 (alphanumeric, compact)
            text:         barcodeText, // The actual value to encode
            scale:        3,           // Image scale factor (higher = larger/clearer image)
            height:       10,          // Bar height in mm
            includetext:  true,        // Print the text string below the bars
            textxalign:  'center',     // Center-align the printed text
        }, (err, png) => {
            if (err) reject(err);
            // Convert the raw PNG buffer to a Base64 data URL
            else resolve(`data:image/png;base64,${png.toString('base64')}`);
        });
    });
}

// ============================================================
// FUNCTION: buildRegistrationEmail
// Purpose:  Builds the HTML body for the welcome email sent to
//           a newly registered patient. Includes their Patient ID,
//           barcode image, and login credentials.
// Parameters:
//   fullName      — patient's full name
//   email         — patient's email / login username
//   password      — plain-text password (shown once, first login only)
//   patientId     — auto-generated numeric patient ID from DB
//   barcodeValue  — the barcode text string (e.g., "OPD-1718000000000")
//   barcodeImage  — Base64 PNG data URL of the barcode image
// Returns: string — complete HTML email body
// ============================================================
function buildRegistrationEmail(fullName, email, password, patientId, barcodeValue, barcodeImage) {
    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9">
        <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 32px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#fff">SmartOPD</div>
                <div style="font-size:13px;color:rgba(255,255,255,.8)">Base Hospital, Kiribathgoda</div>
            </div>
            <div style="padding:32px 32px;text-align:center">
                <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;border:3px solid #bfdbfe;font-size:28px">✅</div>
                <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Registration Successful!</h2>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px">Welcome to SmartOPD, ${fullName}.</p>

                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;text-align:left">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Patient ID</div>
                    <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:12px">${patientId}</div>
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:0 auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:10px;background:#fff;border-radius:8px"/>
                    <div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:10px;text-align:center">${barcodeValue}</div>
                </div>

                <div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-bottom:20px;border-left:4px solid #16a34a;text-align:left">
                    <p style="margin:0 0 4px;font-weight:700;color:#166534">Login Credentials</p>
                    <p style="margin:0;font-size:13px;color:#334155">Username: <strong>${email}</strong></p>
                    <p style="margin:0;font-size:13px;color:#334155">Password: <strong>${password}</strong></p>
                    <p style="margin:6px 0 0;font-size:12px;color:#6b7280">Please change your password after first login.</p>
                </div>

                <p style="font-size:12px;color:#94a3b8;margin:0">Keep this email safe. You will need the barcode at hospital visits.</p>
            </div>
            <div style="background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
                SmartOPD — Base Hospital Kiribathgoda | For internal use only
            </div>
        </div>
        </body>
        </html>
    `;
}

// ============================================================
// FUNCTION: buildOpdSlipEmail
// Purpose:  Builds the HTML body for the OPD appointment slip
//           email sent after a patient books an appointment.
//           Includes token number, date, reporting time, visit
//           type, and the patient's barcode to show at the counter.
// Parameters:
//   appointment  — object with queue_no, appointment_day, time_slot, visit_type
//   patient      — object with full_name, patient_id, nic, barcode
//   barcodeImage — Base64 PNG data URL of the barcode
// Returns: string — complete HTML email body
// ============================================================
function buildOpdSlipEmail(appointment, patient, barcodeImage) {
    // Extract only the start time from a "HH:MM – HH:MM" slot string, or fall back to '—'
    const startTime = appointment.time_slot ? appointment.time_slot.split('–')[0].trim() : '—';

    // Format the appointment date to a human-readable string (e.g., "Monday, 1 January 2025")
    const dateObj      = new Date(appointment.appointment_day);
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
        <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;border:1.5px solid #BBDEFB;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(21,101,192,.12)">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 20px;text-align:center">
                <div style="font-size:12px;color:rgba(255,255,255,.6);letter-spacing:3px;text-transform:uppercase;margin-bottom:12px">SmartOPD · Official OPD Slip</div>
                <div style="background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);border-radius:12px;padding:12px 20px;display:inline-block;margin-bottom:12px">
                    <div style="color:rgba(255,255,255,.7);font-size:10px;letter-spacing:2px;text-transform:uppercase">Queue Token</div>
                    <div style="color:white;font-size:56px;font-weight:900;line-height:1;letter-spacing:-2px">#${appointment.queue_no}</div>
                </div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;letter-spacing:1.5px">BASE HOSPITAL, KIRIBATHGODA</div>
            </div>
            <div style="background:white;padding:20px">
                <div style="border-bottom:1px solid #E3F0FF;padding-bottom:12px;margin-bottom:12px">
                    <div style="font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Patient Name</div>
                    <div style="font-size:16px;font-weight:800;color:#0f172a">${patient.full_name}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px">ID: ${patient.patient_id} · NIC: ${patient.nic || '—'}</div>
                </div>
                <div style="background:#E3F0FF;border:1.5px solid #90BEF5;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between">
                    <div>
                        <div style="font-size:9px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase">Appointment Date</div>
                        <div style="font-size:13px;font-weight:800;color:#0D47A1;margin-top:4px">${formattedDate}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:9px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase">Reporting Time</div>
                        <div style="font-size:16px;font-weight:900;color:#1565C0;margin-top:4px">${startTime}</div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px">
                    <div style="flex:1;background:#f8fafc;border-radius:6px;padding:8px 12px">
                        <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Visit Type</div>
                        <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:2px">${appointment.visit_type || 'New'}</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border-radius:6px;padding:8px 12px">
                        <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Token No.</div>
                        <div style="font-size:20px;font-weight:900;color:#1565C0;margin-top:2px">#${appointment.queue_no}</div>
                    </div>
                </div>
                <div style="background:#f0f4fb;border:1px solid #E3F0FF;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Patient Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:6px auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:6px;background:#fff;border-radius:6px"/>
                    <div style="font-family:monospace;font-size:12px;font-weight:700;color:#1565C0;margin-top:4px">${patient.barcode}</div>
                </div>
            </div>
            <div style="background:#f8fafc;border-top:1px dashed #BBDEFB;padding:12px;text-align:center;font-size:11px;color:#475569">Present this slip at the OPD nursing station on arrival.</div>
        </div>
    `;
}

// ============================================================
// FUNCTION: buildRegistrationEmailForExistingStaff
// Purpose:  Builds the HTML welcome email for a staff member who
//           registers as a patient (dual-role scenario).
//           Does NOT include a new password — they keep their
//           existing staff password.
// Parameters:
//   fullName, email, patientId, barcodeValue, barcodeImage
// Returns: string — complete HTML email body
// ============================================================
function buildRegistrationEmailForExistingStaff(fullName, email, patientId, barcodeValue, barcodeImage) {
    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9">
        <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 32px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#fff">SmartOPD</div>
                <div style="font-size:13px;color:rgba(255,255,255,.8)">Base Hospital, Kiribathgoda</div>
            </div>
            <div style="padding:32px 32px;text-align:center">
                <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;border:3px solid #bfdbfe;font-size:28px">✅</div>
                <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Patient Registration Linked</h2>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px">Hello <strong>${fullName}</strong>, you are now also registered as a patient.</p>

                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;text-align:left">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Patient ID</div>
                    <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:12px">${patientId}</div>
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:0 auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:10px;background:#fff;border-radius:8px"/>
                    <div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:10px;text-align:center">${barcodeValue}</div>
                </div>

                <div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-bottom:20px;border-left:4px solid #16a34a;text-align:left">
                    <p style="margin:0 0 4px;font-weight:700;color:#166534">Your existing login credentials remain valid</p>
                    <p style="margin:0;font-size:13px;color:#334155">Username: <strong>${email}</strong></p>
                    <p style="margin:0;font-size:13px;color:#334155">Password: <strong>unchanged (your staff password)</strong></p>
                </div>

                <p style="font-size:12px;color:#94a3b8;margin:0">Keep this barcode for hospital visits.</p>
            </div>
            <div style="background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
                SmartOPD — Base Hospital Kiribathgoda | For internal use only
            </div>
        </div>
        </body>
        </html>
    `;
}

// ============================================================
// IN-MEMORY OTP STORE (legacy — kept but superseded by DB store)
// Purpose: Originally used to hold OTP codes in memory.
//          The system now uses the otp_verification DB table instead,
//          so this Map is unused in current routes.
// ============================================================
const otpStore = new Map();

// ============================================================
// DATABASE CONNECTION POOL
// Purpose:  Creates a pool of reusable MySQL connections.
//           Using a pool (instead of a single connection) prevents
//           bottlenecks when multiple requests arrive simultaneously.
// Configuration:
//   host/port/user/password/database — from .env or hardcoded defaults
//   connectionLimit — max simultaneous DB connections
// ============================================================
const pool = mysql.createPool({
    host:               process.env.DB_HOST || 'localhost',
    port:               3307,                              // Custom MySQL port (default is 3306)
    user:               process.env.DB_USER || 'root',
    password:           process.env.DB_PASS || '757135@bhagikLn',
    database:           process.env.DB_NAME || 'hospital_db',
    waitForConnections: true,   // Queue requests if all connections are busy
    connectionLimit:    10,     // Maximum 10 concurrent connections
    queueLimit:         0       // Unlimited queue size
});

// Wrap the pool with Promise support so we can use async/await
const db = pool.promise();

// ============================================================
// FUNCTION: initDB
// Purpose:  Creates required tables if they don't already exist
//           when the server starts. This ensures the DB schema
//           is always ready without manual SQL migration scripts.
// Tables created:
//   otp_verification — stores email/phone OTP codes with expiry
//   patient_family   — links primary patients to their family members
// ============================================================
async function initDB() {
    try {
        // Create OTP verification table (used for email and SMS OTP flows)
        await db.query(`
            CREATE TABLE IF NOT EXISTS otp_verification (
                email VARCHAR(255) PRIMARY KEY,
                otp_code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `);

        // Create patient-family link table (supports booking for family members)
        await db.query(`
            CREATE TABLE IF NOT EXISTS patient_family (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                primary_patient_id BIGINT NOT NULL,        -- The account holder (main patient)
                member_patient_id  BIGINT NOT NULL,        -- The family member's patient record
                relation           VARCHAR(50) DEFAULT NULL, -- e.g., "Spouse", "Child"
                created_at         DATETIME DEFAULT NOW(),
                UNIQUE KEY uq_link (primary_patient_id, member_patient_id), -- Prevent duplicate links
                KEY idx_primary    (primary_patient_id),   -- Index for fast lookup by primary
                KEY idx_member     (member_patient_id)     -- Index for fast lookup by member
            )
        `);
        console.log(' Database tables verified.');
    } catch (err) {
        console.error(' Database init error:', err);
    }
}
initDB(); // Run immediately when server starts

// ============================================================
// AUTH ROUTES — FORGOT / RESET PASSWORD
// ============================================================

// POST /api/forgot-password
// Purpose:  Initiates password reset by generating a 6-digit OTP,
//           storing it in the DB, and emailing it to the user.
//           Returns success even if the email is sent — the OTP
//           expires in 5 minutes.
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    // Validate that email was provided
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    try {
        // Check if an account exists with this email
        const [users] = await db.query(
            'SELECT user_id FROM user_account WHERE username = ?', [email]
        );
        if (!users.length) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }

        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set expiry time to 5 minutes from now
        const expires = new Date(Date.now() + 5 * 60000);

        // Upsert the OTP into the verification table
        // (INSERT or UPDATE if email already has an existing OTP)
        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'email', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [email, otp, expires, otp, expires]);

        // Send the OTP via email
        await transporter.sendMail({
            from:    'bhagya0913@gmail.com',
            to:      email,
            subject: 'SmartOPD Password Reset Code',
            html: `<div style="font-family:Arial;max-width:480px;margin:auto;padding:25px;border:1px solid #eee;border-radius:10px">
                   <h2 style="color:#2563eb">SmartOPD Password Reset</h2>
                   <p>Your verification code:</p>
                   <div style="font-size:32px;font-weight:bold;text-align:center;letter-spacing:8px;background:#eff6ff;padding:20px;border-radius:8px;margin:15px 0">${otp}</div>
                   <p>This code expires in <b>5 minutes</b>.</p></div>`
        });

        res.json({ success: true, message: 'OTP sent to email.' });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/verify-token
// Purpose:  Verifies that the OTP entered by the user matches the one
//           stored in the DB for that email and has not expired.
//           Used as the middle step in the password reset flow.
app.post('/api/verify-token', async (req, res) => {
    const { email, token } = req.body;

    if (!email || !token)
        return res.status(400).json({ success: false, message: 'Email and token required' });

    try {
        // Look for a matching, non-expired OTP record
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

// POST /api/reset-password
// Purpose:  Final step of password reset. Verifies the OTP again,
//           hashes the new password with bcrypt, updates the user
//           account, and deletes the used OTP from the DB.
// Note: This route is defined twice (duplicate) — only the last
//       definition will be active in Express. This is a code smell
//       that should be cleaned up.
app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword)
        return res.status(400).json({ success: false, message: 'Missing required fields' });

    try {
        // Re-verify the OTP before applying the change
        const [rows] = await db.query(`
            SELECT * FROM otp_verification
            WHERE contact_value=? AND otp_code=? AND expires_at > NOW()
        `, [email, token]);

        if (!rows.length)
            return res.status(400).json({ success: false, message: 'Invalid or expired code' });

        // Hash the new password with bcrypt (cost factor 10)
        const hashed = await bcrypt.hash(newPassword, 10);

        // Update the user's stored password hash
        await db.query(
            'UPDATE user_account SET password_hash=? WHERE username=?', [hashed, email]
        );

        // Delete the consumed OTP so it cannot be reused
        await db.query(
            'DELETE FROM otp_verification WHERE contact_value=?', [email]
        );

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/reset-password (DUPLICATE — see note above)
// This is a duplicate route definition. In Express, the last definition
// wins, so this effectively replaces the one above. Functionally identical.
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
        await db.query(
            'UPDATE user_account SET password_hash=? WHERE username=?', [hashed, email]
        );
        await db.query(
            'DELETE FROM otp_verification WHERE contact_value=?', [email]
        );

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// REGISTRATION OTP ROUTES
// Purpose: Send and verify OTP codes before allowing a new
//          patient to complete self-registration. Prevents fake
//          or unverified email/phone registrations.
// ============================================================

// POST /api/send-registration-otp
// Purpose:  Sends a 6-digit OTP to the provided email address.
//           Blocks if the email is already fully registered as a patient.
//           Allows OTP for staff-only accounts (they can also register as patients).
app.post('/api/send-registration-otp', async (req, res) => {
    const { email } = req.body;

    // Basic email format validation
    if (!email || !email.includes('@'))
        return res.status(400).json({ success: false, error: 'Valid email is required.' });

    // Generate 6-digit OTP and set 5-minute expiry
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    try {
        // Check if this email already exists in user_account
        const [existing] = await db.query(
            'SELECT user_id, patient_id FROM user_account WHERE username = ? LIMIT 1',
            [email]
        );

        // If the account already has a patient linked, block registration
        if (existing.length > 0 && existing[0].patient_id !== null) {
            return res.status(400).json({
                success: false,
                error: 'This email is already registered as a patient.'
            });
        }

        // Upsert OTP record (replaces any previous OTP for this email)
        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'email', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [email, otp, expiresAt, otp, expiresAt]);

        // Send the styled OTP verification email
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

// POST /api/send-registration-sms-otp
// Purpose:  Sends a 6-digit OTP via SMS (Twilio) to a Sri Lankan
//           mobile number. Validates the phone format and blocks
//           already-registered numbers.
app.post('/api/send-registration-sms-otp', async (req, res) => {
    const { phone } = req.body;

    // Validate Sri Lankan phone number format (+94 or 0 prefix, 9 digits after)
    const phoneRegex = /^(?:\+94|0)[0-9]{9}$/;
    if (!phone || !phoneRegex.test(phone))
        return res.status(400).json({ success: false, error: 'Valid Sri Lankan mobile number required.' });

    // Normalize to international format (+94XXXXXXXXX)
    const normalizedPhone = phone.startsWith('0') ? '+94' + phone.slice(1) : phone;
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    try {
        // Block if this phone is already registered to a patient
        const [existing] = await db.query(
            'SELECT patient_id FROM patient WHERE phone = ?', [normalizedPhone]
        );
        if (existing.length)
            return res.status(400).json({ success: false, error: 'This phone number is already registered.' });

        // Store the OTP in the DB (upsert)
        await db.query(`
            INSERT INTO otp_verification (contact_value, contact_type, otp_code, expires_at)
            VALUES (?, 'phone', ?, ?)
            ON DUPLICATE KEY UPDATE otp_code = ?, expires_at = ?
        `, [normalizedPhone, otp, expiresAt, otp, expiresAt]);

        // Send SMS via Twilio
        const twilio = require('twilio');
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,  // Twilio account credentials from .env
            process.env.TWILIO_AUTH_TOKEN
        );
        await client.messages.create({
            body: `Your SmartOPD registration code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
            from: process.env.TWILIO_PHONE_NUMBER, // Twilio virtual number
            to:   normalizedPhone
        });

        res.json({ success: true, message: 'OTP sent via SMS.' });
    } catch (error) {
        console.error('Send SMS OTP Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send SMS OTP.' });
    }
});

// POST /api/verify-registration-otp
// Purpose:  Verifies the email OTP submitted by the user during
//           registration. Checks that the code matches and has not expired.
app.post('/api/verify-registration-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp)
        return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

    try {
        // Match the OTP in the DB for this email, must not be expired
        const [rows] = await db.query(
            `SELECT * FROM otp_verification WHERE contact_value=? AND otp_code=? AND expires_at > NOW()`,
            [email, otp]
        );

        if (rows.length)
            res.json({ success: true, message: 'OTP verified successfully.' });
        else
            res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/verify-registration-sms-otp
// Purpose:  Same as above but for the SMS OTP flow.
//           Normalizes the phone to international format before DB lookup.
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

        if (rows.length)
            res.json({ success: true, message: 'Phone verified successfully.' });
        else
            res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// PATIENT SELF-REGISTRATION
// POST /api/register
// Purpose:  Registers a new patient after OTP verification.
//           Handles three scenarios:
//             A) Brand new person — creates patient + user_account
//             B) Staff registering as patient — links patient to
//                their existing staff account (no new password)
//             C) Already a patient — rejected with 400 error
//           Uses a DB transaction to ensure atomicity (patient
//           record and user account are created together or not at all).
//           Sends a registration confirmation email with barcode after commit.
// ============================================================
app.post('/api/register', async (req, res) => {
    let connection;
    try {
        // Get a dedicated connection from the pool for this transaction
        connection = await db.getConnection();

        const { full_name, nic, dob, gender, email, phone, password } = req.body;

        // Check if this email already has a user account
        const [existingUser] = await connection.query(
            'SELECT user_id, patient_id, staff_id, password_hash FROM user_account WHERE username = ? LIMIT 1',
            [email]
        );

        let existingUserId      = null;
        let existingPatientId   = null;
        let existingPasswordHash = null;

        if (existingUser.length > 0) {
            existingUserId       = existingUser[0].user_id;
            existingPatientId    = existingUser[0].patient_id;
            existingPasswordHash = existingUser[0].password_hash;

            // Scenario C: email already linked to a patient — reject
            if (existingPatientId) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: 'This email is already registered as a patient.'
                });
            }
        }

        // Ensure OTP was verified before proceeding (OTP must still exist and not be expired)
        const [otpValid] = await connection.query(
            'SELECT * FROM otp_verification WHERE contact_value = ? AND expires_at > NOW()',
            [email]
        );
        if (otpValid.length === 0) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Email not verified. Please request OTP.'
            });
        }

        // Begin DB transaction — all or nothing
        await connection.beginTransaction();

        // Generate a unique barcode string using current Unix timestamp
        const barcodeValue = `OPD-${Date.now()}`;

        // Insert new patient record
        const [patientResult] = await connection.query(
            `INSERT INTO patient (full_name, nic, dob, gender, email, phone, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [full_name, nic, dob, gender, email, phone, barcodeValue]
        );
        const newPatientId = patientResult.insertId;

        if (existingUserId) {
            // Scenario B: Staff account already exists — just link the new patient_id
            await connection.query(
                `UPDATE user_account SET patient_id = ? WHERE user_id = ?`,
                [newPatientId, existingUserId]
            );
        } else {
            // Scenario A: Create a brand new user_account with hashed password
            const hashedPassword = await bcrypt.hash(password, 10);
            await connection.query(
                `INSERT INTO user_account (username, password_hash, patient_id)
                 VALUES (?, ?, ?)`,
                [email, hashedPassword, newPatientId]
            );
        }

        // Clean up the used OTP record
        await connection.query(
            'DELETE FROM otp_verification WHERE contact_value = ?', [email]
        );

        // Commit both inserts as a single atomic operation
        await connection.commit();

        // Send confirmation email (non-blocking — failure here does not roll back)
        try {
            const barcodeImage = await generateBarcodeDataURL(barcodeValue);
            let emailHtml;

            if (existingUserId) {
                // Staff becoming patient — use the "existing staff" variant (no password shown)
                emailHtml = buildRegistrationEmailForExistingStaff(
                    full_name, email, newPatientId, barcodeValue, barcodeImage
                );
            } else {
                // Brand new patient — include their password in the email
                emailHtml = buildRegistrationEmail(
                    full_name, email, password, newPatientId, barcodeValue, barcodeImage
                );
            }

            await transporter.sendMail({
                from:    'bhagya0913@gmail.com',
                to:      email,
                subject: 'SmartOPD Registration Successful — Your Patient Barcode',
                html:    emailHtml
            });
        } catch (emailErr) {
            // Email failure is non-fatal — the patient is still registered
            console.warn('Registration email failed:', emailErr.message);
        }

        connection.release();
        res.status(201).json({
            success: true,
            barcode: barcodeValue,
            message: 'Registered successfully!'
        });

    } catch (error) {
        // If anything fails, roll back all DB changes
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// LOGIN
// POST /api/login
// Purpose:  Authenticates a user (patient, staff, or admin) and
//           returns a user object with role info.
//           Supports dual-role accounts (e.g., a nurse who is also
//           a patient). If the user has multiple roles, the frontend
//           may prompt them to select one before proceeding.
// Special case: hardcoded admin/admin shortcut for development.
// Flow:
//   1. Look up user_account by username (email)
//   2. Verify bcrypt password
//   3. Collect all active roles (staff role + patient role)
//   4. If multi-role and no selectedRole provided → signal for role selection
//   5. Build and return unified user object
// ============================================================
app.post('/api/login', async (req, res) => {
    const { username, password, selectedRole } = req.body;

    if (!username || !password)
        return res.status(400).json({ success: false, message: 'Email and password are required.' });

    // Hardcoded admin shortcut — bypasses DB lookup for development/testing
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
        // Step 1: Find the user account
        const [users] = await db.query(
            `SELECT user_id, username, password_hash, patient_id, staff_id
             FROM user_account WHERE username = ? LIMIT 1`,
            [username.trim()]
        );
        if (!users.length)
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const account = users[0];

        // Step 2: Verify password against stored bcrypt hash
        const isMatch = await bcrypt.compare(password.trim(), account.password_hash);
        if (!isMatch)
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        // Step 3: Load associated roles
        let staffRole  = null;
        let staffData  = null;
        let patientData = null;
        const availableRoles = [];  // All active roles this account has

        // If the account is linked to a staff record, load it
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
                staffRole = staffData.role_name;      // e.g., "Doctor", "Pharmacist"
                availableRoles.push(staffRole);
            }
        }

        // If the account is linked to a patient record, load it
        if (account.patient_id) {
            const [patientRows] = await db.query(
                `SELECT patient_id, barcode, full_name, nic, dob, gender, civil_status,
                        blood_group, phone, address_line1, address, emergency_contact,
                        chronic_conditions, allergies, height_cm, weight_kg, email, is_active
                FROM patient WHERE patient_id = ? AND is_active = 1 LIMIT 1`,
                [account.patient_id]
            );
            if (patientRows.length) {
                patientData = patientRows[0];
                availableRoles.push('Patient');
            }
        }

        // If no active role found, the account is deactivated
        if (availableRoles.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Account deactivated. Contact hospital administration.'
            });
        }

        // Maps a client-supplied role string to the canonical role label
        const roleMap = {
            'patient':               'Patient',
            'doctor':                 staffRole,
            'receptionist':           staffRole,
            'pharmacist':             staffRole,
            'lab':                    staffRole,
            'diagnostic technician':  staffRole,
            'admin':                  staffRole,
        };

        // Step 4: Determine which role is active for this session
        let primaryRole;

        if (availableRoles.length > 1) {
            // Multi-role account: use selectedRole from client, or default to staff role
            const clientRole      = (selectedRole || '').toLowerCase();
            const clientRoleLabel = roleMap[clientRole];
            primaryRole = (clientRoleLabel && availableRoles.includes(clientRoleLabel))
                ? clientRoleLabel
                : (staffRole || 'Patient');
        } else {
            primaryRole = availableRoles[0]; // Single-role account
        }

        // Step 5: Build the user response object
        const userObj = {
            id:             account.user_id,
            username:       account.username,
            role:           primaryRole,
            availableRoles,
            patient_id:     account.patient_id || null,
            patientId:      account.patient_id || null,  // Alias for frontend compatibility
            staff_id:       account.staff_id   || null,
        };

        // Merge in patient-specific fields if the account has a patient
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

        // Merge in staff-specific fields; override name/email only if not in patient mode
        if (staffData) {
            userObj.staff_name  = `${staffData.first_name} ${staffData.surname}`.trim();
            userObj.staff_email = staffData.email || account.username;
            userObj.staff_phone = staffData.phone;
            if (!patientData || primaryRole.toLowerCase() !== 'patient') {
                userObj.full_name = userObj.staff_name;
                userObj.email     = userObj.staff_email;
                userObj.phone     = userObj.staff_phone;
            }
        }

        // Signal to the frontend if a role selection dialog should be shown
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

// ============================================================
// PHARMACIST ROUTES
// Purpose: Endpoints used by the pharmacist dashboard for
//          prescription management and dispensing.
// ============================================================

// POST /api/pharmacist/save-note
// Purpose: Allows a pharmacist to add or update a note on a
//          specific treatment/prescription record.
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

// GET /api/pharmacist/reports/generate
// Purpose:  Generates various pharmacy management reports based on
//           the report type and date range provided as query parameters.
// Query params:
//   type  — one of: daily_received, dispensed, pending, most_prescribed, freq_by_doctor
//   from  — start date (YYYY-MM-DD)
//   to    — end date (YYYY-MM-DD)
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

// GET /api/staff/feedback/:staff_id
// Purpose:  Retrieves feedback submitted by a specific staff member.
//           Used on the staff dashboard to show their own feedback history.
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

// GET /api/pharmacist/stats
// Purpose:  Returns summary counts for the pharmacist dashboard:
//           pending (not yet dispensed), fulfilled today, and
//           total prescriptions created today.
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

// GET /api/pharmacist/pending-queue
// Purpose:  Returns all prescriptions that have been issued but
//           not yet dispensed. Used to show the pharmacist their
//           work queue sorted by oldest first.
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

// GET /api/pharmacist/all-prescriptions
// Purpose:  Returns all prescriptions with optional status filter.
//           Used by the pharmacist to browse all, pending, or fulfilled prescriptions.
// Query params:
//   status — optional: 'pending' | 'fulfilled' (returns all if omitted)
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

// GET /api/pharmacist/prescriptions-by-patient
// Purpose:  Looks up a patient by barcode or NIC, then returns
//           all their prescription history. Used when a patient
//           walks to the pharmacy counter to collect medication.
// Query params:
//   term — barcode string OR NIC number
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

// POST /api/pharmacist/fulfill-record
// Purpose:  Marks a prescription as dispensed by inserting a record
//           into the prescription_fulfillment table.
//           Prevents double-dispensing by checking for an existing record first.
// Body params:
//   record_id      — treatment record ID being fulfilled
//   pharmacist_id  — staff ID of the dispensing pharmacist
//   notes          — optional pharmacist notes
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

// ============================================================
// LAB ROUTES
// Purpose: Endpoints used by the laboratory/diagnostic technician
//          dashboard to manage test orders and upload results.
// ============================================================

// GET /api/lab/stats
// Purpose:  Returns today's lab workload summary:
//           pending (requested), in-progress, and completed today.
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

// GET /api/lab/worklist
// Purpose:  Returns a list of medical tests with full patient and
//           doctor details. Status filter narrows down the view.
// Query params:
//   status — 'requested' (default) | 'in_progress' | 'completed' | 'all'
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

// GET /api/lab/patient-tests
// Purpose:  Looks up a patient by barcode or NIC and returns all
//           their non-cancelled test orders. Used when a patient
//           arrives at the lab for sample collection.
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

// POST /api/lab/update-status
// Purpose:  Updates the status of a test (requested → in_progress → completed).
//           When moving to 'in_progress', also records the sample collection time.
// Body params:
//   test_id       — the test to update
//   status        — new status (in_progress | completed | cancelled)
//   technician_id — optional, staff ID of the lab technician
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

// POST /api/lab/upload-result
// Purpose:  Submits lab test findings/results for a specific test.
//           Uses an UPSERT so results can be corrected if resubmitted.
//           Also auto-marks the test status as 'completed'.
// Body params:
//   test_id     — which test the result belongs to
//   summary     — the actual findings text (required)
//   remarks     — optional additional notes
//   uploaded_by — staff ID of the technician uploading the result
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

// ============================================================
// ADMIN ROUTES
// Purpose: Endpoints for the administrator dashboard — staff
//          management, patient management, reports, OPD settings,
//          audit logs, and system feedback.
// ============================================================

// GET /api/admin/staff
// Purpose:  Returns the full list of all staff members with their
//           role name and active status. Used in the admin staff table.
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

// GET /api/admin/check-email
// Purpose:  Pre-flight check before adding a staff member.
//           Determines which scenario applies for the given email:
//             Scenario A — Brand new person (no existing account)
//             Scenario B — Existing patient account (will be upgraded to dual-role)
//             Scenario C — Already a staff member (rejected)
//           Returns the scenario label and a human-readable message for the admin UI.
// Query params:
//   email — the email to check
app.get('/api/admin/check-email', async (req, res) => {
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

// POST /api/admin/add-staff
// Purpose:  Registers a new staff member.
//           Handles 3 scenarios (A, B, C) matched by check-email.
//           Scenario A — Creates new staff record + new user_account with temp password
//           Scenario B — Creates new staff record + links to existing patient's user_account
//           Scenario C — Rejected (already staff)
//           Sends appropriate onboarding email in each case.
//           Uses a DB transaction for atomicity.
// Body params:
//   staffId, firstName, surname, email, phone, nic — staff details
//   roleName — one of: Doctor, Pharmacist, Receptionist, Diagnostic Technician, Admin
app.post('/api/admin/add-staff', async (req, res) => {
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

// DELETE /api/admin/remove-staff/:staffId
// Purpose:  Soft-deletes a staff member by setting is_active = 0.
//           The record is preserved for audit purposes.
//           The staff member can no longer log in (login check filters is_active=1).
app.delete('/api/admin/remove-staff/:staffId', async (req, res) => {
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

// PATCH /api/admin/reactivate-staff/:staffId
// Purpose:  Re-enables a previously deactivated staff member
//           by setting is_active = 1.
app.patch('/api/admin/reactivate-staff/:staffId', async (req, res) => {
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

// GET /api/admin/patients
// Purpose:  Returns a paginated list of all patients for the admin
//           dashboard. Includes appointment count per patient for
//           activity overview.
// Query params:
//   limit — max records to return (capped at 500, default 200)
app.get('/api/admin/patients', async (req, res) => {
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

// GET /api/admin/dashboard-stats
// Purpose:  Returns key summary metrics for the admin dashboard:
//           - Today's appointment count
//           - Total pending (booked) appointments
//           - Active staff count
//           - OPD operating hours
app.get('/api/admin/dashboard-stats', async (req, res) => {
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

// PATCH /api/admin/patient-status/:id
// Purpose:  Enables or disables a patient account (sets is_active flag).
//           Also attempts to write an audit log entry (non-fatal).
// Body params:
//   is_active — 1 (enable) | 0 (disable)
//   reason    — optional reason text (appended to audit log)
app.patch('/api/admin/patient-status/:id', async (req, res) => {
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

// GET /api/admin/patient-report/:id
// Purpose:  Generates a specific data report for a single patient.
//           Supports appointment history, prescriptions, and lab tests.
// Route params:
//   id — patient_id
// Query params:
//   type — 'patient_history' | 'patient_prescriptions' | 'patient_lab_tests'
app.get('/api/admin/patient-report/:id', async (req, res) => {
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

// GET /api/admin/reports/generate
// Purpose:  Generates system-wide management reports for the admin.
//           Supports multiple report types covering appointments,
//           staff workload, prescriptions, lab tests, and patient growth.
// Query params:
//   type — one of: opd_patient_count, appointment_statistics,
//                  doctor_workload, prescription_statistics,
//                  lab_test_statistics, patient_registration_growth
//   from, to — date range (YYYY-MM-DD)
app.get('/api/admin/reports/generate', async (req, res) => {
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

// GET /api/admin/export-data
// Purpose:  Exports raw data from a whitelisted table as JSON.
//           Allows the admin to download records filtered by date range.
//           Uses whitelist-based column validation to prevent SQL injection.
// Query params:
//   table     — one of: appointments, patient, staff, prescriptions, lab_test, feedback
//   columns   — comma-separated list of column names to include
//   date_from, date_to — optional date range filter
app.get('/api/admin/export-data', async (req, res) => {
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

// GET /api/admin/logs
// Purpose:  Returns the system audit log, optionally filtered by date range.
//           Used by the admin to trace data changes and security events.
// Query params:
//   limit     — max records (capped at 1000, default 500)
//   from, to  — optional date range filter
app.get('/api/admin/logs', async (req, res) => {
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

// GET /api/admin/opd-settings
// Purpose:  Returns current OPD operating settings from the DB.
//           Provides defaults if the settings haven't been configured yet.
app.get('/api/admin/opd-settings', async (req, res) => {
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

// POST /api/admin/opd-settings
// Purpose:  Saves/updates OPD operating configuration.
//           Uses INSERT ... ON DUPLICATE KEY UPDATE so all 5 keys
//           are upserted regardless of whether they exist already.
// Body params:
//   opd_start_hour, opd_end_hour, slot_capacity,
//   consultation_duration, closed_dates (comma-separated date strings)
app.post('/api/admin/opd-settings', async (req, res) => {
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

// GET /api/admin/feedback
// Purpose:  Returns all patient and staff feedback for the admin to review.
//           Joins with patient and staff tables to show submitter names.
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

// PATCH /api/admin/feedback/:id
// Purpose:  Allows the admin to add a note to a specific feedback item
//           and update its review status (e.g., from 'new' to 'reviewed').
// Body params:
//   admin_note — admin's response text
//   status     — e.g., 'reviewed', 'resolved'
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

// ============================================================
// RECEPTIONIST ROUTES
// Purpose: Endpoints for the receptionist dashboard — managing
//          patient arrivals, walk-in registration, and daily queue.
// ============================================================

// GET /api/receptionist/stats
// Purpose:  Returns today's OPD summary stats for the receptionist
//           dashboard: total booked, arrived, pending, and completed.
app.get('/api/receptionist/stats', async (req, res) => {
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

// GET /api/receptionist/queue
// Purpose:  Returns today's full appointment queue with patient details.
//           Sorted by queue number for the display board.
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

// GET /api/receptionist/verify-arrival
// Purpose:  Searches for a patient by barcode or NIC and returns their
//           appointments (recent and today's). Used by the receptionist
//           to confirm who has arrived and check for a valid booking.
// Query params:
//   term — barcode string or NIC
app.get('/api/receptionist/verify-arrival', async (req, res) => {
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

// POST /api/receptionist/mark-arrived
// Purpose:  Sets is_present = 1 for a specific appointment.
//           Only works for appointments currently in 'booked' status
//           to prevent double-marking.
// Body params:
//   appointment_id — the appointment to mark
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

// POST /api/receptionist/register-patient
// Purpose:  Walk-in patient registration at the reception desk.
//           Creates a patient record and user account (using NIC as
//           username if no email/phone is provided).
//           Sends a welcome email if email is available.
// Body params:
//   full_name, nic, dob, gender — required
//   phone, email, address, blood_group, allergies,
//   chronic_conditions, emergency_contact, civil_status — optional
//   password — default 'SmartOPD@123' if not provided
//   registered_by — staff ID of the receptionist (for audit, not currently stored)
app.post('/api/receptionist/register-patient', async (req, res) => {
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

// GET /api/receptionist/appointments
// Purpose:  Returns appointments filtered by date, date range, or all history.
//           Also supports status filtering. Used on the receptionist's
//           appointments management tab.
// Query params:
//   date   — single date (YYYY-MM-DD)
//   from, to — date range
//   status   — optional: specific status to filter by
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

// POST /api/staff/feedback (third definition — with rating and category support)
// Purpose:  The most complete staff feedback submission handler.
//           Supports optional rating (1–5) and category fields.
//           Validates comment length and rating range.
//           Note: This is the last definition of this route, so it
//           overrides the earlier two definitions in Express.
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

// GET /api/staff/feedback/:staff_id (second definition)
// Purpose:  Returns a specific staff member's feedback submission history
//           from the staff_feedback table (not the patient feedback table).
//           Note: Overrides the earlier definition of this route.
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

// ============================================================
// SERVER START
// Purpose:  Starts the HTTP server and binds to all network
//           interfaces (0.0.0.0) on port 5001.
//           Binding to 0.0.0.0 allows access from other devices
//           on the network (e.g., for local development and testing).
// ============================================================
const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
});