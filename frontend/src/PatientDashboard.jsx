import React, { useState, useEffect, useCallback } from 'react';
import './common.css';
import './PatientDashboard.css';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
    Home, User, Users, Calendar, Clock, FileText, Pill, FlaskConical,
    MessageSquare, Activity, LogOut, Menu, X, ClipboardList, Stethoscope,
    Share2, Bell, Download, AlertCircle, CheckCircle2, ChevronRight,
    Heart, Phone, CreditCard, MapPin, Droplets, ShieldCheck, Zap,
    Send, Printer, Package, ArrowRight, ChevronDown, Hash
} from 'lucide-react';

const API = 'http://127.0.0.1:5001/api';

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '—'; }
};

// Formats a time string — returns only the STARTING time (e.g. "08:00 AM")
const fmtTime = (t) => {
    if (!t) return '—';
    const [h, m] = t.toString().split(':');
    const hr = parseInt(h);
    return `${String(hr % 12 || 12).padStart(2, '0')}:${m || '00'} ${hr < 12 ? 'AM' : 'PM'}`;
};

// Extract only the starting time from a slot string like "08:00 – 08:10" → "08:00 AM"
const fmtSlotStart = (appt) => {
    if (appt?.time_slot) {
        // "HH:MM – HH:MM" or "HH:MM AM – HH:MM PM"
        const part = appt.time_slot.split('–')[0].trim().split(' – ')[0].trim();
        // If already has AM/PM just return
        if (/AM|PM/.test(part)) return part;
        // Otherwise parse HH:MM
        const [h, m] = part.split(':');
        const hr = parseInt(h);
        if (!isNaN(hr)) return `${String(hr % 12 || 12).padStart(2, '0')}:${m || '00'} ${hr < 12 ? 'AM' : 'PM'}`;
    }
    if (appt?.start_time) return fmtTime(appt.start_time);
    return '—';
};

const calcAge = (dob) => {
    if (!dob) return null;
    const d = new Date(dob), n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
};
const getPid = (user) => user?.patient_id || user?.patientId || user?.id;

// Status sort weight — pending/booked first, then completed, then cancelled
const statusWeight = (s) => ({ booked: 0, active: 0, pending: 0, completed: 1, cancelled: 2, no_show: 3 }[s] ?? 1);

// ─── BARCODE SVG BUILDER ──────────────────────────────────────────────────────
function buildBarSvg(barcode, height = 32) {
    const str = (barcode || 'X') + 'SMARTOPD';
    let svgBars = '', x = 0;
    for (let i = 0; i < 60; i++) {
        const w = (str.charCodeAt(i % str.length) + i) % 3 === 0 ? 3 : 1;
        svgBars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#1565C0"/>`;
        x += w + (i % 5 === 0 ? 3 : 1);
    }
    return { svgBars, totalWidth: x };
}

function BarcodeStrips({ value = '', height = 32 }) {
    const bars = [], str = (value || 'X') + 'SMARTOPD', count = 60;
    for (let i = 0; i < count; i++) {
        const wide = (str.charCodeAt(i % str.length) + i) % 3 === 0;
        bars.push(<div key={i} style={{ width: wide ? '3px' : '1px', height: `${height}px`, background: '#1565C0', flexShrink: 0 }} />);
        if (i % 5 === 0) bars.push(<div key={`g${i}`} style={{ width: '2px', height: `${height}px`, flexShrink: 0 }} />);
    }
    return <div style={{ display: 'flex', alignItems: 'center', gap: '1px', justifyContent: 'center', overflow: 'hidden' }}>{bars}</div>;
}

// ─── PDF PRINT HELPER ─────────────────────────────────────────────────────────
function printPDF(htmlContent, filename) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return alert('Please allow popups to download.');
    win.document.write(`<!DOCTYPE html><html><head>
        <title>${filename}</title>
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { background:white; font-family:'Segoe UI',Arial,sans-serif; }
            @media print {
                @page { margin:10mm; size:A4; }
                body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                .no-print { display:none !important; }
            }
        </style>
    </head><body>${htmlContent}
    <script>
        window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},600);},400);};
    <\/script></body></html>`);
    win.document.close();
}

// ─── SHARED PDF HEADER ────────────────────────────────────────────────────────
const pdfHeader = (title, subtitle = '') => `
<div style="background:#0D47A1;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0;">
    <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#1565C0;border-radius:8px;border:1.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:white;">+</div>
        <div>
            <div style="color:white;font-size:12px;font-weight:700;letter-spacing:.5px;">BASE HOSPITAL, KIRIBATHGODA</div>
            <div style="color:rgba(255,255,255,.55);font-size:10px;margin-top:1px;">Ministry of Health · Sri Lanka · SmartOPD</div>
        </div>
    </div>
    <div style="text-align:right;">
        <div style="color:#90CAF9;font-size:13px;font-weight:700;letter-spacing:.5px;">${title}</div>
        ${subtitle ? `<div style="color:rgba(255,255,255,.5);font-size:10px;margin-top:2px;">${subtitle}</div>` : ''}
    </div>
</div>
<div style="height:3px;background:linear-gradient(90deg,#1565C0,#42A5F5);"></div>`;

