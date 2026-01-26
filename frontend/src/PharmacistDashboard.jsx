import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Pill, FileText, CheckCircle, LogOut, Menu, X, Home, Clock, Search } from 'lucide-react';
import './PharmacistDashboard.css';

export default function PharmacistDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('hospital_user');
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="pharmacist-layout">
      {/* Navbar - Using .navbar from your CSS */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg-hidden" style={{ border: 'none', background: 'none' }}>
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb' }}>
              SmartOPD <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 'normal' }}>| Pharmacy</span>
            </h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '500', color: '#111827', margin: 0 }}>{user?.first_name} {user?.surname}</p>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>ID: {user?.staff_id}</p>
            </div>
            <button onClick={handleLogout} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div style={{ display: 'flex' }}>
        {/* Sidebar - Using .sidebar-container and .nav-item from your CSS */}
        <aside className={`sidebar-container ${menuOpen ? 'sidebar-mobile-open' : ''}`}>
          <nav style={{ padding: '16px' }}>
            <button className="nav-item" onClick={() => { navigate('/pharmacist'); setMenuOpen(false); }}>
              <Home size={20} /> Dashboard
            </button>
            <button className="nav-item" onClick={() => { navigate('/pharmacist/prescriptions'); setMenuOpen(false); }}>
              <FileText size={20} /> View Prescriptions
            </button>
            <button className="nav-item" onClick={() => { navigate('/pharmacist/history'); setMenuOpen(false); }}>
              <CheckCircle size={20} /> History
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: '32px' }}>
          <Routes>
            <Route path="/" element={<PharmacistHome />} />
            <Route path="/prescriptions" element={<Prescriptions user={user}/>} />
            <Route path="/history" element={<DispensedHistory />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/* --- Sub Components using your .stat-card and .stat-grid --- */

function PharmacistHome() {
  return (
    <div>
      <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>Overview</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Clock size={32} color="#ca8a04" />
            <span style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>12</span>
          </div>
          <p style={{ color: '#4b5563', marginTop: '8px' }}>Pending Rx</p>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pill size={32} color="#2563eb" />
            <span style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>8</span>
          </div>
          <p style={{ color: '#4b5563', marginTop: '8px' }}>Dispensing</p>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CheckCircle size={32} color="#16a34a" />
            <span style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>35</span>
          </div>
          <p style={{ color: '#4b5563', marginTop: '8px' }}>Completed</p>
        </div>
      </div>
    </div>
  );
}

function Prescriptions({ user }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:5001/api/pharmacist/pending-prescriptions?term=${searchTerm}`);
      const data = await res.json();
      setPrescriptions(data);
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div className="search-header">
        <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Digital Prescriptions</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" placeholder="Patient NIC or ID..." onChange={(e) => setSearchTerm(e.target.value)} />
          <button className="btn-primary" onClick={fetchPrescriptions}><Search size={20}/></button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {prescriptions.map((rx) => (
          <div key={rx.prescription_id} className="prescription-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>Rx #{rx.prescription_id}</h3>
                <p style={{ color: '#4b5563' }}>Patient: {rx.patient_name} (ID: {rx.patient_id})</p>
                <div className="med-box">{rx.details}</div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '8px' }}>By Dr. {rx.doctor_name}</p>
              </div>
              <button className="btn-dispense">Dispense</button>
            </div>
          </div>
        ))}
        {prescriptions.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>Search for a patient to view prescriptions.</p>}
      </div>
    </div>
  );
}

function DispensedHistory() {
  return <div><h2 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>History</h2><p>History content goes here...</p></div>;
}