const { db } = require('../config/db');
const transporter = require('../config/email');
const generateBarcodeDataURL = require('./barcode');
const { buildOpdSlipEmail } = require('./emailTemplates');

async function calcEstimatedTime(tokenNo) {
    try {
        const [rows] = await db.query(
            `SELECT setting_key, setting_value FROM system_settings
             WHERE setting_key IN ('opd_start_hour','slot_duration_minutes')`
        );
        const cfg = {};
        rows.forEach(r => { cfg[r.setting_key] = r.setting_value; });
        const startHour = parseInt(cfg.opd_start_hour) || 8;
        const slotMinutes = parseInt(cfg.slot_duration_minutes) || 10;
        const startTotal = startHour * 60 + (tokenNo - 1) * slotMinutes;
        const endTotal = startTotal + slotMinutes;
        const fmt = (mins) => {
            const h = Math.floor(mins / 60), m = mins % 60;
            const hr = h % 12 || 12, ampm = h < 12 ? 'AM' : 'PM';
            return `${String(hr).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
        };
        return `${fmt(startTotal)} – ${fmt(endTotal)}`;
    } catch { return null; }
}

function generateBarcode() {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BHK-${ts}-${rnd}`;
}

async function sendBookingEmail(patientId, appointmentId, date, tokenNo, estimatedTime, visitType) {
    try {
        const [pRows] = await db.query(
            `SELECT full_name, email, barcode, nic, patient_id FROM patient WHERE patient_id=? LIMIT 1`,
            [patientId]
        );
        if (!pRows.length || !pRows[0].email) return;
        const patient = pRows[0];
        let barcodeImage = '';
        try {
            barcodeImage = await generateBarcodeDataURL(patient.barcode);
        } catch (bErr) { console.warn('Barcode image failed:', bErr.message); }
        const appointment = {
            queue_no: tokenNo,
            appointment_day: date,
            time_slot: estimatedTime,
            visit_type: visitType,
        };
        const emailHtml = buildOpdSlipEmail(appointment, patient, barcodeImage);
        await transporter.sendMail({
            from: 'bhagya0913@gmail.com',
            to: patient.email,
            subject: `SmartOPD OPD Slip — Token #${tokenNo} · ${date}`,
            html: emailHtml
        });
        await db.query(
            `INSERT INTO notifications (patient_id, recipient_type, email_subject, message, status, sent_at)
             VALUES (?, 'patient', ?, ?, 'sent', NOW())`,
            [patientId, `OPD Appointment Confirmed — Token #${tokenNo}`, `Your appointment on ${date} is confirmed. Token: #${tokenNo}.`]
        ).catch(() => {});
    } catch (err) { console.error('Booking email error:', err); }
}

module.exports = { calcEstimatedTime, generateBarcode, sendBookingEmail };