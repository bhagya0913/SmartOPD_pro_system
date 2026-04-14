import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MedicalHistory.css';
import {
    ClipboardList, Stethoscope, Pill, FlaskConical, Share2,
    Calendar, Clock, ChevronDown, ChevronUp, Download,
    AlertTriangle, CheckCircle2, Activity, User, FileText,
    Printer, ArrowRight, Filter, Hash, RefreshCw, NotebookPen,
    Building2, FlaskRound, Microscope, Tag
} from 'lucide-react';

const API = 'http://127.0.0.1:5001/api';

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '—'; }
};
const fmtDateTime = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return '—'; }
};
const fmtTime = (t) => {
    if (!t) return '—';
    const [h, m] = t.toString().split(':');
    const hr = parseInt(h);
    return `${String(hr % 12 || 12).padStart(2, '0')}:${m || '00'} ${hr < 12 ? 'AM' : 'PM'}`;
};
const calcAge = (dob) => {
    if (!dob) return null;
    const d = new Date(dob), n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
};
const getPid = (user) => user?.patient_id || user?.patientId || user?.id;

// Sort key — returns a comparable ISO date string from any record type
const getSortDate = (item) =>
    item._type === 'consultation' ? item.consultation_day
    : item._type === 'prescription' ? item.issued_at || item.consultation_day
    : item._type === 'lab'         ? item.requested_at
    : item._type === 'referral'    ? item.referral_date
    : '1970-01-01';

// ─── MINI SPINNER & EMPTY ─────────────────────────────────────────────────────
const Spinner = () => (
    <div className="mh-center" style={{ minHeight: '200px' }}>
        <div className="mh-spinner" />
    </div>
);

const Empty = ({ icon: Icon, title, sub }) => (
    <div className="mh-empty">
        <div className="mh-empty-icon"><Icon size={32} strokeWidth={1.3} /></div>
        <h3>{title}</h3>
        <p>{sub}</p>
    </div>
);

