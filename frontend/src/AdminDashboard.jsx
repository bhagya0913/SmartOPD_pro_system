import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
    Users, Settings, BarChart3, Calendar, Clock,
    LogOut, Menu, X, Home, UserPlus, FileText, Activity
} from 'lucide-react';
import './AdminDashboard.css';

/* --- 1. ADMIN HOME (STATISTICS) --- */
function AdminHome() {
    const [stats, setStats] = useState({ totalStaff: 0, patientsToday: 0, waitTime: '0 min', uptime: '99.9%' });

    // In production, fetch these from your backend
    useEffect(() => {
        // fetch('http://127.0.0.1:5001/admin-stats').then(res => res.json()).then(data => setStats(data));
    }, []);

    return (
        <div>
            <h2 className="page-title">Admin Overview</h2>
            <div className="admin-card-grid">
                <div className="admin-card">
                    <Users color="#2563eb" size={24} />
                    <h3>{stats.totalStaff}</h3>
                    <p>Total Staff Members</p>
                </div>
                <div className="admin-card">
                    <Calendar color="#16a34a" size={24} />
                    <h3>{stats.patientsToday}</h3>
                    <p>Patients Registered Today</p>
                </div>
                <div className="admin-card">
                    <Clock color="#9333ea" size={24} />
                    <h3>{stats.waitTime}</h3>
                    <p>Current Avg Wait</p>
                </div>
                <div className="admin-card">
                    <Activity color="#ea580c" size={24} />
                    <h3>{stats.uptime}</h3>
                    <p>System Health</p>
                </div>
            </div>
        </div>
    );
}

/* --- 2. STAFF MANAGEMENT (TABLE & ADD) --- */
/* --- 2. STAFF MANAGEMENT (CORRECTED) --- */
function StaffManagement() {
    const [staffList, setStaffList] = useState([]);
    const [showForm, setShowForm] = useState(false);
    // Updated state to include firstName and surname separately
    const [newStaff, setNewStaff] = useState({ firstName: '', surname: '', role: 'Doctor', email: '' });

    const fetchStaff = async () => {
        try {
            const res = await fetch('http://127.0.0.1:5001/api/admin/staff');
            const data = await res.json();
            setStaffList(data);
        } catch (err) {
            console.error("Error fetching staff:", err);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const handleRemoveStaff = async (staffId) => {
        if (!window.confirm("Are you sure you want to remove this staff member? This will also delete their login account.")) {
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5001/api/admin/remove-staff/${staffId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                // Update the local state to remove the staff from the UI table
                setStaffList(prevList => prevList.filter(staff => staff.staff_id !== staffId));
                alert("Staff member removed successfully.");
            } else {
                alert("Error: " + data.message);
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Failed to connect to the server.");
        }
    };

    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://127.0.0.1:5001/api/admin/add-staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // CHANGED THIS LINE: Match the backend expected key
                    first_name: newStaff.firstName,
                    surname: newStaff.surname,
                    email: newStaff.email,
                    roleName: newStaff.role
                })
            });
            const data = await response.json();
            if (data.success) {
                alert("Staff Member Added and Email Sent!");
                fetchStaff();
                setShowForm(false);
                setNewStaff({ firstName: '', surname: '', role: 'Doctor', email: '' });
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            console.error("Failed to add staff", err);
        }
    };
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 className="page-title">Hospital Staff</h2>
                <button className="save-btn" onClick={() => setShowForm(!showForm)}>
                    <UserPlus size={18} /> {showForm ? 'Close' : 'Add Staff'}
                </button>
            </div>

            {showForm && (
                <form className="admin-card" style={{ marginBottom: '20px' }} onSubmit={handleAddStaff}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input className="admin-input" placeholder="First Name" value={newStaff.firstName}
                            onChange={e => setNewStaff({ ...newStaff, firstName: e.target.value })} required />
                        <input className="admin-input" placeholder="Surname" value={newStaff.surname}
                            onChange={e => setNewStaff({ ...newStaff, surname: e.target.value })} required />
                    </div>
                    <select className="admin-input" value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}>
                        <option value="Doctor">Doctor</option>
                        <option value="Receptionist">Receptionist</option>
                        <option value="Pharmacist">Pharmacist</option>
                        <option value="Admin">Admin</option>
                    </select>
                    <input className="admin-input" placeholder="Email" type="email"
                        onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} required />
                    <button type="submit" className="save-btn">Save Member</button>
                </form>
            )}

            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {staffList.length > 0 ? staffList.map(s => (
                        <tr key={s.staff_id}>
                            <td>{s.first_name} {s.surname}</td>
                            <td>{s.role_name}</td>
                            <td>{s.email}</td>
                            <td><span className={`status-pill ${s.active ? 'status-active' : ''}`}>
                                {s.active ? 'Active' : 'Inactive'}
                            </span></td>
                            <td>
                                <button
                                    style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}
                                    onClick={() => handleRemoveStaff(s.staff_id)} // Add this line!
                                >
                                    Remove
                                </button>
                            </td>
                        </tr>
                    )) : <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No staff records found.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

