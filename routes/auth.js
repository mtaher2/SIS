const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const authController = require("../controllers/authController");
const { isAuthenticated } = require("../utils/auth");

// Login routes
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

// Logout route
router.get("/logout", authController.logout);

// Register routes
router.get("/register", authController.getRegister);
router.post(
  "/register",
  [
    check("username", "Username is required").notEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
    check("first_name", "First name is required").notEmpty(),
    check("last_name", "Last name is required").notEmpty(),
  ],
  authController.postRegister,
);

// Forgot password routes
router.get("/forgot-password", authController.getForgotPassword);
router.post("/forgot-password", authController.postForgotPassword);

// Change password routes (requires authentication)
router.get(
  "/change-password",
  isAuthenticated,
  authController.getChangePassword,
);
router.post(
  "/change-password",
  isAuthenticated,
  [
    check("current_password", "Current password is required").notEmpty(),
    check(
      "new_password",
      "New password must be at least 6 characters",
    ).isLength({ min: 6 }),
    check("confirm_password", "Passwords must match").custom(
      (value, { req }) => value === req.body.new_password,
    ),
  ],
  authController.postChangePassword,
);

// Update password routes
router.get('/update-password', isAuthenticated, authController.getUpdatePassword);
router.post('/update-password', isAuthenticated, [
    check('new_password', 'New password must be at least 8 characters').isLength({ min: 8 }),
    check('confirm_password', 'Passwords must match').custom((value, { req }) => value === req.body.new_password)
], authController.postUpdatePassword);

module.exports = router;
