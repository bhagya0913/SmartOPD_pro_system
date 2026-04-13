# SmartOPD Database Mismatch - Visual Reference

## Database Schema vs Backend Code Comparison

---

## 1️⃣ TABLE NAMES

### user_accounts

```
DATABASE SCHEMA:
┌─────────────────────────────────────────┐
│ CREATE TABLE user_accounts (            │
│   user_id BIGINT PRIMARY KEY            │
│   username VARCHAR(100) UNIQUE          │
│   password_hash VARCHAR(255)            │
│   patient_id BIGINT (FK)                │
│   staff_id BIGINT (FK)                  │
│   ...                                   │
│ )                                       │
└─────────────────────────────────────────┘

❌ BACKEND USES:
SELECT * FROM user_account WHERE ...     ← WRONG TABLE NAME
                  ^^^^^^
```

---

### patients

```
DATABASE SCHEMA:
┌─────────────────────────────────────────┐
│ CREATE TABLE patients (                 │
│   patient_id BIGINT PRIMARY KEY         │
│   full_name VARCHAR(255)                │
│   email VARCHAR(255)                    │
│   nic VARCHAR(20)                       │
│   dob DATE                              │
│   ...                                   │
│ )                                       │
└─────────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO patient VALUES (...)         ← WRONG TABLE NAME
             ^^^^^^^
UPDATE patient SET ...                   ← WRONG TABLE NAME
       ^^^^^^^
```

---

### appointments

```
DATABASE SCHEMA:
┌────────────────────────────────────────┐
│ CREATE TABLE appointments (            │
│   appointment_id BIGINT PRIMARY KEY    │
│   patient_id BIGINT                    │
│   appointment_day DATE                 │
│   start_time TIME      ← CORRECT COLS  │
│   end_time TIME        ← CORRECT COLS  │
│   queue_no INT         ← CORRECT COL   │
│   status ENUM(...)                     │
│   ...                                  │
│ )                                      │
└────────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO appointment (                ← WRONG TABLE (missing 's')
  patient_id, appointment_day,
  time_slot,  ← DOESN'T EXIST
  token_no,   ← DOESN'T EXIST (is queue_no)
  status
) VALUES (...)

❌ WRONG COLUMN NAMES:
time_slot    → Should be start_time, end_time
token_no     → Should be queue_no
```

---

### medical_tests (Backend calls it "lab_request")

```
DATABASE SCHEMA:
┌──────────────────────────────────────┐
│ CREATE TABLE medical_tests (         │
│   test_id BIGINT PRIMARY KEY         │
│   patient_id BIGINT                  │
│   test_type ENUM(...)                │
│   test_name VARCHAR(255)             │
│   status ENUM(...)                   │
│   requested_by BIGINT                │
│   sample_collected_at DATETIME       │
│ )                                    │
└──────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO lab_request (...)           ← WRONG TABLE NAME
             ^^^^^^
             (Should be medical_tests)
```

---

## 2️⃣ COLUMN MISMATCHES

### Staff Table

```
DATABASE SCHEMA:
┌────────────────────────────────────────────┐
│ CREATE TABLE staff (                       │
│   staff_id BIGINT PRIMARY KEY              │
│   full_name VARCHAR(255)  ← SINGLE COLUMN  │
│   email VARCHAR(255)                       │
│   phone VARCHAR(30)                        │
│   role_id BIGINT (FK)                      │
│   is_active BOOLEAN                        │
│   (NO nic COLUMN!)  ← MISSING             │
│ )                                          │
└────────────────────────────────────────────┘

❌ BACKEND EXPECTS:
INSERT INTO staff (
  first_name,  ← DOESN'T EXIST
  surname,     ← DOESN'T EXIST
  email,
  phone,
  nic,        ← DOESN'T EXIST (missing in schema)
  role_id
) VALUES (?, ?, ?, ?, ?, ?)

SELECT s.first_name, s.surname, ...  ← COLUMNS DON'T EXIST
                ^^        ^^^^^^^

✅ BACKEND SHOULD USE:
INSERT INTO staff (
  full_name,   ← CORRECT
  email,
  phone,
  nic,         ← Schema must ADD this
  role_id
) VALUES (concat(?, ' ', ?), ?, ?, ?, ?)
         or just send pre-combined name
```

---

