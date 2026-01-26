import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Calendar, Clock, FileText, Users, Phone, MapPin, Mail } from 'lucide-react';
import './Landing.css';
export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Activity className="w-7 h-7 text-white" />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">SmartOPD</h1>
                                <p className="text-sm text-gray-600">Base Hospital, Kiribathgoda</p>
                            </div>
                        </div>

                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                                Welcome to SmartOPD
                            </h2>
                            {/* Using a span with a top margin gives you total control */}
                            <span className="block text-xl text-gray-600 mt-1 typewriter-text">
                                Modern Out-Patient Department Management Service
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-6 py-2.5 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/register')}
                                className="px-6 py-2.5 bg-blue-500 text-white font-medium hover:bg-blue-600 rounded-lg transition-colors shadow-sm"
                            >
                                Register
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">


                {/* Services Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                            <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">Book Appointments</h3>
                        <p className="text-gray-600 text-sm">Schedule your OPD appointments online and avoid long queues</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                            <Clock className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">Queue Management</h3>
                        <p className="text-gray-600 text-sm">View your queue number and estimated waiting time in real-time</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                            <FileText className="w-6 h-6 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">Digital Records</h3>
                        <p className="text-gray-600 text-sm">Access your medical records, prescriptions and lab results online</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                            <Users className="w-6 h-6 text-orange-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2">Multi-Role Access</h3>
                        <p className="text-gray-600 text-sm">Secure access for patients, doctors, staff and administrators</p>
                    </div>
                </div>

                {/* Hospital Info */}
                <div className="bg-white rounded-xl shadow-sm p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Hospital Information</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Address</h4>
                                <p className="text-gray-600">Makola Road, Kiribathgoda<br />Sri Lanka</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-blue-600 mt-1" />
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Contact</h4>
                                <p className="text-gray-600">+94 11 291 1261<br />Emergency: 1990</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-blue-600 mt-1" />
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
                                <p className="text-gray-600">info@kiribathgoda.health.gov.lk</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <p className="text-center text-gray-600">
                        © 2026 SmartOPD - Base Hospital, Kiribathgoda. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}