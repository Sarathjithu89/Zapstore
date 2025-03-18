const express = require("express");
const app = express();
const env = require("dotenv").config();
const connectDb = require("./config/database.js");
const path = require("path");
const userRouter = require("./routes/userRouter.js");

connectDb();
const PORT = 3000 || process.env.PORT;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views"),
  path.join(__dirname, "views/admin"),
]);

app.use("/", userRouter);

app.listen(PORT, () => {
  console.log("server is running");
});

module.exports = app;
