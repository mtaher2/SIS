const User = require("../models/User");
const Instructor = require("../models/Instructor");
const Course = require("../models/Course");
const Announcement = require("../models/Announcement");
const { validationResult } = require("express-validator");
const { upload, deleteFile } = require("../utils/upload");
const db = require("../db");

// Instructor dashboard
exports.getDashboard = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;

    // Get profile info
    const profile = await Instructor.findByUserId(instructorId);

    // Get instructor's courses
    const courses = await Instructor.getAssignedCourses(instructorId);

    // Get recent announcements made by this instructor
    const announcements = await Announcement.findAll({
      created_by: instructorId,
      limit: 5,
    });

    // Calculate stats
    const stats = {
      totalCourses: courses ? courses.length : 0,
      totalStudents: 0,
      totalAnnouncements: announcements ? announcements.length : 0,
    };

    // Count total students across all courses
    if (courses && courses.length > 0) {
      // Get the count of students for each course
      for (const course of courses) {
        const students = await Instructor.getCourseStudents(
          course.course_id,
          instructorId,
        );
        stats.totalStudents += students ? students.length : 0;
      }
    }

    // Get upcoming assignments
    const upcomingAssignments = [];

    // Get upcoming assignments and quizzes from all instructor's courses
    if (courses && courses.length > 0) {
      // Get all course IDs
      const courseIds = courses.map((course) => course.course_id);

      try {
        // Fetch upcoming assignments (due in the next 14 days)
        const [assignmentRows] = await db.query(
          `SELECT a.*, c.title as course_name, c.course_code, m.title as module_title, 'assignment' as type
                    FROM enhanced_assignments a
                    JOIN modules m ON a.module_id = m.module_id
                    JOIN courses c ON m.course_id = c.course_id
                    WHERE m.course_id IN (?) 
                    AND a.due_date IS NOT NULL
                    AND a.due_date > NOW()
                    AND a.due_date < DATE_ADD(NOW(), INTERVAL 14 DAY)
                    ORDER BY a.due_date ASC
                    LIMIT 10`,
          [courseIds],
        );

        // Fetch upcoming quizzes using end_date (due in the next 14 days)
        const [quizRows] = await db.query(
          `SELECT q.*, q.quiz_id as id, c.title as course_name, c.course_code, m.title as module_title, 'quiz' as type, q.end_date as due_date
                    FROM quizzes q
                    JOIN modules m ON q.module_id = m.module_id
                    JOIN courses c ON m.course_id = c.course_id
                    WHERE m.course_id IN (?) 
                    AND q.end_date IS NOT NULL
                    AND q.end_date > NOW()
                    AND q.end_date < DATE_ADD(NOW(), INTERVAL 14 DAY)
                    ORDER BY q.end_date ASC
                    LIMIT 10`,
          [courseIds],
        );

        // Combine and sort by due date
        upcomingAssignments.push(...assignmentRows, ...quizRows);
        upcomingAssignments.sort(
          (a, b) => new Date(a.due_date) - new Date(b.due_date),
        );

        // Limit to 10 items
        if (upcomingAssignments.length > 10) {
          upcomingAssignments.length = 10;
        }
      } catch (error) {
        console.error("Error fetching upcoming deadlines:", error);
        // Continue with empty upcomingAssignments array
      }
    }

    res.render("instructor/dashboard", {
      title: "Instructor Dashboard",
      user: req.session.user,
      profile,
      courses,
      announcements,
      stats,
      upcomingAssignments,
    });
  } catch (error) {
    console.error("Error in instructor dashboard:", error);
    req.flash("error_msg", "An error occurred while loading the dashboard");
    res.redirect("/");
  }
};

