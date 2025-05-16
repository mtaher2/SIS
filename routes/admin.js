const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const adminController = require("../controllers/adminController");
const { isAuthenticated, isAdmin } = require("../utils/auth");

// Apply middleware to all admin routes
router.use(isAuthenticated, isAdmin);

// Dashboard
router.get("/dashboard", adminController.getDashboard);

// User management
router.get("/users", adminController.getUsers);
router.get("/users/create", adminController.getCreateUser);
router.post(
  "/users/create",
  [
    check("username", "Username is required").notEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({
      min: 6,
    }),
    check("first_name", "First name is required").notEmpty(),
    check("last_name", "Last name is required").notEmpty(),
    check("role", "Role is required").notEmpty(),
  ],
  adminController.postCreateUser,
);
router.get("/users/edit/:id", adminController.getEditUser);
router.post(
  "/users/edit/:id",
  [
    check("email", "Please include a valid email").isEmail(),
    check("first_name", "First name is required").notEmpty(),
    check("last_name", "Last name is required").notEmpty(),
  ],
  adminController.postEditUser,
);
router.delete("/users/delete/:id", adminController.deleteUser);

// Admin reset user password route
router.get("/users/reset-password/:id", adminController.getResetPassword);
router.post("/users/reset-password/:id", adminController.postResetPassword);

// Course management
router.get("/courses", adminController.getCourses);
router.get("/courses/create", adminController.getCreateCourse);
router.post(
  "/courses/create",
  [
    check("course_code", "Course code is required").notEmpty(),
    check("title", "Title is required").notEmpty(),
    check("credit_hours", "Credit hours must be a valid number").isNumeric(),
    check("semester_id", "Semester is required").notEmpty(),
  ],
  adminController.postCreateCourse,
);
router.get("/courses/edit/:id", adminController.getEditCourse);
router.post(
  "/courses/edit/:id",
  [
    check("course_code", "Course code is required").notEmpty(),
    check("title", "Title is required").notEmpty(),
    check("credit_hours", "Credit hours must be a valid number").isNumeric(),
    check("semester_id", "Semester is required").notEmpty(),
  ],
  adminController.postEditCourse,
);
router.delete("/courses/delete/:id", adminController.deleteCourse);

// Course student management
router.get("/courses/:id/students", adminController.getCourseStudents);
router.post("/courses/:id/students/add", adminController.addStudentToCourse);
router.post(
  "/courses/:id/students/remove",
  adminController.removeStudentFromCourse,
);

// Announcement management
router.get("/announcements", adminController.getAnnouncements);
router.get("/announcements/create", adminController.getCreateAnnouncement);
router.post(
  "/announcements/create",
  [
    check("title", "Title is required").notEmpty(),
    check("content", "Content is required").notEmpty(),
    check("target_type", "Target type is required").notEmpty(),
  ],
  adminController.postCreateAnnouncement,
);
router.get("/announcements/edit/:id", adminController.getEditAnnouncement);
router.post(
  "/announcements/edit/:id",
  [
    check("title", "Title is required").notEmpty(),
    check("content", "Content is required").notEmpty(),
    check("target_type", "Target type is required").notEmpty(),
  ],
  adminController.postEditAnnouncement,
);
router.delete("/announcements/delete/:id", adminController.deleteAnnouncement);

// Grade Approval Routes
router.get("/grade-approvals", adminController.getGradeApprovals);
router.get("/grades/:courseId/details", adminController.getGradeDetails);
router.post("/grades/:courseId/approve", adminController.approveGrades);
router.post("/grades/:courseId/reject", adminController.rejectGrades);

// Method Override for DELETE requests
router.post("/users/delete/:id", (req, res) => {
  adminController.deleteUser(req, res);
});

router.post("/courses/delete/:id", (req, res) => {
  adminController.deleteCourse(req, res);
});

router.post("/announcements/delete/:id", (req, res) => {
  adminController.deleteAnnouncement(req, res);
});

module.exports = router;
