const User = require("../models/User");
const Student = require("../models/Student");
const Instructor = require("../models/Instructor");
const Course = require("../models/Course");
const Announcement = require("../models/Announcement");
const { validationResult } = require("express-validator");
const db = require("../db");

// Admin dashboard
exports.getDashboard = async (req, res) => {
  try {
    // Get counts for dashboard stats
    const studentResults = await User.findByRole("student");
    const instructorResults = await User.findByRole("instructor");
    const courses = (await Course.findAll()) || [];

    const stats = {
      students: Array.isArray(studentResults) ? studentResults.length : 0,
      instructors: Array.isArray(instructorResults)
        ? instructorResults.length
        : 0,
      totalUsers:
        (Array.isArray(studentResults) ? studentResults.length : 0) +
        (Array.isArray(instructorResults) ? instructorResults.length : 0) +
        1, // +1 for admin
      courses: courses.length,
      activeCourses: courses.filter((course) => course.is_active).length,
    };

    // Get recent users
    const users = (await User.findAll()) || [];
    const recentUsers = users.slice(0, 5); // Get only the first 5 users

    // Get recent courses
    const recentCourses = courses.slice(0, 5); // Get only the first 5 courses

    // Get recent announcements
    const announcements =
      (await Announcement.findAll({
        created_by: req.session.user.user_id,
        limit: 5,
      })) || [];

    // Use announcements as recentAnnouncements to match template variable name
    const recentAnnouncements = announcements;

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      user: req.session.user,
      currentUser: req.session.user, // For "current user" comparison
      stats,
      announcements,
      recentUsers,
      recentCourses,
      recentAnnouncements,
    });
  } catch (error) {
    console.error("Error in admin dashboard:", error);
    req.flash("error_msg", "An error occurred while loading the dashboard");
    res.redirect("/");
  }
};

// User management - list all users
exports.getUsers = async (req, res) => {
  try {
    // Get search and filter parameters from query
    const { search, role, status } = req.query;

    // Prepare filters object
    const filters = {};
    if (search) filters.search = search;
    if (role) filters.role = role;
    if (status) filters.status = status;

    // Fetch users with filters
    const users = await User.search(filters);

    res.render("admin/users", {
      title: "User Management",
      user: req.session.user,
      currentUser: req.session.user, // For "current user" comparison in the template
      users,
      search,
      role,
      status,
    });
  } catch (error) {
    console.error("Error getting users:", error);
    req.flash("error_msg", "An error occurred while retrieving users");
    res.redirect("/admin/dashboard");
  }
};

// User management - create user form
exports.getCreateUser = (req, res) => {
  res.render("admin/create-user", {
    title: "Create User",
    user: req.session.user,
  });
};

// User management - process create user form
exports.postCreateUser = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/create-user", {
        title: "Create User",
        user: req.session.user,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const { username, email, password, first_name, last_name, role } = req.body;

    // Check if username already exists
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      req.flash("error_msg", "Username already exists");
      return res.redirect("/admin/users/create");
    }

    // Check if email already exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      req.flash("error_msg", "Email already exists");
      return res.redirect("/admin/users/create");
    }

    // Create user
    const userData = {
      username,
      email,
      password,
      first_name,
      last_name,
      role,
    };

    const userId = await User.create(userData);

    // Create additional profile data based on role
    if (role === "student") {
      const studentData = {
        user_id: userId,
        student_id:
          req.body.student_id ||
          `STU${Math.floor(10000 + Math.random() * 90000)}`,
        enrollment_date: new Date(),
        current_semester: req.body.current_semester || 1,
      };

      await Student.create(studentData);
    } else if (role === "instructor") {
      const instructorData = {
        user_id: userId,
        department: req.body.department || "General",
        office_location: req.body.office_location || null,
        office_hours: req.body.office_hours || null,
      };

      await Instructor.create(instructorData);
    }

    req.flash("success_msg", "User created successfully");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error creating user:", error);
    req.flash("error_msg", "An error occurred while creating the user");
    res.redirect("/admin/users/create");
  }
};