// View profile
exports.getProfile = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const profile = await Instructor.findByUserId(instructorId);

    // Get assigned courses count
    let courseCount = 0;
    let studentCount = 0;

    try {
      // Get instructor's courses
      const courses = await Instructor.getAssignedCourses(instructorId);
      courseCount = courses ? courses.length : 0;

      // Count total students across all courses
      if (courses && courses.length > 0) {
        const studentCounts = await Promise.all(
          courses.map(async (course) => {
            try {
              const students = await Instructor.getCourseStudents(
                course.course_id,
                instructorId,
              );
              return students ? students.length : 0;
            } catch (error) {
              console.error("Error getting students for course:", error);
              return 0;
            }
          }),
        );

        studentCount = studentCounts.reduce((sum, count) => sum + count, 0);
      }
    } catch (error) {
      console.error("Error calculating course and student counts:", error);
      // Continue with default values of 0
    }

    res.render("instructor/profile", {
      title: "My Profile",
      user: req.session.user,
      profile,
      courseCount,
      studentCount,
    });
  } catch (error) {
    console.error("Error getting instructor profile:", error);
    req.flash("error_msg", "An error occurred while retrieving your profile");
    res.redirect("/instructor/dashboard");
  }
};

// Update profile form
exports.getUpdateProfile = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const profile = await Instructor.findByUserId(instructorId);

    res.render("instructor/update-profile", {
      title: "Update Profile",
      user: req.session.user,
      profile,
    });
  } catch (error) {
    console.error("Error getting update profile form:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the profile form",
    );
    res.redirect("/instructor/profile");
  }
};

// Process update profile form
exports.postUpdateProfile = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    console.log("Updating profile for instructor ID:", instructorId);
    console.log("Form data received:", req.body);

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      const profile = await Instructor.findByUserId(instructorId);
      return res.render("instructor/update-profile", {
        title: "Update Profile",
        user: req.session.user,
        profile,
        errors: errors.array(),
        formData: req.body,
      });
    }

    // First, check if instructor profile exists
    const existingProfile = await Instructor.findByUserId(instructorId);
    console.log("Existing profile:", existingProfile);

    // Update or create profile
    const profileData = {
      department: req.body.department,
      office_location: req.body.office_location,
      office_hours: req.body.office_hours,
      phone: req.body.phone, // Add phone field
    };
    console.log("Profile data to save:", profileData);

    let result;
    if (existingProfile) {
      result = await Instructor.update(instructorId, profileData);
      console.log("Update result:", result);
    } else {
      // If no profile exists, create one
      profileData.user_id = instructorId;
      result = await Instructor.create(profileData);
      console.log("Create result:", result);
    }

    // Handle profile image upload if provided
    if (req.file) {
      console.log("Processing profile image upload:", req.file);

      // Get the relative path for storage
      const relativePath = req.file.path.replace(/^.*[\\\/]public[\\\/]/, "/");

      // Update user profile image in the database
      const User = require("../models/User");
      await User.updateProfileImage(instructorId, relativePath);

      // Update session data
      req.session.user.profile_image = relativePath;
    }

    req.flash("success_msg", "Profile updated successfully");
    res.redirect("/instructor/profile");
  } catch (error) {
    console.error("Error updating profile:", error);
    req.flash("error_msg", "An error occurred while updating your profile");
    res.redirect("/instructor/update-profile");
  }
};

// Course management - list instructor's courses
exports.getCourses = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const { search, semester_id } = req.query;

    // Get all instructor's courses
    let courses = await Instructor.getAssignedCourses(instructorId);

    // Get all semesters for the filter dropdown
    const [semesters] = await db.query(
      "SELECT * FROM semesters ORDER BY start_date DESC",
    );

    // Filter by semester if provided
    if (semester_id && semester_id.trim() !== "") {
      courses = courses.filter((course) => course.semester_id == semester_id);
    }

    // Apply search filter if provided
    if (search && search.trim() !== "") {
      const searchTerm = search.toLowerCase().trim();
      courses = courses.filter(
        (course) =>
          course.title.toLowerCase().includes(searchTerm) ||
          course.course_code.toLowerCase().includes(searchTerm) ||
          (course.description &&
            course.description.toLowerCase().includes(searchTerm)),
      );
    }

    // Add student count to each course
    if (courses && courses.length > 0) {
      // Process courses in parallel
      courses = await Promise.all(
        courses.map(async (course) => {
          try {
            const students = await Instructor.getCourseStudents(
              course.course_id,
              instructorId,
            );
            return {
              ...course,
              student_count: students ? students.length : 0,
            };
          } catch (error) {
            console.error(
              `Error getting students for course ${course.course_id}:`,
              error,
            );
            return {
              ...course,
              student_count: 0,
            };
          }
        }),
      );
    }

    res.render("instructor/courses", {
      title: "My Courses",
      user: req.session.user,
      courses,
      semesters,
      search,
      semester_id,
    });
  } catch (error) {
    console.error("Error getting instructor courses:", error);
    req.flash("error_msg", "An error occurred while retrieving your courses");
    res.redirect("/instructor/dashboard");
  }
};

