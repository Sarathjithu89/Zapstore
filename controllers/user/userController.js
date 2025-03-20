const User = require("../../models/User.js");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const loadHomepage = async (req, res) => {
  try {
    return res.render("home.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};
const loadOtpVerification = async (req, res) => {
  try {
    return res.render("otp.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};
const loadLogin = async (req, res) => {
  try {
    let message = "";
    if (req.query.error) {
      message = "Invalid Email or Password";
    }
    return res.render("login.ejs", { message });
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};

const loadRegister = async (req, res) => {
  try {
    return res.render("register.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};
const securePassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.log("secure password error", error);
    return false;
  }
};

//otp verification
const otpVerification = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.user || !req.session.user.otp) {
      return res.status(400).json({
        success: false,
        message: "Session expired or invalid request",
      });
    }

    const { name, email, otp: userotp, password, phone } = req.session.user;

    if (parseInt(otp) === parseInt(userotp)) {
      const passwordHash = await securePassword(password);
      const saveUser = new User({
        name,
        email,
        phone,
        password: passwordHash,
      });

      await saveUser.save();
      req.session.userId = saveUser._id;
      // console.log("User registered successfully:", req.session.userId);
      delete req.session.user;

      return res.json({
        success: true,
        message: "OTP verified successfully!",
        redirectUrl: "/login",
      });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//resend otp
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.user;
    console.log("Email:", email);
    if (!email) {
      res.status(400).json({ success: false, message: "Email is required" });
    }
    const otp = generateOtp();
    req.session.user.otp = otp;
    const emailData = {
      to: email,
      subject: "OTP for registration",
      text: `Your OTP is ${otp}`,
    };
    const emailSent = await sendVerificationEmail(emailData);
    if (emailSent) {
      console.log("OTP sent successfully", otp);
      res.status(200).json({ success: true, message: "OTP sent successfully" });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Faid to send OTP,Please try again" });
    }
  } catch (error) {
    console.log("Resend OTP error", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("404.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//user registration
const register = async (req, res) => {
  try {
    const { name, email, password, cpassword, phone } = req.body;

    if (password !== cpassword) {
      req.flash("error", "Password not matched");
      return res.redirect("/register");
    }
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      req.flash("error", "User already exists");
      return res.redirect("/register");
    }

    const otp = generateOtp();
    const emainData = {
      to: email,
      subject: "OTP for registration",
      text: `Your OTP is ${otp}`,
    };
    //Send email
    const emailSent = await sendVerificationEmail(emainData);

    if (!emailSent) {
      req.flash("error", "Email not sent");
      return res.redirect("/register");
    }
    req.session.user = { name, email, otp, password, phone };
    console.log("otp in session :", req.session.user.otp); //console.log otp in session
    return res.redirect("/verify-otp");
  } catch (error) {
    console.log("sign up error", error);
    res.redirect("/pageNotFound");
  }
};

/*functions*/

//otp generation
function generateOtp() {
  var digits = "0123456789";
  let OTP = "";
  for (let i = 0; i < 6; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
}
//email verification
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

module.exports = {
  loadHomepage,
  loadLogin,
  loadRegister,
  pageNotFound,
  register,
  loadOtpVerification,
  otpVerification,
  resendOtp,
};
