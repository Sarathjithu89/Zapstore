const express = require("express");
const app = express();
const env = require("dotenv").config();
const connectDb = require("./config/database.js");

connectDb().catch((err) => console.log(err));

const PORT = process.env.PORT;

app.get("/", (req, res) => {
  res.end("hello");
});

app.listen(PORT, () => {
  console.log("server is running");
});

module.exports = app;
