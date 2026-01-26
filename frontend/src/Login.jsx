import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import './Login.css';
import './app.css';

export default function Login({ setUser }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('patient');

    // Inside Login.jsx - Update this function:

    // Replace your handleLogin function inside Login.jsx with this:

    const handleLogin = async (e) => {
    e.preventDefault();
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
            const userRoles = data.user.roles; // e.g., ['doctor', 'patient']

            // --- CRITICAL CHANGE START ---
            // Check if the role you selected in the dropdown (the 'role' state) 
            // is actually allowed for this user.
            const selectedRole = role.toLowerCase(); 

            if (!userRoles.includes(selectedRole)) {
                alert(`This account is not registered as a ${selectedRole}.`);
                return;
            }

            const completeUser = {
                ...data.user,
                // Override the primary role with what the user CHOSE to log in as
                role: selectedRole 
            };
            // --- CRITICAL CHANGE END ---

            if (setUser) setUser(completeUser);
            localStorage.setItem('hospital_user', JSON.stringify(completeUser));

            // Redirect based on the SELECTED role, not just priority
            navigate(`/${selectedRole}`); 
            
        } else {
            alert(data.message || "Invalid credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("Server is not responding.");
    }
};

    return (
    <div className="auth-page"> {/* This holds the background image */}
        <div className="auth-card"> {/* This is your wide, glass card */}
            <div className="background-decor">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
            </div>

            {/* Brand Header */}
            <div className="login-brand">
                <div className="brand-icon-box">
                    <Activity size={36} color="white" />
                </div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: '0.5rem 0' }}>SmartOPD</h1>
                <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>Base Hospital, Kiribathgoda</p>
            </div>

            {/* Form Section */}
            <div className="login-form-card">
                <h2 className="form-title">Login</h2>

                <form onSubmit={handleLogin}>
                    {/* Role Selection */}
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
                                <option value="receptionist">Receptionist</option>
                                <option value="doctor">Doctor</option>
                                <option value="pharmacist">Pharmacist</option>
                                <option value="lab">Lab Technician</option>
                                <option value="specialist">Specialist Consultant</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                    </div>

                    {/* Email/Barcode Input */}
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

                    {/* Password Input */}
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
                        <button
                            type="button"
                            className="forgot-link"
                            onClick={() => navigate('/forgot-password')}
                        >
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

            <div className="back-home-btn" style={{ marginTop: '1.5rem' }}>
                <button onClick={() => navigate('/')} className="text-btn" style={{ color: '#6b7280' }}>
                    ← Back to Home
                </button>
            </div>
        </div>
    </div>
);
}