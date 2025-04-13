const jwt = require("jsonwebtoken");

//create JWT TOKEN for USER
const createJwtToken = (payLoad) => {
  const token = jwt.sign(payLoad, process.env.JWT_SECRET_KEY, {
    expiresIn: "8hr",
  });
  return token;
};

//create JWT TOKEN for ADMIN
const createAdminJwtToken = (payLoad) => {
  const tokenkey = jwt.sign(payLoad, process.env.JWT_ADMIN_SECRET_KEY, {
    expiresIn: "8hr",
  });
  return tokenkey;
};
module.exports = { createJwtToken, createAdminJwtToken };
