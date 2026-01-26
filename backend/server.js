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

    // 1. Hardcoded Admin Bypass
    if (username === 'admin@test.com' && password === 'admin123') {
        return res.json({
            success: true,
            user: { name: "System Admin", role: "admin", username: "admin@test.com", roles: ['admin'] }
        });
    }

    // 2. Fetch User with both Staff and Patient joins
    const sql = `
        SELECT u.user_id, u.username, u.password_hash, u.patient_id, u.staff_id, u.role AS accountRole,
               s.first_name AS staffFirst, s.surname AS staffSur,
               p.first_name AS patFirst, p.surname AS patSur, p.barcode, p.phone,
               r.role_name AS staffRoleName
        FROM user_account u
        LEFT JOIN staff s ON u.staff_id = s.staff_id
        LEFT JOIN patient p ON u.patient_id = p.patient_id
        LEFT JOIN staff_role sr ON s.staff_id = sr.staff_id
        LEFT JOIN role r ON sr.role_id = r.role_id
        WHERE u.username = ? OR p.barcode = ?
    `;

    db.query(sql, [username, username], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (results.length === 0) return res.json({ success: false, message: "User not found" });

        const user = results[0];

        try {
            // 3. Verify Password
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) return res.json({ success: false, message: "Invalid credentials" });

            // 4. Resolve Identity (Prioritize Staff Name for display)
            const displayName = user.staff_id 
                ? `${user.staffFirst} ${user.staffSur}` 
                : `${user.patFirst} ${user.patSur}`;

            // 5. Aggregate ALL Roles
            const roles = [];
            
            // Add specific staff role (Doctor/Receptionist/etc)
            if (user.staff_id) {
                const sRole = user.staffRoleName || user.accountRole;
                if (sRole) roles.push(sRole.toLowerCase());
            }
            
            // Add patient role if linked
            if (user.patient_id) {
                roles.push('patient');
            }

            // 6. Return standard user object
            res.json({
                success: true,
                user: {
                    id: user.user_id,
                    patientId: user.patient_id,
                    staffId: user.staff_id,
                    name: displayName,
                    surname: user.staffSur || user.patSur,
                    email: user.username,
                    username: user.username,
                    phone: user.phone || '',
                    roles: roles, // Array: e.g. ['doctor', 'patient']
                    role: roles[0], // Primary role for legacy frontend support
                    patCode: user.barcode
                }
            });
        } catch (bcryptErr) {
            console.error("Login Error:", bcryptErr);
            res.status(500).json({ success: false, message: "Server error during login" });
        }
    });
});

