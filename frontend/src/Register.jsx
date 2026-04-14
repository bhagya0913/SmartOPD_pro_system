import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, User, Mail, Phone, Lock, CreditCard,
    Calendar, Eye, EyeOff, Loader2, MapPin,
    ShieldCheck, CheckCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Register.css';
import Barcode from 'react-barcode';

// ── Password Strength Helper ──────────────────────────────────────────────────
function getPasswordStrength(password) {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8)           score++;
    if (password.length >= 12)          score++;
    if (/[A-Z]/.test(password))         score++;
    if (/[0-9]/.test(password))         score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;
    if (score <= 1) return { score, label: 'Weak',       color: '#ef4444' };
    if (score <= 2) return { score, label: 'Fair',       color: '#f97316' };
    if (score <= 3) return { score, label: 'Good',       color: '#eab308' };
    if (score <= 4) return { score, label: 'Strong',     color: '#22c55e' };
    return           { score, label: 'Very Strong', color: '#10b981' };
}

// ── OTP Modal (email only) ───────────────────────────────────────────────────
function OtpModal({ contactValue, onVerified, onClose, registering }) {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const handleVerify = async () => {
        if (otp.length !== 6) return toast.error('Please enter the 6-digit code.');
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/verify-registration-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: contactValue, otp })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Verified successfully!');
                onVerified();
            } else {
                toast.error(data.message || 'Invalid or expired code. Try again.');
            }
        } catch {
            toast.error('Verification failed. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            const res = await fetch('http://localhost:5001/api/send-registration-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: contactValue })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('New code sent!');
                setOtp('');
            } else {
                toast.error(data.error || 'Failed to resend. Try again.');
            }
        } catch {
            toast.error('Could not resend. Check your connection.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-box otp-modal">
                {!registering && (
                    <button className="modal-close-btn" onClick={onClose} title="Cancel">
                        <X size={20} />
                    </button>
                )}

                <div className="modal-icon-ring">
                    <ShieldCheck size={36} color="#2563eb" />
                </div>

                <h3 className="modal-title">Verify Your Email</h3>

                <p className="modal-subtitle">
                    We've sent a 6-digit code to<br />
                    <strong>{contactValue}</strong>
                </p>

                {!registering && (
                    <div className="otp-input-row">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <input
                                key={i}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                className="otp-box"
                                value={otp[i] || ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    const arr = otp.split('');
                                    arr[i] = val;
                                    const next = arr.join('').slice(0, 6);
                                    setOtp(next);
                                    if (val && i < 5) {
                                        document.querySelectorAll('.otp-box')[i + 1]?.focus();
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Backspace' && !otp[i] && i > 0) {
                                        document.querySelectorAll('.otp-box')[i - 1]?.focus();
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}

                {registering ? (
                    <div className="otp-registering-state">
                        <Loader2 className="spinner" size={36} color="#2563eb" />
                        <p className="otp-registering-title">Creating your account…</p>
                        <p className="otp-registering-sub">Please wait, this only takes a moment</p>
                    </div>
                ) : (
                    <>
                        <button
                            className="btn-verify-otp"
                            onClick={handleVerify}
                            disabled={loading || otp.length < 6}
                        >
                            {loading
                                ? <><Loader2 className="spinner" size={18} /> Verifying…</>
                                : 'Confirm & Register'}
                        </button>

                        <p className="modal-resend">
                            Didn't receive it?{' '}
                            <button className="resend-link" onClick={handleResend} disabled={resending}>
                                {resending ? 'Sending…' : 'Resend Code'}
                            </button>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Barcode Success Modal ─────────────────────────────────────────────────────
function BarcodeModal({ patientId, barcode, onGoToLogin }) {
    return (
        <div className="modal-overlay">
            <div className="modal-box barcode-modal">
                <div className="barcode-success-icon">
                    <CheckCircle size={52} color="#10b981" />
                </div>

                <h3 className="modal-title" style={{ color: '#10b981', fontSize: '1.4rem' }}>
                    Registration Successful!
                </h3>
                <p className="modal-subtitle">
                    Welcome to SmartOPD. Your account is ready.
                </p>

                <div className="barcode-id-card">
                    <p className="barcode-info-label">Your Patient ID</p>
                    <p className="barcode-patient-id">{patientId}</p>
                    <p className="barcode-id-hint">Quote this at reception if barcode is unavailable</p>
                </div>

                <div className="barcode-display-box">
                    <p className="barcode-info-label" style={{ marginBottom: '14px' }}>Your Patient Barcode</p>
                    <div className="barcode-image-wrap">
                        <Barcode
                            value={barcode}
                            width={1.8}
                            height={80}
                            fontSize={13}
                            margin={10}
                            background="#ffffff"
                            lineColor="#0f172a"
                            displayValue={true}
                        />
                    </div>
                </div>

                <div className="barcode-tip-box">
                    📋 <strong>Screenshot or save this screen.</strong> Show the barcode at hospital reception — the receptionist will scan it to access your records instantly.
                </div>

                <p className="barcode-email-note">
                    A copy with your barcode has been sent to your email address.
                </p>

                <button className="btn-go-login" onClick={onGoToLogin}>
                    Proceed to Login →
                </button>
            </div>
        </div>
    );
}

// ── Main Register Component (email only) ──────────────────────────────────────
export default function Register() {
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [modalState, setModalState] = useState(null); // null | 'otp' | 'barcode'
    const [registeredData, setRegisteredData] = useState({ patientId: '', barcode: '' });

    const [formData, setFormData] = useState({
        full_name: '',
        nic: '',
        dob: '',
        phone: '',
        email: '',
        gender: '',
        address: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const strength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

    // ── Validation (email required, phone optional) ───────────────────────────
    const validateForm = () => {
        const { full_name, nic, dob, gender, address, email, password, confirmPassword } = formData;

        if (full_name.trim().length < 3)
            return toast.error('Full name is too short.'), false;

        const nicRegex = /^(?:19|20)?\d{10}$|^\d{9}[vVxX]$/;
        if (!nicRegex.test(nic))
            return toast.error('Invalid NIC format.'), false;

        if (!dob)
            return toast.error('Please select your date of birth.'), false;

        if (!gender)
            return toast.error('Please select your gender.'), false;

        if (address.trim().length < 5)
            return toast.error('Please enter a valid address.'), false;

        if (!email || !email.includes('@'))
            return toast.error('Please enter a valid email address.'), false;

        if (strength.score < 2)
            return toast.error('Password is too weak.'), false;

        if (password !== confirmPassword)
            return toast.error('Passwords do not match!'), false;

        return true;
    };

    // ── Submit: send OTP to email ────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/send-registration-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Verification code sent to ${formData.email}`);
                setModalState('otp');
            } else {
                toast.error(data.error || 'Failed to send OTP.');
            }
        } catch {
            toast.error('Server connection failed. Is your backend running?');
        } finally {
            setLoading(false);
        }
    };

    // ── After OTP confirmed: register the patient ────────────────────────────
    const handleOtpVerified = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData }) // contactMethod removed
            });
            const data = await res.json();
            if (data.success) {
                setRegisteredData({ patientId: data.patientId, barcode: data.barcode });
                setModalState('barcode');
            } else {
                toast.error(data.message || 'Registration failed.');
                setModalState(null);
            }
        } catch {
            toast.error('Connection lost. Please check your backend.');
            setModalState(null);
        } finally {
            setLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="register-screen" style={{ backgroundImage: "url('/background.jpg')" }}>
            {/* OTP modal */}
            {modalState === 'otp' && (
                <OtpModal
                    contactValue={formData.email}
                    onVerified={handleOtpVerified}
                    onClose={() => setModalState(null)}
                    registering={loading}
                />
            )}

            {/* Barcode success modal */}
            {modalState === 'barcode' && (
                <BarcodeModal
                    patientId={registeredData.patientId}
                    barcode={registeredData.barcode}
                    onGoToLogin={() => navigate('/login')}
                />
            )}

            <div className="register-container">
                <div className="reg-brand">
                    <div className="reg-logo-box"><Activity size={36} color="white" /></div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: '0' }}>SmartOPD</h1>
                    <p style={{ color: '#4b5563' }}>Base Hospital, Kiribathgoda</p>
                </div>

                <div className="reg-card">
                    <h2 className="reg-title">Patient Registration</h2>

                    <form onSubmit={handleSubmit}>
                        <div className="reg-form-grid">
                            {/* Email (required) */}
                            <div className="input-block">
                                <label className="input-label">Email Address</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={20} />
                                    <input type="email" name="email" value={formData.email}
                                        onChange={handleChange} placeholder="your@email.com"
                                        className="reg-input" required />
                                </div>
                            </div>

                            {/* Full Name */}
                            <div className="input-block">
                                <label className="input-label">Full Name</label>
                                <div className="input-wrapper">
                                    <User className="input-icon" size={20} />
                                    <input type="text" name="full_name" value={formData.full_name}
                                        onChange={handleChange} placeholder="As per NIC"
                                        className="reg-input" required />
                                </div>
                            </div>

                            {/* NIC */}
                            <div className="input-block">
                                <label className="input-label">NIC Number</label>
                                <div className="input-wrapper">
                                    <CreditCard className="input-icon" size={20} />
                                    <input type="text" name="nic" value={formData.nic}
                                        onChange={handleChange} placeholder="199012345678 or 901234567V"
                                        className="reg-input" required />
                                </div>
                            </div>

                            {/* Date of Birth */}
                            <div className="input-block">
                                <label className="input-label">Date of Birth</label>
                                <div className="input-wrapper">
                                    <Calendar className="input-icon" size={20} />
                                    <input type="date" name="dob" value={formData.dob}
                                        onChange={handleChange} className="reg-input" required />
                                </div>
                            </div>

                            {/* Gender */}
                            <div className="input-block">
                                <label className="input-label">Gender</label>
                                <select className="reg-input" name="gender" value={formData.gender}
                                    onChange={handleChange} style={{ paddingLeft: '1rem' }} required>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Phone (optional) */}
                            <div className="input-block">
                                <label className="input-label">
                                    Phone Number <span className="optional-tag">(optional)</span>
                                </label>
                                <div className="input-wrapper">
                                    <Phone className="input-icon" size={20} />
                                    <input type="tel" name="phone" value={formData.phone}
                                        onChange={handleChange} placeholder="0712345678"
                                        className="reg-input" />
                                </div>
                            </div>

                            {/* Address (full width) */}
                            <div className="input-block" style={{ gridColumn: '1 / -1' }}>
                                <label className="input-label">Address</label>
                                <div className="input-wrapper">
                                    <MapPin className="input-icon" size={20}
                                        style={{ top: '14px', transform: 'none' }} />
                                    <textarea name="address" value={formData.address}
                                        onChange={handleChange}
                                        placeholder="No. 12, Main Street, Kiribathgoda"
                                        className="reg-input reg-textarea" rows={3} required />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="input-block">
                                <label className="input-label">Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={20} />
                                    <input type={showPassword ? 'text' : 'password'}
                                        name="password" value={formData.password}
                                        onChange={handleChange} placeholder="Create password"
                                        className="reg-input" required />
                                    <button type="button" className="reg-eye-icon"
                                        onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {formData.password.length > 0 && (
                                    <div className="password-strength">
                                        <div className="strength-bars">
                                            {[1, 2, 3, 4, 5].map((bar) => (
                                                <div key={bar} className="strength-bar" style={{
                                                    backgroundColor: bar <= strength.score
                                                        ? strength.color : '#e5e7eb',
                                                    transition: 'background-color 0.3s ease'
                                                }} />
                                            ))}
                                        </div>
                                        <span className="strength-label" style={{ color: strength.color }}>
                                            {strength.label}
                                        </span>
                                    </div>
                                )}
                                {formData.password.length > 0 && strength.score < 3 && (
                                    <p className="strength-hint">
                                        Tip: Use uppercase, numbers &amp; symbols.
                                    </p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="input-block">
                                <label className="input-label">Confirm Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={20} />
                                    <input type={showConfirmPassword ? 'text' : 'password'}
                                        name="confirmPassword" value={formData.confirmPassword}
                                        onChange={handleChange} placeholder="Repeat password"
                                        className="reg-input" required />
                                    <button type="button" className="reg-eye-icon"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {formData.confirmPassword.length > 0 && (
                                    <p style={{
                                        fontSize: '0.75rem', marginTop: '4px',
                                        color: formData.password === formData.confirmPassword
                                            ? '#10b981' : '#ef4444'
                                    }}>
                                        {formData.password === formData.confirmPassword
                                            ? '✓ Passwords match'
                                            : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button type="submit" className="btn-reg-action" disabled={loading}>
                            {loading
                                ? <><Loader2 className="spinner" size={18} /> Sending Code…</>
                                : 'Register Account'}
                        </button>
                    </form>

                    <div className="reg-footer">
                        Already have an account?{' '}
                        <button onClick={() => navigate('/login')} className="reg-link-btn">
                            Login here
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}