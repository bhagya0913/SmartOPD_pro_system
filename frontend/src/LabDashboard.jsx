import React, { useState, useEffect, useCallback, useRef } from 'react';
import './LabDashboard.css';
import './MedicalHistory.css';
import { useNavigate } from 'react-router-dom';
import {
    Home, User, Bell, MessageSquare, LogOut, Search, ScanBarcode,
    FlaskConical, CheckCircle2, Clock, ChevronRight, X, RefreshCw,
    Activity, Shield, Edit3, Save, Lock, Send, FileText, Upload,
    AlertCircle, AlertTriangle, ArrowRight, Paperclip, Eye,
    Phone, Droplets, Calendar, Stethoscope, UserCheck, Info,
    ChevronDown, ChevronUp, ClipboardList, BadgeCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const API      = 'http://localhost:5001/api';
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtTime  = t => { if (!t) return '—'; const [h, m] = t.toString().split(':'); const hr = parseInt(h); return `${String(hr % 12 || 12).padStart(2,'0')}:${m||'00'} ${hr < 12 ? 'AM' : 'PM'}`; };
const fmtDTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : '—';
const fmtDateTime = fmtDTime;
const calcAge  = dob => { if (!dob) return null; const d = new Date(dob), n = new Date(); let a = n.getFullYear()-d.getFullYear(); if (n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--; return a; };

const Spinner  = () => <div className="lb-loading"><div className="lb-spinner"/></div>;
const Empty    = ({ icon: Icon, text }) => (
    <div className="lb-empty"><Icon size={28} style={{opacity:.3}}/><p>{text}</p></div>
);

const typeBadge = t => ({
    Lab: 'lb-badge-blue', Imaging: 'lb-badge-purple',
    ECG: 'lb-badge-amber', Other: 'lb-badge-grey'
}[t] || 'lb-badge-grey');

const priorityBadge = p => ({
    urgent:  'lb-badge-red',
    high:    'lb-badge-amber',
    normal:  'lb-badge-blue',
    routine: 'lb-badge-grey',
}[(p||'normal').toLowerCase()] || 'lb-badge-grey');

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN SHELL
// ══════════════════════════════════════════════════════════════════════════════
export default function LabDashboard({ user, setUser }) {
    const [activeTab, setActiveTab] = useState('home');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    const navItems = [
        { id: 'home',          label: 'Worklist',          icon: Home          },
        { id: 'scan',          label: 'Patient Search',    icon: ScanBarcode   },
        { id: 'upload',        label: 'Update Results',    icon: Upload        },
        { id: 'profile',       label: 'My Profile',        icon: User          },
        //{ id: 'notifications', label: 'Notifications',     icon: Bell          },
        //{/* id: 'feedback',      label: 'Feedback',          icon: MessageSquare */}
    ];

    return (
        <div className="lb-shell">
            <aside className="lb-sidebar">
                <div className="lb-brand">
                    <div className="lb-brand-icon"><Activity size={16} color="white"/></div>
                    <div>
                        <div className="lb-brand-name">SmartOPD</div>
                        <div className="lb-brand-role">Diagnostics Unit</div>
                    </div>
                </div>
                <div className="lb-sidebar-user">
                    <div className="lb-user-ava">{(user?.full_name || 'L')[0].toUpperCase()}</div>
                    <div>
                        <div className="lb-user-name">{user?.full_name || 'Lab Tech'}</div>
                        <div className="lb-user-role">Technician · ID {user?.staff_id}</div>
                    </div>
                </div>
                <nav className="lb-nav">
                    {navItems.map(item => (
                        <button key={item.id}
                            className={`lb-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17}/><span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <button className="lb-nav-item lb-logout" onClick={handleLogout}>
                    <LogOut size={17}/><span>Sign Out</span>
                </button>
            </aside>

            <div className="lb-main">
                <header className="lb-topbar">
                    <div className="lb-breadcrumb">
                        Base Hospital · Diagnostics
                        <ChevronRight size={13}/>
                        <strong>{navItems.find(n => n.id === activeTab)?.label}</strong>
                    </div>
                    <div className="lb-topbar-right">
                        <div className="lb-live-dot"/><span className="lb-live-label">Lab Online</span>
                    </div>
                </header>
                <div className="lb-content">
                    {activeTab === 'home'          && <LabHome user={user}/>}
                    {activeTab === 'scan'          && <ScanTestRequest user={user}/>}
                    {activeTab === 'upload'        && <UploadResults user={user}/>}
                    {activeTab === 'profile'       && <LabProfile user={user}/>}
                    {activeTab === 'notifications' && <LabNotifications user={user}/>}
                    {activeTab === 'feedback'      && <LabFeedback user={user}/>}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  WORKLIST HOME
//  ENHANCED: Full patient + doctor + request context in each row.
//            Expandable rows show clinical notes, priority, doctor ID.
// ══════════════════════════════════════════════════════════════════════════════
function LabHome({ user }) {
    const [stats,    setStats]    = useState({ pending: 0, inProgress: 0, completed: 0 });
    const [worklist, setWorklist] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [filter,   setFilter]   = useState('requested');
    const [expanded, setExpanded] = useState({}); // { [test_id]: bool }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sRes, wRes] = await Promise.all([
                fetch(`${API}/lab/stats`),
                fetch(`${API}/lab/worklist?status=${filter}`)
            ]);
            const [sData, wData] = await Promise.all([sRes.json(), wRes.json()]);
            if (sData.success) setStats(sData.stats);
            setWorklist(Array.isArray(wData) ? wData : (wData.tests || []));
        } catch { toast.error('Failed to load worklist.'); }
        finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    const handleStatusChange = async (testId, newStatus) => {
        try {
            const r = await fetch(`${API}/lab/update-status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test_id: testId, status: newStatus, technician_id: user?.staff_id })
            });
            const d = await r.json();
            if (d.success) { toast.success(`Marked as ${newStatus.replace('_', ' ')}.`); load(); }
            else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
    };

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const filterLabels = {
        requested:   'Pending',
        in_progress: 'In Progress',
        completed:   'Completed',
        all:         'All',
    };

    const toggleRow = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

    return (
        <div className="lb-section">
            <div className="lb-hero">
                <div>
                    <h1 className="lb-hero-title">Diagnostic Worklist</h1>
                    <p className="lb-hero-sub">{today} · Welcome, {user?.full_name?.split(' ')[0] || 'Technician'}</p>
                </div>
                <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                    <div className="lb-hero-badge"><div className="lb-live-dot"/><span>Lab Online</span></div>
                    <button className="lb-btn-ghost" onClick={load}>
                        <RefreshCw size={13} className={loading ? 'lb-spin' : ''}/> Refresh
                    </button>
                </div>
            </div>

            <div className="lb-stat-grid">
                {[
                    { label: 'Pending Tests',   val: stats.pending,    icon: Clock,        color: 'amber'  },
                    { label: 'In Progress',     val: stats.inProgress, icon: FlaskConical, color: 'purple' },
                    { label: 'Completed Today', val: stats.completed,  icon: CheckCircle2, color: 'green'  },
                ].map(s => (
                    <div key={s.label} className={`lb-stat lb-stat-${s.color}`}>
                        <div className="lb-stat-icon"><s.icon size={20}/></div>
                        <div>
                            <div className="lb-stat-val">{s.val}</div>
                            <div className="lb-stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="lb-card">
                <div className="lb-card-head">
                    <h3><FlaskConical size={14}/> Test Requests</h3>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                        <div className="lb-filter-row" style={{margin:0}}>
                            {Object.entries(filterLabels).map(([f, label]) => (
                                <button key={f}
                                    className={`lb-pill-btn ${filter === f ? 'active' : ''}`}
                                    onClick={() => setFilter(f)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button className="lb-btn-ghost" onClick={load} style={{padding:'7px 10px'}}>
                            <RefreshCw size={13} className={loading ? 'lb-spin' : ''}/>
                        </button>
                    </div>
                </div>

                {loading ? <Spinner/>
                : worklist.length === 0
                    ? <Empty icon={FlaskConical} text="No test requests for this filter."/>
                    : (
                        /* ENHANCED: card-based rows with expandable detail */
                        <div className="mh-timeline">
  {worklist.map(t => {
    const isOpen = expanded[t.test_id];
    const age = calcAge(t.patient_dob);
    return (
      <div key={t.test_id} className="mh-timeline-row">
        {/* Left date column (optional – you can omit or keep simple) */}
        <div className="mh-date-badge">
          <span className="mh-date-day">
            {t.requested_at ? new Date(t.requested_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : '—'}
          </span>
          <span className="mh-date-year">
            {t.requested_at ? new Date(t.requested_at).getFullYear() : ''}
          </span>
        </div>

        {/* Dot + line */}
        <div className="mh-tl-gutter">
          <div className={`mh-tl-dot mh-tl-dot-lab`} />
          <div className="mh-tl-line" />
        </div>

        {/* Card */}
        <div className="mh-tl-content">
          <div className={`mh-record-card ${isOpen ? 'mh-expanded' : ''}`}>
            <div className="mh-card-head" onClick={() => toggleRow(t.test_id)}>
              <div className="mh-card-head-left">
                <div className="mh-card-icon" style={{ background: '#f0fdf4' }}>
                  <FlaskConical size={16} />
                </div>
                <div className="mh-card-title-block">
                  <div className="mh-card-title">{t.test_name}</div>
                  <div className="mh-card-meta">
                    <span className="mh-doctor-chip">
                      <User size={11} /> Dr. {t.doctor_name || '—'}
                    </span>
                    <span className="mh-type-pill" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
                      {t.test_type}
                    </span>
                    {t.priority && t.priority !== 'normal' && (
                      <span className="mh-status-chip mh-status-urgent">{t.priority}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mh-card-head-right">
                <span className={`mh-status-chip mh-status-${t.status === 'requested' ? 'pending' : t.status === 'in_progress' ? 'inprogress' : 'done'}`}>
                  {t.status.replace('_', ' ')}
                </span>
                <button className="mh-expand-btn">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="mh-card-body">
                <div className="mh-info-strip">
                  <div className="mh-info-field"><span>Requested</span><strong>{fmtDateTime(t.requested_at)}</strong></div>
                  <div className="mh-info-field"><span>Doctor</span><strong>Dr. {t.doctor_name || '—'}</strong></div>
                  <div className="mh-info-field"><span>Patient</span><strong>{t.patient_name} ({age ? `${age}y` : ''})</strong></div>
                  <div className="mh-info-field"><span>Priority</span><strong>{t.priority || 'Normal'}</strong></div>
                </div>

                <div className="mh-cells-grid">
                  {t.clinical_notes && (
                    <div className="mh-cell mh-cell-wide">
                      <label>Clinical Notes</label>
                      <p>{t.clinical_notes}</p>
                    </div>
                  )}
                  {/* Status action buttons */}
                  <div className="mh-cell mh-cell-wide">
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {t.status === 'requested' && (
                        <button className="mh-print-btn" onClick={() => handleStatusChange(t.test_id, 'in_progress')}>
                          <FlaskConical size={13} /> Start Processing
                        </button>
                      )}
                      {t.status === 'in_progress' && (
                        <button className="mh-print-btn" onClick={() => handleStatusChange(t.test_id, 'completed')}>
                          <CheckCircle2 size={13} /> Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  })}
</div>
                    )
                }
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PATIENT TEST PANEL (used inside ScanTestRequest tabs)
//  ENHANCED: Full HIS-style view — patient profile, appointments, lab history,
//            active requests with inline result entry.
// ══════════════════════════════════════════════════════════════════════════════
function PatientTestPanel({ pid, patient, tests, appointments, technicianId, onUpdate }) {
    const [updating,  setUpdating]  = useState(null);
    const [resultForms, setResultForms] = useState({}); // { [testId]: { summary, remarks, status } }
    const [submitting,  setSubmitting]  = useState(null);
    const [activeSection, setActiveSection] = useState('active'); // 'active' | 'history' | 'appointments'

    const age          = calcAge(patient?.dob);
    const activeTests  = tests.filter(t => ['requested','in_progress'].includes(t.status));
    const historyTests = tests.filter(t => !['requested','in_progress'].includes(t.status));

    const setField = (testId, key, val) =>
        setResultForms(f => ({ ...f, [testId]: { ...f[testId], [key]: val } }));

    const handleStatusChange = async (testId, newStatus) => {
        setUpdating(testId);
        try {
            const r = await fetch(`${API}/lab/update-status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test_id: testId, status: newStatus, technician_id: technicianId })
            });
            const d = await r.json();
            if (d.success) {
                toast.success(`Marked as ${newStatus.replace('_', ' ')}.`);
                onUpdate(pid, tests.map(t => t.test_id === testId ? { ...t, status: newStatus } : t));
            } else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
        finally { setUpdating(null); }
    };

    // ENHANCED: inline result submission (notes are optional)
    const handleResultSubmit = async testId => {
        const form = resultForms[testId] || {};
        if (!form.summary?.trim()) { toast.error('Please enter the test findings.'); return; }
        setSubmitting(testId);
        try {
            const fd = new FormData();
            fd.append('test_id',     testId);
            fd.append('summary',     form.summary.trim());
            fd.append('uploaded_by', technicianId || '');
            // remarks is optional — only send if provided
            if (form.remarks?.trim()) fd.append('remarks', form.remarks.trim());
            if (form.file)            fd.append('result_file', form.file);

            const r = await fetch(`${API}/lab/upload-result`, { method: 'POST', body: fd });
            const d = await r.json();
            if (d.success) {
                toast.success('Results submitted successfully!');
                // Refresh tests for this patient
                const r2 = await fetch(`${API}/lab/patient-tests?term=${encodeURIComponent(patient.barcode)}`);
                const d2 = await r2.json();
                if (d2.success) onUpdate(pid, d2.tests || []);
                setResultForms(f => { const n = { ...f }; delete n[testId]; return n; });
            } else toast.error(d.message || 'Submission failed.');
        } catch { toast.error('Server error.'); }
        finally { setSubmitting(null); }
    };

    const statusColor = s => ({
        requested: 'blue', in_progress: 'purple',
        completed: 'green', cancelled: 'grey', reviewed: 'teal'
    }[s] || 'grey');

    const SectionTab = ({ id, label, count }) => (
        <button
            className={`lb-section-tab ${activeSection === id ? 'active' : ''}`}
            onClick={() => setActiveSection(id)}>
            {label}
            {count !== undefined && count > 0 && (
                <span className="lb-section-tab-count">{count}</span>
            )}
        </button>
    );

    return (
        <div className="lb-patient-panel">
            {/* ── Patient header card ─────────────────────────────────────── */}
            <div className="lb-pt-header">
                <div className="lb-pt-ava">
                    {(patient.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <div className="lb-pt-info">
                    <h2 className="lb-pt-name">{patient.full_name}</h2>
                    <div className="lb-pt-meta">
                        {age !== null    && <span><User size={12}/> {age} yrs{patient.gender ? `, ${patient.gender}` : ''}</span>}
                        {patient.nic     && <span><Shield size={12}/> {patient.nic}</span>}
                        {patient.phone   && <span><Phone size={12}/> {patient.phone}</span>}
                        {patient.blood_group && <span><Droplets size={12}/> {patient.blood_group}</span>}
                        <span className="lb-pt-barcode">{patient.barcode}</span>
                    </div>
                    {patient.allergies && patient.allergies.toLowerCase() !== 'none' && (
                        <div className="lb-allergy" style={{marginTop:'6px'}}>
                            <AlertTriangle size={12}/> Allergies: <strong>{patient.allergies}</strong>
                        </div>
                    )}
                </div>
                <div className="lb-pt-badges">
                    {activeTests.filter(t=>t.status==='requested').length > 0 && (
                        <span className="lb-badge lb-badge-amber">
                            <Clock size={10}/> {activeTests.filter(t=>t.status==='requested').length} pending
                        </span>
                    )}
                    {activeTests.filter(t=>t.status==='in_progress').length > 0 && (
                        <span className="lb-badge lb-badge-purple">
                            <FlaskConical size={10}/> {activeTests.filter(t=>t.status==='in_progress').length} in progress
                        </span>
                    )}
                    {activeTests.length === 0 && tests.length > 0 && (
                        <span className="lb-badge lb-badge-green">
                            <CheckCircle2 size={10}/> All complete
                        </span>
                    )}
                </div>
            </div>

            {/* ── Section tabs ────────────────────────────────────────────── */}
            <div className="lb-section-tabs">
                <SectionTab id="active"       label="Active Lab Requests" count={activeTests.length}/>
                <SectionTab id="history"      label="Test History"        count={historyTests.length}/>
                <SectionTab id="appointments" label="Appointments"        count={appointments?.length}/>
            </div>

            {/* ── Active lab requests ─────────────────────────────────────── */}
            {activeSection === 'active' && (
                <div>
                    {activeTests.length === 0
                        ? <Empty icon={FlaskConical} text="No active lab requests for this patient."/>
                        : activeTests.map(t => {
                            const form = resultForms[t.test_id] || {};
                            return (
                                <div key={t.test_id} className="mh-record-card">
  <div className="mh-card-head">
    <div className="mh-card-head-left">
      <div className="mh-card-icon" style={{ background: '#f0fdf4' }}>
        <FlaskConical size={16} />
      </div>
      <div className="mh-card-title-block">
        <div className="mh-card-title">{t.test_name}</div>
        <div className="mh-card-meta">
          <span className="mh-type-pill" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
            {t.test_type}
          </span>
          {t.priority && t.priority !== 'normal' && (
            <span className="mh-status-chip mh-status-urgent">{t.priority}</span>
          )}
        </div>
      </div>
    </div>
    <div className="mh-card-head-right">
      <span className={`mh-status-chip mh-status-${t.status === 'requested' ? 'pending' : t.status === 'in_progress' ? 'inprogress' : 'done'}`}>
        {t.status.replace('_', ' ')}
      </span>
    </div>
  </div>

  <div className="mh-card-body">
    <div className="mh-info-strip">
      <div className="mh-info-field"><span>Doctor</span><strong>Dr. {t.doctor_name || '—'}</strong></div>
      <div className="mh-info-field"><span>Requested</span><strong>{fmtDateTime(t.requested_at)}</strong></div>
      <div className="mh-info-field"><span>Test ID</span><strong>T-{t.test_id}</strong></div>
    </div>

    {t.clinical_notes && (
      <div className="mh-cell mh-cell-wide">
        <label>Clinical Notes</label>
        <p>{t.clinical_notes}</p>
      </div>
    )}

    {/* Result entry form or status buttons */}
    {t.status === 'in_progress' && (
      <div className="mh-cell mh-cell-wide" style={{ marginTop: '16px' }}>
        <label>Findings / Summary <span className="lb-req">*</span></label>
        <textarea className="lb-input lb-ta" rows={4} placeholder="Enter test findings..."
          value={resultForms[t.test_id]?.summary || ''}
          onChange={e => setField(t.test_id, 'summary', e.target.value)} />
        <div className="lb-re-file-row">
          <label className="lb-re-file-label">
            <Paperclip size={13} />
            {resultForms[t.test_id]?.file ? resultForms[t.test_id].file.name : 'Attach Report (optional)'}
            <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setField(t.test_id, 'file', e.target.files[0])} />
          </label>
        </div>
        <button className="mh-print-btn" onClick={() => handleResultSubmit(t.test_id)} disabled={submitting === t.test_id}>
          {submitting === t.test_id ? 'Submitting...' : 'Submit Results'}
        </button>
      </div>
    )}
    {t.status === 'requested' && (
      <div className="mh-cell mh-cell-wide">
        <button className="mh-print-btn" onClick={() => handleStatusChange(t.test_id, 'in_progress')}>
          <FlaskConical size={13} /> Start Processing
        </button>
      </div>
    )}
  </div>
</div>
                            );
                        })
                    }
                </div>
            )}

            {/* ── Test history ─────────────────────────────────────────────── */}
            {activeSection === 'history' && (
                historyTests.length === 0
                    ? <Empty icon={FileText} text="No completed test history for this patient."/>
                    : (
                        <table className="lb-table">
                            <thead><tr>
                                <th>Test</th><th>Type</th><th>Doctor</th>
                                <th>Date</th><th>Status</th>
                            </tr></thead>
                            <tbody>
                                {historyTests.map(t => (
                                    <tr key={t.test_id}>
                                        <td><strong>{t.test_name}</strong><div className="lb-sub lb-mono">T-{t.test_id}</div></td>
                                        <td><span className={`lb-badge ${typeBadge(t.test_type)}`}>{t.test_type}</span></td>
                                        <td>{t.doctor_name ? `Dr. ${t.doctor_name}` : '—'}</td>
                                        <td>{fmtDate(t.requested_at || t.created_at)}</td>
                                        <td>
                                            <span className={`lb-badge lb-badge-${statusColor(t.status)}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
            )}

            {/* ── Appointments ─────────────────────────────────────────────── */}
            {activeSection === 'appointments' && (
                !appointments || appointments.length === 0
                    ? <Empty icon={Calendar} text="No appointments found for this patient."/>
                    : (
                        <table className="lb-table">
                            <thead><tr>
                                <th>Date</th><th>Time</th><th>Token</th>
                                <th>Visit Type</th><th>Status</th><th>Present</th>
                            </tr></thead>
                            <tbody>
                                {appointments.map(a => (
                                    <tr key={a.appointment_id}
                                        className={a.is_today ? 'lb-row-highlight' : ''}>
                                        <td>
                                            <strong>{fmtDate(a.appointment_day)}</strong>
                                            {a.is_today && <span className="lb-today-tag">Today</span>}
                                        </td>
                                        <td className="lb-mono">{fmtTime(a.start_time)} – {fmtTime(a.end_time)}</td>
                                        <td><span className="lb-token">#{a.queue_no}</span></td>
                                        <td>{a.visit_type}</td>
                                        <td>
                                            <span className={`lb-badge lb-badge-${statusColor(a.status)}`}>
                                                {a.status}
                                            </span>
                                        </td>
                                        <td>
                                            {a.is_present
                                                ? <span className="lb-arrived-tag"><CheckCircle2 size={12}/> Yes</span>
                                                : <span className="lb-badge lb-badge-grey">No</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCAN / PATIENT SEARCH
//  ENHANCED: webcam BarcodeDetector + NIC search.
//            Each patient opens in a tab showing full HIS view.
// ══════════════════════════════════════════════════════════════════════════════
function ScanTestRequest({ user }) {
    const [mode,          setMode]          = useState('barcode');
    const [query,         setQuery]         = useState('');
    const [searched,      setSearched]      = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [scanning,      setScanning]      = useState(false);
    const [camError,      setCamError]      = useState('');

    const [openPatients,  setOpenPatients]  = useState([]);
    const [activePatient, setActivePatient] = useState(null);

    const inputRef  = useRef(null);
    const videoRef  = useRef(null);
    const streamRef = useRef(null);
    const rafRef    = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, [mode]);
    useEffect(() => () => stopCamera(), []);

    const stopCamera = () => {
        if (rafRef.current)  cancelAnimationFrame(rafRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setScanning(false);
    };

    const startCamera = async () => {
        setCamError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            setScanning(true);
            detectBarcodes();
        } catch {
            setCamError('Camera access denied or unavailable. Use manual entry instead.');
        }
    };

    const detectBarcodes = async () => {
        if (!('BarcodeDetector' in window)) {
            setCamError('Barcode detection not supported in this browser. Use manual entry.');
            stopCamera(); return;
        }
        const detector = new window.BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13'] });
        const scan = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    stopCamera();
                    const value = barcodes[0].rawValue;
                    setQuery(value);
                    await doSearch(value);
                    return;
                }
            } catch {}
            rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
    };

    const modeCfg = {
        barcode: { label:'Barcode / Patient ID', placeholder:'Scan or type barcode — e.g. OPD-1234567890', icon: ScanBarcode },
        nic:     { label:'NIC Number',           placeholder:'Enter NIC — e.g. 200375713581 or 990234567V', icon: Shield    },
    };

    const switchMode = m => { stopCamera(); setMode(m); setQuery(''); setSearched(false); };
    const clearSearch = () => { setQuery(''); setSearched(false); inputRef.current?.focus(); };

    const doSearch = async (term) => {
        const q = (term || query).trim();
        if (!q) return;
        setLoading(true); setSearched(true);
        try {
            const r = await fetch(`${API}/lab/patient-tests?term=${encodeURIComponent(q)}`);
            const d = await r.json();
            if (!d.success) { toast.error(d.message || 'No patient found.'); setLoading(false); return; }
            const pid = d.patient.patient_id;
            const alreadyOpen = openPatients.find(p => p.pid === pid);
            if (alreadyOpen) {
                setActivePatient(pid);
                toast(`${d.patient.full_name} is already open.`, { icon: '👆' });
            } else {
                setOpenPatients(prev => [...prev, {
                    pid,
                    patient:      d.patient,
                    tests:        d.tests        || [],
                    appointments: d.appointments || [],
                }]);
                setActivePatient(pid);
            }
            setQuery(''); setSearched(false);
        } catch { toast.error('Server error.'); }
        finally { setLoading(false); }
    };

    const handleSearch = () => doSearch(query);

    const closePatient = pid => {
        setOpenPatients(prev => {
            const remaining = prev.filter(p => p.pid !== pid);
            if (activePatient === pid)
                setActivePatient(remaining.length > 0 ? remaining[remaining.length - 1].pid : null);
            return remaining;
        });
    };

    const handleTestsUpdate = (pid, updatedTests) => {
        setOpenPatients(prev => prev.map(p =>
            p.pid === pid ? { ...p, tests: updatedTests } : p
        ));
    };

    const activeEntry = openPatients.find(p => p.pid === activePatient);

    return (
        <div className="lb-section">
            <div className="lb-section-head">
                <h2>Patient Search</h2>
                <p>Search by webcam barcode scan or NIC — each patient opens in a tab</p>
            </div>

            <div className="lb-lookup-card">
                {/* Mode tabs */}
                <div className="lb-mode-tabs">
                    {Object.entries(modeCfg).map(([id, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                            <button key={id}
                                className={`lb-mode-tab ${mode === id ? 'active' : ''}`}
                                onClick={() => switchMode(id)}>
                                <Icon size={14}/>{cfg.label}
                            </button>
                        );
                    })}
                </div>

                {/* Webcam scanner */}
                {mode === 'barcode' && (
                    <div className="lb-cam-area">
                        {scanning ? (
                            <div className="lb-cam-wrapper">
                                <video ref={videoRef} className="lb-cam-video" playsInline muted/>
                                <div className="lb-cam-overlay">
                                    <div className="lb-cam-crosshair"/>
                                    <p className="lb-cam-hint">Point camera at barcode</p>
                                </div>
                                <button className="lb-btn-ghost lb-cam-stop" onClick={stopCamera}>
                                    <X size={13}/> Stop Camera
                                </button>
                            </div>
                        ) : (
                            <button className="lb-btn-ghost lb-cam-start" onClick={startCamera}>
                                <ScanBarcode size={15}/> Use Webcam Scanner
                            </button>
                        )}
                        {camError && (
                            <p className="lb-cam-error"><AlertTriangle size={13}/> {camError}</p>
                        )}
                    </div>
                )}

                {/* Manual input */}
                <div className="lb-search-row">
                    <div className="lb-search-wrap">
                        <Search size={15} className="lb-search-ico"/>
                        <input ref={inputRef} className="lb-search-input"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={modeCfg[mode].placeholder}/>
                        {query && <button className="lb-clear" onClick={clearSearch}><X size={13}/></button>}
                    </div>
                    <button className="lb-btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
                        {loading
                            ? <><div className="lb-btn-spin"/>Searching…</>
                            : <><Search size={14}/>Open Patient</>}
                    </button>
                </div>

                {searched && !loading && (
                    <div className="lb-lookup-empty">
                        <AlertCircle size={17} style={{opacity:.4}}/>
                        <span>No patient found for "<strong>{query}</strong>".</span>
                    </div>
                )}
            </div>

            {/* Patient tabs */}
            {openPatients.length > 0 && (
                <div className="lb-pt-tabs-area">
                    <div className="lb-pt-tab-strip">
                        {openPatients.map(p => {
                            const initials    = (p.patient.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                            const pending     = p.tests.filter(t => t.status === 'requested').length;
                            const inProgress  = p.tests.filter(t => t.status === 'in_progress').length;
                            const allDone     = pending === 0 && inProgress === 0 && p.tests.length > 0;
                            return (
                                <div key={p.pid}
                                    className={`lb-pt-tab ${activePatient === p.pid ? 'active' : ''}`}
                                    onClick={() => setActivePatient(p.pid)}>
                                    <div className="lb-pt-tab-ava">{initials}</div>
                                    <div className="lb-pt-tab-info">
                                        <span className="lb-pt-tab-name">{p.patient.full_name}</span>
                                        <span className="lb-pt-tab-sub">
                                            {allDone
                                                ? <><CheckCircle2 size={10}/> All complete</>
                                                : inProgress > 0
                                                    ? <><FlaskConical size={10}/> {inProgress} in progress</>
                                                    : pending > 0
                                                        ? <><Clock size={10}/> {pending} pending</>
                                                        : <span style={{color:'#94a3b8'}}>No tests</span>}
                                        </span>
                                    </div>
                                    <button className="lb-pt-tab-close"
                                        onClick={e => { e.stopPropagation(); closePatient(p.pid); }} title="Close">
                                        <X size={12}/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    {activeEntry && (
                        <PatientTestPanel
                            key={activeEntry.pid}
                            pid={activeEntry.pid}
                            patient={activeEntry.patient}
                            tests={activeEntry.tests}
                            appointments={activeEntry.appointments}
                            technicianId={user?.staff_id}
                            onUpdate={handleTestsUpdate}
                        />
                    )}
                </div>
            )}

            {openPatients.length === 0 && (
                <div className="lb-no-patient-prompt">
                    <ScanBarcode size={38} strokeWidth={1.2}/>
                    <h3>No Patients Open</h3>
                    <p>Scan a barcode or enter a NIC above to view test requests and results.</p>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  UPLOAD RESULTS (dedicated bulk upload tab)
//  Unchanged from original — drag-and-drop file zone, per-test expandable form.
//  Notes are optional here too.
// ══════════════════════════════════════════════════════════════════════════════
function UploadResults({ user }) {
    const [tests,     setTests]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [uploading, setUploading] = useState(null);
    const [expanded,  setExpanded]  = useState({});
    const [forms,     setForms]     = useState({});
    const [dragging,  setDragging]  = useState(null);

    const loadTests = useCallback(() => {
        setLoading(true);
        fetch(`${API}/lab/worklist?status=in_progress`)
            .then(r => r.json())
            .then(d => {
                const list = Array.isArray(d) ? d : (d.tests || []);
                setTests(list);
                if (list.length === 1) setExpanded({ [list[0].test_id]: true });
            })
            .catch(() => setTests([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadTests(); }, [loadTests]);

    const setField = (testId, key, val) =>
        setForms(f => ({ ...f, [testId]: { ...f[testId], [key]: val } }));

    const toggleExpand = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

    const onDragOver  = (e, testId) => { e.preventDefault(); setDragging(testId); };
    const onDragLeave = () => setDragging(null);
    const onDrop = (e, testId) => {
        e.preventDefault(); setDragging(null);
        const file = e.dataTransfer.files[0];
        if (file) setField(testId, 'file', file);
    };

    const handleUpload = async testId => {
        const form = forms[testId] || {};
        if (!form.summary?.trim()) { toast.error('Please enter the findings / summary.'); return; }
        setUploading(testId);
        try {
            const fd = new FormData();
            fd.append('test_id',     testId);
            fd.append('summary',     form.summary);
            fd.append('uploaded_by', user?.staff_id || '');
            // remarks is optional
            if (form.remarks?.trim()) fd.append('remarks', form.remarks.trim());
            if (form.file) fd.append('result_file', form.file);

            const r = await fetch(`${API}/lab/upload-result`, { method: 'POST', body: fd });
            const d = await r.json();
            if (d.success) {
                toast.success('Results uploaded successfully.');
                setTests(prev => prev.filter(t => t.test_id !== testId));
                setForms(f  => { const n = { ...f }; delete n[testId]; return n; });
                setExpanded(e => { const n = { ...e }; delete n[testId]; return n; });
            } else toast.error(d.message || 'Upload failed.');
        } catch { toast.error('Server error.'); }
        finally { setUploading(null); }
    };

    const Steps = () => (
        <div className="lb-workflow-steps">
            {[
                { label:'Requested',  icon:Clock,        status:'requested'   },
                { label:'Processing', icon:FlaskConical, status:'in_progress' },
                { label:'Results',    icon:Upload,       status:'upload'      },
                { label:'Complete',   icon:CheckCircle2, status:'completed'   },
            ].map((step, i) => {
                const active = step.status === 'in_progress' || step.status === 'upload';
                return (
                    <React.Fragment key={step.status}>
                        <div className={`lb-step ${active ? 'active' : ''}`}>
                            <div className={`lb-step-dot ${active ? 'active' : ''}`}><step.icon size={12}/></div>
                            <span>{step.label}</span>
                        </div>
                        {i < 3 && <div className={`lb-step-line ${active ? 'active' : ''}`}/>}
                    </React.Fragment>
                );
            })}
        </div>
    );

    return (
        <div className="lb-section">
            <div className="lb-section-head">
                <div>
                    <h2>Update Test Results</h2>
                    <p>In-progress tests — enter findings and optionally attach a report file</p>
                </div>
                <button className="lb-btn-ghost" onClick={loadTests}>
                    <RefreshCw size={13} className={loading ? 'lb-spin' : ''}/> Refresh
                </button>
            </div>

            <Steps/>

            {loading ? <Spinner/>
            : tests.length === 0
                ? (
                    <div className="lb-upload-empty-guide">
                        <div className="lb-ueg-icon"><Upload size={32}/></div>
                        <h3>No In-Progress Tests</h3>
                        <p>Tests must be marked <strong>In Progress</strong> before results can be uploaded.</p>
                        <div className="lb-ueg-steps">
                            <div className="lb-ueg-step"><span className="lb-ueg-num">1</span>Go to <strong>Worklist</strong> tab</div>
                            <ArrowRight size={14} style={{color:'#94a3b8',flexShrink:0}}/>
                            <div className="lb-ueg-step"><span className="lb-ueg-num">2</span>Click <FlaskConical size={12}/> to mark <em>In Progress</em></div>
                            <ArrowRight size={14} style={{color:'#94a3b8',flexShrink:0}}/>
                            <div className="lb-ueg-step"><span className="lb-ueg-num">3</span>Return here to upload</div>
                        </div>
                    </div>
                )
                : (
                    <div className="lb-upload-list">
                        {tests.map(t => {
                            const form        = forms[t.test_id] || {};
                            const isExpanded  = expanded[t.test_id];
                            const isDragging  = dragging === t.test_id;
                            const isUploading = uploading === t.test_id;
                            const hasFile     = !!form.file;
                            const hasSummary  = !!form.summary?.trim();

                            return (
                                <div key={t.test_id} className={`lb-upload-card ${isExpanded ? 'expanded' : ''}`}>
                                    <div className="lb-upload-card-head"
                                        onClick={() => toggleExpand(t.test_id)}>
                                        <div className="lb-upload-card-left">
                                            <span className={`lb-badge ${typeBadge(t.test_type)}`}>{t.test_type}</span>
                                            <div>
                                                <div className="lb-upload-test-name">{t.test_name}</div>
                                                <div className="lb-upload-test-meta">
                                                    {t.patient_name}
                                                    {t.patient_id && <span className="lb-mono"> · P-{t.patient_id}</span>}
                                                    {t.doctor_name && ` · Dr. ${t.doctor_name}`}
                                                    {t.priority && t.priority !== 'normal' && (
                                                        <span className={`lb-badge ${priorityBadge(t.priority)}`} style={{marginLeft:'6px'}}>{t.priority}</span>
                                                    )}
                                                    {` · ${fmtDate(t.created_at)}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="lb-upload-card-right">
                                            <div className="lb-upload-indicators">
                                                <span className={`lb-indicator ${hasSummary ? 'done' : ''}`} title="Findings">
                                                    <FileText size={12}/> Findings
                                                </span>
                                                <span className={`lb-indicator ${hasFile ? 'done' : ''}`} title="File">
                                                    <Paperclip size={12}/> File
                                                </span>
                                            </div>
                                            <ChevronRight size={16} className={`lb-expand-arrow ${isExpanded ? 'open' : ''}`}/>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="lb-upload-form-body">
                                            {t.clinical_notes && (
                                                <div className="lb-atc-notes" style={{margin:'0 0 14px'}}>
                                                    <Info size={12}/> <strong>Clinical Notes:</strong> {t.clinical_notes}
                                                </div>
                                            )}
                                            <div className="lb-re-grid">
                                                <div className="lb-fg lb-re-findings">
                                                    <label>Findings / Summary <span className="lb-req">*</span></label>
                                                    <textarea className="lb-input lb-ta" rows={5}
                                                        placeholder="Enter test findings, measured values, reference ranges…"
                                                        value={form.summary || ''}
                                                        onChange={e => setField(t.test_id, 'summary', e.target.value)}/>
                                                </div>
                                                <div className="lb-fg lb-re-remarks">
                                                    <label>Remarks <span className="lb-opt">(optional)</span></label>
                                                    <textarea className="lb-input lb-ta" rows={5}
                                                        placeholder="Additional observations — not required…"
                                                        value={form.remarks || ''}
                                                        onChange={e => setField(t.test_id, 'remarks', e.target.value)}/>
                                                </div>
                                            </div>

                                            <div className="lb-fg">
                                                <label>Attach Report <span className="lb-opt">(PDF / JPG / PNG — optional)</span></label>
                                                <div
                                                    className={`lb-drop-zone ${isDragging ? 'dragging' : ''} ${hasFile ? 'has-file' : ''}`}
                                                    onDragOver={e => onDragOver(e, t.test_id)}
                                                    onDragLeave={onDragLeave}
                                                    onDrop={e => onDrop(e, t.test_id)}
                                                    onClick={() => document.getElementById(`file-${t.test_id}`).click()}>
                                                    <input id={`file-${t.test_id}`} type="file" hidden
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={e => setField(t.test_id, 'file', e.target.files[0])}/>
                                                    {hasFile ? (
                                                        <div className="lb-drop-zone-file">
                                                            <div className="lb-drop-file-icon">
                                                                {form.file.type === 'application/pdf'
                                                                    ? <FileText size={22} color="#7c3aed"/>
                                                                    : <Eye size={22} color="#0891b2"/>}
                                                            </div>
                                                            <div>
                                                                <div className="lb-drop-file-name">{form.file.name}</div>
                                                                <div className="lb-drop-file-size">
                                                                    {(form.file.size / 1024).toFixed(1)} KB · Click to replace
                                                                </div>
                                                            </div>
                                                            <button type="button" className="lb-drop-file-remove"
                                                                onClick={e => { e.stopPropagation(); setField(t.test_id, 'file', null); }}>
                                                                <X size={13}/>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="lb-drop-zone-placeholder">
                                                            <Upload size={22}/>
                                                            <div><strong>Click to browse</strong> or drag &amp; drop</div>
                                                            <span>PDF, JPG, PNG up to 10 MB</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="lb-upload-actions">
                                                <button className="lb-btn-primary"
                                                    disabled={isUploading || !hasSummary}
                                                    onClick={() => handleUpload(t.test_id)}>
                                                    {isUploading
                                                        ? <><div className="lb-btn-spin"/>Uploading…</>
                                                        : <><Send size={14}/>Submit Results</>}
                                                </button>
                                                {!hasSummary && (
                                                    <span className="lb-upload-hint">
                                                        <AlertTriangle size={13}/> Findings required
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            }
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MY PROFILE
// ══════════════════════════════════════════════════════════════════════════════
function LabProfile({ user }) {
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
        finally { setSaving(false); }
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
                setPw({ current: '', next: '', confirm: '' }); setPwMode(false);
            } else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="lb-section">
            <div className="lb-profile-banner">
                <div className="lb-profile-ava">{(user?.full_name || 'L')[0].toUpperCase()}</div>
                <div>
                    <h2>{user?.full_name || 'Lab Technician'}</h2>
                    <p>Staff ID: {user?.staff_id} · Diagnostic Technician</p>
                </div>
                <button className={`lb-btn-ghost ${editing ? 'danger' : ''}`}
                    onClick={() => setEditing(e => !e)}>
                    {editing ? <><X size={14}/> Cancel</> : <><Edit3 size={14}/> Edit Profile</>}
                </button>
            </div>

            <div className="lb-card">
                <div className="lb-card-head"><h3><User size={14}/> Professional Details</h3></div>
                <div className="lb-profile-grid">
                    <div className="lb-fg">
                        <label>Email (Username)</label>
                        <div className="lb-locked">{user?.username || user?.email || '—'}<Lock size={11}/></div>
                    </div>
                    <div className="lb-fg">
                        <label>Staff ID</label>
                        <div className="lb-locked">{user?.staff_id || '—'}<Lock size={11}/></div>
                    </div>
                    {[
                        { label: 'First Name', key: 'first_name' },
                        { label: 'Surname',    key: 'surname'    },
                        { label: 'Phone',      key: 'phone'      },
                    ].map(f => (
                        <div key={f.key} className="lb-fg">
                            <label>{f.label}</label>
                            {editing
                                ? <input className="lb-input" value={form[f.key]} onChange={set(f.key)}/>
                                : <div className="lb-profile-val">
                                    {form[f.key] || <span className="lb-empty-val">Not set</span>}
                                  </div>}
                        </div>
                    ))}
                </div>
                {editing && (
                    <div style={{padding:'0 18px 18px'}}>
                        <button className="lb-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="lb-btn-spin"/>Saving…</> : <><Save size={13}/> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="lb-card">
                <div className="lb-card-head">
                    <h3><Lock size={14}/> Change Password</h3>
                    <button className="lb-btn-ghost" onClick={() => setPwMode(m => !m)}>
                        {pwMode ? 'Cancel' : 'Change Password'}
                    </button>
                </div>
                {pwMode && (
                    <div className="lb-pw-form">
                        {[
                            { label: 'Current Password',     key: 'current' },
                            { label: 'New Password',         key: 'next'    },
                            { label: 'Confirm New Password', key: 'confirm' },
                        ].map(f => (
                            <div key={f.key} className="lb-fg">
                                <label>{f.label}</label>
                                <input className="lb-input" type={showPw ? 'text' : 'password'}
                                    value={pw[f.key]}
                                    onChange={e => setPw(p => ({ ...p, [f.key]: e.target.value }))}/>
                            </div>
                        ))}
                        <label className="lb-show-pw-label">
                            <input type="checkbox" checked={showPw}
                                onChange={e => setShowPw(e.target.checked)}/> Show passwords
                        </label>
                        <button className="lb-btn-primary" onClick={handlePwChange} disabled={saving}>
                            {saving ? <><div className="lb-btn-spin"/>Saving…</> : <><Shield size={13}/> Update Password</>}
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
function LabNotifications({ user }) {
    const [notifs,  setNotifs]  = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.staff_id) { setLoading(false); return; }
        fetch(`${API}/staff/notifications/${user.staff_id}`)
            .then(r => r.json()).then(d => setNotifs(d.notifications || []))
            .catch(() => setNotifs([])).finally(() => setLoading(false));
    }, [user]);

    return (
        <div className="lb-section">
            <div className="lb-section-head">
                <h2>Notifications</h2>
                <p>{notifs.length} messages</p>
            </div>
            {loading ? <Spinner/>
            : notifs.length === 0 ? <Empty icon={Bell} text="No notifications."/>
            : (
                <div className="lb-notif-list">
                    {notifs.map((n, i) => (
                        <div key={n.notification_id || i}
                            className={`lb-card lb-notif-card ${n.status === 'sent' ? 'unread' : ''}`}>
                            <div className="lb-notif-icon"><Bell size={15}/></div>
                            <div className="lb-notif-body">
                                <div className="lb-notif-title">{n.email_subject || 'Notification'}</div>
                                <div className="lb-notif-msg">{n.message}</div>
                                <span className="lb-notif-time">{fmtDTime(n.sent_at)}</span>
                            </div>
                            <span className={`lb-badge lb-badge-${n.status}`}>{n.status}</span>
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
function LabFeedback({ user }) {
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
        finally { setSaving(false); }
    };

    return (
        <div className="lb-section">
            <div className="lb-section-head">
                <h2>Feedback</h2>
                <p>Share suggestions or concerns about the diagnostics system</p>
            </div>
            {submitted && (
                <div className="lb-success-banner">
                    <CheckCircle2 size={15}/> Thank you — your feedback was submitted.
                </div>
            )}
            <div className="lb-card" style={{maxWidth:600, marginBottom:'20px'}}>
                <div className="lb-card-head"><h3><MessageSquare size={14}/> Submit Feedback</h3></div>
                <form onSubmit={handleSubmit} style={{padding:'16px'}}>
                    <div className="lb-fg" style={{marginBottom:'14px'}}>
                        <label>Your Comments</label>
                        <textarea className="lb-input lb-ta" rows={5} value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Describe any issues, workflow suggestions, or improvements…"/>
                    </div>
                    <button type="submit" className="lb-btn-primary" disabled={saving || !comment.trim()}>
                        {saving ? <><div className="lb-btn-spin"/> Submitting…</> : <><Send size={14}/> Submit Feedback</>}
                    </button>
                </form>
            </div>
            {!loadingH && history.length > 0 && (
                <div className="lb-card">
                    <div className="lb-card-head">
                        <h3><FileText size={13}/> Your Past Feedback</h3>
                        <span className="lb-badge lb-badge-blue">{history.length}</span>
                    </div>
                    <div style={{padding:'12px 16px'}}>
                        {history.map((f, i) => (
                            <div key={f.feedback_id || i} className="lb-feedback-item">
                                <div className="lb-feedback-meta">
                                    <span className="lb-notif-time">{fmtDTime(f.submitted_at || f.date_submitted)}</span>
                                    {f.status && (
                                        <span className={`lb-badge lb-badge-${
                                            f.status === 'resolved' ? 'green' :
                                            f.status === 'reviewed' ? 'blue'  : 'amber'
                                        }`}>{f.status}</span>
                                    )}
                                </div>
                                <p className="lb-feedback-comment">"{f.comment}"</p>
                                {f.admin_note && (
                                    <div className="lb-admin-note">
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