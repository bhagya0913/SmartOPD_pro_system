const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bhagya0913@gmail.com',
        pass: 'nfzunxjlstdszaba'
    }
});

module.exports = transporter;