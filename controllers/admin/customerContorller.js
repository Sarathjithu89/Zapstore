const User = require("../../models/User");

const customerInfo = async (req, res) => {
  try {
    const admin = req.admin;
    let search = [];
    if (req.query.search) {
      search = req.query.search ? req.query.search.trim() : "";
    }
    const page = parseInt(req.query.page) || 1;

    const limit = 4;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*" } },
        { email: { $regex: ".*" + search + ".*" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*" } },
        { email: { $regex: ".*" + search + ".*" } },
      ],
    }).countDocuments();

    res.render("userlisting.ejs", {
      admin: admin,
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      searchQuery: search,
    });
  } catch (error) {
    console.log("customerInfo Error", error);
  }
};
const custormerBlocked = async (req, res) => {
  try {
    let id = req.query.userid;
    await User.updateOne({ _id: id }, { $set: { is_blocked: true } });
    req.flash("success", "User Blocked Successfully");
    return res.redirect("/admin/users");
  } catch (error) {
    console.log("Customer Block error", error);
    return res.redirect("admin/pageerror");
  }
};
const custormerUnblocked = async (req, res) => {
  try {
    let id = req.query.userid;

    await User.updateOne({ _id: id }, { $set: { is_blocked: false } });
    req.flash("success", "User Unblocked Successfully");
    return res.redirect("/admin/users");
  } catch (error) {
    console.log("unblock error", error);
    return res.redirect("admin/pageerror");
  }
};

module.exports = {
  customerInfo,
  custormerBlocked,
  custormerUnblocked,
};
