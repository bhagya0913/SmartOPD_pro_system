import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, NavLink } from 'react-router-dom';
// import { ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut } from 'lucide-react';
import './DoctorDashboard.css';
// import { X, ArrowLeft } from 'lucide-react'; // Ensure ArrowLeft is imported
import { ScanBarcode, Home, User, Bell, MessageSquare, X, LogOut, ArrowLeft, Search, CreditCard } from 'lucide-react';

export default function DoctorDashboard({ user, setUser }) {
    const [openPatients, setOpenPatients] = useState([]); // Array of patient objects
    const [activeTab, setActiveTab] = useState('home'); // 'home', 'profile', or a 'patientID'
    const navigate = useNavigate();

    // Function to "Open" a patient
    const openPatientSession = (patient) => {
        // Check if patient is already open
        if (!openPatients.find(p => p.id === patient.id)) {
            setOpenPatients([...openPatients, patient]);
        }
        setActiveTab(patient.id); // Switch to that tab
    };

    // Function to "Close" a tab
    const closeTab = (id, e) => {
        e.stopPropagation(); // Prevent switching tab while closing
        const filtered = openPatients.filter(p => p.id !== id);
        setOpenPatients(filtered);
        if (activeTab === id) setActiveTab('home'); // Go home if we closed the active tab
    };

    return (
        <div className="doctor-layout">
            {/* 1. STATIC SIDEBAR */}
            <aside className="sidebar">
                <div className="sidebar-logo">SmartOPD</div>
                <nav>
                    <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <Home size={20} /> Home
                    </button>
                    <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        <User size={20} /> Profile
                    </button>
                    <button className={`nav-btn ${activeTab === 'retrieve' ? 'active' : ''}`} onClick={() => setActiveTab('retrieve')}>
                        <ScanBarcode size={20} /> Retrieve Patient
                    </button>
                    <hr />
                    <button className="logout-btn" onClick={() => { setUser(null); navigate('/'); }}>
                        <LogOut size={20} /> Logout
                    </button>
                </nav>
            </aside>

            {/* 2. MAIN CONTENT AREA */}
            <main className="main-content">

                {/* TAB BAR (The Horizontal Row of Open Patients) */}
                <div className="internal-tab-bar">
                    <div className={`tab-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Dashboard</div>

                    {openPatients.map(p => (
                        <div key={p.id} className={`tab-item ${activeTab === p.id ? 'active' : ''}`} onClick={() => setActiveTab(p.id)}>
                            {p.name}
                            <X size={14} className="close-icon" onClick={(e) => closeTab(p.id, e)} />
                        </div>
                    ))}
                </div>

                {/* CONTENT SWITCHER */}
                <div className="tab-window">
                    {activeTab === 'home' && <DoctorHome />}
                    {activeTab === 'profile' && <div className="card"><h2>My Profile</h2></div>}
                    {activeTab === 'retrieve' && <RetrievePatient onOpen={openPatientSession} />}

                    {/* Render the Portal for the active patient */}
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

// Update the Retrieve Search to use the "onOpen" prop
function RetrievePatient({ onOpen }) {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = async () => {
        console.log("Sending search request for:", searchTerm); // Check your browser console!
        const response = await fetch(`http://127.0.0.1:5001/api/doctor/search-patient?term=${searchTerm}`);
        const data = await response.json();
        if (data.success) {
            onOpen({
                id: data.patient.patient_id,
                name: `${data.patient.first_name} ${data.patient.surname}`,
                age: data.patient.age,
                blood: data.patient.blood_group
            });
        } else { alert("Not found"); }
    };

    return (
        <div className="card" style={{ maxWidth: '500px', margin: 'auto' }}>
            <h2>Retrieve Patient Record</h2>
            <input className="form-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="NIC or Patient ID" />
            <button className="primary-btn" onClick={handleSearch} style={{ width: '100%', marginTop: '10px' }}>Open Record</button>
        </div>
    );
}

/* --- THE PATIENT PORTAL --- */
function PatientPortal({ patient, user }) {
    const [activeSubTab, setActiveSubTab] = useState('history');

    return (
        <div className="portal-container">
            {/* Patient Header Summary */}
            <div className="patient-banner">
                <div className="patient-info">
                    <h3 style={{ margin: 0 }}>{patient.name}</h3>
                    <small>ID: {patient.id} | Age: {patient.age} | Blood: {patient.blood}</small>
                </div>
            </div>

            {/* Sub-tabs for Medical Actions */}
            <div className="portal-tabs">
                <button 
                    className={activeSubTab === 'history' ? 'active' : ''} 
                    onClick={() => setActiveSubTab('history')}
                >
                    Medical History
                </button>
                <button 
                    className={activeSubTab === 'diagnosis' ? 'active' : ''} 
                    onClick={() => setActiveSubTab('diagnosis')}
                >
                    Diagnosis & Prescription
                </button>
                <button 
                    className={activeSubTab === 'lab' ? 'active' : ''} 
                    onClick={() => setActiveSubTab('lab')}
                >
                    Lab Requests
                </button>
            </div>

            <div className="portal-content" style={{ marginTop: '20px' }}>
                {activeSubTab === 'history' && (
                    <MedicalHistory patientId={patient.id} />
                )}
                
                {activeSubTab === 'diagnosis' && (
                    <CreateConsultation 
                        patient={patient} 
                        user={user} 
                        onBack={() => setActiveSubTab('history')} 
                    />
                )}

                {activeSubTab === 'lab' && (
                    <LabRequestForm 
                        patient={patient} 
                        user={user} 
                        onBack={() => setActiveSubTab('history')} 
                    />
                )}
            </div>
        </div>
    );
}

/* --- SUB-COMPONENT: MEDICAL HISTORY --- */
/* --- SUB-COMPONENT: MEDICAL HISTORY --- */
function MedicalHistory({ patientId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`http://127.0.0.1:5001/api/doctor/patient-history/${patientId}`)
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error:", err);
                setLoading(false);
            });
    }, [patientId]);

    if (loading) return <p>Loading history...</p>;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Complete Medical History</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Patient ID: {patientId}</span>
            </div>

            {history.length > 0 ? (
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ width: '150px' }}>Date & Time</th>
                            <th>Clinical Findings</th>
                            <th>Prescriptions & Dosages</th>
                            <th>Attending Doctor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Replace your map function with this safer version */}
                        {history.map((record, index) => (
                            <tr key={record.record_id || index}>
                                <td style={{ verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: 'bold' }}>
                                        {new Date(record.consultation_day).toLocaleDateString()}
                                    </div>
                                    {record.consultation_time && (
                                        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                            🕒 {record.consultation_time}
                                        </div>
                                    )}
                                </td>
                                <td style={{ verticalAlign: 'top' }}>
                                    {record.treatment_details}
                                </td>
                                <td style={{ verticalAlign: 'top' }}>
                                    <div style={{
                                        backgroundColor: '#f0f9ff',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {record.prescription_details || "No medication issued"}
                                    </div>
                                </td>
                                <td>Dr. {record.doctor_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No records found.</p>
            )}
        </div>
    );
}

/* --- SUB-COMPONENT: DIAGNOSIS FORM --- */
/* --- SUB-COMPONENT: DIAGNOSIS FORM (UPDATED UI) --- */
function CreateConsultation({ patient, user, onBack }) {
    const [activeTab, setActiveTab] = useState('consultation');
    const [findings, setFindings] = useState('');
    const [medsList, setMedsList] = useState([{ nameAndDose: '', note: '' }]);

    const addMedicine = () => setMedsList([...medsList, { nameAndDose: '', note: '' }]);
    const removeMedicine = (index) => setMedsList(medsList.filter((_, i) => i !== index));
    const updateMedicine = (index, field, value) => {
        const newList = [...medsList];
        newList[index][field] = value;
        setMedsList(newList);
    };

    const handleSaveSession = async () => {
        if (!findings.trim()) return alert("Please enter clinical findings.");
        console.log("Current User Object:", user);
        const doctorId = user?.staff_id || user?.id;
        // DEBUG: Ensure doctor_id isn't undefined
        console.log("Saving with Doctor ID:", user?.staff_id);

        if (!doctorId) {
        return alert("Error: Doctor ID not found. Please re-login.");
    }

        const payload = {
        patient_id: patient.id,
        doctor_id: doctorId,
        appointment_id: patient.appointment_id || null, // Send null if you don't have it yet
        findings: findings,
        medicines: medsList.filter(m => m.nameAndDose.trim() !== "").map(m => ({
            name: m.nameAndDose, 
            note: m.note
        }))
    }

        try {
            const response = await fetch('http://127.0.0.1:5001/api/doctor/save-consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                alert("✅ Consultation Saved!");
                setFindings('');
                setMedsList([{ nameAndDose: '', note: '' }]);
                onBack();
            }
                else {
                alert("❌ Server error: " + result.error);
            }
        } catch (err) { alert("❌ Save Failed"); }
    };
    

    if (activeTab === 'referral') return <ReferralForm patient={patient} onBack={() => setActiveTab('consultation')} />;
    if (activeTab === 'lab') return <LabRequestForm patient={patient} onBack={() => setActiveTab('consultation')} />;

    return (
        <div className="consultation-container">
            {/* Header Mini Bar */}
            <div className="patient-mini-bar">
                <button onClick={onBack} className="back-nav-btn"><ArrowLeft size={18} /></button>
                <div><strong>Patient:</strong> {patient.name}</div>
                <div><strong>ID:</strong> {patient.id}</div>
            </div>

            {/* NEW VERTICAL LAYOUT */}
            <div className="consultation-vertical-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* TOP: Clinical Findings */}
                <div className="card">
                    <div className="section-header">
                        <h3 className="section-title">Clinical Findings & Diagnosis</h3>
                    </div>
                    <textarea 
                        className="figma-textarea" 
                        rows={6}
                        placeholder="Type detailed diagnosis and clinical observations..."
                        value={findings}
                        onChange={e => setFindings(e.target.value)}
                    />
                </div>

                {/* BOTTOM: Prescription List */}
                <div className="card">
                    <div className="section-header">
                        <h3 className="section-title">Prescription Details</h3>
                        <button className="add-btn" onClick={addMedicine}>+ Add Medicine</button>
                    </div>
                    
                    <div className="meds-list-container">
                        {medsList.map((med, index) => (
                            <div key={index} className="med-row-card" style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                                <input 
                                    className="med-input" 
                                    style={{ flex: 2 }}
                                    placeholder="Medicine Name & Dosage (e.g. Panadol 500mg 1x3)" 
                                    value={med.nameAndDose}
                                    onChange={e => updateMedicine(index, 'nameAndDose', e.target.value)}
                                />
                                <input 
                                    className="med-input" 
                                    style={{ flex: 1 }}
                                    placeholder="Special Note (e.g. After food)" 
                                    value={med.note}
                                    onChange={e => updateMedicine(index, 'note', e.target.value)}
                                />
                                {medsList.length > 1 && (
                                    <button className="remove-med-btn" onClick={() => removeMedicine(index)}>
                                        <X size={18} color="#ef4444" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="action-footer">
                <button className="referral-btn" onClick={() => setActiveTab('referral')}>Create Referral</button>
                <button className="lab-btn" onClick={() => setActiveTab('lab')}>Request Lab Test</button>
                <button className="primary-btn-large" onClick={handleSaveSession}>Complete & Save</button>
            </div>
        </div>
    );
}


function ReferralForm({ patient, onBack }) {

    const [reason, setReason] = useState('');
    const [dept, setDept] = useState('Cardiology');

    const handleReferral = () => {
        alert(`Referral generated for ${patient.name} to ${dept}`);
        // Add your fetch call to /api/doctor/save-referral here if you have one
        onBack();
    };

    return (
        <div className="card figma-modal-style">
            <div className="section-header">
                <h3 className="section-title">External Referral Form</h3>
                <button className="close-btn" onClick={onBack}><X size={20} /></button>
            </div>

            <div className="form-group">
                <label>Referring to Hospital/Department</label>
                <select className="med-input">
                    <option>Cardiology - General Hospital</option>
                    <option>Neurology - Specialized Unit</option>
                    <option>Radiology - City Scan Center</option>
                </select>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Clinical Reason for Referral</label>
                    <textarea 
                className="figma-textarea" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
            />
            </div>

            <div className="action-footer">
                <button className="referral-btn" onClick={onBack}>Cancel</button>
                <button className="primary-btn-large" onClick={handleReferral}>Generate & Print Referral</button>
            </div>
        </div>
    );
}

/* --- SUB-COMPONENT: DOCTOR HOME --- */
function DoctorHome() {
    return (
        <div className="card">
            <h2>Doctor Dashboard</h2>
            <p>Welcome back! Use the sidebar to retrieve patients or view your profile.</p>
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="card" style={{ background: '#eff6ff' }}>
                    <h3>Today's Appointments</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>--</p>
                </div>
                <div className="card" style={{ background: '#f0fdf4' }}>
                    <h3>Completed</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>--</p>
                </div>
            </div>
        </div>
    );
}

/* --- SUB-COMPONENT: LAB REQUEST FORM --- */
function LabRequestForm({ patient, user, onBack }) { // Added 'user' to props
    const [selectedTests, setSelectedTests] = useState([]);
    const [instructions, setInstructions] = useState('');
    const commonTests = [
        "Full Blood Count (FBC)", 
        "Lipid Profile", 
        "FBS / HbA1c", 
        "Liver Function Test", 
        "Urine Full Report", 
        "Serum Creatinine"
    ];

    const toggleTest = (test) => {
        setSelectedTests(prev =>
            prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]
        );
    };

    const handleSubmitLab = async () => {
        if (selectedTests.length === 0) {
            return alert("Please select at least one test.");
        }

        // Match these keys EXACTLY to your backend: 
        // patientId, doctorId, testName, priority
        const payload = {
            patientId: patient.id, 
            doctorId: user?.staff_id || user?.id, 
            testName: selectedTests.join(', ') + (instructions ? ` (Note: ${instructions})` : ''), 
            priority: 'Normal' 
        };

        try {
            const res = await fetch('http://127.0.0.1:5001/api/doctor/request-lab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (data.success) {
                alert("✅ Lab Request Sent Successfully!");
                onBack(); 
            } else {
                alert("❌ Error: " + (data.error || "Unknown server error"));
            }
        } catch (err) {
            console.error("Lab Request Error:", err);
            alert("❌ Network Error: Could not connect to server.");
        }
    };

    return (
        <div className="card figma-modal-style">
            <div className="section-header">
                <h3 className="section-title">Laboratory Investigation Request</h3>
                <button className="close-btn" onClick={onBack}><X size={20} /></button>
            </div>

            <div className="lab-grid">
                {commonTests.map(test => (
                    <label 
                        key={test} 
                        className={`lab-checkbox-card ${selectedTests.includes(test) ? 'active-test' : ''}`}
                        style={{ display: 'flex', gap: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '5px', cursor: 'pointer' }}
                    >
                        <input
                            type="checkbox"
                            checked={selectedTests.includes(test)}
                            onChange={() => toggleTest(test)}
                        />
                        <span>{test}</span>
                    </label>
                ))}
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Other / Special Instructions</label>
                <textarea
                    className="figma-textarea"
                    rows={3}
                    placeholder="Add any other specific tests or instructions..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
            </div>

            <div className="action-footer" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="referral-btn" onClick={onBack} style={{ flex: 1 }}>Cancel</button>
                <button className="primary-btn-large" onClick={handleSubmitLab} style={{ flex: 2 }}>
                    Submit Lab Request
                </button>
            </div>
        </div>
    );
}
    
