const User = require("../../models/User.js");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//load Home Page
const loadHomepage = async (req, res) => {
  try {
    if (req.user) {
      const userData = await User.findOne({ _id: req.user.userId });
      return res.render("home.ejs", { user: userData });
    }
    return res.render("home.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};
//OTP Verification
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
    if (!req.cookies.token) {
      return res.render("login.ejs");
    }
    return res.redirect("/");
    // if (!req.session.user) {
    //   return res.render("login.ejs");
    // } else {
    //   res.redirect("/");
    // }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};
//logout
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("session destruction err");
      }
    });
    res.clearCookie("token");
    return res.redirect("/");
  } catch (error) {
    console.log("logout Error", error);
    res.redirect("/pageNotFound");
  }
};

//login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimedEmail = email.trim();
    const findUser = await User.findOne({ email: trimedEmail });
    if (!findUser) {
      return res.render("login.ejs", { message: "User not found" });
    }
    if (findUser.is_blocked) {
      return res.render("login.ejs", { message: "User is Blocked by admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login.ejs", { message: "Incorrect Password" });
    }
    //req.session.user = findUser._id; //save user in session
    const payLoad = {
      userId: findUser._id,
      userName: findUser.name,
      email: findUser.email,
    };
    const token = createJwtToken(payLoad);
    // console.log(token);
    res.cookie("token", token, { httpOnly: true, secure: true });
    res.redirect("/");
  } catch (error) {
    console.log("login Error", error);
    res.render("login", { message: "login faild ,Please try again" });
  }
};
//load registeration page
const loadRegister = async (req, res) => {
  try {
    if (!req.cookies.token) {
      return res.render("register.ejs");
    }
    return res.redirect("/");
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
//change password
const changePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!req.session.user) {
      return res.redirect("/login");
    }

    const email = req.session.user.email;
    const findUser = await User.findOne({ email: email });

    if (!findUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const hashPassword = await securePassword(password);
    findUser.password = hashPassword;
    await findUser.save();

    req.session.user = null;
    res.redirect("/login");
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ message: "Internal server error" });
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
//page not found page
const pageNotFound = async (req, res) => {
  try {
    res.render("404.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};
//forgot password
const loadforgotPassword = async (req, res) => {
  try {
    res.render("forgotpassEmail.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//load reset password
const loadResetPassword = async (req, res) => {
  try {
    if (!req.session.user.otp) {
      return res.redirect("/forgotPassword");
    }
    return res.render("resetPassword.ejs", { message: null });
  } catch (error) {
    console.log(error);
    return res.redirect("/pageNotFound");
  }
};
//reset password
const resetPassword = async (req, res) => {
  try {
    const { password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render("resetPassword.ejs", {
        message: "Password not matched",
      });
    }
    const { token } = req.params;
    const user = await User.findOne({ resetToken: token });
    if (!user) {
      return res.render("resetPassword.ejs", { message: "Invalid token" });
    }
    const passwordHash = await securePassword(password);
    user.password = passwordHash;
    user.resetToken = null;
    await user.save();
    return res.redirect("/login");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const find = await User.findOne({ email: email });
    if (!find) {
      return res.render("forgotpassEmail.ejs", { message: "User not found" });
    }
    const otp = generateOtp();
    const emainData = {
      to: email,
      subject: "OTP for Password Reset",
      text: `Your OTP is ${otp}`,
    };
    //Send email
    const emailSent = await sendVerificationEmail(emainData);

    if (!emailSent) {
      return res.render("forgotpassEmail.ejs", { message: "Email not sent" });
    }
    req.session.user = { email, otp };
    console.log("otp in session :", req.session.user.otp); //console.log otp in session
    return res.render("forgotpassword.ejs");
  } catch (error) {
    console.log("forgot password error", error);
    res.redirect("/pageNotFound");
  }
};
//load checkout
const checkoutPage = async (req, res) => {
  try {
    return res.render("checkout.ejs");
  } catch (error) {
    console.log("checkout error", error);
  }
};

//verify forgot password otp
const verifyForgotOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!req.session.user || !req.session.user.otp) {
      return res.status(400).json({
        success: false,
        message: "Session expired or invalid request",
      });
    }
    const { email, otp: userotp } = req.session.user;
    if (parseInt(otp) === parseInt(userotp)) {
      return res.json({
        success: true,
        message: "OTP verified successfully!",
        redirectUrl: "/resetPassword",
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
function createJwtToken(payLoad) {
  const token = jwt.sign(payLoad, process.env.JWT_SECRET_KEY, {
    expiresIn: "30m",
  });
  return token;
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
  login,
  logout,
  loadforgotPassword,
  forgotPassword,
  loadResetPassword,
  resetPassword,
  verifyForgotOtp,
  changePassword,
  checkoutPage,
};
