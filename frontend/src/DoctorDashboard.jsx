import React, { useState, useEffect, useCallback, useRef } from 'react';
import './common.css';
import './DoctorDashboard.css';
import { useNavigate } from 'react-router-dom';
import {
    Home, User, Bell, MessageSquare, LogOut, Search, ScanBarcode,
    ClipboardList, Stethoscope, FlaskConical, Share2, FileText,
    CheckCircle2, Clock, Calendar, ChevronRight, X, RefreshCw,
    Activity, Shield, Edit3, Save, Lock, Send, AlertCircle,
    AlertTriangle, Pill, Plus, Trash2, Users, Phone,
    Droplets, Heart, Microscope, FilePlus2, ClipboardCheck,
    Building2, ArrowRight, ChevronDown, ChevronUp, Pencil
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

const API = 'http://127.0.0.1:5001/api';

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtDTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : '—';
const fmtTime  = t => {
    if (!t) return '—';
    const [h, m] = t.toString().split(':');
    const hr = parseInt(h);
    return `${String(hr % 12 || 12).padStart(2,'0')}:${m || '00'} ${hr < 12 ? 'AM' : 'PM'}`;
};
const calcAge = dob => {
    if (!dob) return null;
    const d = new Date(dob), n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a;
};

const Spinner  = () => <div className="doc-loading"><div className="doc-spinner"/></div>;
const Empty    = ({ icon: Icon, text }) => (
    <div className="doc-empty"><Icon size={28} strokeWidth={1.4} style={{opacity:.3}}/><p>{text}</p></div>
);

// ─── ALLERGY ALERT ───────────────────────────────────────────────────────────
function AllergyAlert({ allergies }) {
    if (!allergies || allergies.toLowerCase() === 'none') return null;
    return (
        <div className="doc-allergy-alert">
            <AlertTriangle size={15}/>
            <strong>ALLERGIES:</strong> {allergies}
        </div>
    );
}

// ─── PATIENT HEADER CARD ─────────────────────────────────────────────────────
function PatientHeaderCard({ patient, onClear }) {
    const age = calcAge(patient.dob);
    return (
        <div className="doc-patient-header">
            <div className="doc-patient-avatar">
                {(patient.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="doc-patient-header-info">
                <h2>{patient.full_name}</h2>
                <div className="doc-patient-meta">
                    {age !== null && <span><User size={12}/> {age} yrs</span>}
                    {patient.gender && <span>{patient.gender}</span>}
                    {patient.blood_group && <span><Droplets size={12}/> {patient.blood_group}</span>}
                    {patient.nic && <span><Shield size={12}/> {patient.nic}</span>}
                    {patient.phone && <span><Phone size={12}/> {patient.phone}</span>}
                    <span className="doc-barcode-chip">{patient.barcode}</span>
                </div>
                <AllergyAlert allergies={patient.allergies}/>
            </div>
            {onClear && (
                <button className="doc-btn-ghost doc-btn-sm" onClick={onClear}>
                    <X size={14}/> Change Patient
                </button>
            )}
        </div>
    );
}

// ─── PATIENT LOOKUP ──────────────────────────────────────────────────────────
// NIC and Barcode only — name removed per request
function PatientLookup({ onSelect }) {
    const [nicQuery,    setNicQuery]    = useState('');
    const [results,     setResults]     = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [searched,    setSearched]    = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const nicRef = useRef(null);

    // Search by NIC
    const doNicSearch = useCallback(async (q) => {
        if (!q?.trim()) return;
        setLoading(true); setSearched(true); setResults([]);
        try {
            const r = await fetch(`${API}/doctor/patient-lookup?mode=nic&q=${encodeURIComponent(q.trim())}`);
            const d = await r.json();
            if (d.success) setResults(d.patients || []);
        } catch { setResults([]); }
        finally { setLoading(false); }
    }, []);

    // Called when webcam detects a barcode — search by barcode immediately
    const handleScanDetected = useCallback(async (code) => {
        setScannerOpen(false);
        setSearched(true); setLoading(true); setResults([]);
        try {
            const r = await fetch(`${API}/doctor/patient-lookup?mode=barcode&q=${encodeURIComponent(code.trim())}`);
            const d = await r.json();
            const list = d.success ? (d.patients || []) : [];
            if (list.length === 1) {
                // Single match — go straight to consultation
                onSelect(list[0]);
            } else {
                setResults(list);
            }
        } catch { setResults([]); }
        finally { setLoading(false); }
    }, [onSelect]);

    return (
        <div className="lk-wrap">
            <div className="lk-title">
                <Stethoscope size={18} color="#0d9488"/>
                <h2>Patient Lookup</h2>
            </div>

            {/* ── Two method tiles ── */}
            <div className="lk-methods">

                {/* Tile 1 — Scan barcode */}
                <button className="lk-tile lk-tile-scan" onClick={() => setScannerOpen(true)}>
                    <div className="lk-tile-icon">
                        <ScanBarcode size={28} strokeWidth={1.4}/>
                    </div>
                    <div className="lk-tile-text">
                        <strong>Scan Barcode</strong>
                        <span>Use device camera to scan the patient card</span>
                    </div>
                    <ChevronRight size={18} className="lk-tile-arrow"/>
                </button>

                {/* Tile 2 — Search by NIC */}
                <div className="lk-tile lk-tile-nic">
                    <div className="lk-tile-icon lk-icon-nic">
                        <Shield size={24} strokeWidth={1.4}/>
                    </div>
                    <div className="lk-tile-body">
                        <strong>Search by NIC</strong>
                        <div className="lk-nic-row">
                            <div className="lk-nic-input-wrap">
                                <input
                                    ref={nicRef}
                                    className="lk-nic-input"
                                    placeholder="e.g. 199012345678"
                                    value={nicQuery}
                                    onChange={e => { setNicQuery(e.target.value); setSearched(false); setResults([]); }}
                                    onKeyDown={e => { if (e.key === 'Enter') doNicSearch(nicQuery); }}
                                />
                                {nicQuery && (
                                    <button className="lk-nic-clear" onClick={() => { setNicQuery(''); setResults([]); setSearched(false); }}>
                                        <X size={13}/>
                                    </button>
                                )}
                            </div>
                            <button
                                className="lk-nic-search-btn"
                                onClick={() => doNicSearch(nicQuery)}
                                disabled={loading || !nicQuery.trim()}>
                                {loading ? <div className="doc-btn-spin"/> : <Search size={14}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Results ── */}
            {searched && !loading && results.length === 0 && (
                <div className="lk-empty">
                    <AlertCircle size={18} style={{opacity:.35}}/>
                    <span>No patient found. Check the NIC or try scanning the barcode.</span>
                </div>
            )}

            {results.length > 0 && (
                <div className="lk-results">
                    {results.length > 1 && (
                        <div className="lk-multi-notice">
                            <Users size={13}/> {results.length} patients found — select the correct one:
                        </div>
                    )}
                    {results.map(p => {
                        const age = calcAge(p.dob);
                        return (
                            <div key={p.patient_id} className="lk-result-row" onClick={() => onSelect(p)}>
                                <div className="lk-result-ava">
                                    {(p.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                                </div>
                                <div className="lk-result-info">
                                    <div className="lk-result-name">{p.full_name}</div>
                                    <div className="lk-result-meta">
                                        {age !== null && <span>{age} yrs</span>}
                                        {p.gender      && <span>{p.gender}</span>}
                                        {p.blood_group && <span className="lk-blood">{p.blood_group}</span>}
                                        {p.nic         && <span className="lk-nic-chip">{p.nic}</span>}
                                        <span className="lk-bc-chip">{p.barcode}</span>
                                    </div>
                                    {p.allergies && p.allergies.toLowerCase() !== 'none' && (
                                        <div className="lk-allergy"><AlertTriangle size={11}/> {p.allergies}</div>
                                    )}
                                </div>
                                <ChevronRight size={16} style={{color:'#94a3b8',flexShrink:0}}/>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Barcode scanner modal */}
            {scannerOpen && (
                <BarcodeScanner
                    onDetected={handleScanDetected}
                    onClose={() => setScannerOpen(false)}
                />
            )}
        </div>
    );
}

// ─── TODAY'S QUEUE (Home) ────────────────────────────────────────────────────
function DoctorHome({ user, onSelectPatient }) {
    const [queue,   setQueue]   = useState([]);
    const [stats,   setStats]   = useState({ today: 0, completed: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const load = useCallback(async () => {
        if (!user?.staff_id) return;
        setLoading(true);
        try {
            const r = await fetch(`${API}/doctor/today-queue?staffId=${user.staff_id}`);
            const d = await r.json();
            if (d.success) {
                setQueue(d.queue || []);
                const q = d.queue || [];
                setStats({
                    today:     q.length,
                    completed: q.filter(a => a.status === 'completed').length,
                    pending:   q.filter(a => a.status === 'booked').length,
                });
            }
        } catch {}
        finally { setLoading(false); }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const statusColor = s => ({ booked:'#2563eb', completed:'#16a34a', cancelled:'#94a3b8', no_show:'#d97706' }[s] || '#94a3b8');
    const statusBg    = s => ({ booked:'#eff6ff', completed:'#f0fdf4', cancelled:'#f8fafc', no_show:'#fffbeb' }[s] || '#f8fafc');

    return (
        <div className="doc-section">
            <div className="doc-hero">
                <div>
                    <h1 className="doc-hero-title">Good day, Dr. {user?.full_name?.split(' ')[0] || 'Doctor'}</h1>
                    <p className="doc-hero-sub">{today}</p>
                </div>
                <button className="doc-btn-ghost" onClick={load}><RefreshCw size={14}/> Refresh</button>
            </div>

            <div className="doc-stat-grid">
                {[
                    { label: "Today's Appointments", val: stats.today,     color: 'blue',  icon: Calendar },
                    { label: 'Completed',             val: stats.completed, color: 'green', icon: CheckCircle2 },
                    { label: 'Still Pending',         val: stats.pending,   color: 'amber', icon: Clock },
                ].map(s => (
                    <div key={s.label} className={`doc-stat doc-stat-${s.color}`}>
                        <div className="doc-stat-icon"><s.icon size={20}/></div>
                        <div>
                            <div className="doc-stat-val">{s.val}</div>
                            <div className="doc-stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="doc-card">
                <div className="doc-card-head">
                    <h3><Calendar size={14}/> Today's Patient Queue</h3>
                </div>
                {loading ? <Spinner/> : queue.length === 0
                    ? <Empty icon={Calendar} text="No appointments scheduled for today."/>
                    : (
                        <table className="doc-table">
                            <thead><tr>
                                <th>Token</th><th>Patient</th><th>Time Slot</th>
                                <th>Visit Type</th><th>Status</th><th>Action</th>
                            </tr></thead>
                            <tbody>
                                {queue.map(a => (
                                    <tr key={a.appointment_id} className={a.status === 'booked' ? 'doc-row-pending' : ''}>
                                        <td><span className="doc-token">#{a.queue_no}</span></td>
                                        <td>
                                            <div className="doc-name-cell">
                                                <div className="doc-ava-sm">
                                                    {(a.patient_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                                                </div>
                                                <div>
                                                    <strong>{a.patient_name || '—'}</strong>
                                                    {a.allergies && a.allergies.toLowerCase() !== 'none' && (
                                                        <span className="doc-allergy-flag" title={`Allergies: ${a.allergies}`}>
                                                            <AlertTriangle size={11}/>
                                                        </span>
                                                    )}
                                                    <div className="doc-meta-sm">{a.patient_barcode}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="doc-mono">{fmtTime(a.start_time)} – {fmtTime(a.end_time)}</td>
                                        <td>{a.visit_type}</td>
                                        <td>
                                            <span className="doc-badge"
                                                style={{ background: statusBg(a.status), color: statusColor(a.status) }}>
                                                {a.status.replace('_',' ')}
                                            </span>
                                        </td>
                                        <td>
                                            {a.patient_id && (
                                                <button className="doc-btn-primary doc-btn-sm"
                                                    onClick={() => onSelectPatient({
                                                        patient_id:    a.patient_id,
                                                        full_name:     a.patient_name,
                                                        barcode:       a.patient_barcode,
                                                        allergies:     a.allergies,
                                                        blood_group:   a.blood_group,
                                                        dob:           a.dob,
                                                        gender:        a.gender,
                                                        nic:           a.nic,
                                                        phone:         a.phone,
                                                        appointment_id: a.appointment_id,
                                                    })}>
                                                    Open Patient
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                }
            </div>
        </div>
    );
}

// ─── PRESCRIPTION ROW BUILDER ─────────────────────────────────────────────────
// Each medication is a structured row: drug name, dose, route, frequency, duration, notes
function PrescriptionBuilder({ rows, onChange }) {
    const ROUTES = ['Oral','IV','IM','SC','Topical','Inhalation','Sublingual','Rectal','Other'];
    const FREQS  = ['OD','BD','TDS','QDS','SOS','Nocte','Stat','Weekly','Other'];

    const update = (i, field, val) => {
        const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
        onChange(next);
    };
    const addRow    = () => onChange([...rows, emptyRxRow()]);
    const removeRow = i  => onChange(rows.filter((_, idx) => idx !== i));

    return (
        <div className="doc-rx-builder">
            {rows.map((row, i) => (
                <div key={i} className="doc-rx-row-card">
                    <div className="doc-rx-row-num">{i + 1}</div>
                    <div className="doc-rx-fields">
                        <div className="doc-rx-field-group">
                            <div className="doc-fg">
                                <label className="doc-field-label">Drug Name <span style={{color:'var(--red)'}}>*</span></label>
                                <input className="doc-input" placeholder="e.g. Paracetamol, Amoxicillin"
                                    value={row.drug} onChange={e => update(i, 'drug', e.target.value)}/>
                            </div>
                            <div className="doc-fg doc-fg-sm">
                                <label className="doc-field-label">Dose / Strength</label>
                                <input className="doc-input" placeholder="e.g. 500mg, 250mg/5ml"
                                    value={row.dose} onChange={e => update(i, 'dose', e.target.value)}/>
                            </div>
                        </div>
                        <div className="doc-rx-field-group">
                            <div className="doc-fg doc-fg-sm">
                                <label className="doc-field-label">Route</label>
                                <select className="doc-input" value={row.route}
                                    onChange={e => update(i, 'route', e.target.value)}>
                                    {ROUTES.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="doc-fg doc-fg-sm">
                                <label className="doc-field-label">Frequency</label>
                                <select className="doc-input" value={row.freq}
                                    onChange={e => update(i, 'freq', e.target.value)}>
                                    {FREQS.map(f => <option key={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="doc-fg doc-fg-sm">
                                <label className="doc-field-label">Duration</label>
                                <input className="doc-input" placeholder="e.g. 5 days, 1 week"
                                    value={row.duration} onChange={e => update(i, 'duration', e.target.value)}/>
                            </div>
                        </div>
                        <div className="doc-fg">
                            <label className="doc-field-label">Special Instructions (optional)</label>
                            <input className="doc-input" placeholder="e.g. Take after meals, avoid sunlight"
                                value={row.notes} onChange={e => update(i, 'notes', e.target.value)}/>
                        </div>
                    </div>
                    {rows.length > 1 && (
                        <button type="button" className="doc-rx-remove" onClick={() => removeRow(i)} title="Remove">
                            <Trash2 size={14}/>
                        </button>
                    )}
                </div>
            ))}
            <button type="button" className="doc-btn-ghost doc-btn-sm doc-rx-add"
                onClick={addRow}>
                <Plus size={14}/> Add Another Medication
            </button>
        </div>
    );
}

const emptyRxRow = () => ({ drug:'', dose:'', route:'Oral', freq:'BD', duration:'', notes:'' });

// Serialize prescription rows to a readable string for DB storage
const serializeRx = rows =>
    rows.filter(r => r.drug.trim()).map((r, i) =>
        `${i+1}. ${r.drug}${r.dose ? ` ${r.dose}` : ''} — ${r.route} ${r.freq}${r.duration ? ` × ${r.duration}` : ''}${r.notes ? `\n   (${r.notes})` : ''}`
    ).join('\n');

// ─── LAB FINDINGS MODAL ───────────────────────────────────────────────────────
function LabFindingsModal({ test, patientId, onClose, onSaved }) {
    const [findings, setFindings] = useState(test.doctor_findings || '');
    const [saving,   setSaving]   = useState(false);

    const handleSave = async () => {
        if (!findings.trim()) return alert('Please enter findings or decision.');
        setSaving(true);
        try {
            const r = await fetch(`${API}/doctor/lab-findings`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ test_id: test.test_id, patient_id: patientId, doctor_findings: findings.trim() })
            });
            const d = await r.json();
            if (d.success) { onSaved(); onClose(); }
            else alert(d.message || 'Failed to save findings.');
        } catch { alert('Server error.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="doc-modal-overlay" onClick={onClose}>
            <div className="doc-modal" onClick={e => e.stopPropagation()}>
                <div className="doc-modal-head">
                    <div>
                        <h3><Microscope size={15}/> Doctor's Findings</h3>
                        <p className="doc-modal-sub">{test.test_name} · {test.test_type}</p>
                    </div>
                    <button className="doc-modal-close" onClick={onClose}><X size={16}/></button>
                </div>

                {/* Show lab result if available */}
                {test.result_summary && (
                    <div className="doc-modal-result-block">
                        <label className="doc-field-label">Lab Result / Report</label>
                        <div className="doc-lab-result-text">{test.result_summary}</div>
                    </div>
                )}

                <div className="doc-modal-body">
                    <div className="doc-fg">
                        <label className="doc-field-label">
                            Doctor's Findings / Decision <span style={{color:'var(--red)'}}>*</span>
                        </label>
                        <textarea className="doc-input doc-ta" rows={5}
                            placeholder="Enter your interpretation of the result, clinical decision, or follow-up action…"
                            value={findings} onChange={e => setFindings(e.target.value)}
                            autoFocus/>
                    </div>
                </div>
                <div className="doc-modal-footer">
                    <button className="doc-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="doc-btn-primary" onClick={handleSave} disabled={saving || !findings.trim()}>
                        {saving ? <><div className="doc-btn-spin"/>Saving…</> : <><Save size={14}/> Save Findings</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CONSULTATION SESSION ─────────────────────────────────────────────────────
function ConsultationSession({ user, patient, appointmentId: propApptId }) {
    const [appointments,  setAppointments]  = useState([]);
    const [apptId,        setApptId]        = useState(propApptId || '');
    const [apptLocked,    setApptLocked]    = useState(!!propApptId);
    // Panels: 'treatment' | 'tests' | 'referral'
    const [activePanel,   setActivePanel]   = useState('treatment');

    // Treatment form
    const [treatForm, setTreatForm] = useState({
        weight_kg:'', height_cm:'', chief_complaint:'', clinical_findings:'',
        diagnosis:'', treatment_details:'', follow_up_date:'',
    });
    const [rxRows,      setRxRows]      = useState([emptyRxRow()]);
    const [treatSaving, setTreatSaving] = useState(false);
    const [treatDone,   setTreatDone]   = useState(false);
    const setT = k => e => setTreatForm(f => ({ ...f, [k]: e.target.value }));

    // Tests
    const [tests,          setTests]          = useState([{ test_name:'', test_type:'Lab', specimen:'', priority:'Routine', clinical_info:'' }]);
    const [existingTests,  setExistingTests]  = useState([]);
    const [testSaving,     setTestSaving]     = useState(false);
    const [testDone,       setTestDone]       = useState(false);
    const [findingsModal,  setFindingsModal]  = useState(null); // test object

    // Referral
    const [refForm, setRefForm] = useState({
        target_clinic:'', consultant_name:'', department:'',
        urgency:'Routine', reason:'', clinical_summary:'', contact_no:''
    });
    const [refHistory, setRefHistory] = useState([]);
    const [refSaving,  setRefSaving]  = useState(false);
    const [refDone,    setRefDone]    = useState(false);
    const setR = k => e => setRefForm(f => ({ ...f, [k]: e.target.value }));

    const TEST_TYPES     = ['Lab','Imaging','ECG','Biopsy','Microbiology','Other'];
    const PRIORITIES     = ['Routine','Urgent','STAT'];
    const DEPARTMENTS    = ['Cardiology','Neurology','Orthopaedics','Oncology','Paediatrics','Obstetrics & Gynaecology','ENT','Ophthalmology','Urology','Nephrology','Psychiatry','General Surgery','Other'];
    const urgencyStyle   = { Routine:{bg:'#f0fdf4',color:'#166534'}, Urgent:{bg:'#fff7ed',color:'#9a3412'}, Emergency:{bg:'#fef2f2',color:'#991b1b'} };
    const statusColor    = { requested:'#2563eb', in_progress:'#d97706', completed:'#16a34a', cancelled:'#94a3b8' };
    const statusBg       = { requested:'#eff6ff', in_progress:'#fffbeb', completed:'#f0fdf4', cancelled:'#f8fafc' };

    useEffect(() => {
        if (!patient?.patient_id) return;
        Promise.all([
            fetch(`${API}/doctor/patient-appointments/${patient.patient_id}`).then(r=>r.json()),
            fetch(`${API}/lab-results/${patient.patient_id}`).then(r=>r.json()),
            fetch(`${API}/referrals/${patient.patient_id}`).then(r=>r.json()),
        ]).then(([apptData, labData, refData]) => {
            if (apptData.success) setAppointments(apptData.appointments || []);
            if (labData.success)  setExistingTests(labData.tests || []);
            if (refData.success)  setRefHistory(refData.referrals || []);
        }).catch(() => {});
    }, [patient]);

    useEffect(() => {
        if (propApptId) { setApptId(propApptId); setApptLocked(true); }
    }, [propApptId]);

    const refreshTestsAndReferrals = () => {
        if (!patient?.patient_id) return;
        fetch(`${API}/lab-results/${patient.patient_id}`).then(r=>r.json())
            .then(d => { if (d.success) setExistingTests(d.tests || []); });
        fetch(`${API}/referrals/${patient.patient_id}`).then(r=>r.json())
            .then(d => { if (d.success) setRefHistory(d.referrals || []); });
    };

    const selectedAppt = appointments.find(a => String(a.appointment_id) === String(apptId));

    const handleSaveTreatment = async e => {
        e.preventDefault();
        if (!apptId) return alert('Please select an appointment first.');
        if (!treatForm.diagnosis.trim()) return alert('Diagnosis is required.');
        const rxString = serializeRx(rxRows);
        setTreatSaving(true);
        try {
            const r = await fetch(`${API}/doctor/treatment-record`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appointment_id: apptId, patient_id: patient.patient_id, staff_id: user.staff_id,
                    ...treatForm,
                    prescription_details: rxString || null
                })
            });
            const d = await r.json();
            if (d.success) {
                setTreatDone(true); setApptLocked(true);
                setTreatForm({ weight_kg:'', height_cm:'', chief_complaint:'', clinical_findings:'', diagnosis:'', treatment_details:'', follow_up_date:'' });
                setRxRows([emptyRxRow()]);
                setTimeout(() => setTreatDone(false), 4000);
            } else alert(d.message || 'Save failed.');
        } catch { alert('Server error.'); }
        finally { setTreatSaving(false); }
    };

    const handleOrderTests = async e => {
        e.preventDefault();
        if (!apptId) return alert('Select an appointment first.');
        const valid = tests.filter(t => t.test_name.trim());
        if (!valid.length) return alert('Enter at least one test name.');
        setTestSaving(true);
        try {
            const r = await fetch(`${API}/doctor/order-tests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment_id: apptId, patient_id: patient.patient_id, staff_id: user.staff_id, tests: valid })
            });
            const d = await r.json();
            if (d.success) {
                setTestDone(true);
                setTests([{ test_name:'', test_type:'Lab', specimen:'', priority:'Routine', clinical_info:'' }]);
                refreshTestsAndReferrals();
                setTimeout(() => setTestDone(false), 3500);
            } else alert(d.message || 'Failed.');
        } catch { alert('Server error.'); }
        finally { setTestSaving(false); }
    };

    const handleIssueReferral = async e => {
        e.preventDefault();
        if (!apptId) return alert('Select an appointment first.');
        if (!refForm.target_clinic.trim() || !refForm.reason.trim()) return alert('Target clinic/hospital and reason are required.');
        setRefSaving(true);
        try {
            const r = await fetch(`${API}/doctor/referral`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...refForm, appointment_id: apptId, patient_id: patient.patient_id, staff_id: user.staff_id })
            });
            const d = await r.json();
            if (d.success) {
                setRefDone(true);
                setRefForm({ target_clinic:'', consultant_name:'', department:'', urgency:'Routine', reason:'', clinical_summary:'', contact_no:'' });
                refreshTestsAndReferrals();
                setTimeout(() => setRefDone(false), 3500);
            } else alert(d.message || 'Failed.');
        } catch { alert('Server error.'); }
        finally { setRefSaving(false); }
    };

    const updateTestRow = (i, field, val) =>
        setTests(ts => ts.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

    return (
        <div className="doc-section">
            <PatientHeaderCard patient={patient}/>

            {/* ── APPOINTMENT SELECTOR ─────────────────────────────── */}
            <div className="doc-appt-selector-card">
                <div className="doc-appt-selector-left">
                    <Calendar size={16} color="#0d9488"/>
                    <div>
                        <div className="doc-appt-selector-label">
                            {apptLocked ? 'Appointment' : 'Select Appointment'}
                            {apptLocked && <span className="doc-appt-locked-tag">Locked</span>}
                        </div>
                        {apptLocked && selectedAppt ? (
                            <div className="doc-appt-selector-val">
                                <strong>{fmtDate(selectedAppt.appointment_day)}</strong>
                                {' · '}{fmtTime(selectedAppt.start_time)}
                                {' · '}Token #{selectedAppt.queue_no}
                                {' · '}{selectedAppt.visit_type}
                            </div>
                        ) : (
                            <select className="doc-appt-inline-select"
                                value={apptId} onChange={e => { setApptId(e.target.value); setApptLocked(false); }}>
                                <option value="">— Choose appointment —</option>
                                {appointments.filter(a => ['booked','active','completed'].includes(a.status)).map(a => (
                                    <option key={a.appointment_id} value={a.appointment_id}>
                                        {fmtDate(a.appointment_day)} · {fmtTime(a.start_time)} · Token #{a.queue_no} · {a.visit_type}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
                {apptLocked && (
                    <button className="doc-btn-ghost doc-btn-sm" onClick={() => setApptLocked(false)}>
                        <X size={13}/> Change
                    </button>
                )}
            </div>

            {/* ── CONSULTATION FLOW PANELS ──────────────────────────── */}
            {/* Step 1 always visible. Steps 2 & 3 shown after patient record is retrieved */}
            <div className="doc-panel-tabs">
                {[
                    { id:'treatment', label:'1. Treatment Record', icon:Stethoscope },
                    { id:'tests',     label:'2. Order Tests',      icon:FlaskConical },
                    { id:'referral',  label:'3. Issue Referral',   icon:Share2 },
                ].map(p => (
                    <button key={p.id}
                        className={`doc-panel-tab ${activePanel === p.id ? 'active' : ''}`}
                        onClick={() => setActivePanel(p.id)}>
                        <p.icon size={14}/>
                        {p.label}
                        {p.id === 'tests' && existingTests.length > 0 && (
                            <span className="doc-panel-badge">{existingTests.length}</span>
                        )}
                        {p.id === 'referral' && refHistory.length > 0 && (
                            <span className="doc-panel-badge">{refHistory.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── TREATMENT RECORD PANEL ──────────────────────────── */}
            {activePanel === 'treatment' && (
                <div className="doc-panel-body">
                    {treatDone && (
                        <div className="doc-success-banner">
                            <CheckCircle2 size={16}/>
                            Treatment record saved. You may now order tests or issue a referral using the tabs above.
                        </div>
                    )}
                    <form onSubmit={handleSaveTreatment} className="doc-form-stack">
                        {/* Vitals */}
                        <div className="doc-card">
                            <div className="doc-card-head"><h3><Activity size={13}/> Vitals</h3></div>
                            <div className="doc-form-grid" style={{padding:'16px'}}>
                                <div className="doc-fg">
                                    <label className="doc-field-label">Weight (kg)</label>
                                    <input type="number" className="doc-input" placeholder="e.g. 65"
                                        value={treatForm.weight_kg} onChange={setT('weight_kg')}/>
                                </div>
                                <div className="doc-fg">
                                    <label className="doc-field-label">Height (cm)</label>
                                    <input type="number" className="doc-input" placeholder="e.g. 168"
                                        value={treatForm.height_cm} onChange={setT('height_cm')}/>
                                </div>
                            </div>
                        </div>

                        {/* Clinical Details */}
                        <div className="doc-card">
                            <div className="doc-card-head"><h3><Stethoscope size={13}/> Clinical Details</h3></div>
                            <div className="doc-form-stack-inner">
                                {[
                                    { label:'Chief Complaint',   key:'chief_complaint',   required:false, rows:2 },
                                    { label:'Clinical Findings', key:'clinical_findings', required:false, rows:3 },
                                    { label:'Diagnosis',         key:'diagnosis',         required:true,  rows:2 },
                                    { label:'Treatment Details', key:'treatment_details', required:false, rows:3 },
                                ].map(f => (
                                    <div key={f.key} className="doc-fg">
                                        <label className="doc-field-label">
                                            {f.label} {f.required && <span style={{color:'var(--red)'}}>*</span>}
                                        </label>
                                        <textarea className="doc-input doc-ta" rows={f.rows}
                                            value={treatForm[f.key]} onChange={setT(f.key)}/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Prescription — row-based builder */}
                        <div className="doc-card">
                            <div className="doc-card-head"><h3><Pill size={13}/> Prescription</h3></div>
                            <div style={{padding:'16px'}}>
                                <PrescriptionBuilder rows={rxRows} onChange={setRxRows}/>
                            </div>
                        </div>

                        {/* Follow-up */}
                        <div className="doc-card">
                            <div className="doc-card-head"><h3><Calendar size={13}/> Follow-up</h3></div>
                            <div style={{padding:'16px'}}>
                                <div className="doc-fg">
                                    <label className="doc-field-label">Follow-up Date (optional)</label>
                                    <input type="date" className="doc-input"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={treatForm.follow_up_date} onChange={setT('follow_up_date')}/>
                                </div>
                            </div>
                        </div>

                        {!apptId && (
                            <div className="doc-warn-banner">
                                <AlertTriangle size={14}/> Please select an appointment above before saving.
                            </div>
                        )}

                        {/* Save button at the bottom */}
                        <button type="submit" className="doc-btn-primary doc-btn-lg" disabled={treatSaving || !apptId}>
                            {treatSaving ? <><div className="doc-btn-spin"/>Saving…</> : <><Save size={15}/> Save Consultation Record</>}
                        </button>
                        <p className="doc-save-hint">After saving, you can optionally order lab tests or issue a referral using the tabs above.</p>
                    </form>
                </div>
            )}

            {/* ── ORDER TESTS PANEL ───────────────────────────────── */}
            {activePanel === 'tests' && (
                <div className="doc-panel-body">
                    {testDone && <div className="doc-success-banner"><CheckCircle2 size={16}/> Tests ordered successfully.</div>}

                    <form onSubmit={handleOrderTests}>
                        <div className="doc-card" style={{marginBottom:'16px'}}>
                            <div className="doc-card-head">
                                <h3><FilePlus2 size={13}/> Laboratory / Investigation Request</h3>
                                <span className="doc-card-sub">Fill details for each test. Add more rows as needed.</span>
                            </div>
                            <div style={{padding:'16px'}}>
                                {/* Header row labels */}
                                <div className="doc-test-header-row">
                                    <span>Test / Investigation</span>
                                    <span>Type</span>
                                    <span>Specimen</span>
                                    <span>Priority</span>
                                    <span>Clinical Info</span>
                                    <span></span>
                                </div>
                                {tests.map((t, i) => (
                                    <div key={i} className="doc-test-form-row">
                                        <input className="doc-input" placeholder="e.g. FBC, Chest X-Ray, HbA1c"
                                            value={t.test_name}
                                            onChange={e => updateTestRow(i, 'test_name', e.target.value)}/>
                                        <select className="doc-input" value={t.test_type}
                                            onChange={e => updateTestRow(i, 'test_type', e.target.value)}>
                                            {TEST_TYPES.map(tt => <option key={tt}>{tt}</option>)}
                                        </select>
                                        <input className="doc-input" placeholder="e.g. Blood, Urine, Sputum"
                                            value={t.specimen}
                                            onChange={e => updateTestRow(i, 'specimen', e.target.value)}/>
                                        <select className="doc-input" value={t.priority}
                                            onChange={e => updateTestRow(i, 'priority', e.target.value)}>
                                            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                                        </select>
                                        <input className="doc-input" placeholder="Relevant clinical info"
                                            value={t.clinical_info}
                                            onChange={e => updateTestRow(i, 'clinical_info', e.target.value)}/>
                                        {tests.length > 1 ? (
                                            <button type="button" className="doc-remove-btn"
                                                onClick={() => setTests(ts => ts.filter((_,idx)=>idx!==i))}>
                                                <Trash2 size={14}/>
                                            </button>
                                        ) : <span/>}
                                    </div>
                                ))}
                                <button type="button" className="doc-btn-ghost doc-btn-sm" style={{marginTop:'10px'}}
                                    onClick={() => setTests(ts => [...ts, { test_name:'', test_type:'Lab', specimen:'', priority:'Routine', clinical_info:'' }])}>
                                    <Plus size={14}/> Add Another Test
                                </button>
                            </div>
                            <div style={{padding:'0 16px 16px', display:'flex', gap:'10px', alignItems:'center'}}>
                                <button type="submit" className="doc-btn-primary" disabled={testSaving || !apptId}>
                                    {testSaving ? <><div className="doc-btn-spin"/>Ordering…</> : <><Send size={14}/> Submit Test Request</>}
                                </button>
                                {!apptId && <span style={{fontSize:'.78rem',color:'#d97706',fontWeight:600}}>⚠ Select appointment first</span>}
                            </div>
                        </div>
                    </form>

                    {/* Previous tests — with findings action */}
                    <div className="doc-card">
                        <div className="doc-card-head"><h3><FlaskConical size={13}/> Previous Tests & Results</h3></div>
                        {existingTests.length === 0
                            ? <Empty icon={FlaskConical} text="No tests ordered yet for this patient."/>
                            : (
                                <div className="doc-test-results-list">
                                    {existingTests.map(t => (
                                        <div key={t.test_id} className="doc-test-result-card">
                                            <div className="doc-test-result-top">
                                                <div className="doc-test-result-info">
                                                    <strong>{t.test_name}</strong>
                                                    <span className="doc-test-type-chip">{t.test_type}</span>
                                                    <span className="doc-badge"
                                                        style={{background:statusBg[t.status]||'#f8fafc',color:statusColor[t.status]||'#94a3b8'}}>
                                                        {t.status?.replace('_',' ')}
                                                    </span>
                                                </div>
                                                {/* Add/edit findings button */}
                                                <button className="doc-btn-ghost doc-btn-sm" onClick={() => setFindingsModal(t)}>
                                                    <Pencil size={13}/>
                                                    {t.doctor_findings ? 'Edit Findings' : 'Add Findings'}
                                                </button>
                                            </div>
                                            {t.result_summary && (
                                                <div className="doc-test-lab-result">
                                                    <label>Lab Result:</label> {t.result_summary}
                                                </div>
                                            )}
                                            {t.doctor_findings && (
                                                <div className="doc-test-findings">
                                                    <label><Stethoscope size={11}/> Doctor's Findings:</label>
                                                    <p>{t.doctor_findings}</p>
                                                </div>
                                            )}
                                            <span className="doc-by-stamp" style={{marginTop:'6px',display:'block'}}>
                                                Ordered: {fmtDate(t.requested_at || t.created_at)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </div>
                </div>
            )}

            {/* ── REFERRAL PANEL ──────────────────────────────────── */}
            {activePanel === 'referral' && (
                <div className="doc-panel-body">
                    {refDone && <div className="doc-success-banner"><CheckCircle2 size={16}/> Referral issued successfully.</div>}

                    <form onSubmit={handleIssueReferral}>
                        <div className="doc-card" style={{marginBottom:'16px'}}>
                            <div className="doc-card-head">
                                <h3><Share2 size={13}/> Medical Referral Form</h3>
                                <span className="doc-card-sub">Complete all relevant fields for the receiving clinician</span>
                            </div>
                            <div className="doc-referral-form-body">

                                {/* Section A: Referral To */}
                                <div className="doc-ref-section">
                                    <div className="doc-ref-section-title">
                                        <Building2 size={14}/> Referral To
                                    </div>
                                    <div className="doc-form-grid">
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Hospital / Clinic <span style={{color:'var(--red)'}}>*</span></label>
                                            <input className="doc-input"
                                                placeholder="e.g. Colombo National Hospital, Teaching Hospital Kandy"
                                                value={refForm.target_clinic} onChange={setR('target_clinic')} required/>
                                        </div>
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Department / Specialty</label>
                                            <select className="doc-input" value={refForm.department} onChange={setR('department')}>
                                                <option value="">— Select —</option>
                                                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Consultant Name</label>
                                            <input className="doc-input" placeholder="e.g. Dr. A. Perera"
                                                value={refForm.consultant_name} onChange={setR('consultant_name')}/>
                                        </div>
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Contact / Phone No.</label>
                                            <input className="doc-input" placeholder="e.g. 011-2691111"
                                                value={refForm.contact_no} onChange={setR('contact_no')}/>
                                        </div>
                                    </div>
                                </div>

                                {/* Section B: Urgency */}
                                <div className="doc-ref-section">
                                    <div className="doc-ref-section-title">
                                        <Clock size={14}/> Urgency Level
                                    </div>
                                    <div className="doc-urgency-row">
                                        {['Routine','Urgent','Emergency'].map(u => (
                                            <button key={u} type="button"
                                                className={`doc-urgency-btn ${refForm.urgency === u ? 'active' : ''}`}
                                                style={refForm.urgency === u ? {background:urgencyStyle[u].bg,color:urgencyStyle[u].color,borderColor:urgencyStyle[u].color} : {}}
                                                onClick={() => setRefForm(f => ({...f, urgency: u}))}>
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Section C: Clinical Information */}
                                <div className="doc-ref-section">
                                    <div className="doc-ref-section-title">
                                        <ClipboardCheck size={14}/> Clinical Information
                                    </div>
                                    <div className="doc-form-stack-inner">
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Reason for Referral <span style={{color:'var(--red)'}}>*</span></label>
                                            <textarea className="doc-input doc-ta" rows={3}
                                                placeholder="Main reason, presenting complaint, or specific investigation/management requested…"
                                                value={refForm.reason} onChange={setR('reason')} required/>
                                        </div>
                                        <div className="doc-fg">
                                            <label className="doc-field-label">Clinical Summary</label>
                                            <textarea className="doc-input doc-ta" rows={4}
                                                placeholder="Brief history, current treatment, relevant findings, investigations already done, current medications…"
                                                value={refForm.clinical_summary} onChange={setR('clinical_summary')}/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{padding:'0 16px 16px', display:'flex', gap:'10px', alignItems:'center'}}>
                                <button type="submit" className="doc-btn-primary" disabled={refSaving || !apptId}>
                                    {refSaving ? <><div className="doc-btn-spin"/>Issuing…</> : <><Share2 size={14}/> Issue Referral</>}
                                </button>
                                {!apptId && <span style={{fontSize:'.78rem',color:'#d97706',fontWeight:600}}>⚠ Select appointment first</span>}
                            </div>
                        </div>
                    </form>

                    {/* Referral history */}
                    {refHistory.length > 0 && (
                        <div className="doc-card">
                            <div className="doc-card-head"><h3><FileText size={13}/> Previous Referrals</h3></div>
                            <div className="doc-referral-list">
                                {refHistory.map(r => {
                                    const us = urgencyStyle[r.urgency] || urgencyStyle.Routine;
                                    return (
                                        <div key={r.referral_id} className="doc-referral-item">
                                            <div className="doc-referral-top">
                                                <strong>{r.target_clinic}{r.department ? ` — ${r.department}` : ''}</strong>
                                                <span className="doc-badge" style={{background:us.bg,color:us.color}}>{r.urgency}</span>
                                            </div>
                                            <p className="doc-referral-reason">{r.reason}</p>
                                            {r.clinical_summary && <p className="doc-referral-summary">{r.clinical_summary}</p>}
                                            <span className="doc-by-stamp">
                                                {fmtDate(r.referral_date)}
                                                {r.consultant_name ? ` · Dr. ${r.consultant_name}` : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Lab findings modal */}
            {findingsModal && (
                <LabFindingsModal
                    test={findingsModal}
                    patientId={patient.patient_id}
                    onClose={() => setFindingsModal(null)}
                    onSaved={() => { refreshTestsAndReferrals(); setFindingsModal(null); }}
                />
            )}
        </div>
    );
}

// ─── PATIENT HISTORY (3 tabs: Prescriptions, Lab Requests, Referrals) ─────────
function PatientHistory({ patient }) {
    const [records,  setRecords]  = useState([]);
    const [labTests, setLabTests] = useState([]);
    const [referrals,setReferrals]= useState([]);
    const [loading,  setLoading]  = useState(true);
    const [hTab,     setHTab]     = useState('prescriptions'); // 'prescriptions' | 'lab' | 'referrals'
    const [expanded, setExpanded] = useState({}); // record_id → bool

    useEffect(() => {
        if (!patient?.patient_id) return;
        setLoading(true);
        Promise.all([
            fetch(`${API}/medical-records/${patient.patient_id}`).then(r=>r.json()),
            fetch(`${API}/lab-results/${patient.patient_id}`).then(r=>r.json()),
            fetch(`${API}/referrals/${patient.patient_id}`).then(r=>r.json()),
        ]).then(([recData, labData, refData]) => {
            if (recData.success) setRecords(recData.records || []);
            if (labData.success) setLabTests(labData.tests || []);
            if (refData.success) setReferrals(refData.referrals || []);
        }).catch(()=>{}).finally(() => setLoading(false));
    }, [patient]);

    const urgencyStyle = { Routine:{bg:'#f0fdf4',color:'#166534'}, Urgent:{bg:'#fff7ed',color:'#9a3412'}, Emergency:{bg:'#fef2f2',color:'#991b1b'} };
    const statusColor  = { requested:'#2563eb', in_progress:'#d97706', completed:'#16a34a', cancelled:'#94a3b8' };
    const statusBg     = { requested:'#eff6ff', in_progress:'#fffbeb', completed:'#f0fdf4', cancelled:'#f8fafc' };

    const toggleExpand = id => setExpanded(e => ({...e, [id]: !e[id]}));

    // Filter only records that have a prescription
    const rxRecords = records.filter(r => r.prescription_details);

    return (
        <div className="doc-section">
            <PatientHeaderCard patient={patient}/>
            <div className="doc-section-head" style={{marginTop:'20px'}}>
                <h2>Clinical History</h2>
            </div>

            {/* 3-tab navigation */}
            <div className="doc-hist-tabs">
                {[
                    { id:'prescriptions', label:'Prescriptions',  icon:Pill,         count: rxRecords.length },
                    { id:'lab',           label:'Lab Requests',   icon:FlaskConical, count: labTests.length },
                    { id:'referrals',     label:'Referrals',      icon:Share2,       count: referrals.length },
                ].map(t => (
                    <button key={t.id}
                        className={`doc-hist-tab ${hTab === t.id ? 'active' : ''}`}
                        onClick={() => setHTab(t.id)}>
                        <t.icon size={14}/>
                        {t.label}
                        <span className="doc-hist-count">{t.count}</span>
                    </button>
                ))}
            </div>

            {loading ? <Spinner/> : (
                <>
                    {/* ── PRESCRIPTIONS TAB ── */}
                    {hTab === 'prescriptions' && (
                        rxRecords.length === 0
                            ? <Empty icon={Pill} text="No prescription history found."/>
                            : (
                                <div className="doc-history-list">
                                    {rxRecords.map(rec => (
                                        <div key={rec.record_id} className="doc-history-card">
                                            <div className="doc-history-card-top" onClick={() => toggleExpand(rec.record_id)}>
                                                <div className="doc-history-card-left">
                                                    <div className="doc-tl-date-inline">
                                                        <span className="doc-tl-day">{new Date(rec.consultation_day).toLocaleDateString('en-US',{day:'2-digit',month:'short'})}</span>
                                                        <span className="doc-tl-year">{new Date(rec.consultation_day).getFullYear()}</span>
                                                    </div>
                                                    <div>
                                                        <div className="doc-history-title">
                                                            <Stethoscope size={12}/> {rec.diagnosis || 'General Consultation'}
                                                        </div>
                                                        <div className="doc-by-stamp">{rec.doctor_name || `Staff #${rec.created_by}`}</div>
                                                    </div>
                                                </div>
                                                <button className="doc-expand-btn">
                                                    {expanded[rec.record_id] ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                                                </button>
                                            </div>
                                            {expanded[rec.record_id] && (
                                                <div className="doc-history-card-body">
                                                    {rec.chief_complaint && (
                                                        <div className="doc-c-cell">
                                                            <label>Chief Complaint</label><p>{rec.chief_complaint}</p>
                                                        </div>
                                                    )}
                                                    {rec.clinical_findings && (
                                                        <div className="doc-c-cell">
                                                            <label>Clinical Findings</label><p>{rec.clinical_findings}</p>
                                                        </div>
                                                    )}
                                                    <div className="doc-c-cell wide">
                                                        <label><Pill size={12}/> Prescription</label>
                                                        <pre className="doc-rx-pre">{rec.prescription_details}</pre>
                                                    </div>
                                                    {(rec.weight_kg || rec.height_cm) && (
                                                        <div className="doc-c-cell">
                                                            <label>Vitals</label>
                                                            <p>{rec.weight_kg ? `${rec.weight_kg} kg` : ''}{rec.weight_kg && rec.height_cm ? ' · ' : ''}{rec.height_cm ? `${rec.height_cm} cm` : ''}</p>
                                                        </div>
                                                    )}
                                                    {rec.follow_up_date && (
                                                        <div className="doc-c-cell">
                                                            <label>Follow-up</label>
                                                            <p>{fmtDate(rec.follow_up_date)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                    )}

                    {/* ── LAB REQUESTS TAB ── */}
                    {hTab === 'lab' && (
                        labTests.length === 0
                            ? <Empty icon={FlaskConical} text="No lab requests found."/>
                            : (
                                <div className="doc-history-list">
                                    {labTests.map(t => (
                                        <div key={t.test_id} className="doc-test-result-card">
                                            <div className="doc-test-result-top">
                                                <div className="doc-test-result-info">
                                                    <strong>{t.test_name}</strong>
                                                    <span className="doc-test-type-chip">{t.test_type}</span>
                                                    <span className="doc-badge"
                                                        style={{background:statusBg[t.status]||'#f8fafc',color:statusColor[t.status]||'#94a3b8'}}>
                                                        {t.status?.replace('_',' ')}
                                                    </span>
                                                </div>
                                                <span className="doc-by-stamp">{fmtDate(t.requested_at || t.created_at)}</span>
                                            </div>
                                            {t.result_summary && (
                                                <div className="doc-test-lab-result">
                                                    <label>Lab Result:</label> {t.result_summary}
                                                </div>
                                            )}
                                            {t.doctor_findings && (
                                                <div className="doc-test-findings">
                                                    <label><Stethoscope size={11}/> Doctor's Findings:</label>
                                                    <p>{t.doctor_findings}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                    )}

                    {/* ── REFERRALS TAB ── */}
                    {hTab === 'referrals' && (
                        referrals.length === 0
                            ? <Empty icon={Share2} text="No referrals issued."/>
                            : (
                                <div className="doc-history-list">
                                    {referrals.map(r => {
                                        const us = urgencyStyle[r.urgency] || urgencyStyle.Routine;
                                        return (
                                            <div key={r.referral_id} className="doc-referral-item">
                                                <div className="doc-referral-top">
                                                    <strong>{r.target_clinic}{r.department ? ` — ${r.department}` : ''}</strong>
                                                    <span className="doc-badge" style={{background:us.bg,color:us.color}}>{r.urgency}</span>
                                                </div>
                                                {r.consultant_name && <div className="doc-by-stamp">To: Dr. {r.consultant_name}</div>}
                                                <p className="doc-referral-reason">{r.reason}</p>
                                                {r.clinical_summary && <p className="doc-referral-summary">{r.clinical_summary}</p>}
                                                <span className="doc-by-stamp">{fmtDate(r.referral_date)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                    )}
                </>
            )}
        </div>
    );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function DoctorNotifications({ user }) {
    const [notifs,  setNotifs]  = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sid = user?.staff_id; if (!sid) { setLoading(false); return; }
        fetch(`${API}/staff/notifications/${sid}`)
            .then(r=>r.json()).then(d => setNotifs(d.notifications || []))
            .catch(() => setNotifs([])).finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="doc-section">
            <div className="doc-section-head">
                <h2>Notifications</h2>
                <p>{notifs.length} messages</p>
            </div>
            {loading ? <Spinner/> : notifs.length === 0
                ? <Empty icon={Bell} text="No notifications."/>
                : (
                    <div className="doc-notif-list">
                        {notifs.map((n, i) => (
                            <div key={n.notification_id || i} className={`doc-notif-card ${n.status==='sent'?'unread':''}`}>
                                <div className="doc-notif-icon"><Bell size={15}/></div>
                                <div className="doc-notif-body">
                                    <div className="doc-notif-title">{n.email_subject || 'Notification'}</div>
                                    <div className="doc-notif-msg">{n.message}</div>
                                    <div className="doc-notif-time">{fmtDTime(n.sent_at)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
        </div>
    );
}

// ─── DOCTOR FEEDBACK ──────────────────────────────────────────────────────────
function DoctorFeedback({ user }) {
    const [comment,     setComment]     = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const [submitted,   setSubmitted]   = useState(false);
    const [history,     setHistory]     = useState([]);
    const [histLoading, setHistLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        const sid = user?.staff_id; if (!sid) return;
        try {
            const r = await fetch(`${API}/staff/feedback/${sid}`);
            const d = await r.json();
            if (d.success) setHistory(d.feedback || []);
        } catch {} finally { setHistLoading(false); }
    }, [user]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!comment.trim()) return alert('Please write your feedback.');
        setSubmitting(true);
        try {
            const r = await fetch(`${API}/staff/feedback`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ staff_id: user.staff_id, comment: comment.trim() })
            });
            const d = await r.json();
            if (d.success) { setSubmitted(true); setComment(''); fetchHistory(); setTimeout(() => setSubmitted(false), 3500); }
            else alert(d.message || 'Failed.');
        } catch { alert('Server error.'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="doc-section">
            <div className="doc-section-head">
                <h2>Feedback</h2>
                <p>Share suggestions or concerns about the system</p>
            </div>
            {submitted && <div className="doc-success-banner"><CheckCircle2 size={16}/> Thank you — feedback submitted.</div>}
            <div className="doc-card" style={{marginBottom:'20px'}}>
                <div className="doc-card-head"><h3><MessageSquare size={13}/> Submit Feedback</h3></div>
                <form onSubmit={handleSubmit} style={{padding:'16px'}}>
                    <div className="doc-fg" style={{marginBottom:'14px'}}>
                        <label className="doc-field-label">Your Comments</label>
                        <textarea className="doc-input doc-ta" rows={5}
                            placeholder="Share your experience, suggestions, or any issues with the SmartOPD system…"
                            value={comment} onChange={e => setComment(e.target.value)}/>
                    </div>
                    <button type="submit" className="doc-btn-primary" disabled={submitting || !comment.trim()}>
                        {submitting ? <><div className="doc-btn-spin"/>Submitting…</> : <><Send size={14}/> Submit</>}
                    </button>
                </form>
            </div>
            {!histLoading && history.length > 0 && (
                <div className="doc-card">
                    <div className="doc-card-head"><h3><FileText size={13}/> Your Past Feedback</h3></div>
                    <div style={{padding:'12px 16px'}}>
                        {history.map((item, i) => (
                            <div key={item.feedback_id || i} className="doc-feedback-item">
                                <span className="doc-by-stamp">{fmtDTime(item.date_submitted || item.submitted_at)}</span>
                                <p className="doc-feedback-comment">"{item.comment}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MY PROFILE ──────────────────────────────────────────────────────────────
function DoctorProfile({ user }) {
    const [editing, setEditing] = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [pwMode,  setPwMode]  = useState(false);
    const [showPw,  setShowPw]  = useState(false);
    const [form,    setForm]    = useState({
        first_name: user?.full_name?.split(' ')[0] || '',
        surname:    user?.full_name?.split(' ').slice(1).join(' ') || '',
        phone:      user?.phone || '',
    });
    const [pw, setPw] = useState({ current:'', next:'', confirm:'' });
    const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

    const handleSave = async () => {
        setSaving(true);
        try {
            const r = await fetch(`${API}/doctor/update-profile`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ staff_id: user?.staff_id, ...form })
            });
            const d = await r.json();
            if (d.success) setEditing(false);
            else alert(d.message || 'Save failed.');
        } catch { alert('Server error.'); }
        finally { setSaving(false); }
    };

    const handlePwChange = async () => {
        if (pw.next !== pw.confirm) { alert('Passwords do not match.'); return; }
        if (pw.next.length < 6)     { alert('Minimum 6 characters.'); return; }
        setSaving(true);
        try {
            const r = await fetch(`${API}/doctor/change-password`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ staff_id: user?.staff_id, current: pw.current, next: pw.next })
            });
            const d = await r.json();
            if (d.success) { setPw({current:'',next:'',confirm:''}); setPwMode(false); }
            else alert(d.message || 'Failed.');
        } catch { alert('Server error.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="doc-section">
            <div className="doc-profile-banner">
                <div className="doc-profile-ava">{(user?.full_name || 'D')[0].toUpperCase()}</div>
                <div>
                    <h2>{user?.full_name || 'Doctor'}</h2>
                    <p>Staff ID: {user?.staff_id} · Doctor</p>
                </div>
                <button className={`doc-btn-ghost ${editing?'danger':''}`} onClick={() => setEditing(e=>!e)}>
                    {editing ? <><X size={14}/> Cancel</> : <><Edit3 size={14}/> Edit Profile</>}
                </button>
            </div>

            <div className="doc-card" style={{marginBottom:'16px'}}>
                <div className="doc-card-head"><h3><User size={13}/> Professional Details</h3></div>
                <div className="doc-profile-grid">
                    <div className="doc-fg">
                        <label className="doc-field-label">Email (Username)</label>
                        <div className="doc-locked">{user?.username || user?.email || '—'} <Lock size={11}/></div>
                    </div>
                    <div className="doc-fg">
                        <label className="doc-field-label">Staff ID</label>
                        <div className="doc-locked">{user?.staff_id || '—'} <Lock size={11}/></div>
                    </div>
                    {[{label:'First Name',key:'first_name'},{label:'Surname',key:'surname'},{label:'Phone',key:'phone'}].map(f => (
                        <div key={f.key} className="doc-fg">
                            <label className="doc-field-label">{f.label}</label>
                            {editing
                                ? <input className="doc-input" value={form[f.key]} onChange={set(f.key)}/>
                                : <div className="doc-profile-val">{form[f.key] || <span className="doc-empty-val">Not set</span>}</div>}
                        </div>
                    ))}
                </div>
                {editing && (
                    <div style={{padding:'0 16px 16px'}}>
                        <button className="doc-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="doc-btn-spin"/>Saving…</> : <><Save size={13}/> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            {/*<div className="doc-card">
                <div className="doc-card-head">
                    <h3><Lock size={13}/> Change Password</h3>
                    <button className="doc-btn-ghost doc-btn-sm" onClick={() => setPwMode(m=>!m)}>
                        {pwMode ? 'Cancel' : 'Change Password'}
                    </button>
                </div>
                {pwMode && (
                    <div className="doc-pw-form">
                        {[{label:'Current Password',key:'current'},{label:'New Password',key:'next'},{label:'Confirm New Password',key:'confirm'}].map(f => (
                            <div key={f.key} className="doc-fg">
                                <label className="doc-field-label">{f.label}</label>
                                <input className="doc-input" type={showPw?'text':'password'}
                                    value={pw[f.key]} onChange={e => setPw(p => ({...p,[f.key]:e.target.value}))}/>
                            </div>
                        ))}
                        <label className="doc-show-pw">
                            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)}/> Show passwords
                        </label>
                        <button className="doc-btn-primary" onClick={handlePwChange} disabled={saving}>
                            {saving ? <><div className="doc-btn-spin"/>Saving…</> : <><Shield size={13}/> Update Password</>}
                        </button>
                    </div>
                )}
            </div>*/}
        </div>
    );
}

// ─── MAIN SHELL ───────────────────────────────────────────────────────────────
export default function DoctorDashboard({ user, setUser }) {
    const [activeTab,       setActiveTab]       = useState('home');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    const handleSelectPatient = (patient, tab = 'consult') => {
        setSelectedPatient(patient);
        setActiveTab(tab);
    };

    const patientTabs = ['consult','history'];

    const navItems = [
        { id:'home',          label:'Home',        icon:Home },
        { id:'lookup',        label:'Patient Lookup',  icon:Search },
        { id:'consult',       label:'Consultation',    icon:Stethoscope },
        { id:'history',       label:'Patient History', icon:ClipboardList },
        { id:'profile',       label:'My Profile',      icon:User },
        { id:'notifications', label:'Notifications',   icon:Bell },
        { id:'feedback',      label:'Feedback',        icon:MessageSquare },
    ];

    return (
        <div className="doc-shell">
            {/* Sidebar */}
            <aside className="doc-sidebar">
                <div className="doc-brand">
                    <div className="doc-brand-icon"><Activity size={16} color="white"/></div>
                    <div>
                        <div className="doc-brand-name">SmartOPD</div>
                        <div className="doc-brand-role">Doctor's Portal</div>
                    </div>
                </div>

                <div className="doc-sidebar-user">
                    <div className="doc-user-ava">{(user?.full_name || 'D')[0].toUpperCase()}</div>
                    <div>
                        <div className="doc-user-name">{user?.full_name || 'Doctor'}</div>
                        <div className="doc-user-role">Doctor · ID {user?.staff_id}</div>
                    </div>
                </div>

                {selectedPatient && (
                    <div className="doc-active-patient-chip">
                        <div className="doc-ap-dot"/>
                        <div className="doc-ap-info">
                            <span className="doc-ap-label">Active Patient</span>
                            <span className="doc-ap-name">{selectedPatient.full_name}</span>
                        </div>
                        <button className="doc-ap-clear" onClick={() => setSelectedPatient(null)} title="Clear patient">
                            <X size={12}/>
                        </button>
                    </div>
                )}

                <nav className="doc-nav">
                    {navItems.map(item => (
                        <button key={item.id}
                            className={`doc-nav-item ${activeTab===item.id?'active':''} ${patientTabs.includes(item.id)&&!selectedPatient?'doc-nav-disabled':''}`}
                            onClick={() => {
                                if (patientTabs.includes(item.id) && !selectedPatient) {
                                    setActiveTab('lookup');
                                } else {
                                    setActiveTab(item.id);
                                }
                            }}>
                            <item.icon size={17}/>
                            <span>{item.label}</span>
                            {patientTabs.includes(item.id) && !selectedPatient && (
                                <span className="doc-nav-hint">Select patient first</span>
                            )}
                        </button>
                    ))}
                </nav>

                <button className="doc-nav-item doc-logout" onClick={handleLogout}>
                    <LogOut size={17}/><span>Sign Out</span>
                </button>
            </aside>

            {/* Main content */}
            <div className="doc-main">
                <header className="doc-topbar">
                    <div className="doc-breadcrumb">
                        Base Hospital · OPD
                        <ChevronRight size={13}/>
                        <strong>{navItems.find(n=>n.id===activeTab)?.label}</strong>
                        {selectedPatient && patientTabs.includes(activeTab) && (
                            <>
                                <ChevronRight size={13}/>
                                <span className="doc-breadcrumb-patient">{selectedPatient.full_name}</span>
                            </>
                        )}
                    </div>
                    <div className="doc-topbar-right">
                        <div className="doc-live-dot"/><span className="doc-live-label">OPD Open</span>
                    </div>
                </header>

                <div className="doc-content">
                    {activeTab === 'home'          && <DoctorHome user={user} onSelectPatient={handleSelectPatient}/>}
                    {activeTab === 'lookup'        && <PatientLookup onSelect={p => handleSelectPatient(p,'consult')}/>}
                    {activeTab === 'consult'       && selectedPatient && <ConsultationSession user={user} patient={selectedPatient} appointmentId={selectedPatient.appointment_id}/>}
                    {activeTab === 'history'       && selectedPatient && <PatientHistory patient={selectedPatient}/>}
                    {activeTab === 'notifications' && <DoctorNotifications user={user}/>}
                    {activeTab === 'feedback'      && <DoctorFeedback user={user}/>}
                    {activeTab === 'profile'       && <DoctorProfile user={user}/>}

                    {patientTabs.includes(activeTab) && !selectedPatient && (
                        <div className="doc-section">
                            <div className="doc-no-patient-prompt">
                                <Stethoscope size={40} strokeWidth={1.2}/>
                                <h3>No Patient Selected</h3>
                                <p>Search for a patient by barcode or NIC to continue.</p>
                                <button className="doc-btn-primary" onClick={() => setActiveTab('lookup')}>
                                    <Search size={15}/> Go to Patient Lookup
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}