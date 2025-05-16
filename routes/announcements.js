const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../utils/auth");
const Announcement = require("../models/Announcement");

// Apply authentication middleware to all announcement routes
router.use(isAuthenticated);

// View all public announcements (requires authentication now)
router.get('/', async (req, res) => {
    try {
        const filter = req.query.filter;
        const filters = {
            target_type: 'all',
            is_active: true
        };
        
        // Apply spam filtering
        if (filter === 'spam') {
            filters.is_spam = true;
        } else if (filter === 'regular') {
            filters.is_spam = false;
        }
        
        const announcements = await Announcement.findAll(filters);
        
        res.render('announcements/index', {
            title: 'Announcements',
            user: req.session.user,
            announcements,
            filters // Pass filters to template
        });
    } catch (error) {
        console.error('Error getting announcements:', error);
        req.flash('error_msg', 'An error occurred while retrieving announcements');
        res.redirect('/');
    }
});

// View single announcement
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const announcementId = req.params.id;
    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      req.flash("error_msg", "Announcement not found");
      return res.redirect("/announcements");
    }

    // Check if user can view this announcement
    let canView = false;

    // Admin can view all announcements
    if (req.session.user.role === "admin") {
      canView = true;
    }
    // Public announcements can be viewed by all authenticated users
    else if (announcement.target_type === "all") {
      canView = true;
    }
    // Role-specific announcements
    else if (
      announcement.target_type === "instructors" &&
      req.session.user.role === "instructor"
    ) {
      canView = true;
    } else if (
      announcement.target_type === "students" &&
      req.session.user.role === "student"
    ) {
      canView = true;
    }
    // Course-specific announcements require checking enrollment or assignment
    else if (announcement.target_type === "course") {
      if (req.session.user.role === "instructor") {
        // Check if instructor is assigned to this course
        const instructorId = req.session.user.user_id;
        const db = require("../db");

        const [rows] = await db.query(
          "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
          [announcement.course_id, instructorId],
        );

        canView = rows.length > 0;
      } else if (req.session.user.role === "student") {
        // Check if student is enrolled in this course
        const studentId = req.session.user.user_id;
        const db = require("../db");

        const [rows] = await db.query(
          "SELECT * FROM enrollments WHERE course_id = ? AND student_id = ? AND status = 'active'",
          [announcement.course_id, studentId],
        );

        canView = rows.length > 0;
      }
    }

    if (!canView) {
      req.flash(
        "error_msg",
        "You are not authorized to view this announcement",
      );
      return res.redirect("/announcements");
    }

    res.render("announcements/view", {
      title: announcement.title,
      user: req.session.user,
      announcement,
    });
  } catch (error) {
    console.error("Error viewing announcement:", error);
    req.flash(
      "error_msg",
      "An error occurred while retrieving the announcement",
    );
    res.redirect("/announcements");
  }
});

module.exports = router;
