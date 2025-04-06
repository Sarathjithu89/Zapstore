const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Product = require("../../models/Products.js");
const User = require("../../models/User.js");
const Category = require("../../models/Category.js");

/*-----------------------------------------Loading Pages----------------------------------------------------*/

const loadHomepage = async (req, res) => {
  try {
    let userData = null;

    if (req.user) {
      userData = await User.findOne({ _id: req.user.userId });
    }

    const products = await Product.find({isBlocked:false,isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(8)
      .exec();

    res.render("home.ejs", { user: userData, products: products });
  } catch (error) {
    console.error("Home page error:", error);
    res.status(500).send("Server error");
  }
};

//Load OTP Verification page
const loadOtpVerification = async (req, res) => {
  try {
    return res.render("otp.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};

//Load login page
const loadLogin = async (req, res) => {
  try {
    if (!req.cookies.token) {
      return res.render("login.ejs");
    }
    return res.redirect("/");
  } catch (error) {
    res.redirect("/pageNotFound");
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

//Load forgot password page
const loadforgotPassword = async (req, res) => {
  try {
    res.render("forgotpassEmail.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

//load reset password page
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

//load checkout page
const checkoutPage = async (req, res) => {
  try {
    return res.render("checkout.ejs");
  } catch (error) {
    console.log("checkout error", error);
  }
};

//load page not found page
const pageNotFound = async (req, res) => {
  try {
    res.render("404.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};
/*---------------------------------------------google callback---------------------------------------------------------*/
async function googleCallback(req, res) {
    const token = req.user.token;
    res.cookie("token", token, { httpOnly: true, secure: true });
    // res.status(200),json({ sucess: true, message: "Google login sucessful", token });
    const decoded=jwt.verify(token,process.env.JWT_SECRET_KEY);
    const userEmail=decoded.email;
    const user=await User.findOne({email:userEmail});
    if(!user.password){
      req.flash("success", "Please Enter New Password");
      return res.redirect("/addpassword");
    }
    return res.redirect('/login');
  }

/*---------------------------------------------Main functions---------------------------------------------------------*/
//login check function
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email.trim();
    const findUser = await User.findOne({
      email: trimmedEmail,
    });

    if (!findUser) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }
    if (findUser.is_blocked) {
      req.flash("error", "Your account has been blocked");
      return res.redirect("/login");
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      req.flash("error", "Incorrect password");
      return res.redirect("/login");
    }
    const payLoad = {
      userId: findUser._id,
      userName: findUser.name,
      email: findUser.email,
    };
    const token = createJwtToken(payLoad);
    res.cookie("token", token, { httpOnly: true, secure: true });
    req.flash("success", "Login successful");
    return res.redirect("/");
  } catch (error) {
    console.log("Login Error", error);
    req.flash("error", "Login failed. Please try again");
    return res.redirect("/login");
  }
};

//user logout functions
const logout = async (req, res) => {
  try {
    // req.session.destroy((err) => {
    //   if (err) {
    //     console.error("Session destruction error:", err);
    //   }
    // });

    req.flash("success", "You have been logged out successfully");
    res.clearCookie("token");

    return res.redirect("/");
  } catch (error) {
    console.error("Logout Error:", error);
    req.flash("error", "An error occurred during logout");
    res.redirect("/pageNotFound");
  }
};

//Hashing password function
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

//otp verification function
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

//change password function
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

//Resend OTP function
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.user;
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

//google Add passoword
const getAddPassword=async(req,res)=>{
  try {
    return res.render("addpassword.ejs")
  } catch (error) {
    console.log(error);
    return res.redirect('/pageerror');
  }
  };
  const addPassword=async(req,res)=>{
    try {
      const {password,cpassword}=req.body;
      const trimmedPassword=password.trim();
      const trimmedCassword=cpassword.trim();
      if (trimmedPassword !== trimmedCassword) {
        req.flash("error","Passwords donot Match");
        return res.redirect('/addpassword')
      }
      const token=req.cookies.token;
      let decoded=jwt.verify(token,process.env.JWT_SECRET_KEY);
      const email=decoded.email;
      const hashedPassword=await securePassword(password)
      const user=await User.findOne({email:email});
      user.password=hashedPassword;
      await user.save();
      req.flash("success","Success! Please Login");
      return res.redirect('/login');
    } catch (error) {
      console.log("Adding Password Error :",error)
      return res.redirect('/pageerror');
    }
  }
  

//reset password function
const resetPassword = async (req, res) => {
  try {
    const { password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render("resetPassword.ejs", {
        "error": "Password not matched",
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

//forgot password function
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const find = await User.findOne({ email: email });
    if (!find) {
      req.flash("error", "User not found");
      return res.render("forgotpassEmail.ejs", { message: "User not found" });
    }
    const otp = generateOtp(); //generating the OTP
    const emainData = {
      to: email,
      subject: "OTP for Password Reset",
      text: `Your OTP is ${otp}`,
    };
    const emailSent = await sendVerificationEmail(emainData);
    if (!emailSent) {
      return res.render("forgotpassEmail.ejs", { message: "Email not sent" });
    }
    req.session.user = { email, otp };
    console.log("OTP is:", req.session.user.otp); //console.log otp in session
    return res.render("forgotpassword.ejs");
  } catch (error) {
    console.log("forgot password error", error);
    res.redirect("/pageNotFound");
  }
};

//verify forgot password OTP function
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

//user registration function
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
    const emailSent = await sendVerificationEmail(emainData);
    if (!emailSent) {
      req.flash("error", "Email not sent");
      return res.redirect("/register");
    }
    req.session.user = { name, email, otp, password, phone };
    console.log("OTP is :", req.session.user.otp); //console.log otp in the session
    return res.redirect("/verify-otp");
  } catch (error) {
    console.log("sign up error", error);
    res.redirect("/pageNotFound");
  }
};

//single Product function
const getSingleProduct = async (req, res) => {
  try {
    const productId = req.query.id;
    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/");
    }
    // Find related
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
    }).limit(8);

    res.render("singleproduct.ejs", {
      title: product.productName,
      product,
      relatedProducts,
      user: req.user || null,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/");
  }
};

//category page function
const getCategoryPage = async (req, res, next) => {
  try {
    const categoryId = req.query.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 100000;
    const sort = req.query.sort || "default";
    const skip = (page - 1) * limit;

    let category = null;
    if (categoryId) {
      category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).render("error", {
          message: "Category not found",
          error: { status: 404 },
        });
      }

      if (category && category.isListed === false) {
        return res.status(404).render("error", {
          message: "Category not found",
          error: { status: 404 },
        });
      }
    }

    let query = {};
    if (category) {
      query.category = categoryId;
    }
    query.salePrice = { $gte: minPrice, $lte: maxPrice };
    let sortOptions = {};

    switch (sort) {
      case "name-asc":
        sortOptions.productName = 1;
        break;
      case "name-desc":
        sortOptions.productName = -1;
        break;
      case "price-asc":
        sortOptions.salePrice = 1;
        break;
      case "price-desc":
        sortOptions.salePrice = -1;
        break;
      case "rating-desc":
        sortOptions.rating = -1;
        break;
      case "date-desc":
        sortOptions.createdAt = -1;
        break;
      case "date-asc":
        sortOptions.createdAt = 1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const categories = await Category.aggregate([
      {
        $match: { isListed: { $ne: false } },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          bannerImage: 1,
          productCount: { $size: "$products" },
          isListed: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);
    if (!categoryId) {
      query.category = { $in: categories.map((cat) => cat._id) };
    }

    const totalItems = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate("category", "name");

    const featuredProducts = await Product.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(3);

    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      limit: limit,
      startIndex: skip,
      endIndex: skip + products.length - 1,
      baseUrl: category ? `/category/${categoryId}` : "/shop",
    };

    res.render("Categorys.ejs", {
      title: category ? `${category.name} | Shop` : "Shop",
      products,
      category,
      categories,
      featuredProducts,
      pagination,
      minPrice,
      maxPrice,
      sort,
    });
  } catch (error) {
    console.error("Error in getCategoryPage controller:", error);
    next(error);
  }
};

/*-----------------------------------functions-------------------------------------------*/

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
//ceate JWT token function
function createJwtToken(payLoad) {
  const token = jwt.sign(payLoad, process.env.JWT_SECRET_KEY, {
    expiresIn: "30m",
  });
  return token;
}

module.exports = {
  googleCallback,
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
  getSingleProduct,
  getCategoryPage,
  getAddPassword,
  addPassword,
};
