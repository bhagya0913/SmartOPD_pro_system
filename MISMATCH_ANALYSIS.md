# SmartOPD - Code Mismatch Analysis Report

## Critical Mismatches Found

### 1. **TABLE NAME MISMATCHES** ⚠️ CRITICAL

#### Mismatch 1.1: `patient` vs `patients`
- **Schema**: `CREATE TABLE patients (...)`
- **Backend Usage**: `INSERT INTO patient (...)`, `SELECT * FROM patient`
- **Files Affected**: `backend/server.js` (multiple locations)
- **Frontend**: PatientDashboard.jsx uses API endpoints, is data-agnostic
- **Status**: **WILL CAUSE DATABASE ERRORS**
- **Lines in Backend**: 163, 408, 453, 777, etc.

#### Mismatch 1.2: `user_account` vs `user_accounts`
- **Schema**: `CREATE TABLE user_accounts (...)`
- **Backend Usage**: `SELECT * FROM user_account WHERE ...`, `INSERT INTO user_account`
- **Files Affected**: `backend/server.js` (multiple locations)
- **Status**: **WILL CAUSE DATABASE ERRORS**
- **Lines in Backend**: 140, 149, 169, 196, 317, 362, 382, etc.

#### Mismatch 1.3: Missing Tables Referenced in Backend
- **Backend references but NOT in schema**:
  - `clinic_schedule` (line 486) - used for OPD closure checks
  - `staff_role` (line 728) - junction table for staff-role relationships
  - `system_setting` (line 758) - system configuration table
  - `lab_request` (line 877) - lab request tracking
  - `prescription` table (line 851, 916) - exists in schema, backend uses it correctly

---

### 2. **STAFF TABLE COLUMN MISMATCHES** ⚠️ CRITICAL

#### Mismatch 2.1: `first_name`, `surname` vs `full_name`
- **Schema Column**: `full_name VARCHAR(255) NOT NULL`
- **Backend Columns Used**: `first_name`, `surname` (stored separately)
- **Files Affected**: `backend/server.js` (lines 253, 615, 678)
- **Example Query**:
  ```sql
  -- Backend attempts:
  INSERT INTO staff (first_name, surname, email, role_id) VALUES (?, ?, ?, ?)
  SELECT s.first_name, s.surname FROM staff s
  
  -- But schema only has:
  INSERT INTO staff (full_name, email, role_id) VALUES (?, ?, ?)
  ```
- **Status**: **WILL CAUSE DATABASE ERRORS**

#### Mismatch 2.2: Missing `phone` and `nic` in Schema's `staff` Table
- **Backend expects**: `phone VARCHAR(30)`, `nic VARCHAR(20)`
- **Schema has**: `phone VARCHAR(30)` ✓ (correct), but **NO `nic` field**
- **Lines in Backend**: 678 (INSERT includes nic)
- **Status**: **nic COLUMN WILL CAUSE ERROR**

---

### 3. **APPOINTMENT TABLE COLUMN MISMATCHES** ⚠️ CRITICAL

#### Mismatch 3.1: `time_slot`, `token_no` vs `start_time`, `end_time`, `queue_no`
- **Schema Columns**: `start_time TIME`, `end_time TIME`, `queue_no INT`
- **Backend Columns**: `time_slot VARCHAR`, `token_no INT`
- **Files Affected**: `backend/server.js` (lines 486, 517, 533, 542, 575)
- **Example Query**:
  ```sql
  -- Backend attempts:
  INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status)
  
  -- But schema has:
  INSERT INTO appointment (patient_id, appointment_day, start_time, end_time, queue_no)
  ```
- **Status**: **WILL CAUSE DATABASE ERRORS**

---

### 4. **FEEDBACK TABLE COLUMN MISMATCHES** ⚠️ CRITICAL

#### Mismatch 4.1: `rating`, `comment`, `submitted_at` vs schema columns
- **Schema Columns**: 
  - `user_id BIGINT` (FK to user_accounts)
  - `comments TEXT`
  - `date_submitted DATETIME`
  - `admin_note TEXT`
  - `status ENUM('new', 'reviewed', 'resolved')`
  
- **Backend Columns Used**: 
  - `rating INT` (NOT in schema)
  - `comment TEXT` (NOT exactly `comments`)
  - `submitted_at DATETIME` (NOT `date_submitted`)
  - Missing `user_id` FK requirement

- **Files Affected**: `backend/server.js` (lines 592, 604)
- **Example Query**:
  ```sql
  -- Backend attempts:
  INSERT INTO feedback (patient_id, rating, comment) VALUES (?, ?, ?)
  SELECT * FROM feedback ORDER BY submitted_at DESC
  
  -- But schema has:
  INSERT INTO feedback (patient_id, user_id, comments, date_submitted, status) VALUES (...)
  SELECT * FROM feedback ORDER BY date_submitted DESC
  ```
- **Status**: **WILL CAUSE DATABASE ERRORS**

---

### 5. **REFERRAL TABLE COLUMN MISMATCHES** ⚠️ CRITICAL

