const User = require("../../models/User");

const customerInfo = async (req, res) => {
  try {
    let search = [];
    if (req.query.search) {
      search = req.query.search ? req.query.search.trim() : "";
    }
    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    const limit = 4;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*" } },
        { email: { $regex: ".*" + search + ".*" } },
      ],
    })
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
    return res.redirect("/admin/users");
  } catch (error) {
    console.log("Customer Block error", error);
    return res.redirect("/pageerror");
  }
};
const custormerUnblocked = async (req, res) => {
  try {
    let id = req.query.userid;

    await User.updateOne({ _id: id }, { $set: { is_blocked: false } });
    return res.redirect("/admin/users");
  } catch (error) {
    console.log("unblock error", error);
    return res.redirect("/pageerror");
  }
};

module.exports = {
  customerInfo,
  custormerBlocked,
  custormerUnblocked,
};
