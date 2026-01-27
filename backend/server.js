require('dotenv').config();
const express = require('express');
const mysql = require('mysql2'); // 1. Changed to mysql2 for .promise() support
const cors = require('cors');
const bcrypt = require('bcrypt');
const bwipjs = require('bwip-js');
const nodemailer = require('nodemailer');
const app = express();

app.use(cors());
app.use(express.json()); // 3. Replaced bodyParser with express.json()


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bhagya0913@gmail.com', // my gmail
        pass: 'nfzunxjlstdszaba'    // 16-character App Password
    }
});


// 1. Connection to your hospital_db
// TO THIS:
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: 3307, // Keeping your 3307 hardcoded since your XAMPP is likely set there
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '757135@bhagikLn',
    database: process.env.DB_NAME || 'hospital_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Replace your current pool connection check with this:

db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ DATABASE CONNECTION FAILED:");
        console.error("Code:", err.code);
        console.error("Port attempted:", err.port);
        console.error("Check if XAMPP/MySQL is running.");
    } else {
        console.log("✅ DATABASE CONNECTED SUCCESSFULLY ON PORT", process.env.DB_PORT || 3307);
        connection.release();
    }
});

// 2. Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Admin Bypass
    if (username === 'admin@test.com' && password === 'admin123') {
        return res.json({
            success: true,
            user: { name: "System Admin", role: "admin", username: "admin@test.com", roles: ['admin'] }
        });
    }

    // 2. Optimized SQL for your specific schema
    const sql = `
        SELECT 
            u.user_id, u.username, u.password_hash, u.patient_id, u.staff_id,
            s.full_name AS staffName, 
            p.full_name AS patName, p.barcode,
            r.role_name AS staffRole
        FROM user_account u
        LEFT JOIN staff s ON u.staff_id = s.staff_id
        LEFT JOIN patient p ON u.patient_id = p.patient_id
        LEFT JOIN roles r ON s.role_id = r.role_id
        WHERE u.username = ? OR p.barcode = ?
    `;

    db.query(sql, [username, username], async (err, results) => {
        if (err) {
            console.error("DB Error:", err); 
            return res.status(500).json({ success: false, message: "Database query failed" });
        }
        
        if (results.length === 0) return res.json({ success: false, message: "User not found" });

        const user = results[0];

        try {
            // 3. Verify Password
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) return res.json({ success: false, message: "Invalid credentials" });

            // 4. Resolve Name and Roles
            const displayName = user.staff_id ? user.staffName : user.patName;
            
            const roles = [];
            if (user.staff_id && user.staffRole) {
                roles.push(user.staffRole.toLowerCase());
            }
            if (user.patient_id) {
                roles.push('patient');
            }

            res.json({
                success: true,
                user: {
                    id: user.user_id,
                    patientId: user.patient_id,
                    staffId: user.staff_id,
                    name: displayName,
                    email: user.username,
                    roles: roles, // e.g., ['doctor'] or ['patient']
                    patCode: user.barcode
                }
            });
        } catch (bcryptErr) {
            console.error("Bcrypt Error:", bcryptErr);
            res.status(500).json({ success: false, message: "Server error during login" });
        }
    });
});

