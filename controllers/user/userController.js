const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Product = require("../../models/Products.js");
const User = require("../../models/User.js");
const Category = require("../../models/Category.js");
const Cart = require("../../models/Cart.js");
const Wallet = require("../../models/Wallet.js");
const Transaction = require("../../models/Transactions.js");
const { createJwtToken } = require("../../config/jwt.js");
const Coupon = require("../../models/Coupon.js");
const {
  sendVerificationEmail,
  generateOtp,
} = require("../../uility/nodemailer.js");
const HTTP_STATUS = require("../../config/statusCodes.js");
const MESSAGE = require("../../config/messages.js");

/*-----------------------------------------Loading Pages----------------------------------------------------*/

const loadHomepage = async (req, res) => {
  try {
    let userData = null;
    const userId = req.user?.userId;
    if (userId) {
      userData = await User.findOne({ _id: userId });
    }

    const products = await Product.find({ isBlocked: false, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(8)
      .exec();

    let cartItems;
    if (userId) {
      const cart = await Cart.findOne({ userId: userId });
      if (cart) {
        cartItems = cart.items;
      }
    }

    let trendingProducts = 0;
    if (!userId) {
      return res.render("home.ejs", { products, trendingProducts });
    }
    res.render("home.ejs", {
      user: userData,
      products: products,
      cartItems,
      trendingProducts,
    });
  } catch (error) {
    console.error("Home page error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGE.ERROR.SERVER_ERROR);
  }
};

//Load OTP Verification page
const loadOtpVerification = async (req, res) => {
  try {
    return res.render("otp.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGE.ERROR.SERVER_ERROR);
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
    if (req.cookies.token) {
      req.flash(
        "error",
        MESSAGE.ERROR.ALREADY_SIGNED_IN || "You are already signed in"
      );
      return res.redirect("/");
    }

    let referral;
    if (req.query.ref) {
      referral = req.query.ref;
    }
    if (!req.cookies.token || !req.user) {
      return res.render("register.ejs", { referral });
    }
    return res.redirect("/");
  } catch (error) {
    console.log("Home page not found", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGE.ERROR.SERVER_ERROR);
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
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const userEmail = decoded.email;
  const user = await User.findOne({ email: userEmail });
  if (!user.password) {
    req.flash(
      "success",
      MESSAGE.SUCCESS.ENTER_NEW_PASSWORD || "Please Enter New Password"
    );
    return res.redirect("/addpassword");
  }
  return res.redirect("/login");
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
      req.flash("error", MESSAGE.ERROR.USER_NOT_FOUND);
      return res.redirect("/login");
    }
    if (findUser.is_blocked) {
      req.flash("error", MESSAGE.ERROR.BLOCKED_ACCOUNT);
      return res.redirect("/login");
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      req.flash("error", MESSAGE.ERROR.INCORRECT_PASSWORD);
      return res.redirect("/login");
    }
    const payLoad = {
      userId: findUser._id,
      userName: findUser.name,
      email: findUser.email,
    };
    const token = createJwtToken(payLoad);
    res.cookie("token", token, { httpOnly: true, secure: true });
    req.flash("success", MESSAGE.SUCCESS.LOGIN);
    return res.redirect("/");
  } catch (error) {
    console.log("Login Error", error);
    req.flash("error", MESSAGE.ERROR.LOGIN_FAILED);
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

    req.flash("success", MESSAGE.SUCCESS.LOGOUT);
    res.clearCookie("token");

    return res.redirect("/");
  } catch (error) {
    console.error("Logout Error:", error);
    req.flash(
      "error",
      MESSAGE.ERROR.LOGOUT_FAILED || "An error occurred during logout"
    );
    res.redirect("/pageNotFound");
  }
};

//otp verification function
const otpVerification = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!req.session.user || !req.session.user.otp) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGE.ERROR.SESSION_EXPIRED,
      });
    }
    const {
      name,
      email,
      otp: userotp,
      password,
      phone,
      referral,
    } = req.session.user;
    if (parseInt(otp) === parseInt(userotp)) {
      const passwordHash = await securePassword(password);
      const saveUser = new User({
        name,
        email,
        phone,
        password: passwordHash,
        referralCode: generateReferralCode(name),
      });

      await saveUser.save();
      if (referral) {
        await User.findOneAndUpdate(
          { referralCode: referral },
          { $push: { redeemedUsers: saveUser._id }, $inc: { redeemed: 1 } }
        );
        //create a coupon for user
        createReferralCoupon(saveUser._id);

        const refferedUsr = await User.findOne({ referralCode: referral });

        const wallet = await Wallet.findOne({ user: refferedUsr._id });

        wallet.balance += 100;
        await wallet.save();

        const transaction = new Transaction({
          wallet: wallet._id,
          amount: 100,
          balanceAfter: wallet.balance,
          type: "credit",
          description: MESSAGE.WALLET.REFERRAL_REWARD(saveUser.name),
        });

        await transaction.save();
      }

      req.session.userId = saveUser._id;
      delete req.session.user;
      return res.json({
        success: true,
        message: MESSAGE.SUCCESS.OTP_VERIFIED,
        redirectUrl: "/login",
      });
    } else {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: MESSAGE.ERROR.INVALID_OTP });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGE.ERROR.SERVER_ERROR,
    });
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
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ message: MESSAGE.ERROR.USER_NOT_FOUND });
    }

    const hashPassword = await securePassword(password);
    findUser.password = hashPassword;
    await findUser.save();

    req.session.user = null;
    res.redirect("/login");
  } catch (error) {
    console.error("Password change error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ message: MESSAGE.ERROR.SERVER_ERROR });
  }
};

