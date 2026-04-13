# SmartOPD - Quick Fix Guide

## Overview
This document provides specific SQL and JavaScript fixes for all identified mismatches.

---

## OPTION A: Fix Backend to Match Schema (Recommended)

### Fix 1: Replace Table Names in Backend (server.js)

```javascript
// FIND & REPLACE ALL INSTANCES:

// Replace: patient → patients
"SELECT * FROM patient"              → "SELECT * FROM patients"
"INSERT INTO patient"                → "INSERT INTO patients"
"UPDATE patient"                     → "UPDATE patients"
"DELETE FROM patient"                → "DELETE FROM patients"

// Replace: user_account → user_accounts
"SELECT * FROM user_account"         → "SELECT * FROM user_accounts"
"INSERT INTO user_account"           → "INSERT INTO user_accounts"
"UPDATE user_account"                → "UPDATE user_accounts"

// Replace: lab_request → medical_tests
"INSERT INTO lab_request"            → "INSERT INTO medical_tests"
"SELECT * FROM lab_request"          → "SELECT * FROM medical_tests"
```

### Fix 2: Staff Table Column Mapping (Critical)

**Current Backend Code (Lines ~253, 615, 678):**
```javascript
// WRONG - These columns don't exist:
"INSERT INTO staff (first_name, surname, email, role_id)"
"SELECT s.first_name, s.surname FROM staff s"
```

**Corrected Code:**
```javascript
// CORRECT - Use full_name:
"INSERT INTO staff (full_name, email, phone, role_id, nic, is_active)"
// When displaying, split full_name if needed in frontend

// When reading, use full_name:
"SELECT s.staff_id, s.full_name, s.email, s.phone, s.nic, r.role_name, s.is_active FROM staff s"
```

**Schema already has these fields:**
```sql
CREATE TABLE staff (
    staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,           -- ✓ Use this
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30),                         -- ✓ Already exists
    role_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE
    -- Note: nic is NOT in schema, needs to be added
);
```

### Fix 3: Add NIC Column to Staff Table (SQL)

```sql
-- ADD TO DATABASE:
ALTER TABLE staff ADD COLUMN nic VARCHAR(20) UNIQUE AFTER email;
```

### Fix 4: Appointment Table Column Mapping (Critical)

**Current Schema:**
```sql
CREATE TABLE appointments (
    appointment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT,
    doctor_id BIGINT,
    appointment_day DATE NOT NULL,
    start_time TIME NOT NULL,        -- ✓ Use this (backend uses: time_slot)
    end_time TIME NOT NULL,          -- ✓ Use this 
    queue_no INT,                    -- ✓ Use this (backend uses: token_no)
    visit_type ENUM(...),
    status ENUM(...),
    is_present BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
);
```

**Backend Code to Fix (Lines ~517, 533, 542, 575):**

```javascript
// WRONG - These columns don't exist:
"INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status)"
"SELECT * FROM appointment WHERE time_slot = ?"

// CORRECT - Use schema columns:
"INSERT INTO appointments (patient_id, appointment_day, start_time, end_time, queue_no, status)" 
"SELECT * FROM appointments WHERE DATE(created_at) = ? AND HOUR(start_time) = ?"
```

### Fix 5: Feedback Table Column Mapping (Critical)

**Current Schema:**
```sql
CREATE TABLE feedback (
    feedback_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id BIGINT,
    user_id BIGINT,                     -- Required FK
    comments TEXT,                     -- NOT rating
    admin_note TEXT,
    date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP,  -- NOT submitted_at
    status ENUM('new', 'reviewed', 'resolved') DEFAULT 'new',
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id)
);
```

**Backend Code to Fix (Lines ~592, 604):**

```javascript
// WRONG:
"INSERT INTO feedback (patient_id, rating, comment) VALUES (?, ?, ?)"
"SELECT * FROM feedback WHERE patient_id = ? ORDER BY submitted_at DESC"

// CORRECT - Option 1: Match schema exactly (remove rating):
const { patientId, userId, comment } = req.body;
"INSERT INTO feedback (patient_id, user_id, comments, date_submitted, status) VALUES (?, ?, ?, NOW(), 'new')"
"SELECT * FROM feedback WHERE patient_id = ? ORDER BY date_submitted DESC"

// CORRECT - Option 2: Add rating column to schema (if you need it):
ALTER TABLE feedback ADD COLUMN rating INT AFTER comments;
```

### Fix 6: Referral Table Column Mapping (Critical)

