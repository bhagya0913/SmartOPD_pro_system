import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { FlaskConical, Upload, FileCheck, LogOut, Menu, X, Home, Clock, Search } from 'lucide-react';
import './LabDashboard.css';

export default function LabDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/lab' },
    { icon: FlaskConical, label: 'Test Requests', path: '/lab/requests' },
    { icon: Upload, label: 'Upload Results', path: '/lab/upload' },
    { icon: FileCheck, label: 'Completed Tests', path: '/lab/completed' },
  ];

  const handleLogout = () => {
    setUser(null);
    navigate('/');
  };

  return (
    <div className="lab-layout">
      {/* Navbar */}
      <nav className="lab-navbar">
        <div className="nav-container">
          <div className="nav-left">
            <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="nav-logo">SmartOPD <span>| Lab Technician</span></h1>
          </div>
          <div className="nav-right">
            <div className="user-info">
              <p className="user-name">{user?.name || "Technician"}</p>
              <p className="user-role">Lab Dept</p>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-body">
        {/* Sidebar */}
        <aside className={`lab-sidebar ${menuOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.path}
                className="sidebar-link"
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="lab-main">
          <Routes>
            <Route path="/" element={<LabHome />} />
            <Route path="/requests" element={<TestRequests />} />
            <Route path="/upload" element={<UploadResults />} />
            <Route path="/completed" element={<CompletedTests />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/* Sub-Components */
function LabHome() {
  return (
    <div className="fade-in">
      <h2 className="page-title">Lab Dashboard Overview</h2>
      <div className="stat-grid">
        <div className="stat-card border-yellow">
          <Clock size={32} className="text-yellow" />
          <div className="stat-content">
            <span className="stat-val">8</span>
            <p>Pending Tests</p>
          </div>
        </div>
        <div className="stat-card border-blue">
          <FlaskConical size={32} className="text-blue" />
          <div className="stat-content">
            <span className="stat-val">5</span>
            <p>In Progress</p>
          </div>
        </div>
        <div className="stat-card border-green">
          <FileCheck size={32} className="text-green" />
          <div className="stat-content">
            <span className="stat-val">23</span>
            <p>Completed Today</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal placeholders for other views
function TestRequests() { return <div className="page-title">Test Requests List</div>; }
function UploadResults() { return <div className="page-title">Upload Form</div>; }
function CompletedTests() { return <div className="page-title">History Logs</div>; }