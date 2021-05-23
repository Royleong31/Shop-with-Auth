const path = require("path");
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const errorController = require("./controllers/error");
const User = require("./models/user");

const app = express();

const store = new MongoDBStore({
  uri: process.env.MONGO_ADDRESS,
  collection: "sessions",
});

const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    // ?: By including new DateTime, we can ensure that the file name is unique
    cb(null, uuidv4() + "=" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  // ?: If the file type is jpg or png, save it. Otherwise, don't
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true); // ?: true means that the file is to be saved
  } else {
    cb(null, false); // ?: false means that the file is not to be saved
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
); // ?: image is the name of the file that is passed

app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static(path.join(__dirname, "images"))); // ?: First argument tells express that when a link is to /images, serve the files from the images folder. Otherwise, it will assume that the files are from the root directory

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
    // TODO: cookie
  })
);

app.use(csrfProtection); // ?: Needs to be after the session but before the app.use(routes)
app.use(flash()); // ?: Can be used to flash messages to the next page

// ?: this can help to set the variables to all requests
app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  // !: If error is thrown in sync code, no need to use next(), but next() is needed when the error occurs in async code
  if (!req.session.user) return next();

  User.findById(req.session.user._id)
    .then((user) => {
      // ?: If a user cannot be found, move on to the next operation
      if (!user) return next();
      req.user = user;
      next();
    })
    .catch((err) => {
      console.error(err);
      next(new Error(err)); // ?: Rethrow error. Possible database problem
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500);

app.use(errorController.get404); // ?: This needs to be the last one as it handles all other routes that were not redirected earlier

app.use((error, req, res, next) => {
  // res.status(error.httpStatusCode).render(...)
  // !: try not to redirect to another page as this can lead to an infinite loop
  res.status(500).render("500", {
    pageTitle: "Server Error",
    path: "/500",
  });
});

mongoose
  .connect(process.env.MONGO_ADDRESS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    app.listen(3000);
  })
  .catch((err) => {
    console.log(err);
  });