// User management - edit user form
exports.getEditUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }

    // Get additional profile data
    let profileData = null;

    if (user.role === "student") {
      profileData = await Student.findByUserId(userId);
    } else if (user.role === "instructor") {
      profileData = await Instructor.findByUserId(userId);
    }

    res.render("admin/edit-user", {
      title: "Edit User",
      user: req.session.user,
      userData: user,
      profileData,
    });
  } catch (error) {
    console.error("Error getting user for edit:", error);
    req.flash("error_msg", "An error occurred while retrieving the user");
    res.redirect("/admin/users");
  }
};

// User management - process edit user form
exports.postEditUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = await User.findById(userId);

    if (!userData) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }

    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/edit-user", {
        title: "Edit User",
        user: req.session.user,
        userData,
        profileData: req.body,
        errors: errors.array(),
      });
    }

    // Update user
    const userUpdateData = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      is_active: req.body.is_active === "true",
    };

    await User.update(userId, userUpdateData);

    // Update additional profile data
    if (userData.role === "student") {
      const studentData = {
        date_of_birth: req.body.date_of_birth || null,
        address: req.body.address || null,
        phone: req.body.phone || null,
        current_semester: req.body.current_semester || 1,
      };

      await Student.update(userId, studentData);
    } else if (userData.role === "instructor") {
      const instructorData = {
        department: req.body.department || "General",
        office_location: req.body.office_location || null,
        office_hours: req.body.office_hours || null,
      };

      await Instructor.update(userId, instructorData);
    }

    req.flash("success_msg", "User updated successfully");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error updating user:", error);
    req.flash("error_msg", "An error occurred while updating the user");
    res.redirect(`/admin/users/edit/${req.params.id}`);
  }
};

// User management - delete user
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow deleting yourself
    if (userId === req.session.user.user_id.toString()) {
      req.flash("error_msg", "You cannot delete your own account");
      return res.redirect("/admin/users");
    }

    await User.delete(userId);

    req.flash("success_msg", "User deleted successfully");
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error deleting user:", error);
    req.flash("error_msg", "An error occurred while deleting the user");
    res.redirect("/admin/users");
  }
};

// Course management - list all courses
exports.getCourses = async (req, res) => {
  try {
    const { search, semester_id } = req.query;
    const filters = {};

    // Add semester filter if provided
    if (semester_id) {
      filters.semester_id = semester_id;
    }

    // Get all semesters for the filter dropdown
    const [semesters] = await db.query(
      "SELECT * FROM semesters ORDER BY start_date DESC",
    );

    // Get courses with search and filters
    const courses = await Course.search(search, filters);

    res.render("admin/courses", {
      title: "Course Management",
      user: req.session.user,
      courses,
      semesters,
      search,
      semester_id,
    });
  } catch (error) {
    console.error("Error getting courses:", error);
    req.flash("error_msg", "An error occurred while retrieving courses");
    res.redirect("/admin/dashboard");
  }
};

// Course management - create course form
exports.getCreateCourse = async (req, res) => {
  try {
    // Get all instructors for course assignment
    const instructors = await User.findByRole("instructor");

    // Get all semesters
    const [semesters] = await db.query(
      "SELECT * FROM semesters ORDER BY start_date DESC",
    );

    res.render("admin/create-course", {
      title: "Create Course",
      user: req.session.user,
      instructors,
      semesters,
    });
  } catch (error) {
    console.error("Error getting data for course creation:", error);
    req.flash("error_msg", "An error occurred while preparing the course form");
    res.redirect("/admin/courses");
  }
};

// Course management - process create course form
exports.postCreateCourse = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Retrieve data for form again
      const instructors = await User.findByRole("instructor");
      const [semesters] = await db.query(
        "SELECT * FROM semesters ORDER BY start_date DESC",
      );

      return res.status(400).render("admin/create-course", {
        title: "Create Course",
        user: req.session.user,
        instructors,
        semesters,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const {
      course_code,
      title,
      description,
      credit_hours,
      semester_id,
      is_active,
      instructors: selectedInstructors,
    } = req.body;

    // Create course
    const courseData = {
      course_code,
      title,
      description,
      credit_hours,
      semester_id,
      is_active: is_active === "true",
    };

    const courseId = await Course.create(courseData);

    // Assign instructors if selected
    if (selectedInstructors && selectedInstructors.length > 0) {
      if (Array.isArray(selectedInstructors)) {
        for (const instructorId of selectedInstructors) {
          await Course.assignInstructor(courseId, instructorId);
        }
      } else {
        await Course.assignInstructor(courseId, selectedInstructors);
      }
    }

    req.flash("success_msg", "Course created successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Error creating course:", error);
    req.flash("error_msg", "An error occurred while creating the course");
    res.redirect("/admin/courses/create");
  }
};