#### Mismatch 5.1: `specialist_id` vs `referred_to_id`
- **Schema Column**: `referred_to_id BIGINT` (FK to staff)
- **Backend Column**: `specialist_id BIGINT`
- **Files Affected**: `backend/server.js` (line 888)
- **Example Query**:
  ```sql
  -- Backend attempts:
  INSERT INTO referral (appointment_id, issued_by, referral_date, reason, specialist_id)
  
  -- But schema column is:
  INSERT INTO referral (..., referred_to_id)
  ```
- **Status**: **WILL CAUSE DATABASE ERRORS**

---

### 6. **TREATMENT RECORDS COLUMN MISMATCHES** ⚠️ WARNING

#### Mismatch 6.1: `priority` Column Not in Schema
- **Backend expects**: `priority ENUM('normal', 'urgent', etc.)`
- **Schema has**: NO `priority` field
- **Lines in Backend**: 843 (INSERT includes priority)
- **Status**: **WILL CAUSE DATABASE ERROR**

#### Mismatch 6.2: Column Naming Inconsistency
- **Backend uses**: `findings TEXT` parameter
- **Schema has**: `clinical_findings TEXT`
- **Status**: Likely intended to be same field, parameter name mismatch only

---

### 7. **MEDICAL TESTS / LAB REFERENCES** ⚠️ WARNING

#### Mismatch 7.1: Backend Uses Non-Existent `lab_request` Table
- **Backend expects**: `lab_request` table (line 877)
- **Schema has**: `medical_tests` table instead
- **Backend Query**:
  ```sql
  INSERT INTO lab_request (patient_id, requested_by, test_name, priority, status)
  ```
- **Schema has instead**:
  ```sql
  CREATE TABLE medical_tests (
      test_id BIGINT,
      appointment_id BIGINT,
      patient_id BIGINT,
      test_type ENUM('Lab', 'Imaging', 'ECG', 'Other'),
      test_name VARCHAR(255),
      status ENUM('requested', 'in_progress', 'completed', 'cancelled'),
      requested_by BIGINT,
      sample_collected_at DATETIME
  )
  ```
- **Status**: **WILL CAUSE DATABASE ERROR**

---

## Summary Table

| Issue | Severity | Location | Type |
|-------|----------|----------|------|
| `patient` vs `patients` | CRITICAL | Backend: 163, 408, 453, 777, etc. | Table Name |
| `user_account` vs `user_accounts` | CRITICAL | Backend: 140, 149, 169, 196, 317, etc. | Table Name |
| `first_name`, `surname` vs `full_name` | CRITICAL | Backend: 253, 615, 678 | Column Names |
| Missing `nic` in staff table | CRITICAL | Backend: 678 | Missing Column |
| `time_slot`, `token_no` vs schema | CRITICAL | Backend: 486, 517, 533, 542, 575 | Column Names |
| `rating`, `comment` vs schema feedback | CRITICAL | Backend: 592, 604 | Column Names |
| `specialist_id` vs `referred_to_id` | CRITICAL | Backend: 888 | Column Name |
| Missing `priority` in treatment_records | WARNING | Backend: 843 | Missing Column |
| `lab_request` table missing | CRITICAL | Backend: 877 | Table Name |
| Missing `clinic_schedule` table | CRITICAL | Backend: 486 | Missing Table |
| Missing `staff_role` table | CRITICAL | Backend: 728 | Missing Table |
| Missing `system_setting` table | CRITICAL | Backend: 758 | Missing Table |

---

## Action Items (Priority Order)

### Phase 1: Fix Table Names (CRITICAL - Do First)
1. [ ] Update schema or backend to use consistent table names:
   - `patient` ↔ `patients` 
   - `user_account` ↔ `user_accounts`
   - `lab_request` ↔ `medical_tests`

### Phase 2: Fix Column Names (CRITICAL)
2. [ ] Staff table: Replace `first_name`, `surname` with `full_name` in backend
3. [ ] Staff table: Add `nic VARCHAR(20)` to schema
4. [ ] Appointments: Replace `time_slot`, `token_no` with `start_time`, `end_time`, `queue_no`
5. [ ] Feedback: Update columns to match schema (`rating` → remove/redesign, `comment` → `comments`, `submitted_at` → `date_submitted`)
6. [ ] Referrals: Rename `specialist_id` → `referred_to_id` in backend

### Phase 3: Add Missing Tables (CRITICAL)
7. [ ] Create `clinic_schedule` table in schema
8. [ ] Create `staff_role` junction table (or use role_id directly)
9. [ ] Create `system_setting` table for config
10. [ ] Decide: Use `lab_request` or `medical_tests` (currently both are referenced differently)

### Phase 4: Optional Column Fixes (WARNING)
11. [ ] Add `priority` field to `treatment_records` if needed by backend
12. [ ] Verify all other column references match schema

---

## Recommendation

**STOP running migrations or using the database until these issues are resolved.** The current code will throw database errors for:
- Table creation/lookup failures
- Column not found errors
- Foreign key reference failures

Choose one approach:
1. **Fix the Schema** to match backend expectations, or
2. **Fix the Backend** to match the schema

Option 2 is recommended since the schema is more standardized.

