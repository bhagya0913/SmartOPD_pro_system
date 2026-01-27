import React, { useState, useEffect } from 'react';
import './PatientDashboard.css';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// At the top of PatientDashboard.jsx
import { 
    Home, 
    User, 
    Users, 
    Calendar, 
    Clock, 
    FileText, 
    Pill, 
    FlaskConical, 
    MessageSquare, 
    Activity, 
    LogOut, 
    Menu, 
    X, 
    ClipboardList, 
    Stethoscope,
    Share2,
    Bell,
    Info,
    Download
} from 'lucide-react';


// Optimized Placeholder Components

// Quick placeholders to prevent crashes if these aren't defined yet




/* --- 1. FAMILY MANAGEMENT --- */

// 2. FAMILY MANAGEMENT
function FamilyRegistration({ primaryUser, onComplete }) {
    const [formData, setFormData] = useState({
        full_name: '',
        dob: '',
        gender: ''
    });
    const [loading, setLoading] = useState(false);

    const handleFamilyReg = async (e) => {
        e.preventDefault();
        setLoading(true);
        const parentEmail = primaryUser?.email || primaryUser?.username;

        const registrationData = {
            name: formData.full_name,
            dob: formData.dob,
            gender: formData.gender,
            nic: `DEP-${Date.now()}`,
            email: parentEmail,
            phone: primaryUser?.phone || '',
            password: 'shared_family_account',
            isFamilyMember: true 
        };

        try {
            const res = await fetch('http://127.0.0.1:5001/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData)
            });
            const data = await res.json();
            if (data.success) {
                setFormData({ full_name: '', dob: '', gender: '' });
                if (onComplete) onComplete();
            }
        } catch (err) { alert("Server error."); }
        finally { setLoading(false); }
    };

    return (
        <div className="registration-card">
            <div className="info-banner">
                <Users size={18} />
                <p>Profiles added here share your login. Switch profiles to book for them.</p>
            </div>
            <h3 className="section-subtitle">Add New Family Member</h3>
            <form onSubmit={handleFamilyReg} className="family-form-grid">
                <div className="input-group full-width">
                    <label>Full Name</label>
                    <input type="text" className="custom-input" placeholder="Enter Full Name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>
                <div className="input-group">
                    <label>Date of Birth</label>
                    <input type="date" className="custom-input" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} required />
                </div>
                <div className="input-group">
                    <label>Gender</label>
                    <select className="custom-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </div>
                <button type="submit" className="submit-btn full-width" disabled={loading}>
                    {loading ? "Registering..." : "Add Family Member"}
                </button>
            </form>
        </div>
    );
}