// Course management - edit course form
exports.getEditCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const course = await Course.findById(courseId);

    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/admin/courses");
    }

    // Get assigned instructors
    const assignedInstructors = await Course.getInstructors(courseId);

    // Get all instructors for selection
    const instructors = await User.findByRole("instructor");

    // Get all semesters
    const [semesters] = await db.query(
      "SELECT * FROM semesters ORDER BY start_date DESC",
    );

    res.render("admin/edit-course", {
      title: "Edit Course",
      user: req.session.user,
      course,
      assignedInstructors,
      instructors,
      semesters,
    });
  } catch (error) {
    console.error("Error getting course for edit:", error);
    req.flash("error_msg", "An error occurred while retrieving the course");
    res.redirect("/admin/courses");
  }
};

// Course management - process edit course form
exports.postEditCourse = async (req, res) => {
  try {
    const courseId = req.params.id;

    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Retrieve data for form again
      const course = await Course.findById(courseId);
      const assignedInstructors = await Course.getInstructors(courseId);
      const instructors = await User.findByRole("instructor");
      const [semesters] = await db.query(
        "SELECT * FROM semesters ORDER BY start_date DESC",
      );

      return res.status(400).render("admin/edit-course", {
        title: "Edit Course",
        user: req.session.user,
        course,
        assignedInstructors,
        instructors,
        semesters,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const {
      course_code,
      title,
      description,
      credit_hours,
      semester_id,
      is_active,
      instructors: selectedInstructors,
    } = req.body;

    // Update course
    const courseData = {
      course_code,
      title,
      description,
      credit_hours,
      semester_id,
      is_active: is_active === "true",
    };

    await Course.update(courseId, courseData);

    // Update instructor assignments

    // First, get current instructors
    const currentInstructors = await Course.getInstructors(courseId);
    const currentInstructorIds = currentInstructors.map((i) => i.user_id);

    // Create an array of selected instructor IDs (handle both single and multiple selections)
    let newInstructorIds = [];
    if (selectedInstructors) {
      newInstructorIds = Array.isArray(selectedInstructors)
        ? selectedInstructors.map((id) => parseInt(id))
        : [parseInt(selectedInstructors)];
    }

    // Remove instructors that are no longer assigned
    for (const instructorId of currentInstructorIds) {
      if (!newInstructorIds.includes(instructorId)) {
        await Course.removeInstructor(courseId, instructorId);
      }
    }

    // Add new instructors
    for (const instructorId of newInstructorIds) {
      if (!currentInstructorIds.includes(instructorId)) {
        await Course.assignInstructor(courseId, instructorId);
      }
    }

    req.flash("success_msg", "Course updated successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Error updating course:", error);
    req.flash("error_msg", "An error occurred while updating the course");
    res.redirect(`/admin/courses/edit/${req.params.id}`);
  }
};

// Course management - delete course
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;

    await Course.delete(courseId);

    req.flash("success_msg", "Course deleted successfully");
    res.redirect("/admin/courses");
  } catch (error) {
    console.error("Error deleting course:", error);
    req.flash("error_msg", "An error occurred while deleting the course");
    res.redirect("/admin/courses");
  }
};

// Announcement management - list all announcements
exports.getAnnouncements = async (req, res) => {
  try {
    // Get search and filter parameters from query
    const { search, target_type, status } = req.query;

    // Prepare filters object
    const filters = {};
    if (search) filters.search = search;
    if (target_type) filters.target_type = target_type;
    if (status === "active") filters.is_active = true;
    if (status === "inactive") filters.is_active = false;

    // Fetch announcements with filters
    const announcements = await Announcement.findAll(filters);

    res.render("admin/announcements", {
      title: "Announcement Management",
      user: req.session.user,
      announcements,
      search,
      target_type,
      status,
    });
  } catch (error) {
    console.error("Error getting announcements:", error);
    req.flash("error_msg", "An error occurred while retrieving announcements");
    res.redirect("/admin/dashboard");
  }
};