// View course details
exports.getCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash("error_msg", "You are not authorized to view this course");
      return res.redirect("/instructor/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);

    // Get students enrolled in this course
    let students = [];
    try {
      students = await Instructor.getCourseStudents(courseId, instructorId);
    } catch (error) {
      console.error("Error getting course students:", error);
      req.flash("error_msg", "There was an issue loading enrolled students");
      // Continue with empty students array
    }

    // Get course materials
    let materials = [];
    try {
      materials = await Course.getMaterials(courseId);
    } catch (error) {
      console.error("Error getting course materials:", error);
      // Continue with empty materials array
    }

    // Get assignments
    let assignments = [];
    try {
      assignments = await Course.getAssignments(courseId);
    } catch (error) {
      console.error("Error getting course assignments:", error);
      // Continue with empty assignments array
    }

    // Get modules
    let modules = [];
    try {
      const Module = require("../models/Module");
      modules = await Module.findByCourse(courseId);

      // For each module, get content summary
      for (const module of modules) {
        module.contents = await Module.getContents(module.module_id);
      }
    } catch (error) {
      console.error("Error getting course modules:", error);
      // Continue with empty modules array
    }

    res.render("instructor/course-details", {
      title: course.title,
      user: req.session.user,
      course,
      students,
      materials,
      assignments,
      modules,
    });
  } catch (error) {
    console.error("Error getting course details:", error);
    req.flash("error_msg", "An error occurred while retrieving course details");
    res.redirect("/instructor/courses");
  }
};

// Course material management
exports.getAddMaterial = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to add materials to this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);

    res.render("instructor/add-material", {
      title: `Add Material - ${course.title}`,
      user: req.session.user,
      course,
    });
  } catch (error) {
    console.error("Error getting add material form:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the material form",
    );
    res.redirect(`/instructor/courses/${req.params.id}`);
  }
};

// Process add material form
exports.postAddMaterial = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to add materials to this course",
      );
      return res.redirect("/instructor/courses");
    }

    const { title, description, material_type, link_url } = req.body;

    // Create material data
    const materialData = {
      course_id: courseId,
      title,
      description,
      file_path: req.file ? `/storage/${req.file.filename}` : null,
      link_url: material_type === "link" ? link_url : null,
      material_type,
      uploaded_by: instructorId,
    };

    await Course.addMaterial(materialData);

    req.flash("success_msg", "Material added successfully");
    res.redirect(`/instructor/courses/${courseId}`);
  } catch (error) {
    console.error("Error adding material:", error);
    req.flash("error_msg", "An error occurred while adding the material");
    res.redirect(`/instructor/courses/${req.params.id}/add-material`);
  }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
  try {
    const materialId = req.params.materialId;
    const instructorId = req.session.user.user_id;

    // Delete material
    const result = await Course.deleteMaterial(materialId, instructorId);

    if (result.success) {
      // Delete file if exists
      if (result.filePath) {
        deleteFile(result.filePath);
      }

      req.flash("success_msg", "Material deleted successfully");
    } else {
      req.flash("error_msg", "Failed to delete material");
    }

    res.redirect(`/instructor/courses/${req.params.id}`);
  } catch (error) {
    console.error("Error deleting material:", error);
    req.flash("error_msg", "An error occurred while deleting the material");
    res.redirect(`/instructor/courses/${req.params.id}`);
  }
};

// Assignment management
exports.getAddAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to add assignments to this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);

    res.render("instructor/add-assignment", {
      title: `Add Assignment - ${course.title}`,
      user: req.session.user,
      course,
    });
  } catch (error) {
    console.error("Error getting add assignment form:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the assignment form",
    );
    res.redirect(`/instructor/courses/${req.params.id}`);
  }
};

