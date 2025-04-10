const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const User = require("../../models/User.js");
const Address = require("../../models/Address.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const Order = require("../../models/Order.js");

const { securePassword } = require("./userController.js");

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

  const userId = req.user.userId; // You must get this from middleware/session

  try {
    const PROFILEIMAGE_UPLOAD_DIR = path.join(
      __dirname,
      "../../public/uploads/user-images"
    );
    const outputFilename = `cropped-${Date.now()}-${req.file.originalname}`;
    const outputPath = path.join(PROFILEIMAGE_UPLOAD_DIR, outputFilename);

    // Crop and resize the image using sharp
    await sharp(req.file.path).resize(512, 512).toFile(outputPath);

    // Delete original file
    fs.unlinkSync(req.file.path);

    // Get the current user
    const user = await User.findById(userId);

    // If user already had an uploaded image (not default), delete the old one
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

    // Update user's profileImage
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

//remove profile image
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

    // Only delete if it's not the default image
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

    // Set back to default
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

//change password fome profile page
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

    const userData = await User.findOne({ _id: user.userId }); //find user data
    const phone = userData.phone;

    let addressDoc = await Address.findOne({ userId: user.userId }); //find user address data

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
      // Create new address document for this user
      addressDoc = new Address({
        userId: user.userId,
        address: [newAddress],
      });
    } else {
      if (_id) {
        // Update existing address
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
        // Add new address
        addressDoc.address.push(newAddress);
      }
    }

    // If this isDefault is true, make sure others are false
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
    const addressId = req.body.addressId;
    const userId = req.user.userId;
    const addressDoc = await Address.findOne({ userId: userId });
    //checking all address and making addressId isDefault=true and others false
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
    const addressId = req.body.addressId;
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

//----------------------------order--------------------------------------------

// get Orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const orders = await Order.find({ userId: userId })
      .populate({
        path: "orderedItems.product",
        select: "productName productImage",
      })
      .populate("address")
      .sort({ createdAt: -1 }); // Sort by latest

    res.render("orders.ejs", {
      title: "Your Orders",
      orders,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    req.flash("error", "Failed to fetch your orders");
    res.redirect("/userProfile");
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
  getUserOrders,
};
