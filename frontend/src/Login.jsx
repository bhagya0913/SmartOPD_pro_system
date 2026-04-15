import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import './Login.css';

export default function Login({ setUser }) {
    const navigate = useNavigate();
    const [email,          setEmail]          = useState('');
    const [password,       setPassword]       = useState('');
    const [role,           setRole]           = useState('patient');
    const [showPassword,   setShowPassword]   = useState(false);
    const [loading,        setLoading]        = useState(false);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [pendingUser,    setPendingUser]    = useState(null);

    // ── Route map ─────────────────────────────────────────────────────────────
    // Maps any casing variant of a role label → dashboard path
    const navigateToDashboard = (roleLabel) => {
        const routes = {
            'admin':                  '/admin-dashboard',
            'doctor':                 '/doctor-dashboard',
            'pharmacist':             '/pharmacist-dashboard',
            'receptionist':           '/receptionist-dashboard',
            'diagnostics technician': '/lab-dashboard',
            'lab':                    '/lab-dashboard',
            'patient':                '/patient-dashboard',
        };
        navigate(routes[(roleLabel || '').toLowerCase()] || '/patient-dashboard');
    };

    const completeLogin = (userObj, selectedRole) => {
        const userWithRole = { ...userObj, role: userObj.role || selectedRole };
        if (setUser) setUser(userWithRole);
        localStorage.setItem('hospital_user', JSON.stringify(userWithRole));
        toast.success(`Welcome, ${userObj.full_name || userObj.username}!`);
        navigateToDashboard(userObj.role || selectedRole);
    };

    // FIX: Added welcome toast; role passed directly from picker selection
    const handleRoleSelect = (chosenRole) => {
        if (!pendingUser) return;
        const user = { ...pendingUser, role: chosenRole };
        if (setUser) setUser(user);
        localStorage.setItem('hospital_user', JSON.stringify(user));
        setShowRolePicker(false);
        setPendingUser(null);
        toast.success(`Welcome, ${user.full_name || user.username}!`);
        navigateToDashboard(chosenRole);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const selectedRole = role.toLowerCase();

        if (!email.trim()) {
            toast.error('Please enter your username or email.');
            return;
        }

        setLoading(true);

        // ── HARDCODED STAFF LOGINS (development / demo) ──────────────────────
        // NOTE: These must stay in sync with the backend devLogins.
        //       Remove both sets before going to production.
        const devLogins = {
            'admin':                { pass: 'admin', role: 'admin',        id: 1,   label: 'Admin' },
            'doctor@test.com':      { pass: 'd123',  role: 'doctor',       id: 999, label: 'Doctor' },
            'pharmacist@test.com':  { pass: 'p123',  role: 'pharmacist',   id: 998, label: 'Pharmacist' },
            'reception@test.com':   { pass: 'r123',  role: 'receptionist', id: 997, label: 'Receptionist' },
            'lab@test.com':         { pass: 'l123',  role: 'lab',          id: 996, label: 'Diagnostics Technician' },
            'admin@test.com':       { pass: 'a123',  role: 'admin',        id: 1,   label: 'Admin' },
        };

        const devMatch = devLogins[email.toLowerCase()];
        if (devMatch) {
            if (password !== devMatch.pass) {
                setLoading(false);
                return toast.error('Incorrect password.');
            }
            if (selectedRole !== devMatch.role) {
                setLoading(false);
                return toast.error(`This account is registered as ${devMatch.label}. Please select that role.`);
            }
            completeLogin({ id: devMatch.id, username: email, role: devMatch.role }, selectedRole);
            setLoading(false);
            return;
        }

        // ── DATABASE LOGIN ────────────────────────────────────────────────────
        // FIX: Added AbortController to prevent infinite spinner on server hang
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 10000); // 10 s timeout

        try {
            const response = await fetch('http://localhost:5001/api/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    username:     email.trim(),
                    password:     password.trim(),
                    selectedRole,           // FIX: send selected role to backend
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!data.success) {
                toast.error(data.message || 'Login failed.');
                setLoading(false);
                return;
            }

            if (data.requiresRoleSelection) {
                // FIX: Guard against missing / empty availableRoles before showing picker
                if (!Array.isArray(data.user?.availableRoles) || data.user.availableRoles.length === 0) {
                    toast.error('Unable to determine account roles. Contact support.');
                    setLoading(false);
                    return;
                }
                setPendingUser(data.user);
                setShowRolePicker(true);
                setLoading(false);
                return;
            }

            // Single-role — validate that the selected role matches the server role
            const serverRoleToSelectValue = {
                'patient':                'patient',
                'doctor':                 'doctor',
                'receptionist':           'receptionist',
                'pharmacist':             'pharmacist',
                'diagnostics technician': 'lab',
                'admin':                  'admin',
            };

            const serverRole       = (data.user.role || '').toLowerCase();
            const mappedServerRole = serverRoleToSelectValue[serverRole] || serverRole;

            if (mappedServerRole !== selectedRole) {
                toast.error(`Account is registered as "${data.user.role}". Please select the correct role.`);
                setLoading(false);
                return;
            }

            completeLogin(data.user, selectedRole);

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                toast.error('Request timed out. Please try again.');
            } else {
                console.error('Login Error:', err);
                toast.error('Unable to reach the server. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                {/* Brand Header */}
                <div className="login-brand">
                    <div className="brand-icon-box">
                        <Activity size={36} strokeWidth={2.5} color="white" />
                    </div>
                    <h1 className="brand-title">SmartOPD</h1>
                    <p className="brand-subtitle">Base Hospital, Kiribathgoda</p>
                </div>

                {/* Login Form */}
                <div className="login-form-card">
                    <form onSubmit={handleLogin} noValidate>

                        {/* Role Select */}
                        <div className="input-container">
                            <label className="input-label">I am a…</label>
                            <div className="input-relative">
                                <User className="input-icon" size={18} />
                                <select
                                    value={role}
                                    onChange={e => setRole(e.target.value)}
                                    className="form-select"
                                    disabled={loading}
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

                        {/* Username / Email */}
                        <div className="input-container">
                            <label className="input-label">Username or Email</label>
                            <div className="input-relative">
                                <Mail className="input-icon" size={18} />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="form-input"
                                    placeholder="Enter username or email"
                                    autoComplete="username"
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="input-container">
                            <label className="input-label">Password</label>
                            <div className="input-relative">
                                <Lock className="input-icon" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="form-input form-input--password"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    disabled={loading}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot Password */}
                        <div className="forgot-link">
                            <button
                                type="button"
                                onClick={() => navigate('/forgot-password')}
                                className="text-btn-small"
                                disabled={loading}
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {/* Submit */}
                        <button type="submit" className="btn-login-action" disabled={loading}>
                            {loading ? (
                                <span className="login-spinner-row">
                                    <span className="login-spinner" /> Signing in…
                                </span>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* Register Prompt */}
                    <div className="register-prompt">
                        New to SmartOPD?
                        <button
                            onClick={() => navigate('/register')}
                            className="text-btn"
                            disabled={loading}
                        >
                            Create Account
                        </button>
                    </div>

                    {/* Home Button */}
                    <div className="home-button-container">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="btn-home"
                            disabled={loading}
                        >
                            ← Back to Home
                        </button>
                    </div>
                </div>
            </div>

            {/* Role picker modal — only shown for multi-role accounts */}
            {/* FIX: Guard with availableRoles existence check */}
            {showRolePicker && pendingUser && Array.isArray(pendingUser.availableRoles) && pendingUser.availableRoles.length > 0 && (
                <div className="modal-overlay">
                    <div className="modal-box" style={{ maxWidth: '380px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👤</div>
                            <h3 style={{ margin: 0 }}>Choose how to log in</h3>
                            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '6px 0 0' }}>
                                Your account has multiple roles
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {pendingUser.availableRoles.map(r => (
                                <button
                                    key={r}
                                    onClick={() => handleRoleSelect(r)}
                                    style={{
                                        padding: '14px 20px',
                                        borderRadius: '10px',
                                        border: '2px solid #e2e8f0',
                                        background: 'white',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                                >
                                    {r.toLowerCase() === 'patient' ? '🏥 Patient Dashboard' : `🩺 ${r} Dashboard`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}