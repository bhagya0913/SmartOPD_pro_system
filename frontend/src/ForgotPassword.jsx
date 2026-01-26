import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ForgotPassword.css'; // Remove Login.css and use this

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState(1); // 1: Email, 2: Token, 3: Reset
    const navigate = useNavigate();

    const handleRequest = async (e) => {
        if (e) e.preventDefault();
        try {
            const res = await fetch('http://127.0.0.1:5001/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                if (step === 1) setStep(2);
                alert("Code sent to your email!");
            } else { alert(data.message); }
        } catch (err) { alert("Server error"); }
    };

    const handleVerifyToken = (e) => {
        e.preventDefault();
        if (token.length === 6) {
            setStep(3); // Move to password entry
        } else {
            alert("Please enter a valid 6-digit code.");
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }
        try {
            const res = await fetch('http://127.0.0.1:5001/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                alert("Password Updated! Please login.");
                navigate('/login');
            } else { alert(data.message); }
        } catch (err) { alert("Server error"); }
    };

    return (
    <div className="forgot-password-container">
        <div className="forgot-password-card">
            {/* Step Indicator Dots */}
            <div className="step-indicator">
                <div className={`dot ${step >= 1 ? 'active' : ''}`}></div>
                <div className={`dot ${step >= 2 ? 'active' : ''}`}></div>
                <div className={`dot ${step >= 3 ? 'active' : ''}`}></div>
            </div>

            {step === 1 && (
                <form onSubmit={handleRequest}>
                    <h2 className="form-title">Find Your Account</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
                        Enter your email to receive a 6-digit reset code.
                    </p>
                    <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
                    <button type="submit" className="btn-login-action">Send Code</button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={handleVerifyToken}>
                    <h2 className="form-title">Enter Code</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
                        We sent a code to <br/><strong>{email}</strong>
                    </p>
                    <input type="text" maxLength="6" placeholder="000000" value={token} onChange={(e) => setToken(e.target.value)} className="form-input token-input" required />
                    <button type="submit" className="btn-login-action">Verify & Continue</button>
                    <div className="resend-container">
                        Didn't get it? <button type="button" onClick={handleRequest} className="resend-btn">Resend Code</button>
                    </div>
                </form>
            )}

            {step === 3 && (
                <form onSubmit={handleReset}>
                    <h2 className="form-title">New Password</h2>
                    <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>Create a strong password you haven't used before.</p>
                    <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" required />
                    <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" required />
                    <button type="submit" className="btn-login-action">Reset Password</button>
                </form>
            )}

            <button onClick={() => navigate('/login')} className="back-to-login" style={{border:'none', background:'none', width:'100%'}}>
                ← Back to Login
            </button>
        </div>
    </div>
);
}