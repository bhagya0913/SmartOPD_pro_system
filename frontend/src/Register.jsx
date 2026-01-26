import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, User, Mail, Phone, Lock, CreditCard, Calendar } from 'lucide-react';
import './Register.css';

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        first_name: '',
        surname: '',
        nic: '',
        dob: '',
        phone: '',
        email: '',
        gender: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Client-side validation
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        if (!formData.first_name || !formData.surname || !formData.email || !formData.nic) {
            alert("Please fill in all required fields");
            return;
        }

        try {
            // Use 127.0.0.1 or localhost (ensure this matches your server.js port)
            const response = await fetch('http://localhost:5001/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    first_name: formData.first_name,
                    surname: formData.surname,
                    nic: formData.nic,
                    dob: formData.dob,
                    gender: formData.gender,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password // Backend will split this to user_account
                })
            });

            const data = await response.json();

            if (data.success) {
                // SUCCESS: Notify and Redirect
                alert(`Registration Successful! \nYour Barcode: ${data.barcode}\nPlease use your email or barcode to login.`);
                
                // This is what was missing!
                navigate('/login'); 
            } else {
                // Handle "NIC already exists" or other backend errors
                alert(data.message || "Registration failed. Please try again.");
            }
        } catch (err) {
            console.error("Connection Error:", err);
            alert("Server is not responding. Please check if your backend is running.");
        }
    };

    return (
        <div className="register-screen">
            <div className="register-container">
                <div className="reg-brand">
                    <div className="reg-logo-box">
                        <Activity size={36} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: '0 0 0.5rem' }}>SmartOPD</h1>
                    <p style={{ color: '#4b5563' }}>Base Hospital, Kiribathgoda</p>
                </div>

                <div className="reg-card">
                    <h2 className="reg-title">Patient Registration</h2>

                    <form onSubmit={handleSubmit}>
                        <div className="reg-form-grid">
                            <div className="input-group">
                                <div className="input-block">
                                    <label className="input-label">First Name</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={20} />
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            placeholder="First name"
                                            className="reg-input"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-block">
                                    <label className="input-label">Surname</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={20} />
                                        <input
                                            type="text"
                                            name="surname"
                                            value={formData.surname}
                                            onChange={handleChange}
                                            placeholder="Surname"
                                            className="reg-input"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">NIC Number</label>
                                <div className="input-wrapper">
                                    <CreditCard className="input-icon" size={20} />
                                    <input
                                        type="text"
                                        name="nic"
                                        value={formData.nic}
                                        onChange={handleChange}
                                        placeholder="e.g., 199012345678"
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Date of Birth</label>
                                <div className="input-wrapper">
                                    <Calendar className="input-icon" size={20} />
                                    <input
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleChange}
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Gender</label>
                                <select
                                    className="reg-input"
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    style={{ paddingLeft: '1rem' }} 
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Phone Number</label>
                                <div className="input-wrapper">
                                    <Phone className="input-icon" size={20} />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="+94 71 234 5678"
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Email Address</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={20} />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="your@email.com"
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={20} />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Create password"
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block">
                                <label className="input-label">Confirm Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={20} />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirm password"
                                        className="reg-input"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="terms-wrapper">
                            <input type="checkbox" id="terms" required />
                            <label htmlFor="terms" style={{ fontSize: '0.875rem', color: '#4b5563', marginLeft: '8px' }}>
                                I agree to the terms and conditions and consent to the use of my medical data for treatment purposes.
                            </label>
                        </div>

                        <button type="submit" className="btn-reg-action">Register</button>
                    </form>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <p style={{ color: '#4b5563', fontSize: '0.875rem' }}>
                            Already have an account?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Login here
                            </button>
                        </p>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}