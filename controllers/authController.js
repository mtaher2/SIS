const User = require("../models/User");
const Student = require("../models/Student");
const Instructor = require("../models/Instructor");
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");

// Render login page
exports.getLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }

  res.render("auth/login", {
    title: "Login",
    user: null,
  });
};

// Process login form
exports.postLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find the user
    const user = await User.findByUsername(username);

    if (!user) {
      req.flash("error_msg", "Invalid username or password");
      return res.redirect("/auth/login");
    }

    // Check if user is active
    if (!user.is_active) {
      req.flash(
        "error_msg",
        "Your account has been deactivated. Please contact an administrator.",
      );
      return res.redirect("/auth/login");
    }

    // Verify password
    const isMatch = await User.verifyPassword(user, password);

    if (!isMatch) {
      req.flash("error_msg", "Invalid username or password");
      return res.redirect("/auth/login");
    }

    // Store user in session (exclude password)
    const { password: _, ...userWithoutPassword } = user;
    req.session.user = userWithoutPassword;

    // Redirect based on role
    if (user.role === "admin") {
      return res.redirect("/admin/dashboard");
    } else if (user.role === "instructor") {
      return res.redirect("/instructor/dashboard");
    } else if (user.role === "student") {
      return res.redirect("/student/dashboard");
    } else {
      return res.redirect("/");
    }
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error_msg", "An error occurred. Please try again later.");
    res.redirect("/auth/login");
  }
};

// Logout user
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect("/");
    }
    res.redirect("/auth/login");
  });
};

// Render registration form
exports.getRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }

  res.render("auth/register", {
    title: "Register",
    user: null,
  });
};

// Process registration form
exports.postRegister = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).render("auth/register", {
        title: "Register",
        user: null,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const {
      username,
      email,
      password,
      first_name,
      last_name,
      role,
      student_id,
      department,
    } = req.body;

    // Check if username already exists
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      req.flash("error_msg", "Username already exists");
      return res.redirect("/auth/register");
    }

    // Check if email already exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      req.flash("error_msg", "Email already exists");
      return res.redirect("/auth/register");
    }

    // Create the user
    const userData = {
      username,
      email,
      password,
      first_name,
      last_name,
      role: "student", // Default to student for public registration
    };

    const userId = await User.create(userData);

    // Create student profile if user is a student
    if (userData.role === "student") {
      const studentData = {
        user_id: userId,
        student_id:
          student_id || `STU${Math.floor(10000 + Math.random() * 90000)}`,
        enrollment_date: new Date(),
        current_semester: 1,
      };

      await Student.create(studentData);
    }

    req.flash("success_msg", "You are now registered and can log in");
    res.redirect("/auth/login");
  } catch (error) {
    console.error("Registration error:", error);
    req.flash(
      "error_msg",
      "An error occurred during registration. Please try again later.",
    );
    res.redirect("/auth/register");
  }
};

// Render forgot password page
exports.getForgotPassword = (req, res) => {
  res.render("auth/forgot-password", {
    title: "Forgot Password",
    user: null,
  });
};

// Process forgot password form
exports.postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);

    if (!user) {
      req.flash("error_msg", "No account with that email address exists");
      return res.redirect("/auth/forgot-password");
    }

    // In a real application, you would:
    // 1. Generate a reset token
    // 2. Store it in the database with an expiration
    // 3. Send an email with a reset link

    // For now, just show a success message
    req.flash(
      "success_msg",
      "If an account exists with that email, a password reset link will be sent.",
    );
    res.redirect("/auth/login");
  } catch (error) {
    console.error("Forgot password error:", error);
    req.flash("error_msg", "An error occurred. Please try again later.");
    res.redirect("/auth/forgot-password");
  }
};

// Render change password page
exports.getChangePassword = (req, res) => {
  res.render("auth/change-password", {
    title: "Change Password",
    user: req.session.user,
  });
};

// Process change password form
exports.postChangePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const userId = req.session.user.user_id;

    // Validate new password
    if (new_password !== confirm_password) {
      req.flash("error_msg", "New passwords do not match");
      return res.redirect("/auth/change-password");
    }

    // Find the user
    const user = await User.findById(userId);

    // Verify current password
    const isMatch = await User.verifyPassword(user, current_password);

    if (!isMatch) {
      req.flash("error_msg", "Current password is incorrect");
      return res.redirect("/auth/change-password");
    }

    // Update password
    await User.updatePassword(userId, new_password);

    req.flash("success_msg", "Password updated successfully");
    res.redirect("/");
  } catch (error) {
    console.error("Change password error:", error);
    req.flash("error_msg", "An error occurred. Please try again later.");
    res.redirect("/auth/change-password");
  }
};