**Current Backend Code (Line ~888):**
```javascript
// WRONG:
"INSERT INTO referral (appointment_id, issued_by, referral_date, reason, specialist_id)"

// CORRECT:
"INSERT INTO referrals (appointment_id, issued_by, referral_date, reason, referred_to_id)"
```

### Fix 7: Treatment Records - Add Priority Column (Optional/Warning)

**Current Backend Code (Line ~843):**
```javascript
// WRONG - priority column doesn't exist:
"INSERT INTO treatment_record (appointment_id, patient_id, treatment_details, created_by, consultation_day, priority)"
```

**Solution A: Add to schema (if needed):**
```sql
ALTER TABLE treatment_records ADD COLUMN priority ENUM('normal', 'urgent', 'low') DEFAULT 'normal' AFTER created_by;
```

**Solution B: Remove from backend (if not needed):**
```javascript
// CORRECT:
"INSERT INTO treatment_records (appointment_id, patient_id, treatment_details, created_by, consultation_day)"
```

---

## OPTION B: Fix Schema to Match Backend (Not Recommended)

If you prefer to keep the backend code as-is, modify schema:

```sql
-- Rename tables
RENAME TABLE user_accounts TO user_account;
RENAME TABLE patients TO patient;

-- Modify staff table
ALTER TABLE staff DROP COLUMN full_name;
ALTER TABLE staff ADD COLUMN first_name VARCHAR(255) AFTER staff_id;
ALTER TABLE staff ADD COLUMN surname VARCHAR(255) AFTER first_name;
ALTER TABLE staff ADD COLUMN nic VARCHAR(20) AFTER email;

-- Modify appointments table
ALTER TABLE appointments DROP COLUMN start_time, DROP COLUMN end_time;
ALTER TABLE appointments ADD COLUMN time_slot VARCHAR(50) AFTER appointment_day;
ALTER TABLE appointments CHANGE queue_no token_no INT;

-- Create missing tables
CREATE TABLE clinic_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schedule_date DATE NOT NULL,
    time_slot VARCHAR(50),
    status ENUM('open', 'closed') DEFAULT 'open',
    UNIQUE KEY (schedule_date, time_slot)
);

CREATE TABLE staff_role (
    staff_id BIGINT,
    role_id BIGINT,
    PRIMARY KEY (staff_id, role_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

CREATE TABLE system_setting (
    setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    daily_quota INT DEFAULT 30,
    opd_start_time TIME,
    opd_end_time TIME
);

-- Modify feedback table
ALTER TABLE feedback ADD COLUMN rating INT;
ALTER TABLE feedback CHANGE comments comment TEXT;
ALTER TABLE feedback CHANGE date_submitted submitted_at DATETIME;

-- Modify referrals table  
ALTER TABLE referrals CHANGE referred_to_id specialist_id BIGINT;

-- Modify treatment_records table
ALTER TABLE treatment_records ADD COLUMN priority VARCHAR(50);
```

**⚠️ NOT RECOMMENDED** - This approach has more work and the schema design is better.

---

## Missing Tables in Schema (Need to Add)

### Table 1: clinic_schedule
```sql
CREATE TABLE clinic_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schedule_date DATE NOT NULL,
    time_slot VARCHAR(50),  -- e.g., '09:00-10:00' or 'ALL_DAY'
    status ENUM('open', 'closed') DEFAULT 'open',
    UNIQUE KEY unique_slot (schedule_date, time_slot)
);
```

### Table 2: staff_role (if keeping as junction table)
```sql
CREATE TABLE staff_role (
    staff_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (staff_id, role_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);
```

### Table 3: system_setting
```sql
CREATE TABLE system_setting (
    setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    daily_quota INT DEFAULT 30,
    opd_start_time TIME DEFAULT '09:00:00',
    opd_end_time TIME DEFAULT '17:00:00',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## Summary of Changes (Recommended Approach - Fix Backend)

| File | Change Type | Count |
|------|------------|-------|
| backend/server.js | Table name replacements | ~30+ lines |
| backend/server.js | Column name mappings | ~15+ lines |
| database/schema.sql | Add `nic` to staff | 1 ALTER |
| database/schema.sql | Add missing tables | 3 CREATE TABLE |

---

## Testing Plan

After fixes:

1. **Create new migrations** with all schema changes
2. **Test each endpoint**:
   - POST /api/register
   - POST /api/login
   - POST /api/admin/add-staff
   - POST /api/book-appointment
   - POST /api/feedback
   - GET /api/admin/staff
   - And all others

3. **Verify in frontend** that data displays correctly
4. **Check browser console** (F12) for API errors
5. **Check terminal** for backend SQL errors

