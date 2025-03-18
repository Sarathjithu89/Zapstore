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
    return res.render("login.ejs");
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
    res.render("page-404.ejs");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

module.exports = { loadHomepage, laoadLogin, laoadregister, pageNotFound };
