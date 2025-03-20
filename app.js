const express = require("express");
const app = express();
const dotenv = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport.js");
const flash = require("express-flash");
const connectDb = require("./config/database.js");
const path = require("path");
const userRouter = require("./routes/userRouter.js");

connectDb();
const PORT = 3000 || process.env.PORT;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

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
