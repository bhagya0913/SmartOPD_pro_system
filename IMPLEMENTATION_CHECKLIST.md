# SmartOPD Fixes - Implementation Checklist

## Pre-Flight Checklist

- [ ] Back up database: `mysqldump hospital_db > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Back up backend code: Copy `backend/server.js` to `server.js.bak`
- [ ] Stop backend server
- [ ] Read all analysis documents
- [ ] Choose Option A (Fix Backend) or Option B (Fix Schema)

---

## Option A: Fix Backend Code ✅ RECOMMENDED

### Phase 1: Global Table Name Replacements

#### 1.1 Replace `patient` with `patients`
- [ ] Open `backend/server.js`
- [ ] Use Find & Replace (Ctrl+H)
  - Find: `FROM patient`
  - Replace: `FROM patients`
- [ ] Find: `INSERT INTO patient`
  - Replace: `INSERT INTO patients`
- [ ] Find: `UPDATE patient`
  - Replace: `UPDATE patients`
- [ ] Find: `DELETE FROM patient`
  - Replace: `DELETE FROM patients`
- [ ] **Verify**: Should affect ~10+ lines
- [ ] Save file

#### 1.2 Replace `user_account` with `user_accounts`
- [ ] Use Find & Replace (Ctrl+H)
  - Find: `FROM user_account`
  - Replace: `FROM user_accounts`
- [ ] Find: `INSERT INTO user_account`
  - Replace: `INSERT INTO user_accounts`
- [ ] Find: `UPDATE user_account`
  - Replace: `UPDATE user_accounts`
- [ ] Find: `DELETE FROM user_account`
  - Replace: `DELETE FROM user_accounts`
- [ ] **Verify**: Should affect ~10+ lines
- [ ] Save file

#### 1.3 Replace `lab_request` with `medical_tests`
- [ ] Find: `INSERT INTO lab_request`
  - Replace: `INSERT INTO medical_tests`
- [ ] **Verify**: Should affect 1 line (line 877)
- [ ] Save file

**Subtotal Time: ~3-5 minutes**

---

### Phase 2: Staff Table Column Fixes

#### 2.1 Fix Line 253 (Add Staff - INSERT)
- [ ] Find the code block starting at line ~253
- [ ] **Before**:
  ```javascript
  "INSERT INTO staff (first_name, surname, email, role_id) VALUES (?, ?, ?, ?)",
  [firstName, surname, email, roleId]
  ```
- [ ] **After**:
  ```javascript
  "INSERT INTO staff (full_name, email, phone, role_id, is_active) VALUES (?, ?, ?, ?, 1)",
  [`${firstName} ${surname}`, email, phone, roleId]
  ```
- [ ] Update the params array to match
- [ ] Save file

#### 2.2 Fix Line 615 (Get All Staff - SELECT)
- [ ] Find the query in `/api/admin/staff` endpoint
- [ ] **Before**:
  ```javascript
  SELECT s.staff_id, s.first_name, s.surname, s.email, r.role_name, s.is_active
  ```
- [ ] **After**:
  ```javascript
  SELECT s.staff_id, s.full_name, s.email, s.phone, r.role_name, s.is_active
  ```
- [ ] Save file

#### 2.3 Fix Line 678 (Add Staff with Full Details)
- [ ] Find code block starting at line ~678
- [ ] **Before**:
  ```javascript
  "INSERT INTO staff (first_name, surname, email, phone, nic, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
  [firstName, surname, email, phone, nic, roleId]
  ```
- [ ] **After**:
  ```javascript
  "INSERT INTO staff (full_name, email, phone, nic, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
  [`${firstName} ${surname}`, email, phone, nic, roleId]
  ```
- [ ] Save file

**Subtotal Time: ~5-10 minutes**

---

### Phase 3: Appointment Table Column Fixes (Complex)

#### 3.1 Fix Line 517-533 (Book Appointment)
- [ ] Find POST `/api/book-appointment` endpoint
- [ ] Find the `insertQuery` variable (around line ~533)
- [ ] **Before**:
  ```javascript
  const insertQuery = `
      INSERT INTO appointment (patient_id, appointment_day, time_slot, token_no, status) 
      VALUES (?, ?, ?, ?, 'booked')
  `;
  ```
- [ ] **After**:
  ```javascript
  const insertQuery = `
      INSERT INTO appointments (patient_id, appointment_day, start_time, end_time, queue_no, status) 
      VALUES (?, ?, ?, ?, ?, 'booked')
  `;
  ```
- [ ] **Also fix the parameters** (this is critical):
  - Need to convert `timeSlot` to `start_time` and `end_time`
  - Suggestion:
    ```javascript
    // Add this before the INSERT:
    const [startStr, endStr] = timeSlot.split('-'); // "09:00-10:00" → ["09:00", "10:00"]
    const startTime = startStr + ":00";  // "09:00:00"
    const endTime = endStr + ":00";      // "10:00:00"
    const queueNo = newTokenNo;
    
    // Then pass: [patientId, date, startTime, endTime, queueNo]
    ```
  - OR modify your frontend to send proper time values
- [ ] Save file

#### 3.2 Fix Capacity Check Query (Line ~520)
- [ ] Find the `capacityQuery` variable
- [ ] **Before**:
  ```javascript
  const capacityQuery = `
      SELECT COUNT(*) as count 
      FROM appointment 
      WHERE appointment_day = ? AND time_slot = ? AND status != 'cancelled'
  `;
  ```
- [ ] **After**:
  ```javascript
  const capacityQuery = `
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE appointment_day = ? AND HOUR(start_time) = HOUR(?) AND status != 'cancelled'
  `;
  ```
- [ ] Save file

#### 3.3 Fix Get My Appointments (Line ~550)
- [ ] Find GET `/api/my-appointments` endpoint
- [ ] **Before**:
  ```javascript
  const sql = "SELECT * FROM appointment WHERE patient_id = ? AND status != 'cancelled' ORDER BY appointment_day ASC, token_no ASC";
  ```
- [ ] **After**:
  ```javascript
  const sql = "SELECT * FROM appointments WHERE patient_id = ? AND status != 'cancelled' ORDER BY appointment_day ASC, start_time ASC";
  ```
- [ ] Save file

#### 3.4 Fix Get Live Queue (Line ~575)
- [ ] Find the GET `/api/live-queue` endpoint
- [ ] **Before**:
  ```javascript
  const sql = `SELECT token_no FROM appointment 
               WHERE appointment_day = ? AND time_slot = ? AND status = 'active'`;
  ```
- [ ] **After**:
  ```javascript
  const sql = `SELECT queue_no FROM appointments 
               WHERE appointment_day = ? AND HOUR(start_time) = HOUR(?) AND status = 'active'`;
  ```
- [ ] Save file

#### 3.5 Fix Double Book Check (Line ~507)
- [ ] Find the `doubleBookCheck` query inside `/api/book-appointment`
- [ ] **Before**:
  ```javascript
  const doubleBookCheck = `
      SELECT * FROM appointment 
      WHERE patient_id = ? 
      AND appointment_day = ? 
      AND status != 'cancelled'
  `;
  ```
- [ ] **After**:
  ```javascript
  const doubleBookCheck = `
      SELECT * FROM appointments 
      WHERE patient_id = ? 
      AND appointment_day = ? 
      AND status != 'cancelled'
  `;
  ```
- [ ] Save file

**Subtotal Time: ~10-15 minutes**

---

### Phase 4: Feedback Table Column Fixes

#### 4.1 Fix Submit Feedback (Line ~592)
- [ ] Find POST `/api/feedback` endpoint
- [ ] **Before**:
  ```javascript
  const { patientId, rating, comment } = req.body;
  const sql = "INSERT INTO feedback (patient_id, rating, comment) VALUES (?, ?, ?)";
  db.query(sql, [patientId, rating, comment], ...);
  ```
- [ ] **After**:
  ```javascript
  const { patientId, userId, comment } = req.body;
  const sql = "INSERT INTO feedback (patient_id, user_id, comments, date_submitted, status) VALUES (?, ?, ?, NOW(), 'new')";
  db.query(sql, [patientId, userId, comment], ...);
  ```
- [ ] Note: Frontend needs to send `userId` if making this change
- [ ] Save file

#### 4.2 Fix Get Feedback History (Line ~604)
- [ ] Find GET `/api/feedback/:patientId` endpoint
- [ ] **Before**:
  ```javascript
  const sql = "SELECT * FROM feedback WHERE patient_id = ? ORDER BY submitted_at DESC";
  ```
- [ ] **After**:
  ```javascript
  const sql = "SELECT * FROM feedback WHERE patient_id = ? ORDER BY date_submitted DESC";
  ```
- [ ] Save file

**Subtotal Time: ~3-5 minutes**

---

### Phase 5: Referral Table Fix

#### 5.1 Fix Create Referral (Line ~888)
- [ ] Find POST `/api/doctor/create-referral` endpoint
- [ ] **Before**:
  ```javascript
  const sql = "INSERT INTO referral (appointment_id, issued_by, referral_date, reason, specialist_id) VALUES (?, ?, NOW(), ?, ?)";
  ```
- [ ] **After**:
  ```javascript
  const sql = "INSERT INTO referrals (appointment_id, issued_by, referral_date, reason, referred_to_id) VALUES (?, ?, NOW(), ?, ?)";
  ```
- [ ] Save file

**Subtotal Time: ~1 minute**

---

### Phase 6: Treatment Records Fix

#### 6.1 Fix Save Consultation (Line ~840)
- [ ] Find POST `/api/doctor/save-consultation` endpoint
- [ ] **Before**:
  ```javascript
  const treatmentSql = `
      INSERT INTO treatment_record 
      (appointment_id, patient_id, treatment_details, created_by, consultation_day, priority) 
      VALUES (?, ?, ?, ?, CURDATE(), 'normal')
  `;
  ```
- [ ] **After** (remove priority):
  ```javascript
  const treatmentSql = `
      INSERT INTO treatment_records 
      (appointment_id, patient_id, treatment_details, created_by, consultation_day) 
      VALUES (?, ?, ?, ?, CURDATE())
  `;
  ```
- [ ] Save file

**Subtotal Time: ~1-2 minutes**

---

## Database Schema Updates

### Phase 7: Add Missing Columns

#### 7.1 Add NIC to Staff Table
- [ ] Open MySQL client or phpMyAdmin
- [ ] Run:
  ```sql
  ALTER TABLE staff ADD COLUMN nic VARCHAR(20) UNIQUE AFTER email;
  ```
- [ ] Verify: Staff table now has nic column
- [ ] ✓ Check

#### 7.2 (Optional) Add Rating to Feedback
- [ ] If you want to keep rating feature:
  ```sql
  ALTER TABLE feedback ADD COLUMN rating INT AFTER comments;
  ```
- [ ] ✓ Check

#### 7.3 (Optional) Add Priority to Treatment Records
- [ ] If backend still references priority:
  ```sql
  ALTER TABLE treatment_records ADD COLUMN priority ENUM('normal', 'urgent', 'low') DEFAULT 'normal' AFTER created_by;
  ```
- [ ] ✓ Check

**Subtotal Time: ~2-3 minutes**

---

### Phase 8: Create Missing Tables

#### 8.1 Create clinic_schedule Table
- [ ] Run:
  ```sql
  CREATE TABLE IF NOT EXISTS clinic_schedule (
      schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      schedule_date DATE NOT NULL,
      time_slot VARCHAR(50),
      status ENUM('open', 'closed') DEFAULT 'open',
      UNIQUE KEY unique_slot (schedule_date, time_slot)
  );
  ```
- [ ] Verify: Table created
- [ ] ✓ Check

#### 8.2 Create system_setting Table
- [ ] Run:
  ```sql
  CREATE TABLE IF NOT EXISTS system_setting (
      setting_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      daily_quota INT DEFAULT 30,
      opd_start_time TIME DEFAULT '09:00:00',
      opd_end_time TIME DEFAULT '17:00:00',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  ```
- [ ] Verify: Table created
- [ ] ✓ Check

#### 8.3 (Optional) Create staff_role Table
- [ ] If needed for your architecture:
  ```sql
  CREATE TABLE IF NOT EXISTS staff_role (
      staff_id BIGINT NOT NULL,
      role_id BIGINT NOT NULL,
      assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (staff_id, role_id),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
  );
  ```
- [ ] ✓ Check

**Subtotal Time: ~3-5 minutes**

---

## Testing & Validation

### Phase 9: Backend Testing

#### 9.1 Restart Backend Server
- [ ] Start backend: `node backend/server.js`
- [ ] Check for any syntax errors in terminal
- [ ] Expected: "SERVER IS AWAKE ON PORT 5001"
- [ ] ✓ Check

#### 9.2 Test Registration Endpoint
- [ ] Use Postman or curl:
  ```bash
  curl -X POST http://localhost:5001/api/register \
    -H "Content-Type: application/json" \
    -d '{"full_name":"Test User","nic":"123456789X","dob":"1990-01-01","gender":"Male","email":"test@example.com","phone":"1234567890","password":"Test@123"}'
  ```
- [ ] Expected: `{"success": true, ...}` (no SQL errors)
- [ ] ✓ Check
- [ ] Verify in database: `SELECT * FROM patients WHERE email = 'test@example.com';`
- [ ] ✓ Check

#### 9.3 Test Login Endpoint
- [ ] Use Postman or curl:
  ```bash
  curl -X POST http://localhost:5001/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test@example.com","password":"Test@123"}'
  ```
- [ ] Expected: Returns user object with `role`
- [ ] ✓ Check

#### 9.4 Test Add Staff Endpoint
- [ ] Use Postman:
  ```json
  {
    "firstName": "Jane",
    "surname": "Smith",
    "email": "jane@hospital.com",
    "phone": "9876543210",
    "nic": "987654321V",
    "roleName": "Doctor"
  }
  ```
- [ ] Expected: `{"success": true, ...}`
- [ ] Verify in database: `SELECT * FROM staff WHERE email = 'jane@hospital.com';`
- [ ] ✓ Check

#### 9.5 Test Book Appointment Endpoint
- [ ] Get a patientId from previous tests
- [ ] Use Postman:
  ```json
  {
    "patientId": 1,
    "date": "2024-03-20",
    "timeSlot": "09:00-10:00"
  }
  ```
- [ ] Expected: `{"success": true, ...}`
- [ ] Verify in database: `SELECT * FROM appointments WHERE patient_id = 1;`
- [ ] Check columns: `queue_no`, `start_time`, `end_time` are populated
- [ ] ✓ Check

#### 9.6 Test Other Endpoints
- [ ] GET `/api/admin/staff` - Should return staff list
- [ ] GET `/api/doctor/queue` - Should return queue
- [ ] GET `/api/feedback/:patientId` - Should return feedback
- [ ] POST `/api/feedback` - Should add feedback with new schema
- [ ] ✓ All working

**Subtotal Time: ~15-20 minutes**

---

### Phase 10: Frontend Testing

#### 10.1 Start Frontend
- [ ] Open new terminal in `frontend/` folder
- [ ] Run: `npm run dev`
- [ ] Open browser: `http://localhost:5173`
- [ ] ✓ Check

#### 10.2 Test Patient Registration Flow
- [ ] Click "Register"
- [ ] Fill form with test data
- [ ] Submit
- [ ] Expected: Registration successful, redirected to dashboard
- [ ] Check browser console (F12) for errors: Should be none
- [ ] ✓ Check

#### 10.3 Test Patient Login
- [ ] Logout if logged in
- [ ] Login with registered user
- [ ] Expected: Redirected to Patient Dashboard
- [ ] Check console for API errors: Should be none
- [ ] ✓ Check

#### 10.4 Test Appointment Booking
- [ ] In Patient Dashboard, go to "Book Appointment"
- [ ] Select date and time
- [ ] Submit
- [ ] Expected: "Appointment booked successfully"
- [ ] Check browser console: No errors
- [ ] ✓ Check

#### 10.5 Test Admin Staff Management
- [ ] Login as Admin
- [ ] Go to Staff Management
- [ ] Add new staff member
- [ ] Expected: Staff added successfully
- [ ] Verify in list refreshes
- [ ] Check console: No errors
- [ ] ✓ Check

#### 10.6 Test Doctor Dashboard
- [ ] Login as Doctor  
- [ ] View queue
- [ ] Search patient
- [ ] Open patient
- [ ] Check console: No errors
- [ ] ✓ Check

**Subtotal Time: ~10-15 minutes**

---

## Final Verification Checklist

### Database Verification
- [ ] `DESCRIBE patients;` - Has all columns
- [ ] `DESCRIBE staff;` - Has `full_name` and `nic`
- [ ] `DESCRIBE appointments;` - Has `start_time`, `end_time`, `queue_no`
- [ ] `DESCRIBE feedback;` - Has `comments`, `date_submitted`
- [ ] `SHOW TABLES;` - Includes `clinic_schedule`, `system_setting`

### Backend Verification
- [ ] No syntax errors in `server.js`
- [ ] All table names corrected
- [ ] All column names corrected
- [ ] All SQL queries use correct table/column names
- [ ] Server runs without errors

### Frontend Verification
- [ ] No console errors when using app
- [ ] All main flows work (register, login, book appointment, etc.)
- [ ] Data displays correctly
- [ ] No API error messages in UI

### Production Readiness
- [ ] All tests pass
- [ ] Database schema matches backend code
- [ ] No yellow warnings in console
- [ ] No red errors in console or terminal

---

## Summary

### Time Estimates
| Phase | Task | Time |
|-------|------|------|
| 1 | Table name replacements | 3-5 min |
| 2 | Staff column fixes | 5-10 min |
| 3 | Appointment column fixes | 10-15 min |
| 4 | Feedback column fixes | 3-5 min |
| 5 | Referral fix | 1 min |
| 6 | Treatment records fix | 1-2 min |
| 7 | Add missing columns | 2-3 min |
| 8 | Create missing tables | 3-5 min |
| 9 | Backend testing | 15-20 min |
| 10 | Frontend testing | 10-15 min |
| **TOTAL** | **All fixes** | **~50-80 min** |

### Go/No-Go Decision
- [ ] All items checked ✓
- [ ] Ready to deploy: **YES** / **NO**

---

## Troubleshooting

If you encounter errors:

1. **"Table not found" error**
   - Verify global table name replacements were applied
   - Re-check all table names in queries

2. **"Unknown column" error**
   - Verify column names match schema (use `DESCRIBE table_name`)
   - Check that ALTER TABLE commands were executed

3. **"Duplicate key" error**
   - May need to clear test data from database
   - Use: `DELETE FROM table_name WHERE email = 'test@example.com';`

4. **Frontend still shows errors**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Restart development server (npm run dev)
   - Check that backend has restarted

---

## Rollback Plan

If something goes wrong:

1. Restore backup: `mysql hospital_db < backup_*.sql`
2. Restore server.js: `cp server.js.bak server.js`
3. Restart services
4. Start over with checklist

---

**Good luck! You've got this! 🚀**

