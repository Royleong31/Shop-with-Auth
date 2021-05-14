require("dotenv").config();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENDGRID_API_KEY,
    },
  })
);

// ?: Login
exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: req.flash("error")[0], // ?: gets this from the req.flash() first param
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  // res.setHeader("Set-Cookie", "loggedIn=true; HttpOnly");

  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }
      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;

            return req.session.save((err) => {
              if (err) console.log(err);
              res.redirect("/");
            });
          }

          res.redirect("/login");
        })
        .catch((err) => {
          console.error(err);
          res.redirect("/login");
        });
      // ? Redirect after session has been saved
    })
    .catch((err) => console.log(err));
};
// !: Login

// ?: Signup
exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Sign Up",
    errorMessage: req.flash("error")[0],
  });
};

exports.postSignup = (req, res, next) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  if (
    name === "" ||
    email === "" ||
    password === "" ||
    confirmPassword === ""
  ) {
    req.flash("error", "Please fill in the required fields");
    res.redirect("/signup");
  }

  User.findOne({ email: email })
    .then((userDoc) => {
      if (userDoc) {
        // ?: Redirect back to sign up if another user with the same email already exists
        req.flash("error", "User with this email address already exists");
        console.log("User with the same email already exists");
        return res.redirect("/signup");
      }

      return bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
          const user = new User({
            name: name,
            email: email,
            password: hashedPassword,
            cart: { items: [] },
          });

          return user.save();
        })
        .then(() => {
          res.redirect("/login");

          return transporter.sendMail({
            to: email,
            from: "blackbananacutie@gmail.com",
            subject: "Sign up!",
            html: `<h1>Dear ${name}, you have successfully signed up in the node-shop!`,
          });
        })
        .then(() => {
          console.log(`An email was sent to ${email}`);
        })
        .catch((err) => console.error(err));
    })

    .catch((err) => console.error(err));
};
// !: Signup

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect("/login");
  });
};
