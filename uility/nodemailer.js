const nodemailer = require("nodemailer");

//otp generation function
function generateOtp() {
  var digits = "0123456789";
  let OTP = "";
  for (let i = 0; i < 6; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
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
      from: process.env.EMAIL,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: `<p>${emailData.text}</p>`,
    };
    const info = await transporter.sendMail(mailOptions);
    if (info.accepted && info.accepted.length > 0) {
      return true;
    }
    console.log("Email rejected by server", info.rejected);
    return false;
  } catch (error) {
    console.log(error);
    return false;
  }
}
module.exports = { sendVerificationEmail, generateOtp };
