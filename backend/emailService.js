const nodemailer = require("nodemailer");
require("dotenv").config();

// Configure the transporter
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send a notification email
const sendEmailNotification = async (userEmail, userType) => {
  try {
    const mailOptions = {
      from: `"Health Dashboard" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: "Registration Successful",
      html: `
        <h2>Hello ${userType}</h2>
        <p>Thank you for registering on Health Dashboard.</p>
        <p>You can now log in and start using your account.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Notification email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = { sendEmailNotification };
