require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const { initDB, db } = require('./config/db');  // Import both initDB and db

const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const pharmacistRoutes = require('./routes/pharmacistRoutes');
const labRoutes = require('./routes/labRoutes');
const receptionistRoutes = require('./routes/receptionistRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount routes
app.use('/api', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', doctorRoutes);
app.use('/api', pharmacistRoutes);
app.use('/api', labRoutes);
app.use('/api', receptionistRoutes);
app.use('/api', adminRoutes);

// Initialize DB and start server
initDB().then(() => {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
    });
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});

// Build registration email (with barcode image)
function buildRegistrationEmail(fullName, email, password, patientId, barcodeValue, barcodeImage) {
    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9">
        <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 32px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#fff">SmartOPD</div>
                <div style="font-size:13px;color:rgba(255,255,255,.8)">Base Hospital, Kiribathgoda</div>
            </div>
            <div style="padding:32px 32px;text-align:center">
                <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;border:3px solid #bfdbfe;font-size:28px">✅</div>
                <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Registration Successful!</h2>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px">Welcome to SmartOPD, ${fullName}.</p>

                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;text-align:left">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Patient ID</div>
                    <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:12px">${patientId}</div>
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:0 auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:10px;background:#fff;border-radius:8px"/>
                    <div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:10px;text-align:center">${barcodeValue}</div>
                </div>

                <div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-bottom:20px;border-left:4px solid #16a34a;text-align:left">
                    <p style="margin:0 0 4px;font-weight:700;color:#166534">Login Credentials</p>
                    <p style="margin:0;font-size:13px;color:#334155">Username: <strong>${email}</strong></p>
                    <p style="margin:0;font-size:13px;color:#334155">Password: <strong>${password}</strong></p>
                    <p style="margin:6px 0 0;font-size:12px;color:#6b7280">Please change your password after first login.</p>
                </div>

                <p style="font-size:12px;color:#94a3b8;margin:0">Keep this email safe. You will need the barcode at hospital visits.</p>
            </div>
            <div style="background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
                SmartOPD — Base Hospital Kiribathgoda | For internal use only
            </div>
        </div>
        </body>
        </html>
    `;
}

// Build OPD slip email (used after booking)
function buildOpdSlipEmail(appointment, patient, barcodeImage) {
    const startTime = appointment.time_slot ? appointment.time_slot.split('–')[0].trim() : '—';
    const dateObj = new Date(appointment.appointment_day);
    const formattedDate = dateObj.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `
        <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;border:1.5px solid #BBDEFB;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(21,101,192,.12)">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 20px;text-align:center">
                <div style="font-size:12px;color:rgba(255,255,255,.6);letter-spacing:3px;text-transform:uppercase;margin-bottom:12px">SmartOPD · Official OPD Slip</div>
                <div style="background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);border-radius:12px;padding:12px 20px;display:inline-block;margin-bottom:12px">
                    <div style="color:rgba(255,255,255,.7);font-size:10px;letter-spacing:2px;text-transform:uppercase">Queue Token</div>
                    <div style="color:white;font-size:56px;font-weight:900;line-height:1;letter-spacing:-2px">#${appointment.queue_no}</div>
                </div>
                <div style="color:rgba(255,255,255,.55);font-size:10px;letter-spacing:1.5px">BASE HOSPITAL, KIRIBATHGODA</div>
            </div>
            <div style="background:white;padding:20px">
                <div style="border-bottom:1px solid #E3F0FF;padding-bottom:12px;margin-bottom:12px">
                    <div style="font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Patient Name</div>
                    <div style="font-size:16px;font-weight:800;color:#0f172a">${patient.full_name}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px">ID: ${patient.patient_id} · NIC: ${patient.nic || '—'}</div>
                </div>
                <div style="background:#E3F0FF;border:1.5px solid #90BEF5;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between">
                    <div>
                        <div style="font-size:9px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase">Appointment Date</div>
                        <div style="font-size:13px;font-weight:800;color:#0D47A1;margin-top:4px">${formattedDate}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:9px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase">Reporting Time</div>
                        <div style="font-size:16px;font-weight:900;color:#1565C0;margin-top:4px">${startTime}</div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px">
                    <div style="flex:1;background:#f8fafc;border-radius:6px;padding:8px 12px">
                        <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Visit Type</div>
                        <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:2px">${appointment.visit_type || 'New'}</div>
                    </div>
                    <div style="flex:1;background:#f8fafc;border-radius:6px;padding:8px 12px">
                        <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Token No.</div>
                        <div style="font-size:20px;font-weight:900;color:#1565C0;margin-top:2px">#${appointment.queue_no}</div>
                    </div>
                </div>
                <div style="background:#f0f4fb;border:1px solid #E3F0FF;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Patient Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:6px auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:6px;background:#fff;border-radius:6px"/>
                    <div style="font-family:monospace;font-size:12px;font-weight:700;color:#1565C0;margin-top:4px">${patient.barcode}</div>
                </div>
            </div>
            <div style="background:#f8fafc;border-top:1px dashed #BBDEFB;padding:12px;text-align:center;font-size:11px;color:#475569">Present this slip at the OPD nursing station on arrival.</div>
        </div>
    `;
}

function buildRegistrationEmailForExistingStaff(fullName, email, patientId, barcodeValue, barcodeImage) {
    return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9">
        <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
            <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:24px 32px;text-align:center">
                <div style="font-size:28px;font-weight:800;color:#fff">SmartOPD</div>
                <div style="font-size:13px;color:rgba(255,255,255,.8)">Base Hospital, Kiribathgoda</div>
            </div>
            <div style="padding:32px 32px;text-align:center">
                <div style="width:64px;height:64px;background:#eff6ff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;border:3px solid #bfdbfe;font-size:28px">✅</div>
                <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Patient Registration Linked</h2>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px">Hello <strong>${fullName}</strong>, you are now also registered as a patient.</p>

                <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;text-align:left">
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Patient ID</div>
                    <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:12px">${patientId}</div>
                    <div style="font-size:12px;color:#64748b;margin-bottom:6px">Your Barcode</div>
                    <img src="${barcodeImage}" alt="Barcode" style="display:block;margin:0 auto;max-width:100%;height:auto;border:1px solid #e2e8f0;padding:10px;background:#fff;border-radius:8px"/>
                    <div style="font-size:14px;font-weight:700;font-family:monospace;margin-top:10px;text-align:center">${barcodeValue}</div>
                </div>

                <div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-bottom:20px;border-left:4px solid #16a34a;text-align:left">
                    <p style="margin:0 0 4px;font-weight:700;color:#166534">Your existing login credentials remain valid</p>
                    <p style="margin:0;font-size:13px;color:#334155">Username: <strong>${email}</strong></p>
                    <p style="margin:0;font-size:13px;color:#334155">Password: <strong>unchanged (your staff password)</strong></p>
                </div>

                <p style="font-size:12px;color:#94a3b8;margin:0">Keep this barcode for hospital visits.</p>
            </div>
            <div style="background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8">
                SmartOPD — Base Hospital Kiribathgoda | For internal use only
            </div>
        </div>
        </body>
        </html>
    `;
}

// OTP store
const otpStore = new Map();