// Add this to server.js
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 3600000);

    const query = "UPDATE user_account SET reset_token = ?, token_expiry = ? WHERE username = ?";

    db.query(query, [token, expiry, email], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });

        // Email Configuration
        const mailOptions = {
            from: 'bhagya0913@gmail.com',
            to: email,
            subject: 'SmartOPD - Password Reset Code',
            text: `Your password reset code is: ${token}. This code expires in 1 hour.`
        };

        // Send the actual email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ success: false, message: "Email failed to send" });
            }
            res.json({ success: true, message: "Code sent to your email!" });
        });
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
app.post('/api/register', async (req, res) => {
    const { first_name, surname, nic, dob, email, phone, gender, password, isFamilyMember } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) return res.status(500).json({ success: false, message: "Database connection failed" });

        try {
            // 1. Start a transaction to ensure both inserts work or none work
            await connection.promise().beginTransaction();

            // 2. CHECK FOR DUPLICATE EMAIL
            const [existingPatients] = await connection.promise().query(
                "SELECT patient_id FROM patient WHERE email = ?", [email]
            );

            // If email exists and it's NOT from the Family Management section, block it
            if (existingPatients.length > 0 && !isFamilyMember) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: "This email is already registered. If you are a family member, please register through the Family Management section in the dashboard."
                });
            }

            // 3. Insert into Patient Table
            const barcode = "PAT-" + Date.now();
            const sqlPatient = "INSERT INTO patient (first_name, surname, nic, dob, email, phone, gender, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

            const [patientResult] = await connection.promise().query(sqlPatient, [
                first_name,
                surname,
                nic || `DEP-${Date.now()}`, // Fallback for children without NIC
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
                // This is the FIRST person using this email (The Parent/Primary User)
                const hashedPassword = await bcrypt.hash(password, 10);
                await connection.promise().query(
                    "INSERT INTO user_account (username, password_hash, patient_id) VALUES (?, ?, ?)",
                    [email, hashedPassword, newPatientId]
                );
                console.log("Primary User Account Created.");
            } else {
                // This is a family member. We do NOT create a new user_account.
                // They just exist in the 'patient' table linked by email.
                console.log("Family member profile linked to existing account.");
            }

            // 5. Commit Transaction
            await connection.promise().commit();
            connection.release();

            res.json({
                success: true,
                barcode: barcode,
                message: isFamilyMember ? "Family member added!" : "Registration successful!"
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
            p.first_name, 
            p.surname, 
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
    // 1. Destructure data
    const { patientId, date, timeSlot } = req.body;

    // 2. Immediate validation check
    if (!patientId || !date || !timeSlot) {
        return res.status(400).json({ success: false, message: "Missing required fields (ID, Date, or Time)." });
    }

    console.log(`Booking attempt - Patient: ${patientId}, Date: ${date}, Slot: ${timeSlot}`);

    // --- STEP 1: PREVENT DOUBLE BOOKING ---
    // If your DB still errors here, change 'appointment_day' to your actual column name
    const doubleBookCheck = `SELECT * FROM appointment WHERE patient_id = ? AND appointment_day = ? AND status != 'cancelled'`;

    db.query(doubleBookCheck, [patientId, date], (err, results) => {
        if (err) {
            console.error("Step 1 (Double Booking) Error:", err.message);
            return res.status(500).json({ success: false, message: "Database Check Error: " + err.message });
        }

        if (results.length > 0) {
            return res.json({ success: false, message: "You already have an appointment on this date." });
        }

        // --- STEP 2: CAPACITY & TOKEN LOGIC ---
        // Note: I am using 'time_slot'. Ensure you ran the ALTER TABLE command in MySQL!
        const capacityQuery = `
            SELECT COUNT(*) as count 
            FROM appointment 
            WHERE appointment_day = ? AND time_slot = ? AND status != 'cancelled'
        `;

        db.query(capacityQuery, [date, timeSlot], (err, results) => {
            if (err) {
                console.error("Step 2 (Capacity) Error:", err.message);
                return res.status(500).json({ success: false, message: "Capacity Check Error: " + err.message });
            }

            const bookedCount = results[0].count;
            if (bookedCount >= 6) {
                return res.json({ success: false, message: "This time slot is full (Max 6 patients)." });
            }

            const newTokenNo = bookedCount + 1;

            // --- STEP 3: INSERT APPOINTMENT ---
            const insertQuery = `
                INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status) 
                VALUES (?, ?, ?, ?, 'booked')
            `;

            db.query(insertQuery, [patientId, date, timeSlot, newTokenNo], (err, result) => {
                if (err) {
                    console.error("Step 3 (Insert) Error:", err.message);
                    return res.status(500).json({ success: false, message: "Booking failed: " + err.message });
                }

                res.json({
                    success: true,
                    tokenNo: newTokenNo,
                    date: date,
                    timeSlot: timeSlot
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
    const term = req.query.term;
    const sql = "SELECT * FROM patient WHERE nic = ? OR patient_id = ?";
    db.query(sql, [term, term], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        if (results.length > 0) res.json({ success: true, patient: results[0] });
        else res.json({ success: false });
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
    const { patient_id, doctor_id, findings, medicines } = req.body;

    // 1. Insert into treatment_record
    const treatmentSql = "INSERT INTO treatment_record (patient_id, treatment_details, created_by, consultation_day) VALUES (?, ?, ?, NOW())";

    db.query(treatmentSql, [patient_id, findings, doctor_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // 2. If there are medicines, insert them into the prescription table
        if (medicines && medicines.length > 0) {
            const prescriptionSql = "INSERT INTO prescription (patient_id, details, date_issued, issued_by) VALUES ?";

            // Format medicines into a single string or multiple rows
            // Here we format them as: "Panadol (1x3) - After food"
            const values = medicines.map(m => [
                patient_id,
                `${m.name} -- ${m.note}`,
                new Date(),
                doctor_id
            ]);

            db.query(prescriptionSql, [values], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Success! Record and Prescription saved." });
            });
        } else {
            res.json({ message: "Success! Record saved (no prescriptions)." });
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

// Updated Listen
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
// console.log(`Server running on port ${PORT}`);
//});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => { // Adding '0.0.0.0' forces it to listen on all local paths
    console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
});