// Announcement management - create announcement form
exports.getCreateAnnouncement = async (req, res) => {
  try {
    // Get courses for targeting announcement to a specific course
    const courses = await Course.findAll({ is_active: true });

    res.render("admin/create-announcement", {
      title: "Create Announcement",
      user: req.session.user,
      courses,
    });
  } catch (error) {
    console.error("Error getting data for announcement creation:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the announcement form",
    );
    res.redirect("/admin/announcements");
  }
};

// Announcement management - process create announcement form
exports.postCreateAnnouncement = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Retrieve data for form again
      const courses = await Course.findAll({ is_active: true });

      return res.status(400).render("admin/create-announcement", {
        title: "Create Announcement",
        user: req.session.user,
        courses,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const { title, content, target_type, course_id } = req.body;

    // Create announcement
    const announcementData = {
      title,
      content,
      created_by: req.session.user.user_id,
      target_type,
      course_id: target_type === "course" ? course_id : null,
      is_active: true,
    };

    await Announcement.create(announcementData);

    req.flash("success_msg", "Announcement created successfully");
    res.redirect("/admin/announcements");
  } catch (error) {
    console.error("Error creating announcement:", error);
    req.flash("error_msg", "An error occurred while creating the announcement");
    res.redirect("/admin/announcements/create");
  }
};

// Announcement management - edit announcement form
exports.getEditAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;
    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      req.flash("error_msg", "Announcement not found");
      return res.redirect("/admin/announcements");
    }

    // Get courses for targeting announcement to a specific course
    const courses = await Course.findAll({ is_active: true });

    res.render("admin/edit-announcement", {
      title: "Edit Announcement",
      user: req.session.user,
      announcement,
      courses,
    });
  } catch (error) {
    console.error("Error getting announcement for edit:", error);
    req.flash(
      "error_msg",
      "An error occurred while retrieving the announcement",
    );
    res.redirect("/admin/announcements");
  }
};

// Announcement management - process edit announcement form
exports.postEditAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;

    // Check validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Retrieve data for form again
      const announcement = await Announcement.findById(announcementId);
      const courses = await Course.findAll({ is_active: true });

      return res.status(400).render("admin/edit-announcement", {
        title: "Edit Announcement",
        user: req.session.user,
        announcement,
        courses,
        errors: errors.array(),
        formData: req.body,
      });
    }

    const { title, content, target_type, course_id, is_active } = req.body;

    // Update announcement
    const announcementData = {
      title,
      content,
      target_type,
      course_id: target_type === "course" ? course_id : null,
      is_active: is_active === "true",
    };

    await Announcement.update(announcementId, announcementData);

    req.flash("success_msg", "Announcement updated successfully");
    res.redirect("/admin/announcements");
  } catch (error) {
    console.error("Error updating announcement:", error);
    req.flash("error_msg", "An error occurred while updating the announcement");
    res.redirect(`/admin/announcements/edit/${req.params.id}`);
  }
};

// Announcement management - delete announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id;

    await Announcement.delete(announcementId);

    req.flash("success_msg", "Announcement deleted successfully");
    res.redirect("/admin/announcements");
  } catch (error) {
    console.error("Error deleting announcement:", error);
    req.flash("error_msg", "An error occurred while deleting the announcement");
    res.redirect("/admin/announcements");
  }
};

// User management - reset password form
exports.getResetPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = await User.findById(userId);

    if (!userData) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }

    res.render("admin/reset-password", {
      title: "Reset User Password",
      user: req.session.user,
      userData,
    });
  } catch (error) {
    console.error("Error getting user for password reset:", error);
    req.flash("error_msg", "An error occurred while retrieving the user");
    res.redirect("/admin/users");
  }
};

// User management - process reset password form
exports.postResetPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = await User.findById(userId);

    if (!userData) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }

    const { new_password, confirm_password } = req.body;

    // Validate password and confirmation
    if (!new_password || new_password.length < 6) {
      req.flash("error_msg", "Password must be at least 6 characters");
      return res.redirect(`/admin/users/reset-password/${userId}`);
    }

    if (new_password !== confirm_password) {
      req.flash("error_msg", "Passwords do not match");
      return res.redirect(`/admin/users/reset-password/${userId}`);
    }

    // Update the password
    await User.updatePassword(userId, new_password);

    req.flash(
      "success_msg",
      `Password has been reset successfully for ${userData.first_name} ${userData.last_name}`,
    );
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error resetting user password:", error);
    req.flash("error_msg", "An error occurred while resetting the password");
    res.redirect(`/admin/users/reset-password/${req.params.id}`);
  }
};