### Appointments Table - Detailed View

```
DATABASE SCHEMA                          BACKEND CODE (WRONG)
═════════════════════════════════════════════════════════════════════

appointment_id BIGINT ────────────────→ appointment_id ✓
patient_id BIGINT ────────────────────→ patient_id ✓
appointment_day DATE ─────────────────→ appointment_day ✓
start_time TIME ─────────────────┐
end_time TIME ───────────────────┤     time_slot VARCHAR ❌
                                 └────→ (WRONG - should be 2 fields)
queue_no INT ────────────────────────→ token_no INT ❌
                                       (WRONG - should be queue_no)
status ENUM(...) ────────────────────→ status ✓
is_present BOOLEAN ──────────────────→ (not used in query)
created_at DATETIME ─────────────────→ (not used)
completed_at DATETIME ───────────────→ (not used)


BACKEND QUERY:
INSERT INTO appointment (
  patient_id, 
  appointment_day, 
  time_slot ← WRONG (doesn't exist)
  token_no  ← WRONG (doesn't exist, should be queue_no)
  status
) VALUES (...)
```

---

### Feedback Table

```
DATABASE SCHEMA:
┌────────────────────────────────────────────────┐
│ CREATE TABLE feedback (                        │
│   feedback_id BIGINT PRIMARY KEY               │
│   patient_id BIGINT (FK)                       │
│   user_id BIGINT (FK) ← REQUIRED               │
│   comments TEXT       ← Column name            │
│   admin_note TEXT                              │
│   date_submitted DATETIME ← Column name        │
│   status ENUM('new', 'reviewed', 'resolved')   │
│ )                                              │
└────────────────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO feedback (
  patient_id,
  rating ← DOESN'T EXIST (schema has no rating column)
  comment ← WRONG NAME (schema is "comments")
) VALUES (?, ?, ?)

SELECT * FROM feedback 
ORDER BY submitted_at DESC  ← WRONG NAME (schema is "date_submitted")


✅ BACKEND SHOULD USE:
INSERT INTO feedback (
  patient_id,
  user_id,          ← ADD THIS (required by FK)
  comments,         ← CORRECT NAME
  date_submitted,   ← CORRECT NAME
  status
) VALUES (?, ?, ?, NOW(), 'new')

SELECT * FROM feedback 
ORDER BY date_submitted DESC  ← CORRECT NAME

OR add to schema:
ALTER TABLE feedback ADD COLUMN rating INT;
(if you really need rating)
```

---

### Referrals Table

```
DATABASE SCHEMA:
┌──────────────────────────────────────────┐
│ CREATE TABLE referrals (                 │
│   referral_id BIGINT PRIMARY KEY         │
│   patient_id BIGINT (FK)                 │
│   issued_by BIGINT (FK staff_id)         │
│   referred_to_id BIGINT ← CORRECT NAME   │
│   (FK to staff.staff_id)                 │
│   consultant_name VARCHAR(255)           │
│   target_clinic VARCHAR(255)             │
│   urgency ENUM(...)                      │
│   ...                                    │
│ )                                        │
└──────────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO referral (              ← WRONG TABLE (missing 's')
  appointment_id,
  issued_by,
  referral_date,
  reason,
  specialist_id ← WRONG NAME (should be referred_to_id)
) VALUES (?, ?, NOW(), ?, ?)


✅ BACKEND SHOULD USE:
INSERT INTO referrals (
  appointment_id,
  issued_by,
  referral_date,
  reason,
  referred_to_id ← CORRECT NAME
) VALUES (?, ?, NOW(), ?, ?)
```

---

## 3️⃣ MISSING TABLES

### clinic_schedule

```
❌ BACKEND EXPECTS:
app.post('/api/book-appointment', ...)
  const adminCheck = `
    SELECT status FROM clinic_schedule 
    WHERE schedule_date = ? 
    AND (time_slot = ? OR time_slot = 'ALL_DAY')
  `;

❌ TABLE DOESN'T EXIST IN SCHEMA

✅ NEED TO CREATE:
CREATE TABLE clinic_schedule (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    schedule_date DATE NOT NULL,
    time_slot VARCHAR(50),  -- e.g., '09:00-10:00' or 'ALL_DAY'
    status ENUM('open', 'closed') DEFAULT 'open',
    UNIQUE KEY unique_slot (schedule_date, time_slot)
);
```

