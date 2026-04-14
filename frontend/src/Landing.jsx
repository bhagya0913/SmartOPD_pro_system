import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Calendar, Clock, FileText, Users, Phone, MapPin, Mail } from 'lucide-react';
import './Landing.css';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header>
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="logo-container">
                                <Activity className="w-7 h-7 text-white" />
                            </div>
                            <div className="logo-text">
                                <h1>SmartOPD</h1>
                                <p>Base Hospital, Kiribathgoda</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="btn btn-outline"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/register')}
                                className="btn btn-primary"
                            >
                                Register Patient
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-4 py-16 w-full">
                <div className="text-center mb-12">
                    <h2 className="hero-title">
                        SmartOPD System
                    </h2>
                    <p className="hero-subtitle">
                        Experience a seamless healthcare journey. Book appointments, and access your medical records instantly.
                    </p>
                </div>

                {/* Services Grid */}
                {/*<div className="services-grid">
                    <div className="glass-card">
                        <div className="icon-box blue">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <h3 className="card-title">Book Appointments</h3>
                        <p className="card-desc">Schedule your OPD appointments online anytime, anywhere. Skip the early morning queues.</p>
                    </div>

                    <div className="glass-card">
                        <div className="icon-box green">
                            <Clock className="w-6 h-6" />
                        </div>
                        <h3 className="card-title">Patient Portal</h3>
                        <p className="card-desc">Access your personal dashboard to view appointments, medical records, and manage your healthcare easily.</p>
                    </div>

                    <div className="glass-card">
                        <div className="icon-box purple">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="card-title">Digital Records</h3>
                        <p className="card-desc">Securely access your medical history, prescriptions, and lab reports from your dashboard.</p>
                    </div>

                    <div className="glass-card">
                        <div className="icon-box orange">
                            <Users className="w-6 h-6" />
                        </div>
                        <h3 className="card-title">Staff Portal</h3>
                        <p className="card-desc">Dedicated high-performance interface for Doctors, Pharmacists, and Hospital Staff.</p>
                    </div>
                </div>*/}

                {/* Hospital Information */}
                <div className="info-section">
                    <h3 className="text-2xl font-bold mb-2 border-b pb-4">Contact Information</h3>
                    <p className="text-text-muted mb-6" style={{ color: 'var(--text-muted)' }}>Get in touch with us anytime</p>
                    <div className="info-grid">
                        <div className="info-item">
                            <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                            <div className="info-content">
                                <h4>Address</h4>
                                <p>Makola Road, Kiribathgoda<br />Sri Lanka</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <Phone className="w-5 h-5 text-blue-600 mt-1" />
                            <div className="info-content">
                                <h4>Emergency & General</h4>
                                <p>+94 11 291 1261<br />Emergency: 1990</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <Mail className="w-5 h-5 text-blue-600 mt-1" />
                            <div className="info-content">
                                <h4>Email Support</h4>
                                <p>info@kiribathgoda.health.gov.lk</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer>
                <div className="max-w-7xl mx-auto px-4">
                    <p>© 2026 SmartOPD System - Base Hospital, Kiribathgoda. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}