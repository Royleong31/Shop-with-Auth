const path = require("path");
const { body } = require("express-validator");

const express = require("express");

const adminController = require("../controllers/admin");
const isAuth = require("../middleware/is-auth"); // ?: isAuth will run before the controller and will redirect non logged in users back to the login page
const router = express.Router();

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

router.get("/add-product", isAuth, adminController.getAddProduct);

router.post(
  "/add-product",
  [
    body("title", "Title needs to be at least 3 characters long") // ?: First argument is the name of the input field. Second is the error message
      .trim()
      .isString()
      .isLength({ min: 3 }),
    // body("imageUrl", "Please enter a valid URL").trim().isURL(),
    body("price", "Please enter a positive number").trim().isFloat(), // ?: Positive number check is done client side
    body("description", "Description needs to be at least 5 characters long")
      .trim()
      .isLength({ min: 5, max: 400 }),
  ],
  isAuth,
  adminController.postAddProduct
);

router.post(
  "/edit-product",
  [
    body("title", "Title needs to be at least 3 characters long")
      .trim()
      .isString()
      .isLength({ min: 3 }),
    body("price", "Please enter a positive number").trim().isFloat(),
    body("description", "Description needs to be at least 5 characters long")
      .trim()
      .isLength({ min: 5, max: 400 }),
  ],
  isAuth,
  adminController.postEditProduct
);

// ?: Browser only knows get and post, but we can also use other verbs such as delete, patch etc.
router.delete("/product/:productId", isAuth, adminController.deleteProduct);

router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

module.exports = router;