// ─── SECTION BADGE ────────────────────────────────────────────────────────────
const TypePill = ({ type }) => {
    const cfg = {
        consultation: { label: 'Consultation',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', Icon: Stethoscope },
        prescription:  { label: 'Prescription',  bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', Icon: Pill },
        lab:           { label: 'Lab / Imaging', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', Icon: FlaskConical },
        referral:      { label: 'Referral',      bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', Icon: Share2 },
    }[type] || { label: type, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', Icon: Tag };

    const { Icon } = cfg;
    return (
        <span className="mh-type-pill"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            <Icon size={11} />
            {cfg.label}
        </span>
    );
};

// ─── DATE BADGE (left column) ─────────────────────────────────────────────────
const DateBadge = ({ dateStr }) => {
    if (!dateStr) return <div className="mh-date-badge mh-date-badge-empty">—</div>;
    const d = new Date(dateStr);
    const day   = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const year  = d.getFullYear();
    const time  = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const hasTime = dateStr.includes('T') || dateStr.includes(' ') && dateStr.length > 10;
    return (
        <div className="mh-date-badge">
            <span className="mh-date-day">{day}</span>
            <span className="mh-date-year">{year}</span>
            {hasTime && <span className="mh-date-time">{fmtTime(time)}</span>}
        </div>
    );
};

// ─── FIELD CELL (small label + content) ───────────────────────────────────────
const FieldCell = ({ label, children, wide, accent }) => (
    <div className={`mh-cell ${wide ? 'mh-cell-wide' : ''} ${accent ? 'mh-cell-accent' : ''}`}>
        <label>{label}</label>
        <div>{children}</div>
    </div>
);

// ─── CONSULTATION CARD ────────────────────────────────────────────────────────
function ConsultationCard({ rec, expanded, onToggle }) {
    const vitals = rec.weight_kg || rec.height_cm;

    return (
        <div className={`mh-record-card ${expanded ? 'mh-expanded' : ''}`}>
            {/* ── Card header (always visible) ── */}
            <div className="mh-card-head" onClick={onToggle}>
                <div className="mh-card-head-left">
                    <div className="mh-card-icon mh-icon-consult">
                        <Stethoscope size={16} />
                    </div>
                    <div className="mh-card-title-block">
                        <div className="mh-card-title">
                            {rec.diagnosis || 'General Consultation'}
                        </div>
                        <div className="mh-card-meta">
                            <span className="mh-doctor-chip">
                                <User size={11} />
                                {rec.doctor_name || `Staff #${rec.created_by}`}
                            </span>
                            {rec.appointment_id && (
                                <span className="mh-ref-chip">Appt #{rec.appointment_id}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mh-card-head-right">
                    <TypePill type="consultation" />
                    <button className="mh-expand-btn" aria-label={expanded ? 'Collapse' : 'Expand'}>
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* ── Expanded body ── */}
            {expanded && (
                <div className="mh-card-body">
                    {/* Info strip */}
                    <div className="mh-info-strip">
                        <div className="mh-info-field">
                            <span>Date &amp; Time</span>
                            <strong>{fmtDateTime(rec.consultation_day)}</strong>
                        </div>
                        <div className="mh-info-field">
                            <span>Doctor</span>
                            <strong>{rec.doctor_name || `Staff #${rec.created_by}`}</strong>
                        </div>
                        {rec.doctor_id && (
                            <div className="mh-info-field">
                                <span>Doctor ID</span>
                                <strong className="mh-mono">#{rec.created_by}</strong>
                            </div>
                        )}
                        {vitals && (
                            <div className="mh-info-field">
                                <span>Vitals</span>
                                <strong>
                                    {rec.weight_kg ? `${rec.weight_kg} kg` : ''}
                                    {rec.weight_kg && rec.height_cm ? ' · ' : ''}
                                    {rec.height_cm ? `${rec.height_cm} cm` : ''}
                                    {rec.weight_kg && rec.height_cm
                                        ? ` · BMI ${(rec.weight_kg / Math.pow(rec.height_cm / 100, 2)).toFixed(1)}`
                                        : ''}
                                </strong>
                            </div>
                        )}
                    </div>

                    {/* Clinical cells grid */}
                    <div className="mh-cells-grid">
                        {rec.chief_complaint && (
                            <FieldCell label="Chief Complaint">
                                <p>{rec.chief_complaint}</p>
                            </FieldCell>
                        )}
                        {rec.clinical_findings && (
                            <FieldCell label="Clinical Findings">
                                <p>{rec.clinical_findings}</p>
                            </FieldCell>
                        )}
                        {rec.diagnosis && (
                            <FieldCell label="Diagnosis" accent>
                                <p><strong>{rec.diagnosis}</strong></p>
                            </FieldCell>
                        )}
                        {rec.treatment_details && (
                            <FieldCell label="Treatment Plan">
                                <p>{rec.treatment_details}</p>
                            </FieldCell>
                        )}
                        {rec.prescription_details && (
                            <FieldCell label="Prescription (inline)" wide>
                                <pre className="mh-rx-pre">{rec.prescription_details}</pre>
                            </FieldCell>
                        )}
                        {rec.follow_up_date && (
                            <FieldCell label="Follow-up Date">
                                <p className="mh-followup">
                                    <Calendar size={12} /> {fmtDate(rec.follow_up_date)}
                                </p>
                            </FieldCell>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── PRESCRIPTION CARD ────────────────────────────────────────────────────────
function PrescriptionCard({ rec, expanded, onToggle, user, onPrint }) {
    const done = !!rec.fulfilled_at;
    return (
        <div className={`mh-record-card ${expanded ? 'mh-expanded' : ''}`}>
            <div className="mh-card-head" onClick={onToggle}>
                <div className="mh-card-head-left">
                    <div className="mh-card-icon mh-icon-rx">
                        <span className="mh-rx-symbol">℞</span>
                    </div>
                    <div className="mh-card-title-block">
                        <div className="mh-card-title">
                            Prescription
                            <span className="mh-record-id"> · RX-{String(rec.record_id || rec.prescription_id || '').padStart(6, '0')}</span>
                        </div>
                        <div className="mh-card-meta">
                            {rec.doctor_name && (
                                <span className="mh-doctor-chip">
                                    <User size={11} /> {rec.doctor_name}
                                </span>
                            )}
                            <span className={`mh-status-chip ${done ? 'mh-status-done' : 'mh-status-pending'}`}>
                                {done ? <><CheckCircle2 size={11} /> Dispensed</> : 'Pending'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="mh-card-head-right">
                    <TypePill type="prescription" />
                    <button className="mh-expand-btn">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mh-card-body">
                    <div className="mh-info-strip">
                        <div className="mh-info-field">
                            <span>Issued</span>
                            <strong>{fmtDateTime(rec.issued_at || rec.consultation_day)}</strong>
                        </div>
                        <div className="mh-info-field">
                            <span>Doctor</span>
                            <strong>{rec.doctor_name || `Staff #${rec.created_by || rec.issued_by}`}</strong>
                        </div>
                        {rec.appointment_id && (
                            <div className="mh-info-field">
                                <span>Visit</span>
                                <strong className="mh-mono">Appt #{rec.appointment_id}</strong>
                            </div>
                        )}
                        {done && rec.fulfilled_at && (
                            <div className="mh-info-field">
                                <span>Dispensed</span>
                                <strong>{fmtDate(rec.fulfilled_at)}</strong>
                            </div>
                        )}
                    </div>

                    <div className="mh-cells-grid">
                        <FieldCell label="Medicines &amp; Instructions" wide>
                            <pre className="mh-rx-pre">{rec.prescription_details || rec.details || '—'}</pre>
                        </FieldCell>
                    </div>

                    <div className="mh-card-actions">
                        <button className="mh-print-btn" onClick={() => onPrint(rec)}>
                            <Printer size={13} /> Print Prescription
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── LAB / DIAGNOSTIC CARD ────────────────────────────────────────────────────
function LabCard({ rec, expanded, onToggle, onPrint }) {
    const typeColor = {
        Lab:     { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
        Imaging: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
        ECG:     { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
        Other:   { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
    };
    const statusLabel = {
        requested:   { label: 'Requested',      cls: 'mh-status-requested' },
        in_progress: { label: 'In Progress',    cls: 'mh-status-inprogress' },
        completed:   { label: 'Results Ready',  cls: 'mh-status-done' },
        cancelled:   { label: 'Cancelled',      cls: 'mh-status-cancelled' },
    };
    const tc  = typeColor[rec.test_type] || typeColor.Other;
    const sc  = statusLabel[rec.status]  || { label: rec.status, cls: '' };
    const done = rec.status === 'completed';

    return (
        <div className={`mh-record-card ${expanded ? 'mh-expanded' : ''}`}>
            <div className="mh-card-head" onClick={onToggle}>
                <div className="mh-card-head-left">
                    <div className="mh-card-icon" style={{ background: tc.bg, border: `1.5px solid ${tc.border}`, color: tc.color }}>
                        <FlaskConical size={15} />
                    </div>
                    <div className="mh-card-title-block">
                        <div className="mh-card-title">
                            {rec.test_name}
                            <span className="mh-record-id"> · TEST-{String(rec.test_id).padStart(6, '0')}</span>
                        </div>
                        <div className="mh-card-meta">
                            <span className="mh-type-mini"
                                style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                                {rec.test_type}
                            </span>
                            <span className={`mh-status-chip ${sc.cls}`}>{sc.label}</span>
                            {rec.priority === 'urgent' && (
                                <span className="mh-status-chip mh-status-urgent">
                                    <AlertTriangle size={10} /> Urgent
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mh-card-head-right">
                    <TypePill type="lab" />
                    <button className="mh-expand-btn">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mh-card-body">
                    <div className="mh-info-strip">
                        <div className="mh-info-field">
                            <span>Requested</span>
                            <strong>{fmtDateTime(rec.requested_at)}</strong>
                        </div>
                        <div className="mh-info-field">
                            <span>Ordered By</span>
                            <strong>{rec.doctor_name || `Staff #${rec.requested_by}`}</strong>
                        </div>
                        {rec.sample_collected_at && (
                            <div className="mh-info-field">
                                <span>Sample Collected</span>
                                <strong>{fmtDate(rec.sample_collected_at)}</strong>
                            </div>
                        )}
                        {rec.result_uploaded_at && (
                            <div className="mh-info-field">
                                <span>Results Uploaded</span>
                                <strong>{fmtDateTime(rec.result_uploaded_at)}</strong>
                            </div>
                        )}
                    </div>

                    <div className="mh-cells-grid">
                        {rec.clinical_notes && (
                            <FieldCell label="Doctor's Clinical Notes" wide>
                                <p>{rec.clinical_notes}</p>
                            </FieldCell>
                        )}
                        {done && rec.result_summary && (
                            <FieldCell label="Result Summary" wide accent>
                                <p>{rec.result_summary}</p>
                            </FieldCell>
                        )}
                        {!done && (
                            <FieldCell label="Result" wide>
                                <p className="mh-pending-text">
                                    <Clock size={13} /> Results not yet available
                                </p>
                            </FieldCell>
                        )}
                        {done && rec.file_path && (
                            <FieldCell label="Report File" wide>
                                <a href={`${API}/test-file/${rec.test_id}`}
                                    target="_blank" rel="noreferrer"
                                    className="mh-dl-link">
                                    <Download size={13} /> Download Report
                                </a>
                            </FieldCell>
                        )}
                    </div>

                    <div className="mh-card-actions">
                        <button className="mh-print-btn" onClick={() => onPrint(rec)}>
                            <Printer size={13} /> Print Lab Report
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── REFERRAL CARD ────────────────────────────────────────────────────────────
function ReferralCard({ rec, expanded, onToggle, onPrint }) {
    const urgencyStyle = {
        Routine:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
        Urgent:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
        Emergency: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    };
    const us = urgencyStyle[rec.urgency] || urgencyStyle.Routine;

    return (
        <div className={`mh-record-card ${expanded ? 'mh-expanded' : ''}`}>
            <div className="mh-card-head" onClick={onToggle}>
                <div className="mh-card-head-left">
                    <div className="mh-card-icon mh-icon-referral"
                        style={{ borderLeft: `4px solid ${us.color}` }}>
                        <ArrowRight size={15} />
                    </div>
                    <div className="mh-card-title-block">
                        <div className="mh-card-title">
                            {rec.target_clinic || 'External Referral'}
                            <span className="mh-record-id"> · REF-{String(rec.referral_id).padStart(5, '0')}</span>
                        </div>
                        <div className="mh-card-meta">
                            {rec.consultant_name && (
                                <span className="mh-doctor-chip">
                                    <User size={11} /> Dr. {rec.consultant_name}
                                </span>
                            )}
                            <span className="mh-status-chip"
                                style={{ background: us.bg, color: us.color, border: `1px solid ${us.border}` }}>
                                {rec.urgency || 'Routine'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="mh-card-head-right">
                    <TypePill type="referral" />
                    <button className="mh-expand-btn">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mh-card-body">
                    <div className="mh-info-strip">
                        <div className="mh-info-field">
                            <span>Date Issued</span>
                            <strong>{fmtDateTime(rec.referral_date)}</strong>
                        </div>
                        <div className="mh-info-field">
                            <span>Referred To</span>
                            <strong>{rec.target_clinic || '—'}</strong>
                        </div>
                        {rec.consultant_name && (
                            <div className="mh-info-field">
                                <span>Consultant</span>
                                <strong>Dr. {rec.consultant_name}</strong>
                            </div>
                        )}
                        <div className="mh-info-field">
                            <span>Issued By</span>
                            <strong>{rec.issued_by_name || `Staff #${rec.issued_by}`}</strong>
                        </div>
                    </div>

                    <div className="mh-cells-grid">
                        <FieldCell label="Reason for Referral" wide>
                            <p>{rec.reason || '—'}</p>
                        </FieldCell>
                        {rec.clinical_summary && (
                            <FieldCell label="Clinical Summary" wide>
                                <p>{rec.clinical_summary}</p>
                            </FieldCell>
                        )}
                    </div>

                    <div className="mh-card-actions">
                        <button className="mh-print-btn" onClick={() => onPrint(rec)}>
                            <Printer size={13} /> Print Referral Letter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── PRINT HELPERS (pass-through to parent printPDF) ─────────────────────────
function printPDF(html, filename) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return alert('Please allow popups to print.');
    win.document.write(`<!DOCTYPE html><html><head>
        <title>${filename}</title>
        <style>
            * { box-sizing:border-box; margin:0; padding:0; }
            body { background:white; font-family:'Segoe UI',Arial,sans-serif; }
            @media print {
                @page { margin:10mm; size:A4; }
                body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            }
        </style>
    </head><body>${html}
    <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},600);},400);}<\/script>
    </body></html>`);
    win.document.close();
}

const pdfHeader = (title, sub = '') => `
<div style="background:#0D47A1;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:34px;height:34px;background:#1565C0;border-radius:8px;border:1.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:white;">+</div>
        <div>
            <div style="color:white;font-size:11px;font-weight:700;letter-spacing:.5px;">BASE HOSPITAL, KIRIBATHGODA</div>
            <div style="color:rgba(255,255,255,.55);font-size:9px;margin-top:1px;">Ministry of Health · Sri Lanka · SmartOPD</div>
        </div>
    </div>
    <div style="text-align:right;">
        <div style="color:#90CAF9;font-size:12px;font-weight:700;letter-spacing:.5px;">${title}</div>
        ${sub ? `<div style="color:rgba(255,255,255,.5);font-size:9px;margin-top:2px;">${sub}</div>` : ''}
    </div>
</div>
<div style="height:3px;background:linear-gradient(90deg,#1565C0,#42A5F5);"></div>`;

function handlePrintPrescription(rx, user) {
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('PRESCRIPTION', `RX-${String(rx.record_id || '').padStart(6,'0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${user?.full_name || '—'}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">NIC: ${user?.nic||'—'} · Patient ID: ${getPid(user)||'—'}</div>
            <div style="font-size:10px;color:#64748b;">Date: ${fmtDate(rx.issued_at||rx.consultation_day)} · ${rx.doctor_name||'Doctor'}</div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Medicines &amp; Instructions</div>
            <pre style="font-family:'Courier New',monospace;font-size:12px;white-space:pre-wrap;color:#1e293b;line-height:1.7;background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;">${rx.prescription_details||rx.details||'—'}</pre>
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span>
                <span>SmartOPD · Base Hospital Kiribathgoda · Ministry of Health</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `RX_${rx.record_id||'0'}`);
}

function handlePrintLab(t, user) {
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('LAB / DIAGNOSTIC REPORT', `TEST-${String(t.test_id).padStart(6,'0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${user?.full_name||'—'}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Patient ID: ${getPid(user)||'—'} · Test: ${t.test_name} · Type: ${t.test_type}</div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Result Summary</div>
            <div style="font-size:12px;color:#1e293b;line-height:1.7;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;">${t.result_summary||'Results pending.'}</div>
            ${t.clinical_notes ? `<div style="margin-top:14px;font-size:10px;color:#64748b;"><b>Clinical Notes:</b> ${t.clinical_notes}</div>`:''}
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span><span>SmartOPD · Base Hospital Kiribathgoda</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `Lab_${t.test_id}`);
}

function handlePrintReferral(r, user) {
    const html = `
    <div style="max-width:680px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;">
        ${pdfHeader('REFERRAL LETTER', `REF-${String(r.referral_id).padStart(5,'0')}`)}
        <div style="padding:20px 28px 8px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${user?.full_name||'—'}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Patient ID: ${getPid(user)||'—'} · Referred to: ${r.target_clinic||'—'} · ${r.urgency||''}</div>
        </div>
        <div style="padding:20px 28px;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Reason for Referral</div>
            <div style="font-size:12px;color:#1e293b;line-height:1.7;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;">${r.reason||'—'}</div>
            ${r.clinical_summary ? `<div style="margin-top:14px;font-size:10px;color:#64748b;"><b>Clinical Summary:</b> ${r.clinical_summary}</div>`:''}
            <div style="margin-top:14px;font-size:10px;color:#64748b;">Issued by: ${r.issued_by_name||'—'} · Date: ${fmtDate(r.referral_date)}</div>
            <div style="margin-top:20px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
                <span>Printed: ${new Date().toLocaleString('en-GB')}</span><span>SmartOPD · Base Hospital Kiribathgoda</span>
            </div>
        </div>
    </div>`;
    printPDF(html, `Referral_${r.referral_id}`);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MedicalHistory({ user }) {
    const [records,       setRecords]       = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [labTests,      setLabTests]      = useState([]);
    const [referrals,     setReferrals]     = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [filter,        setFilter]        = useState('all');   // all | consultation | prescription | lab | referral
    const [expanded,      setExpanded]      = useState({});      // key: `${type}-${id}`
    const [expandAll,     setExpandAll]     = useState(false);

    const pid = getPid(user);

    const loadAll = useCallback(async () => {
        if (!pid) return;
        setLoading(true);
        try {
            const [rRec, rRx, rLab, rRef] = await Promise.all([
                fetch(`${API}/medical-records/${pid}`).then(r => r.json()).catch(() => ({ success: false })),
                fetch(`${API}/prescriptions/${pid}`).then(r => r.json()).catch(() => ({ success: false })),
                fetch(`${API}/lab-results/${pid}`).then(r => r.json()).catch(() => ({ success: false })),
                fetch(`${API}/referrals/${pid}`).then(r => r.json()).catch(() => ({ success: false })),
            ]);
            if (rRec.success)  setRecords(rRec.records || []);
            if (rRx.success)   setPrescriptions(rRx.prescriptions || []);
            if (rLab.success)  setLabTests(rLab.tests || []);
            if (rRef.success)  setReferrals(rRef.referrals || []);
        } finally {
            setLoading(false);
        }
    }, [pid]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Tag each item with its type and sort date, then merge + sort newest first
    const allItems = [
        ...records.map(r => ({ ...r, _type: 'consultation', _sortDate: r.consultation_day, _id: `consultation-${r.record_id}` })),
        ...prescriptions.map(r => ({ ...r, _type: 'prescription', _sortDate: r.issued_at || r.consultation_day, _id: `prescription-${r.record_id || r.prescription_id}` })),
        ...labTests.map(r => ({ ...r, _type: 'lab', _sortDate: r.requested_at, _id: `lab-${r.test_id}` })),
        ...referrals.map(r => ({ ...r, _type: 'referral', _sortDate: r.referral_date, _id: `referral-${r.referral_id}` })),
    ].sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));

    const filtered = filter === 'all' ? allItems : allItems.filter(i => i._type === filter);

    const counts = {
        all:          allItems.length,
        consultation: records.length,
        prescription: prescriptions.length,
        lab:          labTests.length,
        referral:     referrals.length,
    };

    const toggleItem = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

    const handleExpandAll = () => {
        if (expandAll) {
            setExpanded({});
            setExpandAll(false);
        } else {
            const all = {};
            filtered.forEach(i => { all[i._id] = true; });
            setExpanded(all);
            setExpandAll(true);
        }
    };

    const tabs = [
        { key: 'all',          label: 'All Records',    Icon: ClipboardList  },
        { key: 'consultation', label: 'Consultations',  Icon: Stethoscope    },
        { key: 'prescription', label: 'Prescriptions',  Icon: Pill           },
        { key: 'lab',          label: 'Lab & Imaging',  Icon: FlaskConical   },
        { key: 'referral',     label: 'Referrals',      Icon: Share2         },
    ];

    return (
        <div className="mh-wrap">
            {/* ── PAGE HEADER ── */}
            <div className="mh-page-header">
                <div className="mh-page-header-left">
                    <div className="mh-page-icon">
                        <ClipboardList size={22} color="white" />
                    </div>
                    <div>
                        <h2 className="mh-page-title">Medical History</h2>
                        <p className="mh-page-sub">
                            All consultations, prescriptions, tests &amp; referrals for <strong>{user?.full_name}</strong>
                        </p>
                    </div>
                </div>
                <div className="mh-page-header-right">
                    <button className="mh-refresh-btn" onClick={loadAll} title="Refresh">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {loading ? <Spinner /> : allItems.length === 0 ? (
                <Empty
                    icon={ClipboardList}
                    title="No Medical Records"
                    sub="Your complete clinical history will appear here after your first consultation."
                />
            ) : (
                <>
                    {/* ── FILTER TABS ── */}
                    <div className="mh-filter-bar">
                        <div className="mh-tabs">
                            {tabs.map(({ key, label, Icon }) => (
                                <button key={key}
                                    className={`mh-tab ${filter === key ? 'active' : ''}`}
                                    onClick={() => { setFilter(key); setExpanded({}); setExpandAll(false); }}>
                                    <Icon size={14} />
                                    <span>{label}</span>
                                    <span className="mh-tab-count">{counts[key]}</span>
                                </button>
                            ))}
                        </div>
                        <button className="mh-expand-all-btn" onClick={handleExpandAll}>
                            {expandAll ? <><ChevronUp size={13} /> Collapse All</> : <><ChevronDown size={13} /> Expand All</>}
                        </button>
                    </div>

                    {/* ── RESULTS COUNT ── */}
                    <div className="mh-results-bar">
                        <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* ── TIMELINE ── */}
                    {filtered.length === 0 ? (
                        <Empty
                            icon={tabs.find(t => t.key === filter)?.Icon || ClipboardList}
                            title={`No ${tabs.find(t => t.key === filter)?.label || 'Records'}`}
                            sub="Nothing found for this filter."
                        />
                    ) : (
                        <div className="mh-timeline">
                            {filtered.map((item, idx) => {
                                const isExpanded = !!expanded[item._id];

                                // Date group separator
                                const thisDateKey = item._sortDate
                                    ? new Date(item._sortDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })
                                    : 'Unknown Date';
                                const prevDateKey = idx > 0 && filtered[idx - 1]._sortDate
                                    ? new Date(filtered[idx - 1]._sortDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' })
                                    : null;
                                const showMonth = thisDateKey !== prevDateKey;

                                return (
                                    <React.Fragment key={item._id}>
                                        {showMonth && (
                                            <div className="mh-month-divider">
                                                <span>{thisDateKey}</span>
                                            </div>
                                        )}
                                        <div className="mh-timeline-row">
                                            {/* Left date column */}
                                            <DateBadge dateStr={item._sortDate} />

                                            {/* Dot + line */}
                                            <div className="mh-tl-gutter">
                                                <div className={`mh-tl-dot mh-tl-dot-${item._type}`} />
                                                {idx < filtered.length - 1 && <div className="mh-tl-line" />}
                                            </div>

                                            {/* Record card */}
                                            <div className="mh-tl-content">
                                                {item._type === 'consultation' && (
                                                    <ConsultationCard
                                                        rec={item}
                                                        expanded={isExpanded}
                                                        onToggle={() => toggleItem(item._id)}
                                                    />
                                                )}
                                                {item._type === 'prescription' && (
                                                    <PrescriptionCard
                                                        rec={item}
                                                        expanded={isExpanded}
                                                        onToggle={() => toggleItem(item._id)}
                                                        user={user}
                                                        onPrint={r => handlePrintPrescription(r, user)}
                                                    />
                                                )}
                                                {item._type === 'lab' && (
                                                    <LabCard
                                                        rec={item}
                                                        expanded={isExpanded}
                                                        onToggle={() => toggleItem(item._id)}
                                                        onPrint={r => handlePrintLab(r, user)}
                                                    />
                                                )}
                                                {item._type === 'referral' && (
                                                    <ReferralCard
                                                        rec={item}
                                                        expanded={isExpanded}
                                                        onToggle={() => toggleItem(item._id)}
                                                        onPrint={r => handlePrintReferral(r, user)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
