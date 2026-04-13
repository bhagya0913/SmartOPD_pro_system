# Detailed Line-by-Line Backend Fixes

## File: backend/server.js

### CRITICAL FIXES NEEDED

---

## Fix Category 1: Table Name Replacements

### 1.1 Replace ALL `patient` with `patients`

**Lines to Check:**
- Line 163: `INSERT INTO patient (full_name, nic, dob... `
- Line 408: `UPDATE patient SET first_name = ?...`
- Line 453: `SELECT p.patient_id FROM patient p...`
- Line 777: `SELECT patient_id, full_name, nic FROM patient WHERE...`
- And multiple others in SELECT/UPDATE/DELETE statements

**Global Find-Replace:**
- Find: `"INSERT INTO patient`
- Replace: `"INSERT INTO patients`
- Find: `FROM patient`
- Replace: `FROM patients`
- Find: `UPDATE patient`
- Replace: `UPDATE patients`
- Find: `DELETE FROM patient`
- Replace: `DELETE FROM patients`

---

### 1.2 Replace ALL `user_account` with `user_accounts`

**Lines to Check:**
- Line 140: `SELECT * FROM user_account WHERE username = ?`
- Line 149: `SELECT * FROM otp_verification...`
- Line 169: `INSERT INTO user_account (username, password_hash...`
- Line 196: `FROM user_account u`
- Line 259: `SELECT user_id FROM user_account WHERE username`
- Line 317: `UPDATE user_account SET reset_token`
- Line 362: `SELECT * FROM user_account WHERE username = ?`
- Line 382: `UPDATE user_account SET password_hash`
- And multiple others

**Global Find-Replace:**
- Find: `FROM user_account`
- Replace: `FROM user_accounts`
- Find: `INSERT INTO user_account`
- Replace: `INSERT INTO user_accounts`
- Find: `UPDATE user_account`
- Replace: `UPDATE user_accounts`
- Find: `DELETE FROM user_account`
- Replace: `DELETE FROM user_accounts`

---

### 1.3 Replace `lab_request` with `medical_tests`

**Line 877:**
```javascript
// BEFORE:
const sql = "INSERT INTO lab_request (patient_id, requested_by, test_name, priority, status) VALUES (?, ?, ?, ?, 'pending')";

// AFTER:
const sql = "INSERT INTO medical_tests (patient_id, requested_by, test_name, status) VALUES (?, ?, ?, 'requested')";
```

---

## Fix Category 2: Column Name Mappings

### 2.1 Staff Table: `first_name`, `surname` → `full_name`

**Line 253 (Add Staff - INSERT):**
```javascript
// BEFORE:
"INSERT INTO staff (first_name, surname, email, role_id) VALUES (?, ?, ?, ?)",
[firstName, surname, email, roleId]

// AFTER:
"INSERT INTO staff (full_name, email, phone, role_id, is_active) VALUES (?, ?, ?, ?, 1)",
[`${firstName} ${surname}`, email, phone, roleId]  // Combine names
```

**Line 615 (Get All Staff - SELECT):**
```javascript
// BEFORE:
const query = `
    SELECT 
        s.staff_id, 
        s.first_name, 
        s.surname, 
        s.email, 
        r.role_name, 
        s.is_active
    FROM staff s
    LEFT JOIN roles r ON s.role_id = r.role_id
`;

// AFTER:
const query = `
    SELECT 
        s.staff_id, 
        s.full_name, 
        s.email, 
        s.phone,
        r.role_name, 
        s.is_active
    FROM staff s
    LEFT JOIN roles r ON s.role_id = r.role_id
`;
```

**Line 678 (Add Staff - INSERT with all fields):**
```javascript
// BEFORE:
"INSERT INTO staff (first_name, surname, email, phone, nic, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
[firstName, surname, email, phone, nic, roleId]

// AFTER:
"INSERT INTO staff (full_name, email, phone, nic, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
[`${firstName} ${surname}`, email, phone, nic, roleId]  // Combine names
```

---

### 2.2 Appointment Table: `time_slot`, `token_no` → Schema columns

**Line 517-533 (Book Appointment - INSERT):**
```javascript
// BEFORE:
const insertQuery = `
    INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status) 
    VALUES (?, ?, ?, ?, 'booked')
`;

// AFTER:
const insertQuery = `
    INSERT INTO appointments (patient_id, appointment_day, start_time, end_time, queue_no, status) 
    VALUES (?, ?, ?, ?, ?, 'booked')
`;
// Note: You'll need to calculate start_time and end_time from time_slot
// And use queue_no instead of newTokenNo
// Alternatively, modify UI to send time range, not a "time slot"
```

