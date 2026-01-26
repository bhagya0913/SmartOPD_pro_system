import React, { useState, useEffect } from 'react';
import './PatientDashboard.css';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
    Calendar, Clock, FileText, Pill, FlaskConical, Bell,
    MessageSquare, LogOut, Menu, X, Home, Users, User
} from 'lucide-react';

// Add these at the top of your file
const MedicalRecords = () => <div className="page-content"><h2>Medical Records</h2><p>Coming Soon...</p></div>;
const Prescriptions = () => <div className="page-content"><h2>Prescriptions</h2><p>Coming Soon...</p></div>;
const LabResults = () => <div className="page-content"><h2>Lab Results</h2><p>Coming Soon...</p></div>;
const Notifications = () => <div className="page-content"><h2>Notifications</h2><p>Coming Soon...</p></div>;

/* --- 1. FAMILY MANAGEMENT --- */

/* --- 1. FAMILY MANAGEMENT --- */

/* --- 1. FAMILY MANAGEMENT (Inside PatientDashboard.jsx) --- */

function FamilyRegistration({ primaryUser, onComplete }) {
    const [formData, setFormData] = useState({
        first_name: '',
        surname: primaryUser?.surname || '',
        dob: '',
        gender: ''
    });
    const [loading, setLoading] = useState(false);

    const handleFamilyReg = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Crucial: Use username as email if .email is missing
        const parentEmail = primaryUser?.email || primaryUser?.username || localStorage.getItem('user_email');

        const registrationData = {
            first_name: formData.first_name,
            surname: formData.surname,
            dob: formData.dob,
            gender: formData.gender,
            nic: `DEP-${Date.now()}`,
            email: parentEmail,
            phone: primaryUser?.phone || '',
            password: 'shared_family_account',
            isFamilyMember: true // <--- THIS IS THE KEY FLAG
        };

        if (!parentEmail) {
            alert("Session error: Parent email not found. Please re-login.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('http://127.0.0.1:5001/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData)
            });

            const data = await res.json();
            if (data.success) {
                alert(`Success! Profile created for ${formData.first_name}`);
                setFormData({ first_name: '', surname: primaryUser?.surname || '', dob: '', gender: '' });
                if (onComplete) onComplete();
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            alert("Server connection failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container" style={{ background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '20px' }}>
            <div style={{ background: '#eff6ff', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #2563eb', marginBottom: '20px' }}>
                <h5 style={{ margin: '0 0 5px 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} /> Family Account Guidelines
                </h5>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e3a8a' }}>
                    Profiles added here share your login details. Switch profiles to book for them.
                </p>
            </div>

            <h4 style={{ marginBottom: '15px' }}>Add New Family Member</h4>
            <form onSubmit={handleFamilyReg} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <input type="text" placeholder="First Name" className="custom-input" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
                <input type="text" placeholder="Surname" className="custom-input" value={formData.surname} onChange={(e) => setFormData({ ...formData, surname: e.target.value })} required />
                <input type="date" className="custom-input" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} required />
                <select className="custom-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                </select>
                <button type="submit" className="submit-btn" style={{ gridColumn: 'span 2' }} disabled={loading}>
                    {loading ? "Registering..." : "Register Family Member"}
                </button>
            </form>
        </div>
    );
}

function FamilySection({ user, setUser }) {
    const [members, setMembers] = useState([]);
    const navigate = useNavigate();

    // 1. Define the fetch function
    const fetchMembers = async () => {
        const emailToFetch = user?.email || user?.username;
        if (!emailToFetch) return;
        try {
            const res = await fetch(`http://127.0.0.1:5001/api/family-members?email=${emailToFetch}`);
            const data = await res.json();
            if (data.success) setMembers(data.members);
        } catch (err) { 
            console.error("Fetch error:", err); 
        }
    }; // <--- THIS BRACKET CLOSES fetchMembers

    // 2. This must be OUTSIDE fetchMembers
    useEffect(() => { 
        fetchMembers(); 
    }, [user?.email, user?.username]);

    // 3. This must be OUTSIDE fetchMembers
    const switchAccount = (m) => {
        const updatedUser = {
            ...user,
            patientId: m.patient_id,
            name: m.first_name,
            surname: m.surname,
            patCode: m.barcode,
            blood_group: m.blood_group,
            allergies: m.allergies,
            nic: m.nic
        };
        setUser(updatedUser);
        localStorage.setItem('hospital_user', JSON.stringify(updatedUser));
        alert(`Switched to ${m.first_name}'s Profile`);
    };

    return (
        <div className="page-content">
            <h2 className="page-title">Family Management</h2>
            <div className="stats-grid">
                {members.map((m) => (
                    <div key={m.patient_id} className={`stat-card ${m.barcode === user.patCode ? 'active-profile' : ''}`}
                        style={{ border: m.barcode === user.patCode ? '2px solid #2563eb' : '1px solid #e2e8f0', padding: '15px', borderRadius: '12px' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4>{m.first_name} {m.surname}</h4>
                                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.barcode}</p>
                            </div>
                            {m.barcode === user.patCode && 
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>ACTIVE</span>
                            }
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                            <button 
                                className="submit-btn" 
                                onClick={() => switchAccount(m)} 
                                disabled={m.barcode === user.patCode}
                                style={{ background: m.barcode === user.patCode ? '#94a3b8' : '#2563eb' }}
                            >
                                {m.barcode === user.patCode ? 'Currently Logged In' : `Login as ${m.first_name}`}
                            </button>

                            <button 
                                className="submit-btn" 
                                style={{ background: '#059669', border: 'none' }} 
                                onClick={() => {
                                    switchAccount(m);
                                    navigate('/patient/appointments'); 
                                }}
                            >
                                Book Appointment for {m.first_name}
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
    // Find the next upcoming appointment
    const nextApp = myAppointments && myAppointments.length > 0 ? myAppointments[0] : null;

    return (
        <div className="page-content">
            <h2 className="page-title">Welcome, {user?.name || 'Patient'}</h2>

            {/* 1. Next Appointment Ticket (The Hero Section) */}
            {nextApp ? (
                <div style={{
                    background: 'linear-gradient(135deg, #2563eb, #1e40af)',
                    color: '#fff', padding: '25px', borderRadius: '15px',
                    marginBottom: '30px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase' }}>Upcoming Appointment</span>
                        <h2 style={{ margin: '5px 0', fontSize: '1.8rem' }}>{nextApp.time_slot}</h2>
                        <p style={{ margin: 0, opacity: 0.9 }}>{new Date(nextApp.appointment_day).toDateString()}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '15px 25px', borderRadius: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block' }}>TOKEN</span>
                        <span style={{ fontSize: '2.5rem', fontWeight: '900' }}>#{String(nextApp.token_no).padStart(2, '0')}</span>
                    </div>
                </div>
            ) : (
                <div className="stat-card" style={{ marginBottom: '30px', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: 0, color: '#64748b' }}>No upcoming appointments. Use the Appointments tab to book one.</p>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* 2. Barcode Card */}
                <div className="stat-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '10px' }}>Personal Digital ID</p>
                    <div style={{ fontSize: '1.2rem', letterSpacing: '5px', fontWeight: 'bold', padding: '15px', border: '2px solid #1e293b', display: 'inline-block', borderRadius: '8px' }}>
                        {user?.barcode || 'N/A'}
                    </div>
                    <p style={{ fontSize: '0.7rem', marginTop: '10px', color: '#94a3b8' }}>Show this at the OPD counter</p>
                </div>

                {/* 3. Quick Medical Summary */}
                <div className="stat-card">
                    <h4 style={{ margin: '0 0 10px 0', color: '#2563eb' }}>Medical Info</h4>
                    <div style={{ fontSize: '0.9rem' }}>
                        <p><strong>Blood:</strong> <span style={{ color: '#dc2626' }}>{user?.blood_group || 'Not Set'}</span></p>
                        <p><strong>Allergies:</strong> {user?.allergies ? <span style={{ color: '#dc2626' }}>{user.allergies}</span> : 'None Reported'}</p>
                    </div>
                </div>
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

/* --- INFO ROW COMPONENT --- */
const InfoRow = ({ label, value, name, type = "text", isSelect = false, options = [], isEditing, formData, setFormData }) => (
    <div className="info-row" style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: '600', color: '#64748b', display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
            {label}
        </label>
        {isEditing ? (
            isSelect ? (
                <select
                    className="custom-input"
                    value={formData[name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
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
                />
            )
        ) : (
            <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b', fontWeight: '500', minHeight: '37px' }}>
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
                first_name: user.name || '',
                surname: user.surname || '',
                nic: user.nic || '',
                phone: user.phone || '',
                address_line1: user.address_line1 || '',
                city: user.city || '',
                blood_group: user.blood_group || '',
                allergies: user.allergies || '',
                weight_kg: user.weight_kg || '',
                height_cm: user.height_cm || ''
            });
        }
    }, [user]);

    const handleUpdate = async (e) => {
        e.preventDefault();

        console.log("Current User Data:", user);

        try {
            // 1. Pick the ID (consistent naming is key!)
            const idToLink = user.patientId || user.id;

            // 2. Use the SAME variable name here
            if (!idToLink) {
                alert("Session error: User ID not found. Please log in again.");
                return;
            }

            const res = await fetch('http://127.0.0.1:5001/api/update-profile-full', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: idToLink, // Matches the 'patientId' expected by your backend
                    ...formData,
                    weight_kg: formData.weight_kg === "" ? null : formData.weight_kg,
                    height_cm: formData.height_cm === "" ? null : formData.height_cm
                })
            });

            const data = await res.json();

            if (data.success) {
                // Update local state so the UI refreshes immediately
                const updatedUser = { ...user, ...formData, name: formData.first_name };
                setUser(updatedUser);
                localStorage.setItem('hospital_user', JSON.stringify(updatedUser));
                setIsEditing(false);
                alert("Profile updated successfully!");
            } else {
                alert(data.message);
            }
        } catch (err) {
            console.error("Update Error:", err);
            alert("Error updating profile. Check your internet connection or server.");
        }
    };

    return (
        <div className="page-content" style={{ maxWidth: '900px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 className="page-title" style={{ margin: 0 }}>Patient Profile</h2>
                <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="submit-btn"
                    style={{ width: 'auto', padding: '8px 20px', background: isEditing ? '#ef4444' : '#2563eb' }}
                >
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
            </div>

            <div className="profile-card" style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>

                <form onSubmit={handleUpdate}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>

                        {/* Section 1: Contact & Identity */}
                        <div>
                            <h4 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>Personal & Contact</h4>
                            <InfoRow label="First Name" name="first_name" value={user.name} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            <InfoRow label="Surname" name="surname" value={user.surname} isEditing={isEditing} formData={formData} setFormData={setFormData} />

                            {/* Professional touch: NIC is usually read-only once verified, but you can keep it editable if needed */}
                            <InfoRow label="NIC Number" name="nic" value={user.nic} isEditing={isEditing} formData={formData} setFormData={setFormData} />

                            <InfoRow label="Mobile Phone" name="phone" value={user.phone} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            <InfoRow label="Street Address" name="address_line1" value={user.address_line1} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            <InfoRow label="City" name="city" value={user.city} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                        </div>

                        {/* Section 2: Health Vitals */}
                        <div>
                            <h4 style={{ color: '#059669', borderBottom: '2px solid #ecfdf5', paddingBottom: '10px' }}>Health Vitals</h4>
                            <InfoRow
                                label="Blood Group"
                                name="blood_group"
                                value={user.blood_group}
                                isSelect={true}
                                options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']}
                                isEditing={isEditing} formData={formData} setFormData={setFormData}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <InfoRow label="Weight (kg)" name="weight_kg" type="number" value={user.weight_kg} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                                <InfoRow label="Height (cm)" name="height_cm" type="number" value={user.height_cm} isEditing={isEditing} formData={formData} setFormData={setFormData} />
                            </div>

                            <label style={{ fontWeight: '600', color: '#64748b', fontSize: '0.85rem' }}>Medical Allergies</label>
                            {isEditing ? (
                                <textarea
                                    className="custom-input"
                                    style={{ width: '100%', height: '100px', marginTop: '5px' }}
                                    value={formData.allergies || ''}
                                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                                    placeholder="List any drug or food allergies..."
                                />
                            ) : (
                                <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px', marginTop: '5px', color: '#475569' }}>
                                    {user.allergies || "No known allergies"}
                                </div>
                            )}
                        </div>
                    </div>

                    {isEditing && (
                        <button type="submit" className="save-btn" style={{
                            marginTop: '30px', width: '100%', padding: '12px',
                            background: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: 'bold'
                        }}>
                            Confirm and Sync Profile
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}

function LiveQueue({ myAppointments }) {
    const [liveToken, setLiveToken] = useState(null);
    const activeApp = myAppointments.find(app => app.status === 'booked');

    useEffect(() => {
        // 2. ONLY run the fetch if activeApp actually exists
        if (activeApp && activeApp.appointment_day && activeApp.time_slot) {
            const fetchLive = async () => {
                try {
                    const res = await fetch(`http://127.0.0.1:5001/api/live-queue?date=${activeApp.appointment_day}&timeSlot=${activeApp.time_slot}`);
                    const data = await res.json();
                    setLiveToken(data.currentServing);
                } catch (err) {
                    console.error("Queue fetch error:", err);
                }
            };

            fetchLive();
            const interval = setInterval(fetchLive, 30000);
            return () => clearInterval(interval);
        }
    }, [activeApp]); // Dependency on activeApp

    if (!activeApp) return <div style={{ padding: '20px' }}>No active appointments for today.</div>;

    const peopleAhead = liveToken && liveToken !== "Waiting to start"
        ? Math.max(0, activeApp.token_no - liveToken)
        : activeApp.token_no - 1;

    return (
        <div className="live-queue-card" style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            color: 'white', padding: '30px', borderRadius: '15px', textAlign: 'center'
        }}>
            <h2 style={{ fontSize: '1.2rem', opacity: 0.8 }}>Now Serving</h2>
            <div style={{ fontSize: '4rem', fontWeight: '900', margin: '10px 0' }}>
                {liveToken || "--"}
            </div>
            <hr style={{ opacity: 0.2, margin: '20px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Your Token</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>#{activeApp.token_no}</p>
                </div>
                <div>
                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Wait Time</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>~{peopleAhead * 10} mins</p>
                </div>
            </div>
            <p style={{ marginTop: '20px', background: '#2563eb', padding: '10px', borderRadius: '8px' }}>
                {peopleAhead === 0 ? "You are next! Please be ready." : `${peopleAhead} people ahead of you.`}
            </p>
        </div>
    );
}

/* --- 1. SUB-COMPONENT: FEEDBACK --- */
// Move this OUTSIDE and ABOVE the PatientDashboard function
function Feedback({ user }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [history, setHistory] = useState([]);

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

/* --- 3. PLACEHOLDER SECTIONS (REPLACE WITH FETCH LOGIC LATER) --- */
/* function MedicalRecords() { return <div className="page-content"><h2>Medical Records</h2><p>No records found.</p></div>; }
function Prescriptions() { return <div className="page-content"><h2>Prescriptions</h2><p>No active prescriptions.</p></div>; }
function LabResults() { return <div className="page-content"><h2>Lab Results</h2><p>No reports available.</p></div>; }
function QueueStatus() { return <div className="page-content"><h2>Live Queue</h2><p>No active sessions found.</p></div>; }
function Notifications() { return <div className="page-content"><h2>Notifications</h2><p>You're all caught up!</p></div>; }
function Feedback() { return <div className="page-content"><h2>Feedback</h2><p>Feature coming soon.</p></div>; }*/

/* --- 4. MAIN DASHBOARD --- */

export default function PatientDashboard({ user, setUser }) {
    console.log("Dashboard Loaded with User:", user);

    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [myAppointments, setMyAppointments] = useState([]);

    // 1. Unified fetch function
    const fetchHistory = async (targetId) => {
        const idToFetch = targetId || user?.patientId;
        if (!idToFetch) {
            console.warn("No Patient ID available to fetch history");
            return;
        }

        try {
            const res = await fetch(`http://127.0.0.1:5001/api/my-appointments?patientId=${idToFetch}`);
            const data = await res.json();
            if (data.success) {
                setMyAppointments(data.appointments);
            }
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    // 2. Auth & Sync with LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('hospital_user');
        if (saved) {
            const parsedUser = JSON.parse(saved);
            if (!user) {
                setUser(parsedUser);
            }
        } else if (!user) {
            navigate('/');
        }
    }, [user, navigate, setUser]);

    // 3. Fetch data whenever the user/patient changes
    useEffect(() => {
        if (user?.patientId) {
            fetchHistory(user.patientId);
        }
    }, [user?.patientId]);

    const menuItems = [
        { icon: Home, label: 'Dashboard', path: '/patient' },
        { icon: Users, label: 'Family Accounts', path: '/patient/family' },
        { icon: User, label: 'My Profile', path: '/patient/profile' },
        { icon: Calendar, label: 'Book Appointment', path: '/patient/appointments' },
        { icon: Clock, label: 'My Queue', path: '/patient/queue' },
        { icon: FileText, label: 'Medical Records', path: '/patient/records' },
        { icon: Pill, label: 'Prescriptions', path: '/patient/prescriptions' },
        { icon: FlaskConical, label: 'Lab Results', path: '/patient/lab' },
        { icon: Bell, label: 'Notifications', path: '/patient/notifications' },
        { icon: MessageSquare, label: 'Feedback', path: '/patient/feedback' },
    ];

    return (
        <div className="dashboard-container">
            <nav className="top-nav">
                <div className="nav-left">
                    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X /> : <Menu />}
                    </button>
                    <h1 className="logo-text">SmartOPD</h1>
                </div>
                <div className="nav-right">
                    <div className="user-info">
                        <span className="user-name">{user?.name} {user?.surname}</span>
                        <span className="user-id">{user?.patCode}</span>
                    </div>
                    <button className="logout-btn" onClick={() => {
                        localStorage.removeItem('hospital_user');
                        setUser(null);
                        navigate('/');
                    }}>
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <div className="dashboard-body">
                <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                    {menuItems.map((item) => (
                        <button 
                            key={item.path}
                            className={`nav-item ${window.location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </aside>

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<DashboardHome user={user} myAppointments={myAppointments} />} />
                        <Route path="family" element={<FamilySection user={user} setUser={setUser} />} />
                        <Route path="profile" element={<ProfileEdit user={user} setUser={setUser} />} />
                        <Route path="appointments" element={
                            <Appointments 
                                user={user} 
                                fetchHistory={fetchHistory} 
                                myAppointments={myAppointments} 
                            />
                        } />
                        <Route path="queue" element={<LiveQueue myAppointments={myAppointments} />} />
                        <Route path="feedback" element={<Feedback user={user} />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}