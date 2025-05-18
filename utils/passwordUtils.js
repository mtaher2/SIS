const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate a random password
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

// Send welcome email with password
async function sendWelcomeEmail(email, firstName, lastName, password, role, username) {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Welcome to GU Student Information System',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Welcome to GU Student Information System</h2>
                <p>Dear ${firstName} ${lastName},</p>
                <p>Welcome to the GU Student Information System! Your account has been successfully created.</p>
                <p>Here are your login credentials:</p>
                <ul>
                    <li><strong>Username:</strong> ${username}</li>
                    <li><strong>Role:</strong> ${role}</li>
                    <li><strong>Temporary Password:</strong> ${password}</li>
                </ul>
                <p><strong>Important:</strong> For security reasons, you will be required to change your password upon your first login.</p>
                <p>Please log in to the system and update your password as soon as possible.</p>
                <p>Best regards,<br>GU Student Information System Team</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
}

module.exports = {
    generateRandomPassword,
    sendWelcomeEmail
}; 