// Add this to server.js
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    console.log("Attempting password reset for:", email);

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 3600000);

    const query = "UPDATE user_account SET reset_token = ?, token_expiry = ? WHERE username = ?";

    db.query(query, [token, expiry, email], (err, result) => {
        if (err) {
            console.error("Database Error:", err); // Look at your terminal!
            return res.status(500).json({ success: false, error: err.message });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 3. Send Email to the ENTERED email address
        const mailOptions = {
            from: '"SmartOPD Support" <bhagya0913@gmail.com>',
            to: email, // This sends it to whoever the user entered in the form
            subject: 'Your Password Reset Code - SmartOPD',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h2 style="color: #2563eb;">SmartOPD Password Reset</h2>
                    <p>You requested a password reset. Please use the following code:</p>
                    <h1 style="background: #f3f4f6; padding: 10px; text-align: center; letter-spacing: 5px; color: #1e40af;">
                        ${token}
                    </h1>
                    <p>This code will expire in <strong>1 hour</strong>.</p>
                    <hr />
                    <p style="font-size: 0.8rem; color: #6b7280;">If you did not request this, please ignore this email.</p>
                </div>
            `
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Mail Error:", error); // This is likely where it fails
                return res.status(500).json({ success: false, message: "Email failed to send" });
            }
            console.log("Email sent to: " + email);
            res.json({ success: true, message: "Code sent to your email!" });
        });
    });
});

app.post('/verify-token', (req, res) => {
    const { email, token } = req.body;

    const query = `
        SELECT * FROM user_account 
        WHERE username = ? AND reset_token = ? AND token_expiry > NOW()`;

    db.query(query, [email, token], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        if (result.length > 0) {
            res.json({ success: true, message: "Token verified!" });
        } else {
            res.status(400).json({ success: false, message: "Invalid or expired code." });
        }
    });
});

// Route to actually update the password
app.post('/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const query = `
        UPDATE user_account 
        SET password_hash = ?, reset_token = NULL, token_expiry = NULL 
        WHERE username = ? AND reset_token = ? AND token_expiry > NOW()`;

    db.query(query, [hashedPassword, email, token], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(400).json({ message: "Invalid or expired token" });

        res.json({ success: true, message: "Password updated successfully!" });
    });
});

// const PORT = 5001;
// Check this in your server.js
app.post('/api/update-profile-full', (req, res) => {
    const {
        patientId,
        first_name, surname, nic, phone,
        address_line1, city, blood_group,
        weight_kg, height_cm, allergies
    } = req.body;

    console.log(`Attempting update for User ID: ${patientId}, First Name: ${first_name}`);

    // Professional SQL: Explicitly matching placeholders to columns
    const sql = `
        UPDATE patient 
    SET first_name = ?, surname = ?, nic = ?, phone = ?, 
        address_line1 = ?, city = ?, blood_group = ?, 
        weight_kg = ?, height_cm = ?, allergies = ?
    WHERE patient_id = ?
    `;

    // Ensure parameters match the exact order of '?' above
    const params = [
        first_name || null,      // 1
        surname || null,         // 2
        nic || null,             // 3
        phone || null,           // 4
        address_line1 || null,   // 5
        city || null,            // 6
        blood_group || null,     // 7
        weight_kg === "" ? null : weight_kg, // 8 (Handles numeric conversion)
        height_cm === "" ? null : height_cm, // 9 (Handles numeric conversion)
        allergies || null,       // 10
        patientId                 // 11
    ];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("Update Error:", err);
            return res.status(500).json({ success: false, message: "DB Error: " + err.message });
        }
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: "No changes made or user not found" });
        }
        res.json({ success: true, message: "Profile updated successfully" });
    });
});

// server.js - Registration Route
// server.js - Registration Route
app.post('/api/register', async (req, res) => {
    // 1. Destructure full_name instead of first/surname
    const { full_name, nic, dob, email, phone, gender, password, isFamilyMember } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) return res.status(500).json({ success: false, message: "Database connection failed" });

        try {
            await connection.promise().beginTransaction();

            // 2. CHECK FOR DUPLICATE EMAIL
            const [existingPatients] = await connection.promise().query(
                "SELECT patient_id FROM patient WHERE email = ?", [email]
            );

            if (existingPatients.length > 0 && !isFamilyMember) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: "This email is already registered. Family members should be added via the dashboard."
                });
            }

            // 3. Insert into Patient Table (Updated SQL to use full_name)
            const barcode = "PAT-" + Date.now();
            const sqlPatient = "INSERT INTO patient (full_name, nic, dob, email, phone, gender, barcode) VALUES (?, ?, ?, ?, ?, ?, ?)";

            const [patientResult] = await connection.promise().query(sqlPatient, [
                full_name,         // Single variable now
                nic || `DEP-${Date.now()}`, 
                dob,
                email,
                phone || '',
                gender,
                barcode
            ]);

            const newPatientId = patientResult.insertId;

            // 4. Handle User Account creation
            const [userExists] = await connection.promise().query(
                "SELECT user_id FROM user_account WHERE username = ?", [email]
            );

            if (userExists.length === 0) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await connection.promise().query(
                    "INSERT INTO user_account (username, password_hash, patient_id) VALUES (?, ?, ?)",
                    [email, hashedPassword, newPatientId]
                );
            }

            await connection.promise().commit();
            connection.release();

            res.json({
                success: true,
                barcode: barcode,
                message: isFamilyMember ? "Family profile added!" : "Registration successful!"
            });

        } catch (error) {
            await connection.promise().rollback();
            connection.release();
            console.error("Registration Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

app.get('/api/family-members', (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).json({ success: false, message: "Email parameter is required" });
    }

    // Updated query to fetch all necessary patient details
    const query = `
        SELECT 
            p.patient_id, 
            p.full_name,
            p.barcode, 
            p.gender, 
            p.dob,
            u.user_id,
            u.username
        FROM patient p
        LEFT JOIN user_account u ON p.patient_id = u.patient_id
        WHERE p.email = ?
    `;

    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Failed to fetch family members" });
        }

        res.json({
            success: true,
            members: results
        });
    });
});

app.post('/api/book-appointment', (req, res) => {
    const { patientId, date, timeSlot } = req.body;

    // --- STEP 0: ADMIN OVERRIDE CHECK ---
    // Check if the OPD is closed or if this specific time is disabled
    const adminCheck = `
        SELECT status FROM clinic_schedule 
        WHERE schedule_date = ? 
        AND (time_slot = ? OR time_slot = 'ALL_DAY')
    `;

    db.query(adminCheck, [date, timeSlot], (err, adminResults) => {
        if (err) console.error("Admin Check Error:", err); // Log but don't crash if table doesn't exist yet
        
        if (adminResults && adminResults.length > 0 && adminResults[0].status === 'closed') {
            return res.json({ success: false, message: "The OPD is closed for the selected time. Please choose another date." });
        }

        // --- STEP 1: PREVENT DOUBLE BOOKING FOR THIS SPECIFIC ID ---
        const doubleBookCheck = `
            SELECT * FROM appointment 
            WHERE patient_id = ? 
            AND appointment_day = ? 
            AND status != 'cancelled'
        `;

        db.query(doubleBookCheck, [patientId, date], (err, results) => {
            if (err) return res.status(500).json({ success: false, message: "DB Error 1: " + err.sqlMessage });

            // Here we check if the SAME person already has an appointment ON THIS DAY
            // If you want them to book multiple slots in one day, add "AND time_slot = ?" to the query above
            if (results.length > 0) {
                return res.json({ success: false, message: "This patient already has an appointment booked for today." });
            }

            // --- STEP 2: CAPACITY CHECK (The 6-Patient Limit) ---
            const capacityQuery = `
                SELECT COUNT(*) as count 
                FROM appointment 
                WHERE appointment_day = ? AND time_slot = ? AND status != 'cancelled'
            `;

            db.query(capacityQuery, [date, timeSlot], (err, results) => {
                if (err) return res.status(500).json({ success: false, message: "Capacity Query Error" });

                const bookedCount = results[0].count;
                if (bookedCount >= 6) {
                    return res.json({ success: false, message: "This time slot is full (Max 6 patients per hour)." });
                }

                const newTokenNo = bookedCount + 1;

                // --- STEP 3: FINAL INSERT ---
                const insertQuery = `
                    INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status) 
                    VALUES (?, ?, ?, ?, 'booked')
                `;

                db.query(insertQuery, [patientId, date, timeSlot, newTokenNo], (err, result) => {
                    if (err) return res.status(500).json({ success: false, message: "Insert Error: " + err.sqlMessage });

                    res.json({ success: true, tokenNo: newTokenNo, message: "Appointment confirmed!" });
                });
            });
        });
    });
});

app.get('/api/my-appointments', (req, res) => {
    const { patientId } = req.query;
    const sql = "SELECT * FROM appointment WHERE patient_id = ? AND status != 'cancelled' ORDER BY appointment_day ASC, token_no ASC";

    db.query(sql, [patientId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, appointments: results });
    });
});

// --- CANCEL APPOINTMENT ---
app.post('/api/cancel-appointment', (req, res) => {
    const { appointmentId } = req.body;

    const sql = "UPDATE appointment SET status = 'cancelled' WHERE appointment_id = ?";

    db.query(sql, [appointmentId], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Appointment not found" });

        res.json({ success: true, message: "Appointment cancelled successfully" });
    });
});

app.get('/api/live-queue', (req, res) => {
    const { date, timeSlot } = req.query;

    // Get the token currently marked as 'active'
    const sql = `SELECT token_no FROM appointment 
                 WHERE appointment_day = ? AND time_slot = ? AND status = 'active' 
                 LIMIT 1`;

    db.query(sql, [date, timeSlot], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({
            success: true,
            currentServing: results.length > 0 ? results[0].token_no : "Waiting to start"
        });
    });
});

// 1. Submit Feedback
app.post('/api/feedback', (req, res) => {
    const { patientId, rating, comment } = req.body;
    const sql = "INSERT INTO feedback (patient_id, rating, comment) VALUES (?, ?, ?)";
    db.query(sql, [patientId, rating, comment], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, message: "Thank you for your feedback!" });
    });
});

// 2. Get Feedback History
app.get('/api/feedback/:patientId', (req, res) => {
    const sql = "SELECT * FROM feedback WHERE patient_id = ? ORDER BY submitted_at DESC";
    db.query(sql, [req.params.patientId], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// --- ADMIN: GET ALL STAFF ---
app.get('/api/admin/staff', (req, res) => {
    const query = `
        SELECT s.staff_id, s.first_name, s.surname, s.email, r.role_name, s.active
        FROM staff s
        LEFT JOIN staff_role sr ON s.staff_id = sr.staff_id
        LEFT JOIN role r ON sr.role_id = r.role_id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// --- ADMIN: ADD NEW STAFF ---
app.post('/api/admin/add-staff', async (req, res) => {
    const { first_name, firstName, surname, email, roleName } = req.body;
    const finalFirstName = first_name || firstName;

    if (!finalFirstName || !surname || !email) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Prepare Credentials
    const defaultPassword = `${surname}@OPD${Math.floor(100 + Math.random() * 900)}`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert into staff table (Use IGNORE or handle existing)
        const [staffRes] = await connection.query(
            "INSERT INTO staff (first_name, surname, email) VALUES (?, ?, ?)",
            [finalFirstName, surname, email]
        );
        const staffId = staffRes.insertId;

        // 2. Multi-Role Logic: Check if user_account already exists (e.g., as a patient)
        const [existingUser] = await connection.query(
            "SELECT user_id, staff_id FROM user_account WHERE username = ?",
            [email]
        );

        if (existingUser.length > 0) {
            // If they are already a staff member, prevent duplicate staff registration
            if (existingUser[0].staff_id) {
                throw new Error("This email is already registered to a staff member.");
            }

            // If they were just a patient, update account with staff_id, role, and NEW password
            await connection.query(
                "UPDATE user_account SET staff_id = ?, role = ?, password_hash = ? WHERE username = ?",
                [staffId, roleName.toLowerCase(), hashedPassword, email]
            );
        } else {
            // Brand new account
            await connection.query(
                "INSERT INTO user_account (username, password_hash, role, staff_id) VALUES (?, ?, ?, ?)",
                [email, hashedPassword, roleName.toLowerCase(), staffId]
            );
        }

        // 3. Sync with Link Table (staff_role)
        const [roleLookup] = await connection.query("SELECT role_id FROM role WHERE role_name = ?", [roleName]);
        if (roleLookup.length > 0) {
            await connection.query(
                "INSERT INTO staff_role (staff_id, role_id) VALUES (?, ?)",
                [staffId, roleLookup[0].role_id]
            );
        }

        // 4. Send Email Notification
        const mailOptions = {
            from: `"SmartOPD" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'SmartOPD Staff Account Created',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h3 style="color: #2563eb;">Welcome to the Team, ${finalFirstName}!</h3>
                    <p>A staff account has been linked to this email address.</p>
                    <p><b>Username:</b> ${email}</p>
                    <p><b>Temporary Password:</b> <span style="background: #ffff00; padding: 2px;">${defaultPassword}</span></p>
                    <hr />
                    <p>If you were previously a patient, your login now grants you <b>${roleName}</b> access.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        await connection.commit();
        res.json({ success: true, message: "Staff added and credentials emailed!" });

    } catch (error) {
        await connection.rollback();
        console.error("Staff Addition Error:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

app.delete('/api/admin/remove-staff/:id', (req, res) => {
    const staffId = req.params.id;

    db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ success: false, message: "Connection Error" });

        connection.beginTransaction((err) => {
            // STEP 1: Delete from user_account first (Child Table)
            const q1 = "DELETE FROM user_account WHERE staff_id = ?";
            connection.query(q1, [staffId], (err) => {
                if (err) return connection.rollback(() => { connection.release(); res.status(500).json(err); });

                // STEP 2: Delete from staff_role (Junction Table)
                const q2 = "DELETE FROM staff_role WHERE staff_id = ?";
                connection.query(q2, [staffId], (err) => {
                    if (err) return connection.rollback(() => { connection.release(); res.status(500).json(err); });

                    // STEP 3: Delete from staff (Parent Table)
                    const q3 = "DELETE FROM staff WHERE staff_id = ?";
                    connection.query(q3, [staffId], (err) => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json(err); });

                        connection.commit((err) => {
                            if (err) return connection.rollback(() => { connection.release(); res.status(500).json(err); });

                            connection.release();
                            res.json({ success: true, message: "Staff member removed successfully" });
                        });
                    });
                });
            });
        });
    });
});

// --- ADMIN: UPDATE OPD SETTINGS ---
app.post('/api/admin/settings', (req, res) => {
    const { dailyQuota, startTime, endTime } = req.body;
    const query = `
        UPDATE system_setting 
        SET daily_quota = ?, opd_start_time = ?, opd_end_time = ? 
        ORDER BY setting_id DESC LIMIT 1
    `;
    db.query(query, [dailyQuota, startTime, endTime], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// 1. Unified Search (Handles NIC or ID)                                                                                                                                    
app.get('/api/doctor/search-patient', (req, res) => {
    const term = req.query.term ? req.query.term.trim() : '';

    if (!term) {
        return res.status(400).json({ success: false, message: "No search term provided" });
    }

    // Using %term% allows for partial matches and avoids strict type errors in some SQL modes
    const sql = `
        SELECT * FROM patient 
        WHERE nic = ? 
        OR patient_id = ? 
        OR barcode = ?
        LIMIT 1
    `;

    db.query(sql, [term, term, term], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length > 0) {
            res.json({ success: true, patient: results[0] });
        } else {
            res.json({ success: false, message: "No patient record found for this ID" });
        }
    });
});

// 2. Patient History Fetch
app.get('/api/doctor/patient-history/:patientId', (req, res) => {
    const { patientId } = req.params;

    const sql = `
        SELECT 
            tr.record_id,
            ANY_VALUE(tr.consultation_day) AS consultation_day, 
            ANY_VALUE(tr.treatment_details) AS treatment_details, 
            -- We group only medicines that were issued at the SAME TIME as the treatment record
            GROUP_CONCAT(p.details SEPARATOR '\n---\n') AS prescription_details,
            ANY_VALUE(CONCAT(s.first_name, ' ', s.surname)) AS doctor_name,
            ANY_VALUE(DATE_FORMAT(tr.created_at, '%H:%i')) as consultation_time
        FROM treatment_record tr
        LEFT JOIN staff s ON tr.created_by = s.staff_id
        LEFT JOIN prescription p ON tr.patient_id = p.patient_id 
             /* Fix: Match by specific timestamp to avoid pulling old prescriptions */
             AND ABS(TIMESTAMPDIFF(SECOND, tr.created_at, p.date_issued)) < 60
        WHERE tr.patient_id = ?
        GROUP BY tr.record_id
        ORDER BY tr.consultation_day DESC, tr.created_at DESC;
    `;

    db.query(sql, [patientId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 3. Save Consultation
app.post('/api/doctor/save-consultation', (req, res) => {
    const { patient_id, doctor_id, findings, medicines, appointment_id } = req.body;

    // Use a placeholder if appointment_id is missing to avoid FK errors
    // Or ensure your table allows NULL for appointment_id
    const apptId = appointment_id || null; 

    // Generate a unique string for the treatment_id column
    const treatment_uuid = `TRMT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const treatmentSql = `
        INSERT INTO treatment_record 
        (appointment_id, treatment_details, created_by, consultation_day, priority) 
        VALUES (?, ?, ?, CURDATE(), 'normal')
    `;
    db.query(treatmentSql, [treatment_uuid, appointment_id, findings, doctor_id], (err, result) =>{
        if (err) {
            console.error("DATABASE ERROR:", err.sqlMessage); // Look at your terminal!
            return res.status(500).json({ success: false, error: err.message });
        }

        if (medicines && medicines.length > 0) {
            const prescriptionSql = "INSERT INTO prescription (appointment_id, issued_by, date_issued, details) VALUES ?";
            const values = medicines.map(m => [
                apptId,
                doctor_id,
                new Date(),
                `${m.name} -- ${m.note}`
            ]);

            db.query(prescriptionSql, [values], (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, message: "Saved with Prescriptions" });
            });
        } else {
            res.json({ success: true, message: "Saved findings only" });
        }
    });
});

app.post('/api/doctor/request-lab', (req, res) => {
    const { patientId, doctorId, testName, priority } = req.body;
    const sql = "INSERT INTO lab_request (patient_id, requested_by, test_name, priority, status) VALUES (?, ?, ?, ?, 'pending')";

    db.query(sql, [patientId, doctorId, testName, priority], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: "Lab request sent!" });
    });
});