// Course student management - view students in a course
exports.getCourseStudents = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { search, status } = req.query;

    // Get course details
    const course = await Course.findById(courseId);

    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/admin/courses");
    }

    // Prepare filters
    const filters = {};
    if (search) filters.search = search;
    if (status) filters.status = status;

    // Get enrolled students
    let students = [];
    try {
      students = await Course.getEnrolledStudents(courseId, filters);
    } catch (error) {
      console.error("Error getting enrolled students:", error);
      req.flash("error_msg", "There was an issue loading enrolled students");
      // Continue with empty students array
    }

    // Get all students for adding new ones
    let allStudents = [];
    try {
      allStudents = await User.findByRole("student");
    } catch (error) {
      console.error("Error getting student users:", error);
      // Continue with empty allStudents array
    }

    // Filter out already enrolled students (with active status)
    const enrolledStudentIds = students
      .filter((s) => s.status === "active")
      .map((s) => s.user_id);

    const availableStudents = allStudents.filter(
      (s) => !enrolledStudentIds.includes(s.user_id),
    );

    res.render("admin/course-students", {
      title: `Students - ${course.title}`,
      user: req.session.user,
      course,
      students,
      availableStudents,
      search,
      status,
    });
  } catch (error) {
    console.error("Error getting course students:", error);
    req.flash(
      "error_msg",
      "An error occurred while retrieving the course students",
    );
    res.redirect("/admin/courses");
  }
};

// Course student management - add student to course
exports.addStudentToCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { student_id } = req.body;

    if (!student_id) {
      req.flash("error_msg", "Student ID is required");
      return res.redirect(`/admin/courses/${courseId}/students`);
    }

    // Enroll student
    await Course.enrollStudent(courseId, student_id);

    req.flash("success_msg", "Student added to course successfully");
    res.redirect(`/admin/courses/${courseId}/students`);
  } catch (error) {
    console.error("Error adding student to course:", error);
    req.flash(
      "error_msg",
      "An error occurred while adding the student to the course",
    );
    res.redirect(`/admin/courses/${req.params.id}/students`);
  }
};

// Course student management - remove student from course
exports.removeStudentFromCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { student_id } = req.body;

    if (!student_id) {
      req.flash("error_msg", "Student ID is required");
      return res.redirect(`/admin/courses/${courseId}/students`);
    }

    // Drop student
    await Course.dropStudent(courseId, student_id);

    req.flash("success_msg", "Student removed from course successfully");
    res.redirect(`/admin/courses/${courseId}/students`);
  } catch (error) {
    console.error("Error removing student from course:", error);
    req.flash(
      "error_msg",
      "An error occurred while removing the student from the course",
    );
    res.redirect(`/admin/courses/${req.params.id}/students`);
  }
};

// Get grade approvals page
exports.getGradeApprovals = async (req, res) => {
  try {
    // Get pending grade approvals
    const [pendingApprovals] = await db.query(
      `SELECT 
                c.course_id,
                c.course_code,
                c.course_name,
                CONCAT(u.first_name, ' ', u.last_name) as instructor_name,
                u.email as instructor_email,
                COUNT(g.student_id) as student_count,
                MAX(g.posted_at) as posted_at
             FROM grades g
             JOIN courses c ON g.course_id = c.course_id
             JOIN users u ON c.instructor_id = u.user_id
             WHERE g.status = 'pending_approval'
             GROUP BY c.course_id, c.course_code, c.course_name, u.first_name, u.last_name, u.email`,
    );

    res.render("admin/grade-approvals", {
      title: "Grade Approvals",
      pendingApprovals,
    });
  } catch (error) {
    console.error("Error in getGradeApprovals:", error);
    req.flash("error_msg", "An error occurred while loading grade approvals");
    res.redirect("/admin/dashboard");
  }
};

