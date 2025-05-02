const passport = require("passport");
const googleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const env = require("dotenv").config();
const jwt = require("jsonwebtoken");

passport.use(
  new googleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshtoken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          await user.save();
        } else if (!user.googleId) {
          (user.googleId = profile.id), await user.save();
        }
        const token = jwt.sign(
          { userId: user._id, userName: user.name, email: user.email },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "30m" }
        );
        return done(null, { user, token });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
