const path = require("path");
const { body } = require("express-validator");

const express = require("express");

const adminController = require("../controllers/admin");
const isAuth = require("../middleware/is-auth");
const router = express.Router();

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

router.get("/add-product", isAuth, adminController.getAddProduct);

router.post(
  "/add-product",
  [
    body("title", "Title needs to be at least 3 characters long")
      .trim()
      .isString()
      .isLength({ min: 3 }),
    // body("imageUrl", "Please enter a valid URL").trim().isURL(),
    body("price", "Please enter a positive number").trim().isFloat(),
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

router.post("/delete-product", isAuth, adminController.postDeleteProduct);

router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

module.exports = router;