//Resend OTP function
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.user;
    if (!email) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "Email is required" });
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
      res
        .status(HTTP_STATUS.OK)
        .json({ success: true, message: MESSAGE.SUCCESS.OTP_SENT });
    } else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message:
          MESSAGE.ERROR.EMAIL_NOT_SENT ||
          "Failed to send OTP, Please try again",
      });
    }
  } catch (error) {
    console.log("Resend OTP error", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGE.ERROR.SERVER_ERROR });
  }
};

//google Add passoword
const getAddPassword = async (req, res) => {
  try {
    return res.render("addpassword.ejs");
  } catch (error) {
    console.log(error);
    return res.redirect("/pageNotFound");
  }
};
const addPassword = async (req, res) => {
  try {
    const { password, cpassword } = req.body;
    const trimmedPassword = password.trim();
    const trimmedCassword = cpassword.trim();
    if (trimmedPassword !== trimmedCassword) {
      req.flash("error", MESSAGE.ERROR.PASSWORD_MISMATCH);
      return res.redirect("/addpassword");
    }
    const token = req.cookies.token;
    let decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const email = decoded.email;
    const hashedPassword = await securePassword(password);
    const user = await User.findOne({ email: email });
    user.password = hashedPassword;
    await user.save();
    req.flash("success", MESSAGE.SUCCESS.PASSWORD_ADDED);
    return res.redirect("/login");
  } catch (error) {
    console.log("Adding Password Error :", error);
    return res.redirect("/pageNotFound");
  }
};