// Process add assignment form
exports.postAddAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to add assignments to this course",
      );
      return res.redirect("/instructor/courses");
    }

    const { title, description, due_date, max_points, weight_percentage } =
      req.body;

    // Create assignment data
    const assignmentData = {
      course_id: courseId,
      title,
      description,
      due_date,
      max_points,
      weight_percentage,
      created_by: instructorId,
    };

    await Course.addAssignment(assignmentData);

    req.flash("success_msg", "Assignment added successfully");
    res.redirect(`/instructor/courses/${courseId}`);
  } catch (error) {
    console.error("Error adding assignment:", error);
    req.flash("error_msg", "An error occurred while adding the assignment");
    res.redirect(`/instructor/courses/${req.params.id}/add-assignment`);
  }
};

// Announcement management
exports.getAnnouncements = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const announcements = await Announcement.findAll({
      created_by: instructorId,
    });

    res.render("instructor/announcements", {
      title: "My Announcements",
      user: req.session.user,
      announcements,
    });
  } catch (error) {
    console.error("Error getting announcements:", error);
    req.flash("error_msg", "An error occurred while retrieving announcements");
    res.redirect("/instructor/dashboard");
  }
};

// Create course announcement
exports.getCreateAnnouncement = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const courses = await Instructor.getAssignedCourses(instructorId);

    res.render("instructor/create-announcement", {
      title: "Create Announcement",
      user: req.session.user,
      courses,
    });
  } catch (error) {
    console.error("Error getting create announcement form:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the announcement form",
    );
    res.redirect("/instructor/announcements");
  }
};

// Process create announcement form
exports.postCreateAnnouncement = async (req, res) => {
  try {
    const instructorId = req.session.user.user_id;
    const { title, content, target_type, course_id } = req.body;

    // If targeting a course, ensure instructor is assigned to it
    if (target_type === "course") {
      const courses = await Instructor.getAssignedCourses(instructorId);
      const isCourseAssigned = courses.some(
        (course) => course.course_id == course_id,
      );

      if (!isCourseAssigned) {
        req.flash(
          "error_msg",
          "You are not authorized to create announcements for this course",
        );
        return res.redirect("/instructor/announcements/create");
      }
    }

    // Create announcement
    const announcementData = {
      title,
      content,
      created_by: instructorId,
      target_type,
      course_id: target_type === "course" ? course_id : null,
      is_active: true,
    };

    await Announcement.create(announcementData);

    req.flash("success_msg", "Announcement created successfully");
    res.redirect("/instructor/announcements");
  } catch (error) {
    console.error("Error creating announcement:", error);
    req.flash("error_msg", "An error occurred while creating the announcement");
    res.redirect("/instructor/announcements/create");
  }
};

// Grade management - view assignments
exports.getGradeAssignment = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const assignmentId = req.params.assignmentId;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to grade assignments for this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Get assignment details
    const [assignment] = await db.query(
      "SELECT * FROM assignments WHERE assignment_id = ? AND course_id = ?",
      [assignmentId, courseId],
    );

    if (assignment.length === 0) {
      req.flash("error_msg", "Assignment not found");
      return res.redirect(`/instructor/courses/${courseId}`);
    }

    // Get students in this course
    const students = await Instructor.getCourseStudents(courseId, instructorId);

    // Get existing grades
    const [grades] = await db.query(
      "SELECT * FROM grades WHERE assignment_id = ?",
      [assignmentId],
    );

    res.render("instructor/grade-assignment", {
      title: `Grade Assignment - ${assignment[0].title}`,
      user: req.session.user,
      assignment: assignment[0],
      students,
      grades,
      courseId,
    });
  } catch (error) {
    console.error("Error getting grade assignment form:", error);
    req.flash(
      "error_msg",
      "An error occurred while preparing the grading form",
    );
    res.redirect(`/instructor/courses/${req.params.courseId}`);
  }
};

