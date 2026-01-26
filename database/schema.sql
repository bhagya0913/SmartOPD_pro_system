-- Healthcare Management System Schema (MySQL)

-- Create the database
DROP DATABASE IF EXISTS hospital_db;
CREATE DATABASE hospital_db;
USE hospital_db;

-- Drop existing tables if needed
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS staff_role, user_account, staff, role, patient, notification, feedback, feedback_view,
system_setting, audit_log, appointment, queue, queue_handler, treatment_record,
prescription, prescription_fulfillment, referral,
diagnostic_test_request, diagnostic_assignment, test_result, file_store, test_result_file,
report;
SET FOREIGN_KEY_CHECKS = 1;

-- Role table
CREATE TABLE role (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

-- Staff table
CREATE TABLE staff (
  staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  mid_name VARCHAR(100),
  surname VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Staff-Role junction table
CREATE TABLE staff_role (
  staff_id BIGINT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (staff_id, role_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
  FOREIGN KEY (role_id) REFERENCES role(role_id)
);

-- User account table
CREATE TABLE user_account (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  staff_id BIGINT UNIQUE,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  last_login DATETIME,
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

-- Patient table
CREATE TABLE patient (
  patient_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  dob DATE,
  first_name VARCHAR(100) NOT NULL,
  mid_name VARCHAR(100),
  surname VARCHAR(100) NOT NULL,
  gender ENUM('Male','Female','Other'),
  email VARCHAR(255),
  phone VARCHAR(30),
  address TEXT,
  age INT,
  barcode VARCHAR(64) UNIQUE
);

-- Notification table
CREATE TABLE notification (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  sent_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('queued','sent','failed','read') NOT NULL,
  message TEXT NOT NULL,
  type ENUM('sms','email','push','in_app') NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
);

-- Feedback table
CREATE TABLE feedback (
  feedback_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP,
  comments TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
);

-- Feedback view log
CREATE TABLE feedback_view (
  feedback_id BIGINT NOT NULL,
  staff_id BIGINT NOT NULL,
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id, staff_id),
  FOREIGN KEY (feedback_id) REFERENCES feedback(feedback_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

-- System setting table
CREATE TABLE system_setting (
  setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cpd_hours INT,
  daily_quota INT,
  services TEXT,
  staff_handler VARCHAR(100),
  updated_by BIGINT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES staff(staff_id)
);

-- Audit log table
CREATE TABLE audit_log (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actor_staff_id BIGINT,
  action TEXT NOT NULL,
  entity VARCHAR(80),
  entity_id BIGINT,
  FOREIGN KEY (actor_staff_id) REFERENCES staff(staff_id)
);

-- Appointment table
CREATE TABLE appointment (
  appointment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_id BIGINT NOT NULL,
  doctor_id BIGINT,
  status ENUM('booked','checked_in','in_progress','completed','cancelled','no_show') NOT NULL,
  appointment_day DATE NOT NULL,
  queue_no INT,
  created_by BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES staff(staff_id),
  FOREIGN KEY (created_by) REFERENCES staff(staff_id)
);

-- Queue table
CREATE TABLE queue (
  queue_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT UNIQUE,
  sent_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('waiting','called','skipped','served') NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id)
);

-- Queue handler log
CREATE TABLE queue_handler (
  queue_id BIGINT NOT NULL,
  staff_id BIGINT NOT NULL,
  handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  action ENUM('enqueue','call','skip','serve') NOT NULL,
  PRIMARY KEY (queue_id, staff_id, handled_at),
  FOREIGN KEY (queue_id) REFERENCES queue(queue_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

-- Treatment record
CREATE TABLE treatment_record (
  record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT NOT NULL,
  treatment_id VARCHAR(50),
  treatment_details TEXT,
  consultation_day DATE NOT NULL,
  estimated_wait INT,
  priority ENUM('low','normal','high','urgent'),
  created_by BIGINT,
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id),
  FOREIGN KEY (created_by) REFERENCES staff(staff_id)
);

-- Prescription table
CREATE TABLE prescription (
  prescription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT NOT NULL,
  issued_by BIGINT NOT NULL,
  date_issued DATETIME DEFAULT CURRENT_TIMESTAMP,
  details TEXT NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id),
  FOREIGN KEY (issued_by) REFERENCES staff(staff_id)
);

-- Prescription fulfillment log
CREATE TABLE prescription_fulfillment (
  prescription_id BIGINT NOT NULL,
  pharmacist_id BIGINT NOT NULL,
  fulfilled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  PRIMARY KEY (prescription_id, pharmacist_id, fulfilled_at),
  FOREIGN KEY (prescription_id) REFERENCES prescription(prescription_id),
  FOREIGN KEY (pharmacist_id) REFERENCES staff(staff_id)
);

-- Referral table
CREATE TABLE referral (
  referral_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT NOT NULL,
  issued_by BIGINT,
 referral_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  specialist_id BIGINT,
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id),
  FOREIGN KEY (issued_by) REFERENCES staff(staff_id),
  FOREIGN KEY (specialist_id) REFERENCES staff(staff_id)
);

-- Diagnostic test request
CREATE TABLE diagnostic_test_request (
  test_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  appointment_id BIGINT NOT NULL,
  requested_by BIGINT,
  test_type ENUM('xray','ecg','lab','ultrasound','ct','mri','other') NOT NULL,
  status ENUM('requested','in_progress','completed','cancelled') NOT NULL,
  result_file_hint TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id),
  FOREIGN KEY (requested_by) REFERENCES staff(staff_id)
);

-- Diagnostic assignment
CREATE TABLE diagnostic_assignment (
  test_id BIGINT NOT NULL,
  technician_id BIGINT NOT NULL,
  role_at_time VARCHAR(50),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (test_id, technician_id, assigned_at),
  FOREIGN KEY (test_id) REFERENCES diagnostic_test_request(test_id),
  FOREIGN KEY (technician_id) REFERENCES staff(staff_id)
);

-- Test result
CREATE TABLE test_result (
  test_result_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  test_id BIGINT UNIQUE NOT NULL,
  uploaded_by BIGINT,
  date_uploaded DATETIME DEFAULT CURRENT_TIMESTAMP,
  summary TEXT,
  FOREIGN KEY (test_id) REFERENCES diagnostic_test_request(test_id),
  FOREIGN KEY (uploaded_by) REFERENCES staff(staff_id)
);

-- File store
CREATE TABLE file_store (
  file_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Test result file mapping
CREATE TABLE test_result_file (
  test_result_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  PRIMARY KEY (test_result_id, file_id),
  FOREIGN KEY (test_result_id) REFERENCES test_result(test_result_id),
  FOREIGN KEY (file_id) REFERENCES file_store(file_id)
);

-- Report table
CREATE TABLE report (
  report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  details TEXT,
  print_date DATETIME,
  requested_by BIGINT,
  FOREIGN KEY (requested_by) REFERENCES staff(staff_id)
);

-- add the roles for the system
-- 1. Disable safety checks
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Clear the table
TRUNCATE TABLE role; 

-- 3. Add your new roles
INSERT INTO role (role_name) VALUES 
('Admin'), 
('Doctor'), 
('Specialist Consultant'), 
('Receptionist'), 
('Pharmacist'), 
('Patient');

-- 4. Re-enable safety checks
SET FOREIGN_KEY_CHECKS = 1;

-- make staff_id optional (NULL) and add a patient_id column to the user_account table.
ALTER TABLE user_account ADD COLUMN patient_id BIGINT UNIQUE AFTER staff_id;
ALTER TABLE user_account ADD CONSTRAINT fk_user_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id);

SELECT p.email, u.username, u.password_hash 
FROM patient p 
JOIN user_account u ON p.patient_id = u.patient_id;appointmentuser_account

-- Adding medical columns that a patient can update later
ALTER TABLE patient 
ADD COLUMN blood_group VARCHAR(5),
ADD COLUMN allergies TEXT,
ADD COLUMN chronic_diseases TEXT;

-- set the daily limit
INSERT INTO system_setting (cpd_hours, daily_quota, services) VALUES (10, 50, 'General OPD');
INSERT INTO system_setting (daily_quota, cpd_hours, services) 
VALUES (50, 0, 'General OPD');

-- Step A: Add a Staff member (Doctor) so we have a 'created_by' ID
INSERT INTO staff (first_name, mid_name, surname, phone, email) 
VALUES ('John', 'A', 'Smith', '0771234567', 'drsmith@hospital.com');

-- Step B: Add a test appointment for your patient
-- (Assumes patient_id 1 exists. If you only have one patient, it is usually ID 1)
INSERT INTO appointment (patient_id, status, appointment_day, queue_no)
VALUES (1, 'completed', CURDATE(), 1);

-- Step C: Now add the treatment record linking to appointment_id 1 and staff_id 1
INSERT INTO treatment_record (appointment_id, consultation_day, treatment_details, priority, created_by)
VALUES (1, CURDATE(), 'Patient presents with mild fever. Prescribed Paracetamol.', 'normal', 1);

-- Step D: Add a matching prescription so it shows in the UI
INSERT INTO prescription (appointment_id, issued_by, details)
VALUES (1, 1, 'Paracetamol 500mg - 2 times a day for 3 days');

-- Add a test notification
INSERT INTO notification (patient_id, status, message, type)
VALUES (1, 'sent', 'Welcome to SmartOPD! Your registration is complete.', 'in_app');

-- Add a test feedback
INSERT INTO feedback (patient_id, comments)
VALUES (1, 'The registration process was very smooth.');

-- version 1 of finalize the db

-- 1. Add the NIC column to the patient table (Essential for Doctor Search)
-- We place it near the name for logical grouping
ALTER TABLE patient 
ADD COLUMN nic VARCHAR(20) NOT NULL AFTER surname;

-- 2. Add Index to NIC (For High-Performance Searching)
-- A Lead Engineer knows that searching a large database by NIC is faster with an INDEX
CREATE INDEX idx_patient_nic ON patient(nic);

-- 3. Add a "Note" field to user_account for Reset Tokens
-- This helps with your Forgot Password/OTP logic if you store it in DB
ALTER TABLE user_account 
ADD COLUMN reset_token VARCHAR(6) DEFAULT NULL,
ADD COLUMN token_expiry DATETIME DEFAULT NULL;

-- 4. Check the Treatment Record Table
-- Your treatment_record currently links to appointment_id. 
-- Let's add a direct link to patient_id just in case a doctor needs to see 
-- history without an active appointment (Quick lookup).
ALTER TABLE treatment_record 
ADD COLUMN patient_id BIGINT AFTER record_id;

-- Link it up
UPDATE treatment_record tr
JOIN appointment a ON tr.appointment_id = a.appointment_id
SET tr.patient_id = a.patient_id;

ALTER TABLE treatment_record 
ADD CONSTRAINT fk_treatment_patient FOREIGN KEY (patient_id) REFERENCES patient(patient_id);

SELECT username, patient_id FROM user_account;
select * from patient;

-- truncating all the tables
-- 1. Temporarily disable security checks to allow clearing linked tables
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Clear the records and reset the Auto-Increment IDs to 1
TRUNCATE TABLE user_account;
TRUNCATE TABLE patient;
TRUNCATE TABLE staff_role;
TRUNCATE TABLE staff;
TRUNCATE TABLE appointment;
TRUNCATE TABLE medical_record;
-- Add any other tables you created here...

-- 3. Re-enable security checks
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Disable checks
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Clear tables in your specific schema
TRUNCATE TABLE user_account;
TRUNCATE TABLE patient;
TRUNCATE TABLE staff_role;
TRUNCATE TABLE staff;
TRUNCATE TABLE role; -- Optional: Only if you want to re-insert roles
TRUNCATE TABLE appointment;
TRUNCATE TABLE queue;
TRUNCATE TABLE queue_handler;
TRUNCATE TABLE treatment_record; -- This was likely the "medical_record" error
TRUNCATE TABLE prescription;
TRUNCATE TABLE prescription_fulfillment;
TRUNCATE TABLE referral;
TRUNCATE TABLE diagnostic_test_request;
TRUNCATE TABLE diagnostic_assignment;
TRUNCATE TABLE test_result;
TRUNCATE TABLE notification;
TRUNCATE TABLE feedback;
TRUNCATE TABLE feedback_view;
TRUNCATE TABLE audit_log;
TRUNCATE TABLE system_setting;

-- 3. Re-enable checks
SET FOREIGN_KEY_CHECKS = 1;

-- 4. Re-insert essential data (Roles & Settings)
INSERT INTO role (role_name) VALUES 
('Admin'), ('Doctor'), ('Specialist Consultant'), 
('Receptionist'), ('Pharmacist'), ('Patient');

INSERT INTO system_setting (cpd_hours, daily_quota, services) 
VALUES (10, 50, 'General OPD');

SHOW INDEX FROM patient;

-- 1. Try dropping the manual index you created earlier
ALTER TABLE patient DROP INDEX idx_patient_nic;

-- Run this in your MySQL Workbench to see if it returns a row
SELECT * FROM user_account WHERE username = 'your_username_here';

SELECT staff_id, first_name FROM staff;

-- Add time_slot and token_no to the appointment table
ALTER TABLE appointment 
ADD COLUMN time_slot VARCHAR(20) AFTER appointment_day,
ADD COLUMN token_no INT AFTER time_slot;

-- Add an index to speed up the capacity check
CREATE INDEX idx_appt_lookup ON appointment(appointment_day, time_slot);

USE hospital_db;

-- 1. Ensure the system_setting table has columns for the UI logic
-- Your schema already has daily_quota. Let's add start and end times.
ALTER TABLE system_setting 
ADD COLUMN opd_start_time TIME DEFAULT '08:00:00',
ADD COLUMN opd_end_time TIME DEFAULT '16:00:00';

-- 2. Add an email column to staff if it doesn't exist (it's in your schema, but let's be sure)
-- This is used for the Staff Management table.

-- 1. Create the Staff Entry
INSERT INTO staff (first_name, surname, email, active) 
VALUES ('System', 'Admin', 'admin@smartopd.com', 1);

-- 2. Link the Staff to the 'Admin' Role 
-- (Assumes 'Admin' role_id is 1 based on your previous inserts)
INSERT INTO staff_role (staff_id, role_id) 
VALUES (LAST_INSERT_ID(), 1);

-- 3. Create the Login Credentials
-- Username: admin
-- Password: admin123 (Note: In production, this must be hashed)
INSERT INTO user_account (staff_id, username, password_hash) 
VALUES (LAST_INSERT_ID(), 'admin', 'admin123');

UPDATE user_account 
SET username = 'admin@smartopd.com' 
WHERE username = 'admin';

-- Update the password to 'admin123' and ensure no whitespace
UPDATE user_account 
SET password_hash = 'admin123' 
WHERE username = 'admin' OR username = 'admin@smartopd.com';

-- See Staff/Admin Logins
SELECT s.first_name, s.email, u.username, u.password_hash 
FROM user_account u
JOIN staff s ON u.staff_id = s.staff_id;

-- See Patient Logins
SELECT p.first_name, p.barcode, u.username, u.password_hash 
FROM user_account u
JOIN patient p ON u.patient_id = p.patient_id;

-- Ensure there is a staff member first
INSERT INTO staff (first_name, surname, email) VALUES ('Admin', 'User', 'admin@test.com');

-- Create their login (Using the ID of the staff we just made)
INSERT INTO user_account (staff_id, username, password_hash) 
VALUES (LAST_INSERT_ID(), 'admin@test.com', 'admin123');

-- 1. Check if the column exists. If it does, we just need to make sure it's linked.
-- Run this to see your current table structure:
DESC user_account;

DROP DATABASE IF EXISTS hospital_db;
CREATE DATABASE hospital_db;
USE hospital_db;

-- 1. Roles
CREATE TABLE role (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Staff
CREATE TABLE staff (
  staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  surname VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Patients
CREATE TABLE patient (
  patient_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  surname VARCHAR(100) NOT NULL,
  nic VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(30),
  barcode VARCHAR(64) UNIQUE,
  dob DATE,
  gender ENUM('Male','Female','Other'),
  blood_group VARCHAR(5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Accounts (THE CRITICAL TABLE)
CREATE TABLE user_account (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  staff_id BIGINT UNIQUE NULL,
  patient_id BIGINT UNIQUE NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE
);

-- 5. Staff-Role Junction
CREATE TABLE staff_role (
  staff_id BIGINT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (staff_id, role_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
  FOREIGN KEY (role_id) REFERENCES role(role_id)
);

-- 6. Insert Essential Data
INSERT INTO role (role_name) VALUES ('Admin'), ('Doctor'), ('Receptionist'), ('Pharmacist'), ('Patient');

-- 7. Create Master Admin (Email: admin@test.com | Password: admin123)
INSERT INTO staff (first_name, surname, email) VALUES ('System', 'Admin', 'admin@test.com');
SET @admin_id = LAST_INSERT_ID();
INSERT INTO staff_role (staff_id, role_id) VALUES (@admin_id, 1);
INSERT INTO user_account (username, password_hash, staff_id) VALUES ('admin@test.com', 'admin123', @admin_id);

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE user_account;
TRUNCATE TABLE patient;
SET FOREIGN_KEY_CHECKS = 1;

-- This updates the admin password to a hashed version of 'admin123'
UPDATE user_account 
SET password_hash = '$2b$10$u79v.u3U2uC6X9vYmG/8fO.vU5nJ1H5I8fK8n8V8O8V8O8V8O8V8O' 
WHERE username = 'admin@smartopd.com';

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE user_account;
TRUNCATE TABLE patient;
SET FOREIGN_KEY_CHECKS = 1;

-- Check if they are empty
SELECT * FROM patient;
SELECT * FROM user_account;

ALTER TABLE user_account MODIFY staff_id BIGINT NULL;
ALTER TABLE user_account MODIFY patient_id BIGINT NULL;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE user_account;
TRUNCATE TABLE patient;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Ensure the 'Admin' role exists (usually ID 1)
-- INSERT IGNORE INTO role (role_id, role_name) VALUES (1, 'Admin');

-- 2. Insert the Admin Staff member
-- INSERT INTO staff (first_name, surname, email) 
-- VALUES ('System', 'Admin', 'admin@test.com');

-- 3. Get that new Staff ID and link to Admin Role
SET @new_admin_id = LAST_INSERT_ID();
-- INSERT INTO staff_role (staff_id, role_id) VALUES (@new_admin_id, 1);

-- 4. Create the Login with the Bcrypt Hash for 'admin123'
-- Using the exact hash string for 'admin123'
INSERT INTO user_account (username, password_hash, staff_id) 
VALUES ('admin@test.com', '$2b$10$u79v.u3U2uC6X9vYmG/8fO.vU5nJ1H5I8fK8n8V8O8V8O8V8O8V8O', @new_admin_id);

SELECT u.username, r.role_name 
FROM user_account u
JOIN staff s ON u.staff_id = s.staff_id
JOIN staff_role sr ON s.staff_id = sr.staff_id
JOIN role r ON sr.role_id = r.role_id
WHERE u.username = 'admin@test.com';

DROP TABLE IF EXISTS lab_request;

CREATE TABLE lab_request (
    request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    requested_by BIGINT NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'Normal',
    status VARCHAR(20) DEFAULT 'pending',
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES staff(staff_id) ON DELETE CASCADE
);
USE hospital_db;

-- 1. The main table for Doctor's Notes
CREATE TABLE IF NOT EXISTS treatment_record (
    record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    treatment_details TEXT,
    consultation_day DATE NOT NULL,
    created_by BIGINT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES staff(staff_id) ON DELETE CASCADE
);

-- 2. The table for Prescriptions
CREATE TABLE IF NOT EXISTS prescription (
    prescription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    issued_by BIGINT NOT NULL,
    details TEXT NOT NULL,
    date_issued DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES staff(staff_id) ON DELETE CASCADE
);

INSERT IGNORE INTO staff (staff_id, first_name, surname, email) 
VALUES (1, 'System', 'Doctor', 'doctor@hospital.com');

-- 1. Check if the columns exist
DESC treatment_record;

-- 2. If you want the "Time" feature, add a created_at column if it's missing
ALTER TABLE treatment_record ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

delete from prescription;
delete from patient;
delete from treatment_record;
desc patient;
ALTER TABLE patient MODIFY COLUMN nic VARCHAR(50);

ALTER TABLE patient DROP INDEX email;
ALTER TABLE patient 
ADD COLUMN address_line1 VARCHAR(255) AFTER gender,
ADD COLUMN city VARCHAR(100) AFTER address_line1,
ADD COLUMN allergies TEXT AFTER blood_group,
ADD COLUMN chronic_conditions TEXT AFTER allergies,
ADD COLUMN current_medications TEXT AFTER chronic_conditions,
ADD COLUMN emergency_contact_name VARCHAR(100) AFTER current_medications,
ADD COLUMN emergency_contact_phone VARCHAR(20) AFTER emergency_contact_name,
ADD COLUMN height_cm DECIMAL(5,2) AFTER emergency_contact_phone,
ADD COLUMN weight_kg DECIMAL(5,2) AFTER height_cm;

CREATE TABLE appointment (
    appointment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT NOT NULL,
    appointment_day DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    token_no INT NOT NULL,
    status ENUM('booked', 'completed', 'cancelled') DEFAULT 'booked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE
);

ALTER TABLE appointment MODIFY COLUMN status ENUM('booked', 'cancelled', 'completed', 'active') DEFAULT 'booked';
DESCRIBE patient;
-- First, temporarily disable foreign key checks to allow the change
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Identify and Drop the offending constraint
ALTER TABLE user_account DROP FOREIGN KEY user_account_ibfk_2;

-- 2. Update ALL child tables to INT UNSIGNED first
ALTER TABLE user_account MODIFY patient_id INT UNSIGNED;

-- 2. Drop the specific constraints causing the "Incompatible" errors
-- We remove the 'link names' so we can change the 'column shapes'
ALTER TABLE lab_request DROP FOREIGN KEY lab_request_ibfk_1;
ALTER TABLE prescription DROP FOREIGN KEY prescription_ibfk_1;
ALTER TABLE treatment_record DROP FOREIGN KEY treatment_record_ibfk_1;
ALTER TABLE appointment DROP FOREIGN KEY appointment_ibfk_1;
ALTER TABLE user_account DROP FOREIGN KEY user_account_ibfk_2;

-- 3. Now modify EVERY column to INT UNSIGNED
ALTER TABLE patient MODIFY patient_id INT UNSIGNED AUTO_INCREMENT;
ALTER TABLE user_account MODIFY patient_id INT UNSIGNED;
ALTER TABLE lab_request MODIFY patient_id INT UNSIGNED;
ALTER TABLE prescription MODIFY patient_id INT UNSIGNED;
ALTER TABLE treatment_record MODIFY patient_id INT UNSIGNED;
ALTER TABLE appointment MODIFY patient_id INT UNSIGNED;

-- 4. Re-establish the Foreign Key connections
ALTER TABLE user_account ADD CONSTRAINT user_account_ibfk_2 
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE;

ALTER TABLE lab_request ADD CONSTRAINT lab_request_ibfk_1 
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE;

ALTER TABLE prescription ADD CONSTRAINT prescription_ibfk_1 
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE;

ALTER TABLE treatment_record ADD CONSTRAINT treatment_record_ibfk_1 
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE;

ALTER TABLE appointment ADD CONSTRAINT appointment_ibfk_1 
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE;

-- 5. Create the Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_patient 
        FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Restore safety checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT u.username, u.patient_id, p.first_name 
FROM user_account u 
JOIN patient p ON u.patient_id = p.patient_id 
WHERE u.user_id = 6;

-- Check if your user is actually connected to a patient record
SELECT 
    u.user_id, 
    u.username, 
    u.patient_id AS linked_patient_id, 
    p.first_name, 
    p.surname
FROM user_account u
LEFT JOIN patient p ON u.patient_id = p.patient_id
WHERE u.username = 'bhagya0913@gmail.com';

SELECT user_id, patient_id FROM user_account WHERE user_id = 12;

ALTER TABLE patient ADD COLUMN nic VARCHAR(20) AFTER surname;

DESCRIBE appointment;
ALTER TABLE appointment ADD COLUMN time_slot VARCHAR(50) AFTER appointment_day;

-- 1. Add token_no (The one causing your current error)
ALTER TABLE appointment ADD COLUMN token_no INT AFTER time_slot;

-- 3. Verify everything
DESCRIBE appointment;
SELECT user_id, patient_id FROM user_account;

ALTER TABLE patient 
ADD COLUMN address_line1 VARCHAR(255) AFTER phone,
ADD COLUMN city VARCHAR(100) AFTER address_line1,
ADD COLUMN blood_group VARCHAR(5) AFTER city,
ADD COLUMN weight_kg DECIMAL(5,2) AFTER blood_group,
ADD COLUMN height_cm DECIMAL(5,2) AFTER weight_kg,
ADD COLUMN allergies TEXT AFTER height_cm;

ALTER TABLE user_account 
ADD COLUMN role VARCHAR(50) DEFAULT 'patient' AFTER password_hash;

ALTER TABLE user_account MODIFY COLUMN password_hash VARCHAR(255);