**Implementation Helper:**
```javascript
// If UI sends timeSlot as "09:00-10:00":
const [startStr, endStr] = timeSlot.split('-');  // "09:00", "10:00"
const startTime = startStr + ":00";  // "09:00:00"
const endTime = endStr + ":00";      // "10:00:00"
const queueNo = newTokenNo;  // Rename for clarity

// Then:
db.query(insertQuery, [patientId, date, startTime, endTime, queueNo], ...);
```

**Line 542 (Book Appointment - SELECT for capacity):**
```javascript
// BEFORE:
const capacityQuery = `
    SELECT COUNT(*) as count 
    FROM appointment 
    WHERE appointment_day = ? AND time_slot = ? AND status != 'cancelled'
`;
db.query(capacityQuery, [date, timeSlot], ...);

// AFTER:
const capacityQuery = `
    SELECT COUNT(*) as count 
    FROM appointments 
    WHERE appointment_day = ? AND HOUR(start_time) = HOUR(?) AND status != 'cancelled'
`;
db.query(capacityQuery, [date, timeSlot], ...);  // If timeSlot is "09:00"
```

**Line 575 (Get Live Queue):**
```javascript
// BEFORE:
const sql = `SELECT token_no FROM appointment 
             WHERE appointment_day = ? AND time_slot = ? AND status = 'active' 
             LIMIT 1`;

// AFTER:
const sql = `SELECT queue_no FROM appointments 
             WHERE appointment_day = ? AND HOUR(start_time) = HOUR(?) AND status = 'active' 
             LIMIT 1`;
```

**Line 550 (Get My Appointments):**
```javascript
// BEFORE:
const sql = "SELECT * FROM appointment WHERE patient_id = ? AND status != 'cancelled' ORDER BY appointment_day ASC, token_no ASC";

// AFTER:
const sql = "SELECT * FROM appointments WHERE patient_id = ? AND status != 'cancelled' ORDER BY appointment_day ASC, start_time ASC";
```

---

### 2.3 Feedback Table: Multiple Column Changes

**Line 592 (Submit Feedback):**
```javascript
// BEFORE:
const { patientId, rating, comment } = req.body;
const sql = "INSERT INTO feedback (patient_id, rating, comment) VALUES (?, ?, ?)";
db.query(sql, [patientId, rating, comment], ...);

// AFTER - Option A (Keep rating):
// First, add rating to schema: ALTER TABLE feedback ADD COLUMN rating INT AFTER comments;
const { patientId, userId, comment, rating } = req.body;
const sql = "INSERT INTO feedback (patient_id, user_id, comments, rating, date_submitted, status) VALUES (?, ?, ?, ?, NOW(), 'new')";
db.query(sql, [patientId, userId, comment, rating], ...);

// AFTER - Option B (Remove rating):
const { patientId, userId, comment } = req.body;
const sql = "INSERT INTO feedback (patient_id, user_id, comments, date_submitted, status) VALUES (?, ?, ?, NOW(), 'new')";
db.query(sql, [patientId, userId, comment], ...);
```

**Line 604 (Get Feedback History):**
```javascript
// BEFORE:
const sql = "SELECT * FROM feedback WHERE patient_id = ? ORDER BY submitted_at DESC";

// AFTER:
const sql = "SELECT * FROM feedback WHERE patient_id = ? ORDER BY date_submitted DESC";
```

---

### 2.4 Referral Table: `specialist_id` → `referred_to_id`

**Line 888 (Create Referral):**
```javascript
// BEFORE:
const sql = "INSERT INTO referral (appointment_id, issued_by, referral_date, reason, specialist_id) VALUES (?, ?, NOW(), ?, ?)";
db.query(sql, [appointment_id, doctor_id, reason, specialist_id], ...);

// AFTER:
const sql = "INSERT INTO referrals (appointment_id, issued_by, referral_date, reason, referred_to_id) VALUES (?, ?, NOW(), ?, ?)";
db.query(sql, [appointment_id, doctor_id, reason, specialist_id], ...);  // Variable name doesn't need to change
```

---

### 2.5 Treatment Records: Remove or Add `priority`

**Line 840-843 (Save Consultation):**
```javascript
// BEFORE:
const treatmentSql = `
    INSERT INTO treatment_record 
    (appointment_id, patient_id, treatment_details, created_by, consultation_day, priority) 
    VALUES (?, ?, ?, ?, CURDATE(), 'normal')
`;

// AFTER - Option A (Remove priority):
const treatmentSql = `
    INSERT INTO treatment_records 
    (appointment_id, patient_id, treatment_details, created_by, consultation_day) 
    VALUES (?, ?, ?, ?, CURDATE())
