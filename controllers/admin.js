const Product = require("../models/product");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const fileHelper = require("../util/file");

// !: GET ROUTES
exports.getAddProduct = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    errorMessage: req.flash("error")[0],
    validationErrors: [],
    product: {
      title: "",
      price: "",
      description: "",
    },
  });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;

  Product.findById(prodId)
    .then((product) => {
      console.log(product);

      if (!product) {
        return res.redirect("/");
      }

      return res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: true,
        product: product,
        errorMessage: req.flash("error")[0],
        validationErrors: [],
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  // ?: Find all products that are have this user's id
  Product.find({ userId: req.user._id })
    // .select('title price -_id')
    // .populate('userId', 'name')
    // Product.find()
    .then((products) => {
      console.log(products);
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

// !: POST ROUTES

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  const errors = validationResult(req); // ?:errors come from express-validator in the routes

  // ?: Since the image cannot be checked in routes, it is checked here.
  // ?: If image === undefined,
  if (!image) {
    console.log("User put in an invalid file type");
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/edit-product",
      editing: false,
      validationErrors: [],
      errorMessage: "Attached file is not an image",
      product: {
        title: title,
        price: price,
        description: description,
      },
    });
  }

  console.log("Image: ");
  console.log(image);

  if (!errors.isEmpty()) { // ?: If there is an error
    const errorFields = errors.array().map((error) => error.param);
    console.log(errorFields);

    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/edit-product",
      editing: false,
      validationErrors: errorFields, // ?: Send the erroneous fields so that they can be highlighted to user
      errorMessage: errors.array()[0].msg, // ?: Use the error message of the first error
      product: {
        title: title,
        price: price,
        description: description,
      },
    });
  }

  const imageUrl = image.path; // ?: Gets file location

  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl, // ?: Only the file location is stored in the database, not the actual image
    userId: req.session.user,
  });

  product
    .save()
    .then((result) => {
      // console.log(result);
      console.log("Created Product");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

      // res.redirect("/500"); // ?: One way of handling errors is to redirect to a specific error page

      // ?: This can be used if the problem is localised. Just re-render the same page with error message
      // return res.status(500).render("admin/edit-product", {
      //   pageTitle: "Add Product",
      //   path: "/admin/edit-product",
      //   editing: false,
      //   validationErrors: [],
      //   errorMessage: "Database operation failed, please try again",
      //   product: {
      //     title: title,
      //     image: image,
      //     price: price,
      //     description: description,
      //   },
      // });
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorFields = errors.array().map((error) => error.param);
    console.log(errorFields);

    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/edit-product",
      editing: true,
      validationErrors: errorFields,
      errorMessage: errors.array()[0].msg,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId,
      },
    });
  }

  Product.findById(prodId) // ?: If the user tries to access a product that he did not create (unauthorised access)
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        res.redirect("/");
        throw "user trying to edit unauthorised item";
      }

      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      // TODO: Currently, if user puts in an invalid file, no error message will be given; the old image will just be used as before
      if (image) {
        fileHelper.deleteFile(product.imageUrl); // ?: Delete imageUrl if the product's image was edited
        product.imageUrl = image.path;
      }
      return product.save(); // ?: returns a promise, so that page will only redirect when product was saved successfully
    })
    .then((result) => {
      console.log("UPDATED PRODUCT!");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;

  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return next(new Error("Product was not found"));
      }
      fileHelper.deleteFile(product.imageUrl); // ?: Delete imageUrl if the product's image was edited

      return Product.deleteOne({ _id: prodId, userId: req.user._id }); // ?: Delete one is returned as a promise to ensure that deleting the product occurs after the product's file has been deleted. This is to prevent race condition whereby the database doc is deleted before the product is found by Product.findById
    })
    .then(() => {
      console.log("DESTROYED PRODUCT");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      console.error(err);
      next(error);
    });
};
