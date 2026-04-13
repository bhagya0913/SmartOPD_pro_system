import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Landing from './Landing';
import Login from './Login';
import Register from './Register';
import PatientDashboard from './PatientDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import AdminDashboard from './AdminDashboard';
import ForgotPassword from './ForgotPassword';
import DoctorDashboard from './DoctorDashboard';
import PharmacistDashboard from './PharmacistDashboard';
import LabDashboard from './LabDashboard';

function App() {
    // 1. Correct State Initialization (INSIDE the component)
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('hospital_user');
            // Ensure we only return parsed data if it exists
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
            return null;
        }
    });

    useEffect(() => {
        // This will help you see if 'user' disappears when you click a tab
        console.log("Current Auth State:", user);
    }, [user]);
    return (
        <Router>
            <Toaster position="top-center" reverseOrder={false} />
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login setUser={setUser} />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* FIXED REDIRECT LOGIC: 
                   We check 'user.role' (singular) because that is what your 
                   backend login route sends back.
                */}

                {/* Patient Route */}
                <Route path="/patient-dashboard/*" element={
                    user?.role?.toLowerCase() === 'patient' 
                    ? <PatientDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/" replace />
                } />

                {/* Doctor Route */}
                <Route path="/doctor-dashboard/*" element={
                    user?.role?.toLowerCase() === 'doctor' 
                    ? <DoctorDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/login" replace />
                } />

                {/* Admin Route */}
                <Route path="/admin-dashboard/*" element={
                    user?.role?.toLowerCase() === 'admin' 
                    ? <AdminDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/login" replace />
                } />

                {/* Receptionist Route */}
                <Route path="/receptionist-dashboard/*" element={
                    user?.role?.toLowerCase() === 'receptionist' 
                    ? <ReceptionistDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/login" replace />
                } />

                {/* Pharmacist Route */}
                <Route path="/pharmacist-dashboard/*" element={
                    user?.role?.toLowerCase() === 'pharmacist' 
                    ? <PharmacistDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/login" replace />
                } />

                {/* Lab Technician Route */}
                <Route path="/lab-dashboard/*" element={
                    (user?.role?.toLowerCase() === 'lab' || user?.role?.toLowerCase() === 'diagnostics technician')
                    ? <LabDashboard user={user} setUser={setUser} /> 
                    : <Navigate to="/login" replace />
                } />

                {/* Global Redirect: If no route matches, go home */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;