`;

// AFTER - Option B (Keep priority, add to schema):
// First: ALTER TABLE treatment_records ADD COLUMN priority ENUM('normal', 'urgent', 'low') DEFAULT 'normal';
const treatmentSql = `
    INSERT INTO treatment_records 
    (appointment_id, patient_id, treatment_details, created_by, consultation_day, priority) 
    VALUES (?, ?, ?, ?, CURDATE(), 'normal')
`;
```

---

### 2.6 Profile Update: `first_name`, `surname` → `full_name`

**Line 408-430 (Update Patient Profile):**
```javascript
// BEFORE:
const sql = `
    UPDATE patient 
    SET first_name = ?, surname = ?, nic = ?, phone = ?, 
        address_line1 = ?, city = ?, blood_group = ?, 
        weight_kg = ?, height_cm = ?, allergies = ?
    WHERE patient_id = ?
`;

// AFTER:
const sql = `
    UPDATE patients 
    SET full_name = ?, nic = ?, phone = ?, 
        blood_group = ?, 
        weight_kg = ?, height_cm = ?, allergies = ?, address = ?
    WHERE patient_id = ?
`;
// Note: Schema has 'address' not 'address_line1' and 'city'
// Adjust parameters accordingly
```

---

## Fix Summary (Apply in This Order)

1. **Global table renames** (3 find-replaces):
   - `patient` → `patients`
   - `user_account` → `user_accounts`
   - `lab_request` → `medical_tests`

2. **Staff column mapping** (3 locations):
   - Line 253, 615, 678: `first_name`, `surname` → `full_name`

3. **Appointment column mapping** (5+ locations):
   - Replace `time_slot`, `token_no` with proper time/queue columns
   - Update all related queries

4. **Feedback column mapping** (2 locations):
   - Line 592: Add `user_id`, change `comment` → `comments`, `submitted_at` → `date_submitted`
   - Line 604: Change `submitted_at` → `date_submitted`

5. **Referral column mapping** (1 location):
   - Line 888: `specialist_id` → `referred_to_id`

6. **Treatment records** (1 location):
   - Line 843: Remove or add `priority` column

---

## Database Schema Alterations Needed

```sql
-- After fixing backend, you MUST also run these in MySQL:

-- 1. Fix user_accounts table name (if using schema changes approach)
-- Already correct: CREATE TABLE user_accounts (...)

-- 2. Fix patients table name (if using schema changes approach)
-- Already correct: CREATE TABLE patients (...)

-- 3. Add NIC to staff table:
ALTER TABLE staff ADD COLUMN nic VARCHAR(20) UNIQUE AFTER email;

-- 4. Fix appointments table - NO CHANGES NEEDED IN SCHEMA

-- 5. Add missing columns to feedback (if using Option A):
ALTER TABLE feedback ADD COLUMN rating INT AFTER comments;

-- 6. No changes needed for referrals column name

-- 7. Add priority to treatment_records (if needed):
ALTER TABLE treatment_records ADD COLUMN priority ENUM('normal', 'urgent', 'low') DEFAULT 'normal' AFTER created_by;

-- 8. Drop obsolete columns in staff (if you changed):
-- None needed, schema is already correct

-- 9. Create missing clinic_schedule table:
CREATE TABLE IF NOT EXISTS clinic_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schedule_date DATE NOT NULL,
    time_slot VARCHAR(50),
    status ENUM('open', 'closed') DEFAULT 'open',
    UNIQUE KEY (schedule_date, time_slot)
);

-- 10. Create missing system_setting table:
CREATE TABLE IF NOT EXISTS system_setting (
    setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    daily_quota INT DEFAULT 30,
    opd_start_time TIME,
    opd_end_time TIME
);
```

---

## Testing Each Fix

After making changes, test these endpoints:

```bash
# 1. Test Registration (uses patient table)
curl -X POST http://localhost:5001/api/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"John Doe","nic":"123456789X","dob":"1990-01-01","gender":"Male","email":"test@example.com","phone":"1234567890","password":"Test@123"}'

# 2. Test Login (uses user_accounts table)
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"Test@123"}'

# 3. Test Add Staff (uses staff table with full_name)
curl -X POST http://localhost:5001/api/admin/add-staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"firstName":"Jane","surname":"Smith","email":"jane@hospital.com","phone":"9876543210","nic":"987654321V","roleName":"Doctor"}'

# 4. Test Book Appointment (uses appointments table)
curl -X POST http://localhost:5001/api/book-appointment \
  -H "Content-Type: application/json" \
  -d '{"patientId":1,"date":"2024-03-15","timeSlot":"09:00-10:00"}'

# 5. Test Submit Feedback (uses updated feedback table)
curl -X POST http://localhost:5001/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"patientId":1,"userId":1,"comment":"Great service","rating":5}'
```

Each test should return `success: true` with no SQL errors in the backend terminal.

