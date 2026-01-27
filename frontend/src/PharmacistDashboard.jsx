import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css'; // Reuse existing luxury styles [cite: 347]
import { useNavigate } from 'react-router-dom';
import { 
    ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut, 
    ArrowLeft, Search, Users, Clock, UserSearch, 
    Fingerprint, Pill, CheckCircle, Package, AlertTriangle,
    Activity, Send, Star // Add Star here
} from 'lucide-react';


export default function PharmacistDashboard({ user, setUser }) {
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
        <div className="doctor-layout"> {/* Exact same layout class  */}
            <aside className="sidebar">
                <div className="sidebar-logo" style={{ color: 'white', marginBottom: '2rem', fontWeight: 800, fontSize: '1.5rem' }}>
    SmartOPD <small style={{fontSize: '0.6rem', display: 'block', opacity: 0.7}}>PHARMACY UNIT</small>
</div>
                
                <div className="sidebar-scroll">
                    <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <Home size={20} className="nav-icon" /> 
                        <span>PHARMACY HOME</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'retrieve' ? 'active' : ''}`} onClick={() => setActiveTab('retrieve')}>
                        <ScanBarcode size={20} className="nav-icon" /> 
                        <span>RETRIEVE ORDER</span>
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
                        Dashboard
                    </div>

                    {openPatients.map(p => (
                        <div key={p.id} className={`tab-item ${activeTab === p.id ? 'active' : ''}`} onClick={() => setActiveTab(p.id)}>
                            {p.name}
                            <X size={14} className="close-icon" onClick={(e) => closeTab(p.id, e)} />
                        </div>
                    ))}
                </div>

                <div className="tab-window">
                    {(activeTab === 'home' || !activeTab) && <PharmacistHome onOpen={openPatientSession} user={user} />}
                    {activeTab === 'profile' && <PharmacistProfile user={user} setUser={setUser} />}
                    {activeTab === 'retrieve' && <RetrievePatient onOpen={openPatientSession} />}
                    {activeTab === 'notifications' && <PharmacistNotifications />}
                    {activeTab === 'feedback' && <PharmacistFeedback user={user} />}

                    {openPatients.map(p => (
                        <div key={p.id} style={{ display: activeTab === p.id ? 'block' : 'none' }}>
                            <PharmacyPortal patient={p} user={user} />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

// --- PHARMACIST HOME ---
function PharmacistHome({ onOpen, user }) {
    const dispensingQueue = [
        { id: 'P-9921', name: 'Kamal Perera', time: '09:10 AM', status: 'Pending', age: 45, reason: 'Hypertension Meds' },
        { id: 'P-8822', name: 'Sunil Shantha', time: '09:45 AM', status: 'In Review', age: 29, reason: 'Antibiotic Course' },
    ];

    return (
        <div className="doctor-home-container animate-fade-in">
            <div className="hero-section">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Welcome, Ph. {user?.surname || 'Pharmacist'}</h1>
                    </div>
                    <div className="hero-badge">
                        <div className="pulse-icon"></div>
                        <span>Pharmacy Open</span>
                    </div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="glass-stat blue">
                    <div className="stat-icon"><Package size={20} /></div>
                    <div className="stat-info">
                        <h3>124</h3>
                        <p>Total Orders</p>
                    </div>
                </div>
                <div className="glass-stat green">
                    <div className="stat-icon"><CheckCircle size={20} /></div>
                    <div className="stat-info">
                        <h3>82</h3>
                        <p>Fulfilled</p>
                    </div>
                </div>
                <div className="glass-stat orange">
                    <div className="stat-icon"><Pill size={20} /></div>
                    <div className="stat-info">
                        <h3>14</h3>
                        <p>Pending</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-main-grid">
                <div className="card queue-card">
                    <div className="queue-list"> 
                        <p><b>Pending Dispensations</b></p>
                        {dispensingQueue.map(p => (
                            <div key={p.id} className="queue-item">
                                <div className="p-time">{p.time}</div>
                                <div className="p-avatar">{p.name.charAt(0)}</div>
                                <div className="p-info">
                                    <span className="p-name">{p.name}</span>
                                    <span className="p-reason">{p.reason}</span>
                                </div>
                                <div className="p-status">
                                    <span className={`status-tag ${p.status.toLowerCase().replace(' ', '-')}`}>
                                        {p.status}
                                    </span>
                                </div>
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

// --- REUSED COMPONENTS WITH LABEL CHANGES ---
function PharmacistProfile({ user, setUser }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        gender: user?.gender || '',
        dob: user?.dob || '',
        address: user?.address || ''
    });

    return (
        <div className="profile-wrapper animate-fade-in">
            {/* Header / ID Card Section */}
            <div className="profile-id-banner pharmacy-theme-banner">
                <div className="profile-avatar-circle" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {formData.full_name.charAt(0)}
                </div>
                <div className="profile-main-meta">
                    <h2>{formData.full_name}</h2>
                    <span className="staff-badge">Pharmacist ID: PHARM-{user?.staff_id || '001'}</span>
                </div>
                <div className="profile-actions">
                    <button 
                        className={isEditing ? "save-btn" : "edit-btn"} 
                        onClick={() => isEditing ? console.log("Save Logic for Pharmacist") : setIsEditing(true)}
                    >
                        {isEditing ? 'Commit Changes' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            <div className="profile-grid-container">
                {/* Account Settings (Immutable) */}
                <div className="card glass-card">
                    <h3 className="sub-title">Pharmacy Access Security</h3>
                    <div className="input-group">
                        <label>Professional Email</label>
                        <div className="locked-field">
                            <span>{formData.email}</span>
                            <small>Primary ID (Cannot be changed)</small>
                        </div>
                    </div>
                    <div className="input-group mt-20">
                        <label>Current Role</label>
                        <div className="role-chip" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid #10b981' }}>
                            {user?.role_name || 'Chief Pharmacist'}
                        </div>
                    </div>
                </div>

                {/* Personal Information (Editable) */}
                <div className="card glass-card">
                    <h3 className="sub-title">Personal Details</h3>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Full Name</label>
                            <input 
                                className="styled-input" 
                                disabled={!isEditing}
                                value={formData.full_name}
                                onChange={e => setFormData({...formData, full_name: e.target.value})}
                            />
                        </div>
                        <div className="input-group">
                            <label>Phone Number</label>
                            <input 
                                className="styled-input" 
                                disabled={!isEditing}
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="form-row mt-20">
                        <div className="input-group">
                            <label>Gender</label>
                            <select 
                                className="styled-select" 
                                disabled={!isEditing}
                                value={formData.gender}
                                onChange={e => setFormData({...formData, gender: e.target.value})}
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Date of Birth</label>
                            <input 
                                type="date"
                                className="styled-input" 
                                disabled={!isEditing}
                                value={formData.dob}
                                onChange={e => setFormData({...formData, dob: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="input-group mt-20">
                        <label>Residential Address</label>
                        <textarea 
                            className="styled-textarea" 
                            disabled={!isEditing}
                            value={formData.address}
                            onChange={e => setFormData({...formData, address: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
function PharmacistNotifications() {
    const sampleNotifications = [
        { 
            id: 1, 
            type: 'urgent', 
            title: 'Holiday Closure Notice', 
            message: 'The OPD and Pharmacy will be closed on February 4th for Independence Day. Please ensure all recurring prescriptions are filled by the 3rd.', 
            time: 'Just Now' 
        }
        
    ];

    return (
        <div className="portal-container animate-fade-in">
            <div className="tab-header-flex">
                <div className="section-header-glass">
                    <h2>Pharmacy Alerts</h2>
                    
                </div>
                <span className="badge-pulse" style={{ background: '#10b981' }}>
                    {sampleNotifications.length} New
                </span>
            </div>

            <div className="notification-feed-glass">
                {sampleNotifications.map(n => (
                    <div key={n.id} className={`notif-card-glass ${n.type}`}>
                        <div className="notif-accent" />
                        <div className="notif-body">
                            <div className="notif-header">
                                <h4>
                                    {n.type === 'urgent' && <AlertTriangle size={16} />} 
                                    {n.title}
                                </h4>
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

function PharmacistFeedback({ user }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [history, setHistory] = useState([
        { 
            feedback_id: 1, 
            rating: 5, 
            comment: "The barcode integration is working perfectly. Very fast retrieval.", 
            submitted_at: new Date().toISOString() 
        },
        { 
            feedback_id: 2, 
            rating: 4, 
            comment: "Would be helpful to see a real-time stock count in the dispensing portal.", 
            submitted_at: new Date(Date.now() - 86400000).toISOString() 
        }
    ]);

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Thank you, Pharmacist. Your feedback helps improve the dispensing platform.");
        setComment('');
    };

    return (
        <div className="portal-container animate-fade-in">
            <div className="section-header-glass">
                <MessageSquare size={24} />
                <h2>Pharmacy Platform Feedback</h2>
                <p>Help us optimize the medication fulfillment process.</p>
            </div>

            <div className="card glass-form-card">
                <form onSubmit={handleSubmit}>
                    <div className="rating-selector">
                        <label>Experience Rating</label>
                        <div className="stars-row">
                            {[1, 2, 3, 4, 5].map(num => (
                                <Star 
                                    key={num} 
                                    onClick={() => setRating(num)} 
                                    fill={num <= rating ? "#fbbf24" : "none"}
                                    color={num <= rating ? "#fbbf24" : "#cbd5e1"}
                                    size={32}
                                    style={{ cursor: 'pointer', transition: '0.2s' }}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <textarea
                        className="figma-textarea"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What would make your dispensing workflow faster?"
                        required
                    />
                    <button type="submit" className="primary-btn-large" style={{marginTop: '20px', background: '#10b981'}}>
                        Submit Report
                    </button>
                </form>
            </div>

            <h3 className="section-subtitle">Previous Submissions</h3>
            <div className="feedback-list">
                {history.map(item => (
                    <div key={item.feedback_id} className="card feedback-history-item">
                        <div className="stars-small">
                            {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                        </div>
                        <p>{item.comment}</p>
                        <div className="feedback-date">
                            <Clock size={12} /> {new Date(item.submitted_at).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RetrievePatient({ onOpen }) {
    // Reusing the same search logic [cite: 321, 326]
    return (
        <div className="retrieve-container animate-fade-in">
            <div className="search-glass-card">
                <div className="search-header">
                    <div className="search-icon-circle"><UserSearch size={32} /></div>
                    <h2>Retrieve Prescription</h2>
                </div>
                <p>Scan Barcode or enter NIC to pull the latest medical order.</p>
                <div className="search-input-wrapper">
                    <div className="input-with-icon">
                        <Fingerprint className="field-icon" size={20} />
                        <input className="luxury-input" placeholder="NIC or Prescription ID..." />
                    </div>
                    <button className="luxury-search-btn">
                        <Search size={18} />
                        <span>Find Order</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function PharmacyPortal({ patient, user }) {
    return (
        <div className="portal-container">
            <div className="portal-tabs">
                <button className="active">Prescription Fulfillment</button>
            </div>
            <div className="portal-content">
                <div className="card">
                    <h3>Prescription Details for {patient.name}</h3>
                    <p>Fulfillment UI goes here...</p>
                </div>
            </div>
        </div>
    );
}

// --- NOTIFICATIONS COMPONENT ---


// --- FEEDBACK COMPONENT ---


// --- DOCTOR PROFILE (Base for Pharmacist Profile) ---
// Note: You already have PharmacistProfile, so we just need a generic wrapper 
// if you want to reuse the exact same logic.