---

### system_setting

```
❌ BACKEND EXPECTS:
app.post('/api/admin/update-settings', ...)
  const query = `
    UPDATE system_setting 
    SET daily_quota = ?, opd_start_time = ?, opd_end_time = ?
    ORDER BY setting_id DESC LIMIT 1
  `;

❌ TABLE DOESN'T EXIST IN SCHEMA

✅ NEED TO CREATE:
CREATE TABLE system_setting (
    setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    daily_quota INT DEFAULT 30,
    opd_start_time TIME DEFAULT '09:00:00',
    opd_end_time TIME DEFAULT '17:00:00',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### staff_role (Junction Table - Optional)

```
❌ BACKEND EXPECTS:
DELETE FROM staff_role WHERE staff_id = ?

❌ TABLE DOESN'T EXIST IN SCHEMA
(Backend currently uses role_id field directly, which is fine)

✅ IF YOU NEED IT:
CREATE TABLE staff_role (
    staff_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (staff_id, role_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
);
```

---

## 4️⃣ TREATMENT RECORDS

```
DATABASE SCHEMA:
┌──────────────────────────────────────────────┐
│ CREATE TABLE treatment_records (             │
│   record_id BIGINT PRIMARY KEY               │
│   appointment_id BIGINT (FK)                 │
│   patient_id BIGINT (FK)                     │
│   consultation_day DATETIME                  │
│   weight_kg DECIMAL                          │
│   height_cm DECIMAL                          │
│   chief_complaint TEXT                       │
│   clinical_findings TEXT                     │
│   diagnosis VARCHAR(255)                     │
│   treatment_details TEXT                     │
│   prescription_details TEXT                  │
│   follow_up_date DATE                        │
│   created_by BIGINT (FK staff_id)            │
│   (NO priority COLUMN)                       │
│ )                                            │
└──────────────────────────────────────────────┘

❌ BACKEND USES:
INSERT INTO treatment_record (
  appointment_id,
  patient_id,
  treatment_details,
  created_by,
  consultation_day,
  priority ← DOESN'T EXIST
) VALUES (?, ?, ?, ?, CURDATE(), 'normal')

✅ FIX OPTION A (Remove priority):
INSERT INTO treatment_records (
  appointment_id,
  patient_id,
  treatment_details,
  created_by,
  consultation_day
) VALUES (?, ?, ?, ?, CURDATE())

✅ FIX OPTION B (Add priority to schema):
ALTER TABLE treatment_records 
ADD COLUMN priority ENUM('normal', 'urgent', 'low') DEFAULT 'normal';
```

---

## 5️⃣ QUICK ERROR PREDICTION

### What Will Break First (In Order of Execution):

1. **Registration** → `INSERT INTO patient` fails (table not found)
2. **Login** → `SELECT FROM user_account` fails (table not found)
3. **Add Staff** → `INSERT INTO staff (first_name, ...)` fails (column not found)
4. **Book Appointment** → `INSERT INTO appointment (time_slot, ...)` fails (column not found)
5. **Get Queue** → `SELECT FROM clinic_schedule` fails (table not found)
6. **Submit Feedback** → `INSERT INTO feedback (rating, ...)` fails (column not found)
7. **Create Referral** → `INSERT INTO referral (specialist_id, ...)` fails (column not found)

---

## Summary Table

| Layer | Schema | Backend | Status |
|-------|--------|---------|--------|
| **Tables** | ✓ Correct | ❌ Wrong names | MISMATCH |
| **Columns: Patients** | ✓ Correct | ❌ Wrong table name | MISMATCH |
| **Columns: Staff** | ✓ Optimal | ❌ Wrong column names + missing nic | MISMATCH |
| **Columns: Appointments** | ✓ Correct | ❌ Wrong column names | MISMATCH |
| **Columns: Feedback** | ✓ Correct | ❌ Wrong column names | MISMATCH |
| **Columns: Referrals** | ✓ Correct | ❌ Wrong column name | MISMATCH |
| **Missing Tables** | ❌ Missing 3 | ✓ Code ready | MISMATCH |

---

## Color Legend

🟢 ✓ = Correct  
🔴 ❌ = Mismatch/Missing  
🟡 ⚠️ = Warning/Optional

