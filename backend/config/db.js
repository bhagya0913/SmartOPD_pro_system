// config/db.js
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'hospital_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

async function initDB() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS otp_verification (
                contact_value VARCHAR(255) PRIMARY KEY,
                contact_type VARCHAR(20) NOT NULL,
                otp_code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS patient_family (
                id INT AUTO_INCREMENT PRIMARY KEY,
                primary_patient_id BIGINT NOT NULL,
                member_patient_id BIGINT NOT NULL,
                relation VARCHAR(50) DEFAULT NULL,
                created_at DATETIME DEFAULT NOW(),
                UNIQUE KEY uq_link (primary_patient_id, member_patient_id)
            )
        `);
        console.log('Database tables verified.');
    } catch (err) {
        console.error('Database init error:', err);
        throw err;
    }
}

module.exports = { db, initDB };