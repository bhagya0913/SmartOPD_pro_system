import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { 
  ScanBarcode, UserPlus, Calendar, Users, Clock, 
  LogOut, Menu, X, Home, Settings 
} from 'lucide-react';
import PatientLookup from './PatientLookup';
import './ReceptionistDashboard.css';

export default function ReceptionistDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/receptionist' },
    { icon: ScanBarcode, label: 'Scan Patient', path: '/receptionist/scan' },
    { icon: UserPlus, label: 'Register New Patient', path: '/receptionist/register' },
    { icon: Calendar, label: 'Verify Appointments', path: '/receptionist/verify' },
    { icon: Users, label: 'Daily Patient List', path: '/receptionist/patients' },
    { icon: Settings, label: 'OPD Settings', path: '/receptionist/settings' },
  ];

  const handleLogout = () => {
    setUser(null);
    navigate('/');
  };

  return (
    <div className="dash-container">
      {/* Top Navbar */}
      <nav className="dash-nav">
        <div className="nav-brand">
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg-hidden-btn">
            {menuOpen ? <X /> : <Menu />}
          </button>
          <h1>SmartOPD - Receptionist</h1>
        </div>
        <div className="nav-profile">
          <div className="profile-info">
            <p className="profile-name">{user?.name || 'Staff'}</p>
            <p className="profile-role">Receptionist</p>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="dash-body">
        {/* Sidebar */}
        <aside className={`dash-sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-content">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                className={`menu-item ${window.location.pathname === item.path ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="dash-main">
          <Routes>
            <Route path="/" element={<ReceptionistHome navigate={navigate} />} />
            <Route path="/scan" element={<ScanPatient />} />
            <Route path="/register" element={<RegisterPatient />} />
            <Route path="/verify" element={<VerifyAppointments />} />
            <Route path="/patients" element={<DailyPatients />} />
            <Route path="/settings" element={<OPDSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/* --- Sub-Components --- */

function ReceptionistHome({ navigate }) {
  return (
    <div>
      <h2 className="page-title">Receptionist Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header"><Users className="text-blue" /><span className="stat-value">45</span></div>
          <p>Today's Patients</p>
        </div>
        <div className="stat-card">
          <div className="stat-header"><Calendar className="text-green" /><span className="stat-value">32</span></div>
          <p>Appointments</p>
        </div>
        <div className="stat-card">
          <div className="stat-header"><Clock className="text-purple" /><span className="stat-value">13</span></div>
          <p>In Queue</p>
        </div>
        <div className="stat-card">
          <div className="stat-header"><UserPlus className="text-orange" /><span className="stat-value">8</span></div>
          <p>New Registrations</p>
        </div>
      </div>

      <div className="action-section">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <button className="action-btn btn-blue" onClick={() => navigate('/receptionist/scan')}>
            <ScanBarcode size={32} />
            <p>Scan Patient</p>
          </button>
          <button className="action-btn btn-green" onClick={() => navigate('/receptionist/register')}>
            <UserPlus size={32} />
            <p>Register New</p>
          </button>
          <button className="action-btn btn-purple" onClick={() => navigate('/receptionist/verify')}>
            <Calendar size={32} />
            <p>Verify Appts</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanPatient() {
  const [showLookup, setShowLookup] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <div>
      <h2 className="page-title">Scan Patient</h2>
      <div className="card-form">
        <button onClick={() => setShowLookup(true)} className="btn-primary-large">
          <ScanBarcode size={24} /> Launch Patient Lookup
        </button>

        {selectedPatient && (
          <div className="patient-info-display">
            <h3>Patient Identified</h3>
            <div className="info-grid">
               <div><label>Name</label><p>{selectedPatient.name}</p></div>
               <div><label>PAT Code</label><p>{selectedPatient.id}</p></div>
               <div><label>NIC</label><p>{selectedPatient.nic}</p></div>
            </div>
            <button className="btn-success">Assign to OPD Queue</button>
          </div>
        )}
      </div>
      {showLookup && <PatientLookup onSelectPatient={(p) => { setSelectedPatient(p); setShowLookup(false); }} onClose={() => setShowLookup(false)} />}
    </div>
  );
}

function RegisterPatient() {
  const [formData, setFormData] = useState({
    name: '',
    nic: '',
    dob: '',
    phone: ''
  });
  const [generatedCode, setGeneratedCode] = useState('');

  const handleRegister = (e) => {
    e.preventDefault();
    
    // Simple validation
    if (!formData.name || !formData.nic) {
      alert("Please enter Name and NIC");
      return;
    }

    // Generate PAT Code: PAT / 26 (Current Year) / 4 Random Digits
    const year = new Date().getFullYear().toString().slice(-2);
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const newCode = `PAT/${year}/${randomDigits}`;
    
    setGeneratedCode(newCode);
    alert(`Success! Patient Registered with Code: ${newCode}`);
  };

  return (
    <div>
      <h2 className="page-title">Register New Patient</h2>
      <div className="card-form">
        {!generatedCode ? (
          <form onSubmit={handleRegister}>
            <div className="form-row">
              <div className="form-group full">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter patient name" 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>NIC Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 199012345678" 
                  onChange={(e) => setFormData({...formData, nic: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input 
                  type="date" 
                  className="form-input" 
                  onChange={(e) => setFormData({...formData, dob: e.target.value})}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary-large" style={{marginTop: '20px'}}>
              <UserPlus size={20} /> Generate PAT Code & Register
            </button>
          </form>
        ) : (
          /* Success View */
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ background: '#f0fdf4', border: '2px dashed #22c55e', padding: '30px', borderRadius: '1rem' }}>
              <h3 style={{ color: '#166534', marginTop: 0 }}>Registration Successful!</h3>
              <p className="text-gray-600">Assign this code to the patient's card:</p>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', letterSpacing: '2px', color: '#111827', margin: '20px 0' }}>
                {generatedCode}
              </div>
              <button onClick={() => setGeneratedCode('')} className="btn-primary-large">
                Register Another Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyAppointments() { return <div><h2 className="page-title">Verify Appointments</h2><p>Appointment verification list here...</p></div>; }
function DailyPatients() { return <div><h2 className="page-title">Daily Patient List</h2><p>Today's clinical ledger...</p></div>; }
function OPDSettings() { return <div><h2 className="page-title">OPD Settings</h2><p>Configure hospital quotas...</p></div>; }