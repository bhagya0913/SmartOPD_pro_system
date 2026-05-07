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


// Mount routes with /api prefix
app.use('/api', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', doctorRoutes);
app.use('/api', pharmacistRoutes);
app.use('/api', labRoutes);
app.use('/api', receptionistRoutes);
app.use('/api', adminRoutes);


const otpStore = new Map();


const pool = mysql.createPool({
    host:               process.env.DB_HOST || 'localhost',
    port:               3307,                              // Custom MySQL port (default is 3306)
    user:               process.env.DB_USER || 'root',
    password:           process.env.DB_PASS,
    database:           process.env.DB_NAME || 'hospital_db',
    waitForConnections: true,   // Queue requests if all connections are busy
    connectionLimit:    10,     // Maximum 10 concurrent connections
    queueLimit:         0       // Unlimited queue size
});

// Wrap the pool with Promise support so we can use async/await
const db = pool.promise();


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
initDB(); 


const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
});