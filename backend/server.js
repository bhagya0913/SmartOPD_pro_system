require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, initDB } = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

// Import all route modules
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const pharmacistRoutes = require('./routes/pharmacistRoutes');
const labRoutes = require('./routes/labRoutes');
const receptionistRoutes = require('./routes/receptionistRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount routes with /api prefix
app.use('/api', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', doctorRoutes);
app.use('/api', pharmacistRoutes);
app.use('/api', labRoutes);
app.use('/api', receptionistRoutes);
app.use('/api', adminRoutes);

// Also mount the standalone staff feedback routes (already inside auth? Better to put in a separate staffRoutes? We'll keep them in authRoutes for simplicity)
// But note: the POST /api/staff/feedback appears three times. We'll keep only the final one in authRoutes.

// Initialize database and start server
initDB().then(() => {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SERVER RUNNING ON PORT ${PORT}`);
    });
});