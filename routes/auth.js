const { check, body } = require("express-validator");
const express = require("express");
const router = express.Router();

const User = require("../models/user");
const authController = require("../controllers/auth");

router.get("/login", authController.getLogin);
router.post(
  "/login",
  [
    body("email", "Please enter a valid email")
      .trim()
      .normalizeEmail()
      .isEmail(),

    body(
      "password",
      "Please enter a password with only letters and numbers and at least 5 chars long"
    )
      .trim()
      .isLength({ min: 5, max: 20 })
      .isAlphanumeric(),
  ],
  authController.postLogin
);

router.post("/logout", authController.postLogout);

router.get("/signup", authController.getSignup);
router.post(
  "/signup",
  [
    // ?: Array is optional (only needed if there is more than 1 condition)
    check("email")
      .normalizeEmail()
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom(async (value, { req }) => {
        // if (value === "test@test.com") {
        //   throw new Error("This email address is forbidden");
        // }

        const userDoc = await User.findOne({ email: value });
        if (userDoc) {
          // ?: Async throw error, express-validator will wait until promise is fulfilled before moving on to the next step (controller)
          return Promise.reject(
            "Email already exists, please pick another one"
          );
        }
      }),

    body(
      "password",
      "Please enter a password with only letters and numbers and at least 5 chars long"
    )
      .trim()
      .isLength({ min: 5, max: 20 })
      // ?: .withMessage()  Adds a custom message for the isLength check only
      .isAlphanumeric(),

    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value === req.body.password) {
          return true;
        }

        throw new Error("Passwords have to match");
      }),

    body("name", "Please enter a valid name")
      .trim()
      .isString()
      .isLength({ min: 1 }),
  ],
  authController.postSignup
); // ?: withMessage(custom message)

router.get("/reset", authController.getReset);
router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPassword); // TODO: implement check if confirmPassword matches password
router.post("/newPw", authController.postNewPassword);

module.exports = router;
