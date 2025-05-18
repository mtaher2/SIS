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
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://www.egyptianeducation.com/ImageHandler.ashx?Id=14525&SS=ceddd09c14cae84267b064642c315f8b" alt="GU Logo" style="max-width: 135px; height: auto;">
                    </div>
                    
                    <div style="background-color: #1a237e; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-align: center;">Welcome to GU Student Information System</h1>
                    </div>

                    <div style="padding: 0 20px;">
                        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear <strong>${firstName} ${lastName}</strong>,</p>
                        
                        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Welcome to the GU Student Information System! We're delighted to have you on board. Your account has been successfully created.</p>

                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 25px 0;">
                            <h2 style="color: #1a237e; margin-top: 0; font-size: 18px;">Your Login Credentials</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #555555;"><strong>Username:</strong></td>
                                    <td style="padding: 8px 0; color: #333333;">${username}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #555555;"><strong>Role:</strong></td>
                                    <td style="padding: 8px 0; color: #333333;">${role}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #555555;"><strong>Temporary Password:</strong></td>
                                    <td style="padding: 8px 0; color: #333333;">${password}</td>
                                </tr>
                            </table>
                        </div>

                        <div style="background-color: #fff3e0; padding: 15px; border-radius: 6px; margin: 25px 0;">
                            <p style="color: #e65100; margin: 0; font-size: 15px;">
                                <strong>Important:</strong> For security reasons, you will be required to change your password upon your first login.
                            </p>
                        </div>

                        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Please log in to the system and update your password as soon as possible.</p>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                            <p style="color: #666666; font-size: 14px; margin: 0;">Best regards,<br>
                            <strong style="color: #1a237e;">GU Student Information System Team</strong></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
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