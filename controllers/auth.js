require("dotenv").config();
const crypto = require("crypto");

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

// ?: Reset Password
exports.getReset = (req, res, next) => {
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: req.flash("error")[0],
  });
};

exports.postReset = (req, res, next) => {
  const email = req.body.email;
  console.log(`Email: ${email}`);

  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");

    User.findOne({ email: email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that email found.");
          res.redirect("/reset");
          throw "No account with that email found";
        }

        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;

        return user.save();
      })
      .then((user) => {
        res.redirect("/login");
        console.log(`Token: ${token}`);

        return transporter.sendMail({
          to: email,
          from: "blackbananacutie@gmail.com",
          subject: "Password Reset",
          html: `
          <h1 style="color: red;">Dear ${user.name},</h1>
			    <h4>You have requested a password reset</h4>
          <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password</p>
          `,
        });
      })
      .then((message) => console.log(message))
      .catch((err) => console.error(err));
  });
};
// !: Reset Password

// ?: New Password
exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;

  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        req.flash("error", "There was an error, Please try again");
        res.redirect("/login");
        throw "There was an error, Please try again";
      }

      res.render("auth/newPw", {
        path: "/newPw",
        pageTitle: "New Password",
        userId: user._id.toString(),
        errorMessage: req.flash("error")[0],
        passwordToken: token,
      });
    })
    .catch((err) => console.error(err));
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      if (!user) {
        req.flash("error", "No account with that email found.");
        res.redirect("/reset");
        throw "No account with that email found";
      }

      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;

      resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => console.error(err));
};
// !: New Password