// Process grading form
exports.postGradeAssignment = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const assignmentId = req.params.assignmentId;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const courses = await Instructor.getAssignedCourses(instructorId);
    const isCourseAssigned = courses.some(
      (course) => course.course_id == courseId,
    );

    if (!isCourseAssigned) {
      req.flash(
        "error_msg",
        "You are not authorized to grade assignments for this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Process each student's grade
    const studentIds = Array.isArray(req.body.student_id)
      ? req.body.student_id
      : [req.body.student_id];

    const points = Array.isArray(req.body.points_earned)
      ? req.body.points_earned
      : [req.body.points_earned];

    const comments = Array.isArray(req.body.comments)
      ? req.body.comments
      : [req.body.comments];

    for (let i = 0; i < studentIds.length; i++) {
      if (points[i] !== "") {
        const gradeData = {
          student_id: studentIds[i],
          assignment_id: assignmentId,
          points_earned: points[i],
          graded_by: instructorId,
          comments: comments[i] || null,
        };

        await Instructor.recordGrade(gradeData);
      }
    }

    req.flash("success_msg", "Grades recorded successfully");
    res.redirect(`/instructor/courses/${courseId}`);
  } catch (error) {
    console.error("Error recording grades:", error);
    req.flash("error_msg", "An error occurred while recording grades");
    res.redirect(
      `/instructor/courses/${req.params.courseId}/assignments/${req.params.assignmentId}/grade`,
    );
  }
};

// Course student management - view students in a course
exports.getCourseStudents = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;
    const { search, status } = req.query;

    // Get course details
    const course = await Course.findById(courseId);

    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/instructor/courses");
    }

    // Check if instructor is assigned to this course
    const [instructorCheck] = await db.query(
      "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (instructorCheck.length === 0) {
      req.flash(
        "error_msg",
        "You are not authorized to manage students for this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Get enrolled students
    const students = await Instructor.getCourseStudents(courseId, instructorId);

    res.render("instructor/course-students", {
      title: `Students - ${course.title}`,
      user: req.session.user,
      course,
      students,
    });
  } catch (error) {
    console.error("Error getting course students:", error);
    req.flash(
      "error_msg",
      "An error occurred while retrieving the course students",
    );
    res.redirect("/instructor/courses");
  }
};

// Course student management - view add students form
exports.getAddStudents = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;
    const { search } = req.query; // Get search parameter from query

    // Get course details
    const course = await Course.findById(courseId);

    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/instructor/courses");
    }

    // Check if instructor is assigned to this course
    const [instructorCheck] = await db.query(
      "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (instructorCheck.length === 0) {
      req.flash(
        "error_msg",
        "You are not authorized to manage students for this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Get enrolled students
    const students = await Instructor.getCourseStudents(courseId, instructorId);

    // Get all students for adding new ones
    let allStudents = [];

    // If search term is provided, use the User.search method to filter students
    if (search && search.trim() !== "") {
      allStudents = await User.search({
        role: "student",
        search: search.trim(),
      });
    } else {
      allStudents = await User.findByRole("student");
    }

    // Filter out already enrolled students (with active status)
    const enrolledStudentIds = students
      .filter((s) => s.status === "active")
      .map((s) => s.user_id);

    const availableStudents = allStudents.filter(
      (s) => !enrolledStudentIds.includes(s.user_id),
    );

    res.render("instructor/add-students", {
      title: `Add Students - ${course.title}`,
      user: req.session.user,
      course,
      availableStudents,
      search, // Pass search parameter to the view
    });
  } catch (error) {
    console.error("Error loading add students form:", error);
    req.flash(
      "error_msg",
      "An error occurred while loading the add students form",
    );
    res.redirect(`/instructor/courses/${req.params.id}/students`);
  }
};

