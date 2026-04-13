import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Common.css';
import './ReceptionistDashboard.css';
import { useNavigate } from 'react-router-dom';
import {
    Home, User, Bell, MessageSquare, LogOut, Search, ScanBarcode, UserPlus,
    Calendar, CheckCircle2, Clock, AlertTriangle, ChevronRight,
    X, RefreshCw, Activity, Phone, Shield, Droplets,
    Edit3, Save, Lock, Eye, EyeOff, FileText, Send,
    Filter, ChevronLeft, ChevronDown, ChevronsLeft, ChevronsRight,
    ArrowUpDown, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

const API      = 'http://localhost:5001/api';
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtTime  = t => { if (!t) return '—'; const [h, m] = t.toString().split(':'); const hr = parseInt(h); return `${String(hr % 12 || 12).padStart(2,'0')}:${m||'00'} ${hr < 12 ? 'AM' : 'PM'}`; };
const fmtDTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : '—';
const calcAge  = dob => { if (!dob) return null; const d = new Date(dob), n = new Date(); let a = n.getFullYear()-d.getFullYear(); if (n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--; return a; };

const Spinner = () => <div className="rec-loading"><div className="rec-spinner"/></div>;
const Empty   = ({ icon: Icon, text }) => (
    <div className="rec-empty"><Icon size={28} style={{opacity:.3}}/><p>{text}</p></div>
);

// ── MAIN SHELL ────────────────────────────────────────────────────────────────
export default function ReceptionistDashboard({ user, setUser }) {
    const [activeTab, setActiveTab] = useState('home');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    const navItems = [
        { id: 'home',          label: 'Home',             icon: Home          },
        { id: 'verify',        label: 'Verify Arrival',   icon: ScanBarcode   },
        { id: 'register',      label: 'Register Patient', icon: UserPlus      },
        { id: 'appointments',  label: 'All Appointments', icon: Calendar      },
        { id: 'profile',       label: 'My Profile',       icon: User          },
        { id: 'notifications', label: 'Notifications',    icon: Bell          },
        { id: 'feedback',      label: 'Feedback',         icon: MessageSquare },
    ];

    return (
        <div className="rec-shell">
            <aside className="rec-sidebar">
                <div className="rec-brand">
                    <div className="rec-brand-icon"><Activity size={16} color="white"/></div>
                    <div>
                        <div className="rec-brand-name">SmartOPD</div>
                        <div className="rec-brand-role">Front Desk</div>
                    </div>
                </div>

                <div className="rec-sidebar-user">
                    <div className="rec-user-ava">{(user?.full_name||'R')[0].toUpperCase()}</div>
                    <div>
                        <div className="rec-user-name">{user?.full_name || 'Receptionist'}</div>
                        <div className="rec-user-role">Receptionist · ID {user?.staff_id}</div>
                    </div>
                </div>

                <nav className="rec-nav">
                    {navItems.map(item => (
                        <button key={item.id}
                            className={`rec-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17}/><span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <button className="rec-nav-item rec-logout" onClick={handleLogout}>
                    <LogOut size={17}/><span>Sign Out</span>
                </button>
            </aside>

            <div className="rec-main">
                <header className="rec-topbar">
                    <div className="rec-breadcrumb">
                        <span>Base Hospital, Kiribathgoda</span>
                        <ChevronRight size={13}/>
                        <strong>{navItems.find(n => n.id === activeTab)?.label}</strong>
                    </div>
                    <div className="rec-topbar-right">
                        <div className="rec-live-dot"/><span className="rec-live-label">OPD Live</span>
                    </div>
                </header>

                <div className="rec-content">
                    {activeTab === 'home'          && <ReceptionHome user={user}/>}
                    {activeTab === 'verify'        && <VerifyArrival/>}
                    {activeTab === 'register'      && <RegisterPatient user={user} onDone={() => setActiveTab('home')}/>}
                    {activeTab === 'appointments'  && <AllAppointments/>}
                    {activeTab === 'profile'       && <ReceptionProfile user={user}/>}
                    {activeTab === 'notifications' && <ReceptionNotifications user={user}/>}
                    {activeTab === 'feedback'      && <ReceptionFeedback user={user}/>}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HOME / OVERVIEW
//  FIX: Removed "New Registrations" card; replaced with "Completed" card.
//       All cards now reflect real-time DB data from /api/receptionist/stats.
// ══════════════════════════════════════════════════════════════════════════════
function ReceptionHome({ user }) {
    const [stats,   setStats]   = useState({ totalToday:0, arrived:0, pending:0, completed:0 });
    const [queue,   setQueue]   = useState([]);
    const [loading, setLoading] = useState(true);
    const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sRes, qRes] = await Promise.all([
                fetch(`${API}/receptionist/stats`),
                fetch(`${API}/receptionist/queue`),
            ]);
            const [sData, qData] = await Promise.all([sRes.json(), qRes.json()]);
            if (sData.success) setStats(sData.stats);
            if (qData.success) setQueue(qData.queue || []);
        } catch { toast.error('Failed to load queue.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleMarkArrived = async apptId => {
        try {
            const r = await fetch(`${API}/receptionist/mark-arrived`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment_id: apptId })
            });
            const d = await r.json();
            if (d.success) { toast.success('Patient marked as arrived.'); load(); }
            else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
    };

    // CHANGE: replaced "New Registrations" with "Completed Today"
    const statCards = [
        { label: "Today's Appointments", val: stats.totalToday,  icon: Calendar,     color: 'blue'  },
        { label: 'Arrived / Present',    val: stats.arrived,     icon: CheckCircle2, color: 'green' },
        { label: 'Pending / Waiting',    val: stats.pending,     icon: Clock,        color: 'amber' },
        { label: 'Completed Today',      val: stats.completed,   icon: Activity,     color: 'purple'},
    ];

    return (
        <div className="rec-section">
            <div className="rec-hero">
                <div>
                    <h1 className="rec-hero-title">Good morning, {user?.full_name?.split(' ')[0] || 'Receptionist'}</h1>
                    <p className="rec-hero-sub">{today}</p>
                </div>
                <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                    <div className="rec-hero-badge">
                        <div className="rec-live-dot"/><span>Front Desk Active</span>
                    </div>
                    <button className="rec-btn-ghost" onClick={load}>
                        <RefreshCw size={13} className={loading ? 'spin' : ''}/> Refresh
                    </button>
                </div>
            </div>

            <div className="rec-stat-grid">
                {statCards.map(s => (
                    <div key={s.label} className={`rec-stat rec-stat-${s.color}`}>
                        <div className="rec-stat-icon"><s.icon size={20}/></div>
                        <div>
                            <div className="rec-stat-val">{s.val}</div>
                            <div className="rec-stat-label">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rec-card">
                <div className="rec-card-head">
                    <h3><Calendar size={14}/> Today's Appointment Queue</h3>
                    <button className="rec-btn-ghost" onClick={load}>
                        <RefreshCw size={13} className={loading ? 'spin' : ''}/> Refresh
                    </button>
                </div>
                {loading ? <Spinner/>
                : queue.length === 0 ? <Empty icon={Calendar} text="No appointments today."/>
                : (
                    <table className="rec-table">
                        <thead><tr>
                            <th>Token</th><th>Patient</th><th>NIC</th>
                            <th>Time Slot</th><th>Visit Type</th><th>Status</th><th>Action</th>
                        </tr></thead>
                        <tbody>
                            {queue.map(a => (
                                <tr key={a.appointment_id}>
                                    <td><span className="rec-token">#{a.queue_no}</span></td>
                                    <td>
                                        <div className="rec-name-cell">
                                            <div className="rec-ava-sm">{(a.full_name||'?')[0]}</div>
                                            <div>
                                                <strong>{a.full_name}</strong>
                                                <div className="rec-sub rec-mono">{a.barcode}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="rec-mono rec-dimmed">{a.nic || '—'}</td>
                                    <td className="rec-mono">{fmtTime(a.start_time)} – {fmtTime(a.end_time)}</td>
                                    <td>{a.visit_type}</td>
                                    <td>
                                        <span className={`rec-badge rec-badge-${a.status}`}>
                                            {a.is_present ? '✓ Arrived' : a.status}
                                        </span>
                                    </td>
                                    <td>
                                        {!a.is_present && a.status === 'booked' && (
                                            <button className="rec-btn-primary rec-btn-sm"
                                                onClick={() => handleMarkArrived(a.appointment_id)}>
                                                Mark Arrived
                                            </button>
                                        )}
                                        {a.is_present && (
                                            <span className="rec-arrived-tag"><CheckCircle2 size={13}/> Present</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PATIENT DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════════════
function PatientDetailPanel({ entry, onUpdate }) {
    const [marking, setMarking] = useState(false);
    const { patient, appointments } = entry;
    const age = calcAge(patient?.dob);

    const handleMarkArrived = async apptId => {
        setMarking(apptId);
        try {
            const r = await fetch(`${API}/receptionist/mark-arrived`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment_id: apptId })
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Patient arrival confirmed!');
                const r2 = await fetch(
                    `${API}/receptionist/verify-arrival?term=${encodeURIComponent(patient.barcode)}`
                );
                const d2 = await r2.json();
                if (d2.success) onUpdate(d2);
            } else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
        finally { setMarking(false); }
    };

    const statusColor = s =>
        ({ booked:'blue', completed:'green', cancelled:'grey', no_show:'amber' }[s] || 'blue');

    return (
        <div className="rec-patient-panel">
            <div className="rec-pt-header">
                <div className="rec-pt-ava">
                    {(patient.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <div className="rec-pt-info">
                    <h2 className="rec-pt-name">{patient.full_name}</h2>
                    <div className="rec-pt-meta">
                        {age !== null && (
                            <span><User size={12}/> {age} yrs{patient.gender ? `, ${patient.gender}` : ''}</span>
                        )}
                        {patient.nic        && <span><Shield size={12}/> {patient.nic}</span>}
                        {patient.phone      && <span><Phone size={12}/> {patient.phone}</span>}
                        {patient.blood_group && <span><Droplets size={12}/> {patient.blood_group}</span>}
                        <span className="rec-pt-barcode">{patient.barcode}</span>
                    </div>
                    {patient.allergies && patient.allergies.toLowerCase() !== 'none' && (
                        <div className="rec-allergy" style={{marginTop:'8px'}}>
                            <AlertTriangle size={12}/>
                            Allergies: <strong>{patient.allergies}</strong>
                        </div>
                    )}
                </div>
            </div>

            <div className="rec-card">
                <div className="rec-card-head">
                    <h3><Calendar size={14}/> Appointments ({appointments?.length || 0})</h3>
                </div>
                {!appointments?.length
                    ? <Empty icon={Calendar} text="No appointments found for this patient."/>
                    : (
                        <table className="rec-table">
                            <thead><tr>
                                <th>Date</th><th>Time</th><th>Token</th>
                                <th>Visit</th><th>Status</th><th>Present</th><th>Action</th>
                            </tr></thead>
                            <tbody>
                                {appointments.map(a => (
                                    <tr key={a.appointment_id}
                                        className={a.is_today ? 'rec-row-highlight' : ''}>
                                        <td>
                                            <strong>{fmtDate(a.appointment_day)}</strong>
                                            {a.is_today && <span className="rec-today-tag">Today</span>}
                                        </td>
                                        <td className="rec-mono">
                                            {fmtTime(a.start_time)} – {fmtTime(a.end_time)}
                                        </td>
                                        <td><span className="rec-token">#{a.queue_no}</span></td>
                                        <td>{a.visit_type}</td>
                                        <td>
                                            <span className={`rec-badge rec-badge-${statusColor(a.status)}`}>
                                                {a.status}
                                            </span>
                                        </td>
                                        <td>
                                            {a.is_present
                                                ? <span className="rec-arrived-tag"><CheckCircle2 size={13}/> Yes</span>
                                                : <span className="rec-badge rec-badge-grey">Not yet</span>}
                                        </td>
                                        <td>
                                            {a.is_today && a.status === 'booked' && !a.is_present && (
                                                <button className="rec-btn-primary rec-btn-sm"
                                                    disabled={marking === a.appointment_id}
                                                    onClick={() => handleMarkArrived(a.appointment_id)}>
                                                    {marking === a.appointment_id
                                                        ? <><div className="rec-btn-spin"/>…</>
                                                        : <><CheckCircle2 size={12}/>Confirm Arrival</>}
                                                </button>
                                            )}
                                            {a.is_today && a.is_present && (
                                                <span className="rec-arrived-tag">
                                                    <CheckCircle2 size={13}/> Confirmed
                                                </span>
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

// ══════════════════════════════════════════════════════════════════════════════
//  VERIFY ARRIVAL
//  ENHANCEMENT: Added webcam-based barcode scanning via BarcodeDetector API
//               with graceful fallback to manual entry.
// ══════════════════════════════════════════════════════════════════════════════
function VerifyArrival() {
    const [mode,          setMode]          = useState('barcode');
    const [query,         setQuery]         = useState('');
    const [searched,      setSearched]      = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [scanning,      setScanning]      = useState(false);   // webcam active
    const [camError,      setCamError]      = useState('');

    const [openPatients,  setOpenPatients]  = useState([]);
    const [activePatient, setActivePatient] = useState(null);

    const inputRef   = useRef(null);
    const videoRef   = useRef(null);
    const streamRef  = useRef(null);
    const rafRef     = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, [mode]);

    // Stop webcam on unmount or mode switch
    useEffect(() => {
        return () => stopCamera();
    }, []);

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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setScanning(true);
            detectBarcodes();
        } catch (err) {
            setCamError('Camera access denied or unavailable. Use manual entry instead.');
        }
    };

    const detectBarcodes = async () => {
        // BarcodeDetector is available in modern Chrome/Edge
        if (!('BarcodeDetector' in window)) {
            setCamError('Barcode detection not supported in this browser. Use manual entry.');
            stopCamera();
            return;
        }
        const detector = new window.BarcodeDetector({ formats: ['qr_code','code_128','code_39','ean_13'] });

        const scan = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    const value = barcodes[0].rawValue;
                    stopCamera();
                    setQuery(value);
                    // Auto-search immediately on scan
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
        nic:     { label:'NIC Number',           placeholder:'Enter NIC — e.g. 200375713581 or 990234567V', icon: Shield },
    };

    const switchMode = m => {
        stopCamera();
        setMode(m);
        setQuery('');
        setSearched(false);
    };

    const clearSearch = () => { setQuery(''); setSearched(false); inputRef.current?.focus(); };

    const doSearch = async (term) => {
        const q = (term || query).trim();
        if (!q) return;
        setLoading(true); setSearched(true);
        try {
            const r = await fetch(`${API}/receptionist/verify-arrival?term=${encodeURIComponent(q)}`);
            const d = await r.json();
            if (d.success) {
                const pid = d.patient.patient_id;
                const alreadyOpen = openPatients.find(p => p.pid === pid);
                if (alreadyOpen) {
                    setActivePatient(pid);
                    toast(`${d.patient.full_name} is already open.`, { icon: '👆' });
                } else {
                    setOpenPatients(prev => [...prev, { pid, ...d }]);
                    setActivePatient(pid);
                }
                setQuery(''); setSearched(false);
            } else {
                toast.error(d.message || `No patient found for this ${modeCfg[mode].label}.`);
            }
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

    const handlePatientUpdate = (pid, freshData) => {
        setOpenPatients(prev => prev.map(p => p.pid === pid ? { ...p, ...freshData } : p));
    };

    const activeEntry = openPatients.find(p => p.pid === activePatient);

    return (
        <div className="rec-section">
            <div className="rec-section-head">
                <h2>Verify Patient Arrival</h2>
                <p>Search by barcode / webcam scan, or NIC — each patient opens in a separate tab</p>
            </div>

            <div className="rec-lookup-card">
                {/* Mode tabs */}
                <div className="rec-mode-tabs">
                    {Object.entries(modeCfg).map(([id, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                            <button key={id}
                                className={`rec-mode-tab ${mode === id ? 'active' : ''}`}
                                onClick={() => switchMode(id)}>
                                <Icon size={14}/>{cfg.label}
                            </button>
                        );
                    })}
                </div>

                {/* Webcam scanner (barcode mode only) */}
                {mode === 'barcode' && (
                    <div className="rec-cam-area">
                        {scanning ? (
                            <div className="rec-cam-wrapper">
                                <video ref={videoRef} className="rec-cam-video" playsInline muted/>
                                <div className="rec-cam-overlay">
                                    <div className="rec-cam-crosshair"/>
                                    <p className="rec-cam-hint">Point camera at barcode</p>
                                </div>
                                <button className="rec-btn-ghost rec-cam-stop" onClick={stopCamera}>
                                    <X size={13}/> Stop Camera
                                </button>
                            </div>
                        ) : (
                            <button className="rec-btn-ghost rec-cam-start" onClick={startCamera}>
                                <ScanBarcode size={15}/> Use Webcam Scanner
                            </button>
                        )}
                        {camError && (
                            <p className="rec-cam-error"><AlertTriangle size={13}/> {camError}</p>
                        )}
                    </div>
                )}

                {/* Manual search input */}
                <div className="rec-search-row">
                    <div className="rec-search-wrap">
                        <Search size={16} className="rec-search-ico"/>
                        <input
                            ref={inputRef}
                            className="rec-search-input"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={modeCfg[mode].placeholder}
                        />
                        {query && (
                            <button className="rec-clear" onClick={clearSearch}>
                                <X size={14}/>
                            </button>
                        )}
                    </div>
                    <button className="rec-btn-primary"
                        onClick={handleSearch} disabled={loading || !query.trim()}>
                        {loading
                            ? <><div className="rec-btn-spin"/> Searching…</>
                            : <><Search size={14}/> Open Patient</>}
                    </button>
                </div>

                {searched && !loading && (
                    <div className="rec-lookup-empty">
                        <AlertTriangle size={16} style={{opacity:.4}}/>
                        <span>No patient found for "<strong>{query}</strong>" by {modeCfg[mode].label}.</span>
                    </div>
                )}
            </div>

            {openPatients.length > 0 && (
                <div className="rec-pt-tabs-area">
                    <div className="rec-pt-tab-strip">
                        {openPatients.map(p => {
                            const initials = (p.patient.full_name || '?')
                                .split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                            const todayAppt = p.appointments?.find(a => a.is_today && a.status === 'booked');
                            const arrived   = p.appointments?.find(a => a.is_today && a.is_present);
                            return (
                                <div key={p.pid}
                                    className={`rec-pt-tab ${activePatient === p.pid ? 'active' : ''}`}
                                    onClick={() => setActivePatient(p.pid)}>
                                    <div className="rec-pt-tab-ava">{initials}</div>
                                    <div className="rec-pt-tab-info">
                                        <span className="rec-pt-tab-name">{p.patient.full_name}</span>
                                        <span className="rec-pt-tab-sub">
                                            {arrived
                                                ? <><CheckCircle2 size={10}/> Arrived</>
                                                : todayAppt
                                                    ? <><Clock size={10}/> Pending</>
                                                    : <span style={{color:'#94a3b8'}}>No appt today</span>}
                                        </span>
                                    </div>
                                    <button className="rec-pt-tab-close"
                                        onClick={e => { e.stopPropagation(); closePatient(p.pid); }}
                                        title="Close">
                                        <X size={12}/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {activeEntry && (
                        <PatientDetailPanel
                            key={activeEntry.pid}
                            entry={activeEntry}
                            onUpdate={freshData => handlePatientUpdate(activeEntry.pid, freshData)}
                        />
                    )}
                </div>
            )}

            {openPatients.length === 0 && (
                <div className="rec-no-patient-prompt">
                    <ScanBarcode size={38} strokeWidth={1.2}/>
                    <h3>No Patients Open</h3>
                    <p>Scan a barcode or enter a NIC above to open a patient record.</p>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  REGISTER PATIENT
//  ENHANCEMENT: Expanded form with all hospital fields including medical info.
//               Auto-generate barcode preview. Better section layout.
// ══════════════════════════════════════════════════════════════════════════════
function RegisterPatient({ user, onDone }) {
    const [saving,     setSaving]    = useState(false);
    const [done,       setDone]      = useState(null);
    const [showPw,     setShowPw]    = useState(false);
    const [form,       setForm]      = useState({
        full_name: '', nic: '', dob: '', gender: '',
        civil_status: '', blood_group: '',
        address: '', phone: '', email: '',
        emergency_contact: '', allergies: '', chronic_conditions: '',
        password: 'SmartOPD@123',
    });

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
    const previewUsername = form.email?.trim() || form.phone?.trim() || '';

    const validate = () => {
        if (!form.full_name.trim())        { toast.error('Full name is required.');                              return false; }
        if (!/^([0-9]{9}[xXvV]|[0-9]{12})$/.test(form.nic)) {
            toast.error('Invalid NIC — e.g. 200375713581 or 990234567V');                                        return false;
        }
        if (!form.dob)                     { toast.error('Date of birth is required.');                          return false; }
        if (!form.gender)                  { toast.error('Gender is required.');                                 return false; }
        if (!form.phone?.trim() && !form.email?.trim()) {
            toast.error('At least one contact (phone or email) is required.');                                   return false;
        }
        if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            toast.error('Invalid email address.');                                                                return false;
        }
        if (form.phone?.trim() && !/^[0-9+\s\-]{7,15}$/.test(form.phone.trim())) {
            toast.error('Invalid phone number.');                                                                 return false;
        }
        if (!form.password || form.password.length < 6) {
            toast.error('Password must be at least 6 characters.');                                              return false;
        }
        return true;
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const r = await fetch(`${API}/receptionist/register-patient`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, registered_by: user?.staff_id })
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Patient registered successfully!');
                setDone({ barcode: d.qrCode, patientId: d.patientId, full_name: form.full_name });
                setForm({ full_name:'', nic:'', dob:'', gender:'', civil_status:'', blood_group:'',
                    address:'', phone:'', email:'', emergency_contact:'', allergies:'',
                    chronic_conditions:'', password:'SmartOPD@123' });
            } else toast.error(d.message || 'Registration failed.');
        } catch { toast.error('Server error.'); }
        finally { setSaving(false); }
    };

    if (done) return (
        <div className="rec-section">
            <div className="rec-success-card">
                <div className="rec-success-icon"><CheckCircle2 size={48} color="#16a34a"/></div>
                <h2>Patient Registered Successfully</h2>
                <p><strong>{done.full_name}</strong> has been added to the system.</p>
                <div className="rec-barcode-result">
                    <label>Patient Barcode / ID</label>
                    <div className="rec-barcode-val">{done.barcode}</div>
                    <p>Give this barcode to the patient — they will need it for OPD slips and future visits.</p>
                </div>
                <div className="rec-success-actions">
                    <button className="rec-btn-primary" onClick={() => setDone(null)}>
                        <UserPlus size={14}/> Register Another
                    </button>
                    <button className="rec-btn-ghost" onClick={onDone}>Back to Overview</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="rec-section">
            <div className="rec-section-head">
                <div>
                    <h2>Register New Patient</h2>
                    <p>Walk-in registration — complete patient record</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="rec-reg-form">

                {/* ── Personal Information ─────────────────────────── */}
                <div className="rec-form-block">
                    <div className="rec-form-block-title"><User size={14}/> Personal Information</div>
                    <div className="rec-grid-2">
                        <div className="rec-fg wide">
                            <label>Full Name <span className="req">*</span></label>
                            <input className="rec-input" required
                                placeholder="As per NIC — e.g. Kamal Perera"
                                value={form.full_name} onChange={set('full_name')}/>
                        </div>
                        <div className="rec-fg">
                            <label>NIC Number <span className="req">*</span></label>
                            <input className="rec-input" required
                                placeholder="e.g. 200375713581 or 990234567V"
                                value={form.nic} onChange={set('nic')}/>
                        </div>
                        <div className="rec-fg">
                            <label>Date of Birth <span className="req">*</span></label>
                            <input className="rec-input" type="date" required
                                value={form.dob} onChange={set('dob')}/>
                        </div>
                        <div className="rec-fg">
                            <label>Gender <span className="req">*</span></label>
                            <select className="rec-input" required value={form.gender} onChange={set('gender')}>
                                <option value="">Select gender</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="rec-fg">
                            <label>Civil Status</label>
                            <select className="rec-input" value={form.civil_status} onChange={set('civil_status')}>
                                <option value="">Select status</option>
                                <option>Single</option>
                                <option>Married</option>
                                <option>Divorced</option>
                                <option>Widowed</option>
                            </select>
                        </div>
                        <div className="rec-fg">
                            <label>Blood Group</label>
                            <select className="rec-input" value={form.blood_group} onChange={set('blood_group')}>
                                <option value="">Select blood group</option>
                                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                                    <option key={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                        <div className="rec-fg wide">
                            <label>Home Address</label>
                            <input className="rec-input"
                                placeholder="e.g. 45/A, Main Street, Kiribathgoda"
                                value={form.address} onChange={set('address')}/>
                        </div>
                    </div>
                </div>

                {/* ── Contact Details ──────────────────────────────── */}
                <div className="rec-form-block">
                    <div className="rec-form-block-title"><Phone size={14}/> Contact Details</div>
                    <div className="rec-contact-note">
                        At least one of phone or email is required — this becomes the login username.
                        If both are provided, <strong>email is used as the username</strong>.
                    </div>
                    <div className="rec-grid-2">
                        <div className="rec-fg">
                            <label>Mobile Phone</label>
                            <input className="rec-input" type="tel"
                                placeholder="e.g. 0771234567"
                                value={form.phone} onChange={set('phone')}/>
                        </div>
                        <div className="rec-fg">
                            <label>Email Address</label>
                            <input className="rec-input" type="email"
                                placeholder="e.g. patient@email.com"
                                value={form.email} onChange={set('email')}/>
                        </div>
                        <div className="rec-fg wide">
                            <label>Emergency Contact</label>
                            <input className="rec-input"
                                placeholder="Name & phone — e.g. Nimal Perera · 0712345678"
                                value={form.emergency_contact} onChange={set('emergency_contact')}/>
                        </div>
                    </div>
                </div>

                {/* ── Medical Information ──────────────────────────── */}
                <div className="rec-form-block">
                    <div className="rec-form-block-title"><Activity size={14}/> Medical Information</div>
                    <div className="rec-grid-2">
                        <div className="rec-fg wide">
                            <label>Known Allergies</label>
                            <input className="rec-input"
                                placeholder="e.g. Penicillin, Peanuts — or 'None'"
                                value={form.allergies} onChange={set('allergies')}/>
                        </div>
                        <div className="rec-fg wide">
                            <label>Chronic Conditions</label>
                            <input className="rec-input"
                                placeholder="e.g. Diabetes, Hypertension — or 'None'"
                                value={form.chronic_conditions} onChange={set('chronic_conditions')}/>
                        </div>
                    </div>
                </div>

                {/* ── Login Account ────────────────────────────────── */}
                <div className="rec-form-block">
                    <div className="rec-form-block-title"><Lock size={14}/> Login Account</div>
                    <div className="rec-account-info-box">
                        <div className="rec-account-row">
                            <span>Username</span>
                            <code>{previewUsername || '(enter phone or email above)'}</code>
                        </div>
                        <div className="rec-account-row">
                            <span>Password</span>
                            <div className="rec-pw-inline">
                                <input className="rec-input rec-pw-input"
                                    type={showPw ? 'text' : 'password'}
                                    value={form.password} onChange={set('password')}
                                    placeholder="Minimum 6 characters"/>
                                <button type="button" className="rec-pw-toggle"
                                    onClick={() => setShowPw(s => !s)}>
                                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                                </button>
                            </div>
                        </div>
                        <p>The patient should change this password after their first login.</p>
                    </div>
                </div>

                <button type="submit" className="rec-btn-primary rec-btn-submit" disabled={saving}>
                    {saving
                        ? <><div className="rec-btn-spin"/> Registering…</>
                        : <><UserPlus size={16}/> Register Patient</>}
                </button>
            </form>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ALL APPOINTMENTS
//  ENHANCEMENT: Date range filter, "View All" mode, search by name/NIC/ID,
//               column sorting, pagination.
// ══════════════════════════════════════════════════════════════════════════════
function AllAppointments() {
    const today = new Date().toISOString().split('T')[0];

    const [appts,     setAppts]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [filterMode,setFilterMode]= useState('date');   // 'date' | 'range' | 'all'
    const [filter,    setFilter]    = useState({ date: today, from: today, to: today, status: 'all' });
    const [search,    setSearch]    = useState('');
    const [sortKey,   setSortKey]   = useState('queue_no');
    const [sortDir,   setSortDir]   = useState('asc');
    const [page,      setPage]      = useState(1);
    const PAGE_SIZE = 15;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterMode === 'date') {
                params.set('date', filter.date);
            } else if (filterMode === 'range') {
                params.set('from', filter.from);
                params.set('to',   filter.to);
            }
            // filterMode === 'all' → no date params → backend returns all
            if (filter.status !== 'all') params.set('status', filter.status);

            const r = await fetch(`${API}/receptionist/appointments?${params}`);
            const d = await r.json();
            if (d.success) { setAppts(d.appointments || []); setPage(1); }
        } catch { toast.error('Failed to load appointments.'); }
        finally { setLoading(false); }
    }, [filter, filterMode]);

    useEffect(() => { load(); }, [load]);

    // Search filter (client-side)
    const searched = appts.filter(a => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (a.full_name || '').toLowerCase().includes(q) ||
            (a.nic       || '').toLowerCase().includes(q) ||
            (a.barcode   || '').toLowerCase().includes(q) ||
            String(a.patient_id || '').includes(q)
        );
    });

    // Sorting
    const sorted = [...searched].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (sortKey === 'appointment_day') { av = new Date(av); bv = new Date(bv); }
        if (sortKey === 'queue_no')        { av = Number(av);   bv = Number(bv);   }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ?  1 : -1;
        return 0;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleSort = key => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const SortTh = ({ col, label }) => (
        <th className="rec-sort-th" onClick={() => toggleSort(col)}>
            {label} {sortKey === col
                ? (sortDir === 'asc' ? '↑' : '↓')
                : <ArrowUpDown size={11} style={{opacity:.3}}/>}
        </th>
    );

    const counts = {
        all:       appts.length,
        booked:    appts.filter(a => a.status === 'booked').length,
        completed: appts.filter(a => a.status === 'completed').length,
        cancelled: appts.filter(a => a.status === 'cancelled').length,
    };

    return (
        <div className="rec-section">
            <div className="rec-section-head">
                <div>
                    <h2>All Appointments</h2>
                    <p>Advanced filtering, search and sort</p>
                </div>
                <button className="rec-btn-ghost" onClick={load}>
                    <RefreshCw size={13}/> Refresh
                </button>
            </div>

            {/* ── Filter mode selector ────────────────────────────── */}
            <div className="rec-filter-mode-tabs">
                {[
                    { id:'date',  label:'By Date'       },
                    { id:'range', label:'Date Range'    },
                    { id:'all',   label:'All History'   },
                ].map(m => (
                    <button key={m.id}
                        className={`rec-filter-mode-tab ${filterMode === m.id ? 'active' : ''}`}
                        onClick={() => { setFilterMode(m.id); setPage(1); }}>
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="rec-filter-bar">
                {filterMode === 'date' && (
                    <div className="rec-fg" style={{minWidth:'180px'}}>
                        <label>Date</label>
                        <input className="rec-input" type="date" value={filter.date}
                            onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}/>
                    </div>
                )}
                {filterMode === 'range' && (<>
                    <div className="rec-fg" style={{minWidth:'160px'}}>
                        <label>From</label>
                        <input className="rec-input" type="date" value={filter.from}
                            onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}/>
                    </div>
                    <div className="rec-fg" style={{minWidth:'160px'}}>
                        <label>To</label>
                        <input className="rec-input" type="date" value={filter.to}
                            onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}/>
                    </div>
                </>)}
                <div className="rec-fg" style={{minWidth:'160px'}}>
                    <label>Status</label>
                    <select className="rec-input" value={filter.status}
                        onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                        <option value="all">All ({counts.all})</option>
                        <option value="booked">Booked ({counts.booked})</option>
                        <option value="completed">Completed ({counts.completed})</option>
                        <option value="cancelled">Cancelled ({counts.cancelled})</option>
                    </select>
                </div>
                {/* Search */}
                <div className="rec-fg rec-search-fg" style={{minWidth:'220px',flex:2}}>
                    <label>Search</label>
                    <div className="rec-search-wrap">
                        <Search size={14} className="rec-search-ico"/>
                        <input className="rec-search-input"
                            placeholder="Name, NIC, Barcode or Patient ID…"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}/>
                        {search && (
                            <button className="rec-clear" onClick={() => setSearch('')}>
                                <X size={12}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="rec-card">
                <div className="rec-card-head" style={{justifyContent:'space-between'}}>
                    <span style={{fontSize:'0.82rem',color:'#64748b'}}>
                        Showing {paginated.length} of {sorted.length} results
                        {search && ` (filtered from ${appts.length})`}
                    </span>
                </div>
                {loading ? <Spinner/>
                : paginated.length === 0
                    ? <Empty icon={Calendar} text="No appointments found for this filter."/>
                    : (<>
                        <table className="rec-table">
                            <thead><tr>
                                <SortTh col="queue_no"       label="#"          />
                                <th>Patient</th>
                                <th>NIC</th>
                                <SortTh col="appointment_day" label="Date"      />
                                <th>Time Slot</th>
                                <th>Visit Type</th>
                                <th>Status</th>
                                <th>Present</th>
                            </tr></thead>
                            <tbody>
                                {paginated.map(a => (
                                    <tr key={a.appointment_id}>
                                        <td><span className="rec-token">#{a.queue_no}</span></td>
                                        <td>
                                            <div className="rec-name-cell">
                                                <div className="rec-ava-sm">{(a.full_name||'?')[0]}</div>
                                                <div>
                                                    <strong>{a.full_name}</strong>
                                                    <div className="rec-sub rec-mono">{a.barcode}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="rec-mono rec-dimmed">{a.nic || '—'}</td>
                                        <td>{fmtDate(a.appointment_day)}</td>
                                        <td className="rec-mono">{fmtTime(a.start_time)} – {fmtTime(a.end_time)}</td>
                                        <td>{a.visit_type}</td>
                                        <td>
                                            <span className={`rec-badge rec-badge-${a.status}`}>{a.status}</span>
                                        </td>
                                        <td>
                                            {a.is_present
                                                ? <span className="rec-arrived-tag"><CheckCircle2 size={12}/> Yes</span>
                                                : <span className="rec-badge rec-badge-grey">No</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="rec-pagination">
                                <button className="rec-page-btn" disabled={page === 1} onClick={() => setPage(1)}>
                                    <ChevronsLeft size={14}/>
                                </button>
                                <button className="rec-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                    <ChevronLeft size={14}/>
                                </button>
                                <span className="rec-page-info">Page {page} of {totalPages}</span>
                                <button className="rec-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                                    <ChevronRight size={14}/>
                                </button>
                                <button className="rec-page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                                    <ChevronsRight size={14}/>
                                </button>
                            </div>
                        )}
                    </>)
                }
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MY PROFILE
// ══════════════════════════════════════════════════════════════════════════════
function ReceptionProfile({ user }) {
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
                setPw({ current:'', next:'', confirm:'' });
                setPwMode(false);
            } else toast.error(d.message || 'Failed.');
        } catch { toast.error('Server error.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="rec-section">
            <div className="rec-profile-banner">
                <div className="rec-profile-ava">{(user?.full_name||'R')[0].toUpperCase()}</div>
                <div>
                    <h2>{user?.full_name}</h2>
                    <p>Staff ID: {user?.staff_id} · Receptionist</p>
                </div>
                <button className={`rec-btn-ghost ${editing ? 'danger' : ''}`}
                    onClick={() => setEditing(e => !e)}>
                    {editing ? <><X size={14}/> Cancel</> : <><Edit3 size={14}/> Edit Profile</>}
                </button>
            </div>

            <div className="rec-card">
                <div className="rec-card-head"><h3><User size={14}/> Professional Details</h3></div>
                <div className="rec-profile-grid">
                    <div className="rec-fg">
                        <label>Email (Username)</label>
                        <div className="rec-locked">{user?.username || user?.email || '—'} <Lock size={11}/></div>
                    </div>
                    <div className="rec-fg">
                        <label>Staff ID</label>
                        <div className="rec-locked">{user?.staff_id || '—'} <Lock size={11}/></div>
                    </div>
                    {[
                        { label:'First Name', key:'first_name' },
                        { label:'Surname',    key:'surname'    },
                        { label:'Phone',      key:'phone'      },
                    ].map(f => (
                        <div key={f.key} className="rec-fg">
                            <label>{f.label}</label>
                            {editing
                                ? <input className="rec-input" value={form[f.key]} onChange={set(f.key)}/>
                                : <div className="rec-profile-val">
                                    {form[f.key] || <span className="rec-empty-val">Not set</span>}
                                  </div>}
                        </div>
                    ))}
                </div>
                {editing && (
                    <div style={{padding:'0 18px 18px'}}>
                        <button className="rec-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <><div className="rec-btn-spin"/> Saving…</> : <><Save size={13}/> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="rec-card">
                <div className="rec-card-head">
                    <h3><Lock size={14}/> Change Password</h3>
                    <button className="rec-btn-ghost" onClick={() => setPwMode(m => !m)}>
                        {pwMode ? 'Cancel' : 'Change Password'}
                    </button>
                </div>
                {pwMode && (
                    <div className="rec-pw-form">
                        {[
                            { label:'Current Password',     key:'current' },
                            { label:'New Password',         key:'next'    },
                            { label:'Confirm New Password', key:'confirm' },
                        ].map(f => (
                            <div key={f.key} className="rec-fg">
                                <label>{f.label}</label>
                                <input className="rec-input" type={showPw ? 'text' : 'password'}
                                    value={pw[f.key]}
                                    onChange={e => setPw(p => ({ ...p, [f.key]: e.target.value }))}/>
                            </div>
                        ))}
                        <label className="rec-show-pw-label">
                            <input type="checkbox" checked={showPw}
                                onChange={e => setShowPw(e.target.checked)}/> Show passwords
                        </label>
                        <button className="rec-btn-primary" style={{marginTop:'8px'}}
                            onClick={handlePwChange} disabled={saving}>
                            {saving ? <><div className="rec-btn-spin"/> Saving…</> : <><Shield size={13}/> Update Password</>}
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
function ReceptionNotifications({ user }) {
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
        <div className="rec-section">
            <div className="rec-section-head">
                <h2>Notifications</h2>
                <p>{notifs.length} messages</p>
            </div>
            {loading ? <Spinner/>
            : notifs.length === 0 ? <Empty icon={Bell} text="No notifications."/>
            : (
                <div className="rec-notif-list">
                    {notifs.map((n, i) => (
                        <div key={n.notification_id || i}
                            className={`rec-notif-card ${n.status === 'sent' ? 'unread' : ''}`}>
                            <div className="rec-notif-icon"><Bell size={15}/></div>
                            <div className="rec-notif-body">
                                <div className="rec-notif-title">{n.email_subject || 'Notification'}</div>
                                <div className="rec-notif-msg">{n.message}</div>
                                <div className="rec-notif-time">{fmtDTime(n.sent_at)}</div>
                            </div>
                            <span className={`rec-badge rec-badge-${n.status}`}>{n.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  FEEDBACK
//  ENHANCEMENT: Added star rating, category selector, character counter,
//               richer history with admin response display.
// ══════════════════════════════════════════════════════════════════════════════
function ReceptionFeedback({ user }) {
    const [comment,   setComment]   = useState('');
    const [rating,    setRating]    = useState(0);
    const [hoverStar, setHoverStar] = useState(0);
    const [category,  setCategory]  = useState('general');
    const [saving,    setSaving]    = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [history,   setHistory]   = useState([]);
    const [loadingH,  setLoadingH]  = useState(true);
    const MAX_CHARS = 500;

    const CATEGORIES = [
        { value:'general',      label:'General'           },
        { value:'workflow',     label:'Workflow Issue'    },
        { value:'system',       label:'System / Bug'      },
        { value:'suggestion',   label:'Suggestion'        },
        { value:'compliment',   label:'Compliment'        },
    ];

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
        if (!comment.trim())      { toast.error('Please write your feedback.');         return; }
        if (comment.length > MAX_CHARS) { toast.error('Feedback too long.');            return; }
        setSaving(true);
        try {
            const r = await fetch(`${API}/staff/feedback`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: user?.staff_id,
                    comment:  comment.trim(),
                    rating:   rating || null,
                    category,
                })
            });
            const d = await r.json();
            if (d.success) {
                setSubmitted(true);
                setComment(''); setRating(0); setCategory('general');
                loadHistory();
                setTimeout(() => setSubmitted(false), 5000);
                toast.success('Feedback submitted!');
            } else toast.error(d.message || 'Submit failed.');
        } catch { toast.error('Server error.'); }
        finally { setSaving(false); }
    };

    const statusClass = s => s === 'resolved' ? 'rec-badge-green' : s === 'reviewed' ? 'rec-badge-blue' : 'rec-badge-amber';

    return (
        <div className="rec-section">
            <div className="rec-section-head">
                <h2>Feedback</h2>
                <p>Share suggestions or report issues with the front desk system</p>
            </div>

            {submitted && (
                <div className="rec-success-banner">
                    <CheckCircle2 size={15}/> Thank you — your feedback was submitted successfully.
                </div>
            )}

            <div className="rec-card" style={{maxWidth:'640px', marginBottom:'24px'}}>
                <div className="rec-card-head">
                    <h3><MessageSquare size={14}/> Submit Feedback</h3>
                </div>
                <form onSubmit={handleSubmit} style={{padding:'18px'}}>

                    {/* Category */}
                    <div className="rec-fg" style={{marginBottom:'14px'}}>
                        <label>Category</label>
                        <select className="rec-input" value={category}
                            onChange={e => setCategory(e.target.value)}>
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Star rating */}
                    <div className="rec-fg" style={{marginBottom:'14px'}}>
                        <label>Overall Rating (optional)</label>
                        <div className="rec-star-row">
                            {[1,2,3,4,5].map(s => (
                                <button type="button" key={s}
                                    className={`rec-star ${s <= (hoverStar || rating) ? 'active' : ''}`}
                                    onMouseEnter={() => setHoverStar(s)}
                                    onMouseLeave={() => setHoverStar(0)}
                                    onClick={() => setRating(r => r === s ? 0 : s)}>
                                    <Star size={22} fill={s <= (hoverStar || rating) ? 'currentColor' : 'none'}/>
                                </button>
                            ))}
                            {rating > 0 && (
                                <span style={{fontSize:'0.8rem',color:'#64748b',marginLeft:'8px'}}>
                                    {['','Poor','Fair','Good','Very Good','Excellent'][rating]}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="rec-fg" style={{marginBottom:'14px'}}>
                        <label style={{display:'flex',justifyContent:'space-between'}}>
                            <span>Your Comments <span className="req">*</span></span>
                            <span style={{
                                fontSize:'0.75rem',
                                color: comment.length > MAX_CHARS * 0.9 ? '#ef4444' : '#94a3b8'
                            }}>{comment.length}/{MAX_CHARS}</span>
                        </label>
                        <textarea className="rec-input rec-ta" rows={5}
                            value={comment}
                            onChange={e => setComment(e.target.value.slice(0, MAX_CHARS))}
                            placeholder="Describe any issues, workflow suggestions, or improvements for the front desk or OPD system…"/>
                    </div>

                    <button type="submit" className="rec-btn-primary"
                        disabled={saving || !comment.trim()}>
                        {saving
                            ? <><div className="rec-btn-spin"/> Submitting…</>
                            : <><Send size={14}/> Submit Feedback</>}
                    </button>
                </form>
            </div>

            {/* Feedback history */}
            {!loadingH && history.length > 0 && (
                <div className="rec-card">
                    <div className="rec-card-head">
                        <h3><FileText size={13}/> Your Past Feedback</h3>
                        <span className="rec-badge rec-badge-blue">{history.length}</span>
                    </div>
                    <div style={{padding:'12px 16px'}}>
                        {history.map((f, i) => (
                            <div key={f.feedback_id || i} className="rec-feedback-item">
                                <div className="rec-feedback-meta">
                                    <span className="rec-notif-time">
                                        {fmtDTime(f.submitted_at || f.date_submitted)}
                                    </span>
                                    {f.category && (
                                        <span className="rec-badge rec-badge-grey" style={{textTransform:'capitalize'}}>
                                            {f.category}
                                        </span>
                                    )}
                                    {f.rating && (
                                        <span className="rec-badge rec-badge-amber">
                                            {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}
                                        </span>
                                    )}
                                    {f.status && (
                                        <span className={`rec-badge ${statusClass(f.status)}`}>{f.status}</span>
                                    )}
                                </div>
                                <p className="rec-feedback-comment">"{f.comment}"</p>
                                {f.admin_note && (
                                    <div className="rec-admin-note">
                                        <strong>Admin response:</strong> {f.admin_note}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loadingH && history.length === 0 && (
                <Empty icon={MessageSquare} text="No feedback submitted yet."/>
            )}
        </div>
    );
}