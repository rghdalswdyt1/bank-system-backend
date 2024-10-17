import nodemailer from 'nodemailer';

// Function to send the OTP email with a professional design
export const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: false,
    service: 'gmail', // أو أي خدمة بريد أخرى
    auth: {
      user: process.env.EMAIL_USER, // بريدك الإلكتروني
      pass: process.env.EMAIL_PASS, // كلمة مرور البريد الإلكتروني
    },
  });

  // HTML email template
  const htmlEmailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <div style="text-align: center; background-color: #007BFF; padding: 10px 0; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Bank System</h1>
      </div>
      
      <div style="padding: 20px; background-color: #f9f9f9;">
        <h2 style="color: #333;">Welcome to Bank System!</h2>
        <p>Thank you for creating an account with us. To verify your email address and activate your account, please enter the OTP code below on the verification page.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <h2 style="color: #007BFF; border: 1px dashed #007BFF; display: inline-block; padding: 10px 20px;">${otp}</h2>
        </div>

        <p style="color: #555;">This OTP code is valid for only 5 minutes. If you did not request this code, please ignore this email.</p>
        <p style="color: #555;">For security reasons, please do not share this OTP code with anyone.</p>
        
        <p style="text-align: center; margin-top: 40px; color: #555;">
          Sincerely,<br>
          <strong>Bank System Team</strong>
        </p>
      </div>
      
      <div style="text-align: center; background-color: #007BFF; padding: 10px; border-radius: 0 0 10px 10px;">
        <p style="color: white; margin: 0;">&copy; 2024 Bank System Team - All Rights Reserved.</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email - OTP Code',
    html: htmlEmailTemplate, // HTML message body
  };

  await transporter.sendMail(mailOptions);
};
