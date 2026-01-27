import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import './Login.css';
import './app.css';

export default function Login({ setUser }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('patient');

    const handleLogin = async (e) => {
        e.preventDefault();
        const selectedRole = role.toLowerCase();

        // 1. Hardcoded Mock Logins (Staff)
        // --- DOCTOR ---
if (email === 'doctor@test.com' && password === 'd123') {
    const mockUser = { staff_id: 101, name: 'Dr. Sandun Jayasinghe', role: 'doctor', roles: ['doctor'], email };
    localStorage.setItem('hospital_user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success("Welcome, Doctor!");
    navigate('/doctor');
    return;
}

// --- PHARMACIST ---
if (email === 'pharm@test.com' && password === 'p123') {
    const mockUser = { staff_id: 99, name: 'Main Pharmacist', role: 'pharmacist', roles: ['pharmacist'], email };
    localStorage.setItem('hospital_user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success("Pharmacy Portal Active");
    navigate('/pharmacist');
    return;
}

// --- DIAGNOSTIC TECHNICIAN ---
if (email === 'diag@test.com' && password === 't123') {
    const mockUser = { staff_id: 88, name: 'Chief Technician', role: 'diagnostic', roles: ['diagnostic'], email };
    localStorage.setItem('hospital_user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success("Diagnostic Systems Online");
    navigate('/lab'); // Or '/diagnostic' depending on your route
    return;
}

// --- ADMIN ---
if (email === 'admin@test.com' && password === 'a123') {
    const mockUser = { staff_id: 1, name: 'System Admin', role: 'admin', roles: ['admin'], email };
    localStorage.setItem('hospital_user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success("Administrator Access Granted");
    navigate('/admin');
    return;
}

// --- RECEPTIONIST ---
if (email === 'recep@test.com' && password === 'r123') {
    const mockUser = { staff_id: 50, name: 'Reception Desk', role: 'receptionist', roles: ['receptionist'], email };
    localStorage.setItem('hospital_user', JSON.stringify(mockUser));
    setUser(mockUser);
    toast.success("Receptionist Dashboard Ready");
    
    // CHANGE THIS: From '/reception' to '/receptionist'
    navigate('/receptionist'); 
    return;
}
        // 2. Database Login for Patients/Other Staff
        try {
            const response = await fetch('http://localhost:5001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: email.trim(),
                    password: password.trim()
                })
            });

            const data = await response.json();

            if (data.success) {
                const userRoles = data.user.roles || [];

                // Check if user has permission for the chosen role
                if (!userRoles.includes(selectedRole)) {
                    toast.error(`This account is not registered as a ${selectedRole}.`);
                    return;
                }

                const completeUser = { ...data.user, role: selectedRole };
                
                if (setUser) setUser(completeUser);
                localStorage.setItem('hospital_user', JSON.stringify(completeUser));
                
                toast.success(`Logged in as ${selectedRole}`);
                navigate(`/${selectedRole}`);
            } else {
                toast.error(data.message || "Invalid credentials");
            }
        } catch (err) {
            console.error("Login Error:", err);
            toast.error("Server is not responding.");
        }
    }; // <-- CLOSES handleLogin properly

    // 3. The JSX Return (MUST be outside handleLogin)
    return (
        <div className="auth-page" style={{ backgroundImage: "url('/background.jpg')" }}>
            <div className="auth-card">
                <div className="login-brand">
                    <div className="brand-icon-box">
                        <Activity size={30} color="white" />
                    </div>
                    <div className="brand-text">
                        <h1 className="brand-title">SmartOPD</h1>
                        <p className="brand-subtitle">Base Hospital, Kiribathgoda</p>
                    </div>
                </div>

                <div className="login-form-card">
                    <form onSubmit={handleLogin}>
                        <div className="input-container">
                            <label className="input-label">Login As</label>
                            <div className="input-relative">
                                <User className="input-icon" size={20} />
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="patient">Patient</option>
                                     <option value="doctor">Doctor</option>
                                    <option value="receptionist">Receptionist</option>
                                    <option value="pharmacist">Pharmacist</option>
                                    <option value="lab">Diagnostics Technician</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div className="input-container">
                            <label className="input-label">Barcode ID or Email</label>
                            <div className="input-relative">
                                <Mail className="input-icon" size={20} />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="PAT-XXXX-XXXX or email"
                                    className="form-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-container">
                            <label className="input-label">Password</label>
                            <div className="input-relative">
                                <Lock className="input-icon" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="form-input"
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
                            <button type="button" className="forgot-link" onClick={() => navigate('/forgot-password')}>
                                Forgot Password?
                            </button>
                        </div>

                        <button type="submit" className="btn-login-action">Login</button>
                    </form>

                    <div className="register-prompt">
                        Don't have an account?{' '}
                        <button onClick={() => navigate('/register')} className="text-btn">
                            Register here
                        </button>
                    </div>
                </div>

                <div className="back-home-btn">
                    <button onClick={() => navigate('/')} className="text-btn" style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}