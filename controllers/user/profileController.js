const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const User = require("../../models/User.js");
const Address = require("../../models/Address.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { securePassword } = require("./userController.js");
const { text } = require("pdfkit");
const {
  generateOtp,
  sendVerificationEmail,
} = require("../../uility/nodemailer.js");

//load the user profile
const getUserProfile = async (req, res) => {
  try {
    const decodedUser = req.user;
    if (decodedUser) {
      const user = await User.findOne({ _id: decodedUser.userId });
      res.render("profile.ejs", { user });
    } else {
      req.flash("error", "Please Login");
      res.redirect("/");
    }
  } catch (error) {
    console.log("profile Page Error", error);
    return res.redirect("/pageNotFound");
  }
};

//upload image funciton
const uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const userId = req.user.userId;

  try {
    const PROFILEIMAGE_UPLOAD_DIR = path.join(
      __dirname,
      "../../public/uploads/user-images"
    );
    const outputFilename = `cropped-${Date.now()}-${req.file.originalname}`;
    const outputPath = path.join(PROFILEIMAGE_UPLOAD_DIR, outputFilename);
    await sharp(req.file.path).resize(512, 512).toFile(outputPath);
    fs.unlinkSync(req.file.path);
    const user = await User.findById(userId);
    if (
      user.profileImage &&
      !user.profileImage.includes("default/default-user-avatar.png")
    ) {
      const oldImagePath = path.join(
        PROFILEIMAGE_UPLOAD_DIR,
        path.basename(user.profileImage)
      );
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    user.profileImage = `${outputFilename}`;
    await user.save();

    res.json({
      success: true,
      imageUrl: "/uploads/user-images/" + user.profileImage,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Image processing failed" });
  }
};
const removeProfileImage = async (req, res) => {
  const userId = req.user?.userId;
  const DEFAULT_PROFILE_IMAGE = "default/default-user-avatar.png";
  const PROFILEIMAGE_UPLOAD_DIR = path.join(
    __dirname,
    "../../public/uploads/user-images"
  );

  try {
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (
      user.profileImage &&
      !user.profileImage.includes("default/default-user-avatar.png")
    ) {
      const oldImagePath = path.join(
        PROFILEIMAGE_UPLOAD_DIR,
        path.basename(user.profileImage)
      );
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    user.profileImage = DEFAULT_PROFILE_IMAGE;
    await user.save();

    res.json({ success: true, defaultImage: DEFAULT_PROFILE_IMAGE });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove profile image" });
  }
};

//update Profile
const profileUpdate = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const trimmdName = name.trim();
    const user = await User.findOne({ email: email });
    const addressData = await Address.findOne({ userId: user._id });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.name !== trimmdName) {
      user.name = trimmdName;
    }

    if (!user.phone || user.phone !== phone) {
      user.phone = phone;
    }
    addressData.address.map((address) => {
      return (address.phone = phone);
    });

    await addressData.save();
    await user.save();

    return res.json({ success: true });
  } catch (error) {
    console.log("profile update Error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

//change password- profile page
const changePasswordProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: "passwords donot Match" });
    }
    const user = await User.findOne({ _id: userId });
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (passwordMatch) {
      user.password = await securePassword(newPassword);
    } else {
      return res.json({ success: false, message: "Wrong current Password" });
    }
    await user.save();
    return res.json({ success: true });
  } catch (error) {
    console.log("Password Update Error", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

//get address function
const getUserAddress = async (req, res) => {
  try {
    const decodedUser = req.user;

    if (!decodedUser) {
      req.flash("error", "Please Login");
      return res.redirect("/");
    }

    const addressDoc = await Address.findOne({ userId: decodedUser.userId });

    const addresses = (addressDoc?.address || []).map((addr, index) => ({
      _id: addr._id,
      type: addr.addressType,
      fullName: addr.name,
      addressLine: addr.addressLine,
      landMark: addr.landMark,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
      phone: addr.phone,
      altPhone: addr.altPhone,
      isDefault: addr.isDefault,
    }));

    res.render("address.ejs", {
      address: addressDoc,
      addresses,
    });
  } catch (error) {
    console.error("Error fetching user address:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/");
  }
};

//save address function
const saveAddress = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      _id,
      fullName,
      addressLine,
      landMark,
      city,
      state,
      pincode,
      country,
      type,
      isDefault,
      altPhone,
    } = req.body;

    const userData = await User.findOne({ _id: user.userId });
    const phone = userData.phone;

    let addressDoc = await Address.findOne({ userId: user.userId });

    const newAddress = {
      addressType: type,
      name: fullName,
      city,
      landMark: landMark,
      state,
      pincode,
      phone: phone ? `${phone}` : "",
      altPhone: altPhone ? `${altPhone}` : "",
      addressLine: addressLine,
      country,
      isDefault,
    };

    if (!addressDoc) {
      addressDoc = new Address({
        userId: user.userId,
        address: [newAddress],
      });
    } else {
      if (_id) {
        const index = addressDoc.address.findIndex(
          (addr) => addr._id.toString() === _id
        );
        if (index !== -1) {
          addressDoc.address[index] = {
            ...addressDoc.address[index].toObject(),
            ...newAddress,
          };
        } else {
          return res
            .status(404)
            .json({ success: false, message: "Address not found" });
        }
      } else {
        addressDoc.address.push(newAddress);
      }
    }

    if (isDefault) {
      addressDoc.address = addressDoc.address.map((addr, i) => ({
        ...addr.toObject(),
        isDefault: _id
          ? addr._id.toString() === _id
          : i === addressDoc.address.length - 1,
      }));
    }
    await addressDoc.save();
    res
      .status(200)
      .json({ success: true, message: "Address saved successfully" });
  } catch (error) {
    console.error("Error in saveAddress:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//set default funcion
const setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.user.userId;
    const addressDoc = await Address.findOne({ userId: userId });
    addressDoc.address = addressDoc.address.map((addr) => ({
      ...addr.toObject(),
      isDefault: addr._id.toString() === addressId,
    }));

    await addressDoc.save();

    return res
      .status(200)
      .json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error("Error in changing default:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.user.userId;

    const addresses = await Address.findOne({ userId: userId });

    if (!addresses) {
      return res.json({ success: false, message: "Addresses not found" });
    }

    addresses.address = addresses.address.filter(
      (address) => address._id.toString() !== addressId
    );

    await addresses.save();

    res.json({ success: true });
  } catch (error) {
    console.log("Delete Address error", error);
    return res.json({ success: false, message: "Internal server Error" });
  }
};

const forgotPasswordLogout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.redirect("/forgotPassword");
  } catch (error) {
    console.error("Logout Error:", error);
    req.flash("error", "An error occurred during logout");
    res.redirect("/pageNotFound");
  }
};

