const mongoose = require("mongoose");
const env = require("dotenv").config();
const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    //await mongoose.connect(process.env.MONGODB_URI_LOCAL);
    console.log("Database Connected");
  } catch (error) {
    console.log("Databse connection error", error);
  }
};
module.exports = connectDb;
