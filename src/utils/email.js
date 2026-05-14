const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
    // Create reusable transporter object using the default SMTP transport
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Send mail with defined transport object
    const info = await transporter.sendMail({
        from: `"${process.env.APP_NAME || 'Ngobrolin App'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html
    });

    return info;
};

module.exports = { sendEmail };