//change-email

const renderChangeEmailPage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    res.render("changeemail.ejs", {
      user,
      title: "Change Email",
      alerts: req.flash(),
    });
  } catch (error) {
    console.error("Error rendering change email page:", error);
    req.flash("error", "An error occurred. Please try again later.");
    return res.redirect("/userProfile");
  }
};

const sendEmailVerification = async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "user_not_found",
        message: "User not found",
      });
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: "invalid_password",
        message: "Current password is incorrect",
      });
    }
    let verificationCodes = {};
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        error: "email_exists",
        message: "This email is already in use",
      });
    }
    const verificationCode = generateOtp();

    verificationCodes[userId] = {
      code: verificationCode,
      email: newEmail,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    };

    req.session.verificationCodes = verificationCodes;

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

    const emailData = {
      to: newEmail,
      subject: "Email Verification Code",
      text: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
          <h2 style="color: #487379; text-align: center;">Email Verification</h2>
          <p>Hello ${user.name},</p>
          <p>You've requested to change your email address. Please use the verification code below to complete this process:</p>
          <div style="background-color: #f6f6f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${verificationCode}
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this change, please ignore this email or contact our support team immediately.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
              &copy; ${new Date().getFullYear()} Zapstore. All rights reserved.
          </p>
      </div>
  `,
    };
    const emailSent = await sendVerificationEmail(emailData);

    if (!emailSent) {
      req.flash("error", "Mail not send");
      return res.redirect("/user/profile");
    }

    // const mailOptions = {
    //   from: `"Zapstore" <${process.env.EMAIL}>`,
    //   to: newEmail,
    //   subject: "Email Verification Code",
    //   html: `
    //           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
    //               <h2 style="color: #487379; text-align: center;">Email Verification</h2>
    //               <p>Hello ${user.name},</p>
    //               <p>You've requested to change your email address. Please use the verification code below to complete this process:</p>
    //               <div style="background-color: #f6f6f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
    //                   ${verificationCode}
    //               </div>
    //               <p>This code will expire in 30 minutes.</p>
    //               <p>If you didn't request this change, please ignore this email or contact our support team immediately.</p>
    //               <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
    //                   &copy; ${new Date().getFullYear()} Your Store. All rights reserved.
    //               </p>
    //           </div>
    //       `,
    // };

    // await transporter.sendMail(mailOptions);

    console.log(verificationCodes[userId]);

    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return res.status(500).json({
      success: false,
      message:
        "An error occurred while sending the verification code. Please try again later.",
    });
  }
};

const updateEmail = async (req, res) => {
  try {
    const { currentPassword, newEmail, verificationCode } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "user_not_found",
        message: "User not found",
      });
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: "invalid_password",
        message: "Current password is incorrect",
      });
    }
    const verificationCodes = req.session.verificationCodes;
    console.log(verificationCodes[userId]);
    const storedVerification = verificationCodes[userId];
    if (
      !storedVerification ||
      storedVerification.code !== verificationCode ||
      storedVerification.email !== newEmail ||
      Date.now() > storedVerification.expiresAt
    ) {
      return res.status(400).json({
        success: false,
        error: "invalid_code",
        message: "Invalid or expired verification code",
      });
    }

    user.email = newEmail;
    await user.save();

    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }

      return res.status(200).json({
        success: true,
        message:
          "Email updated successfully. Please log in with your new email.",
        requireRelogin: true,
      });
    });
  } catch (error) {
    console.error("Error updating email:", error);
    return res.status(500).json({
      success: false,
      message:
        "An error occurred while updating your email. Please try again later.",
    });
  }
};

module.exports = {
  getUserProfile,
  uploadProfileImage,
  removeProfileImage,
  profileUpdate,
  getUserAddress,
  saveAddress,
  setDefaultAddress,
  deleteAddress,
  changePasswordProfile,
  forgotPasswordLogout,
  sendEmailVerification,
  updateEmail,
  renderChangeEmailPage,
};
