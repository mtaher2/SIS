const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const dotenv = require("dotenv");

// Load environment variables from config.env file
dotenv.config({ path: "./config.env" });

// Import database connection
const db = require("./db");

// Import routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const instructorRoutes = require("./routes/instructor");
const studentRoutes = require("./routes/student");
const courseRoutes = require("./routes/courses");
const announcementRoutes = require("./routes/announcements");
const apiRoutes = require("./routes/api");
const chatRoutes = require("./routes/chat");

// Import auth middleware
const { restrictAccess } = require("./utils/auth");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Custom render function
app.use((req, res, next) => {
  // Override the default render method
  const originalRender = res.render;
  res.render = function (view, options, callback) {
    // Ensure options contains user info even if undefined
    if (!options) {
      options = {};
    }

    // Make sure user is defined even if it's null
    if (typeof options.user === "undefined") {
      options.user = req.session && req.session.user ? req.session.user : null;
    }

    if (options && !options.layout && view !== "layouts/main") {
      // If no layout specified and not rendering the layout itself
      // First, render the view content
      originalRender.call(this, view, options, (err, content) => {
        if (err) return callback ? callback(err) : next(err);

        // Ensure we always have valid options with user info for layout
        const layoutOptions = { ...options, body: content };

        // Then, render with the layout
        originalRender.call(this, "layouts/main", layoutOptions, callback);
      });
    } else {
      // Regular rendering (for layout or when layout is explicitly specified)
      originalRender.call(this, view, options, callback);
    }
  };
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});

// Apply access restriction middleware to all routes
app.use(restrictAccess);

// Routes
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/instructor", instructorRoutes);
app.use("/student", studentRoutes);
app.use("/courses", courseRoutes);
app.use("/announcements", announcementRoutes);
app.use("/api", apiRoutes);
app.use("/chat", chatRoutes);

// Home route
app.get("/", (req, res) => {
  res.render("index", {
    title: "Student Information System",
    user: req.session.user,
  });
});

// 404 error handler (Page not found)
app.use((req, res, next) => {
  res.status(404).render("errors/not-found", {
    title: "404 - Page Not Found",
    message: "The page you are looking for does not exist.",
    user: req.session.user,
  });
});

// 403 error handler (Forbidden access)
app.use((err, req, res, next) => {
  if (err && err.statusCode === 403) {
    return res.status(403).render("errors/forbidden", {
      title: "403 - Access Denied",
      message:
        err.message || "You do not have permission to access this resource.",
      user: req.session.user,
    });
  }
  next(err);
});

// 500 error handler (Server error)
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).render("errors/server-error", {
    title: "500 - Server Error",
    message: "Something went wrong on our server. Please try again later.",
    user: req.session.user,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});