// ─── DOWNLOAD ID CARD — redesigned as real hospital card ─────────────────────
function downloadIDCard(user) {
    const barcode    = user?.barcode       || 'PENDING';
    const name       = (user?.full_name    || 'Patient').toUpperCase();
    const age        = calcAge(user?.dob);
    const gender     = user?.gender        || '—';
    const phone      = user?.phone         || '—';
    const address    = user?.address_line1 || user?.address || '—';
    const bloodGroup = user?.blood_group   || '—';
    const nic        = user?.nic           || '—';
    const pid        = getPid(user)        || '—';
    const { svgBars, totalWidth } = buildBarSvg(barcode, 28);

    const field = (label, value, accent = false) =>
        `<div style="padding:7px 10px;background:${accent ? '#E3F0FF' : '#f8fafc'};border-radius:6px;border:1px solid ${accent ? '#90BEF5' : '#e2e8f0'};">
            <div style="font-size:6.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:2px;">${label}</div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;">${value}</div>
        </div>`;

    const html = `
    <div style="width:440px;margin:24px auto;font-family:'Segoe UI',Arial,sans-serif;border-radius:14px;overflow:hidden;border:1.5px solid #BBDEFB;box-shadow:0 6px 28px rgba(21,101,192,.15);">

        <!-- Top blue header bar -->
        <div style="background:linear-gradient(135deg,#0D47A1 0%,#1565C0 60%,#1976D2 100%);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:34px;height:34px;background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:900;color:white;">+</div>
                <div>
                    <div style="color:white;font-size:9px;font-weight:700;letter-spacing:1.2px;">BASE HOSPITAL, KIRIBATHGODA</div>
                    <div style="color:rgba(255,255,255,.6);font-size:7px;margin-top:1px;">Ministry of Health · Sri Lanka</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:white;font-size:6.5px;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:2px;">PATIENT ID CARD</div>
        </div>

        <!-- Accent strip -->
        <div style="height:3px;background:linear-gradient(90deg,#42A5F5,#90CAF9,#42A5F5);"></div>

        <!-- Name + avatar row on white -->
        <div style="background:white;padding:14px 18px 12px;display:flex;align-items:center;gap:14px;border-bottom:1.5px solid #E3F0FF;">
            <div style="width:50px;height:50px;background:linear-gradient(135deg,#1565C0,#0D47A1);border-radius:10px;border:2px solid #90BEF5;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;flex-shrink:0;">
                ${(user?.full_name || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
                <div style="font-size:15px;font-weight:800;color:#0D1828;letter-spacing:.3px;">${name}</div>
                <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
                    <span style="font-size:9px;color:#64748b;font-weight:600;">PATIENT ID:</span>
                    <code style="font-size:11px;font-weight:800;color:#1565C0;background:#E3F0FF;padding:2px 8px;border-radius:4px;letter-spacing:.5px;">${pid}</code>
                </div>
            </div>
        </div>

        <!-- Fields grid -->
        <div style="background:white;padding:12px 18px 14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px;">
                ${field('NIC Number', nic, true)}
                ${field('Blood Group', bloodGroup, true)}
                ${field('Phone', phone)}
                ${field('Age / Gender', age !== null ? `${age} yrs · ${gender}` : gender)}
                <div style="grid-column:1/-1;">${field('Address', address)}</div>
            </div>
        </div>

        <!-- Barcode footer -->
        <div style="background:#f0f4fb;padding:10px 18px 12px;border-top:1.5px solid #E3F0FF;">
            <div style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;">Patient Barcode</div>
            <svg width="100%" height="28" viewBox="0 0 ${totalWidth + 20} 28" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(10,0)">${svgBars}</g>
            </svg>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                <span style="font-family:Courier New,monospace;font-size:9px;font-weight:700;color:#1565C0;letter-spacing:2px;">${barcode}</span>
                <span style="font-size:7px;color:#94a3b8;">SmartOPD · Base Hospital Kiribathgoda</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `PatientID_${barcode}`);
}

// ─── DOWNLOAD OPD SLIP — clean hospital slip, start time only ─────────────────
function downloadOPDSlip(appt, user) {
    if (!appt) return;
    const barcode  = user?.barcode    || '';
    const name     = (user?.full_name || '').toUpperCase();
    const age      = calcAge(user?.dob);
    const token    = appt.queue_no   || '';
    const rawDate  = (appt.appointment_day || '').toString().split('T')[0];
    const date     = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const startTime = fmtSlotStart(appt);   // ← starting time only
    const nic      = user?.nic        || '—';
    const pid      = getPid(user)     || '—';
    const { svgBars, totalWidth } = buildBarSvg(barcode, 26);
    const issued   = new Date().toLocaleString('en-GB');

    const html = `
    <div style="width:360px;margin:20px auto;font-family:'Segoe UI',Arial,sans-serif;border:1.5px solid #BBDEFB;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(21,101,192,.12);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0D47A1,#1565C0);padding:20px 22px 16px;text-align:center;position:relative;">
            <div style="font-size:7.5px;color:rgba(255,255,255,.6);letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">SmartOPD · Official OPD Slip</div>
            <!-- Token box -->
            <div style="background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.25);border-radius:12px;padding:12px 20px;display:inline-block;margin-bottom:10px;">
                <div style="color:rgba(255,255,255,.7);font-size:7.5px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:4px;">Queue Token</div>
                <div style="color:white;font-size:64px;font-weight:900;line-height:1;letter-spacing:-3px;">#${token}</div>
            </div>
            <div style="color:rgba(255,255,255,.55);font-size:7.5px;letter-spacing:1.5px;">BASE HOSPITAL, KIRIBATHGODA</div>
        </div>

        <!-- Accent line -->
        <div style="height:3px;background:linear-gradient(90deg,#42A5F5,#90CAF9,#42A5F5);"></div>

        <!-- Patient info -->
        <div style="background:white;padding:16px 18px;">
            <div style="border-bottom:1px solid #E3F0FF;padding-bottom:12px;margin-bottom:12px;">
                <div style="font-size:6.5px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Patient Name</div>
                <div style="font-size:14px;font-weight:800;color:#0f172a;">${name}</div>
                <div style="font-size:10px;color:#64748b;margin-top:3px;">
                    ${age !== null ? `Age: ${age} yrs &nbsp;·&nbsp; ` : ''}ID: ${pid} &nbsp;·&nbsp; NIC: ${nic}
                </div>
            </div>

            <!-- Key info grid — date + time prominent -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-bottom:1px solid #E3F0FF;padding-bottom:12px;margin-bottom:12px;">
                <div style="grid-column:1/-1;background:#E3F0FF;border:1.5px solid #90BEF5;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div style="font-size:6.5px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;">Appointment Date</div>
                        <div style="font-size:12px;font-weight:800;color:#0D47A1;">${date}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:6.5px;color:#1565C0;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;">Reporting Time</div>
                        <div style="font-size:16px;font-weight:900;color:#1565C0;">${startTime}</div>
                    </div>
                </div>
                <div>
                    <div style="font-size:6.5px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Visit Type</div>
                    <div style="font-size:11px;font-weight:600;color:#0f172a;">${appt.visit_type || 'New'}</div>
                </div>
                <div>
                    <div style="font-size:6.5px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">Token No.</div>
                    <div style="font-size:22px;font-weight:900;color:#1565C0;">#${token}</div>
                </div>
            </div>

            <!-- Barcode -->
            <div style="background:#f0f4fb;border:1px solid #E3F0FF;border-radius:8px;padding:10px 12px 8px;">
                <div style="font-size:6.5px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Patient Barcode</div>
                <svg width="100%" height="26" viewBox="0 0 ${totalWidth + 20} 26" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(10,0)">${svgBars}</g>
                </svg>
                <div style="text-align:center;margin-top:4px;">
                    <span style="font-family:Courier New,monospace;font-size:8px;font-weight:700;color:#1565C0;letter-spacing:2px;">${barcode}</span>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div style="background:#f0f4fb;border-top:1px dashed #BBDEFB;padding:10px 16px;text-align:center;">
            <div style="font-size:8px;color:#334155;font-weight:600;margin-bottom:2px;">Present this slip at the OPD nursing station on arrival.</div>
            <div style="font-size:7px;color:#94a3b8;">Issued: ${issued} · Base Hospital Kiribathgoda · SmartOPD</div>
        </div>
    </div>`;
    printPDF(html, `OPDSlip_Token${token}_${rawDate}`);
}

// ─── DOWNLOAD PRESCRIPTION PDF ────────────────────────────────────────────────
function downloadPrescriptionPDF(rx, user) {
    const name = user?.full_name || '—';
    const nic  = user?.nic       || '—';
    const pid  = getPid(user)    || '—';
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('PRESCRIPTION', `REF: RX-${String(rx.record_id).padStart(6, '0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
                <div style="font-size:14px;font-weight:700;color:#0f172a;">${name}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">NIC: ${nic} &nbsp;·&nbsp; Patient ID: ${pid}</div>
                <div style="font-size:10px;color:#64748b;">Date: ${fmtDate(rx.consultation_day)} · Dr. ${rx.doctor_name || 'Staff'}</div>
            </div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Medicines &amp; Instructions</div>
            <pre style="font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;color:#1e293b;line-height:1.7;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;">${rx.prescription_details || '—'}</pre>
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
                <span>SmartOPD · Base Hospital Kiribathgoda · Ministry of Health</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `RX_${String(rx.record_id).padStart(6, '0')}`);
}

// ─── DOWNLOAD LAB PDF ─────────────────────────────────────────────────────────
function downloadLabPDF(t, user) {
    const name = user?.full_name || '—';
    const pid  = getPid(user)    || '—';
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('LAB / DIAGNOSTIC REPORT', `TEST-${String(t.test_id).padStart(6, '0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${name}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Patient ID: ${pid} · Test: ${t.test_name} · Type: ${t.test_type}</div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Result Summary</div>
            <div style="font-size:12px;color:#1e293b;line-height:1.7;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;">${t.result_summary || 'Results pending.'}</div>
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
                <span>SmartOPD · Base Hospital Kiribathgoda</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `Lab_${t.test_id}`);
}

// ─── DOWNLOAD REFERRAL PDF ────────────────────────────────────────────────────
function downloadReferralPDF(r, user) {
    const name = user?.full_name || '—';
    const pid  = getPid(user)    || '—';
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('REFERRAL LETTER', `REF-${String(r.referral_id).padStart(5, '0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${name}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Patient ID: ${pid} · Referred to: ${r.target_clinic || '—'} · ${r.urgency || ''}</div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Reason for Referral</div>
            <div style="font-size:12px;color:#1e293b;line-height:1.7;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;">${r.reason || '—'}</div>
            <div style="margin-top:14px;font-size:10px;color:#64748b;">Issued by: ${r.issued_by_name || '—'} · Date: ${fmtDate(r.referral_date)}</div>
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
                <span>SmartOPD · Base Hospital Kiribathgoda</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `Referral_${r.referral_id}`);
}

// ─── DOWNLOAD HISTORY PDF ─────────────────────────────────────────────────────
function downloadHistoryPDF(type, data, user) {
    const name    = user?.full_name || '—';
    const nic     = user?.nic       || '—';
    const pid     = getPid(user)    || '—';
    const barcode = user?.barcode   || '—';
    const { svgBars, totalWidth } = buildBarSvg(barcode, 20);
    const titles = { prescriptions: 'PRESCRIPTION HISTORY', labs: 'DIAGNOSTIC TEST HISTORY', referrals: 'REFERRAL HISTORY' };
    let rows = '';
    if (type === 'prescriptions') {
        rows = data.map(r => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">
            <div style="background:#E3F0FF;padding:8px 14px;border-bottom:1px solid #BBDEFB;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;font-weight:700;color:#0D47A1;">RX-${String(r.record_id).padStart(6, '0')}</span>
                <span style="font-size:9px;color:#64748b;">${fmtDate(r.consultation_day)}</span>
            </div>
            <div style="padding:10px 14px;">
                <pre style="font-family:'Courier New',monospace;font-size:11px;white-space:pre-wrap;color:#1e293b;line-height:1.6;">${r.prescription_details || '—'}</pre>
            </div>
        </div>`).join('');
    } else if (type === 'labs') {
        rows = data.map(t => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">
            <div style="background:#E3F0FF;padding:8px 14px;border-bottom:1px solid #BBDEFB;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;font-weight:700;color:#0D47A1;">${t.test_name} · ${t.test_type}</span>
                <span style="font-size:9px;color:#64748b;">${fmtDate(t.requested_at)}</span>
            </div>
            <div style="padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><span style="font-size:8px;color:#64748b;font-weight:700;display:block;">Requested By</span><span style="font-size:11px;color:#1e293b;">${t.doctor_name || '—'}</span></div>
                <div><span style="font-size:8px;color:#64748b;font-weight:700;display:block;">Status</span><span style="font-size:11px;color:#1e293b;">${t.status}</span></div>
                ${t.result_summary ? `<div style="grid-column:1/-1"><span style="font-size:8px;color:#64748b;font-weight:700;display:block;">Result</span><span style="font-size:11px;color:#1e293b;">${t.result_summary}</span></div>` : ''}
            </div>
        </div>`).join('');
    } else {
        rows = data.map(r => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;">
            <div style="background:#fff7ed;padding:8px 14px;border-bottom:1px solid #fed7aa;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;font-weight:700;color:#c2410c;">→ ${r.target_clinic || 'Referral'} · ${r.urgency}</span>
                <span style="font-size:9px;color:#64748b;">${fmtDate(r.referral_date)}</span>
            </div>
            <div style="padding:10px 14px;">
                <div style="font-size:8px;color:#64748b;font-weight:700;margin-bottom:3px;">Reason</div>
                <div style="font-size:11px;color:#1e293b;line-height:1.6;">${r.reason || '—'}</div>
                <div style="margin-top:6px;font-size:9px;color:#64748b;">Issued by: ${r.issued_by_name || '—'}</div>
            </div>
        </div>`).join('');
    }

    const html = `
    <div style="max-width:700px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader(titles[type] || 'MEDICAL HISTORY', `${data.length} record(s)`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
                <div style="font-size:14px;font-weight:700;color:#0f172a;">${name}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">ID: ${pid} &nbsp;·&nbsp; NIC: ${nic} &nbsp;·&nbsp; Barcode: ${barcode}</div>
            </div>
            <div>
                <svg width="120" height="20" viewBox="0 0 ${Math.min(totalWidth + 20, 120)} 20" xmlns="http://www.w3.org/2000/svg"><g transform="translate(5,0)">${svgBars}</g></svg>
                <div style="font-family:'Courier New',monospace;font-size:7px;color:#1565C0;text-align:center;">${barcode}</div>
            </div>
        </div>
        <div style="padding:20px 28px;">
            ${rows || '<div style="text-align:center;color:#94a3b8;padding:20px;font-size:12px;">No records found.</div>'}
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
                <span>SmartOPD · Base Hospital Kiribathgoda · Ministry of Health</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `${type}_history_${pid}`);
}

// ─── SHARED ATOMS ─────────────────────────────────────────────────────────────
const Spinner = () => (
    <div className="page-content loading-state">
        <div className="spinner" />
    </div>
);
const EmptyState = ({ icon: Icon, title, sub }) => (
    <div className="page-content empty-state">
        <div className="empty-icon-wrap"><Icon size={32} strokeWidth={1.5} /></div>
        <h3>{title}</h3>
        <p>{sub}</p>
    </div>
);

// ─── HOSPITAL ID CARD (on-screen) — light blue theme ─────────────────────────
function HospitalIDCard({ user }) {
    const barcode    = user?.barcode             || 'PENDING';
    const name       = user?.full_name           || 'Patient Name';
    const age        = calcAge(user?.dob);
    const gender     = user?.gender              || '—';
    const phone      = user?.phone               || '—';
    const bloodGroup = user?.blood_group         || '—';
    const address    = user?.address_line1       || user?.address || '—';
    const nic        = user?.nic                 || '—';
    const pid        = getPid(user)              || '—';

    return (
        <div className="id-card">
            {/* Card header — blue gradient */}
            <div className="id-card-header">
                <div className="id-card-header-left">
                    <div className="id-card-cross-icon"><Activity size={14} color="white" /></div>
                    <div>
                        <div className="id-card-hosp-name">BASE HOSPITAL, KIRIBATHGODA</div>
                        <div className="id-card-hosp-sub">Ministry of Health · Sri Lanka</div>
                    </div>
                </div>
                <div className="id-card-type-badge">PATIENT ID</div>
            </div>

            {/* Blue accent line */}
            <div className="id-card-accent-line" />

            {/* Name strip — white with avatar */}
            <div className="id-card-name-strip">
                <div className="id-card-avatar">{name.charAt(0).toUpperCase()}</div>
                <div className="id-card-name-block">
                    <div className="id-card-fullname">{name.toUpperCase()}</div>
                    <div className="id-card-pid-row">
                        <span className="id-card-pid-label">PATIENT ID</span>
                        <code className="id-card-pid-value">{pid}</code>
                    </div>
                </div>
            </div>

            {/* Fields */}
            <div className="id-card-fields">
                <div className="id-card-field accent">
                    <span className="id-card-field-label">NIC</span>
                    <span className="id-card-field-value">{nic}</span>
                </div>
                <div className="id-card-field accent">
                    <span className="id-card-field-label">Blood Group</span>
                    <span className="id-card-field-value blood">{bloodGroup}</span>
                </div>
                <div className="id-card-field">
                    <span className="id-card-field-label">Phone</span>
                    <span className="id-card-field-value">{phone}</span>
                </div>
                <div className="id-card-field">
                    <span className="id-card-field-label">Age / Gender</span>
                    <span className="id-card-field-value">{age !== null ? `${age} yrs` : '—'} · {gender}</span>
                </div>
                <div className="id-card-field wide">
                    <span className="id-card-field-label">Address</span>
                    <span className="id-card-field-value">{address}</span>
                </div>
            </div>

            {/* Barcode footer */}
            <div className="id-card-barcode">
                <BarcodeStrips value={barcode} height={24} />
                <div className="id-card-barcode-row">
                    <span className="id-card-barcode-num">{barcode}</span>
                    <span className="id-card-barcode-brand">SmartOPD</span>
                </div>
            </div>
        </div>
    );
}

// ─── OPD SLIP CARD (on-screen) ────────────────────────────────────────────────
function OPDSlipCard({ appt, user }) {
    if (!appt) return null;
    const startTime  = fmtSlotStart(appt);
    const rawDate    = (appt.appointment_day || '').toString().split('T')[0];
    const formattedDate = rawDate
        ? new Date(rawDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
    const barcode   = user?.barcode    || '';
    const name      = (user?.full_name || '').toUpperCase();
    const age       = calcAge(user?.dob);
    const nic       = user?.nic        || '—';
    const pid       = getPid(user)     || '—';
    const token     = appt.queue_no   || '—';

    return (
        <div className="opd-slip-card">
            {/* Header — deep blue, big token number (matches email) */}
            <div className="opd-slip-header">
                <div className="opd-slip-brand">SmartOPD &nbsp;·&nbsp; Official OPD Slip</div>
                <div className="opd-slip-token-box">
                    <span className="opd-slip-token-label">QUEUE TOKEN</span>
                    <span className="opd-slip-token-num">#{token}</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '.62rem', letterSpacing: '1.5px', marginTop: '8px' }}>
                    BASE HOSPITAL, KIRIBATHGODA
                </div>
            </div>

            {/* Accent line */}
            <div className="opd-slip-accent" />

            {/* Patient name */}
            <div className="opd-slip-body">
                <div style={{ borderBottom: '1px solid #E3F0FF', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '.6rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>Patient Name</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{name}</div>
                    <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: '3px' }}>
                        {age !== null ? `Age: ${age} yrs · ` : ''}ID: {pid} &nbsp;·&nbsp; NIC: {nic}
                    </div>
                </div>

                {/* Date + Time highlighted row (matches email layout) */}
                <div className="opd-slip-row-2" style={{ marginBottom: '10px' }}>
                    <div className="opd-slip-highlight" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span className="opd-slip-field-label"><Calendar size={10} /> Appointment Date</span>
                            <div className="opd-slip-date" style={{ marginTop: '2px' }}>{formattedDate}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span className="opd-slip-field-label"><Clock size={10} /> Reporting Time</span>
                            <div className="opd-slip-time" style={{ marginTop: '2px' }}>{startTime}</div>
                        </div>
                    </div>
                </div>

                {/* Visit type + Token */}
                <div className="opd-slip-row-2" style={{ marginBottom: '10px' }}>
                    <div className="opd-slip-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                        <span className="opd-slip-field-label"><Stethoscope size={10} /> Visit Type</span>
                        <span className="opd-slip-field-value">{appt.visit_type || 'New'}</span>
                    </div>
                    <div className="opd-slip-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                        <span className="opd-slip-field-label"><Hash size={10} /> Token No.</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1565C0' }}>#{token}</span>
                    </div>
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                    <span className="opd-slip-field-label"><ShieldCheck size={10} /> Status</span>
                    <span className={`appt-badge ${appt.status}`}>{appt.status.toUpperCase()}</span>
                </div>
            </div>

            {/* Barcode (matches email style) */}
            <div className="opd-slip-barcode">
                <BarcodeStrips value={barcode} height={22} />
                <code>{barcode}</code>
            </div>

            <div className="opd-slip-footer">Present this slip at the OPD nursing station on arrival.</div>
        </div>
    );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function DashboardHome({ user, myAppointments }) {
    const today = new Date().toISOString().split('T')[0];

    // Active appointment today (booked or active status, today's date)
    const activeAppt = myAppointments.find(a =>
        ['booked', 'active'].includes(a.status) &&
        (a.appointment_day || '').toString().startsWith(today)
    );

    // Latest booked appointment (could be today or upcoming) — shown in slip when no "today" appt
    const latestBooked = myAppointments
        .filter(a => ['booked', 'active'].includes(a.status))
        .sort((a, b) => new Date(a.appointment_day) - new Date(b.appointment_day))[0];

    // Slip to display = today's first, else latest booked (requirement #3)
    const slipAppt = activeAppt || latestBooked;

    const upcoming  = myAppointments.filter(a => a.status === 'booked').length;
    const completed = myAppointments.filter(a => a.status === 'completed').length;

    return (
        <div className="home-page-wrapper">
            <div className={`home-grid ${!slipAppt ? 'home-grid-single' : ''}`}>
                {/* ID Card column */}
                <div className="home-card-col">
                    <div className="home-col-label"><CreditCard size={14} /> Hospital ID Card</div>
                    <HospitalIDCard user={user} />
                    <button className="dl-btn" onClick={() => downloadIDCard(user)}>
                        <Printer size={14} /> Print / Download ID Card
                    </button>
                </div>

                {/* OPD Slip column — visible whenever there is any booked appt */}
                {slipAppt && (
                    <div className="home-card-col">
                        <div className="home-col-label">
                            <Calendar size={14} />
                            {activeAppt ? "Today's OPD Slip" : "Latest Appointment Slip"}
                        </div>
                        <OPDSlipCard appt={slipAppt} user={user} />
                        <button className="dl-btn" onClick={() => downloadOPDSlip(slipAppt, user)}>
                            <Printer size={14} /> Print / Download OPD Slip
                        </button>
                    </div>
                )}
            </div>

            {/* Quick stats */}
            <div className="home-quick-stats">
                <div className="qs-card">
                    <div className="qs-icon" style={{ background: '#E3F0FF' }}><Calendar size={18} color="#1565C0" /></div>
                    <div className="qs-text"><span className="qs-num">{upcoming}</span><span className="qs-label">Upcoming</span></div>
                </div>
                <div className="qs-card">
                    <div className="qs-icon" style={{ background: '#f0fdf4' }}><CheckCircle2 size={18} color="#16a34a" /></div>
                    <div className="qs-text"><span className="qs-num">{completed}</span><span className="qs-label">Completed</span></div>
                </div>
                <div className="qs-card">
                    <div className="qs-icon" style={{ background: '#fdf4ff' }}><Droplets size={18} color="#a21caf" /></div>
                    <div className="qs-text"><span className="qs-num">{user?.blood_group || '?'}</span><span className="qs-label">Blood Group</span></div>
                </div>
                <div className="qs-card">
                    <div className="qs-icon" style={{ background: '#fff7ed' }}><Zap size={18} color="#ea580c" /></div>
                    <div className="qs-text"><span className="qs-num">{calcAge(user?.dob) ?? '—'}</span><span className="qs-label">Age (yrs)</span></div>
                </div>
            </div>
        </div>
    );
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────
function Appointments({ user, myAppointments, setMyAppointments }) {
    const [selectedDate, setSelectedDate] = useState('');
    const [visitType,    setVisitType]    = useState('New');
    const [loading,      setLoading]      = useState(false);
    const [checking,     setChecking]     = useState(false);
    const [dayStatus,    setDayStatus]    = useState(null);
    const [filter,       setFilter]       = useState('all');   // all | booked | completed | cancelled
    const today = new Date().toISOString().split('T')[0];

    const fetchAppts = useCallback(async () => {
        const pid = getPid(user); if (!pid) return;
        try {
            const r = await fetch(`${API}/my-appointments?patientId=${pid}`);
            const d = await r.json();
            if (d.success) setMyAppointments(d.appointments);
        } catch {}
    }, [user, setMyAppointments]);

    useEffect(() => { fetchAppts(); }, [fetchAppts]);

    // Availability check when date changes
    useEffect(() => {
        if (!selectedDate) { setDayStatus(null); return; }
        setChecking(true); setDayStatus(null);
        fetch(`${API}/opd-slots?date=${selectedDate}`)
            .then(r => r.json())
            .then(d => {
                if (!d.success) { setDayStatus({ closed: false, error: d.message }); return; }
                if (d.closed)   { setDayStatus({ closed: true }); return; }
                const totalCap  = (d.slots || []).reduce((s, sl) => s + sl.capacity, 0);
                const totalBook = (d.slots || []).reduce((s, sl) => s + sl.booked, 0);
                const remaining = Math.max(0, totalCap - totalBook);
                setDayStatus({ closed: false, total: totalCap, booked: totalBook, remaining });
            })
            .catch(() => setDayStatus({ error: 'Cannot reach server.' }))
            .finally(() => setChecking(false));
    }, [selectedDate]);

    const handleBook = async (e) => {
        e.preventDefault();
        if (!selectedDate) return;
        if (dayStatus?.remaining === 0) return alert('This date is fully booked (60/60). Please choose another date.');
        setLoading(true);
        try {
            const r = await fetch(`${API}/book-appointment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: getPid(user), date: selectedDate, visitType })
            });
            const d = await r.json();
            if (d.success) {
                setSelectedDate(''); setDayStatus(null);
                // Optimistically add new appt so Home slip shows immediately
                const newAppt = {
                    appointment_id: d.appointmentId || Date.now(),
                    appointment_day: selectedDate,
                    start_time: null,
                    time_slot: d.estimatedTime || null,
                    queue_no: d.tokenNo,
                    visit_type: visitType,
                    status: 'booked',
                };
                setMyAppointments(prev => [newAppt, ...prev]);
                // Then do a real refresh to get full server data
                fetchAppts();
                alert(`✓ Appointment booked!\nToken: #${d.tokenNo}\nReporting time: ${d.estimatedTime ? d.estimatedTime.split('–')[0].trim() : 'Confirm on arrival'}`);
            } else alert(d.message);
        } catch { alert('Connection error.'); }
        finally { setLoading(false); }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this appointment?')) return;
        try {
            const r = await fetch(`${API}/cancel-appointment/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.success) fetchAppts(); else alert(d.message);
        } catch { alert('Server error.'); }
    };

    const remaining = dayStatus?.remaining ?? null;
    const isFull    = remaining === 0;
    const canBook   = selectedDate && dayStatus && !dayStatus.closed && !dayStatus.error && !isFull;

    // Sort: latest date first; within same date, sort by status weight
    const sorted = [...myAppointments].sort((a, b) => {
        const dateDiff = new Date(b.appointment_day) - new Date(a.appointment_day);
        if (dateDiff !== 0) return dateDiff;
        return statusWeight(a.status) - statusWeight(b.status);
    });

    // Filter
    const filtered = filter === 'all' ? sorted : sorted.filter(a => a.status === filter);

    const statusCounts = {
        all:       myAppointments.length,
        booked:    myAppointments.filter(a => a.status === 'booked').length,
        completed: myAppointments.filter(a => a.status === 'completed').length,
        cancelled: myAppointments.filter(a => ['cancelled', 'no_show'].includes(a.status)).length,
    };

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#1565C0,#42A5F5)' }}><Calendar size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">Booking Centre</h2>
                    <p className="page-subtitle">Book for: <strong>{user?.full_name}</strong></p>
                </div>
            </div>

            {/* Booking form */}
            <div className="form-card">
                <h4 className="form-card-title">Schedule New Visit</h4>
                <p style={{ fontSize: '.82rem', color: '#64748b', marginBottom: '16px' }}>
                    Select a date — your token and reporting time are assigned automatically (First Come, First Served · Max 60 patients/day).
                </p>
                <form onSubmit={handleBook}>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="input-label">Appointment Date</label>
                            <input type="date" className="custom-input" min={today}
                                value={selectedDate} onChange={e => setSelectedDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Visit Type</label>
                            <select className="custom-input" value={visitType} onChange={e => setVisitType(e.target.value)}>
                                <option value="New">New Patient</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="Report-view">Report Review</option>
                            </select>
                        </div>
                    </div>

                    {/* Availability indicator */}
                    {selectedDate && (
                        <div className={`day-status-box ${checking ? 'loading' : dayStatus?.closed ? 'closed' : isFull ? 'full' : dayStatus ? 'open' : ''}`}>
                            {checking && <><span className="btn-spinner" /> Checking availability…</>}
                            {!checking && dayStatus?.error   && <><AlertCircle size={15} /> {dayStatus.error}</>}
                            {!checking && dayStatus?.closed  && <><AlertCircle size={15} /> OPD is closed on this date.</>}
                            {!checking && dayStatus && !dayStatus.closed && !dayStatus.error && (
                                <>
                                    <div className="day-status-info">
                                        <div className="day-status-bar-wrap">
                                            <div className="day-status-bar" style={{ width: `${Math.round(((dayStatus.booked || 0) / 60) * 100)}%` }} />
                                        </div>
                                        <span>{dayStatus.booked || 0} / 60 booked</span>
                                    </div>
                                    {isFull
                                        ? <span className="day-status-tag full">Fully Booked</span>
                                        : <span className="day-status-tag open">{remaining} slots remaining</span>
                                    }
                                </>
                            )}
                        </div>
                    )}

                    <button type="submit" className="primary-btn" disabled={loading || !canBook || checking}>
                        {loading
                            ? <><span className="btn-spinner" />Processing…</>
                            : <><Calendar size={15} />Confirm Appointment</>}
                    </button>
                </form>
            </div>

            {/* ── Appointment History — full list, requirement #4 ── */}
            <div className="section-divider"><span>Appointment History</span></div>

            {/* Filter chips */}
            <div className="appt-filter-row">
                {[['all', 'All'], ['booked', 'Pending'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([val, label]) => (
                    <button key={val} className={`appt-filter-chip ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>
                        {label}
                        <span className="chip-count">{statusCounts[val] ?? 0}</span>
                    </button>
                ))}
            </div>

            {/* Appointments table */}
            <div className="table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Reporting Time</th>
                            <th>Visit Type</th>
                            <th>Token</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0
                            ? filtered.map(a => (
                                <tr key={a.appointment_id} className={a.status === 'booked' ? 'row-booked' : ''}>
                                    <td>
                                        <strong>{fmtDate(a.appointment_day)}</strong>
                                        {/* "TODAY" tag */}
                                        {(a.appointment_day || '').toString().startsWith(today) && (
                                            <span className="today-tag">TODAY</span>
                                        )}
                                    </td>
                                    {/* Starting time only — requirement #4 */}
                                    <td className="mono-text">{fmtSlotStart(a)}</td>
                                    <td>{a.visit_type}</td>
                                    <td><span className="token-chip"><Hash size={11} />{a.queue_no}</span></td>
                                    <td><span className={`appt-badge ${a.status}`}>{a.status.replace('_', ' ').toUpperCase()}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="slip-link" title="Download OPD Slip"
                                                onClick={() => downloadOPDSlip(a, user)}><Printer size={13} /></button>
                                            {a.status === 'booked' && (
                                                <button className="cancel-link" onClick={() => handleCancel(a.appointment_id)}>Cancel</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                            : <tr><td colSpan="6" className="table-empty">No appointments found.</td></tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── MEDICAL RECORDS ──────────────────────────────────────────────────────────
function MedicalRecords({ user }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const pid = getPid(user); if (!pid) return;
        fetch(`${API}/medical-records/${pid}`)
            .then(r => r.json()).then(d => { if (d.success) setRecords(d.records); })
            .finally(() => setLoading(false));
    }, [user]);

    if (loading) return <Spinner />;
    if (!records.length) return <EmptyState icon={FileText} title="No Medical History" sub="Your clinical records appear after your first consultation." />;

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#1565C0,#42A5F5)' }}><ClipboardList size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">Clinical Records</h2>
                    <p className="page-subtitle">{records.length} consultation{records.length !== 1 ? 's' : ''} on file</p>
                </div>
            </div>
            <div className="timeline">
                {records.map(rec => (
                    <div key={rec.record_id} className="timeline-item">
                        <div className="tl-date">
                            <span className="tl-day">{new Date(rec.consultation_day).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</span>
                            <span className="tl-year">{new Date(rec.consultation_day).getFullYear()}</span>
                        </div>
                        <div className="tl-dot" />
                        <div className="clinical-card">
                            <div className="clinical-card-top">
                                <div className="diagnosis-tag"><Stethoscope size={13} /><span>{rec.diagnosis || 'General Consultation'}</span></div>
                                <span className="by-stamp">{rec.doctor_name || `Staff #${rec.created_by}`}</span>
                            </div>
                            <div className="clinical-grid">
                                {rec.chief_complaint     && <div className="clinical-cell"><label>Chief Complaint</label><p>{rec.chief_complaint}</p></div>}
                                {rec.clinical_findings   && <div className="clinical-cell"><label>Clinical Findings</label><p>{rec.clinical_findings}</p></div>}
                                {rec.treatment_details   && <div className="clinical-cell wide"><label>Treatment</label><p>{rec.treatment_details}</p></div>}
                                {rec.prescription_details && <div className="clinical-cell wide"><label>Prescription</label><pre className="rx-pre">{rec.prescription_details}</pre></div>}
                            </div>
                            <div className="clinical-card-footer">
                                {rec.follow_up_date && <span className="footer-chip blue"><Calendar size={11} />Follow-up: {fmtDate(rec.follow_up_date)}</span>}
                                {rec.weight_kg && <span className="footer-chip gray"><Activity size={11} />{rec.weight_kg}kg · {rec.height_cm}cm</span>}
                                <span className="appt-ref">Appt #{rec.appointment_id}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── PRESCRIPTIONS ────────────────────────────────────────────────────────────
function Prescriptions({ user }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const pid = getPid(user); if (!pid) return;
        fetch(`${API}/prescriptions/${pid}`)
            .then(r => r.json()).then(d => { if (d.success) setRecords(d.prescriptions); })
            .finally(() => setLoading(false));
    }, [user]);

    if (loading) return <Spinner />;
    if (!records.length) return <EmptyState icon={Pill} title="No Prescriptions" sub="Prescriptions from your consultations will appear here." />;

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}><Pill size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">Prescriptions</h2>
                    <p className="page-subtitle">{records.length} prescription{records.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="history-dl-btn" onClick={() => downloadHistoryPDF('prescriptions', records, user)}>
                    <Download size={14} /> Download All
                </button>
            </div>
            <div className="cards-list">
                {records.map(rx => {
                    const done = !!rx.fulfilled_at;
                    return (
                        <div key={rx.record_id} className="doc-card">
                            <div className="doc-card-header rx-header">
                                <div className="doc-rx-symbol">℞</div>
                                <div className="doc-header-info">
                                    <div className="doc-header-title">Prescription</div>
                                    <div className="doc-header-meta">RX-{String(rx.record_id).padStart(6, '0')} · Visit #{rx.appointment_id}</div>
                                </div>
                                <div className="doc-header-right">
                                    <div className="doc-date">{fmtDate(rx.consultation_day)}</div>
                                    <span className={`appt-badge ${done ? 'completed' : 'booked'}`}>{done ? 'Dispensed' : 'Pending'}</span>
                                </div>
                            </div>
                            <div className="doc-patient-strip">
                                <div className="doc-patient-field"><span>Patient</span><strong>{user?.full_name}</strong></div>
                                <div className="doc-patient-field"><span>NIC</span><strong>{user?.nic || '—'}</strong></div>
                                <div className="doc-patient-field"><span>Age</span><strong>{calcAge(user?.dob) !== null ? `${calcAge(user?.dob)} yrs` : '—'}</strong></div>
                            </div>
                            <div className="doc-body">
                                <div className="doc-section-label">Medicines &amp; Instructions</div>
                                <pre className="rx-pre doc-rx-pre">{rx.prescription_details}</pre>
                            </div>
                            {done && (
                                <div className="doc-footer dispensed">
                                    <CheckCircle2 size={14} color="#16a34a" />
                                    <span>Dispensed {fmtDate(rx.fulfilled_at)}{rx.pharmacist_name && ` · ${rx.pharmacist_name}`}</span>
                                </div>
                            )}
                            <div className="doc-actions">
                                <button className="doc-dl-btn" onClick={() => downloadPrescriptionPDF(rx, user)}>
                                    <Printer size={13} /> Print Prescription
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── DIAGNOSTIC TESTS ─────────────────────────────────────────────────────────
function LabResults({ user }) {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const pid = getPid(user); if (!pid) return;
        fetch(`${API}/lab-results/${pid}`)
            .then(r => r.json()).then(d => { if (d.success) setTests(d.tests); })
            .finally(() => setLoading(false));
    }, [user]);

    if (loading) return <Spinner />;
    if (!tests.length) return <EmptyState icon={FlaskConical} title="No Diagnostic Tests" sub="Tests ordered by your doctor will appear here." />;

    const typeColor = {
        Lab:     { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
        Imaging: { bg: '#E3F0FF', color: '#1565C0', border: '#BBDEFB' },
        ECG:     { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
        Other:   { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }
    };
    const statusLabel = { requested: 'Requested', in_progress: 'In Progress', completed: 'Results Ready', cancelled: 'Cancelled' };

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}><FlaskConical size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">Diagnostic Tests</h2>
                    <p className="page-subtitle">{tests.length} test{tests.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="history-dl-btn" onClick={() => downloadHistoryPDF('labs', tests, user)}>
                    <Download size={14} /> Download All
                </button>
            </div>
            <div className="cards-list">
                {tests.map(t => {
                    const c = typeColor[t.test_type] || typeColor.Other;
                    const done = t.status === 'completed';
                    return (
                        <div key={t.test_id} className="doc-card">
                            <div className="doc-card-header lab-header">
                                <div className="doc-lab-icon" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                                    <FlaskConical size={16} />
                                </div>
                                <div className="doc-header-info">
                                    <div className="doc-header-title">{t.test_name}</div>
                                    <div className="doc-header-meta">TEST-{String(t.test_id).padStart(6, '0')}</div>
                                </div>
                                <div className="doc-header-right">
                                    <span className="type-pill" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{t.test_type}</span>
                                    <span className={`status-pill ${t.status}`}>{statusLabel[t.status] || t.status}</span>
                                </div>
                            </div>
                            <div className="doc-patient-strip">
                                <div className="doc-patient-field"><span>Patient</span><strong>{user?.full_name}</strong></div>
                                <div className="doc-patient-field"><span>Requested</span><strong>{fmtDate(t.requested_at)}</strong></div>
                                <div className="doc-patient-field"><span>By</span><strong>{t.doctor_name || `Staff #${t.requested_by}`}</strong></div>
                                {t.sample_collected_at && <div className="doc-patient-field"><span>Sample Collected</span><strong>{fmtDate(t.sample_collected_at)}</strong></div>}
                            </div>
                            {done && t.result_summary && (
                                <div className="doc-body">
                                    <div className="doc-section-label">Result Summary</div>
                                    <div className="result-text">{t.result_summary}</div>
                                </div>
                            )}
                            {!done && (
                                <div className="doc-body">
                                    <div className="result-pending">Results not yet available</div>
                                </div>
                            )}
                            {done && t.file_path && (
                                <div className="doc-footer">
                                    <FileText size={14} color="#7c3aed" />
                                    <span>{t.test_name} Report</span>
                                    <a href={`${API}/test-file/${t.test_id}`} target="_blank" rel="noreferrer" className="file-dl-btn">
                                        <Download size={13} /> Download Report
                                    </a>
                                </div>
                            )}
                            <div className="doc-actions">
                                <button className="doc-dl-btn" onClick={() => downloadLabPDF(t, user)}>
                                    <Printer size={13} /> Print Lab Report
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── REFERRALS ────────────────────────────────────────────────────────────────
function Referrals({ user }) {
    const [referrals, setReferrals] = useState([]);
    const [loading,   setLoading]   = useState(true);

    useEffect(() => {
        const pid = getPid(user); if (!pid) return;
        fetch(`${API}/referrals/${pid}`)
            .then(r => r.json()).then(d => { if (d.success) setReferrals(d.referrals); })
            .finally(() => setLoading(false));
    }, [user]);

    if (loading) return <Spinner />;
    if (!referrals.length) return <EmptyState icon={Share2} title="No Referrals" sub="External referrals issued by your doctor appear here." />;

    const urgencyStyle = {
        Routine:   { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
        Urgent:    { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
        Emergency: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }
    };

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#ea580c,#f97316)' }}><Share2 size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">External Referrals</h2>
                    <p className="page-subtitle">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="history-dl-btn" onClick={() => downloadHistoryPDF('referrals', referrals, user)}>
                    <Download size={14} /> Download All
                </button>
            </div>
            <div className="cards-list">
                {referrals.map(r => {
                    const us = urgencyStyle[r.urgency] || urgencyStyle.Routine;
                    return (
                        <div key={r.referral_id} className="doc-card">
                            <div className="doc-card-header referral-header" style={{ borderLeft: `4px solid ${us.color}` }}>
                                <div className="doc-ref-icon" style={{ background: us.bg, color: us.color }}>
                                    <ArrowRight size={16} />
                                </div>
                                <div className="doc-header-info">
                                    <div className="doc-header-title">{r.target_clinic || 'Referral'}</div>
                                    <div className="doc-header-meta">REF-{String(r.referral_id).padStart(5, '0')} · {fmtDate(r.referral_date)}</div>
                                </div>
                                <div className="doc-header-right">
                                    <span className="urgency-badge" style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>{r.urgency}</span>
                                </div>
                            </div>
                            <div className="doc-patient-strip">
                                <div className="doc-patient-field"><span>Patient</span><strong>{user?.full_name}</strong></div>
                                <div className="doc-patient-field"><span>Referred To</span><strong>{r.target_clinic || '—'}</strong></div>
                                {r.consultant_name && <div className="doc-patient-field"><span>Consultant</span><strong>{r.consultant_name}</strong></div>}
                                <div className="doc-patient-field"><span>Issued By</span><strong>{r.issued_by_name || `Staff #${r.issued_by}`}</strong></div>
                            </div>
                            <div className="doc-body">
                                <div className="doc-section-label">Reason for Referral</div>
                                <div className="result-text">{r.reason || '—'}</div>
                            </div>
                            <div className="doc-actions">
                                <button className="doc-dl-btn" onClick={() => downloadReferralPDF(r, user)}>
                                    <Printer size={13} /> Print Referral Letter
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function Notifications({ user }) {
    const [items,   setItems]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const pid = getPid(user); if (!pid) return;
        fetch(`${API}/notifications/${pid}`)
            .then(r => r.json()).then(d => { if (d.success) setItems(d.notifications); })
            .finally(() => setLoading(false));
    }, [user]);

    if (loading) return <Spinner />;

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)' }}><Bell size={20} color="white" /></div>
                <div>
                    <h2 className="page-title">Notifications</h2>
                    {items.length > 0 && <p className="page-subtitle">{items.length} message{items.length !== 1 ? 's' : ''}</p>}
                </div>
            </div>
            {items.length === 0
                ? <div className="empty-state" style={{ paddingTop: '40px' }}><div className="empty-icon-wrap"><Bell size={32} strokeWidth={1.5} /></div><p>No notifications at the moment.</p></div>
                : <div className="cards-list">{items.map(n => (
                    <div key={n.notification_id} className="notif-card">
                        <div className="notif-icon-col"><Bell size={16} /></div>
                        <div className="notif-body">
                            <div className="notif-top-row"><h4>{n.email_subject || 'Notification'}</h4><span className="card-meta">{fmtDate(n.sent_at)}</span></div>
                            <p>{n.message}</p>
                            <span className="notif-status-tag">{n.status}</span>
                        </div>
                    </div>
                ))}</div>
            }
        </div>
    );
}

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function StarRating({ value, onChange }) {
    const [hovered, setHovered] = useState(0);
    const active = hovered || value;
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    className="star-btn"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => onChange(n)}
                    style={{ color: n <= active ? colors[active] : '#cbd5e1', transition: 'color .15s, transform .15s' }}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            ))}
            {active > 0 && (
                <span className="rating-label" style={{ '--color': colors[active] }}>
                    {RATING_LABELS[active]}
                </span>
            )}
        </div>
    );
}

function Feedback({ user }) {
    const [rating,      setRating]      = useState(0);
    const [comment,     setComment]     = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const [history,     setHistory]     = useState([]);
    const [histLoading, setHistLoading] = useState(true);
    const [submitted,   setSubmitted]   = useState(false);

    const fetchHistory = useCallback(async () => {
        const pid = getPid(user); if (!pid) return;
        try {
            const r = await fetch(`${API}/feedback/${pid}`);
            const d = await r.json();
            if (d.success) setHistory(d.feedback);
        } catch {} finally { setHistLoading(false); }
    }, [user]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!comment.trim() && rating === 0) return alert('Please write a comment or select a rating before submitting.');
        setSubmitting(true);
        try {
            const r = await fetch(`${API}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: getPid(user), rating: rating || null, comment: comment.trim() })
            });
            const d = await r.json();
            if (d.success) {
                setSubmitted(true);
                setComment('');
                setRating(0);
                fetchHistory();
                setTimeout(() => setSubmitted(false), 3500);
            } else alert(d.message);
        } catch { alert('Error submitting feedback.'); }
        finally { setSubmitting(false); }
    };

    const ratingColors = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}><MessageSquare size={20} color="white" /></div>
                <div><h2 className="page-title">Your Feedback</h2><p className="page-subtitle">Help us improve our service</p></div>
            </div>

            {submitted && (
                <div className="success-banner">
                    <CheckCircle2 size={18} color="#16a34a" />
                    <span>Thank you! Your feedback has been submitted.</span>
                </div>
            )}

            <div className="form-card">
                <h4 className="form-card-title">Share Your Experience</h4>
                <form onSubmit={handleSubmit}>
                    {/* Star rating */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="input-label">Overall Rating</label>
                        <StarRating value={rating} onChange={setRating} />
                        {rating === 0 && (
                            <p style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: '4px' }}>Click a star to rate</p>
                        )}
                    </div>

                    {/* Comment */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="input-label">Your Comments <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                        <textarea
                            className="custom-input textarea"
                            rows={5}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Share your experience at the hospital — what went well, what could be better, any suggestions…"
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-btn"
                        disabled={submitting || (rating === 0 && !comment.trim())}
                    >
                        {submitting
                            ? <><span className="btn-spinner" />Submitting…</>
                            : <><Send size={15} />Submit Feedback</>}
                    </button>
                </form>
            </div>

            {/* Past feedback history */}
            {!histLoading && history.length > 0 && (
                <>
                    <div className="section-divider"><span>Your Past Feedback</span></div>
                    <div className="cards-list">
                        {history.map(item => (
                            <div key={item.feedback_id} className="feedback-hist-card">
                                <div className="fhist-top">
                                    {/* Stars display */}
                                    {item.rating && (
                                        <div className="fhist-stars">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <svg key={n} width="14" height="14" viewBox="0 0 24 24"
                                                    fill={n <= item.rating ? ratingColors[item.rating] : 'none'}
                                                    stroke={n <= item.rating ? ratingColors[item.rating] : '#cbd5e1'}
                                                    strokeWidth="1.5">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                </svg>
                                            ))}
                                            <span className="fhist-label" style={{ color: ratingColors[item.rating] }}>
                                                {RATING_LABELS[item.rating]}
                                            </span>
                                        </div>
                                    )}
                                    <span className="card-meta">{fmtDate(item.submitted_at || item.created_at)}</span>
                                </div>
                                {item.comment && <p className="fhist-comment">"{item.comment}"</p>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}



// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileEdit({ user, setUser }) {
    const [editing, setEditing] = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [form,    setForm]    = useState({});

    useEffect(() => {
        if (!user) return;
        setForm({
            full_name: user.full_name || '', nic: user.nic || '',
            dob: user.dob ? user.dob.toString().split('T')[0] : '',
            gender: user.gender || '', civil_status: user.civil_status || '',
            blood_group: user.blood_group || '', phone: user.phone || '',
            address: user.address_line1 || user.address || '',
            emergency_contact: user.emergency_contact || '',
            chronic_conditions: user.chronic_conditions || '', allergies: user.allergies || '',
        });
    }, [user]);

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            const r = await fetch(`${API}/update-profile`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId: getPid(user), ...form, address_line1: form.address })
            });
            const d = await r.json();
            if (d.success) {
                const u = { ...user, ...form, address_line1: form.address };
                setUser(u); localStorage.setItem('hospital_user', JSON.stringify(u)); setEditing(false);
            } else alert(d.message);
        } catch { alert('Error saving.'); }
        finally { setSaving(false); }
    };

    const age      = calcAge(form.dob || user?.dob);
    const initials = (user?.full_name || 'P').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="page-content profile-page">
            <div className="profile-hero">
                <div className="profile-avatar-xl">{initials}</div>
                <div className="profile-hero-info">
                    <h2>{user?.full_name}</h2>
                    <p>{user?.email || user?.username}</p>
                    <div className="profile-badges">
                        <span className="profile-badge"><MapPin size={11} />{user?.address_line1 || user?.address || 'Address not set'}</span>
                        <span className="profile-badge"><Phone size={11} />{user?.phone || '—'}</span>
                        {age && <span className="profile-badge"><User size={11} />{age} years old</span>}
                    </div>
                    <code className="barcode-chip">{user?.barcode}</code>
                </div>
                <button type="button" className={`edit-toggle ${editing ? 'cancel' : 'edit'}`} onClick={() => setEditing(e => !e)}>
                    {editing ? <><X size={14} /> Cancel</> : <><User size={14} /> Edit Profile</>}
                </button>
            </div>

            <form onSubmit={handleSave}>
                <div className="profile-sections">
                    <div className="profile-section">
                        <div className="ps-title"><User size={15} color="#1565C0" /> Personal Information</div>
                        <div className="ps-grid">
                            <div className="ps-field"><label>Barcode <span className="locked-tag">Locked</span></label><div className="ps-value locked">{user?.barcode}</div></div>
                            <div className="ps-field"><label>Email <span className="locked-tag">Locked</span></label><div className="ps-value locked">{user?.email || user?.username}</div></div>
                            <div className="ps-field wide"><label>Full Name</label>{editing ? <input type="text" className="custom-input" value={form.full_name || ''} onChange={set('full_name')} /> : <div className="ps-value">{form.full_name || <span className="empty-val">Not provided</span>}</div>}</div>
                            <div className="ps-field"><label>NIC Number</label>{editing ? <input type="text" className="custom-input" value={form.nic || ''} onChange={set('nic')} /> : <div className="ps-value">{form.nic || <span className="empty-val">Not provided</span>}</div>}</div>
                            <div className="ps-field"><label>Date of Birth</label>{editing ? <input type="date" className="custom-input" value={form.dob || ''} onChange={set('dob')} /> : <div className="ps-value">{fmtDate(form.dob) || <span className="empty-val">Not provided</span>}</div>}</div>
                            <div className="ps-field"><label>Age</label><div className="ps-value">{age !== null ? `${age} years` : '—'}</div></div>
                            <div className="ps-field"><label>Gender</label>{editing ? <select className="custom-input" value={form.gender || ''} onChange={set('gender')}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select> : <div className="ps-value">{form.gender || <span className="empty-val">—</span>}</div>}</div>
                            <div className="ps-field"><label>Civil Status</label>{editing ? <select className="custom-input" value={form.civil_status || ''} onChange={set('civil_status')}><option value="">—</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></select> : <div className="ps-value">{form.civil_status || <span className="empty-val">—</span>}</div>}</div>
                            <div className="ps-field"><label>Blood Group</label>{editing ? <select className="custom-input" value={form.blood_group || ''} onChange={set('blood_group')}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(g => <option key={g}>{g}</option>)}</select> : <div className="ps-value">{form.blood_group || <span className="empty-val">—</span>}</div>}</div>
                        </div>
                    </div>
                    <div className="profile-section">
                        <div className="ps-title"><Phone size={15} color="#059669" /> Contact &amp; Medical</div>
                        <div className="ps-grid">
                            <div className="ps-field"><label>Phone</label>{editing ? <input type="text" className="custom-input" value={form.phone || ''} onChange={set('phone')} /> : <div className="ps-value">{form.phone || <span className="empty-val">Not provided</span>}</div>}</div>
                            <div className="ps-field"><label>Emergency Contact</label>{editing ? <input type="text" className="custom-input" value={form.emergency_contact || ''} onChange={set('emergency_contact')} /> : <div className="ps-value">{form.emergency_contact || <span className="empty-val">Not provided</span>}</div>}</div>
                            <div className="ps-field wide"><label>Address</label>{editing ? <textarea className="custom-input textarea" rows={2} value={form.address || ''} onChange={set('address')} /> : <div className="ps-value">{form.address || <span className="empty-val">None</span>}</div>}</div>
                            <div className="ps-field wide"><label>Chronic Conditions</label>{editing ? <textarea className="custom-input textarea" rows={2} value={form.chronic_conditions || ''} onChange={set('chronic_conditions')} /> : <div className="ps-value">{form.chronic_conditions || <span className="empty-val">None</span>}</div>}</div>
                            <div className="ps-field wide"><label>Known Allergies</label>{editing ? <textarea className="custom-input textarea" rows={2} value={form.allergies || ''} onChange={set('allergies')} /> : <div className={`ps-value ${form.allergies ? 'allergy' : ''}`}>{form.allergies || <span className="empty-val">No known allergies</span>}</div>}</div>
                        </div>
                    </div>
                </div>
                {editing && <button type="submit" className="primary-btn save-btn" disabled={saving}>{saving ? <><span className="btn-spinner" />Saving…</> : <><CheckCircle2 size={15} />Save Profile</>}</button>}
            </form>
        </div>
    );
}

// ─── FAMILY SECTION ───────────────────────────────────────────────────────────
function FamilySection({ user, setUser }) {
    const [members,  setMembers]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [removing, setRemoving] = useState(null);
    const [form,     setForm]     = useState({ full_name: '', relation: '', nic: '', phone: '', dob: '', gender: '' });
    const [saving,   setSaving]   = useState(false);
    const navigate = useNavigate();

    const userEmail    = user?.email || user?.username || '';
    const primaryLogin = user?._primaryLogin || userEmail;

    const fetchMembers = useCallback(async () => {
        if (!userEmail) { setLoading(false); return; }
        setLoading(true);
        try {
            const r = await fetch(`${API}/family-members?email=${encodeURIComponent(userEmail)}`);
            const d = await r.json();
            if (d.success) setMembers(d.members || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [userEmail]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    const switchTo = m => {
        const updated = {
            ...user, patient_id: m.patient_id, patientId: m.patient_id, full_name: m.full_name,
            barcode: m.barcode, nic: m.nic, dob: m.dob, gender: m.gender, blood_group: m.blood_group,
            civil_status: m.civil_status, phone: m.phone, address_line1: m.address_line1, address: m.address,
            emergency_contact: m.emergency_contact, chronic_conditions: m.chronic_conditions,
            allergies: m.allergies, _primaryLogin: primaryLogin
        };
        setUser(updated); localStorage.setItem('hospital_user', JSON.stringify(updated));
    };

    const handleAdd = async e => {
        e.preventDefault(); setSaving(true);
        try {
            const r = await fetch(`${API}/add-family-member`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, ...form }) });
            const d = await r.json();
            if (d.success) { setForm({ full_name: '', relation: '', nic: '', phone: '', dob: '', gender: '' }); fetchMembers(); }
            else alert(d.message || 'Failed to add family member.');
        } catch { alert('Server error.'); } finally { setSaving(false); }
    };

    const handleRemove = async (memberPatientId) => {
        if (!window.confirm('Remove this family member?')) return;
        setRemoving(memberPatientId);
        try {
            const r = await fetch(`${API}/remove-family-member`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, memberPatientId }) });
            const d = await r.json();
            if (d.success) fetchMembers(); else alert(d.message || 'Failed to remove.');
        } catch { alert('Server error.'); } finally { setRemoving(null); }
    };

    const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Guardian', 'Other'];

    return (
        <div className="page-content">
            <div className="page-header">
                <div className="page-header-icon" style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}><Users size={20} color="white" /></div>
                <div><h2 className="page-title">Other Accounts</h2><p className="page-subtitle">Family members linked to your login</p></div>
            </div>
            <div className="info-alert" style={{ marginBottom: '20px' }}><Users size={16} /><div><strong>How it works:</strong> Switch between family members to view their records and book appointments under the same login.</div></div>

            {loading ? <Spinner /> : members.length > 0 && (
                <div className="members-grid">{members.map(m => {
                    const isActive  = parseInt(getPid(user)) === parseInt(m.patient_id);
                    const isPrimary = m.relation === undefined;
                    return (
                        <div key={m.patient_id} className={`member-card ${isActive ? 'active' : ''}`}>
                            {isActive  && <div className="active-dot">Active</div>}
                            {isPrimary && <div className="primary-dot">Primary</div>}
                            <div className="member-top">
                                <div className="member-avatar">{(m.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</h4>
                                    {m.relation && <span style={{ fontSize: '.7rem', background: '#E3F0FF', color: '#1565C0', padding: '1px 7px', borderRadius: '20px', fontWeight: 700, marginBottom: '4px', display: 'inline-block' }}>{m.relation}</span>}
                                    <code className="member-barcode">{m.barcode}</code>
                                    <p className="member-meta">{[m.gender, m.dob ? `${calcAge(m.dob)} yrs` : null, m.blood_group, m.nic].filter(Boolean).join(' · ')}</p>
                                </div>
                            </div>
                            <div className="member-btns">
                                <button className={`member-btn ${isActive ? 'ghost' : 'primary'}`} disabled={isActive} onClick={() => !isActive && switchTo(m)}>{isActive ? 'Current' : 'Switch'}</button>
                                <button className="member-btn ghost" onClick={() => { switchTo(m); navigate('/patient-dashboard/appointments'); }}>Book Appt</button>
                                {!isPrimary && <button className="member-btn danger" disabled={removing === m.patient_id} onClick={() => handleRemove(m.patient_id)}>{removing === m.patient_id ? '…' : 'Remove'}</button>}
                            </div>
                        </div>
                    );
                })}</div>
            )}

            <div className="form-card" style={{ marginTop: '24px' }}>
                <h4 className="form-card-title">Add Family Member</h4>
                <form onSubmit={handleAdd}>
                    <div className="form-row-2">
                        <div className="form-group wide"><label className="input-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label><input type="text" className="custom-input" placeholder="e.g. Kamal Perera" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
                        <div className="form-group"><label className="input-label">Relation <span style={{ color: '#ef4444' }}>*</span></label><select className="custom-input" value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} required><option value="">Select relation</option>{RELATIONS.map(r => <option key={r}>{r}</option>)}</select></div>
                        <div className="form-group"><label className="input-label">NIC</label><input type="text" className="custom-input" placeholder="e.g. 200012345678" value={form.nic} onChange={e => setForm(f => ({ ...f, nic: e.target.value }))} /></div>
                        <div className="form-group"><label className="input-label">Phone</label><input type="text" className="custom-input" placeholder="e.g. 0771234567" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                        <div className="form-group"><label className="input-label">Date of Birth <span style={{ color: '#ef4444' }}>*</span></label><input type="date" className="custom-input" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} required /></div>
                        <div className="form-group"><label className="input-label">Gender <span style={{ color: '#ef4444' }}>*</span></label><select className="custom-input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                    </div>
                    <button type="submit" className="primary-btn" disabled={saving} style={{ marginTop: '12px' }}>{saving ? <><span className="btn-spinner" />Adding…</> : <><Users size={15} />Add Family Member</>}</button>
                </form>
            </div>
        </div>
    );
}

// ─── MAIN SHELL ───────────────────────────────────────────────────────────────
export default function PatientDashboard({ user, setUser }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen,       setMenuOpen]       = useState(false);
    const [myAppointments, setMyAppointments] = useState([]);

    const menuItems = [
        { icon: Home,          label: 'Home',             path: '/patient-dashboard' },
        { icon: Calendar,      label: 'Appointments',     path: '/patient-dashboard/appointments' },
        { icon: FileText,      label: 'Medical History',  path: '/patient-dashboard/medical-records' },
        { icon: Pill,          label: 'Prescriptions',    path: '/patient-dashboard/prescriptions' },
        { icon: FlaskConical,  label: 'Diagnostic Tests', path: '/patient-dashboard/lab-results' },
        { icon: Share2,        label: 'Referrals',        path: '/patient-dashboard/referrals' },
        { icon: User,          label: 'My Profile',       path: '/patient-dashboard/profile' },
        { icon: Users,         label: 'Other Accounts',   path: '/patient-dashboard/family' },
        { icon: Bell,          label: 'Notifications',    path: '/patient-dashboard/notifications' },
        { icon: MessageSquare, label: 'Feedback',         path: '/patient-dashboard/feedback' },
    ];

    const fetchAppointments = useCallback(async () => {
        const pid = getPid(user); if (!pid) return;
        try {
            const r = await fetch(`${API}/my-appointments?patientId=${pid}`);
            const d = await r.json();
            if (d.success) setMyAppointments(d.appointments);
        } catch {}
    }, [user]);

    useEffect(() => {
        if (!user) {
            const saved = localStorage.getItem('hospital_user');
            if (saved) { setUser(JSON.parse(saved)); return; }
            navigate('/login'); return;
        }
        fetchAppointments();
    }, [user, setUser, navigate, fetchAppointments]);

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            <nav className="top-nav">
                <div className="nav-left">
                    <button className="menu-toggle" onClick={() => setMenuOpen(o => !o)}>
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div className="nav-logo-group">
                        <div className="nav-logo-icon"><Activity size={17} color="white" /></div>
                        <span className="nav-logo-text">SmartOPD</span>
                    </div>
                </div>
                <div className="nav-right">
                    <div className="nav-user-chip">
                        <div className="nav-user-avatar">{(user?.full_name || 'P').charAt(0).toUpperCase()}</div>
                        <div className="nav-user-info">
                            <span className="nav-user-name">{user?.full_name || '—'}</span>
                            <span className="nav-user-code">{user?.barcode}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="Logout"><LogOut size={18} /></button>
                </div>
            </nav>

            {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

            <div className="dashboard-body">
                <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                    <div className="sidebar-inner">
                        <div className="sidebar-user-mini">
                            <div className="sm-avatar">{(user?.full_name || 'P').charAt(0)}</div>
                            <div><p className="sm-name">{user?.full_name}</p><p className="sm-code">{user?.barcode}</p></div>
                        </div>
                        <nav className="sidebar-nav">
                            {menuItems.map(item => {
                                const active = location.pathname === item.path;
                                return (
                                    <button key={item.path} className={`nav-item ${active ? 'active' : ''}`}
                                        onClick={() => { navigate(item.path); setMenuOpen(false); }}>
                                        <item.icon size={18} className="nav-icon" />
                                        <span>{item.label}</span>
                                        {active && <div className="nav-active-bar" />}
                                    </button>
                                );
                            })}
                        </nav>
                        <div className="sidebar-footer">
                            <button className="sidebar-logout" onClick={handleLogout}><LogOut size={15} /> Sign Out</button>
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    <Routes>
                        <Route index element={
                            <DashboardHome
                                user={user}
                                myAppointments={myAppointments}
                            />
                        } />
                        <Route path="appointments" element={
                            <Appointments
                                user={user}
                                myAppointments={myAppointments}
                                setMyAppointments={(appts) => {
                                    setMyAppointments(appts);
                                    // propagate update so Home slip re-renders instantly
                                }}
                            />
                        } />
                        <Route path="medical-records" element={<MedicalRecords user={user} />} />
                        <Route path="prescriptions"   element={<Prescriptions  user={user} />} />
                        <Route path="lab-results"     element={<LabResults     user={user} />} />
                        <Route path="referrals"       element={<Referrals      user={user} />} />
                        <Route path="profile"         element={<ProfileEdit    user={user} setUser={setUser} />} />
                        <Route path="family"          element={<FamilySection  user={user} setUser={setUser} />} />
                        <Route path="notifications"   element={<Notifications  user={user} />} />
                        <Route path="feedback"        element={<Feedback       user={user} />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}