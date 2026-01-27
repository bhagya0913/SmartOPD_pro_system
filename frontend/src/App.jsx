import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Landing from './Landing';
import Login from './Login';
import Register from './Register';
import PatientDashboard from './PatientDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import AdminDashboard from './AdminDashboard'; // MISSING IMPORT ADDED
import ForgotPassword from './ForgotPassword';
import DoctorDashboard from './DoctorDashboard'; // Ensure the path is correct!
import PharmacistDashboard from './PharmacistDashboard';
import LabDashboard from './LabDashboard';


function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hospital_user');
    return saved ? JSON.parse(saved) : null;
  });
  React.useEffect(() => {
    console.log("Logged in User Data:", user);
  }, [user]);

  

  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        
        {/* 1. Public Routes (Anyone can see these) */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Dynamic Role Based Routing */}

        {/* Patient Route */}
        <Route path="/patient/*" element={
          (user?.roles?.includes('patient') && user?.role === 'patient')
            ? <PatientDashboard user={user} setUser={setUser} />
            : <Navigate to="/" />
        } />

        {/* Doctor Route */}
        <Route path="/doctor/*" element={
          (user?.roles?.includes('doctor') && user?.role === 'doctor')
            ? <DoctorDashboard user={user} setUser={setUser} />
            : <Navigate to="/" />
        } />

        {/* Admin Route */}
        <Route path="/admin/*" element={
          user?.roles?.includes('admin') ? <AdminDashboard user={user} setUser={setUser} /> : <Navigate to="/" />
        } />

      {/* Receptionist Protected Route */}
<Route 
  path="/receptionist/*" 
  element={
    (user?.role === 'receptionist' || user?.roles?.includes('receptionist')) ? (
      <ReceptionistDashboard user={user} setUser={setUser} />
    ) : (
      <Navigate to="/login" replace />
    )
  } 
/>

        {/* Pharmacist Route */}
        <Route path="/pharmacist/*" element={
          (user?.role?.toLowerCase() === 'pharmacist' || user?.roles?.includes('pharmacist'))
            ? <PharmacistDashboard user={user} setUser={setUser} /> 
            : <Navigate to="/login" replace />
        } />

        {/* Lab Technician Protected Route */}
{/* Lab Technician Protected Route */}
<Route 
  path="/lab/*" 
  element={
    (user?.role === 'diagnostic' || user?.roles?.includes('diagnostic')) ? (
      <LabDashboard user={user} setUser={setUser} />
    ) : (
      // If the role isn't 'diagnostic', it redirects here
      <Navigate to="/login" replace />
    )
  } 
/>
       

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;