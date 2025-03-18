const User = require("../../models/User.js");

const loadHomepage = async (req, res) => {
  try {
    return res.render("home.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};
const laoadLogin = async (req, res) => {
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
const laoadregister = async (req, res) => {
  try {
    return res.render("register.ejs");
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
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
    const { name, email, password, phone, cpassword } = req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }
    const newUser = new User({
      name,
      email,
      password,
      phone,
    });

    await newUser.save();
    return res.redirect("/login");
  } catch (error) {
    console.log("sign up error", error);
    res.status(500).send({ message: "Internal Server error" });
  }
};

module.exports = {
  loadHomepage,
  laoadLogin,
  laoadregister,
  pageNotFound,
  register,
};