/* --- 3. OPD SETTINGS --- */
function OPDSettings() {
    const [config, setConfig] = useState({ startTime: '08:00', endTime: '16:00', dailyLimit: 300 });

    const handleSave = () => {
        // API call to update system_settings table
        alert("System configurations updated!");
    };

    return (
        <div className="admin-card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="admin-card">
                <h3>Working Hours</h3>
                <label>Start Time</label>
                <input type="time" className="admin-input" value={config.startTime} onChange={e => setConfig({ ...config, startTime: e.target.value })} />
                <label>End Time</label>
                <input type="time" className="admin-input" value={config.endTime} onChange={e => setConfig({ ...config, endTime: e.target.value })} />
                <button className="save-btn" onClick={handleSave}>Update Hours</button>
            </div>
            <div className="admin-card">
                <h3>Patient Quotas</h3>
                <label>Max Daily Patients</label>
                <input type="number" className="admin-input" value={config.dailyLimit} onChange={e => setConfig({ ...config, dailyLimit: e.target.value })} />
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '10px' }}>Total appointments allowed across all departments per day.</p>
                <button className="save-btn" onClick={handleSave}>Save Quota</button>
            </div>
        </div>
    );
}

/* --- 4. REPORTS & LOGS --- */
function Reports() {
    return (
        <div className="admin-card">
            <h3>Analytics Reports</h3>
            <p>Select date range to export system performance reports.</p>
            <input type="date" className="admin-input" style={{ width: '200px', marginRight: '10px' }} />
            <button className="save-btn">Download PDF</button>
        </div>
    );
}

function SystemLogs() {
    const [logs, setLogs] = useState([]);
    return (
        <div className="admin-card">
            <h3>System Audit Logs</h3>
            <table className="admin-table">
                <thead><tr><th>Event</th><th>User</th><th>Timestamp</th></tr></thead>
                <tbody>
                    {logs.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center' }}>No recent activity logs.</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

/* --- MAIN ADMIN DASHBOARD COMPONENT --- */
export default function AdminDashboard({ user, setUser }) {
    const navigate = useNavigate();

    const menuItems = [
        { icon: Home, label: 'Dashboard', path: '/admin' },
        { icon: Users, label: 'Staff Management', path: '/admin/staff' },
        { icon: Settings, label: 'OPD Settings', path: '/admin/settings' },
        { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
        { icon: FileText, label: 'System Logs', path: '/admin/logs' },
    ];

    return (
        <div className="admin-container">
            <aside className="admin-sidebar">
                <h1 style={{ fontSize: '1.2rem', marginBottom: '30px', fontWeight: 'bold' }}>SmartOPD Admin</h1>
                <nav>
                    {menuItems.map(item => (
                        <button key={item.path} className={`admin-nav-item ${window.location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}>
                            <item.icon size={18} /> {item.label}
                        </button>
                    ))}
                    <button className="admin-nav-item" style={{ marginTop: '50px', color: '#f87171' }}
                        onClick={() => { setUser(null); navigate('/'); }}>
                        <LogOut size={18} /> Logout
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header style={{ marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <p style={{ color: '#64748b' }}>Logged in as: <strong>{user?.name}</strong> (Administrator)</p>
                </header>

                <Routes>
                    <Route path="/" element={<AdminHome />} />
                    <Route path="staff" element={<StaffManagement />} />
                    <Route path="settings" element={<OPDSettings />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="logs" element={<SystemLogs />} />
                </Routes>
            </main>
        </div>
    );
}