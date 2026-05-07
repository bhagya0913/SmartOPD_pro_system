// config/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();  // Load environment variables

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'bhagya0913@gmail.com',
        pass: process.env.EMAIL_PASS   // Now read from .env file
    }
});

module.exports = transporter;