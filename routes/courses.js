const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../utils/auth");
const Course = require("../models/Course");

// Apply authentication middleware to all course routes
router.use(isAuthenticated);

// View all active courses (requires authentication now)
router.get("/", async (req, res) => {
  try {
    const { search, semester_id } = req.query;
    const filters = {
      is_active: true,
    };

    // Add semester filter if provided
    if (semester_id) {
      filters.semester_id = semester_id;
    }

    // Get all semesters for the filter dropdown
    const db = require("../db");
    const [semesters] = await db.query(
      "SELECT * FROM semesters ORDER BY start_date DESC",
    );

    // Get courses with search and filters
    const courses = await Course.search(search, filters);

    res.render("courses/index", {
      title: "Available Courses",
      user: req.session.user,
      courses,
      semesters,
      search,
      semester_id,
    });
  } catch (error) {
    console.error("Error getting courses:", error);
    req.flash("error_msg", "An error occurred while retrieving courses");
    res.redirect("/");
  }
});

// View course details (requires authentication)
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId);

    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/courses");
    }

    // Get course instructors
    const instructors = await Course.getInstructors(courseId);

    // Different data based on user role
    if (req.session.user.role === "admin") {
      // Admin can see everything
      return res.redirect(`/admin/courses/edit/${courseId}`);
    } else if (req.session.user.role === "instructor") {
      // Check if instructor is assigned to this course
      const instructorId = req.session.user.user_id;
      const db = require("../db");

      const [rows] = await db.query(
        "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
        [courseId, instructorId],
      );

      if (rows.length > 0) {
        return res.redirect(`/instructor/courses/${courseId}`);
      }
    } else if (req.session.user.role === "student") {
      // Check if student is enrolled in this course
      const studentId = req.session.user.user_id;
      const db = require("../db");

      const [rows] = await db.query(
        "SELECT * FROM enrollments WHERE course_id = ? AND student_id = ? AND status = 'active'",
        [courseId, studentId],
      );

      if (rows.length > 0) {
        return res.redirect(`/student/courses/${courseId}`);
      }
    }

    // Default view for authenticated users who aren't enrolled/assigned
    res.render("courses/view", {
      title: course.title,
      user: req.session.user,
      course,
      instructors,
    });
  } catch (error) {
    console.error("Error viewing course:", error);
    req.flash("error_msg", "An error occurred while retrieving the course");
    res.redirect("/courses");
  }
});

module.exports = router;
