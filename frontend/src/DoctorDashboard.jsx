import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css';
import { useNavigate, Routes, Route, Link, useLocation, NavLink } from 'react-router-dom';
import { 
    ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut, 
    ArrowLeft, Search, CreditCard, Users, Clock, UserSearch, 
    Fingerprint, Activity, ClipboardList, Beaker, Plus, Save, 
    FileText, Send, FlaskConical, Info, Star, AlertTriangle 
} from 'lucide-react';

export default function DoctorDashboard({ user, setUser }) {
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

    console.log("Current Active Tab:", activeTab);
    console.log("User Data:", user);
    return (
        <div className="doctor-layout"> 
            {/* 1. SIDEBAR */}
            <aside className="sidebar">
                <div className="sidebar-logo" style={{ color: 'white', marginBottom: '2rem', fontWeight: 800, fontSize: '1.5rem' }}>
                    SmartOPD
                </div>
                
                <div className="sidebar-scroll">
                    <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <Home size={20} className="nav-icon" /> 
                        <span>HOME</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'retrieve' ? 'active' : ''}`} onClick={() => setActiveTab('retrieve')}>
                        <ScanBarcode size={20} className="nav-icon" /> 
                        <span>RETRIEVE PATIENT</span>
                    </button>

                    <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        <User size={20} className="nav-icon" /> 
                        <span>MY PROFILE</span>
                    </button>

                    

                    <button 
                        className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('notifications')}
                    >
                        <Bell size={20} />
                        <span>NOTIFICATIONS</span>
                    </button>

                    <button 
                        className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('feedback')}
                    >
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

            {/* 2. MAIN CONTENT */}
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
                    {/* 1. Force Home to show if activeTab is 'home' OR if it's somehow undefined */}
    {(activeTab === 'home' || !activeTab) && (
        <DoctorHome onOpen={openPatientSession} user={user} />
    )}
    
    {activeTab === 'profile' && (
    <DoctorProfile user={user} setUser={setUser} />
    )}

    {activeTab === 'retrieve' && (
        <RetrievePatient onOpen={openPatientSession} />
    )}

    {/* ... other blocks ... */}

    {activeTab === 'notifications' && (
        <DoctorNotifications />
    )}

    {activeTab === 'feedback' && (
        <DoctorFeedback user={user} />
    )}

    {/* 2. Patient Portals */}
    {openPatients.map(p => (
        <div key={p.id} style={{ display: activeTab === p.id ? 'block' : 'none' }}>
            <PatientPortal patient={p} user={user} />
        </div>
    ))}
                </div>
            </main>
        </div>
    );
}

/* --- SUB-COMPONENTS (Defined outside the main class to avoid 'Unexpected Token' errors) --- */

// --- DOCTOR FEEDBACK TAB ---
function DoctorFeedback({ user }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [history, setHistory] = useState([
        { feedback_id: 1, rating: 5, comment: "System is very responsive today. Patient flow is smooth.", submitted_at: new Date().toISOString() },
        { feedback_id: 2, rating: 4, comment: "Need more specific options in the Lab Request dropdown.", submitted_at: new Date(Date.now() - 86400000).toISOString() }
    ]);

    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Thank you, Doctor. Your feedback helps improve the platform.");
        setComment('');
    };

    return (
        <div className="portal-container animate-fade-in">
            <div className="section-header-glass">
                <MessageSquare size={24} />
                <h2>Platform Feedback</h2>
                <p></p>
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
                        placeholder="What would make your workflow faster?"
                        required
                    />
                    <button type="submit" className="primary-btn-large" style={{marginTop: '20px'}}>
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

// --- DOCTOR NOTIFICATIONS TAB ---
function DoctorNotifications() {
    const sampleNotifications = [
        { id: 1, type: 'urgent', title: 'Critical Lab Result', message: 'Patient P-1004 (John Doe) shows critical Hemoglobin levels.', time: '10 mins ago' },
        { id: 2, type: 'info', title: 'New Referral', message: 'Dr. Wickramasinghe referred a new Cardiology patient to you.', time: '1 hour ago' },
        { id: 3, type: 'system', title: 'System Maintenance', message: 'The portal will be offline for 15 minutes at midnight.', time: '5 hours ago' }
    ];

    return (
        <div className="portal-container animate-fade-in">
            <div className="tab-header-flex">
                <div className="section-header-glass">
                    <h2>Clinical Alerts</h2>
                    <p>Stay updated on patient results and system updates.</p>
                </div>
                <span className="badge-pulse">{sampleNotifications.length} New</span>
            </div>

            <div className="notification-feed-glass">
                {sampleNotifications.map(n => (
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

function DoctorProfile({ user, setUser }) {
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
            <div className="profile-id-banner">
                <div className="profile-avatar-circle">
                    {formData.full_name.charAt(0)}
                </div>
                <div className="profile-main-meta">
                    <h2>{formData.full_name}</h2>
                    <span className="staff-badge">Staff ID: STAFF-{user?.staff_id || '001'}</span>
                </div>
                <div className="profile-actions">
                    <button 
                        className={isEditing ? "save-btn" : "edit-btn"} 
                        onClick={() => isEditing ? console.log("Save Logic") : setIsEditing(true)}
                    >
                        {isEditing ? 'Commit Changes' : 'Edit Profile'}
                    </button>
                </div>
            </div>

            <div className="profile-grid-container">
                {/* Account Settings (Immutable) */}
                <div className="card glass-card">
                    <h3 className="sub-title">Account Security</h3>
                    <div className="input-group">
                        <label>Login Email</label>
                        <div className="locked-field">
                            <span>{formData.email}</span>
                            <small>Primary ID (Cannot be changed)</small>
                        </div>
                    </div>
                    <div className="input-group mt-20">
                        <label>Current Role</label>
                        <div className="role-chip">{user?.role_name || 'Medical Officer'}</div>
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

function DoctorHome({ onOpen, user }) {
    const todayQueue = [
        { id: 'P-9921', name: 'Kamal Perera', time: '09:00 AM', status: 'Waiting', age: 45, reason: 'Follow-up (Hypertension)' },
        { id: 'P-8822', name: 'Sunil Shantha', time: '09:30 AM', status: 'In Progress', age: 29, reason: 'Seasonal Flu' },
        { id: 'P-7731', name: 'Nimali Silva', time: '10:15 AM', status: 'Waiting', age: 52, reason: 'Lab Result Review' },
        { id: 'P-6642', name: 'Arjun Perera', time: '11:00 AM', status: 'Scheduled', age: 38, reason: 'Annual Checkup' },
    ];

    const alerts = [
        { id: 1, type: 'urgent', text: 'Critical Lab Result: Patient P-4421', sub: 'Potassium 6.2 mmol/L' },
        { id: 2, type: 'info', text: 'Departmental Meeting', sub: '02:00 PM - Board Room B' }
    ];

    return (
        <div className="doctor-home-container animate-fade-in">
            {/* 1. TOP HERO SECTION */}
            <div className="hero-section">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>Welcome, Dr. {user?.surname || 'Wickramasinghe'}</h1>
                        
                    </div>
                    <div className="hero-badge">
                        <div className="pulse-icon"></div>
                        <span>On Duty</span>
                    </div>
                </div>
            </div>

            {/* 2. ANALYTICS CARDS */}
            <div className="stats-grid">
                <div className="glass-stat blue">
                    <div className="stat-icon"><Users size={20} /></div>
                    <div className="stat-info">
                        <h3>14</h3>
                        <p>Total Today</p>
                    </div>
                </div>
                <div className="glass-stat green">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-info">
                        <h3>08</h3>
                        <p>Completed</p>
                    </div>
                </div>
                <div className="glass-stat orange">
                    <div className="stat-icon"><Bell size={20} /></div>
                    <div className="stat-info">
                        <h3>06</h3>
                        <p>Waiting</p>
                    </div>
                </div>
            </div>

            {/* 3. MAIN DASHBOARD AREA */}
            <div className="dashboard-main-grid">
                
                {/* LEFT: ENHANCED QUEUE */}
                <div className="card queue-card">
                    
                    
                    <div className="queue-list"> <p><b>Live Patient Queue</b>   </p>
                        {todayQueue.map(p => (
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



function RetrievePatient({ onOpen }) {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = () => {
    if (!searchTerm.trim()) return alert("Please enter an ID");

    // SIMULATED UI TEST: Instead of fetching, we just "find" a fake patient
    console.log("Mocking search for:", searchTerm);
    
    const mockPatient = {
        id: searchTerm === "123" ? "P-1001" : "P-9999",
        name: "Test Patient Name",
        age: 28,
        blood: "O+"
    };

    // This triggers your tab opening logic immediately
    onOpen(mockPatient);
 };

    return (
        <div className="retrieve-container animate-fade-in">
            <div className="search-glass-card">
                <div className="search-header">
                    <div className="search-icon-circle">
                        <UserSearch size={32} />
                    </div>
                    <h2>Access Patient Records</h2>
                    
                </div>
                <p>Enter National ID (NIC) or Barcode ID to pull clinical history.</p>
                <br/>

                <div className="search-input-wrapper">
                    <div className="input-with-icon">
                        <Fingerprint className="field-icon" size={20} />
                        <input 
                            className="luxury-input" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            placeholder="Example: 199512345678 or PAT-1002" 
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <button className="luxury-search-btn" onClick={handleSearch}>
                        <Search size={18} />
                        <span>Search Patient</span>
                    </button>
                </div>

                <div className="search-footer-info">
                    <small>Accessing this data is logged under Staff ID: <strong>Active Session</strong></small>
                </div>
            </div>
        </div>
    );
}

// --- 1. THE MAIN PORTAL ---
function PatientPortal({ patient, user }) {
    const [activeSubTab, setActiveSubTab] = useState('history');

    return (
        <div className="portal-container">
            {/* ... Existing Banner Code ... */}
            <div className="portal-tabs">
                <button className={activeSubTab === 'history' ? 'active' : ''} onClick={() => setActiveSubTab('history')}>Medical History</button>
                <button className={activeSubTab === 'diagnosis' ? 'active' : ''} onClick={() => setActiveSubTab('diagnosis')}>Consultation</button>
                <button className={activeSubTab === 'lab' ? 'active' : ''} onClick={() => setActiveSubTab('lab')}>Lab Requests</button>
                {/* NEW TAB */}
                <button className={activeSubTab === 'referral' ? 'active' : ''} onClick={() => setActiveSubTab('referral')}>Referral</button>
            </div>

            <div className="portal-content">
                {activeSubTab === 'history' && <MedicalHistory patientId={patient.id} />}
                {activeSubTab === 'diagnosis' && <CreateConsultation patient={patient} user={user} onBack={() => setActiveSubTab('history')} />}
                {activeSubTab === 'lab' && <LabRequestForm patient={patient} user={user} onBack={() => setActiveSubTab('history')} />}
                {/* NEW COMPONENT CALL */}
                {activeSubTab === 'referral' && <ReferralForm patient={patient} user={user} onBack={() => setActiveSubTab('history')} />}
            </div>
        </div>
    );
}
// --- 2. CONSULTATION FORM ---
function CreateConsultation({ patient, user, onBack }) {
    const [findings, setFindings] = useState('');
    const [medsList, setMedsList] = useState([{ nameAndDose: '', note: '' }]);

    const addMedicine = () => setMedsList([...medsList, { nameAndDose: '', note: '' }]);
    const updateMedicine = (index, field, value) => {
        const newList = [...medsList];
        newList[index][field] = value;
        setMedsList(newList);
    };

    const handleSaveSession = async () => {
    // COMMENT OUT the fetch logic for now
    /* const response = await fetch('http://127.0.0.1:5001/api/doctor/save-consultation', ...);
    */
    
    // Use simulated success
    console.log("Mock Saving:", { findings, medsList });
    alert("UI TEST: Consultation Saved Successfully!");
    onBack(); // Returns to history tab [cite: 33]
 };
    return (
        <div className="consultation-container">
            <div className="card">
                <h3>Clinical Findings</h3>
                <textarea className="figma-textarea" value={findings} onChange={e => setFindings(e.target.value)} placeholder="Enter symptoms and observations..." />
            </div>
            <div className="card">
                <div className="section-header" style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                    <h3>Prescriptions</h3>
                    <button className="add-btn" onClick={addMedicine}>+ Add Medicine</button>
                </div>
                {medsList.map((med, i) => (
                    <div key={i} className="med-row">
                        <input className="med-input" placeholder="Medicine & Dosage" value={med.nameAndDose} onChange={e => updateMedicine(i, 'nameAndDose', e.target.value)} />
                        <input className="med-input" placeholder="Special Note" value={med.note} onChange={e => updateMedicine(i, 'note', e.target.value)} />
                    </div>
                ))}
            </div>
            <button className="primary-btn-large" onClick={handleSaveSession}>Complete Session</button>
        </div>
    );
}

// --- 3. REFERRAL FORM ---
function ReferralForm({ patient, user, onBack }) {
    
     const handleReferral = () => {
    // Simulate the database response
    console.log("Mock Referral Issued");
    alert("UI TEST: Referral Issued Successfully!");
    onBack();
 };

    return (
        <div className="referral-container">
            <div className="card referral-document-glass">
                <div className="doc-header-line">
                    <h3>Clinical Referral Note</h3>
                </div>
                <div className="referral-grid">
                    <div className="input-group">
                        <label>Target Specialist</label>
                        <select className="styled-select">
                            <option>Cardiology</option>
                            <option>Neurology</option>
                            <option>Orthopedics</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Priority</label>
                        <select className="styled-select">
                            <option>Normal</option>
                            <option>Urgent</option>
                        </select>
                    </div>
                </div>
                <div className="input-group" style={{marginTop:'20px'}}>
                    <label>Reason for Referral</label>
                    <textarea className="figma-textarea" placeholder="Clinical justification..."></textarea>
                </div>
                <div className="referral-footer">
                    <p>Doctor: Dr. {user?.surname || 'User'}</p>
                    <button className="luxury-search-btn" onClick={handleReferral}>Issue Referral</button>
                </div>
            </div>
        </div>
    );
}

function MedicalHistory({ patientId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const sampleHistory = [{
        record_id: 'S-101',
        consultation_day: new Date().toISOString(),
        consultation_time: '10:30 AM',
        treatment_details: 'Patient presented with severe seasonal allergies.',
        prescription_details: 'Cetirizine 10mg',
        doctor_name: 'Wickramasinghe'
    }];

    useEffect(() => {
        fetch(`http://127.0.0.1:5001/api/doctor/patient-history/${patientId}`)
            .then(res => res.json())
            .then(data => {
                setHistory(data && data.length > 0 ? data : sampleHistory);
                setLoading(false);
            })
            .catch(() => {
                setHistory(sampleHistory);
                setLoading(false);
            });
    }, [patientId]);

    if (loading) return <div className="card animate-pulse">Loading History...</div>;

    return (
        <div className="card medical-history-container">
            <div className="section-header">
                <h3 className="section-title">Complete Medical History</h3>
            </div>
            <table className="admin-table modern-table">
                <thead>
                    <tr>
                        <th>Timeline</th>
                        <th>Clinical Findings</th>
                        <th>Prescriptions</th>
                        <th>Doctor</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((record, index) => (
                        <tr key={index} className="history-row">
                            <td>{new Date(record.consultation_day).toLocaleDateString()}</td>
                            <td>{record.treatment_details}</td>
                            <td><div className="prescription-chip">{record.prescription_details}</div></td>
                            <td>Dr. {record.doctor_name}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}



function LabRequestForm({ patient, user, onBack }) {
    const [selectedTests, setSelectedTests] = useState([]);
    const commonTests = ["FBC", "Lipid Profile", "FBS", "Urine Report"];

    const handleSubmitLab = async () => {
        const payload = {
            patientId: patient.id,
            doctorId: user?.staff_id || user?.id,
            testName: selectedTests.join(', '),
            priority: 'Normal'
        };
        const res = await fetch('http://127.0.0.1:5001/api/doctor/request-lab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) { alert("Lab Request Sent!"); onBack(); }
    };

    return (
        <div className="card">
            <h3>Lab Investigation</h3>
            {commonTests.map(test => (
                <label key={test} style={{ display: 'block', margin: '5px 0' }}>
                    <input type="checkbox" onChange={(e) => {
                        if (e.target.checked) setSelectedTests([...selectedTests, test]);
                        else setSelectedTests(selectedTests.filter(t => t !== test));
                    }} /> {test}
                </label>
            ))}
            <button className="primary-btn-large" onClick={handleSubmitLab}>Submit Request</button>
        </div>
    );
}

