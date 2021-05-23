require("dotenv").config();
const { validationResult } = require("express-validator");

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
    validationErrors: [],
    oldInput: { email: "", password: "" },
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const errors = validationResult(req);
  // res.setHeader("Set-Cookie", "loggedIn=true; HttpOnly");

  if (!errors.isEmpty()) {
    console.log(errors.array()[0].msg);
    const errorFields = errors.array().map((error) => error.param);

    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errorMessage: errors.array()[0].msg, // ?: The first message
      validationErrors: errorFields,
      oldInput: { email: email, password: password },
    });
  }

  User.findOne({ email: email })
    .then((user) => {
      console.log(user);

      if (!user) {
        console.log("Invalid email or password");
        req.flash("error", "Invalid email");

        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "Login",
          errorMessage: "Invalid email",
          validationErrors: ["email"],
          oldInput: { email: email, password: password },
        });
      }

      bcrypt
        .compare(password, user.password) // ?: Compares hash of inputted password to hash of user's password
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true; // ?: Store the loggedIn and user details in the session
            req.session.user = user;

            return req.session.save((err) => {
              if (err) console.log(err);
              res.redirect("/");
            });
          }

          return res.status(422).render("auth/login", { // ?: If there was no match, return an error to the user
            path: "/login",
            pageTitle: "Login",
            errorMessage: "Invalid password",
            validationErrors: ["password"],
            oldInput: { email: email, password: password },
          });
        })

        .catch((err) => {
          console.error(err);
          res.redirect("/login");
        });
      // ? Redirect after session has been saved
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
// !: Login

// ?: Signup
exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Sign Up",
    errorMessage: req.flash("error")[0],
    oldInput: { email: "", password: "", name: "", confirmPassword: "" },
    validationErrors: [],
  });
};

exports.postSignup = (req, res, next) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors = validationResult(req); // ?: Collects the errors from the express-validator check

  if (!errors.isEmpty()) {
    const errorFields = errors.array().map((error) => error.param);
    console.log(errorFields);

    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Sign Up",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        name: name,
        confirmPassword: confirmPassword,
      },
      validationErrors: errorFields,
    });
  }

  bcrypt
    .hash(password, 12) // ?: 12 rounds of hashing
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
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
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

  crypto.randomBytes(32, (err, buffer) => { // ?: Generate a random string to be used as an auth token
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex"); // ?: Convert the string into hex

    User.findOne({ email: email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that email found.");
          res.redirect("/reset");
          throw "No account with that email found"; // !: 
        }

        // ?: Set details to be stored in the user doc
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
      .catch((err) => {
        console.log(err);
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
};
// !: Reset Password

// ?: New Password
exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;

  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() }, // ?: Check if the expiry date is after the current time
  })
    .then((user) => {
      if (!user) {
        req.flash("error", "There was an error, Please try again"); // ?: If there is no such token or it has expired, redirect back to login
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
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
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
        res.redirect("/reset"); // !:
        throw "No account with that email found";
      }

      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined; // ?: Can be set to undefined or null
      resetUser.resetTokenExpiration = undefined;

      resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
// !: New Password
