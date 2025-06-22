const express = require("express");
const app = express();
const dotenv = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport.js");
const flash = require("express-flash");
const connectDb = require("./config/database.js");
const path = require("path");
const userRouter = require("./routes/userRouter.js");
const adminRouter = require("./routes/adminRouter.js");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

let sessionStore;
try {
  const { RedisStore } = require("connect-redis");
  const { createClient } = require("redis");

  let redisClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    legacyMode: true,
  });
  redisClient.connect().catch(console.error);

  sessionStore = new RedisStore({
    client: redisClient,
  });
} catch (error) {
  console.log("Falling back to memory session store:", error.message);
  sessionStore = new session.MemoryStore();
}

connectDb(); //connect db function
const PORT = process.env.PORT || 3000;

//view engin ,static files
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views"),
  path.join(__dirname, "views/admin"),
]);

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, maxAge: 24 * 60 * 60 * 1000, httpOnly: true },
  })
);
app.use(bodyParser.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

//user and admin routes
app.use("/", userRouter);
app.use("/admin", adminRouter);

app.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT} `);
});

module.exports = app;
