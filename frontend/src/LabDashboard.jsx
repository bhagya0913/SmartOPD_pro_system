import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css'; // Reuse existing luxury styles
import { useNavigate } from 'react-router-dom';
import { 
    ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut, 
    ArrowLeft, Search, Users, Clock, UserSearch, 
    Fingerprint, Activity, Beaker, CheckCircle, FlaskConical, 
    AlertTriangle, FileText, Upload, Send, Star 
} from 'lucide-react';

export default function LabDashboard({ user, setUser }) {
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
                    SmartOPD <small style={{fontSize: '0.6rem', display: 'block', opacity: 0.7}}>DIAGNOSTICS UNIT</small>
                </div>
                
                <div className="sidebar-scroll">
                    <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <Home size={20} className="nav-icon" /> 
                        <span>LAB HOME</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'retrieve' ? 'active' : ''}`} onClick={() => setActiveTab('retrieve')}>
                        <ScanBarcode size={20} className="nav-icon" /> 
                        <span>SCAN REQUEST</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        <User size={20} className="nav-icon" /> 
                        <span>MY PROFILE</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                        <Bell size={20} />
                        <span>NOTIFICATIONS</span>
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
                        Worklist Overview
                    </div>

                    {openPatients.map(p => (
                        <div key={p.id} className={`tab-item ${activeTab === p.id ? 'active' : ''}`} onClick={() => setActiveTab(p.id)}>
                            {p.name}
                            <X size={14} className="close-icon" onClick={(e) => closeTab(p.id, e)} />
                        </div>
                    ))}
                </div>

                <div className="tab-window">
                    {(activeTab === 'home' || !activeTab) && <LabHome onOpen={openPatientSession} user={user} />}
                    {activeTab === 'profile' && <LabProfile user={user} setUser={setUser} />}
                    {activeTab === 'retrieve' && <RetrieveTest onOpen={openPatientSession} />}
                    {activeTab === 'notifications' && <LabNotifications />}
                    {activeTab === 'feedback' && <LabFeedback user={user} />}

                    {openPatients.map(p => (
                        <div key={p.id} style={{ display: activeTab === p.id ? 'block' : 'none' }}>
                            <LabPortal patient={p} user={user} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

// --- LAB HOME ---
function LabHome({ onOpen, user }) {
    const labQueue = [
        { id: 'T-501', name: 'Nimal Sena', time: '10:00 AM', status: 'Pending', type: 'Lab', test_name: 'Full Blood Count' },
        { id: 'T-502', name: 'Saman Kumara', time: '10:15 AM', status: 'In Progress', type: 'Imaging', test_name: 'Chest X-Ray' },
    ];

    return (
        <div className="doctor-home-container animate-fade-in">
            <div className="hero-section">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Welcome, Champa {user?.surname || ' '}</h1>
                    </div>
                    <div className="hero-badge">
                        <div className="pulse-icon"></div>
                        <span>Lab Online</span>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="glass-stat blue">
                    <div className="stat-icon"><Beaker size={20} /></div>
                    <div className="stat-info">
                        <h3>28</h3>
                        <p>Pending Tests</p>
                    </div>
                </div>
                <div className="glass-stat green">
                    <div className="stat-icon"><CheckCircle size={20} /></div>
                    <div className="stat-info">
                        <h3>142</h3>
                        <p>Completed Today</p>
                    </div>
                </div>
               
            </div>

            <div className="dashboard-main-grid">
                <div className="card queue-card">
                    <div className="queue-list"> 
                        <p><b>Diagnostic Worklist</b></p>
                        {labQueue.map(t => (
                            <div key={t.id} className="queue-item">
                                <div className="p-time">{t.time}</div>
                                <div className="p-avatar" style={{background: '#6366f1'}}>{t.name.charAt(0)}</div>
                                <div className="p-info">
                                    <span className="p-name">{t.name}</span>
                                    <span className="p-reason">{t.test_name} ({t.type})</span>
                                </div>
                                <div className="p-status">
                                    <span className={`status-tag ${t.status.toLowerCase().replace(' ', '-')}`}>
                                        {t.status}
                                    </span>
                                </div>
                                <div className="p-action">
                                    <button className="action-circle-btn" onClick={() => onOpen(t)}>
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
function LabProfile({ user, setUser }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: user?.full_name || 'Champa',
        email: user?.email || 'lab@smartopd.com',
        phone: user?.phone || '',
        gender: user?.gender || 'Male',
        dob: user?.dob || '',
        address: user?.address || ''
    });

    return (
        <div className="profile-wrapper animate-fade-in">
            <div className="profile-id-banner">
                <div className="profile-avatar-circle" style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
                    {formData.full_name.charAt(0)}
                </div>
                <div className="profile-main-meta">
                    <h2>{formData.full_name}</h2>
                    <span className="staff-badge">Lab Staff ID: LAB-{user?.staff_id || '909'}</span>
                </div>
                <div className="profile-actions">
                    <button className={isEditing ? "save-btn" : "edit-btn"} onClick={() => setIsEditing(!isEditing)}>
                        {isEditing ? 'Commit Changes' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            <div className="profile-grid-container">
                <div className="card glass-card">
                    <h3 className="sub-title">Facility Authorization</h3>
                    <div className="input-group">
                        <label>Login Email</label>
                        <div className="locked-field"><span>{formData.email}</span></div>
                    </div>
                    <div className="input-group mt-20">
                        <label>Department</label>
                        <div className="role-chip" style={{background: '#e0e7ff', color: '#4338ca'}}>Diagnostic Services</div>
                    </div>
                </div>

                <div className="card glass-card">
                    <h3 className="sub-title">Personal Details</h3>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Full Name</label>
                            <input className="styled-input" disabled={!isEditing} value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Phone</label>
                            <input className="styled-input" disabled={!isEditing} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- NOTIFICATIONS ---
function LabNotifications() {
    const alerts = [
        { id: 1, type: 'urgent', title: 'OPD Closing Date', message: 'OPD will be closed on the 14th of April for New Year. Schedule all urgent tests accordingly.', time: '1 hour ago' },
        { id: 2, type: 'info', title: 'New Test Request', message: 'Dr. Wickramasinghe requested a Chest X-Ray for Saman Kumara.', time: '2 hours ago' }
    ];

    return (
        <div className="portal-container animate-fade-in">
            <div className="tab-header-flex">
                <div className="section-header-glass">
                    <h2>Diagnostic Alerts</h2>
                </div>
                <span className="badge-pulse">{alerts.length} New</span>
            </div>
            <div className="notification-feed-glass">
                {alerts.map(n => (
                    <div key={n.id} className={`notif-card-glass ${n.type}`}>
                        <div className="notif-accent" />
                        <div className="notif-body">
                            <div className="notif-header">
                                <h4>{n.type === 'urgent' && <AlertTriangle size={16} />} {n.title}</h4>
                                <span className="notif-time">{n.time}</span>
                            </div>
                            <p>{n.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- FEEDBACK ---
function LabFeedback({ user }) {
    const [rating, setRating] = useState(5);
    return (
        <div className="portal-container animate-fade-in">
            <div className="section-header-glass">
                <MessageSquare size={24} />
                <h2>Lab System Feedback</h2>
            </div>
            <div className="card glass-form-card">
                <div className="rating-selector">
                    <label>How is the result upload speed?</label>
                    <div className="stars-row">
                        {[1, 2, 3, 4, 5].map(num => (
                            <Star key={num} onClick={() => setRating(num)} fill={num <= rating ? "#fbbf24" : "none"} color={num <= rating ? "#fbbf24" : "#cbd5e1"} size={32} />
                        ))}
                    </div>
                </div>
                <textarea className="figma-textarea" placeholder="Any issues with file uploads or summary entry?"></textarea>
                <button className="primary-btn-large" style={{marginTop: '20px'}}>Submit Report</button>
            </div>
        </div>
    );
}

// --- RETRIEVE TEST ---
function RetrieveTest({ onOpen }) {
    return (
        <div className="retrieve-container animate-fade-in">
            <div className="search-glass-card">
                <div className="search-header">
                    <div className="search-icon-circle"><UserSearch size={32} /></div>
                    <h2>Access Test Request</h2>
                </div>
                <p>Scan the patient's request barcode or enter NIC to start the procedure.</p>
                <div className="search-input-wrapper">
                    <div className="input-with-icon">
                        <Fingerprint className="field-icon" size={20} />
                        <input className="luxury-input" placeholder="NIC or Test ID..." />
                    </div>
                    <button className="luxury-search-btn">
                        <Search size={18} />
                        <span>Search</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- LAB PORTAL (RESULT UPLOAD) ---
function LabPortal({ patient, user }) {
    return (
        <div className="portal-container animate-fade-in">
            <div className="portal-header-glass">
                <div className="patient-mini-card">
                    <div className="p-avatar-small">{patient.name.charAt(0)}</div>
                    <div>
                        <h4>{patient.name}</h4>
                        <span>Request ID: {patient.id}</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                <div className="card glass-form-card">
                    <h3 className="section-title"><FlaskConical size={18} /> Test Details</h3>
                    <div className="detail-row">
                        <label>Test Name:</label>
                        <span>{patient.test_name}</span>
                    </div>
                    <div className="detail-row">
                        <label>Category:</label>
                        <span>{patient.type}</span>
                    </div>
                </div>

                <div className="card glass-form-card">
                    <h3 className="section-title"><Upload size={18} /> Upload Results</h3>
                    <div className="input-group">
                        <label>Summary / Findings</label>
                        <textarea className="figma-textarea" placeholder="Enter test summary..."></textarea>
                    </div>
                    <div className="input-group mt-20">
                        <label>Attach Report (PDF/JPG)</label>
                        <div className="file-upload-zone">
                            <input type="file" id="lab-file" hidden />
                            <label htmlFor="lab-file" className="secondary-btn" style={{width: '100%', textAlign: 'center', cursor: 'pointer'}}>
                                <FileText size={16} /> Choose File
                            </label>
                        </div>
                    </div>
                    <button className="primary-btn-large" style={{marginTop: '30px', width: '100%'}}>
                        <Send size={18} /> Submit Results
                    </button>
                </div>
            </div>
        </div>
    );
}