// Course student management - process add students form
exports.postAddStudents = async (req, res) => {
  try {
    const courseId = req.params.id;
    const instructorId = req.session.user.user_id;
    const { student_ids } = req.body;

    // Check if instructor is assigned to this course
    const [instructorCheck] = await db.query(
      "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (instructorCheck.length === 0) {
      req.flash(
        "error_msg",
        "You are not authorized to manage students for this course",
      );
      return res.redirect("/instructor/courses");
    }

    if (!student_ids || student_ids.length === 0) {
      req.flash("error_msg", "Please select at least one student to add");
      return res.redirect(`/instructor/courses/${courseId}/add-students`);
    }

    // Enroll students
    let addedCount = 0;

    // Handle both array and single value
    const studentIdList = Array.isArray(student_ids)
      ? student_ids
      : [student_ids];

    for (const studentId of studentIdList) {
      try {
        await Course.enrollStudent(courseId, studentId);
        addedCount++;
      } catch (error) {
        console.error(`Error enrolling student ${studentId}:`, error);
        // Continue with next student
      }
    }

    req.flash(
      "success_msg",
      `${addedCount} student(s) added to course successfully`,
    );
    res.redirect(`/instructor/courses/${courseId}/students`);
  } catch (error) {
    console.error("Error adding students to course:", error);
    req.flash(
      "error_msg",
      "An error occurred while adding students to the course",
    );
    res.redirect(`/instructor/courses/${req.params.id}/add-students`);
  }
};

// Course student management - remove student from course
exports.removeStudentFromCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.params.studentId;
    const instructorId = req.session.user.user_id;

    // Check if instructor is assigned to this course
    const [instructorCheck] = await db.query(
      "SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (instructorCheck.length === 0) {
      req.flash(
        "error_msg",
        "You are not authorized to manage students for this course",
      );
      return res.redirect("/instructor/courses");
    }

    // Drop student
    await Course.dropStudent(courseId, studentId);

    req.flash("success_msg", "Student removed from course successfully");
    res.redirect(`/instructor/courses/${courseId}/students`);
  } catch (error) {
    console.error("Error removing student from course:", error);
    req.flash(
      "error_msg",
      "An error occurred while removing the student from the course",
    );
    res.redirect(`/instructor/courses/${req.params.id}/students`);
  }
};

// Get course grade management page
exports.getCourseGrades = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const instructorId = req.session.user.user_id;

    // Verify instructor has access to this course
    const [course] = await db.query(
      `SELECT c.*, s.semester_name 
             FROM courses c
             JOIN course_instructors ci ON c.course_id = ci.course_id
             JOIN semesters s ON c.semester_id = s.semester_id
             WHERE c.course_id = ? AND ci.instructor_id = ?`,
      [courseId, instructorId],
    );

    if (!course || course.length === 0) {
      req.flash("error_msg", "You do not have access to this course");
      return res.redirect("/instructor/courses");
    }

    // Get grade weights
    const [weights] = await db.query(
      "SELECT * FROM course_weights WHERE course_id = ?",
      [courseId],
    );

    // Get enrolled students with their grades
    const [students] = await db.query(
      `SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                CONCAT(u.first_name, ' ', u.last_name) as student_name,
                e.enrollment_date,
                e.status as enrollment_status,
                g.quiz_score,
                g.assignment_score,
                g.midterm_score,
                g.final_score,
                g.total_score,
                g.status as grade_status,
                g.posted_at,
                g.approved_at
             FROM enrollments e
             JOIN users u ON e.student_id = u.user_id
             LEFT JOIN grades g ON e.student_id = g.student_id AND e.course_id = g.course_id
             WHERE e.course_id = ?
             ORDER BY u.last_name, u.first_name`,
      [courseId],
    );

    // Get course assignments and quizzes for reference
    const [assignments] = await db.query(
      `SELECT 
                'assignment' as type,
                assignment_id as id,
                title,
                points_possible as max_points,
                due_date
             FROM enhanced_assignments
             WHERE module_id IN (SELECT module_id FROM modules WHERE course_id = ?)
             UNION ALL
             SELECT 
                'quiz' as type,
                quiz_id as id,
                title,
                points_possible as max_points,
                end_date as due_date
             FROM quizzes
             WHERE module_id IN (SELECT module_id FROM modules WHERE course_id = ?)
             ORDER BY due_date`,
      [courseId, courseId],
    );

    res.render("instructor/course-grades", {
      title: "Course Grade Management",
      course: course[0],
      weights: weights[0] || {
        quiz_weight: 30,
        assignment_weight: 30,
        midterm_weight: 10,
        final_weight: 30,
      },
      students,
      assignments,
      currentPage: "grades",
    });
  } catch (error) {
    console.error("Error in getCourseGrades:", error);
    req.flash("error_msg", "An error occurred while loading course grades");
    res.redirect("/instructor/courses");
  }
};

