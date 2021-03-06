require("dotenv").config();
const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const stripe = require("stripe")(process.env.STRIPE_SK); // !: Never expose the STRIPE Secret Key

const ITEMS_PER_PAGE = 3;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1; // ?: if there is no query page param, then set page = 1
  let totalItems;

  Product.find()
    .countDocuments() // ?: Returns the number of documents
    .then((numProducts) => {
      totalItems = numProducts;

      // ?: Returns a promise, so number of documents is first counted and then fetched
      return (
        Product.find()
          // ?: In SQL, skip and limit are replaced by OFFSET and LIMIT respectively. Read more on sequelize docs
          // ?: If on page 1, get first 2 items (skip 0). If on page 2, get next 2 items (skip 2) ...
          .skip((page - 1) * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE)
      );
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        // csrfToken: req.csrfToken(), // ?: No need is it is applied to all requests in app.js
      });
    })
    .catch((err) => {
      console.log("Error" + err);
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1; // ?: if there is no query page param, then set page = 1
  let totalItems;

  Product.find()
    .countDocuments() // ?: Returns the number of documents
    .then((numProducts) => {
      totalItems = numProducts;

      // ?: Returns a promise, so number of documents is first counted and then fetched
      return (
        Product.find()
          // ?: In SQL, skip and limit are replaced by OFFSET and LIMIT respectively. Read more on sequelize docs
          // ?: If on page 1, get first 2 items (skip 0). If on page 2, get next 2 items (skip 2) ...
          .skip((page - 1) * ITEMS_PER_PAGE)
          .limit(ITEMS_PER_PAGE)
      );
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        // csrfToken: req.csrfToken(), // ?: No need is it is applied to all requests in app.js
      });
    })
    .catch((err) => {
      console.log("Error" + err);
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  // TODO: Figure out how this works!!
  req.user // ?: req.user is the current user object
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      console.log(user.cart);
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      console.log("Product");
      console.log(product);
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log(result);
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      console.log(user);
      const products = user.cart.items.map((item) => {
        return {
          productData: { ...item.productId._doc },
          quantity: item.quantity,
        };
      });
      console.log(products);

      const order = new Order({
        user: {
          name: req.user.name,
          userId: req.user,
        },

        products,
      });

      return order.save();
    })
    .then(() => {
      return req.user.clearCart();
    })
    .then(() => res.redirect("/orders"))
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  if (!req.user) {
    res.render("shop/orders", {
      path: "/orders",
      pageTitle: "Your Orders",
      orders: [],
    });
  }

  Order.find({ "user.userId": req.user._id }) // ?: Custom predicate
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found"));
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        throw new Error("Unauthorised!"); // ?: By throwing error, it will be caught in the catch then next(err) will be called
      }

      const invoiceName = `invoice-${orderId}.pdf`;
      const invoicePath = path.join("data", "invoices", invoiceName);
      let totalPrice = 0;

      const pdfDoc = new PDFDocument(); // ?: Creates a stream
      res.setHeader("Content-Type", "application/pdf"); // ?: Sets file type
      res.setHeader("Content-Disposition", `inline; filename=${invoiceName}`); // ?: inline: shows up in browser; filename=: file name of downloaded file
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text("Invoice", {
        // ?: Writes onto the file
        underline: true,
      });
      pdfDoc.text("--------------");

      order.products.forEach((prod) => {
        const price = prod.quantity * prod.productData.price;
        totalPrice += price;

        pdfDoc
          .fontSize(14)
          .text(`${prod.productData.title} x $${prod.quantity} = $${price}`);
      });

      pdfDoc.text("-------");
      pdfDoc.fontSize(20).text(`Total Price: $${totalPrice}`);
      pdfDoc.end(); // ?: Closes file and stream. Proceeds to send file

      // ?: Serving files via streams is better as the server does not need to store the whole file in memory. It only needs to forward it to the browser
      // const file = fs.createReadStream(invoicePath);
      // res.setHeader("Content-Type", "application/pdf");
      // res.setHeader("Content-Disposition", `inline; filename=${invoiceName}`);
      // file.pipe(res);

      // ?: Reading files and then sending to user can be slow especially if the file is large or there are many users
      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err); // ?: creates an error that will be handled by the error handler function
      //   }

      //   res.setHeader("Content-Type", "application/pdf");
      //   res.setHeader("Content-Disposition", `inline; filename=${invoiceName}`); // ?: inline opens the attachment directly in browser
      //   // res.setHeader("Content-Disposition", `attachment; filename=${invoiceName}`); // ?: attachment downloads the file with the correct file name
      //   res.send(data);
      //   res.end();
      // });
    })
    .catch((err) => {
      console.error(err);
      next(err);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let totalSum = 0;

  // TODO: Figure out how this works!!
  req.user // ?: req.user is the current user object
    .populate("cart.items.productId") // ?: populate gets data from another collection(products)
    .execPopulate()
    .then((user) => {
      products = user.cart.items;

      products.forEach((prod) => {
        totalSum += prod.quantity * prod.productId.price; // ?: With the relationship in mongodb, can query products collection
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: products.map(p => { // ?: this will return an array of objects
          return { 
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: 'usd',
            quantity: p.quantity
          }
        }),
        success_url: req.protocol + '://' + req.get('host') + '/checkout/success', // ?: Url of the domain + /checkout/success
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel',
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum,
        pk: process.env.STRIPE_PK,
        sessionId: session.id,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