app.post('/api/doctor/create-referral', (req, res) => {
    const { appointment_id, doctor_id, reason, specialist_id } = req.body;
    const sql = "INSERT INTO referral (appointment_id, issued_by, referral_date, reason, specialist_id) VALUES (?, ?, NOW(), ?, ?)";
    
    db.query(sql, [appointment_id, doctor_id, reason, specialist_id], (err, result) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// 1. Get Pending Prescriptions for a patient
app.get('/api/pharmacist/pending-prescriptions', (req, res) => {
    const term = req.query.term;
    const sql = `
        SELECT p.*, pt.first_name as patient_name, pt.patient_id, s.first_name as doctor_name
        FROM prescription p
        JOIN patient pt ON p.patient_id = pt.patient_id OR pt.nic = ?
        JOIN staff s ON p.issued_by = s.staff_id
        LEFT JOIN prescription_fulfillment pf ON p.prescription_id = pf.prescription_id
        WHERE pf.prescription_id IS NULL AND (pt.nic = ? OR pt.patient_id = ?)
    `;

    db.query(sql, [term, term, term], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. Fulfill a Prescription
app.post('/api/pharmacist/fulfill', (req, res) => {
    const { prescription_id, pharmacist_id } = req.body;
    const sql = "INSERT INTO prescription_fulfillment (prescription_id, pharmacist_id, fulfilled_at, notes) VALUES (?, ?, NOW(), 'Dispensed at Pharmacy')";

    db.query(sql, [prescription_id, pharmacist_id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => { // Adding '0.0.0.0' forces it to listen on all local paths
    console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
});