// Update grade weights
exports.updateGradeWeights = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const { quiz_weight, assignment_weight, midterm_weight, final_weight } =
      req.body;
    const instructorId = req.session.user.user_id;

    // Verify instructor has access to this course
    const [course] = await db.query(
      `SELECT c.* 
             FROM courses c
             JOIN course_instructors ci ON c.course_id = ci.course_id
             WHERE c.course_id = ? AND ci.instructor_id = ?`,
      [courseId, instructorId],
    );

    if (!course || course.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate total weight equals 100
    const total =
      parseFloat(quiz_weight) +
      parseFloat(assignment_weight) +
      parseFloat(midterm_weight) +
      parseFloat(final_weight);

    if (Math.abs(total - 100) > 0.01) {
      return res.status(400).json({ error: "Total weight must equal 100%" });
    }

    // Update or insert weights
    await db.query(
      `INSERT INTO course_weights 
             (course_id, quiz_weight, assignment_weight, midterm_weight, final_weight)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             quiz_weight = VALUES(quiz_weight),
             assignment_weight = VALUES(assignment_weight),
             midterm_weight = VALUES(midterm_weight),
             final_weight = VALUES(final_weight)`,
      [courseId, quiz_weight, assignment_weight, midterm_weight, final_weight],
    );

    // Recalculate all student grades with new weights
    await db.query(
      `UPDATE grades 
             SET total_score = (
                 (quiz_score * ? + 
                  assignment_score * ? + 
                  midterm_score * ? + 
                  final_score * ?) / 100
             )
             WHERE course_id = ?`,
      [quiz_weight, assignment_weight, midterm_weight, final_weight, courseId],
    );

    res.json({
      success: true,
      message: "Grade weights updated successfully",
    });
  } catch (error) {
    console.error("Error in updateGradeWeights:", error);
    res.status(500).json({ error: "Failed to update grade weights" });
  }
};

// Update student grade
exports.updateStudentGrade = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const { type, score } = req.body;
    const instructorId = req.session.user.user_id;

    // Verify instructor has access to this course
    const [course] = await db.query(
      "SELECT * FROM courses WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get grade weights
    const [weights] = await db.query(
      "SELECT * FROM course_weights WHERE course_id = ?",
      [courseId],
    );

    if (!weights[0]) {
      return res.status(400).json({ error: "Grade weights not configured" });
    }

    // Update the specific grade component
    const updateField = `${type}_score`;
    await db.query(
      `UPDATE grades 
             SET ${updateField} = ?,
                 total_score = (
                     (quiz_score * ? + 
                      assignment_score * ? + 
                      midterm_score * ? + 
                      final_score * ?) / 100
                 )
             WHERE course_id = ? AND student_id = ?`,
      [
        score,
        weights[0].quiz_weight,
        weights[0].assignment_weight,
        weights[0].midterm_weight,
        weights[0].final_weight,
        courseId,
        studentId,
      ],
    );

    // Get updated total score
    const [updatedGrade] = await db.query(
      "SELECT total_score FROM grades WHERE course_id = ? AND student_id = ?",
      [courseId, studentId],
    );

    res.json({ total_score: updatedGrade[0].total_score });
  } catch (error) {
    console.error("Error in updateStudentGrade:", error);
    res.status(500).json({ error: "Failed to update grade" });
  }
};

// Post grades for approval
exports.postGrades = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const instructorId = req.session.user.user_id;

    // Verify instructor has access to this course
    const [course] = await db.query(
      "SELECT * FROM courses WHERE course_id = ? AND instructor_id = ?",
      [courseId, instructorId],
    );

    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update all grades to pending approval
    await db.query(
      `UPDATE grades 
             SET status = 'pending_approval',
                 posted_by = ?,
                 posted_at = CURRENT_TIMESTAMP
             WHERE course_id = ? AND status = 'in_progress'`,
      [instructorId, courseId],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error in postGrades:", error);
    res.status(500).json({ error: "Failed to post grades" });
  }
};
