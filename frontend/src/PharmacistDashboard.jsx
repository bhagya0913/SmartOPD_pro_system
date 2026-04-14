import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PharmacistDashboard.css';
import { useNavigate } from 'react-router-dom';
import {
    Home, User, Bell, MessageSquare, LogOut, Search, ScanBarcode,
    Pill, Package, CheckCircle2, Clock, ChevronRight, X, RefreshCw,
    Activity, Shield, Edit3, Save, Lock, Send, FileText, AlertCircle,
    AlertTriangle, Hash, Download, BarChart3, Calendar, Check,
    ExternalLink, ChevronDown, Barcode, Ban, Info, ClipboardCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const API      = 'http://localhost:5001/api';
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtDTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const Spinner  = () => <div className="ph-loading"><div className="ph-spinner" /></div>;
const Empty    = ({ icon: Icon, text }) => (
    <div className="ph-empty"><Icon size={28} style={{ opacity: .3 }} /><p>{text}</p></div>
);

// ── Download report helper ────────────────────────────────────────────────────
function reportStyle() {
    return `<style>
        *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;padding:0 24px;font-size:13px;background:#fff}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding:20px 0 14px;border-bottom:3px solid #1a6b3c}
        .logo{font-size:22px;font-weight:800;color:#1a6b3c}.hospital{font-size:12px;color:#64748b;margin-top:2px}
        .badge{background:#e8f5ee;border:1px solid #86c8a0;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;color:#1a6b3c;display:inline-block}
        .meta{font-size:10px;color:#94a3b8;margin-top:4px}
        h1{font-size:20px;font-weight:800;color:#0f172a;margin:16px 0 4px}
        .period{font-size:12px;color:#64748b;margin-bottom:18px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;display:inline-block}
        .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px}
        .stat-card{border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px}
        .stat-val{font-size:26px;font-weight:800}.stat-label{font-size:10px;color:#64748b;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
        .section-title{font-size:12px;font-weight:800;color:#0f172a;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.06em}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
        thead{background:#1a6b3c}th{padding:8px 12px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:white}
        td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}tr:nth-child(even) td{background:#fafafa}
        .no-data{text-align:center;color:#94a3b8;font-style:italic;padding:20px}
        .footer{margin-top:30px;padding-top:10px;border-top:2px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
        .green{color:#16a34a}.amber{color:#d97706}.red{color:#dc2626}.blue{color:#2563eb}
    </style>`;
}

function buildReportDoc(reportTitle, dateFrom, dateTo, bodyHTML) {
    const now = new Date();
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${reportTitle}</title>${reportStyle()}</head><body>
        <div class="header">
            <div><div class="logo">SmartOPD</div><div class="hospital">Base Hospital, Kiribathgoda — Pharmacy Unit</div></div>
            <div style="text-align:right"><div class="badge">PHARMACY REPORT</div><div class="meta">Generated: ${fmtDTime(now)}</div></div>
        </div>
        <h1>${reportTitle}</h1>
        <div class="period">Reporting Period: <strong>${fmtDate(dateFrom)}</strong> — <strong>${fmtDate(dateTo)}</strong></div>
        ${bodyHTML}
        <div class="footer">
            <span>SmartOPD — Pharmacy Unit, Base Hospital Kiribathgoda | Internal use only</span>
            <span style="color:#dc2626;font-weight:700">CONFIDENTIAL</span>
        </div>
    </body></html>`;
}

function downloadReportHTML(reportTitle, dateFrom, dateTo, bodyHTML) {
    const now = new Date();
    const filename = `${reportTitle.replace(/[\s\/\\:*?"<>|]/g, '_')}_${now.toISOString().slice(0, 10)}`;
    const blob = new Blob([buildReportDoc(reportTitle, dateFrom, dateTo, bodyHTML)], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename + '.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully.');
}

function openReportTab(reportTitle, dateFrom, dateTo, bodyHTML) {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Please allow popups to view report.'); return; }
    win.document.write(buildReportDoc(reportTitle, dateFrom, dateTo, bodyHTML));
    win.document.close();
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN SHELL
//  Key fix: openPatients & activePatient live HERE (shell level), so navigating
//  away and back via the sidebar never destroys the open patient tabs.
// ══════════════════════════════════════════════════════════════════════════════
export default function PharmacistDashboard({ user, setUser }) {
    const [activeTab,    setActiveTab]    = useState('home');
    const [openPatients, setOpenPatients] = useState([]);   // lifted up from DispenseMeds
    const [activePatient,setActivePatient]= useState(null); // lifted up
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    // Shared helpers passed down to DispenseMeds
    const handlePrescriptionsUpdate = useCallback((pid, freshPrescriptions) => {
        setOpenPatients(prev => prev.map(p =>
            p.pid === pid ? { ...p, prescriptions: freshPrescriptions } : p
        ));
    }, []);

    const closePatient = useCallback((pid) => {
        setOpenPatients(prev => {
            const remaining = prev.filter(p => p.pid !== pid);
            if (activePatient === pid)
                setActivePatient(remaining.length > 0 ? remaining[remaining.length - 1].pid : null);
            return remaining;
        });
    }, [activePatient]);

    const navItems = [
        { id: 'home',          label: 'Overview',          icon: Home },
        { id: 'dispense',      label: 'Dispense Meds',     icon: ScanBarcode },
        { id: 'all',           label: 'All Prescriptions', icon: FileText },
        { id: 'profile',       label: 'My Profile',        icon: User },
        { id: 'notifications', label: 'Notifications',     icon: Bell },
        { id: 'feedback',      label: 'Feedback',          icon: MessageSquare },
    ];

    return (
        <div className="ph-shell">
            <aside className="ph-sidebar">
                <div className="ph-brand">
                    <div className="ph-brand-icon"><Activity size={16} color="white" /></div>
                    <div>
                        <div className="ph-brand-name">SmartOPD</div>
                        <div className="ph-brand-role">Pharmacy Unit</div>
                    </div>
                </div>

                <div className="ph-sidebar-user">
                    <div className="ph-user-ava">{(user?.full_name || 'P')[0].toUpperCase()}</div>
                    <div>
                        <div className="ph-user-name">{user?.full_name || 'Pharmacist'}</div>
                        <div className="ph-user-role">Pharmacist · ID {user?.staff_id}</div>
                    </div>
                </div>

                <nav className="ph-nav">
                    {navItems.map(item => (
                        <button key={item.id}
                            className={`ph-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17} />
                            <span>{item.label}</span>
                            {/* badge: show count of open patients on Dispense tab */}
                            {item.id === 'dispense' && openPatients.length > 0 && (
                                <span className="ph-nav-badge">{openPatients.length}</span>
                            )}
                        </button>
                    ))}
                </nav>

                <button className="ph-nav-item ph-logout" onClick={handleLogout}>
                    <LogOut size={17} /><span>Sign Out</span>
                </button>
            </aside>

            <div className="ph-main">
                <header className="ph-topbar">
                    <div className="ph-breadcrumb">
                        Base Hospital · Pharmacy
                        <ChevronRight size={13} />
                        <strong>{navItems.find(n => n.id === activeTab)?.label}</strong>
                        {/* Show open patient indicator in topbar when on dispense */}
                        {activeTab === 'dispense' && openPatients.length > 0 && (
                            <span className="ph-topbar-patient-hint">
                                · {openPatients.find(p => p.pid === activePatient)?.patient?.full_name || ''}
                            </span>
                        )}
                    </div>
                    <div className="ph-topbar-right">
                        <div className="ph-live-dot" /><span className="ph-live-label">Pharmacy Open</span>
                    </div>
                </header>

                <div className="ph-content">
                    {activeTab === 'home'          && <PharmacistHome user={user} />}
                    {activeTab === 'dispense'      && (
                        <DispenseMeds
                            user={user}
                            openPatients={openPatients}
                            setOpenPatients={setOpenPatients}
                            activePatient={activePatient}
                            setActivePatient={setActivePatient}
                            closePatient={closePatient}
                            onPrescriptionsUpdate={handlePrescriptionsUpdate}
                        />
                    )}
                    {activeTab === 'all'           && <AllPrescriptions />}
                    {activeTab === 'profile'       && <PharmacistProfile user={user} />}
                    {activeTab === 'notifications' && <PharmacistNotifications user={user} />}
                    {activeTab === 'feedback'      && <PharmacistFeedback user={user} />}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HOME / OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function PharmacistHome({ user }) {
    const [stats,   setStats]   = useState({ pending: 0, fulfilled: 0, total: 0 });
    const [queue,   setQueue]   = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sRes, qRes] = await Promise.all([
                fetch(`${API}/pharmacist/stats`),
                fetch(`${API}/pharmacist/pending-queue`)
            ]);
            const [sData, qData] = await Promise.all([sRes.json(), qRes.json()]);
            if (sData.success) setStats(sData.stats);
            setQueue(Array.isArray(qData) ? qData : (qData.items || []));
        } catch { toast.error('Failed to load overview.'); }
        finally  { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <div className="ph-section">
            <div className="ph-hero">
                <div>
                    <h1 className="ph-hero-title">
                        Welcome, {user?.full_name?.split(' ')[0] || 'Pharmacist'}
                    </h1>
                    <p className="ph-hero-sub">{today}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="ph-hero-badge">
                        <div className="ph-live-dot" /><span>Pharmacy Open</span>
                    </div>
                    <button className="ph-btn-ghost" onClick={load}>
                        <RefreshCw size={13} className={loading ? 'ph-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            <div className="ph-stat-grid">
                {[
                    { label: 'Pending Dispensations', val: stats.pending,   icon: Pill,         color: 'amber' },
                    { label: 'Fulfilled Today',        val: stats.fulfilled, icon: CheckCircle2, color: 'green' },
                    { label: 'Total Today',            val: stats.total,     icon: Package,      color: 'blue'  },
                ].map(s => (
                    <div key={s.label} className={`ph-stat ph-stat-${s.color}`}>
                        <div className="ph-stat-icon"><s.icon size={20} /></div>
                        <div>
                            <div className="ph-stat-val">{s.val}</div>
                            <div className="ph-stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ph-card">
                <div className="ph-card-head">
                    <h3><Pill size={14} /> Pending Dispensations Queue</h3>
                    <span className="ph-badge ph-badge-amber">{queue.length}</span>
                </div>
                {loading ? <Spinner />
                : queue.length === 0 ? <Empty icon={Pill} text="No pending prescriptions — all clear!" />
                : (
                    <div className="ph-table-wrap">
                        <table className="ph-table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>NIC</th>
                                    <th>Barcode</th>
                                    <th>Prescribed By</th>
                                    <th>Dr. Staff ID</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {queue.map((r, i) => (
                                    <tr key={r.record_id || i}>
                                        <td>
                                            <div className="ph-name-cell">
                                                <div className="ph-ava-sm">{(r.patient_name || '?')[0]}</div>
                                                <strong>{r.patient_name}</strong>
                                            </div>
                                        </td>
                                        <td className="ph-mono ph-dimmed">{r.nic || '—'}</td>
                                        <td className="ph-mono ph-dimmed ph-small">{r.barcode || '—'}</td>
                                        <td>Dr. {r.doctor_name || '—'}</td>
                                        <td>
                                            {r.doctor_staff_id
                                                ? <span className="ph-staff-id-tag"><Hash size={11} />{r.doctor_staff_id}</span>
                                                : <span className="ph-dimmed">—</span>}
                                        </td>
                                        <td>{fmtDate(r.consultation_day)}</td>
                                        <td><span className="ph-badge ph-badge-amber"><Clock size={10} /> Pending</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PRESCRIPTION PANEL — professional Rx card UI
// ══════════════════════════════════════════════════════════════════════════════
function PrescriptionPanel({ pid, patient, prescriptions, pharmacistId, onUpdate }) {
    const [fulfilling,      setFulfilling]      = useState(null);
    const [medStatus,       setMedStatus]       = useState({});
    const [pharmacistNotes, setPharmacistNotes] = useState({});
    const [savingNote,      setSavingNote]      = useState(null);

    const pendingCount = prescriptions.filter(rx => !rx.fulfilled).length;

    const parseMeds = (raw) => {
        if (!raw) return [];
        const lines = raw.split('\n').filter(l => l.trim());
        return lines.map((line, i) => {
            const match   = line.match(/^\d+[\.\)]\s*(.+)/);
            const content = match ? match[1] : line;
            const parts   = content.split(/[|,;]\s*/);
            return {
                index:    i,
                name:     parts[0]?.trim() || content.trim(),
                dosage:   parts[1]?.trim() || '',
                duration: parts[2]?.trim() || '',
                raw:      line.trim(),
            };
        });
    };

    const getMedSt = (recId, idx) => medStatus[recId]?.[idx] || null;
    const setMedSt = (recId, idx, status) => {
        setMedStatus(prev => ({
            ...prev,
            [recId]: { ...(prev[recId] || {}), [idx]: status }
        }));
    };

    const handleFulfill = async (recordId) => {
        setFulfilling(recordId);
        try {
            const r = await fetch(`${API}/pharmacist/fulfill-record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    record_id:     recordId,
                    pharmacist_id: pharmacistId,
                    notes:         pharmacistNotes[recordId] || ''
                })
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Prescription marked as dispensed.');
                const r2 = await fetch(
                    `${API}/pharmacist/prescriptions-by-patient?term=${encodeURIComponent(patient.barcode)}`
                );
                const d2 = await r2.json();
                if (d2.success) onUpdate(pid, d2.prescriptions || []);
            } else toast.error(d.message || 'Failed to dispense.');
        } catch { toast.error('Server error.'); }
        finally   { setFulfilling(null); }
    };

    const saveNote = async (recordId) => {
        setSavingNote(recordId);
        try {
            await fetch(`${API}/pharmacist/save-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ record_id: recordId, note: pharmacistNotes[recordId] || '' })
            });
            toast.success('Note saved.');
        } catch { toast.error('Server error.'); }
        finally   { setSavingNote(null); }
    };

    return (
        <div className="ph-patient-panel">
            {/* Patient header */}
            <div className="ph-pt-header">
                <div className="ph-pt-ava">
                    {(patient.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="ph-pt-info">
                    <h2 className="ph-pt-name">{patient.full_name}</h2>
                    <div className="ph-pt-meta">
                        {patient.nic    && <span><Shield size={12} /> {patient.nic}</span>}
                        {patient.gender && <span>{patient.gender}</span>}
                        {patient.dob    && <span>DOB: {fmtDate(patient.dob)}</span>}
                        <span className="ph-pt-barcode">
                            <Barcode size={12} /> {patient.barcode}
                        </span>
                    </div>
                </div>
                <div className="ph-pt-summary">
                    {pendingCount > 0
                        ? <span className="ph-badge ph-badge-amber"><Pill size={11} /> {pendingCount} pending</span>
                        : <span className="ph-badge ph-badge-green"><CheckCircle2 size={11} /> All dispensed</span>}
                </div>
            </div>

            {/* Prescription cards */}
            {prescriptions.length === 0
                ? <Empty icon={Pill} text="No prescriptions found for this patient." />
                : prescriptions.map((rx, i) => {
                    const meds         = parseMeds(rx.prescription_details);
                    const rxMedStatus  = medStatus[rx.record_id] || {};
                    const allMarked    = meds.length > 0 && meds.every((_, idx) => rxMedStatus[idx]);
                    const hasUnavail   = meds.some((_, idx) => rxMedStatus[idx] === 'unavailable');

                    return (
                        <div key={rx.record_id || i} className={`ph-rx-card ${rx.fulfilled ? 'ph-rx-fulfilled' : ''}`}>

                            {/* Rx Card Header */}
                            <div className="ph-rx-card-hdr">
                                <div className="ph-rx-hdr-left">
                                    <span className="ph-rx-label">Rx #{rx.record_id}</span>
                                    <div className="ph-rx-doc-info">
                                        <span className="ph-rx-doctor">
                                            Dr. {rx.doctor_name || 'Unknown'}
                                            {rx.doctor_staff_id && (
                                                <span className="ph-staff-id-tag" style={{ marginLeft: 8 }}>
                                                    <Hash size={10} />{rx.doctor_staff_id}
                                                </span>
                                            )}
                                        </span>
                                        <span className="ph-rx-date-line">
                                            <Calendar size={11} /> Prescribed: {fmtDate(rx.consultation_day)}
                                        </span>
                                    </div>
                                </div>
                                <div className="ph-rx-hdr-right">
                                    {rx.fulfilled
                                        ? <div className="ph-rx-dispensed-badge">
                                            <CheckCircle2 size={14} />
                                            <div>
                                                <div>Dispensed</div>
                                                <div className="ph-rx-dispensed-date">{fmtDate(rx.fulfilled_at)}</div>
                                            </div>
                                          </div>
                                        : <span className="ph-badge ph-badge-amber"><Clock size={10} /> Pending</span>}
                                </div>
                            </div>

                            {/* Rx body */}
                            <div className="ph-rx-body">
                                <div className="ph-rx-body-title">
                                    <Pill size={13} /> Prescribed Medications
                                    {meds.length > 0 && (
                                        <span className="ph-rx-med-count">{meds.length} item{meds.length !== 1 ? 's' : ''}</span>
                                    )}
                                </div>

                                {meds.length > 0 ? (
                                    <div className="ph-rx-table-wrap">
                                        <table className="ph-rx-med-table">
                                            <thead>
                                                <tr>
                                                    <th className="ph-col-num">#</th>
                                                    <th className="ph-col-med">Medication</th>
                                                    <th className="ph-col-dos">Dosage</th>
                                                    <th className="ph-col-dur">Duration</th>
                                                    {!rx.fulfilled && <th className="ph-col-act">Action</th>}
                                                    {!rx.fulfilled && <th className="ph-col-st">Status</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {meds.map((med, idx) => {
                                                    const st = getMedSt(rx.record_id, idx);
                                                    return (
                                                        <tr key={idx} className={
                                                            st === 'dispensed'   ? 'ph-med-dispensed'   :
                                                            st === 'unavailable' ? 'ph-med-unavailable' : ''
                                                        }>
                                                            <td className="ph-med-num">{idx + 1}</td>
                                                            <td>
                                                                <span className="ph-med-name"
                                                                    style={st === 'dispensed' ? { textDecoration: 'line-through', opacity: .55 } : {}}>
                                                                    {med.name}
                                                                </span>
                                                            </td>
                                                            <td className="ph-med-detail">{med.dosage || '—'}</td>
                                                            <td className="ph-med-detail">{med.duration || '—'}</td>
                                                            {!rx.fulfilled && (
                                                                <td>
                                                                    <div className="ph-med-actions">
                                                                        <button
                                                                            className={`ph-med-btn ph-med-btn-dispense ${st === 'dispensed' ? 'active' : ''}`}
                                                                            title="Mark Dispensed"
                                                                            onClick={() => setMedSt(rx.record_id, idx, st === 'dispensed' ? null : 'dispensed')}>
                                                                            <Check size={13} />
                                                                        </button>
                                                                        <button
                                                                            className={`ph-med-btn ph-med-btn-unavail ${st === 'unavailable' ? 'active' : ''}`}
                                                                            title="Mark Unavailable"
                                                                            onClick={() => setMedSt(rx.record_id, idx, st === 'unavailable' ? null : 'unavailable')}>
                                                                            <Ban size={13} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {!rx.fulfilled && (
                                                                <td>
                                                                    {st === 'dispensed'   && <span className="ph-med-st-tag ph-med-st-ok"><Check size={10} /> Dispensed</span>}
                                                                    {st === 'unavailable' && <span className="ph-med-st-tag ph-med-st-na"><Ban size={10} /> Unavailable</span>}
                                                                    {!st                  && <span className="ph-dimmed" style={{ fontSize: '.72rem' }}>—</span>}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <pre className="ph-rx-raw">{rx.prescription_details}</pre>
                                )}
                            </div>

                            {/* Pharmacist notes */}
                            {!rx.fulfilled && (
                                <div className="ph-rx-notes-area">
                                    <label className="ph-rx-notes-label">
                                        <Edit3 size={12} /> Pharmacist Notes <span className="ph-opt">(optional)</span>
                                    </label>
                                    <div className="ph-rx-notes-row">
                                        <textarea
                                            className="ph-input ph-ta"
                                            rows={2}
                                            placeholder="Add notes — substitutions, counselling given, unavailable items…"
                                            value={pharmacistNotes[rx.record_id] || ''}
                                            onChange={e => setPharmacistNotes(n => ({ ...n, [rx.record_id]: e.target.value }))}
                                        />
                                        <button className="ph-btn-ghost ph-btn-sm ph-note-save"
                                            disabled={savingNote === rx.record_id}
                                            onClick={() => saveNote(rx.record_id)}>
                                            {savingNote === rx.record_id
                                                ? <><div className="ph-btn-spin" />…</>
                                                : <><Save size={12} /> Save</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Rx footer — dispense action */}
                            {!rx.fulfilled && (
                                <div className="ph-rx-footer">
                                    {hasUnavail && (
                                        <div className="ph-rx-unavail-warn">
                                            <AlertTriangle size={13} />
                                            Some medications marked as unavailable — please note this before dispensing.
                                        </div>
                                    )}
                                    <div className="ph-rx-footer-actions">
                                        <button
                                            className="ph-btn-primary"
                                            disabled={fulfilling === rx.record_id}
                                            onClick={() => handleFulfill(rx.record_id)}>
                                            {fulfilling === rx.record_id
                                                ? <><div className="ph-btn-spin" />Dispensing…</>
                                                : <><ClipboardCheck size={14} /> Mark Entire Prescription Dispensed</>}
                                        </button>
                                        {allMarked && (
                                            <span className="ph-rx-all-marked"><Check size={12} /> All items marked</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Fulfilled bar */}
                            {rx.fulfilled && (
                                <div className="ph-rx-fulfilled-bar">
                                    <CheckCircle2 size={14} /> Dispensed on {fmtDTime(rx.fulfilled_at)}
                                </div>
                            )}
                        </div>
                    );
                })
            }
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  DISPENSE MEDICATIONS
//  Props: openPatients/setOpenPatients/activePatient/setActivePatient are now
//  owned by the shell so they survive tab switching.
// ══════════════════════════════════════════════════════════════════════════════
function DispenseMeds({
    user,
    openPatients, setOpenPatients,
    activePatient, setActivePatient,
    closePatient,
    onPrescriptionsUpdate,
}) {
    const [mode,        setMode]        = useState('barcode');
    const [query,       setQuery]       = useState('');
    const [searched,    setSearched]    = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [scannerInfo, setScannerInfo] = useState(false);

    const inputRef   = useRef(null);
    const scanBuffer = useRef('');
    const scanTimer  = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, [mode]);

    // Hardware barcode scanner listener
    useEffect(() => {
        const onKeyDown = (e) => {
            if (document.activeElement === inputRef.current) return;
            if (e.key === 'Enter') {
                if (scanBuffer.current.length >= 3) {
                    const term = scanBuffer.current.trim();
                    scanBuffer.current = '';
                    clearTimeout(scanTimer.current);
                    setQuery(term);
                    triggerSearch(term);
                }
                return;
            }
            if (e.key.length === 1) {
                scanBuffer.current += e.key;
                clearTimeout(scanTimer.current);
                scanTimer.current = setTimeout(() => {
                    if (scanBuffer.current.length < 8) scanBuffer.current = '';
                }, 100);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => { window.removeEventListener('keydown', onKeyDown); clearTimeout(scanTimer.current); };
    }, [openPatients]); // eslint-disable-line

    const modeCfg = {
        barcode: { label: 'Barcode / Patient ID', placeholder: 'Scan or type barcode — e.g. BHK-ABC-1234', icon: ScanBarcode },
        nic:     { label: 'NIC Number',           placeholder: 'Enter NIC — e.g. 199012345678',            icon: Shield },
    };

    const switchMode  = m => { setMode(m); setQuery(''); setSearched(false); };
    const clearSearch = ()  => { setQuery(''); setSearched(false); inputRef.current?.focus(); };

    const triggerSearch = async (term) => {
        const searchTerm = (term || query).trim();
        if (!searchTerm) return;
        setLoading(true); setSearched(true);
        try {
            const r = await fetch(`${API}/pharmacist/prescriptions-by-patient?term=${encodeURIComponent(searchTerm)}`);
            const d = await r.json();
            if (!d.success) { toast.error(d.message || 'Patient not found.'); setLoading(false); return; }
            const patient       = d.patient;
            const prescriptions = d.prescriptions || [];
            const pid           = patient.patient_id;
            const alreadyOpen   = openPatients.find(p => p.pid === pid);
            if (alreadyOpen) {
                setActivePatient(pid);
                toast(`${patient.full_name} is already open.`, { icon: '👆' });
            } else {
                setOpenPatients(prev => [...prev, { pid, patient, prescriptions }]);
                setActivePatient(pid);
            }
            setQuery(''); setSearched(false);
        } catch { toast.error('Server error.'); }
        finally   { setLoading(false); }
    };

    const handleSearch  = () => triggerSearch(query);
    const activeEntry   = openPatients.find(p => p.pid === activePatient);

    return (
        <div className="ph-section">
            <div className="ph-section-head">
                <div>
                    <h2>Dispense Medications</h2>
                    <p>Search by barcode or NIC — each patient opens in a separate tab</p>
                </div>
                <button className="ph-btn-ghost ph-btn-sm" onClick={() => setScannerInfo(s => !s)}>
                    <Barcode size={14} /> Scanner Help
                </button>
            </div>

            {/* Scanner info panel */}
            {scannerInfo && (
                <div className="ph-scanner-info-card">
                    <div className="ph-sic-header">
                        <Barcode size={18} color="#1a6b3c" />
                        <strong>Using a Hardware Barcode Scanner</strong>
                        <button className="ph-sic-close" onClick={() => setScannerInfo(false)}><X size={15} /></button>
                    </div>
                    <div className="ph-sic-body">
                        <div className="ph-sic-row">
                            {[
                                { n: 1, title: 'Connect your scanner', desc: 'Plug in your USB barcode scanner. It works as a keyboard — no driver needed.' },
                                { n: 2, title: 'Scan anywhere on this page', desc: 'You do not need to click the input box. Simply scan the barcode — it detects automatically.' },
                                { n: 3, title: 'Or click the input and scan', desc: 'You can also click the search box first, then scan — both methods work.' },
                            ].map(s => (
                                <div key={s.n} className="ph-sic-step">
                                    <div className="ph-sic-num">{s.n}</div>
                                    <div><strong>{s.title}</strong><p>{s.desc}</p></div>
                                </div>
                            ))}
                        </div>
                        <div className="ph-sic-tip">
                            <Info size={13} />
                            <span>Most USB scanners automatically press <kbd>Enter</kbd> after scanning. The system distinguishes scanner input from manual typing by key speed.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Search card */}
            <div className="ph-lookup-card">
                <div className="ph-mode-tabs">
                    {Object.entries(modeCfg).map(([id, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                            <button key={id}
                                className={`ph-mode-tab ${mode === id ? 'active' : ''}`}
                                onClick={() => switchMode(id)}>
                                <Icon size={14} />{cfg.label}
                            </button>
                        );
                    })}
                </div>

                <div className="ph-search-row">
                    <div className="ph-search-wrap">
                        <Search size={15} className="ph-search-ico" />
                        <input
                            ref={inputRef}
                            className="ph-search-input"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={modeCfg[mode].placeholder}
                        />
                        {query && (
                            <button className="ph-clear" onClick={clearSearch}><X size={13} /></button>
                        )}
                    </div>
                    <button className="ph-btn-primary"
                        onClick={handleSearch} disabled={loading || !query.trim()}>
                        {loading
                            ? <><div className="ph-btn-spin" />Searching…</>
                            : <><Search size={14} />Open Patient</>}
                    </button>
                </div>

                {searched && !loading && (
                    <div className="ph-lookup-empty">
                        <AlertCircle size={17} style={{ opacity: .4 }} />
                        <span>No patient found for "<strong>{query}</strong>" by {modeCfg[mode].label}.</span>
                    </div>
                )}
            </div>

            {/* Patient tabs + panel */}
            {openPatients.length > 0 ? (
                <div className="ph-pt-tabs-area">
                    <div className="ph-pt-tab-strip">
                        {openPatients.map(p => {
                            const initials = (p.patient.full_name || '?')
                                .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                            const pending  = p.prescriptions.filter(rx => !rx.fulfilled).length;
                            const allDone  = pending === 0 && p.prescriptions.length > 0;
                            return (
                                <div key={p.pid}
                                    className={`ph-pt-tab ${activePatient === p.pid ? 'active' : ''}`}
                                    onClick={() => setActivePatient(p.pid)}>
                                    <div className="ph-pt-tab-ava">{initials}</div>
                                    <div className="ph-pt-tab-info">
                                        <span className="ph-pt-tab-name">{p.patient.full_name}</span>
                                        <span className="ph-pt-tab-sub">
                                            {allDone
                                                ? <><CheckCircle2 size={10} /> All dispensed</>
                                                : pending > 0
                                                    ? <><Pill size={10} /> {pending} pending</>
                                                    : <span style={{ color: '#94a3b8' }}>No prescriptions</span>}
                                        </span>
                                    </div>
                                    <button className="ph-pt-tab-close"
                                        onClick={e => { e.stopPropagation(); closePatient(p.pid); }}
                                        title="Close tab"><X size={12} /></button>
                                </div>
                            );
                        })}
                    </div>

                    {activeEntry && (
                        <PrescriptionPanel
                            key={activeEntry.pid}
                            pid={activeEntry.pid}
                            patient={activeEntry.patient}
                            prescriptions={activeEntry.prescriptions}
                            pharmacistId={user?.staff_id}
                            onUpdate={onPrescriptionsUpdate}
                        />
                    )}
                </div>
            ) : (
                <div className="ph-no-patient-prompt">
                    <ScanBarcode size={38} strokeWidth={1.2} />
                    <h3>No Patients Open</h3>
                    <p>Scan a barcode or enter a NIC number to open a patient's prescriptions.</p>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ALL PRESCRIPTIONS — with report generation
// ══════════════════════════════════════════════════════════════════════════════
const REPORT_CATEGORIES = [
    {
        id: 'prescription', label: 'Prescription Reports', icon: FileText,
        color: '#1a6b3c', bg: '#e8f5ee', border: '#86c8a0',
        reports: [
            { id: 'daily_received', label: 'Daily Prescriptions Received',   icon: Calendar,    desc: 'Total prescriptions received per day' },
            { id: 'dispensed',      label: 'Dispensed Prescriptions Report',  icon: CheckCircle2,desc: 'All fulfilled prescriptions in period' },
            { id: 'pending',        label: 'Pending Prescriptions Report',    icon: Clock,       desc: 'Outstanding unfulfilled prescriptions' },
        ]
    },
    {
        id: 'medication', label: 'Medication Reports', icon: Pill,
        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
        reports: [
            { id: 'most_prescribed', label: 'Most Prescribed Medicines',         icon: BarChart3, desc: 'Ranking of most frequently prescribed drugs' },
            { id: 'freq_by_doctor',  label: 'Prescription Frequency by Doctor',  icon: Hash,      desc: 'Volume of prescriptions per doctor' },
        ]
    },
];

function AllPrescriptions() {
    const [items,   setItems]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter,  setFilter]  = useState('pending');

    const [selCategory,  setSelCategory]  = useState(null);
    const [selReport,    setSelReport]    = useState(null);
    const [dateMode,     setDateMode]     = useState('range');
    const [dateFrom,     setDateFrom]     = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
    });
    const [dateTo,       setDateTo]       = useState(new Date().toISOString().split('T')[0]);
    const [singleDate,   setSingleDate]   = useState(new Date().toISOString().split('T')[0]);
    const [generating,   setGenerating]   = useState(false);
    const [reportResult, setReportResult] = useState(null);

    const effectiveFrom = dateMode === 'single' ? singleDate : dateFrom;
    const effectiveTo   = dateMode === 'single' ? singleDate : dateTo;

    const load = useCallback(() => {
        setLoading(true);
        fetch(`${API}/pharmacist/all-prescriptions?status=${filter}`)
            .then(r => r.json()).then(d => setItems(d.prescriptions || []))
            .catch(() => setItems([])).finally(() => setLoading(false));
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const setQuickRange = (days) => {
        const to = new Date(), from = new Date();
        from.setDate(from.getDate() - days);
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(to.toISOString().split('T')[0]);
        setDateMode('range');
    };

    const noData = () => `<tr><td colspan="10" class="no-data">No data available for selected period.</td></tr>`;
    const sc = (val, label, color = '#1a6b3c') =>
        `<div class="stat-card" style="border-color:${color}30"><div class="stat-val" style="color:${color}">${val ?? 0}</div><div class="stat-label">${label}</div></div>`;

    function buildReportHTML(rptId, d) {
        switch (rptId) {
            case 'daily_received': {
                const rows  = d.daily || [];
                const total = rows.reduce((s, r) => s + (r.count || 0), 0);
                return `
                    <div class="stat-grid">${sc(total,'Total Prescriptions')}${sc(rows.length,'Days Recorded','#2563eb')}${sc(rows.length?Math.round(total/rows.length):0,'Daily Average','#d97706')}</div>
                    <div class="section-title">Daily Prescriptions Received</div>
                    <table><thead><tr><th>Date</th><th>Day</th><th>Prescriptions</th></tr></thead><tbody>
                    ${rows.length ? rows.map(r=>{
                        const day=new Date(r.date).toLocaleDateString('en-GB',{weekday:'short'});
                        return `<tr><td>${fmtDate(r.date)}</td><td>${day}</td><td><strong>${r.count}</strong></td></tr>`;
                    }).join('') : noData()}
                    </tbody></table>`;
            }
            case 'dispensed': {
                const rows = d.prescriptions || [];
                return `
                    <div class="stat-grid">${sc(rows.length,'Total Dispensed')}</div>
                    <div class="section-title">Dispensed Prescriptions</div>
                    <table><thead><tr><th>#</th><th>Patient</th><th>NIC</th><th>Doctor</th><th>Prescribed</th><th>Dispensed</th></tr></thead><tbody>
                    ${rows.length ? rows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${r.patient_name||'—'}</strong></td><td>${r.nic||'—'}</td><td>Dr. ${r.doctor_name||'—'}</td><td>${fmtDate(r.consultation_day)}</td><td>${fmtDate(r.fulfilled_at)}</td></tr>`).join('') : noData()}
                    </tbody></table>`;
            }
            case 'pending': {
                const rows = d.prescriptions || [];
                return `
                    <div class="stat-grid">${sc(rows.length,'Pending Prescriptions','#d97706')}</div>
                    <div class="section-title">Pending Prescriptions</div>
                    <table><thead><tr><th>#</th><th>Patient</th><th>NIC</th><th>Doctor</th><th>Prescribed</th><th>Days Outstanding</th></tr></thead><tbody>
                    ${rows.length ? rows.map((r,i)=>{
                        const days=Math.floor((new Date()-new Date(r.consultation_day))/(1000*60*60*24));
                        const cls=days>7?'class="red"':days>3?'class="amber"':'class="green"';
                        return `<tr><td>${i+1}</td><td><strong>${r.patient_name||'—'}</strong></td><td>${r.nic||'—'}</td><td>Dr. ${r.doctor_name||'—'}</td><td>${fmtDate(r.consultation_day)}</td><td ${cls}>${days}d</td></tr>`;
                    }).join('') : noData()}
                    </tbody></table>`;
            }
            case 'most_prescribed': {
                const rows  = d.medications || [];
                const total = rows.reduce((s, r) => s + (r.count || 0), 0);
                return `
                    <div class="stat-grid">${sc(total,'Total Prescriptions')}${sc(rows.length,'Unique Medications','#2563eb')}</div>
                    <div class="section-title">Most Prescribed Medications</div>
                    <table><thead><tr><th>Rank</th><th>Medication</th><th>Times Prescribed</th><th>%</th></tr></thead><tbody>
                    ${rows.length ? rows.slice(0,20).map((r,i)=>{
                        const pct=total>0?((r.count/total)*100).toFixed(1):0;
                        return `<tr><td><strong>#${i+1}</strong></td><td>${r.medication_name||r.name||'—'}</td><td><strong>${r.count}</strong></td><td class="green">${pct}%</td></tr>`;
                    }).join('') : noData()}
                    </tbody></table>`;
            }
            case 'freq_by_doctor': {
                const rows = d.doctors || [];
                const tot  = rows.reduce((s, r) => s + (r.count || 0), 0);
                return `
                    <div class="stat-grid">${sc(rows.length,'Prescribing Doctors')}${sc(tot,'Total Prescriptions','#2563eb')}</div>
                    <div class="section-title">Prescription Frequency by Doctor</div>
                    <table><thead><tr><th>Rank</th><th>Doctor</th><th>Staff ID</th><th>Prescriptions</th><th>%</th></tr></thead><tbody>
                    ${rows.length ? rows.sort((a,b)=>(b.count||0)-(a.count||0)).map((r,i)=>{
                        const pct=tot>0?((r.count/tot)*100).toFixed(1):0;
                        return `<tr><td><strong>#${i+1}</strong></td><td><strong>Dr. ${r.doctor_name||'—'}</strong></td><td>${r.doctor_staff_id||'—'}</td><td><strong>${r.count}</strong></td><td>${pct}%</td></tr>`;
                    }).join('') : noData()}
                    </tbody></table>`;
            }
            default: return `<div class="no-data">No data available.</div>`;
        }
    }

    const generateReport = async () => {
        if (!selReport) { toast.error('Please select a report type.'); return; }
        setGenerating(true); setReportResult(null);
        try {
            const r = await fetch(
                `${API}/pharmacist/reports/generate?type=${selReport.id}&from=${effectiveFrom}&to=${effectiveTo}`
            );
            const d = await r.json();
            const html = buildReportHTML(selReport.id, d.success ? d : {});
            setReportResult({ title: selReport.label, html, from: effectiveFrom, to: effectiveTo });
            toast.success('Report generated.');
        } catch {
            const html = buildReportHTML(selReport.id, {});
            setReportResult({ title: selReport.label, html, from: effectiveFrom, to: effectiveTo });
        } finally { setGenerating(false); }
    };

    return (
        <div className="ph-section">
            <div className="ph-section-head">
                <div>
                    <h2>All Prescriptions</h2>
                    <p>Full prescription register, fulfillment status &amp; report generation</p>
                </div>
                <button className="ph-btn-ghost" onClick={load}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Prescription list */}
            <div className="ph-filter-row">
                {['pending', 'fulfilled', 'all'].map(f => (
                    <button key={f} className={`ph-pill-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            <div className="ph-card">
                {loading ? <Spinner />
                : items.length === 0 ? <Empty icon={FileText} text="No prescriptions found." />
                : (
                    <div className="ph-table-wrap">
                        <table className="ph-table">
                            <thead>
                                <tr>
                                    <th>Patient</th><th>NIC</th><th>Barcode</th>
                                    <th>Prescribed By</th><th>Staff ID</th>
                                    <th>Date</th><th>Status</th><th>Dispensed On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((r, i) => (
                                    <tr key={r.record_id || i}>
                                        <td>
                                            <div className="ph-name-cell">
                                                <div className="ph-ava-sm">{(r.patient_name || '?')[0]}</div>
                                                <strong>{r.patient_name}</strong>
                                            </div>
                                        </td>
                                        <td className="ph-mono ph-dimmed">{r.nic || '—'}</td>
                                        <td className="ph-mono ph-dimmed ph-small">{r.barcode || '—'}</td>
                                        <td>Dr. {r.doctor_name || '—'}</td>
                                        <td>
                                            {r.doctor_staff_id
                                                ? <span className="ph-staff-id-tag"><Hash size={11} />{r.doctor_staff_id}</span>
                                                : <span className="ph-dimmed">—</span>}
                                        </td>
                                        <td>{fmtDate(r.consultation_day)}</td>
                                        <td>
                                            <span className={`ph-badge ${r.fulfilled ? 'ph-badge-green' : 'ph-badge-amber'}`}>
                                                {r.fulfilled ? 'Dispensed' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>{r.fulfilled_at ? fmtDate(r.fulfilled_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reports section */}
            <div className="ph-reports-divider">
                <BarChart3 size={16} /> Prescription &amp; Medication Reports
            </div>

            {/* Step 1 */}
            <div className="ph-report-step">
                <div className="ph-report-step-label">
                    <span className="ph-step-num">1</span> Select Report Type
                </div>
                <div className="ph-report-cats">
                    {REPORT_CATEGORIES.map(cat => (
                        <div key={cat.id}
                            className={`ph-rcat ${selCategory?.id === cat.id ? 'open' : ''}`}
                            style={{ '--rc': cat.color, '--rb': cat.bg, '--rbd': cat.border }}>
                            <div className="ph-rcat-hdr"
                                onClick={() => { setSelCategory(selCategory?.id === cat.id ? null : cat); setSelReport(null); setReportResult(null); }}>
                                <div className="ph-rcat-icon"><cat.icon size={17} /></div>
                                <span className="ph-rcat-label">{cat.label}</span>
                                <ChevronDown size={14} className={`ph-rcat-chevron ${selCategory?.id === cat.id ? 'open' : ''}`} />
                            </div>
                            {selCategory?.id === cat.id && (
                                <div className="ph-rcat-items">
                                    {cat.reports.map(rpt => (
                                        <div key={rpt.id}
                                            className={`ph-ritem ${selReport?.id === rpt.id ? 'active' : ''}`}
                                            onClick={() => { setSelReport(rpt); setReportResult(null); }}>
                                            <div className="ph-ritem-icon"><rpt.icon size={14} /></div>
                                            <div>
                                                <div className="ph-ritem-label">{rpt.label}</div>
                                                <div className="ph-ritem-desc">{rpt.desc}</div>
                                            </div>
                                            {selReport?.id === rpt.id && <Check size={14} style={{ color: 'var(--rc,#1a6b3c)', marginLeft: 'auto', flexShrink: 0 }} />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 2 */}
            {selReport && (
                <div className="ph-report-step">
                    <div className="ph-report-step-label">
                        <span className="ph-step-num">2</span> Select Date Range
                    </div>
                    <div className="ph-card">
                        <div style={{ padding: '16px 18px' }}>
                            <div className="ph-date-mode-toggle">
                                <button className={`ph-dmt-btn ${dateMode === 'single' ? 'active' : ''}`} onClick={() => setDateMode('single')}>Single Day</button>
                                <button className={`ph-dmt-btn ${dateMode === 'range'  ? 'active' : ''}`} onClick={() => setDateMode('range')}>Date Range</button>
                            </div>

                            {dateMode === 'single' ? (
                                <div className="ph-fg" style={{ maxWidth: 220, marginTop: 14 }}>
                                    <label>Select Date</label>
                                    <input className="ph-input" type="date" value={singleDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setSingleDate(e.target.value)} />
                                </div>
                            ) : (
                                <>
                                    <div className="ph-quick-ranges">
                                        {[[7,'Last 7 Days'],[30,'Last 30 Days'],[90,'Last 90 Days'],[365,'Last Year']].map(([days, label]) => (
                                            <button key={days} className="ph-qr-btn" onClick={() => setQuickRange(days)}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="ph-date-range-grid">
                                        <div className="ph-fg">
                                            <label>From Date</label>
                                            <input className="ph-input" type="date" value={dateFrom}
                                                max={dateTo} onChange={e => setDateFrom(e.target.value)} />
                                        </div>
                                        <div className="ph-fg">
                                            <label>To Date</label>
                                            <input className="ph-input" type="date" value={dateTo}
                                                min={dateFrom} max={new Date().toISOString().split('T')[0]}
                                                onChange={e => setDateTo(e.target.value)} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="ph-report-summary-bar">
                                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <FileText size={14} color="#1a6b3c" />
                                    <strong style={{ color: '#1a6b3c' }}>{selReport.label}</strong>
                                </span>
                                <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                                    {dateMode === 'single' ? fmtDate(singleDate) : `${fmtDate(effectiveFrom)} — ${fmtDate(effectiveTo)}`}
                                </span>
                            </div>

                            <button className="ph-btn-primary ph-btn-full"
                                onClick={generateReport} disabled={generating}>
                                {generating
                                    ? <><div className="ph-btn-spin" />Generating…</>
                                    : <><BarChart3 size={15} /> Generate Report</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3 */}
            {reportResult && (
                <div className="ph-report-step">
                    <div className="ph-report-step-label">
                        <span className="ph-step-num">3</span> Report Ready
                    </div>
                    <div className="ph-report-result">
                        <div className="ph-rr-header">
                            <div className="ph-rr-title-wrap">
                                <div className="ph-rr-icon"><FileText size={19} /></div>
                                <div>
                                    <div className="ph-rr-name">{reportResult.title}</div>
                                    <div className="ph-rr-meta">
                                        Period: {fmtDate(reportResult.from)} — {fmtDate(reportResult.to)}
                                        &nbsp;·&nbsp; Generated: {fmtDTime(new Date())}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 9 }}>
                                <button className="ph-btn-ghost ph-btn-sm"
                                    onClick={() => openReportTab(reportResult.title, reportResult.from, reportResult.to, reportResult.html)}>
                                    <ExternalLink size={13} /> View Report
                                </button>
                                <button className="ph-btn-primary ph-btn-sm"
                                    onClick={() => downloadReportHTML(reportResult.title, reportResult.from, reportResult.to, reportResult.html)}>
                                    <Download size={13} /> Download
                                </button>
                            </div>
                        </div>
                        <div className="ph-rr-preview-head"><FileText size={12} /> Preview</div>
                        <div className="ph-rr-preview" dangerouslySetInnerHTML={{ __html: reportResult.html }} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MY PROFILE
// ══════════════════════════════════════════════════════════════════════════════
function PharmacistProfile({ user }) {
    const [editing, setEditing] = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [pwMode,  setPwMode]  = useState(false);
    const [showPw,  setShowPw]  = useState(false);
    const [form,    setForm]    = useState({
        first_name: user?.full_name?.split(' ')[0] || '',
        surname:    user?.full_name?.split(' ').slice(1).join(' ') || '',
        phone:      user?.phone || '',
    });
    const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const r = await fetch(`${API}/doctor/update-profile`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: user?.staff_id, ...form })
            });
            const d = await r.json();
            if (d.success) { toast.success('Profile updated.'); setEditing(false); }
            else toast.error(d.message || 'Save failed.');
        } catch { toast.error('Server error.'); }
        finally   { setSaving(false); }
    };

    const handlePwChange = async () => {
        if (pw.next !== pw.confirm) { toast.error('Passwords do not match.'); return; }
        if (pw.next.length < 6)     { toast.error('Minimum 6 characters.'); return; }
        setSaving(true);
        try {
            const r = await fetch(`${API}/doctor/change-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: user?.staff_id, current: pw.current, next: pw.next })
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Password changed.');
                setPw({ current: '', next: '', confirm: '' });
                setPwMode(false);
            } else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
        finally   { setSaving(false); }
    };

    return (
        <div className="ph-section">
            <div className="ph-profile-banner">
                <div className="ph-profile-ava">{(user?.full_name || 'P')[0].toUpperCase()}</div>
                <div>
                    <h2>{user?.full_name || 'Pharmacist'}</h2>
                    <p>Staff ID: {user?.staff_id} · Pharmacist</p>
                </div>
                <button className={`ph-btn-ghost ${editing ? 'danger' : ''}`}
                    onClick={() => setEditing(e => !e)}>
                    {editing ? <><X size={14} /> Cancel</> : <><Edit3 size={14} /> Edit Profile</>}
                </button>
            </div>

            <div className="ph-card">
                <div className="ph-card-head"><h3><User size={14} /> Professional Details</h3></div>
                <div className="ph-profile-grid">
                    <div className="ph-fg">
                        <label>Email (Username)</label>
                        <div className="ph-locked">{user?.username || user?.email || '—'}<Lock size={11} /></div>
                    </div>
                    <div className="ph-fg">
                        <label>Staff ID</label>
                        <div className="ph-locked">{user?.staff_id || '—'}<Lock size={11} /></div>
                    </div>
                    {[
                        { label: 'First Name', key: 'first_name' },
                        { label: 'Surname',    key: 'surname'    },
                        { label: 'Phone',      key: 'phone'      },
                    ].map(f => (
                        <div key={f.key} className="ph-fg">
                            <label>{f.label}</label>
                            {editing
                                ? <input className="ph-input" value={form[f.key]} onChange={set(f.key)} />
                                : <div className="ph-profile-val">{form[f.key] || <span className="ph-empty-val">Not set</span>}</div>}
                        </div>
                    ))}
                </div>
                {editing && (
                    <div style={{ padding: '0 18px 18px' }}>
                        <button className="ph-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="ph-btn-spin" />Saving…</> : <><Save size={13} /> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="ph-card">
                <div className="ph-card-head">
                    <h3><Lock size={14} /> Change Password</h3>
                    <button className="ph-btn-ghost" onClick={() => setPwMode(m => !m)}>
                        {pwMode ? 'Cancel' : 'Change Password'}
                    </button>
                </div>
                {pwMode && (
                    <div className="ph-pw-form">
                        {[
                            { label: 'Current Password',     key: 'current' },
                            { label: 'New Password',         key: 'next'    },
                            { label: 'Confirm New Password', key: 'confirm' },
                        ].map(f => (
                            <div key={f.key} className="ph-fg">
                                <label>{f.label}</label>
                                <input className="ph-input" type={showPw ? 'text' : 'password'}
                                    value={pw[f.key]}
                                    onChange={e => setPw(p => ({ ...p, [f.key]: e.target.value }))} />
                            </div>
                        ))}
                        <label className="ph-show-pw-label">
                            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />
                            Show passwords
                        </label>
                        <button className="ph-btn-primary" onClick={handlePwChange} disabled={saving}>
                            {saving ? <><div className="ph-btn-spin" />Saving…</> : <><Shield size={13} /> Update Password</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
function PharmacistNotifications({ user }) {
    const [notifs,  setNotifs]  = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.staff_id) { setLoading(false); return; }
        fetch(`${API}/staff/notifications/${user.staff_id}`)
            .then(r => r.json())
            .then(d => setNotifs(d.notifications || []))
            .catch(() => setNotifs([]))
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="ph-section">
            <div className="ph-section-head">
                <div>
                    <h2>Notifications</h2>
                    <p>{notifs.length} message{notifs.length !== 1 ? 's' : ''}</p>
                </div>
            </div>
            {loading ? <Spinner />
            : notifs.length === 0 ? <Empty icon={Bell} text="No notifications." />
            : (
                <div className="ph-notif-list">
                    {notifs.map((n, i) => (
                        <div key={n.notification_id || i}
                            className={`ph-card ph-notif-card ${n.status === 'sent' ? 'unread' : ''}`}>
                            <div className="ph-notif-icon"><Bell size={15} /></div>
                            <div className="ph-notif-body">
                                <div className="ph-notif-title">{n.email_subject || 'Notification'}</div>
                                <div className="ph-notif-msg">{n.message}</div>
                                <span className="ph-notif-time">{fmtDTime(n.sent_at)}</span>
                            </div>
                            <span className={`ph-badge ph-badge-${n.status}`}>{n.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════
function PharmacistFeedback({ user }) {
    const [comment,   setComment]   = useState('');
    const [saving,    setSaving]    = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [history,   setHistory]   = useState([]);
    const [loadingH,  setLoadingH]  = useState(true);

    const loadHistory = useCallback(async () => {
        if (!user?.staff_id) { setLoadingH(false); return; }
        try {
            const r = await fetch(`${API}/staff/feedback/${user.staff_id}`);
            const d = await r.json();
            if (d.success) setHistory(d.feedback || []);
        } catch {}
        finally { setLoadingH(false); }
    }, [user?.staff_id]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!comment.trim()) { toast.error('Please write your feedback.'); return; }
        setSaving(true);
        try {
            const r = await fetch(`${API}/staff/feedback`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: user?.staff_id, comment: comment.trim() })
            });
            const d = await r.json();
            if (d.success) {
                setSubmitted(true); setComment('');
                loadHistory();
                setTimeout(() => setSubmitted(false), 4000);
            } else toast.error(d.message || 'Submit failed.');
        } catch { toast.error('Server error.'); }
        finally   { setSaving(false); }
    };

    return (
        <div className="ph-section">
            <div className="ph-section-head">
                <div>
                    <h2>Feedback</h2>
                    <p>Share suggestions or concerns about the pharmacy system</p>
                </div>
            </div>

            {submitted && (
                <div className="ph-success-banner">
                    <CheckCircle2 size={15} /> Thank you — your feedback was submitted.
                </div>
            )}

            <div className="ph-card" style={{ maxWidth: 600, marginBottom: 20 }}>
                <div className="ph-card-head"><h3><MessageSquare size={14} /> Submit Feedback</h3></div>
                <form onSubmit={handleSubmit} style={{ padding: 16 }}>
                    <div className="ph-fg" style={{ marginBottom: 14 }}>
                        <label>Your Comments</label>
                        <textarea className="ph-input ph-ta" rows={5} value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Describe any issues, workflow suggestions, or improvements for the pharmacy system…" />
                    </div>
                    <button type="submit" className="ph-btn-primary" disabled={saving || !comment.trim()}>
                        {saving ? <><div className="ph-btn-spin" /> Submitting…</> : <><Send size={14} /> Submit Feedback</>}
                    </button>
                </form>
            </div>

            {!loadingH && history.length > 0 && (
                <div className="ph-card">
                    <div className="ph-card-head">
                        <h3><FileText size={13} /> Your Past Feedback</h3>
                        <span className="ph-badge ph-badge-blue">{history.length}</span>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                        {history.map((f, i) => (
                            <div key={f.feedback_id || i} className="ph-feedback-item">
                                <div className="ph-feedback-meta">
                                    <span className="ph-notif-time">
                                        {fmtDTime(f.date_submitted || f.submitted_at || f.created_at)}
                                    </span>
                                    {f.status && (
                                        <span className={`ph-badge ph-badge-${
                                            f.status === 'resolved' ? 'green' :
                                            f.status === 'reviewed' ? 'blue'  : 'amber'}`}>
                                            {f.status}
                                        </span>
                                    )}
                                </div>
                                <p className="ph-feedback-comment">"{f.comment}"</p>
                                {f.admin_note && (
                                    <div className="ph-admin-note">
                                        <strong>Admin response:</strong> {f.admin_note}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}