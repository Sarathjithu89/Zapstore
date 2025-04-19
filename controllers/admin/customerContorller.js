const User = require("../../models/User");

const customerInfo = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      req.flash("error", "session expired please Login");
      return res.redirect("/admin");
    }
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
//block customer
const custormerBlocked = async (req, res) => {
  try {
    let id = req.query.userid;
    await User.updateOne({ _id: id }, { $set: { is_blocked: true } });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.log("Customer Block error", error);
    return res.status(500).json({ success: false });
  }
};
//unblock coustomer
const custormerUnblocked = async (req, res) => {
  try {
    let id = req.query.userid;

    await User.updateOne({ _id: id }, { $set: { is_blocked: false } });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.log("unblock error", error);
    return res.status(500).json({ success: false });
  }
};

module.exports = {
  customerInfo,
  custormerBlocked,
  custormerUnblocked,
};
