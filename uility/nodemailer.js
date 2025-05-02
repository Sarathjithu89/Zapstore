const nodemailer = require("nodemailer");
const crypto = require("crypto");

//otp generation function
function generateOtp() {
  const OTP = crypto.randomInt(100000, 999999).toString();
  return OTP;
}

//email verification function
async function sendVerificationEmail(emailData) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,

      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });
    const mailOptions = {
      from: `Zapstore <${process.env.EMAIL}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.text,
    };

    const info = await transporter.sendMail(mailOptions);
    if (info.accepted && info.accepted.length > 0) {
      return true;
    }
    console.log("Email rejected by server", info.rejected);
    return false;
  } catch (error) {
    console.log("Server Error", error);
    return false;
  }
}
module.exports = { sendVerificationEmail, generateOtp };