// Get grade details for a course
exports.getGradeDetails = async (req, res) => {
  try {
    const courseId = req.params.courseId;

    const [grades] = await db.query(
      `SELECT 
                g.*,
                CONCAT(u.first_name, ' ', u.last_name) as student_name
             FROM grades g
             JOIN users u ON g.student_id = u.user_id
             WHERE g.course_id = ? AND g.status = 'pending_approval'`,
      [courseId],
    );

    res.json({ grades });
  } catch (error) {
    console.error("Error in getGradeDetails:", error);
    res.status(500).json({ error: "Failed to load grade details" });
  }
};

// Approve grades for a course
exports.approveGrades = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const adminId = req.session.user.user_id;

    // Start transaction
    await db.beginTransaction();

    try {
      // Update grades to posted status
      await db.query(
        `UPDATE grades 
                 SET status = 'posted',
                     approved_by = ?,
                     approved_at = CURRENT_TIMESTAMP
                 WHERE course_id = ? AND status = 'pending_approval'`,
        [adminId, courseId],
      );

      // Calculate and update GPA for affected students
      const [students] = await db.query(
        `SELECT DISTINCT student_id 
                 FROM grades 
                 WHERE course_id = ? AND status = 'posted'`,
        [courseId],
      );

      for (const student of students) {
        // Get all posted grades for the student
        const [grades] = await db.query(
          `SELECT g.*, c.credit_hours
                     FROM grades g
                     JOIN courses c ON g.course_id = c.course_id
                     WHERE g.student_id = ? AND g.status = 'posted'`,
          [student.student_id],
        );

        // Calculate semester GPA
        let semesterPoints = 0;
        let semesterCredits = 0;
        let cumulativePoints = 0;
        let cumulativeCredits = 0;

        grades.forEach((grade) => {
          const points = calculateGradePoints(grade.total_score);
          const credits = grade.credit_hours;

          if (grade.semester_id === currentSemesterId) {
            semesterPoints += points * credits;
            semesterCredits += credits;
          }

          cumulativePoints += points * credits;
          cumulativeCredits += credits;
        });

        const semesterGPA =
          semesterCredits > 0 ? semesterPoints / semesterCredits : 0;
        const cumulativeGPA =
          cumulativeCredits > 0 ? cumulativePoints / cumulativeCredits : 0;

        // Insert GPA record
        await db.query(
          `INSERT INTO gpa_records 
                     (student_id, semester_id, semester_gpa, cumulative_gpa)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     semester_gpa = VALUES(semester_gpa),
                     cumulative_gpa = VALUES(cumulative_gpa)`,
          [student.student_id, currentSemesterId, semesterGPA, cumulativeGPA],
        );
      }

      await db.commit();
      res.json({ success: true });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error in approveGrades:", error);
    res.status(500).json({ error: "Failed to approve grades" });
  }
};

// Reject grades for a course
exports.rejectGrades = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const { reason } = req.body;
    const adminId = req.session.user.user_id;

    // Update grades to rejected status
    await db.query(
      `UPDATE grades 
             SET status = 'rejected',
                 approved_by = ?,
                 approved_at = CURRENT_TIMESTAMP
             WHERE course_id = ? AND status = 'pending_approval'`,
      [adminId, courseId],
    );

    // Get instructor email
    const [instructor] = await db.query(
      `SELECT u.email, c.course_code, c.course_name
             FROM courses c
             JOIN users u ON c.instructor_id = u.user_id
             WHERE c.course_id = ?`,
      [courseId],
    );

    // Send notification email to instructor
    if (instructor[0]) {
      await sendEmail({
        to: instructor[0].email,
        subject: `Grade Rejection: ${instructor[0].course_code}`,
        text: `Your grades for ${instructor[0].course_name} (${instructor[0].course_code}) have been rejected.\n\nReason: ${reason}\n\nPlease review and resubmit the grades.`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error in rejectGrades:", error);
    res.status(500).json({ error: "Failed to reject grades" });
  }
};

// Helper function to calculate grade points
function calculateGradePoints(score) {
  if (score >= 90) return 4.0;
  if (score >= 87) return 3.7;
  if (score >= 84) return 3.3;
  if (score >= 80) return 3.0;
  if (score >= 77) return 2.7;
  if (score >= 74) return 2.3;
  if (score >= 70) return 2.0;
  if (score >= 67) return 1.7;
  if (score >= 64) return 1.3;
  if (score >= 60) return 1.0;
  return 0.0;
}