function FamilySection({ user, setUser }) {
    const [members, setMembers] = useState([]);
    const navigate = useNavigate();

    const fetchMembers = async () => {
        const email = user?.email || user?.username;
        if (!email) return;
        try {
            const res = await fetch(`http://127.0.0.1:5001/api/family-members?email=${email}`);
            const data = await res.json();
            if (data.success) setMembers(data.members);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { fetchMembers(); }, [user?.email]);

    const switchAccount = (m) => {
        const updatedUser = { ...user, patientId: m.patient_id, name: m.full_name, barcode: m.barcode };
        setUser(updatedUser);
        localStorage.setItem('hospital_user', JSON.stringify(updatedUser));
    };

    return (
        <div className="page-content">
            <h2 className="page-title">Family Management</h2>
            <div className="family-grid">
                {members.map((m) => (
                    <div key={m.patient_id} className={`member-card ${m.barcode === user.barcode ? 'active' : ''}`}>
                        <div className="member-header">
                            <div className="member-avatar">{m.full_name.charAt(0)}</div>
                            <div className="member-info">
                                <h4>{m.full_name}</h4>
                                <span className="barcode-tag">{m.barcode}</span>
                            </div>
                        </div>
                        <div className="member-actions">
                            <button className={`action-btn ${m.barcode === user.barcode ? 'disabled' : 'primary'}`} onClick={() => switchAccount(m)} disabled={m.barcode === user.barcode}>
                                {m.barcode === user.barcode ? 'Current' : 'Switch'}
                            </button>
                            <button className="action-btn secondary" onClick={() => { switchAccount(m); navigate('/patient/appointments'); }}>
                                Book
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <FamilyRegistration primaryUser={user} onComplete={fetchMembers} />
        </div>
    );
}
/* --- 2. CORE FUNCTIONAL COMPONENTS --- */

function DashboardHome({ user, myAppointments }) {
    // 1. Get Today's Date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // 2. Filter logic for today's visits
    const activeApp = myAppointments.find(app => 
        app.status === 'booked' && app.appointment_day === today
    );

    const completedApps = myAppointments.filter(app => 
        app.status === 'completed' && app.appointment_day === today
    );

    return (
        <div className="page-content home-grid">
            {/* LEFT COLUMN: IDENTITY & COMPLETED STATUS */}
            <div className="home-main-col">
                
                {/* --- VIRTUAL PATIENT ID CARD --- */}
                <div className="patient-id-card">
                    <div className="id-card-inner">
                        <div className="id-card-header">
                            <div className="hosp-logo">
                                <Activity size={20} color="white" />
                                <span>SmartOPD - Base Hospital, Kiribathgoda</span>
                            </div>
                            <div className="id-chip"></div>
                        </div>
                        
                        <div className="id-card-body">
                            
                            
                            <div className="id-info-area">
                                <h2 className="id-name">{user?.name || "Patient Name"}</h2>
                                <div className="id-details-grid">
                                    <div className="id-field"><label>NIC NUMBER</label> <span>{user?.nic || '---'}</span></div>
                                    <div className="id-field"><label>DATE OF BIRTH</label> <span>{user?.dob || '---'}</span></div>
                                    <div className="id-field"><label>GENDER</label> <span>{user?.gender || '---'}</span></div>
                                    <div className="id-field"><label>PHONE</label> <span>{user?.phone || '---'}</span></div>
                                    <div className="id-field full"><label>RESIDENTIAL ADDRESS</label> <span>{user?.address || '---'}</span></div>
                                    <div className="id-field full"><label>EMAIL ADDRESS</label> <span>{user?.email || '---'}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="id-card-footer">
                            <div className="barcode-container">
                                <div className="barcode-mock-bars">
                                    {[...Array(40)].map((_, i) => (
                                        <div key={i} style={{ 
                                            width: Math.random() > 0.5 ? '1px' : '3px', 
                                            height: '35px', 
                                            background: '#000' 
                                        }}></div>
                                    ))}
                                </div>
                                <span className="barcode-id-text">
                                    {user?.patCode || user?.barcode || 'PENDING ACTIVATION'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RECENT ACTIVITY TRACKER --- */}
                {completedApps.length > 0 && (
                    <div className="completed-mini-status">
                        <div className="check-circle">
                            {/* Make sure 'Check' is imported from lucide-react */}
                            <div style={{ color: 'white', fontWeight: 'bold' }}>✓</div>
                        </div>
                        <div>
                            <p className="status-note">Current Session Status</p>
                            <h4 className="status-token">
                                Visit Completed: Token #{completedApps[0].queue_no} was called.
                            </h4>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: LIVE OPD SLIP */}
            <div className="home-side-col">
                <h3 className="section-subtitle">Today's Appointment</h3>
                {activeApp ? (
                    <div className="opd-slip">
                        <div className="slip-header">
                            <div className="slip-hospital-tag">SmartOPD Digital Slip</div>
                            <div className="slip-token-big">#{activeApp.queue_no}</div>
                            <p>QUEUE POSITION</p>
                        </div>
                        <div className="slip-body">
                            <div className="slip-item">
                                <label>Date</label>
                                <span>{activeApp.appointment_day}</span>
                            </div>
                            <div className="slip-item">
                                <label>Arrival Time</label>
                                <span>{activeApp.time_slot || 'Morning Session'}</span>
                            </div>
                            <div className="slip-item">
                                <label>Visit Category</label>
                                <span>{activeApp.visit_type}</span>
                            </div>
                            
                            <div className="slip-barcode-small">
                                <div className="barcode-mock-bars small">
                                    {[...Array(25)].map((_, i) => (
                                        <div key={i} style={{ width: '2px', height: '20px', background: '#334155' }}></div>
                                    ))}
                                </div>
                                <code>{user?.patCode || user?.barcode}</code>
                            </div>
                        </div>
                        <div className="slip-footer">
                            Please present this to the OPD nursing station.
                        </div>
                    </div>
                ) : (
                    <div className="no-appointment-card">
                        <Calendar size={40} color="#cbd5e1" strokeWidth={1.5} />
                        <p>No scheduled visits for today.</p>
                        <button className="book-now-btn" onClick={() => window.location.href='/patient/appointments'}>
                            Book New Appointment
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// 1. Placeholder for Notifications
function Notifications({ notifications }) {
    const sampleNotifications = [
        { id: 1, type: 'alert', title: 'Appointment Reminder', message: 'Your consultation with Dr. Perera is tomorrow at 9:00 AM.', time: '2 hours ago', urgent: true },
        { id: 2, type: 'lab', title: 'Lab Results Ready', message: 'Your Full Blood Count report has been uploaded.', time: '5 hours ago', urgent: false },
        { id: 3, type: 'info', title: 'Clinic Update', message: 'The Cardiology clinic has moved to Room 12 for this week.', time: '1 day ago', urgent: false }
    ];

    return (
        <div className="page-content">
            <div className="tab-header">
                <h2>Notifications</h2>
                <span className="count-badge">{sampleNotifications.length} New</span>
            </div>
            <div className="notification-feed">
                {sampleNotifications.map(n => (
                    <div key={n.id} className={`notif-card ${n.urgent ? 'urgent' : ''}`}>
                        <div className={`notif-icon ${n.type}`}>
                            {n.type === 'alert' && <Bell size={18} />}
                            {n.type === 'lab' && <FlaskConical size={18} />}
                            {n.type === 'info' && <Info size={18} />}
                        </div>
                        <div className="notif-content">
                            <div className="notif-top">
                                <h4>{n.title}</h4>
                                <span>{n.time}</span>
                            </div>
                            <p>{n.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Referrals({ referrals }) {
    const sampleReferrals = [
        { id: 1, to: 'General Hospital Colombo', department: 'Cardiology', reason: 'Further investigation of Heart Murmur', date: '2026-01-20', status: 'Active', Dr: 'Dr. S. Jayasinghe' }
    ];

    return (
        <div className="page-content">
            <h2 className="page-title">External Referrals</h2>
            <div className="referral-grid">
                {sampleReferrals.map(r => (
                    <div key={r.id} className="referral-doc-card">
                        <div className="doc-header">
                            <FileText size={24} color="#2563eb" />
                            <div>
                                <h3>{r.department} Referral</h3>
                                <span>Ref ID: #REF-{r.id}102</span>
                            </div>
                            <div className="status-tag">{r.status}</div>
                        </div>
                        <div className="doc-body">
                            <div className="doc-row"><label>Refer To:</label> <p>{r.to}</p></div>
                            <div className="doc-row"><label>Clinical Reason:</label> <p>{r.reason}</p></div>
                            <div className="doc-row"><label>Issued By:</label> <p>{r.Dr}</p></div>
                        </div>
                        <button className="download-ref-btn">
                            <Download size={16} /> Download Referral Letter (PDF)
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}


/* --- APPOINTMENTS COMPONENT --- */
function Appointments({ user, fetchHistory, myAppointments }) {
    // 1. Identify who we are booking for
    const [selectedMemberId, setSelectedMemberId] = useState(user.patientId);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [loading, setLoading] = useState(false);

    // This ensures that if the 'user' prop changes (e.g. switching accounts), the state updates
    useEffect(() => {
        setSelectedMemberId(user.patientId);
    }, [user.patientId]);

    // 2. Fetch history for the SPECIFIC member selected
    useEffect(() => {
        if (fetchHistory) fetchHistory(selectedMemberId);
    }, [selectedMemberId, fetchHistory]);

    const timeBlocks = [
        "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", 
        "11:00 - 12:00", "13:00 - 14:00", "14:00 - 15:00", 
        "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00"
    ];

    // Added the handleCancel function
    const handleCancel = async (appointmentId) => {
        if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
        try {
            const res = await fetch(`http://127.0.0.1:5001/api/cancel-appointment/${appointmentId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                alert("Appointment cancelled.");
                if (fetchHistory) fetchHistory(selectedMemberId); 
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Error connecting to server.");
        }
    };

    const handleBook = async (e) => {
        e.preventDefault();
        if (!selectedDate || !selectedSlot) return alert("Please select a date and time slot.");

        setLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:5001/api/book-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: selectedMemberId, 
                    date: selectedDate,
                    timeSlot: selectedSlot
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Confirmed! Token: ${data.tokenNo}`);
                if (fetchHistory) fetchHistory(selectedMemberId); 
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error("Booking Error:", err);
            alert("Connection error. Is the server running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="page-title">Booking Center</h2>
                <div style={{ background: '#eff6ff', padding: '8px 15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontSize: '0.9rem', color: '#1e40af', fontWeight: 'bold' }}>
                        Booking for: {user.name} {user.surname} (Patient ID: {user.patientId})
                    </span>
                </div>
            </div>

            <div className="form-container" style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <h4 style={{ marginBottom: '20px' }}>Schedule New Visit</h4>
                <form onSubmit={handleBook}>
                    <label className="input-label">Select Date</label>
                    <input
                        type="date"
                        className="custom-input"
                        min={new Date().toISOString().split('T')[0]}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ width: '100%', padding: '10px', marginBottom: '15px' }}
                    />

                    <label className="input-label" style={{ display: 'block', marginBottom: '10px' }}>
                        Choose Preferred Time (Max 6 patients per hour)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                        {timeBlocks.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSelectedSlot(s)}
                                style={{
                                    background: selectedSlot === s ? '#2563eb' : '#f8fafc',
                                    color: selectedSlot === s ? '#fff' : '#475569',
                                    border: '1px solid #e2e8f0',
                                    padding: '10px', borderRadius: '8px', cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading}
                        style={{ marginTop: '25px', width: '100%', background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? 'Processing...' : 'Confirm Appointment'}
                    </button>
                </form>
            </div>

            <div className="history-section" style={{ marginTop: '40px' }}>
                <h3>{user.name}'s Appointment Status</h3>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Time</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Token</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myAppointments && myAppointments.length > 0 ? (
                                myAppointments.map((app) => (
                                    <tr key={app.appointment_id} style={{ borderTop: '1px solid #eee' }}>
                                        <td style={{ padding: '12px' }}>{new Date(app.appointment_day).toLocaleDateString('en-GB')}</td>
                                        <td style={{ padding: '12px' }}>{app.time_slot}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>#{app.token_no}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '12px', fontSize: '12px',
                                                background: app.status === 'booked' ? '#dcfce7' : '#fee2e2',
                                                color: app.status === 'booked' ? '#166534' : '#991b1b'
                                            }}>
                                                {app.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {app.status === 'booked' && (
                                                <button
                                                    onClick={() => handleCancel(app.appointment_id)}
                                                    style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No appointments for this family member.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Prescriptions({ prescriptions }) {
    if (!prescriptions || prescriptions.length === 0) {
        return (
            <div className="page-content">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Pill size={48} color="#cbd5e1" />
                    <p style={{ color: '#64748b', marginTop: '10px' }}>No active prescriptions found.</p>
                </div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch(status) {
            case 'fulfilled': return { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' };
            case 'pending': return { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' };
            case 'cancelled': return { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' };
            default: return { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
        }
    };

    return (
        <div className="page-content">
            <div className="section-header" style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                        <Pill color="white" size={20} />
                    </div>
                    <h2 style={{ margin: 0 }}>Medication History</h2>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
                {prescriptions.map((px) => {
                    const style = getStatusColor(px.status);
                    return (
                        <div key={px.prescription_id} className="record-clinical-card" style={{ borderLeft: `4px solid ${style.dot}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'block' }}>
                                        ISSUED ON: {new Date(px.issued_at).toLocaleDateString()}
                                    </span>
                                    <h4 style={{ margin: '5px 0', color: '#1e293b' }}>Rx #{px.prescription_id}</h4>
                                </div>
                                <div style={{ 
                                    background: style.bg, 
                                    color: style.text, 
                                    padding: '4px 12px', 
                                    borderRadius: '20px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.dot }}></span>
                                    {px.status.replace('_', ' ')}
                                </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155', border: '1px solid #e2e8f0' }}>
                                {px.details}
                            </div>

                            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Staff ID: <strong>{px.issued_by}</strong>
                                </span>
                                <button className="file-btn prescription" onClick={() => window.print()}>
                                    Print Rx
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
/* --- INFO ROW COMPONENT --- */
// Updated InfoRow to support Read-Only fields (Barcode/Email)
const InfoRow = ({ label, value, name, type = "text", isSelect = false, options = [], isEditing, formData, setFormData, readOnly = false }) => (
    <div className="info-row" style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: '600', color: '#64748b', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
            {label} {readOnly && <span style={{fontSize: '0.7rem', color: '#cbd5e1'}}>(Locked)</span>}
        </label>
        {isEditing && !readOnly ? (
            isSelect ? (
                <select
                    className="custom-input"
                    value={formData[name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                    <option value="">Select {label}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    className="custom-input"
                    value={formData[name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
            )
        ) : (
            <div style={{ 
                padding: '8px 0', 
                borderBottom: '1px solid #f1f5f9', 
                color: readOnly ? '#94a3b8' : '#1e293b', 
                fontWeight: '500', 
                minHeight: '37px' 
            }}>
                {value || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Not provided</span>}
            </div>
        )}
    </div>
);

function ProfileEdit({ user, setUser }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || user.name || '',
                nic: user.nic || '',
                dob: user.dob || '',
                gender: user.gender || '',
                civil_status: user.civil_status || '',
                blood_group: user.blood_group || '',
                phone: user.phone || '',
                address: user.address || '',
                emergency_contact: user.emergency_contact || '',
                chronic_conditions: user.chronic_conditions || '',
                allergies: user.allergies || ''
            });
        }
    }, [user]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        const idToLink = user.patient_id || user.patientId || user.id;

        try {
            const res = await fetch('http://127.0.0.1:5001/api/update-profile-full', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: idToLink,
                    ...formData
                })
            });

            const data = await res.json();
            if (data.success) {
                // Merge new data into local state
                const updatedUser = { ...user, ...formData, name: formData.full_name };
                setUser(updatedUser);
                localStorage.setItem('hospital_user', JSON.stringify(updatedUser));
                setIsEditing(false);
                alert("Profile synchronized successfully!");
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Error updating profile. Please try again.");
        }
    };

    return (
        <div className="page-content" style={{ maxWidth: '950px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>My Medical Identity</h2>
                <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="submit-btn"
                    style={{ width: 'auto', padding: '10px 25px', background: isEditing ? '#ef4444' : '#2563eb' }}
                >
                    {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
            </div>

            <div className="profile-card" style={{ background: '#fff', padding: '35px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                <form onSubmit={handleUpdate}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px' }}>

                        {/* COLUMN 1: PERSONAL & IDENTITY */}
                        <div>
                            <h4 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>Personal Information</h4>
                            
                            <InfoRow label="Registration Barcode" value={user.barcode} readOnly={true} />
                            <InfoRow label="Email Address" value={user.email} readOnly={true} />
                            
                            <InfoRow label="Full Name" name="full_name" value={user.full_name || user.name} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <InfoRow label="NIC Number" name="nic" value={user.nic} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                                <InfoRow label="Date of Birth" name="dob" type="date" value={user.dob} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <InfoRow label="Gender" name="gender" isSelect options={['Male', 'Female', 'Other']} value={user.gender} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                                <InfoRow label="Civil Status" name="civil_status" isSelect options={['Single', 'Married', 'Divorced', 'Widowed']} value={user.civil_status} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            </div>
                        </div>

                        {/* COLUMN 2: CONTACT & MEDICAL */}
                        <div>
                            <h4 style={{ color: '#059669', borderBottom: '2px solid #ecfdf5', paddingBottom: '10px', marginBottom: '20px' }}>Contact & Medical Details</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <InfoRow label="Phone Number" name="phone" value={user.phone} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                                <InfoRow label="Emergency Contact" name="emergency_contact" value={user.emergency_contact} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            </div>

                            <InfoRow label="Residential Address" name="address" value={user.address} isEditing={isEditing} formData={formData} setFormData={setFormData} />

                            <InfoRow
                                label="Blood Group"
                                name="blood_group"
                                value={user.blood_group}
                                isSelect={true}
                                options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']}
                                isEditing={isEditing} formData={formData} setFormData={setFormData}
                            />

                            <label style={{ fontWeight: '600', color: '#64748b', fontSize: '0.85rem' }}>Chronic Conditions</label>
                            {isEditing ? (
                                <textarea
                                    className="custom-input"
                                    style={{ width: '100%', height: '70px', marginTop: '5px', marginBottom: '15px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    value={formData.chronic_conditions || ''}
                                    onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
                                />
                            ) : (
                                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', marginTop: '5px', marginBottom: '15px', fontSize: '0.9rem' }}>
                                    {user.chronic_conditions || "None"}
                                </div>
                            )}

                            <label style={{ fontWeight: '600', color: '#64748b', fontSize: '0.85rem' }}>Allergies</label>
                            {isEditing ? (
                                <textarea
                                    className="custom-input"
                                    style={{ width: '100%', height: '70px', marginTop: '5px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    value={formData.allergies || ''}
                                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                                />
                            ) : (
                                <div style={{ padding: '10px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', marginTop: '5px', color: '#dc2626', fontSize: '0.9rem' }}>
                                    {user.allergies || "No known allergies"}
                                </div>
                            )}
                        </div>
                    </div>

                    {isEditing && (
                        <button type="submit" className="save-btn" style={{
                            marginTop: '40px', width: '100%', padding: '15px',
                            background: '#2563eb', color: 'white', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}>
                            Save & Update Medical Record
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}


/* --- 1. SUB-COMPONENT: FEEDBACK --- */
// Move this OUTSIDE and ABOVE the PatientDashboard function
function Feedback({ user }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [history, setHistory] = useState([]);

    const userId = user?.patientId || user?.id;
    const fetchFeedback = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`http://127.0.0.1:5001/api/feedback/${user.id}`);
            const data = await res.json();
            if (data.success) setHistory(data.data);
        } catch (err) { console.error("History fetch error", err); }
    };

    useEffect(() => {
        if (user?.id) { // Added safety check
            fetchFeedback();
        }
    }, [user?.id]); // Depend on specific ID

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('http://127.0.0.1:5001/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: user.id, rating, comment })
        });
        const data = await res.json();
        if (data.success) {
            alert("Feedback submitted!");
            setComment('');
            fetchFeedback();
        }
    };

    return (
        <div className="page-content">
            <h2 className="page-title">Share Your Experience</h2>
            <div className="form-container" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Rating</label>
                        {[1, 2, 3, 4, 5].map(num => (
                            <span key={num} onClick={() => setRating(num)} style={{ fontSize: '25px', cursor: 'pointer', color: num <= rating ? '#fbbf24' : '#d1d5db' }}>★</span>
                        ))}
                    </div>
                    <textarea
                        className="custom-input"
                        style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="How was your visit today?"
                        required
                    />
                    <button type="submit" className="submit-btn" style={{ marginTop: '15px', width: '100%', background: '#2563eb', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Submit Feedback</button>
                </form>
            </div>
            <h3 style={{ marginTop: '30px' }}>Your Past Feedback</h3>
            <div>
                {history.map(item => (
                    <div key={item.feedback_id} style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ color: '#fbbf24' }}>{'★'.repeat(item.rating)}</div>
                        <p style={{ margin: '5px 0' }}>{item.comment}</p>
                        <small>{new Date(item.submitted_at).toLocaleDateString()}</small>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LabResults({ reports }) {
    if (!reports || reports.length === 0) {
        return (
            <div className="page-content">
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FlaskConical size={48} color="#cbd5e1" style={{ marginBottom: '15px' }} />
                    <h3 style={{ color: '#475569' }}>No Lab Reports</h3>
                    <p style={{ color: '#64748b' }}>Diagnostic requests will appear here once ordered by your doctor.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="section-header" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#7c3aed', padding: '8px', borderRadius: '10px' }}>
                        <FlaskConical color="white" size={20} />
                    </div>
                    <h2 style={{ margin: 0, color: '#1e293b' }}>Laboratory & Diagnostics</h2>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
                {reports.map((report) => (
                    <div key={report.lab_id} className="record-clinical-card" style={{ borderLeft: report.status === 'completed' ? '4px solid #7c3aed' : '4px solid #f59e0b' }}>
                        <div className="card-top-flex">
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{report.test_name}</h3>
                                <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                                    <span className="staff-stamp"><Calendar size={12} /> {new Date(report.requested_at).toLocaleDateString()}</span>
                                    <span className="staff-stamp"><Clock size={12} /> {new Date(report.requested_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                            <div className={`status-pill ${report.status}`}>
                                {report.status === 'completed' ? 'Results Ready' : 'Processing...'}
                            </div>
                        </div>

                        <div className="clinical-grid" style={{ marginTop: '15px' }}>
                            <div className="clinical-box">
                                <label>Requested By</label>
                                <p><strong>{report.staff_name}</strong> (ID: {report.staff_id})</p>
                            </div>
                            <div className="clinical-box">
                                <label>Clinical Indication</label>
                                <p>{report.indication || 'Routine Checkup'}</p>
                            </div>
                        </div>

                        {report.status === 'completed' && (
                            <div className="file-action-row" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FileText size={18} color="#7c3aed" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#5b21b6' }}>
                                        {report.test_name}_Report.pdf
                                    </span>
                                </div>
                                <button className="file-btn lab" style={{ background: '#7c3aed', color: 'white' }} onClick={() => window.open('#', '_blank')}>
                                    Download Report
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
function MedicalRecords({ records }) {
    if (!records || records.length === 0) {
        return (
            <div className="page-content">
                <div className="empty-state-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <FileText size={48} color="#cbd5e1" style={{ marginBottom: '15px' }} />
                    <h3 style={{ color: '#475569' }}>No Medical History</h3>
                    <p style={{ color: '#64748b' }}>Your clinical history will appear here after your visit.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="section-header" style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                        <ClipboardList color="white" size={20} />
                    </div>
                    <h2 style={{ margin: 0, color: '#1e293b' }}>Clinical Treatment Records</h2>
                </div>
            </div>

            <div className="medical-timeline">
                {records.map((record) => (
                    <div key={record.record_id} className="timeline-item">
                        {/* 1. Date & Time Column */}
                        <div className="timeline-date-column">
                            <span className="date-day">
                                {new Date(record.consultation_day).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="date-time">
                                {new Date(record.consultation_day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="date-year">{new Date(record.consultation_day).getFullYear()}</span>
                        </div>

                        {/* 2. Content Card */}
                        <div className="record-clinical-card">
                            <div className="card-top-flex">
                                <div className="diagnosis-pill">
                                    <Stethoscope size={14} />
                                    <span>{record.diagnosis}</span>
                                </div>
                                <div className="staff-stamp">
                                    <User size={12} />
                                    <span>Created By: <strong>{record.created_by_name}</strong> (ID: {record.staff_id})</span>
                                </div>
                            </div>

                            <div className="clinical-grid">
                                <div className="clinical-box">
                                    <label>Chief Complaint</label>
                                    <p>{record.chief_complaint}</p>
                                </div>
                                <div className="clinical-box">
                                    <label>Clinical Findings</label>
                                    <p>{record.clinical_findings}</p>
                                </div>
                                <div className="clinical-box full-width">
                                    <label>Treatment Details</label>
                                    <p>{record.treatment_details}</p>
                                </div>
                            </div>

                            {/* 3. Action Buttons (Files/Docs) */}
                            <div className="file-action-row">
                                {record.prescription_details && (
                                    <button className="file-btn prescription" onClick={() => alert('Opening Prescription PDF...')}>
                                        <Pill size={14} /> View Prescription
                                    </button>
                                )}
                                {record.lab_result_id && (
                                    <button className="file-btn lab" onClick={() => alert('Opening Lab Report...')}>
                                        <FlaskConical size={14} /> Lab Results
                                    </button>
                                )}
                                {record.referral_note && (
                                    <button className="file-btn referral" onClick={() => alert('Opening Referral...')}>
                                        <FileText size={14} /> Referral Note
                                    </button>
                                )}
                            </div>

                            {/* 4. Footer: Vitals & Follow-up */}
                            <div className="card-footer-vitals">
                                <div className="vital-item">
                                    <Calendar size={14} color="#2563eb" />
                                    <span>Follow-up: <strong>{record.follow_up_date || 'N/A'}</strong></span>
                                </div>
                                <div className="vital-item">
                                    <Activity size={14} color="#94a3b8" />
                                    <span>Wt: {record.weight_kg}kg | Ht: {record.height_cm}cm</span>
                                </div>
                                <div className="record-id-stamp">#{record.record_id}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
/* --- 4. MAIN DASHBOARD --- */

export default function PatientDashboard({ user, setUser }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [myAppointments, setMyAppointments] = useState([]);
    const [medicalHistory, setMedicalHistory] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [labReports, setLabReports] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [referrals, setReferrals] = useState([]);

    const menuItems = [
        { icon: Home, label: 'HOME', path: '/patient' },
        { icon: Calendar, label: 'APPOINTMENTS', path: '/patient/appointments' },
       
        { icon: FileText, label: 'MEDICAL HISTORY', path: '/patient/medical-records' },
        { icon: Pill, label: 'PRESCRIPTIONS', path: '/patient/prescriptions' },
        { icon: FlaskConical, label: 'DIAGNOSTIC TESTS', path: '/patient/lab-results' },
        { icon: Share2, label: 'REFERRALS', path: '/patient/referrals' },
        { icon: User, label: 'MY PROFILE', path: '/patient/profile' },
        { icon: Users, label: 'OTHER ACCOUNTS', path: '/patient/family' },
        { icon: Bell, label: 'NOTIFICATIONS', path: '/patient/notifications' },
        { icon: MessageSquare, label: 'FEEDBACK', path: '/patient/feedback' }
    ];

    const getMenuItems = (role) => {
    switch(role) {
        case 'doctor':
            return [
                { path: '/doctor', label: 'Dashboard', icon: Activity },
                { path: '/doctor/appointments', label: 'My Patients', icon: Users },
                { path: '/doctor/prescriptions', label: 'Issue Scripts', icon: Pill },
            ];
        case 'pharmacist':
            return [
                { path: '/pharmacist', label: 'Inventory', icon: Box },
                { path: '/pharmacist/orders', label: 'Pending Orders', icon: ClipboardList },
            ];
        case 'admin':
            return [
                { path: '/admin/users', label: 'Staff Management', icon: Users },
                { path: '/admin/reports', label: 'System Analytics', icon: BarChart },
            ];
        default: // Patient
            return [
                { path: '/patient', label: 'Home', icon: Home },
                { path: '/patient/medical-records', label: 'My Records', icon: FileText },
                { path: '/patient/notifications', label: 'Alerts', icon: Bell },
            ];
    }
};
    useEffect(() => {
        // 1. Fallback for session persistence
        if (!user) {
            const savedUser = localStorage.getItem('hospital_user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            } else {
                navigate('/login');
            }
        }

        // 2. MOCK DATA: Representing the 'appointments' table
        const todayStr = new Date().toISOString().split('T')[0];

        setMyAppointments([
            {
                appointment_id: 101,
                appointment_day: todayStr,
                time_slot: "09:00 AM - 10:00 AM",
                queue_no: 12,
                visit_type: "New",
                status: "booked"
            },
            {
                appointment_id: 99,
                appointment_day: todayStr,
                queue_no: 5,
                visit_type: "Report Review",
                status: "completed"
                }
        ]);
        setMedicalHistory([
            {
                record_id: 501,
                consultation_day: "2024-01-15T09:30:00",
                diagnosis: "Acute Pharyngitis",
                chief_complaint: "Severe sore throat and fever.",
                clinical_findings: "Inflamed tonsils, Temp 101F.",
                treatment_details: "Gargle with salt water, plenty of fluids.",
                prescription_details: "Amoxicillin 500mg, Paracetamol 500mg",
                weight_kg: 70.5,
                height_cm: 175,
                follow_up_date: "2024-01-22"
            },
        
        {
            record_id: "REC-2024-001",
            consultation_day: "2024-01-25T10:30:00",
            diagnosis: "Upper Respiratory Infection",
            chief_complaint: "Persistent cough for 3 days, mild headache.",
            clinical_findings: "Throat congestion, clear lungs, SpO2 98%.",
            treatment_details: "Rest, hydration, and nebulization if needed.",
            prescription_details: "Amoxicillin 500mg, Cetirizine 10mg",
            lab_result_id: "LAB-992", // This triggers the Lab button
            referral_note: "Refer to ENT if cough persists", // This triggers the Referral button
            weight_kg: 68,
            height_cm: 172,
            follow_up_date: "2024-02-01",
            created_by_name: "Dr. Sarah Smith",
            staff_id: "DOC-441"
        }
    ]);
    setLabReports([
        {
            lab_id: "LAB-1002",
            test_name: "Full Blood Count (FBC)",
            requested_at: "2024-01-26T11:00:00",
            status: "completed",
            staff_name: "Dr. Sarah Smith",
            staff_id: "DOC-441",
            indication: "Patient reports chronic fatigue and paleness.",
            file_url: "/reports/fbc_1002.pdf"
        },
        {
            lab_id: "LAB-1005",
            test_name: "Lipid Profile & Glucose",
            requested_at: "2024-01-27T08:30:00",
            status: "pending",
            staff_name: "Dr. Robert Wilson",
            staff_id: "DOC-202",
            indication: "Annual screening."
        }
    ]);

    setPrescriptions([
        {
            prescription_id: 8001,
            appointment_id: 101,
            patient_id: 1,
            details: "1. Tab. Amoxicillin 500mg - 1-0-1 (5 Days)\n2. Syr. Benadryl 10ml - 0-0-1 (Night)",
            status: "pending",
            issued_by: "DOC-441",
            issued_at: "2024-01-27T09:00:00"
        },
        {
            prescription_id: 7950,
            appointment_id: 99,
            patient_id: 1,
            details: "1. Tab. Paracetamol 500mg - SOS\n2. Multivitamin Capsules - 0-1-0 (30 Days)",
            status: "fulfilled",
            issued_by: "DOC-202",
            issued_at: "2024-01-15T14:30:00"
        }
    ]);
    }, [user, setUser, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('hospital_user');
        setUser(null);
        navigate('/login');
    };

    return (
        <div className="dashboard-container" style={{
            backgroundImage: `url(./patientbg.jpg)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
            width: '100vw',
            minHeight: '100vh'
        }}>
            {/* TOP NAVIGATION */}
            <nav className="top-nav">
                <div className="nav-left">
                    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    {/* Synchronized Logo Styling */}
                    <div className="nav-logo-group">
                        <div className="brand-icon-box small">
                            <Activity size={18} color="white" />
                        </div>
                        <span className="logo-text">SmartOPD</span>
                    </div>
                </div>

                <div className="nav-right">
                    <div className="user-profile-badge">
                        <div className="user-details">
                            {/* Uses .name which contains full_name from our SQL fix */}
                            <span className="user-display-name">{user?.name || "Patient"}</span>
                            <span className="user-id-subtext">{user?.patCode || user?.barcode}</span>
                        </div>
                        <div className="user-avatar">
                            {user?.name?.charAt(0) || "P"}
                        </div>
                    </div>
                    <button className="icon-logout-btn" onClick={handleLogout} title="Logout">
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <div className="dashboard-body">
                {/* SIDEBAR */}
                <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                    <div className="sidebar-scroll">
                        {menuItems.map((item) => (
                            <button 
                                key={item.path}
                                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                            >
                                <item.icon size={20} className="nav-icon" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="main-content">
                    <Routes>
                        <Route index element={<DashboardHome user={user} myAppointments={myAppointments} />} />
                        <Route path="family" element={<FamilySection user={user} setUser={setUser} />} />
                        <Route path="profile" element={<ProfileEdit user={user} setUser={setUser} />} />
                        <Route path="appointments" element={<Appointments user={user} myAppointments={myAppointments} />} />
                        <Route path="notifications" element={<Notifications notifications={notifications} />} />
                        <Route path="referrals" element={<Referrals referrals={referrals} />} />
                        <Route path="medical-records" element={<MedicalRecords records={medicalHistory} />} />
                        <Route path="prescriptions" element={<Prescriptions prescriptions={prescriptions} />} />
                        <Route path="lab-results" element={<LabResults reports={labReports} />} />
                        <Route path="feedback" element={<Feedback user={user} />} />

                      
                    </Routes>
                </main>
            </div>
        </div>
    );
}