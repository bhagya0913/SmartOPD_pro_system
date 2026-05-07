require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/db');  // only initDB, not db

const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const pharmacistRoutes = require('./routes/pharmacistRoutes');
const labRoutes = require('./routes/labRoutes');
const receptionistRoutes = require('./routes/receptionistRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Mount routes
app.use('/api', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', doctorRoutes);
app.use('/api', pharmacistRoutes);
app.use('/api', labRoutes);
app.use('/api', receptionistRoutes);
app.use('/api', adminRoutes);

// Initialize DB and start server
initDB().then(() => {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SERVER IS AWAKE ON PORT ${PORT}`);
    });
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});