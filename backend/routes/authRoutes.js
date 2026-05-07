const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/db');
const transporter = require('../config/email');
const generateBarcodeDataURL = require('../utils/barcode');
const { buildRegistrationEmail, buildRegistrationEmailForExistingStaff } = require('../utils/emailTemplates');

const router = express.Router();

 
router.post('/forgot-password', async (req, res) => {
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

 
router.post('/verify-token', async (req, res) => {
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

 
router.post('/reset-password', async (req, res) => {
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

 
router.post('/reset-password', async (req, res) => {
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

 
router.post('/send-registration-otp', async (req, res) => {
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

 
router.post('/send-registration-sms-otp', async (req, res) => {
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


router.post('/verify-registration-otp', async (req, res) => {
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


router.post('/verify-registration-sms-otp', async (req, res) => {
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


router.post('/register', async (req, res) => {
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


router.post('/login', async (req, res) => {
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


module.exports = router;
