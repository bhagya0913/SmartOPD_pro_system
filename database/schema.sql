
CREATE DATABASE hospital_db;
USE hospital_db;

-- 2. Patient Table (Identity & Safety)
CREATE TABLE patients (
    patient_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    barcode VARCHAR(64) UNIQUE,
    nic VARCHAR(20) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other'),
    civil_status ENUM('Single', 'Married', 'Divorced', 'Widowed'),
    blood_group VARCHAR(5),
    chronic_conditions TEXT,       -- e.g., Diabetes, Hypertension
    allergies TEXT,                -- Default to 'NKA' in your UI
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30),
    address TEXT,
    emergency_contact VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE
);
-- 3. Appointment Table (The Queue)
CREATE TABLE appointments (
    appointment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT,
    doctor_id BIGINT,
    appointment_day DATE NOT NULL,
    start_time TIME NOT NULL,      -- e.g. 08:00:00
    end_time TIME NOT NULL,        -- e.g. 09:00:00
    queue_no INT,
    visit_type ENUM('New', 'Follow-up', 'Report-view') DEFAULT 'New',
    status ENUM('booked', 'completed', 'cancelled', 'no_show') DEFAULT 'booked',
    is_present BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES staff(staff_id)
);
-- Role Table
CREATE TABLE roles (
    role_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE
);
-- 1. Staff Table (Doctors, Specialists, Receptionists, etc.)
CREATE TABLE staff (
    staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30),
    role_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- 4. Treatment Record (The Medical Visit)
CREATE TABLE treatment_records (
    record_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT,
    patient_id BIGINT,
    consultation_day DATETIME DEFAULT CURRENT_TIMESTAMP,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    chief_complaint TEXT,
    clinical_findings TEXT,
    diagnosis VARCHAR(255),
    treatment_details TEXT,
    prescription_details TEXT, 
    follow_up_date DATE,
    created_by BIGINT,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (created_by) REFERENCES staff(staff_id)
);
-- 5. Medical Tests (Requests)
CREATE TABLE medical_tests (
    test_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT,
    patient_id BIGINT,
    test_type ENUM('Lab', 'Imaging', 'ECG', 'Other') NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    status ENUM('requested', 'in_progress', 'completed', 'cancelled') DEFAULT 'requested',
    requested_by BIGINT,
    sample_collected_at DATETIME,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (requested_by) REFERENCES staff(staff_id)
);
-- 6. Test Results (Findings & Files)
CREATE TABLE test_results (
    result_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    test_id BIGINT UNIQUE,
    summary TEXT,
    file_path VARCHAR(255), -- Link to the PDF/Image
    uploaded_by BIGINT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES medical_tests(test_id),
    FOREIGN KEY (uploaded_by) REFERENCES staff(staff_id)
);

-- 7. Prescription
CREATE TABLE prescriptions (
    prescription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT,
    patient_id BIGINT,
    details TEXT NOT NULL,
    status ENUM('pending', 'fulfilled', 'partially_fulfilled', 'cancelled') DEFAULT 'pending',
    issued_by BIGINT,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (issued_by) REFERENCES staff(staff_id)
);

-- 8. Prescription Fulfillment (Audit Trail)
CREATE TABLE prescription_fulfillment (
    fulfillment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prescription_id BIGINT,
    pharmacist_id BIGINT,
    fulfilled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id),
    FOREIGN KEY (pharmacist_id) REFERENCES staff(staff_id)
);

-- 9. Referral Table
CREATE TABLE referrals (
    referral_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT,
    patient_id BIGINT,
    issued_by BIGINT,              -- GP who issues the referral
    referred_to_id BIGINT,         -- Consultant / specialist (staff)
    consultant_name VARCHAR(255),  -- For external / visiting consultants
    target_clinic VARCHAR(255),    -- e.g. Cardiology Clinic, ENT Clinic
    urgency ENUM('Routine', 'Urgent', 'Emergency') DEFAULT 'Routine',
    referral_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (issued_by) REFERENCES staff(staff_id),
    FOREIGN KEY (referred_to_id) REFERENCES staff(staff_id)
);

-- Feedback Table
CREATE TABLE feedback (
    feedback_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT,
    user_id BIGINT,                     -- FK to user account
    comments TEXT,
    admin_note TEXT,                    -- Admin message / response
    date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('new', 'reviewed', 'resolved') DEFAULT 'new',
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id)
);
-- Notifications Table (Email / System Notifications)
CREATE TABLE notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_type ENUM('staff', 'patient') NOT NULL,   -- Who received it
    staff_id BIGINT NULL,                               -- If staff
    patient_id BIGINT NULL,                             -- If patient
    email_subject VARCHAR(255),
    message TEXT,                                       -- Email / notification body
    status ENUM('queued', 'sent', 'delivered', 'failed', 'opened') DEFAULT 'queued',
    sent_at DATETIME,
    error_log TEXT,                                     -- Failure reason
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);
-- Reports Table
CREATE TABLE reports (
    report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_type ENUM('Daily Revenue', 'Patient Census', 'Lab Efficiency') NOT NULL,
    generated_by BIGINT,                 -- Staff member who generated the report
    parameters JSON,                     -- Filters used for report generation
    file_id BIGINT,                      -- Link to generated report file (PDF)
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES staff(staff_id)
);
-- User Accounts Table
CREATE TABLE user_accounts (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    patient_id BIGINT NULL,             -- Link if account belongs to patient
    staff_id BIGINT NULL,               -- Link if account belongs to staff
    password_hash VARCHAR(255) NOT NULL,
    last_login DATETIME,
    reset_token VARCHAR(255),
    token_expiry DATETIME,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);
