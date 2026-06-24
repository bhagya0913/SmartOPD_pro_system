# 🏥 SmartOPD - Web-Based OPD Management System

**A complete web-based Outpatient Department (OPD) management system.**

---

## 📋 Project Overview

SmartOPD is a comprehensive web-based solution designed to digitize and streamline OPD operations at Base Hospital, Kiribathgoda. The system automates patient registration, appointment booking, queue management, medical record keeping, and communication between hospital staff and patients.

---

## 🎯 Key Features

### 👤 Patient
- Online registration with email verification (OTP)
- Book, view, and cancel appointments
- View medical records, prescriptions, and lab results
- Download OPD slips and digital prescriptions
- Submit feedback

### 🧑‍⚕️ Doctor
- View daily patient queue and appointment list
- Access patient medical history
- Record diagnosis, treatment, and prescriptions
- Request lab tests (blood, urine, X-ray, ECG)
- Issue digital referral forms

### 💊 Pharmacist
- View patient prescriptions
- Dispense medicines
- View prescription history

### 🔬 Diagnostic Technician
- View pending test requests
- Update test status (pending → in-progress → completed)
- Upload test results (PDF, JPEG, PNG)

### 🖥️ Receptionist
- Verify patient arrival (barcode/NIC)
- Register new patients
- View daily queue
- Override quota/time limits (emergency cases)

### 👨‍💼 Admin
- Manage staff (add, deactivate, reactivate)
- Configure OPD hours and daily quotas
- Set closed dates
- Generate reports (OPD patient count, appointment statistics)
- View and respond to feedback
- Audit logs

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js, Vite, Standard CSS |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL |
| **Authentication** | JWT, bcrypt |
| **Email** | Nodemailer (Gmail SMTP) |
| **Barcode** | bwip-js |
| **Version Control** | GitHub |
| **Design** | Figma |

---

## 📸 Screenshots

### Home Page
![Home Page](screenshots/Home%20Page.png)

### Patient Dashboard
![Patient Dashboard](screenshots/Patient%20Dashboard.png)

### Doctor Dashboard
![Doctor Dashboard](screenshots/Doctor%20Dashboard.png)

### Admin Dashboard
![Admin Dashboard](screenshots/Admin%20Dashboard.png)

### Pharmacist Dashboard
![Pharmacist Dashboard](screenshots/Pharmacist%20Dashboard.png)

### Lab Technician Dashboard
![Lab Technician Dashboard](screenshots/Lab%20Technician%20Dashboard.png)

### Receptionist Dashboard
![Receptionist Dashboard](screenshots/Receptionist%20Dashboard.png)

### More Screenshots
- [Login Screen](screenshots/Login%20Screen.png)
- [Register Screen](screenshots/Register%20Screen.png)
- [Patient Dashboard - Book Appointments](screenshots/Patient%20Dashboard_Book%20Bppointments.png)
- [Admin Reports](screenshots/Admin%20Reports.png)
- [Digital Prescription](screenshots/Digital%20Prescription.png)
- [Digital Request Form](screenshots/Digital%20Request%20Form.png)

For a complete list, see the [screenshots folder](screenshots/).


