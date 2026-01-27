import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css'; // Keep the same CSS for consistent theme
import { useNavigate } from 'react-router-dom';
import { 
    ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut, 
    ArrowLeft, Search, Users, Clock, UserSearch, 
    Fingerprint, Activity, CheckCircle, AlertTriangle, 
    Calendar, UserPlus, CreditCard, Send, Star 
} from 'lucide-react';

export default function ReceptionistDashboard({ user, setUser }) {
    const [openPatients, setOpenPatients] = useState([]);
    const [activeTab, setActiveTab] = useState('home');
    const navigate = useNavigate();

    const openPatientSession = (patient) => {
        if (!openPatients.find(p => p.id === patient.id)) {
            setOpenPatients([...openPatients, patient]);
        }
        setActiveTab(patient.id);
    };

    const closeTab = (id, e) => {
        e.stopPropagation();
        const filtered = openPatients.filter(p => p.id !== id);
        setOpenPatients(filtered);
        if (activeTab === id) setActiveTab('home');
    };

    return (
        <div className="doctor-layout"> 
            <aside className="sidebar">
                <div className="sidebar-logo" style={{ color: 'white', marginBottom: '2rem', fontWeight: 800, fontSize: '1.5rem' }}>
                    SmartOPD <small style={{fontSize: '0.6rem', display: 'block', opacity: 0.7}}>FRONT DESK</small>
                </div>
                
                <div className="sidebar-scroll">
                    <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <Home size={20} className="nav-icon" /> 
                        <span>RECEPTION HOME</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'retrieve' ? 'active' : ''}`} onClick={() => setActiveTab('retrieve')}>
                        <UserSearch size={20} className="nav-icon" /> 
                        <span>FIND PATIENT</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        <User size={20} className="nav-icon" /> 
                        <span>MY PROFILE</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                        <Bell size={20} />
                        <span>ALERTS</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
                        <MessageSquare size={20} />
                        <span>FEEDBACK</span>
                    </button>

                    <div style={{ margin: 'auto' }}></div>

                    <button className="nav-item" onClick={() => { setUser(null); navigate('/'); }} style={{ color: '#fca5a5' }}>
                        <LogOut size={20} className="nav-icon" /> 
                        <span>LOGOUT</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <div className="internal-tab-bar">
                    <div className={`tab-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        Front Desk Feed
                    </div>

                    {openPatients.map(p => (
                        <div key={p.id} className={`tab-item ${activeTab === p.id ? 'active' : ''}`} onClick={() => setActiveTab(p.id)}>
                            {p.name}
                            <X size={14} className="close-icon" onClick={(e) => closeTab(p.id, e)} />
                        </div>
                    ))}
                </div>

                <div className="tab-window">
                    {(activeTab === 'home' || !activeTab) && <ReceptionHome onOpen={openPatientSession} user={user} />}
                    {activeTab === 'profile' && <ReceptionProfile user={user} setUser={setUser} />}
                    {activeTab === 'retrieve' && <FindPatient onOpen={openPatientSession} />}
                    {activeTab === 'notifications' && <ReceptionNotifications />}
                    {activeTab === 'feedback' && <ReceptionFeedback user={user} />}

                    {openPatients.map(p => (
                        <div key={p.id} style={{ display: activeTab === p.id ? 'block' : 'none' }}>
                            <RegistrationPortal patient={p} user={user} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

// --- RECEPTION HOME ---
function ReceptionHome({ onOpen, user }) {
    const arrivalQueue = [
        { id: 'P-901', name: 'Kamal Perera', time: '08:30 AM', status: 'Registered', purpose: 'General Checkup' },
        { id: 'P-902', name: 'Sunil Shantha', time: '08:45 AM', status: 'Pending Pay', purpose: 'Lab Follow-up' },
    ];

    return (
        <div className="doctor-home-container animate-fade-in">
            <div className="hero-section" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Welcome, {user?.name || 'Receptionist'}</h1>
                        <p>Manage today's patient arrivals and registrations.</p>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="glass-stat blue">
                    <div className="stat-icon"><UserPlus size={20} /></div>
                    <div className="stat-info"><h3>12</h3><p>New Regs</p></div>
                </div>
                <div className="glass-stat green">
                    <div className="stat-icon"><Calendar size={20} /></div>
                    <div className="stat-info"><h3>45</h3><p>Appointments</p></div>
                </div>
                <div className="glass-stat orange">
                    <div className="stat-icon"><CreditCard size={20} /></div>
                    <div className="stat-info"><h3>8</h3><p>Pending Payments</p></div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                <div className="card queue-card">
                    <div className="queue-list"> 
                        <p><b>Today's Arrival List</b></p>
                        {arrivalQueue.map(p => (
                            <div key={p.id} className="queue-item">
                                <div className="p-time">{p.time}</div>
                                <div className="p-avatar" style={{background: '#3b82f6'}}>{p.name.charAt(0)}</div>
                                <div className="p-info">
                                    <span className="p-name">{p.name}</span>
                                    <span className="p-reason">{p.purpose}</span>
                                </div>
                                <div className="p-status"><span className={`status-tag ${p.status.toLowerCase().replace(' ', '-')}`}>{p.status}</span></div>
                                <div className="p-action">
                                    <button className="action-circle-btn" onClick={() => onOpen(p)}>
                                        <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- PROFILE ---
function ReceptionProfile({ user, setUser }) {
    return (
        <div className="profile-wrapper animate-fade-in">
            <div className="profile-id-banner" style={{ background: 'linear-gradient(135deg, #3b82f6, #1e40af)' }}>
                <div className="profile-avatar-circle">{user?.name?.charAt(0) || 'R'}</div>
                <div className="profile-main-meta">
                    <h2>{user?.name || 'Reception Staff'}</h2>
                    <span className="staff-badge">Front Desk ID: REC-{user?.staff_id || '101'}</span>
                </div>
            </div>
            <div className="profile-grid-container">
                <div className="card glass-card">
                    <h3 className="sub-title">Account Info</h3>
                    <div className="input-group"><label>Email</label><div className="locked-field"><span>{user?.email}</span></div></div>
                    <div className="input-group mt-20"><label>Role</label><div className="role-chip">Receptionist</div></div>
                </div>
            </div>
        </div>
    );
}

// --- FIND PATIENT ---
function FindPatient({ onOpen }) {
    return (
        <div className="retrieve-container animate-fade-in">
            <div className="search-glass-card">
                <div className="search-header">
                    <div className="search-icon-circle"><UserSearch size={32} /></div>
                    <h2>Search Patient Records</h2>
                </div>
                <div className="search-input-wrapper">
                    <div className="input-with-icon">
                        <Fingerprint className="field-icon" size={20} />
                        <input className="luxury-input" placeholder="NIC, Phone or Name..." />
                    </div>
                    <button className="luxury-search-btn"><Search size={18} /><span>Find</span></button>
                </div>
            </div>
        </div>
    );
}

// --- NOTIFICATIONS ---
function ReceptionNotifications() {
    const alerts = [
        { id: 1, type: 'urgent', title: 'OPD Closing Date', message: 'The facility will be closed on the 14th for the holiday. Inform visiting patients.', time: '10 mins ago' },
        { id: 2, type: 'info', title: 'Appointment Update', message: 'Dr. Wickramasinghe is running 15 mins late.', time: '1 hour ago' }
    ];
    return (
        <div className="portal-container animate-fade-in">
            <div className="section-header-glass"><h2>Reception Alerts</h2></div>
            <div className="notification-feed-glass">
                {alerts.map(n => (
                    <div key={n.id} className={`notif-card-glass ${n.type}`}>
                        <div className="notif-accent" />
                        <div className="notif-body">
                            <h4>{n.type === 'urgent' && <AlertTriangle size={16} />} {n.title}</h4>
                            <p>{n.message}</p>
                            <span className="notif-time">{n.time}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- FEEDBACK ---
function ReceptionFeedback() {
    return (
        <div className="portal-container animate-fade-in">
            <div className="section-header-glass"><MessageSquare size={24} /><h2>System Feedback</h2></div>
            <div className="card glass-form-card">
                <div className="stars-row">
                    {[1, 2, 3, 4, 5].map(num => <Star key={num} size={32} color="#cbd5e1" />)}
                </div>
                <textarea className="figma-textarea" placeholder="How is the registration flow working?"></textarea>
                <button className="primary-btn-large" style={{marginTop: '20px', background: '#3b82f6'}}>Send Feedback</button>
            </div>
        </div>
    );
}

// --- REGISTRATION PORTAL (TAB CONTENT) ---
function RegistrationPortal({ patient }) {
    return (
        <div className="portal-container animate-fade-in">
            <div className="portal-header-glass">
                <div className="patient-mini-card">
                    <div className="p-avatar-small">{patient.name.charAt(0)}</div>
                    <div><h4>{patient.name}</h4><span>ID: {patient.id}</span></div>
                </div>
            </div>
            <div className="dashboard-main-grid">
                <div className="card glass-form-card">
                    <h3 className="section-title"><Calendar size={18} /> Appointment Details</h3>
                    <div className="input-group mt-20">
                        <label>Assign Doctor</label>
                        <select className="styled-select">
                            <option>Dr. Wickramasinghe (OPD)</option>
                            <option>Dr. Perera (Clinic)</option>
                        </select>
                    </div>
                    <button className="primary-btn-large" style={{marginTop: '20px', background: '#10b981'}}>Confirm Arrival</button>
                </div>
            </div>
        </div>
    );
}