//forgot password function
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const find = await User.findOne({ email: email });
    if (!find) {
      req.flash("error", MESSAGE.ERROR.USER_NOT_FOUND);
      return res.render("forgotpassEmail.ejs", {
        message: MESSAGE.ERROR.USER_NOT_FOUND,
      });
    }
    const otp = generateOtp(); //generating the OTP

    const emainData = {
      to: email,
      subject: "OTP for Password Reset",
      text: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
          <h2 style="color: #487379; text-align: center;">Email Verification</h2>
          <p>Hello ${find.name},</p>
          <p>You've requested to change your Password. Please use the verification code below to complete this process:</p>
          <div style="background-color: #f6f6f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this change, please ignore this email or contact our support team immediately.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
              &copy; ${new Date().getFullYear()} Zapstore. All rights reserved.
          </p>
      </div>
  `,
    };

    const emailSent = await sendVerificationEmail(emainData);

    if (!emailSent) {
      return res.render("forgotpassEmail.ejs", {
        message: MESSAGE.ERROR.EMAIL_NOT_SENT,
      });
    }
    req.session.user = { email, otp };
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGE.ERROR.SESSION_EXPIRED,
      });
    }
    const { email, otp: userotp } = req.session.user;
    if (parseInt(otp) === parseInt(userotp)) {
      return res.json({
        success: true,
        message: MESSAGE.SUCCESS.OTP_VERIFIED,
        redirectUrl: "/resetPassword",
      });
    } else {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: MESSAGE.ERROR.INVALID_OTP });
    }
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGE.ERROR.SERVER_ERROR,
    });
  }
};

//user registration function
const register = async (req, res) => {
  try {
    const { name, email, password, cpassword, phone, referral } = req.body;

    if (password !== cpassword) {
      req.flash("error", MESSAGE.ERROR.PASSWORD_MISMATCH);
      return res.redirect("/register");
    }
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      req.flash("error", MESSAGE.ERROR.USER_EXISTS);
      return res.redirect("/register");
    }

    const otp = generateOtp();

    const emainData = {
      to: email,
      subject: "OTP for registration",
      text: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
          <h2 style="color: #487379; text-align: center;">Email Verification</h2>
          <p>Hello ${name},</p>
          <p>Please use the verification code below to complete the Registration process:</p>
          <div style="background-color: #f6f6f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this change, please ignore this email or contact our support team immediately.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
              &copy; ${new Date().getFullYear()} Zapstore. All rights reserved.
          </p>
      </div>
  `,
    };

    const emailSent = await sendVerificationEmail(emainData);

    if (!emailSent) {
      req.flash("error", MESSAGE.ERROR.EMAIL_NOT_SENT);
      return res.redirect("/register");
    }
    req.session.user = { name, email, otp, password, phone, referral };
    return res.redirect("/verify-otp");
  } catch (error) {
    console.log("sign up error", error);
    res.redirect("/pageNotFound");
  }
};

//single Product function
const getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId)
      .populate("category")
      .populate("brand");

    if (!product) {
      req.flash("error", MESSAGE.ERROR.PRODUCT_NOT_FOUND);
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
    req.flash("error", MESSAGE.ERROR.SOMETHING_WRONG);
    res.redirect("/");
  }
};

//category page function
const getCategoryPage = async (req, res, next) => {
  try {
    const categoryId = req.params.id || req.query.id;
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
        return res.status(HTTP_STATUS.NOT_FOUND).render("error", {
          message: "Category not found",
          error: { status: HTTP_STATUS.NOT_FOUND },
        });
      }

      if (category && category.isListed === false) {
        return res.status(HTTP_STATUS.NOT_FOUND).render("error", {
          message: "Category not found",
          error: { status: HTTP_STATUS.NOT_FOUND },
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
      baseUrl: categoryId ? `/categories/${categoryId}/products` : "/products",
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

const getAboutUspage = async (req, res) => {
  try {
    return res.render("user/aboutus.ejs");
  } catch (error) {
    console.error("About page error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGE.ERROR.SERVER_ERROR);
  }
};

const getContactpage = async (req, res) => {
  try {
    return res.render("user/contact.ejs");
  } catch (error) {
    console.error("contact page error:", error);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(MESSAGE.ERROR.SERVER_ERROR);
  }
};

/*-----------------------------------functions-------------------------------------------*/

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

//create referal reward coupon
const createReferralCoupon = async (userId) => {
  try {
    const coupon = new Coupon({
      name: generateCouponCode(),
      expireOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      offerPrice: 100,
      minimumPrice: 0,
      isReferralCoupon: true,
      isusedFor: userId,
      usageLimit: 1,
    });
    await coupon.save();
    return coupon;
  } catch (error) {
    console.error("Error creating referral coupon:", error);
    return null;
  }
};

//for coupon code
const generateCouponCode = () => {
  return "REF" + Math.random().toString(36).substring(2, 10).toUpperCase();
};

//genereate refferal code
const generateReferralCode = (userName) => {
  return (
    userName.substring(0, 3) + Math.random().toString(36).substring(2, 8)
  ).toUpperCase();
};

module.exports = {
  securePassword,
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
  verifyForgotOtp,
  changePassword,
  getSingleProduct,
  getCategoryPage,
  getAddPassword,
  addPassword,
  getAboutUspage,
  getContactpage,
};
