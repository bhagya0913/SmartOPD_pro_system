import html2pdf from 'html2pdf.js';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

import {
    Home, Users, Settings, BarChart3, FileText, LogOut, UserPlus,
    Activity, Calendar, Clock, X, Plus, Trash2, Mail, Phone,
    Shield, CheckCircle, AlertTriangle, RefreshCw, ChevronRight,
    Search, Save, TrendingUp, Stethoscope, FlaskConical, Pill, User,
    Download, MessageSquare, Star, Filter, ChevronDown, Hash,
    CreditCard, Eye, EyeOff, Check, AlertCircle, Info, Edit3,
    UserCheck, UserX, ClipboardList, Building2, BarChart2,
    FileBarChart, Lock, Key, Database, Layers, ChevronUp, ExternalLink,
   
} from 'lucide-react';
import './AdminDashboard.css';

const fmtDate  = d => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB') : '—';

const API = 'http://localhost:5001/api';

const fmtDTime = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : '—';

function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `adm-toast adm-toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
}

const roleIcon = r => {
    const m = {
        Doctor: <Stethoscope size={13}/>,
        Pharmacist: <Pill size={13}/>,
        'Diagnostic Technician': <FlaskConical size={13}/>,
        Receptionist: <Phone size={13}/>,
        Admin: <Shield size={13}/>
    };
    return m[r] || <User size={13}/>;
};

function downloadPDFReport(title, from, to, bodyHTML) {
    const now = new Date();
    const style = `
        @page{margin:20mm 18mm;size:A4}*{box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;padding:0 24px;font-size:13px;background:#fff}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding:20px 0 14px;border-bottom:3px solid #92400e}
        .logo{font-size:22px;font-weight:800;color:#92400e}.hospital{font-size:12px;color:#64748b;margin-top:2px}
        .header-right{text-align:right}.badge{background:#fdf8f0;border:1px solid #fed7aa;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;color:#92400e;display:inline-block}
        .meta{font-size:10px;color:#94a3b8;margin-top:4px}
        h1{font-size:20px;font-weight:800;color:#0f172a;margin:16px 0 4px}
        .period{font-size:12px;color:#64748b;margin-bottom:18px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;display:inline-block}
        .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px}
        .stat-card{border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px}
        .stat-val{font-size:26px;font-weight:800}.stat-label{font-size:10px;color:#64748b;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
        .section-title{font-size:12px;font-weight:800;color:#0f172a;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.06em}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
        thead{background:#92400e}th{padding:8px 12px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:white}
        td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}tr:nth-child(even) td{background:#fafafa}
        .badge-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
        .green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}.amber{color:#d97706}.purple{color:#7c3aed}
        .bg-green{background:#dcfce7}.bg-red{background:#fee2e2}.bg-blue{background:#dbeafe}.bg-amber{background:#fef3c7}.bg-purple{background:#f3e8ff}
        .progress-row{display:flex;align-items:center;gap:10px}
        .progress-track{flex:1;height:6px;background:#f1f5f9;border-radius:10px;overflow:hidden}
        .progress-fill{height:100%;border-radius:10px}
        .no-data{text-align:center;color:#94a3b8;font-style:italic;padding:20px}
        .footer{margin-top:30px;padding-top:10px;border-top:2px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
    `;
    const fullHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${style}</style></head><body>
        <div class="header">
            <div><div class="logo">SmartOPD</div><div class="hospital">Base Hospital, Kiribathgoda</div></div>
            <div class="header-right"><div class="badge">OFFICIAL REPORT</div><div class="meta">Generated: ${fmtDTime(now)}</div></div>
        </div>
        <h1>${title}</h1>
        <div class="period">📅 Reporting Period: <strong>${fmtDate(from)}</strong> — <strong>${fmtDate(to)}</strong></div>
        ${bodyHTML}
        <div class="footer">
            <span>SmartOPD — Base Hospital Kiribathgoda | For internal use only</span>
            <span style="color:#dc2626;font-weight:700">CONFIDENTIAL</span>
        </div>
    </body></html>`;

    const element = document.createElement('div');
    element.innerHTML = fullHTML;
    document.body.appendChild(element);
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${title.replace(/[\s/\\:*?"<>|]/g, '_')}_${now.toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(element);
    });
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function AdminDashboard({ user, setUser }) {
    const [activeTab, setActiveTab] = useState('home');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    const menuItems = [
        { id:'home',      label:'Home',            icon:Home },
        { id:'staff',     label:'Staff Management',    icon:Users },
        { id:'patients',  label:'Patient Management',  icon:UserCheck },
        { id:'settings',  label:'OPD Settings',        icon:Settings },
        { id:'reports',   label:'Reports',             icon:BarChart3 },
        { id:'export', label:'Data Export', icon:Download },
        { id:'logs',      label:'System Logs',         icon:FileText },
        { id:'feedback',  label:'Feedback',            icon:MessageSquare },
    ];

    return (
        <div className="adm-shell">
            <aside className="adm-sidebar">
                <div className="adm-sidebar-brand">
                    <div className="adm-brand-icon"><Activity size={18} color="white"/></div>
                    <div>
                        <div className="adm-brand-name">SmartOPD</div>
                        <div className="adm-brand-role">Administrator</div>
                    </div>
                </div>

                <div className="adm-sidebar-user">
                    <div className="adm-user-avatar">{(user?.full_name || 'A')[0].toUpperCase()}</div>
                    <div>
                        <div className="adm-user-name">{user?.full_name || 'Admin'}</div>
                        <div className="adm-user-email">{user?.username || 'admin'}</div>
                    </div>
                </div>

                <nav className="adm-nav">
                    {menuItems.map(item => (
                        <button key={item.id}
                            className={`adm-nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17}/>
                            <span>{item.label}</span>
                            {activeTab === item.id && <div className="adm-nav-bar"/>}
                        </button>
                    ))}
                </nav>

                <button className="adm-nav-item adm-logout" onClick={handleLogout}>
                    <LogOut size={17}/>
                    <span>Sign Out</span>
                </button>
            </aside>

            <div className="adm-main">
                <header className="adm-topbar">
                    <div className="adm-topbar-left">
                        <span className="adm-breadcrumb">
                            Base Hospital, Kiribathgoda
                            <ChevronRight size={14}/>
                            <strong>{menuItems.find(m => m.id === activeTab)?.label}</strong>
                        </span>
                    </div>
                    <div className="adm-topbar-right">
                        <div className="adm-live-dot"/><span className="adm-live-label">System Live</span>
                    </div>
                </header>

                <div className="adm-body">
                    {activeTab === 'home'     && <HomeSection user={user}/>}
                    {activeTab === 'staff'    && <StaffSection/>}
                    {activeTab === 'patients' && <PatientManagementSection/>}
                    {activeTab === 'settings' && <OPDSettings/>}
                    {activeTab === 'reports'  && <ReportsSection/>}
                    {activeTab === 'export' && <DataExportSection />}
                    {activeTab === 'logs'     && <LogsSection/>}
                    {activeTab === 'feedback' && <FeedbackSection/>}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  HOME / OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function HomeSection({ user }) {
    const [stats, setStats] = useState({ totalStaff:0, todayAppts:0, pendingAppts:0, opdHours:'—' });
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const fullDate = now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/admin/dashboard-stats`);
            const d = await r.json();
            if (d.success) setStats(d.stats);
        } catch {}
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const statCards = [
        { label:"Today's Appointments", value:stats.todayAppts,   icon:Calendar, color:'green',  sub:'Scheduled today' },
        { label:'Total Active Staff',   value:stats.totalStaff,   icon:Users,    color:'blue',   sub:'Active personnel' },
        { label:'Pending / Booked',     value:stats.pendingAppts, icon:Clock,    color:'amber',  sub:'Awaiting completion' },
        { label:'OPD Hours',            value:stats.opdHours,     icon:Activity, color:'purple', sub:"Today's schedule" },
    ];

    return (
        <div className="adm-section">
            {/* Welcome Banner */}
            <div className="adm-welcome-banner">
                <div className="adm-welcome-left">
                    <div className="adm-welcome-greeting">{greeting},</div>
                    <div className="adm-welcome-name">{user?.full_name || 'Administrator'} 👋</div>
                    <div className="adm-welcome-date">{fullDate}</div>
                    {/*<div className="adm-welcome-sub">Here's a real-time snapshot of hospital operations today.</div>*/}
                </div>
                <div className="adm-welcome-right">
                    <div className="adm-welcome-icon-wrap">
                        <Building2 size={48} color="rgba(255,255,255,0.18)"/>
                    </div>
                </div>
            </div>

            <div className="adm-section-head">
                <div><h2>Operations Overview</h2><p>Real-time hospital operations at a glance</p></div>
                <button className="adm-btn-ghost" onClick={load}><RefreshCw size={14}/> Refresh</button>
            </div>

            <div className="adm-stat-grid">
                {statCards.map(c => (
                    <div key={c.label} className={`adm-stat-card adm-stat-${c.color}`}>
                        <div className="adm-stat-icon"><c.icon size={20}/></div>
                        <div className="adm-stat-body">
                            <div className="adm-stat-val">{loading ? '…' : c.value}</div>
                            <div className="adm-stat-label">{c.label}</div>
                            <div className="adm-stat-sub">{c.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            {/*<div className="adm-card" style={{marginTop:'8px'}}>
                <div className="adm-card-head"><h3><Activity size={15}/> Quick Actions</h3></div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px',padding:'16px 18px'}}>
                    {[
                        { label:'Add Staff',        icon:UserPlus,      color:'#2563eb', bg:'#eff6ff' },
                        { label:'View Reports',     icon:BarChart2,     color:'#7c3aed', bg:'#faf5ff' },
                        { label:'System Logs',      icon:FileText,      color:'#0891b2', bg:'#ecfeff' },
                        { label:'OPD Settings',     icon:Settings,      color:'#92400e', bg:'#fdf8f0' },
                        { label:'Patients',         icon:UserCheck,     color:'#16a34a', bg:'#f0fdf4' },
                        { label:'Feedback',         icon:MessageSquare, color:'#d97706', bg:'#fffbeb' },
                    ].map(a => (
                        <div key={a.label} className="adm-quick-action" style={{'--qa-color':a.color,'--qa-bg':a.bg}}>
                            <div className="adm-qa-icon"><a.icon size={18}/></div>
                            <span>{a.label}</span>
                        </div>
                    ))}
                </div>
            </div>*/}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAFF MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
function StaffSection() {
    const [staffList,  setStaffList]  = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(false);
    const [showModal,  setShowModal]  = useState(false);
    const [search,     setSearch]     = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [notice,     setNotice]     = useState(null);

    const [form, setForm] = useState({
        staffId: '', firstName: '', surname: '', email: '', phone: '', nic: '', roleName: 'Doctor'
    });

    const fetchStaff = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/admin/staff`);
            const d = await r.json();
            setStaffList(Array.isArray(d) ? d : []);
        } catch { toast('Failed to load staff list.', 'error'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const checkEmail = async (email) => {
        if (!email || !email.includes('@')) { setNotice(null); return; }
        try {
            const r = await fetch(`${API}/admin/check-email?email=${encodeURIComponent(email)}`);
            const d = await r.json();
            if (d.hasPatientAccount) {
                setNotice({ type: 'info', msg: `A patient account already exists for ${email}. Adding as staff will share the same login.` });
            } else {
                setNotice({ type: 'ok', msg: `No existing account found. A new staff account will be created with a temporary password.` });
            }
        } catch { setNotice(null); }
    };

    const handleAdd = async e => {
        e.preventDefault();
        setSaving(true);
        try {
            const r = await fetch(`${API}/admin/add-staff`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const d = await r.json();
            if (d.success) {
                toast(d.message || 'Staff registered successfully.', 'success');
                setShowModal(false);
                setForm({ staffId:'', firstName:'', surname:'', email:'', phone:'', nic:'', roleName:'Doctor' });
                setNotice(null);
                fetchStaff();
            } else toast(d.message || 'Failed to add staff.', 'error');
        } catch { toast('Server error.', 'error'); }
        finally { setSaving(false); }
    };

    const handleRemove = async (id, name) => {
        if (!window.confirm(`Deactivate ${name}? Their login will be disabled.`)) return;
        try {
            const r = await fetch(`${API}/admin/remove-staff/${id}`, { method: 'DELETE' });
            const d = await r.json();
            if (d.success) { toast(`${name} deactivated.`, 'success'); fetchStaff(); }
            else toast(d.message || 'Failed.', 'error');
        } catch { toast('Server error.', 'error'); }
    };

    const handleReactivate = async (id, name) => {
        if (!window.confirm(`Reactivate ${name}? Their login will be enabled again.`)) return;
        try {
            const r = await fetch(`${API}/admin/reactivate-staff/${id}`, { method: 'PATCH' });
            const d = await r.json();
            if (d.success) { toast(`${name} reactivated.`, 'success'); fetchStaff(); }
            else toast(d.message || 'Failed.', 'error');
        } catch { toast('Server error.', 'error'); }
    };
    const roles = ['All', 'Doctor', 'Pharmacist', 'Receptionist', 'Diagnostic Technician', 'Admin'];
    const filtered = staffList.filter(s => {
        const matchRole   = filterRole === 'All' || s.role_name === filterRole;
        const matchSearch = !search || `${s.first_name} ${s.surname} ${s.email} ${s.staff_id}`.toLowerCase().includes(search.toLowerCase());
        return matchRole && matchSearch;
    });
    const byRole = r => staffList.filter(s => s.role_name === r && s.is_active).length;

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>Staff Management</h2><p>Register staff, assign roles, manage access</p></div>
                <button className="adm-btn-primary" onClick={() => setShowModal(true)}>
                    <UserPlus size={15}/> Add Staff Member
                </button>
            </div>

            <div className="adm-role-chips">
                {['Doctor','Pharmacist','Receptionist','Diagnostic Technician','Admin'].map(r => (
                    <div key={r} className="adm-role-chip">
                        <span className="adm-role-chip-icon">{roleIcon(r)}</span>
                        <strong>{byRole(r)}</strong> {r}
                    </div>
                ))}
            </div>

            <div className="adm-filter-bar">
                <div className="adm-search-wrap">
                    <Search size={15} className="adm-search-icon"/>
                    <input className="adm-search" placeholder="Search by name, email or Staff ID…"
                        value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
                <div className="adm-role-filter">
                    {roles.map(r => (
                        <button key={r} className={`adm-pill-btn ${filterRole === r ? 'active' : ''}`}
                            onClick={() => setFilterRole(r)}>{r}</button>
                    ))}
                </div>
            </div>

            <div className="adm-card">
                {loading ? <div className="adm-loading"><div className="adm-spinner"/></div> : (
                    <table className="adm-table">
                        <thead><tr>
                            <th>Staff ID</th><th>Name</th><th>Email</th><th>Phone</th>
                            <th>NIC</th><th>Role</th><th>Status</th>
                            <th style={{textAlign:'right'}}>Action</th>
                        </tr></thead>
                        <tbody>
                            {filtered.length ? filtered.map(s => (
                                <tr key={s.staff_id}>
                                    <td className="adm-mono adm-dimmed">#{s.staff_id}</td>
                                    <td>
                                        <div className="adm-name-cell">
                                            <div className="adm-avatar-sm">{(s.first_name || '?')[0]}</div>
                                            <strong>{s.first_name} {s.surname}</strong>
                                        </div>
                                    </td>
                                    <td className="adm-dimmed">{s.email}</td>
                                    <td className="adm-dimmed adm-mono">{s.phone || '—'}</td>
                                    <td className="adm-dimmed adm-mono">{s.nic || '—'}</td>
                                    <td><span className="adm-role-tag">{roleIcon(s.role_name)} {s.role_name}</span></td>
                                    <td>
                                        <span className={`adm-badge ${s.is_active ? 'adm-badge-active' : 'adm-badge-inactive'}`}>
                                            {s.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{textAlign:'right'}}>
                                        {s.is_active ? (
                                            <button className="adm-icon-btn danger" title="Deactivate"
                                                onClick={() => handleRemove(s.staff_id, `${s.first_name} ${s.surname}`)}>
                                                <Trash2 size={14}/>
                                            </button>
                                        ) : (
                                            <button className="adm-icon-btn success" title="Reactivate"
                                                onClick={() => handleReactivate(s.staff_id, `${s.first_name} ${s.surname}`)}>
                                                <RefreshCw size={14}/>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={8} className="adm-empty">No staff found.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="adm-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="adm-modal" onClick={e => e.stopPropagation()}>
                        <div className="adm-modal-head">
                            <div className="adm-modal-title">
                                <UserPlus size={18} color="#2563eb"/>
                                <h3>Register New Staff Member</h3>
                            </div>
                            <button className="adm-icon-btn" onClick={() => { setShowModal(false); setNotice(null); }}>
                                <X size={18}/>
                            </button>
                        </div>
                        {notice && (
                            <div className={`adm-notice adm-notice-${notice.type}`}>
                                {notice.type === 'info' ? <Info size={14}/> : <CheckCircle size={14}/>}
                                <span>{notice.msg}</span>
                            </div>
                        )}
                        <form onSubmit={handleAdd} className="adm-form">
                            <div className="adm-form-group">
                                <label>Staff ID <span className="adm-optional">(leave blank to auto-generate)</span></label>
                                <div className="adm-input-icon-wrap">
                                    <Hash size={15} className="adm-input-icon"/>
                                    <input className="adm-input adm-input-with-icon"
                                        placeholder="e.g. 1042 — optional"
                                        value={form.staffId}
                                        onChange={e => setForm({ ...form, staffId: e.target.value.replace(/\D/g, '') })}/>
                                </div>
                            </div>
                            <div className="adm-form-row">
                                <div className="adm-form-group">
                                    <label>First Name <span className="req">*</span></label>
                                    <input className="adm-input" required value={form.firstName}
                                        onChange={e => setForm({ ...form, firstName: e.target.value })}/>
                                </div>
                                <div className="adm-form-group">
                                    <label>Surname <span className="req">*</span></label>
                                    <input className="adm-input" required value={form.surname}
                                        onChange={e => setForm({ ...form, surname: e.target.value })}/>
                                </div>
                            </div>
                            <div className="adm-form-group">
                                <label>Email Address <span className="req">*</span></label>
                                <input className="adm-input" type="email" required value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    onBlur={e => checkEmail(e.target.value)}/>
                            </div>
                            <div className="adm-form-row">
                                <div className="adm-form-group">
                                    <label>Phone <span className="req">*</span></label>
                                    <input className="adm-input" type="tel" placeholder="07XXXXXXXX"
                                        required pattern="[0-9]{10}" value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g,'').slice(0,10) })}/>
                                </div>
                                <div className="adm-form-group">
                                    <label>NIC Number <span className="req">*</span></label>
                                    <input className="adm-input" required placeholder="Old or New NIC"
                                        pattern="^([0-9]{9}[xXvV]|[0-9]{12})$" value={form.nic}
                                        onChange={e => setForm({ ...form, nic: e.target.value })}/>
                                </div>
                            </div>
                            <div className="adm-form-group">
                                <label>Assigned Role <span className="req">*</span></label>
                                <select className="adm-input" value={form.roleName}
                                    onChange={e => setForm({ ...form, roleName: e.target.value })}>
                                    <option>Doctor</option>
                                    <option>Pharmacist</option>
                                    <option>Receptionist</option>
                                    <option>Diagnostic Technician</option>
                                    <option>Admin</option>
                                </select>
                            </div>
                            <div className="adm-modal-actions">
                                <button type="button" className="adm-btn-ghost"
                                    onClick={() => { setShowModal(false); setNotice(null); }}>Cancel</button>
                                <button type="submit" className="adm-btn-primary" disabled={saving}>
                                    {saving ? <><div className="adm-btn-spinner"/>Processing…</> : <><UserPlus size={14}/> Register &amp; Send Email</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  PATIENT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
function PatientManagementSection() {
    const [patients,       setPatients]       = React.useState([]);
    const [loading,        setLoading]        = React.useState(true);
    const [search,         setSearch]         = React.useState('');
    const [filterStatus,   setFilterStatus]   = React.useState('all');
    const [reportModal,    setReportModal]    = React.useState(null);  // patient obj
    const [generatingRpt,  setGeneratingRpt]  = React.useState(false);
    const [currentPage,    setCurrentPage]    = React.useState(1);
    const PER_PAGE = 20;

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/admin/patients?limit=500`);
            const d = await r.json();
            setPatients(d.success ? (d.patients || []) : []);
        } catch { setPatients([]); }
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    // ── FIXED: safe string search — handles null/undefined from MySQL ─────────
    const safeStr = v => (v == null ? '' : String(v));
    const filtered = React.useMemo(() => {
        let list = patients;
        if (filterStatus !== 'all') {
            list = list.filter(p => filterStatus === 'active' ? p.is_active : !p.is_active);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
                safeStr(p.full_name).toLowerCase().includes(q) ||
                safeStr(p.patient_id).toLowerCase().includes(q) ||
                safeStr(p.nic).toLowerCase().includes(q) ||
                safeStr(p.phone).toLowerCase().includes(q) ||
                safeStr(p.email).toLowerCase().includes(q)
            );
        }
        return list;
    }, [patients, search, filterStatus]);

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const pageSlice  = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
    const goPage     = p => { setCurrentPage(Math.max(1, Math.min(p, totalPages))); };

    React.useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);

    const toggleStatus = async p => {
        const disabling = !!p.is_active;
        let reason = null;
        if (disabling) {
            reason = window.prompt(`Reason for disabling ${p.full_name}'s record? (e.g. Deceased, Duplicate)`);
            if (reason === null) return;
        }
        if (!window.confirm(`${disabling ? 'Disable' : 'Re-enable'} record for ${p.full_name}?`)) return;
        try {
            const r = await fetch(`${API}/admin/patient-status/${p.patient_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: disabling ? 0 : 1, reason })
            });
            const d = await r.json();
            if (d.success) { alert(d.message); load(); }
            else alert(d.message || 'Failed.');
        } catch { alert('Server error.'); }
    };

    // ── Patient report generation ─────────────────────────────────────────────
    const PATIENT_REPORTS = [
        { id: 'patient_history',      label: 'Appointment History',  desc: 'All appointments with outcomes and doctors' },
        { id: 'patient_prescriptions',label: 'Prescription Summary', desc: 'All prescriptions issued to this patient' },
        { id: 'patient_lab_tests',    label: 'Lab Test Records',     desc: 'All diagnostic tests and results' },
    ];

    const generatePatientReport = async (patient, reportId) => {
        setGeneratingRpt(true);
        try {
            const r = await fetch(`${API}/admin/patient-report/${patient.patient_id}?type=${reportId}`);
            const d = await r.json();
            let bodyHTML = '';

            const patientInfo = `
                <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:13px 16px;margin-bottom:18px;font-size:12px;line-height:1.8">
                    <strong>${patient.full_name}</strong> &nbsp;·&nbsp; Patient #${patient.patient_id}
                    &nbsp;·&nbsp; NIC: ${safeStr(patient.nic)||'—'} &nbsp;·&nbsp; DOB: ${fmtDate(patient.date_of_birth)}
                    &nbsp;·&nbsp; Phone: ${safeStr(patient.phone)||'—'}
                    &nbsp;·&nbsp; Status: <strong>${patient.is_active ? 'Active' : 'Disabled'}</strong>
                </div>`;

            if (reportId === 'patient_history') {
                const rows = d.appointments || [];
                bodyHTML = patientInfo + `
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
                        <div style="border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:12px 14px"><div style="font-size:24px;font-weight:800;color:#2563eb">${rows.length}</div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Total Appointments</div></div>
                        <div style="border:1.5px solid #bbf7d0;background:#f0fdf4;border-radius:8px;padding:12px 14px"><div style="font-size:24px;font-weight:800;color:#16a34a">${rows.filter(a=>a.status==='completed').length}</div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Completed</div></div>
                        <div style="border:1.5px solid #fed7aa;background:#fffbeb;border-radius:8px;padding:12px 14px"><div style="font-size:24px;font-weight:800;color:#d97706">${rows.filter(a=>a.status==='cancelled'||a.status==='no_show').length}</div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Cancelled / No-show</div></div>
                    </div>
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#0f172a;margin:18px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0">Appointment History</div>
                    <table><thead><tr><th>#</th><th>Date</th><th>Time</th><th>Doctor</th><th>Visit Type</th><th>Status</th></tr></thead><tbody>
                    ${rows.length ? rows.map((a,i)=>`<tr><td>${i+1}</td><td>${fmtDate(a.appointment_day)}</td><td style="font-family:monospace;font-size:11px">${safeStr(a.start_time).slice(0,5)}–${safeStr(a.end_time).slice(0,5)}</td><td>${a.doctor_name||'—'}</td><td>${a.visit_type||'—'}</td><td style="color:${a.status==='completed'?'#16a34a':a.status==='cancelled'?'#dc2626':'#d97706'};font-weight:700;text-transform:capitalize">${a.status||'—'}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px">No appointments found</td></tr>`}
                    </tbody></table>`;
            } else if (reportId === 'patient_prescriptions') {
                const rows = d.prescriptions || [];
                bodyHTML = patientInfo + `
                    <div style="border:1.5px solid #bbf7d0;background:#f0fdf4;border-radius:8px;padding:12px 14px;margin-bottom:20px;display:inline-block"><div style="font-size:24px;font-weight:800;color:#16a34a">${rows.length}</div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Total Prescriptions</div></div>
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#0f172a;margin:18px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0">Prescription Records</div>
                    <table><thead><tr><th>#</th><th>Date</th><th>Medication</th><th>Dosage</th><th>Duration</th><th>Prescribed By</th></tr></thead><tbody>
                    ${rows.length ? rows.map((p,i)=>`<tr><td>${i+1}</td><td>${fmtDate(p.prescribed_date)}</td><td><strong>${p.medication_name||'—'}</strong></td><td>${p.dosage||'—'}</td><td>${p.duration||'—'}</td><td>${p.doctor_name||'—'}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px">No prescriptions found</td></tr>`}
                    </tbody></table>`;
            } else {
                const rows = d.tests || [];
                bodyHTML = patientInfo + `
                    <div style="border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:12px 14px;margin-bottom:20px;display:inline-block"><div style="font-size:24px;font-weight:800;color:#2563eb">${rows.length}</div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px">Total Lab Tests</div></div>
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#0f172a;margin:18px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0">Lab Test Records</div>
                    <table><thead><tr><th>#</th><th>Date</th><th>Test Name</th><th>Status</th><th>Result</th><th>Requested By</th></tr></thead><tbody>
                    ${rows.length ? rows.map((t,i)=>`<tr><td>${i+1}</td><td>${fmtDate(t.test_date)}</td><td><strong>${t.test_name||'—'}</strong></td><td style="color:${t.status==='completed'?'#16a34a':'#d97706'};font-weight:700;text-transform:capitalize">${t.status||'—'}</td><td>${t.result||'Pending'}</td><td>${t.doctor_name||'—'}</td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px">No lab tests found</td></tr>`}
                    </tbody></table>`;
            }

            const rptLabel = PATIENT_REPORTS.find(rt=>rt.id===reportId)?.label || 'Patient Report';
            downloadPDFReport(`${rptLabel} — ${patient.full_name}`, '2000-01-01', new Date().toISOString().split('T')[0], bodyHTML);
            setReportModal(null);
        } catch (e) {
            alert('Could not generate report. Check console for details.');
            console.error(e);
        } finally { setGeneratingRpt(false); }
    };

    const stats = {
        total:    patients.length,
        active:   patients.filter(p => p.is_active).length,
        disabled: patients.filter(p => !p.is_active).length,
    };

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>Patient Management</h2><p>Search, view, disable, and generate reports for patient records</p></div>
                <button className="adm-btn-ghost" onClick={load}><span style={{fontSize:13}}>↺</span> Refresh</button>
            </div>

            {/* Stats */}
            <div className="adm-stat-grid" style={{marginBottom:'20px'}}>
                {[
                    { label:'Total Patients',    value: stats.total,    color:'blue' },
                    { label:'Active Records',    value: stats.active,   color:'green' },
                    { label:'Disabled Records',  value: stats.disabled, color:'red' },
                ].map(c => (
                    <div key={c.label} className={`adm-stat-card adm-stat-${c.color}`}>
                        <div className="adm-stat-body">
                            <div className="adm-stat-val">{c.value}</div>
                            <div className="adm-stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="adm-filter-bar" style={{marginBottom:'16px'}}>
                <div className="adm-search-wrap">
                    <span className="adm-search-icon" style={{fontSize:14}}>🔍</span>
                    <input className="adm-search"
                        placeholder="Search by name, ID, NIC or phone…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}/>
                    {search && (
                        <button onClick={()=>setSearch('')}
                            style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:16,padding:'0 8px'}}>
                            ×
                        </button>
                    )}
                </div>
                <div className="adm-role-filter">
                    {[['all','All'],['active','Active'],['disabled','Disabled']].map(([v,l]) => (
                        <button key={v}
                            className={`adm-pill-btn ${filterStatus===v?'active':''}`}
                            onClick={() => setFilterStatus(v)}>{l}</button>
                    ))}
                </div>
            </div>

            {/* Result count */}
            <div style={{fontSize:'0.78rem',color:'#64748b',marginBottom:'10px',padding:'0 2px'}}>
                {loading ? 'Loading…' : (
                    <>Showing <strong>{filtered.length}</strong> of <strong>{patients.length}</strong> patients
                    {search && <span style={{color:'#92400e'}}> — filtered by "{search}"</span>}</>
                )}
            </div>

            <div className="adm-card">
                {loading ? (
                    <div className="adm-loading"><div className="adm-spinner"/></div>
                ) : (
                    <>
                        <table className="adm-table">
                            <thead><tr>
                                <th>ID</th><th>Full Name</th><th>NIC</th>
                                <th>Phone</th><th>Date of Birth</th><th>Appointments</th><th>Status</th>
                                <th style={{textAlign:'right'}}>Actions</th>
                            </tr></thead>
                            <tbody>
                                {pageSlice.length ? pageSlice.map(p => (
                                    <tr key={p.patient_id}>
                                        <td className="adm-mono adm-dimmed" style={{fontSize:'0.75rem'}}>#{p.patient_id}</td>
                                        <td>
                                            <div className="adm-name-cell">
                                                <div className="adm-avatar-sm"
                                                    style={!p.is_active ? {background:'#fee2e2',color:'#dc2626'} : {}}>
                                                    {(p.full_name||'?')[0].toUpperCase()}
                                                </div>
                                                <strong style={!p.is_active ? {color:'#94a3b8',textDecoration:'line-through'} : {}}>
                                                    {p.full_name}
                                                </strong>
                                            </div>
                                        </td>
                                        <td className="adm-mono adm-dimmed" style={{fontSize:'0.78rem'}}>{safeStr(p.nic)||'—'}</td>
                                        <td className="adm-dimmed">{safeStr(p.phone)||'—'}</td>
                                        <td className="adm-dimmed">{fmtDate(p.date_of_birth)}</td>
                                        <td className="adm-dimmed">{p.total_appointments ?? '—'}</td>
                                        <td>
                                            <span className={`adm-badge ${p.is_active ? 'adm-badge-active' : 'adm-badge-inactive'}`}>
                                                {p.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td style={{textAlign:'right'}}>
                                            <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                                                <button className="adm-icon-btn" title="Generate Report"
                                                    onClick={() => setReportModal(p)}
                                                    style={{fontSize:'12px',padding:'5px 10px',borderRadius:'6px',
                                                        background:'#eff6ff',border:'1px solid #bfdbfe',color:'#2563eb',cursor:'pointer'}}>
                                                    Report
                                                </button>
                                                <button
                                                    title={p.is_active ? 'Disable Record' : 'Re-enable Record'}
                                                    onClick={() => toggleStatus(p)}
                                                    style={{fontSize:'11px',padding:'5px 10px',borderRadius:'6px',cursor:'pointer',
                                                        background: p.is_active ? '#fee2e2' : '#dcfce7',
                                                        border: p.is_active ? '1px solid #fecaca' : '1px solid #bbf7d0',
                                                        color: p.is_active ? '#dc2626' : '#16a34a', fontWeight:700}}>
                                                    {p.is_active ? 'Disable' : 'Enable'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="adm-empty">
                                            {search ? `No patients match "${search}"` : 'No patients found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="adm-pagination">
                                <button className="adm-page-btn" disabled={currentPage===1} onClick={()=>goPage(currentPage-1)}>‹ Prev</button>
                                {Array.from({length: totalPages}, (_, i) => i+1)
                                    .filter(p => p===1 || p===totalPages || Math.abs(p-currentPage)<=2)
                                    .map((p, idx, arr) => (
                                        <React.Fragment key={p}>
                                            {idx>0 && arr[idx-1] !== p-1 && <span style={{padding:'0 6px',color:'#94a3b8'}}>…</span>}
                                            <button className={`adm-page-btn ${currentPage===p?'active':''}`} onClick={()=>goPage(p)}>{p}</button>
                                        </React.Fragment>
                                    ))}
                                <button className="adm-page-btn" disabled={currentPage===totalPages} onClick={()=>goPage(currentPage+1)}>Next ›</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Patient Report Modal */}
            {reportModal && (
                <div className="adm-modal-overlay" onClick={() => setReportModal(null)}>
                    <div className="adm-modal" style={{maxWidth:'460px'}} onClick={e => e.stopPropagation()}>
                        <div className="adm-modal-head">
                            <div className="adm-modal-title">
                                <span style={{fontSize:18}}>📄</span>
                                <h3>Generate Patient Report</h3>
                            </div>
                            <button className="adm-icon-btn" onClick={() => setReportModal(null)}>×</button>
                        </div>
                        <div style={{padding:'16px 20px'}}>
                            <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'12px 14px',marginBottom:'16px'}}>
                                <div style={{fontWeight:700,color:'#0f172a'}}>{reportModal.full_name}</div>
                                <div style={{fontSize:'0.77rem',color:'#64748b',marginTop:'3px'}}>
                                    Patient #{reportModal.patient_id} &nbsp;·&nbsp; NIC: {safeStr(reportModal.nic)||'—'}
                                    &nbsp;·&nbsp; Phone: {safeStr(reportModal.phone)||'—'}
                                </div>
                            </div>
                            <p style={{fontSize:'0.8rem',color:'#64748b',marginBottom:'12px',fontWeight:600}}>Select report type to download:</p>
                            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                                {PATIENT_REPORTS.map(rt => (
                                    <button key={rt.id}
                                        disabled={generatingRpt}
                                        onClick={() => generatePatientReport(reportModal, rt.id)}
                                        style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 14px',
                                            background:generatingRpt?'#f8fafc':'white',border:'1.5px solid #e2e8f0',
                                            borderRadius:'8px',cursor:generatingRpt?'not-allowed':'pointer',textAlign:'left',
                                            transition:'all .15s'}}>
                                        <div style={{width:32,height:32,borderRadius:'8px',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>
                                            {rt.id==='patient_history'?'📅':rt.id==='patient_prescriptions'?'💊':'🧪'}
                                        </div>
                                        <div style={{flex:1}}>
                                            <div style={{fontWeight:700,fontSize:'0.84rem',color:'#0f172a'}}>{rt.label}</div>
                                            <div style={{fontSize:'0.74rem',color:'#64748b',marginTop:'2px'}}>{rt.desc}</div>
                                        </div>
                                        <span style={{fontSize:16,color:'#94a3b8'}}>{generatingRpt?'⏳':'⬇'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  OPD SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
function OPDSettings() {
    const [settings, setSettings]     = useState({ opd_start_hour:'8', opd_end_hour:'18', slot_capacity:'6', consultation_duration:'10', closed_dates:'' });
    const [saving,   setSaving]       = useState(false);
    const [closedInput,setClosedInput]= useState('');
    const [closedList, setClosedList] = useState([]);

    useEffect(() => {
        fetch(`${API}/admin/opd-settings`).then(r=>r.json()).then(d=>{
            if (d.success) {
                setSettings(d.settings);
                setClosedList((d.settings.closed_dates||'').split(',').map(s=>s.trim()).filter(Boolean));
            }
        }).catch(()=>{});
    }, []);

    const start=parseInt(settings.opd_start_hour)||8, end=parseInt(settings.opd_end_hour)||18, dur=parseInt(settings.consultation_duration)||10;
    const slotsPerHour=Math.floor(60/dur), totalSlots=(end-start)*slotsPerHour, totalMinutes=(end-start)*60;

    const addClosedDate = () => {
        if (!closedInput) return;
        if (closedList.includes(closedInput)) { toast('Date already added.','error'); return; }
        setClosedList([...closedList, closedInput].sort()); setClosedInput('');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const r = await fetch(`${API}/admin/opd-settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...settings,closed_dates:closedList.join(',')})});
            const d = await r.json();
            if (d.success) toast('OPD settings saved.','success'); else toast(d.message||'Save failed.','error');
        } catch { toast('Server error.','error'); }
        finally { setSaving(false); }
    };

    const set = k => e => setSettings(s => ({ ...s, [k]: e.target.value }));
    const hours = Array.from({length:24},(_,i)=>i);
    const durations = [5,10,15,20,30];

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>OPD Settings</h2><p>Configure operating hours, slot duration, and closure dates</p></div>
                <button className="adm-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <><div className="adm-btn-spinner"/>Saving…</> : <><Save size={14}/> Save All Settings</>}
                </button>
            </div>
            <div className="adm-settings-grid">
                <div className="adm-card">
                    <div className="adm-card-head"><h3><Clock size={15}/> Operating Hours</h3></div>
                    <div className="adm-form-row">
                        <div className="adm-form-group">
                            <label>Opening Hour</label>
                            <select className="adm-input" value={settings.opd_start_hour} onChange={set('opd_start_hour')}>
                                {hours.map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                            </select>
                        </div>
                        <div className="adm-form-group">
                            <label>Closing Hour</label>
                            <select className="adm-input" value={settings.opd_end_hour} onChange={set('opd_end_hour')}>
                                {hours.map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="adm-setting-preview"><Activity size={13}/> OPD runs {String(start).padStart(2,'0')}:00 → {String(end).padStart(2,'0')}:00 ({totalMinutes} minutes total)</div>
                </div>
                <div className="adm-card">
                    <div className="adm-card-head"><h3><Stethoscope size={15}/> Appointment Slot Duration</h3></div>
                    <div className="adm-form-group">
                        <label>Consultation Duration (minutes)</label>
                        <div className="adm-duration-btns">
                            {durations.map(d=>(
                                <button key={d} className={`adm-dur-btn ${settings.consultation_duration==d?'active':''}`}
                                    onClick={()=>setSettings(s=>({...s,consultation_duration:String(d)}))}>
                                    {d} min
                                </button>
                            ))}
                        </div>
                        <input className="adm-input" type="number" min="5" max="60" step="5"
                            value={settings.consultation_duration} onChange={set('consultation_duration')} style={{marginTop:'8px'}}/>
                    </div>
                    <div className="adm-form-group">
                        <label>Max Patients per Slot</label>
                        <input className="adm-input" type="number" min="1" max="20" value={settings.slot_capacity} onChange={set('slot_capacity')}/>
                    </div>
                    <div className="adm-setting-preview"><TrendingUp size={13}/> {slotsPerHour} slots/hr × {end-start} hrs = <strong>{totalSlots} total slots</strong></div>
                </div>
                <div className="adm-card adm-card-full">
                    <div className="adm-card-head"><h3><Calendar size={15}/> Today's Slot Schedule Preview</h3><span className="adm-card-sub">{totalSlots} slots</span></div>
                    <div className="adm-slot-preview-grid">
                        {Array.from({length:totalSlots},(_,i)=>{
                            const off=i*dur,hOff=Math.floor(off/60),mOff=off%60;
                            const sHr=start+hOff,sMin=mOff,eMin=(mOff+dur)%60,eHr=start+hOff+Math.floor((mOff+dur)/60);
                            const fmt=(h,m)=>`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                            return <div key={i} className="adm-slot-chip">{fmt(sHr,sMin)}–{fmt(eHr,eMin)}</div>;
                        })}
                    </div>
                </div>
                <div className="adm-card adm-card-full">
                    <div className="adm-card-head"><h3><AlertTriangle size={15}/> Emergency Closure Dates</h3><span className="adm-card-sub">Appointments blocked on these dates</span></div>
                    <div className="adm-closed-add-row">
                        <input className="adm-input" type="date" value={closedInput} min={new Date().toISOString().split('T')[0]} onChange={e=>setClosedInput(e.target.value)}/>
                        <button className="adm-btn-primary" onClick={addClosedDate}><Plus size={14}/> Add Closure Date</button>
                    </div>
                    {closedList.length===0
                        ? <div className="adm-empty" style={{padding:'20px 0'}}><CheckCircle size={16} style={{marginRight:'6px',opacity:.4}}/>No closure dates set.</div>
                        : <div className="adm-closed-list">
                            {closedList.map(d=>(
                                <div key={d} className="adm-closed-chip">
                                    <AlertTriangle size={12}/>
                                    <span>{new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</span>
                                    <button className="adm-closed-remove" onClick={()=>setClosedList(closedList.filter(x=>x!==d))}><X size={12}/></button>
                                </div>
                            ))}
                          </div>
                    }
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  REPORTS — Professional Multi-Category Report System
// ══════════════════════════════════════════════════════════════════════════════

const REPORT_CATEGORIES = [
    {
        id: 'operational',
        label: 'Operational Reports',
        icon: Activity,
        color: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
        reports: [
            { id:'opd_patient_count',         label:'OPD Patient Count',                icon:Users,         desc:'Total patients seen in OPD per day/period' },
            { id:'appointment_statistics',    label:'Appointment Statistics',           icon:Calendar,      desc:'Booked, completed, cancelled, no-show breakdown' },
            { id:'doctor_workload',           label:'Doctor Workload Report',           icon:Stethoscope,   desc:'Appointments handled per doctor' },
        ]
    },
    {
        id: 'clinical',
        label: 'Clinical Reports',
        icon: Stethoscope,
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        reports: [
            { id:'prescription_statistics',   label:'Prescription Statistics',         icon:Pill,          desc:'Most prescribed medications, frequency analysis' },
            { id:'lab_test_statistics',       label:'Lab Test Statistics',             icon:FlaskConical,  desc:'Test types ordered, completion rates' },
        ]
    },
    {
        id: 'management',
        label: 'Management Reports',
        icon: TrendingUp,
        color: '#7c3aed',
        bg: '#faf5ff',
        border: '#ddd6fe',
        reports: [
            { id:'patient_registration_growth', label:'Patient Registration Growth',   icon:TrendingUp,    desc:'New patient registrations over time' },
        ]
    },
];

function ReportsSection() {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedReport,   setSelectedReport]   = useState(null);
    const [dateMode,   setDateMode]   = useState('range'); // 'range' | 'single'
    const [dateFrom,   setDateFrom]   = useState(() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; });
    const [dateTo,     setDateTo]     = useState(new Date().toISOString().split('T')[0]);
    const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
    const [generating, setGenerating] = useState(false);
    const [reportResult, setReportResult] = useState(null); // { title, htmlContent, from, to }

    const effectiveFrom = dateMode === 'single' ? singleDate : dateFrom;
    const effectiveTo   = dateMode === 'single' ? singleDate : dateTo;

    const setQuickRange = (days) => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        setDateFrom(from.toISOString().split('T')[0]);
        setDateTo(to.toISOString().split('T')[0]);
        setDateMode('range');
    };

    const generateReport = async () => {
        if (!selectedReport) { toast('Please select a report type.', 'error'); return; }
        setGenerating(true);
        setReportResult(null);
        try {
            const r = await fetch(`${API}/admin/reports/generate?type=${selectedReport.id}&from=${effectiveFrom}&to=${effectiveTo}`);
            const d = await r.json();
            if (!d.success) { toast(d.message || 'Failed to generate report.', 'error'); return; }
            const html = buildReportHTML(selectedReport, d, effectiveFrom, effectiveTo);
            setReportResult({ title: selectedReport.label, htmlContent: html, from: effectiveFrom, to: effectiveTo });
            toast('Report generated successfully.', 'success');
        } catch {
            // Fallback: generate with mock/empty data structure
            const html = buildReportHTML(selectedReport, {}, effectiveFrom, effectiveTo);
            setReportResult({ title: selectedReport.label, htmlContent: html, from: effectiveFrom, to: effectiveTo });
        } finally { setGenerating(false); }
    };

    const buildReportHTML = (report, data, from, to) => {
    const d = data || {};
    switch(report.id) {
        case 'opd_patient_count': return buildOpdPatientCountHTML(d);
        case 'appointment_statistics': return buildAppointmentStatsHTML(d);
        case 'doctor_workload': return buildDoctorWorkloadHTML(d);
        case 'prescription_statistics': return buildPrescriptionStatsHTML(d);
        case 'lab_test_statistics': return buildLabTestStatsHTML(d);
        case 'patient_registration_growth': return buildRegistrationGrowthHTML(d);
        default: return `<div style="padding:20px;color:#64748b">No data available for this report type.</div>`;
    }
};

    const openReportTab = () => {
        if (!reportResult) return;
        const style = `<style>
            @page{margin:20mm 18mm;size:A4}*{box-sizing:border-box}
            body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;padding:0 24px;font-size:13px;background:#fff}
            .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding:20px 0 14px;border-bottom:3px solid #92400e}
            .logo{font-size:22px;font-weight:800;color:#92400e}.hospital{font-size:12px;color:#64748b;margin-top:2px}
            .header-right{text-align:right}.badge{background:#fdf8f0;border:1px solid #fed7aa;border-radius:6px;padding:4px 10px;font-size:10px;font-weight:700;color:#92400e;display:inline-block}
            .meta{font-size:10px;color:#94a3b8;margin-top:4px}
            h1{font-size:20px;font-weight:800;color:#0f172a;margin:16px 0 4px}
            .period{font-size:12px;color:#64748b;margin-bottom:18px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;display:inline-block}
            .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px}
            .stat-card{border:1.5px solid #e2e8f0;border-radius:8px;padding:12px 14px}
            .stat-val{font-size:26px;font-weight:800}.stat-label{font-size:10px;color:#64748b;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
            .section-title{font-size:12px;font-weight:800;color:#0f172a;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:.06em}
            table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
            thead{background:#92400e}th{padding:8px 12px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:white}
            td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}tr:nth-child(even) td{background:#fafafa}
            .badge-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
            .green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}.amber{color:#d97706}.purple{color:#7c3aed}
            .bg-green{background:#dcfce7}.bg-red{background:#fee2e2}.bg-blue{background:#dbeafe}.bg-amber{background:#fef3c7}.bg-purple{background:#f3e8ff}
            .progress-row{display:flex;align-items:center;gap:10px}
            .progress-track{flex:1;height:6px;background:#f1f5f9;border-radius:10px;overflow:hidden}
            .progress-fill{height:100%;border-radius:10px}
            .no-data{text-align:center;color:#94a3b8;font-style:italic;padding:20px}
            .summary-info{background:#fdf8f0;border:1.5px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:12px;line-height:1.7}
            .footer{margin-top:30px;padding-top:10px;border-top:2px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
        </style>`;
        const now = new Date();
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${reportResult.title}</title>${style}</head><body>
            <div class="header">
                <div><div class="logo">SmartOPD</div><div class="hospital">Base Hospital, Kiribathgoda</div></div>
                <div class="header-right"><div class="badge">OFFICIAL REPORT</div><div class="meta">Generated: ${fmtDTime(now)}</div></div>
            </div>
            <h1>${reportResult.title}</h1>
            <div class="period">📅 Reporting Period: <strong>${fmtDate(reportResult.from)}</strong> — <strong>${fmtDate(reportResult.to)}</strong></div>
            ${reportResult.htmlContent}
            <div class="footer">
                <span>SmartOPD — Base Hospital Kiribathgoda | For internal use only</span>
                <span style="color:#dc2626;font-weight:700">CONFIDENTIAL</span>
            </div>
        </body></html>`;

        const win = window.open('', '_blank');
        if (!win) { toast('Please allow popups to view report.', 'error'); return; }
        win.document.write(html);
        win.document.close();
    };

    const downloadReport = () => {
        if (!reportResult) return;
        downloadPDFReport(reportResult.title, reportResult.from, reportResult.to, reportResult.htmlContent);
    };

    // ── HTML builders ────────────────────────────────────────────────────────
    const statCard = (val, label, color='#2563eb') =>
        `<div class="stat-card" style="border-color:${color}22"><div class="stat-val" style="color:${color}">${val??0}</div><div class="stat-label">${label}</div></div>`;

    const tableRow = cells => `<tr>${cells.map(c=>`<td>${c??'—'}</td>`).join('')}</tr>`;
    const noData = () => `<tr><td colspan="10" class="no-data">No data available for selected period</td></tr>`;

    function buildOpdPatientCountHTML(d) {
        const rows = d.daily || [];
        const total = rows.reduce((s,r)=>s+(r.count||0),0);
        const avg = rows.length ? Math.round(total/rows.length) : 0;
        const max = rows.reduce((m,r)=>Math.max(m,r.count||0),0);
        return `
            <div class="stat-grid">${statCard(total,'Total Patients','#2563eb')}${statCard(rows.length,'Total Days','#7c3aed')}${statCard(avg,'Daily Average','#16a34a')}${statCard(max,'Peak Day','#d97706')}</div>
            <div class="section-title">Daily OPD Patient Count</div>
            <table><thead><tr><th>Date</th><th>Day</th><th>Total Patients</th><th>Distribution</th></tr></thead><tbody>
            ${rows.length ? rows.map(r=>{
                const pct = max>0 ? Math.round((r.count/max)*100) : 0;
                const day = new Date(r.date).toLocaleDateString('en-GB',{weekday:'short'});
                return `<tr><td>${fmtDate(r.date)}</td><td>${day}</td><td><strong>${r.count}</strong></td><td><div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:#2563eb"></div></div><span style="font-size:10px;color:#64748b;width:30px">${pct}%</span></div></td></tr>`;
            }).join('') : noData()}
            </tbody></table>`;
    }

    function buildAppointmentStatsHTML(d) {
    const s = d.summary || {};
    const p = d.prevSummary || {};

    const trend = (current, previous) => {
        if (!previous || previous === 0) return '<span style="color:#94a3b8">—</span>';
        const change = ((current - previous) / previous) * 100;
        const abs = Math.abs(change).toFixed(1);
        if (change > 0) return `<span style="color:#16a34a">▲ ${abs}%</span>`;
        if (change < 0) return `<span style="color:#dc2626">▼ ${abs}%</span>`;
        return `<span style="color:#64748b">→ 0%</span>`;
    };

    let statsHtml = `
        <div class="stat-grid">
            <div class="stat-card" style="border-color:#2563eb22">
                <div class="stat-val" style="color:#2563eb">${s.total||0}</div>
                <div class="stat-label">Total Appointments</div>
                <div style="font-size:9px; margin-top:4px;">vs prev: ${trend(s.total, p.total)}</div>
            </div>
            <div class="stat-card" style="border-color:#16a34a22">
                <div class="stat-val" style="color:#16a34a">${s.completed||0}</div>
                <div class="stat-label">Completed</div>
                <div style="font-size:9px; margin-top:4px;">vs prev: ${trend(s.completed, p.completed)}</div>
            </div>
            <div class="stat-card" style="border-color:#7c3aed22">
                <div class="stat-val" style="color:#7c3aed">${s.booked||0}</div>
                <div class="stat-label">Booked/Pending</div>
                <div style="font-size:9px; margin-top:4px;">vs prev: ${trend(s.booked, p.booked)}</div>
            </div>
            <div class="stat-card" style="border-color:#d9770622">
                <div class="stat-val" style="color:#d97706">${s.cancelled||0}</div>
                <div class="stat-label">Cancelled</div>
                <div style="font-size:9px; margin-top:4px;">vs prev: ${trend(s.cancelled, p.cancelled)}</div>
            </div>
            <div class="stat-card" style="border-color:#dc262622">
                <div class="stat-val" style="color:#dc2626">${s.no_show||0}</div>
                <div class="stat-label">No Shows</div>
                <div style="font-size:9px; margin-top:4px;">vs prev: ${trend(s.no_show, p.no_show)}</div>
            </div>
        </div>
        <div class="section-title">Appointment Outcome Breakdown</div>
        <table><thead><tr><th>Status</th><th>Count</th><th>Percentage</th><th>Distribution</th></tr></thead><tbody>
            ${[['Completed', s.completed||0,'#16a34a'],['Booked/Pending',s.booked||0,'#7c3aed'],['Cancelled',s.cancelled||0,'#d97706'],['No Show',s.no_show||0,'#dc2626']].map(([label,val,color])=>{
                const pct = s.total>0?Math.round((val/s.total)*100):0;
                return `<tr><td><strong>${label}</strong></td><td>${val}</td><td style="color:${color};font-weight:700">${pct}%</td><td><div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div></div></td></tr>`;
            }).join('')}
        </tbody></table>`;

    if (d.byDoctor?.length) {
        statsHtml += `
            <div class="section-title">Appointments by Doctor</div>
            <table><thead><tr><th>Doctor</th><th>Total</th><th>Completed</th><th>Cancelled</th><th>Completion Rate</th></tr></thead><tbody>
            ${d.byDoctor.map(doc => {
                const rate = doc.total>0 ? ((doc.completed/doc.total)*100).toFixed(1)+'%' : '—';
                return `<tr><td><strong>${doc.doctor_name||'—'}</strong></td><td>${doc.total}</td><td class="green">${doc.completed||0}</td><td class="red">${doc.cancelled||0}</td><td><strong>${rate}</strong></td></tr>`;
            }).join('')}
            </tbody></table>`;
    }

    return statsHtml;
}

    function buildDoctorWorkloadHTML(d) {
        const rows = d.workload || d.doctors || [];
        const total = rows.reduce((s,r)=>s+(r.total||0),0);
        return `
            <div class="stat-grid">
                ${statCard(rows.length,'Total Doctors','#2563eb')}
                ${statCard(total,'Total Consultations','#16a34a')}
                ${statCard(rows.length?Math.round(total/rows.length):0,'Avg Per Doctor','#7c3aed')}
            </div>
            <div class="section-title">Doctor Workload Analysis</div>
            <table><thead><tr><th>Rank</th><th>Doctor</th><th>Total Appointments</th><th>Completed</th><th>Cancelled</th><th>No Show</th><th>Workload</th></tr></thead><tbody>
            ${rows.length ? rows.sort((a,b)=>(b.total||0)-(a.total||0)).map((r,i)=>{
                const max = rows[0]?.total || 1;
                const p = Math.round(((r.total||0)/max)*100);
                return `<tr><td><strong>#${i+1}</strong></td><td><strong>${r.doctor_name||r.name||'—'}</strong></td><td><strong>${r.total||0}</strong></td><td class="green">${r.completed||0}</td><td class="amber">${r.cancelled||0}</td><td class="red">${r.no_show||0}</td><td><div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${p}%;background:#2563eb"></div></div><span style="font-size:10px;color:#64748b">${p}%</span></div></td></tr>`;
            }).join('') : noData()}
            </tbody></table>`;
    }



  
    

    function buildPrescriptionStatsHTML(d) {
        const rows = d.medications || d.prescriptions || [];
        const total = d.total || rows.reduce((s,r)=>s+(r.count||0),0);
        return `
            <div class="stat-grid">
                ${statCard(total,'Total Prescriptions','#16a34a')}
                ${statCard(rows.length,'Unique Medications','#2563eb')}
            </div>
            <div class="section-title">Most Prescribed Medications</div>
            <table><thead><tr><th>Rank</th><th>Medication</th><th>Times Prescribed</th><th>Frequency</th></tr></thead><tbody>
            ${rows.length ? rows.sort((a,b)=>(b.count||0)-(a.count||0)).slice(0,20).map((r,i)=>{
                const p = total>0?((r.count/total)*100).toFixed(1):0;
                return `<tr><td><strong>#${i+1}</strong></td><td>${r.medication_name||r.name||'—'}</td><td><strong>${r.count||0}</strong></td><td style="color:#16a34a;font-weight:700">${p}%</td></tr>`;
            }).join('') : noData()}
            </tbody></table>`;
    }

    function buildLabTestStatsHTML(d) {
        const rows = d.tests || [];
        const total = d.total || rows.reduce((s,r)=>s+(r.count||0),0);
        const completed = d.completed || 0;
        return `
            <div class="stat-grid">
                ${statCard(total,'Total Tests Ordered','#2563eb')}
                ${statCard(completed,'Completed','#16a34a')}
                ${statCard(total-completed,'Pending','#d97706')}
            </div>
            <div class="section-title">Lab Test Statistics</div>
            <table><thead><tr><th>Rank</th><th>Test Name</th><th>Total Ordered</th><th>Completed</th><th>Pending</th><th>Completion Rate</th></tr></thead><tbody>
            ${rows.length ? rows.sort((a,b)=>(b.count||0)-(a.count||0)).map((r,i)=>{
                const rate = r.count>0 ? ((r.completed||0)/r.count*100).toFixed(1)+'%' : '—';
                return `<tr><td><strong>#${i+1}</strong></td><td>${r.test_name||r.name||'—'}</td><td>${r.count||0}</td><td class="green">${r.completed||0}</td><td class="amber">${(r.count||0)-(r.completed||0)}</td><td><strong>${rate}</strong></td></tr>`;
            }).join('') : noData()}
            </tbody></table>`;
    }

    function buildRegistrationGrowthHTML(d) {
        const rows = d.growth || d.registrations || [];
        const total = rows.reduce((s,r)=>s+(r.count||0),0);
        const maxVal = rows.reduce((m,r)=>Math.max(m,r.count||0),1);
        return `
            <div class="stat-grid">
                ${statCard(total,'New Registrations','#2563eb')}
                ${statCard(rows.length,'Periods Recorded','#7c3aed')}
                ${statCard(total>0&&rows.length?Math.round(total/rows.length):0,'Avg Per Period','#16a34a')}
            </div>
            <div class="section-title">Patient Registration Growth</div>
            <table><thead><tr><th>Period</th><th>New Patients</th><th>Growth</th></tr></thead><tbody>
            ${rows.length ? rows.map((r,i)=>{
                const prev = i>0 ? rows[i-1].count : null;
                const growth = prev!=null && prev>0 ? ((r.count-prev)/prev*100).toFixed(1) : '—';
                const pct = maxVal>0?Math.round((r.count/maxVal)*100):0;
                const growthColor = growth!=='—' ? (parseFloat(growth)>=0?'#16a34a':'#dc2626') : '#94a3b8';
                return `<tr><td>${r.period||fmtDate(r.date)||'—'}</td><td><strong>${r.count||0}</strong></td><td style="color:${growthColor};font-weight:700">${growth!=='—'?(parseFloat(growth)>=0?'▲':'▼')+Math.abs(parseFloat(growth))+'%':'—'}</td></tr>`;
            }).join('') : noData()}
            </tbody></table>`;
    }

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>Reports</h2><p>Generate professional reports for operational, clinical, management and audit purposes</p></div>
            </div>

            {/* Step 1: Choose Report Type */}
            <div className="adm-reports-step">
                <div className="adm-step-label"><span className="adm-step-num">1</span> Select Report Type</div>
                <div className="adm-report-categories">
                    {REPORT_CATEGORIES.map(cat => (
                        <div key={cat.id} className={`adm-report-cat ${selectedCategory?.id===cat.id?'selected':''}`}
                            style={{'--cat-color':cat.color,'--cat-bg':cat.bg,'--cat-border':cat.border}}
                            onClick={() => { setSelectedCategory(cat); setSelectedReport(null); setReportResult(null); }}>
                            <div className="adm-rcat-header">
                                <div className="adm-rcat-icon"><cat.icon size={18}/></div>
                                <div className="adm-rcat-label">{cat.label}</div>
                                <ChevronDown size={14} className={`adm-rcat-chevron ${selectedCategory?.id===cat.id?'open':''}`}/>
                            </div>
                            {selectedCategory?.id === cat.id && (
                                <div className="adm-rcat-reports">
                                    {cat.reports.map(rpt => (
                                        <div key={rpt.id}
                                            className={`adm-report-item ${selectedReport?.id===rpt.id?'selected':''}`}
                                            onClick={e => { e.stopPropagation(); setSelectedReport(rpt); setReportResult(null); }}>
                                            <div className="adm-ri-icon"><rpt.icon size={14}/></div>
                                            <div>
                                                <div className="adm-ri-label">{rpt.label}</div>
                                                <div className="adm-ri-desc">{rpt.desc}</div>
                                            </div>
                                            {selectedReport?.id===rpt.id && <Check size={14} className="adm-ri-check"/>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 2: Date Range */}
            {selectedReport && (
                <div className="adm-reports-step">
                    <div className="adm-step-label"><span className="adm-step-num">2</span> Select Date Range</div>
                    <div className="adm-card">
                        <div style={{padding:'16px 18px'}}>
                            {/* Date mode toggle */}
                            <div className="adm-date-mode-toggle">
                                <button className={`adm-dmt-btn ${dateMode==='single'?'active':''}`} onClick={()=>setDateMode('single')}>Single Day</button>
                                <button className={`adm-dmt-btn ${dateMode==='range'?'active':''}`} onClick={()=>setDateMode('range')}>Date Range</button>
                            </div>

                            {dateMode === 'single' ? (
                                <div className="adm-form-group" style={{maxWidth:'240px',marginTop:'14px'}}>
                                    <label>Select Date</label>
                                    <input className="adm-input" type="date" value={singleDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e=>setSingleDate(e.target.value)}/>
                                </div>
                            ) : (
                                <>
                                    <div className="adm-quick-ranges">
                                        {[[7,'Last 7 Days'],[30,'Last 30 Days'],[90,'Last 90 Days'],[365,'Last Year']].map(([days,label])=>(
                                            <button key={days} className="adm-qr-btn" onClick={()=>setQuickRange(days)}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="adm-form-row" style={{marginTop:'12px'}}>
                                        <div className="adm-form-group">
                                            <label>From Date</label>
                                            <input className="adm-input" type="date" value={dateFrom}
                                                max={dateTo} onChange={e=>setDateFrom(e.target.value)}/>
                                        </div>
                                        <div className="adm-form-group">
                                            <label>To Date</label>
                                            <input className="adm-input" type="date" value={dateTo}
                                                min={dateFrom} max={new Date().toISOString().split('T')[0]}
                                                onChange={e=>setDateTo(e.target.value)}/>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Selected report summary */}
                            <div className="adm-report-summary-bar">
                                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                    <FileBarChart size={15} color="#92400e"/>
                                    <strong style={{color:'#92400e'}}>{selectedReport.label}</strong>
                                </div>
                                <span style={{color:'#64748b',fontSize:'0.78rem'}}>
                                    {dateMode==='single' ? fmtDate(singleDate) : `${fmtDate(effectiveFrom)} — ${fmtDate(effectiveTo)}`}
                                </span>
                            </div>

                            <button className="adm-btn-primary adm-btn-generate"
                                onClick={generateReport} disabled={generating}>
                                {generating
                                    ? <><div className="adm-btn-spinner"/>Generating Report…</>
                                    : <><BarChart3 size={15}/> Generate Report</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Report Result */}
            {reportResult && (
                <div className="adm-reports-step">
                    <div className="adm-step-label"><span className="adm-step-num">3</span> Report Ready</div>
                    <div className="adm-report-result-card">
                        <div className="adm-rrcard-header">
                            <div className="adm-rrcard-title">
                                <div className="adm-rrcard-icon"><FileBarChart size={20}/></div>
                                <div>
                                    <div className="adm-rrcard-name">{reportResult.title}</div>
                                    <div className="adm-rrcard-period">
                                        Period: {fmtDate(reportResult.from)} — {fmtDate(reportResult.to)}
                                        &nbsp;·&nbsp; Generated: {fmtDTime(new Date())}
                                    </div>
                                </div>
                            </div>
                            <div className="adm-rrcard-actions">
                                <button className="adm-btn-ghost adm-btn-view" onClick={openReportTab}>
                                    <ExternalLink size={14}/> View Report
                                </button>
                                <button className="adm-btn-primary adm-btn-download" onClick={downloadReport}>
                                    <Download size={14}/> Download
                                </button>
                            </div>
                        </div>

                        {/* Inline preview */}
                        <div className="adm-report-inline-preview">
                            <div className="adm-rip-header">
                                <Eye size={13}/> Inline Preview
                            </div>
                            <div className="adm-rip-content"
                                dangerouslySetInnerHTML={{__html: reportResult.htmlContent}}/>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  DATA EXPORT (Excel/CSV)
// ══════════════════════════════════════════════════════════════════════════════
function DataExportSection() {
    const [table, setTable] = useState('appointments');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [preview, setPreview] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    const columnOptions = {
        appointments: ['appointment_id', 'patient_id', 'doctor_id', 'appointment_day', 'start_time', 'end_time', 'queue_no', 'visit_type', 'status', 'is_present', 'created_at', 'completed_at'],
        patients: ['patient_id', 'full_name', 'nic', 'dob', 'gender', 'phone', 'email', 'address', 'blood_group', 'allergies', 'chronic_conditions', 'emergency_contact', 'civil_status', 'barcode', 'is_active', 'created_at'],
        staff: ['staff_id', 'first_name', 'surname', 'email', 'phone', 'nic', 'role_id', 'is_active', 'created_at'],
        prescriptions: ['prescription_id', 'patient_id', 'prescribed_by', 'prescribed_date', 'medication_id', 'dosage', 'duration', 'fulfilled_at', 'pharmacist_id'],
        lab_test: ['test_id', 'patient_id', 'requested_by', 'test_date', 'test_catalog_id', 'status', 'result', 'sample_collected_at', 'completed_at'],
        feedback: ['feedback_id', 'patient_id', 'user_id', 'comment', 'rating', 'date_submitted', 'status', 'admin_note']
    };

    const fetchPreview = useCallback(async () => {
        setPreviewLoading(true);
        try {
            let url = `${API}/admin/export-data?table=${table}`;
            if (dateFrom && dateTo) url += `&from=${dateFrom}&to=${dateTo}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) setPreview(result.data.slice(0, 10));
        } catch (err) { console.error('Preview error:', err); }
        finally { setPreviewLoading(false); }
    }, [table, dateFrom, dateTo]);

    useEffect(() => { fetchPreview(); }, [fetchPreview]);

    const exportToExcel = async () => {
        setLoading(true);
        try {
            let url = `${API}/admin/export-data?table=${table}`;
            if (dateFrom && dateTo) url += `&from=${dateFrom}&to=${dateTo}`;
            if (selectedColumns.length) url += `&columns=${selectedColumns.join(',')}`;
            const res = await fetch(url);
            const result = await res.json();
            if (!result.success) throw new Error(result.message);
            const ws = XLSX.utils.json_to_sheet(result.data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, table);
            XLSX.writeFile(wb, `${table}_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`);
        } catch (err) { alert('Export failed: ' + err.message); }
        finally { setLoading(false); }
    };

    const exportToCSV = async () => {
        setLoading(true);
        try {
            let url = `${API}/admin/export-data?table=${table}`;
            if (dateFrom && dateTo) url += `&from=${dateFrom}&to=${dateTo}`;
            if (selectedColumns.length) url += `&columns=${selectedColumns.join(',')}`;
            const res = await fetch(url);
            const result = await res.json();
            if (!result.success) throw new Error(result.message);
            const headers = Object.keys(result.data[0] || {});
            const csvRows = [headers.join(',')];
            for (const row of result.data) {
                const values = headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`);
                csvRows.push(values.join(','));
            }
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const urlBlob = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob;
            a.download = `${table}_${dateFrom || 'all'}_${dateTo || 'all'}.csv`;
            a.click();
            URL.revokeObjectURL(urlBlob);
        } catch (err) { alert('Export failed: ' + err.message); }
        finally { setLoading(false); }
    };

    const toggleColumn = (col) => {
        setSelectedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    };
    const clearColumns = () => setSelectedColumns([]);

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>Data Export</h2><p>Download raw data as Excel or CSV – choose table, date range, and columns</p></div>
            </div>
            <div className="adm-card">
                <div className="adm-form-row">
                    <div className="adm-form-group">
                        <label>Table</label>
                        <select className="adm-input" value={table} onChange={e => setTable(e.target.value)}>
                            <option value="appointments">Appointments</option>
                            <option value="patients">Patients</option>
                            <option value="staff">Staff</option>
                            <option value="prescriptions">Prescriptions</option>
                            <option value="lab_test">Lab Tests</option>
                            <option value="feedback">Feedback</option>
                        </select>
                    </div>
                    <div className="adm-form-group">
                        <label>From Date (optional)</label>
                        <input className="adm-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div className="adm-form-group">
                        <label>To Date (optional)</label>
                        <input className="adm-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                </div>

                <div className="adm-export-columns">
                    <div className="adm-export-columns-title">
                        <Check size={12} /> Select Columns (leave empty to export all)
                        {selectedColumns.length > 0 && (
                            <button className="adm-btn-ghost adm-btn-xs" onClick={clearColumns} style={{marginLeft:'auto'}}>Clear All</button>
                        )}
                    </div>
                    <div className="adm-export-checkbox-group">
                        {columnOptions[table]?.map(col => (
                            <label key={col} className="adm-export-checkbox">
                                <input type="checkbox" checked={selectedColumns.includes(col)} onChange={() => toggleColumn(col)} />
                                <span>{col}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="adm-export-actions">
                    <button className="adm-btn-primary" onClick={exportToExcel} disabled={loading}>
                        {loading ? <><div className="adm-btn-spinner"/> Exporting…</> : <> <Download size={14}/> Download Excel</>}
                    </button>
                    <button className="adm-btn-ghost" onClick={exportToCSV} disabled={loading}>
                        {loading ? <><div className="adm-btn-spinner"/> Exporting…</> : <> <FileText size={14}/> Download CSV</>}
                    </button>
                    <button className="adm-btn-ghost" onClick={fetchPreview} disabled={previewLoading}>
                        <RefreshCw size={14} className={previewLoading ? 'spin' : ''}/> Refresh Preview
                    </button>
                </div>

                <div className="adm-export-preview">
                    <div className="adm-card-head"><h3><Eye size={13}/> Preview (first 10 rows)</h3></div>
                    {previewLoading ? <div className="adm-loading"><div className="adm-spinner"/></div>
                    : preview.length === 0 ? <div className="adm-empty">No data for selected filters.</div>
                    : <table className="adm-table">
                        <thead><tr>{Object.keys(preview[0] || {}).map(key => <th key={key}>{key}</th>)}</tr></thead>
                        <tbody>
                            {preview.map((row, i) => (
                                <tr key={i}>
                                    {Object.values(row).map((val, j) => <td key={j} className="adm-dimmed">{val !== undefined && val !== null ? String(val).slice(0, 50) : '—'}</td>)}
                                </tr>
                            ))}
                        </tbody>
                      </table>}
                </div>
            </div>
        </div>
    );
}
// ══════════════════════════════════════════════════════════════════════════════
//  SYSTEM LOGS
// ══════════════════════════════════════════════════════════════════════════════
function LogsSection() {
    const [logs,    setLogs]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [page,    setPage]    = useState(1);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo,   setDateTo]   = useState('');
    const [filters, setFilters] = useState({ action:'', table:'', search:'', user:'' });
    const PER_PAGE = 30;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 500 });
            if (dateFrom) params.append('from', dateFrom);
            if (dateTo)   params.append('to',   dateTo);
            const r = await fetch(`${API}/admin/logs?${params}`);
            const d = await r.json();
            if (d.success) setLogs(d.logs || []);
            else setLogs([]);
        } catch { toast('Could not load logs.', 'error'); setLogs([]); }
        finally { setLoading(false); }
    }, [dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const allTables  = [...new Set(logs.map(l => l.table_name).filter(Boolean))].sort();
    const allActions = [...new Set(logs.map(l => l.action).filter(Boolean))].sort();
    const allUsers   = [...new Set(logs.map(l => l.changed_by).filter(Boolean))].sort();

    const filtered = logs.filter(l => {
        const matchAction = !filters.action || l.action?.toLowerCase().includes(filters.action.toLowerCase());
        const matchTable  = !filters.table  || l.table_name === filters.table;
        const matchUser   = !filters.user   || l.changed_by === filters.user;
        const matchSearch = !filters.search || [l.table_name, l.action, String(l.record_id), l.changed_by].join(' ').toLowerCase().includes(filters.search.toLowerCase());
        return matchAction && matchTable && matchSearch && matchUser;
    });

    const pages = Math.ceil(filtered.length / PER_PAGE);
    const slice = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

    const actionColor = a => {
        if (!a) return 'adm-badge-blue';
        if (/delete|remove|deactiv/i.test(a)) return 'adm-badge-red';
        if (/insert|add|create|register/i.test(a)) return 'adm-badge-active';
        if (/update|edit|change|patch/i.test(a)) return 'adm-badge-amber';
        return 'adm-badge-booked';
    };

    const setFilter = k => v => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
    const hasFilters = filters.action||filters.table||filters.search||filters.user||dateFrom||dateTo;

    const clearAll = () => {
        setFilters({action:'',table:'',search:'',user:''});
        setDateFrom(''); setDateTo('');
        setPage(1);
    };

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>System Logs</h2><p>Full audit trail of all database activity and system events</p></div>
                <button className="adm-btn-ghost" onClick={fetchLogs}>
                    <RefreshCw size={14}/> Refresh
                </button>
            </div>

            {/* Summary chips */}
            <div className="adm-role-chips" style={{marginBottom:'16px'}}>
                <div className="adm-role-chip"><Database size={13}/><strong>{logs.length}</strong> Total Entries</div>
                <div className="adm-role-chip" style={{color:'#16a34a'}}><Plus size={13}/><strong>{logs.filter(l=>/insert|add|creat|register/i.test(l.action||'')).length}</strong> Insertions</div>
                <div className="adm-role-chip" style={{color:'#d97706'}}><Edit3 size={13}/><strong>{logs.filter(l=>/update|edit|patch/i.test(l.action||'')).length}</strong> Updates</div>
                <div className="adm-role-chip" style={{color:'#dc2626'}}><Trash2 size={13}/><strong>{logs.filter(l=>/delete|remov|deactiv/i.test(l.action||'')).length}</strong> Deletions</div>
            </div>

            {/* Filters */}
            <div className="adm-card" style={{marginBottom:'16px'}}>
                <div className="adm-card-head">
                    <h3><Filter size={14}/> Filters</h3>
                    {hasFilters && (
                        <button className="adm-btn-ghost adm-btn-xs" onClick={clearAll}>
                            <X size={12}/> Clear All
                        </button>
                    )}
                </div>
                <div className="adm-form-row" style={{padding:'14px 18px'}}>
                    <div className="adm-form-group">
                        <label>Search</label>
                        <div className="adm-search-wrap">
                            <Search size={14} className="adm-search-icon"/>
                            <input className="adm-search" placeholder="Search anything…"
                                value={filters.search} onChange={e => setFilter('search')(e.target.value)}/>
                        </div>
                    </div>
                    <div className="adm-form-group">
                        <label>Table</label>
                        <select className="adm-input" value={filters.table} onChange={e => setFilter('table')(e.target.value)}>
                            <option value="">All Tables</option>
                            {allTables.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="adm-form-group">
                        <label>Action Type</label>
                        <select className="adm-input" value={filters.action} onChange={e => setFilter('action')(e.target.value)}>
                            <option value="">All Actions</option>
                            {allActions.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="adm-form-group">
                        <label>Changed By</label>
                        <select className="adm-input" value={filters.user} onChange={e => setFilter('user')(e.target.value)}>
                            <option value="">All Users</option>
                            {allUsers.map(u => <option key={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                <div className="adm-form-row" style={{padding:'0 18px 14px'}}>
                    <div className="adm-form-group">
                        <label>From Date</label>
                        <input className="adm-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
                    </div>
                    <div className="adm-form-group">
                        <label>To Date</label>
                        <input className="adm-input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
                    </div>
                    <div className="adm-form-group" style={{justifyContent:'flex-end',paddingTop:'22px'}}>
                        <button className="adm-btn-primary" onClick={fetchLogs} disabled={loading}>
                            <Search size={13}/> Apply Filters
                        </button>
                    </div>
                    <div className="adm-form-group"/>
                </div>
                <div style={{padding:'0 18px 12px',fontSize:'0.78rem',color:'#64748b'}}>
                    Showing <strong>{filtered.length}</strong> of <strong>{logs.length}</strong> log entries
                    {hasFilters && <span style={{color:'#92400e',marginLeft:'6px'}}>— filters applied</span>}
                </div>
            </div>

            <div className="adm-card">
                {loading ? <div className="adm-loading"><div className="adm-spinner"/></div> : (
                    <>
                        {logs.length === 0 ? (
                            <div className="adm-empty" style={{padding:'60px 0',flexDirection:'column',gap:'10px'}}>
                                <Database size={32} style={{opacity:.2}}/>
                                <p>No log entries found.</p>
                                <p style={{fontSize:'0.78rem',color:'#94a3b8'}}>Audit logs will appear here as the system is used.</p>
                            </div>
                        ) : (
                            <>
                                <table className="adm-table">
                                    <thead><tr>
                                        <th>Timestamp</th><th>Table</th><th>Action</th>
                                        <th>Record ID</th><th>Changed By</th>
                                    </tr></thead>
                                    <tbody>
                                        {slice.length ? slice.map((l, i) => (
                                            <tr key={i}>
                                                <td className="adm-mono adm-dimmed" style={{fontSize:'0.75rem',whiteSpace:'nowrap'}}>
                                                    {fmtDTime(l.changed_at)}
                                                </td>
                                                <td><code className="adm-code">{l.table_name || '—'}</code></td>
                                                <td><span className={`adm-badge ${actionColor(l.action)}`}>{l.action || '—'}</span></td>
                                                <td className="adm-mono">{l.record_id || '—'}</td>
                                                <td className="adm-dimmed">{l.changed_by || 'system'}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={5} className="adm-empty">No log entries match the current filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>

                                {pages > 1 && (
                                    <div className="adm-pagination">
                                        <button className="adm-page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹ Prev</button>
                                        {Array.from({length:Math.min(pages,7)},(_,i)=>{
                                            const p = page<=4 ? i+1 : page-3+i;
                                            if (p<1||p>pages) return null;
                                            return <button key={p} className={`adm-page-btn ${page===p?'active':''}`} onClick={()=>setPage(p)}>{p}</button>;
                                        })}
                                        <button className="adm-page-btn" disabled={page===pages} onClick={() => setPage(p=>p+1)}>Next ›</button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
//  FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════
function FeedbackSection() {
    const [feedback,   setFeedback]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [saving,     setSaving]     = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [search,     setSearch]     = useState('');
    const [notes,      setNotes]      = useState({});
    const [expanded,   setExpanded]   = useState(null);

    const fetchFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/admin/feedback`);
            const d = await r.json();
            if (d.success) {
                setFeedback(d.feedback || []);
                const noteMap = {};
                (d.feedback || []).forEach(f => { noteMap[f.feedback_id] = f.admin_note || ''; });
                setNotes(noteMap);
            }
        } catch { toast('Failed to load feedback.', 'error'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

    const saveNote = async (feedbackId, status) => {
        setSaving(feedbackId);
        try {
            const r = await fetch(`${API}/admin/feedback/${feedbackId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_note: notes[feedbackId] || '', status })
            });
            const d = await r.json();
            if (d.success) { toast('Note saved.', 'success'); fetchFeedback(); }
            else toast(d.message || 'Failed.', 'error');
        } catch { toast('Server error.', 'error'); }
        finally { setSaving(null); }
    };

    const statusOptions = ['all', 'new', 'reviewed', 'resolved'];
    const filtered = feedback.filter(f => {
        const matchStatus = filterStatus === 'all' || f.status === filterStatus;
        const matchSearch = !search || [f.comment, f.patient_name, f.admin_note].join(' ').toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const statusColor = s => {
        const m = { new:'amber', reviewed:'blue', resolved:'green', closed:'red' };
        return m[s] || 'blue';
    };

    const counts = {
        new:      feedback.filter(f=>f.status==='new').length,
        reviewed: feedback.filter(f=>f.status==='reviewed').length,
        resolved: feedback.filter(f=>f.status==='resolved').length,
    };

    return (
        <div className="adm-section">
            <div className="adm-section-head">
                <div><h2>Feedback & Complaints</h2><p>Review patient and staff feedback — add notes and update status</p></div>
                <button className="adm-btn-ghost" onClick={fetchFeedback}><RefreshCw size={14}/> Refresh</button>
            </div>

            <div className="adm-role-chips" style={{marginBottom:'16px'}}>
                <div className="adm-role-chip">
                    <span style={{color:'#d97706'}}><AlertTriangle size={13}/></span>
                    <strong>{counts.new}</strong> New
                </div>
                <div className="adm-role-chip">
                    <span style={{color:'#2563eb'}}><Eye size={13}/></span>
                    <strong>{counts.reviewed}</strong> Reviewed
                </div>
                <div className="adm-role-chip">
                    <span style={{color:'#16a34a'}}><CheckCircle size={13}/></span>
                    <strong>{counts.resolved}</strong> Resolved
                </div>
            </div>

            <div className="adm-filter-bar" style={{marginBottom:'16px'}}>
                <div className="adm-search-wrap">
                    <Search size={15} className="adm-search-icon"/>
                    <input className="adm-search" placeholder="Search feedback or patient name…"
                        value={search} onChange={e => setSearch(e.target.value)}/>
                </div>
                <div className="adm-role-filter">
                    {statusOptions.map(s => (
                        <button key={s} className={`adm-pill-btn ${filterStatus===s?'active':''}`}
                            onClick={() => setFilterStatus(s)}>
                            {s.charAt(0).toUpperCase()+s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? <div className="adm-loading"><div className="adm-spinner"/></div> : (
                <div className="adm-feedback-list">
                    {filtered.length === 0 && (
                        <div className="adm-empty" style={{background:'white',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'48px'}}>
                            <MessageSquare size={28} style={{opacity:.3,marginBottom:'8px'}}/>
                            <p>No feedback matches your filters.</p>
                        </div>
                    )}
                    {filtered.map(f => {
                        const isOpen = expanded === f.feedback_id;
                        return (
                            <div key={f.feedback_id} className={`adm-feedback-card ${f.status === 'new' ? 'adm-feedback-new' : ''}`}>
                                <div className="adm-feedback-header" onClick={() => setExpanded(isOpen ? null : f.feedback_id)}>
                                    <div className="adm-feedback-meta">
                                        <div className="adm-avatar-sm" style={{background:'#eff6ff',color:'#2563eb',flexShrink:0}}>
                                            {(f.patient_name||f.user_name||'?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{fontWeight:700,fontSize:'0.88rem',color:'#0f172a'}}>
                                                {f.patient_name || f.user_name || `User #${f.user_id||f.patient_id||'?'}`}
                                                {f.patient_id && <span className="adm-tag-sm" style={{marginLeft:'8px'}}>Patient</span>}
                                                {!f.patient_id && f.user_id && <span className="adm-tag-sm adm-tag-staff" style={{marginLeft:'8px'}}>Staff</span>}
                                            </div>
                                            <div style={{fontSize:'0.72rem',color:'#94a3b8',marginTop:'2px'}}>
                                                {fmtDTime(f.date_submitted)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                        <span className={`adm-badge adm-badge-${statusColor(f.status)}`}>{f.status}</span>
                                        <ChevronDown size={16} style={{color:'#94a3b8',transform:isOpen?'rotate(180deg)':'none',transition:'transform .2s'}}/>
                                    </div>
                                </div>

                                <div className="adm-feedback-comment">
                                    <MessageSquare size={13} style={{color:'#94a3b8',flexShrink:0,marginTop:'2px'}}/>
                                    <p style={{margin:0,fontSize:'0.85rem',color:'#334155',lineHeight:1.6,fontStyle:'italic'}}>
                                        "{f.comment}"
                                    </p>
                                </div>

                                {isOpen && (
                                    <div className="adm-feedback-expand">
                                        <div className="adm-form-group">
                                            <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.78rem',fontWeight:700,color:'#334155',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px'}}>
                                                <Edit3 size={13}/> Admin Note
                                            </label>
                                            <textarea className="adm-input" rows={3}
                                                style={{resize:'vertical',lineHeight:'1.6'}}
                                                placeholder="Add your review notes, observations, or actions taken…"
                                                value={notes[f.feedback_id] || ''}
                                                onChange={e => setNotes(n => ({ ...n, [f.feedback_id]: e.target.value }))}/>
                                        </div>
                                        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'}}>
                                            <button className="adm-btn-ghost adm-btn-xs" disabled={saving===f.feedback_id}
                                                onClick={() => saveNote(f.feedback_id, 'reviewed')}>
                                                <Eye size={12}/> Mark Reviewed
                                            </button>
                                            <button className="adm-btn-primary" style={{padding:'6px 14px',fontSize:'0.78rem'}}
                                                disabled={saving===f.feedback_id}
                                                onClick={() => saveNote(f.feedback_id, 'resolved')}>
                                                {saving===f.feedback_id
                                                    ? <><div className="adm-btn-spinner"/>Saving…</>
                                                    : <><CheckCircle size={12}/> Save & Resolve</>}
                                            </button>
                                            {f.status !== 'new' && (
                                                <button className="adm-btn-ghost adm-btn-xs" disabled={saving===f.feedback_id}
                                                    onClick={() => saveNote(f.feedback_id, 'new')}>
                                                    Reopen
                                                </button>
                                            )}
                                        </div>
                                        {f.admin_note && (
                                            <div style={{marginTop:'12px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 14px',fontSize:'0.82rem',color:'#475569'}}>
                                                <strong style={{display:'block',fontSize:'0.7rem',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'4px',color:'#94a3b8'}}>Previous note</strong>
                                                {f.admin_note}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}