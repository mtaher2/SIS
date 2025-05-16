const User = require("../models/User");
const Student = require("../models/Student");
const Course = require("../models/Course");
const Announcement = require("../models/Announcement");
const Message = require("../models/Message");
const { validationResult } = require("express-validator");
const db = require("../db");
const fs = require("fs");
const path = require("path");

// Student dashboard
exports.getDashboard = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Get profile info
    const profile = await Student.findByUserId(studentId);

    // Get student's enrolled courses
    const courses = await Student.getEnrolledCourses(studentId);

    // Get student's GPA
    const gpa = await Student.calculateGPA(studentId);

    // Get announcements visible to this student
    const announcements = await Announcement.getVisibleAnnouncements(
      studentId,
      "student",
    );

    // Get unread message count
    const unreadCount = await Message.getUnreadCount(studentId);

    // Calculate stats
    const stats = {
      currentCourses: courses
        ? courses.filter((course) => !course.is_completed).length
        : 0,
      completedCourses: courses
        ? courses.filter((course) => course.is_completed).length
        : 0,
      totalCredits: courses
        ? courses.reduce(
            (total, course) => total + (parseInt(course.credit_hours) || 0),
            0,
          )
        : 0,
    };

    // Get current courses for display
    const currentCourses = courses
      ? courses.filter((course) => !course.is_completed).slice(0, 3)
      : [];

    // Get upcoming assignments
    const upcomingAssignments = [];

    // Get GPA history for chart
    const gpaHistory = [];

    res.render("student/dashboard", {
      title: "Student Dashboard",
      user: req.session.user,
      profile,
      courses,
      gpa,
      stats,
      currentCourses,
      upcomingAssignments,
      gpaHistory,
      recentAnnouncements: announcements ? announcements.slice(0, 5) : [], // Only show 5 most recent
      unreadCount,
    });
  } catch (error) {
    console.error("Error in student dashboard:", error);
    req.flash("error_msg", "An error occurred while loading the dashboard");
    res.redirect("/");
  }
};

// View profile
exports.getProfile = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;
    const profile = await Student.findByUserId(studentId);

    res.render("student/profile", {
      title: "My Profile",
      user: req.session.user,
      profile,
    });
  } catch (error) {
    console.error("Error getting student profile:", error);
    req.flash("error_msg", "An error occurred while retrieving your profile");
    res.redirect("/student/dashboard");
  }
};

// Update profile form
exports.getUpdateProfile = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;
    const profile = await Student.findByUserId(studentId);

    res.render("student/update-profile", {
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
    res.redirect("/student/profile");
  }
};

// Process update profile form
exports.postUpdateProfile = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Update profile
    const profileData = {
      date_of_birth: req.body.date_of_birth,
      address: req.body.address,
      phone: req.body.phone,
    };

    await Student.update(studentId, profileData);

    req.flash("success_msg", "Profile updated successfully");
    res.redirect("/student/profile");
  } catch (error) {
    console.error("Error updating profile:", error);
    req.flash("error_msg", "An error occurred while updating your profile");
    res.redirect("/student/update-profile");
  }
};

// Course management - list student's courses
exports.getCourses = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;
    const courses = await Student.getEnrolledCourses(studentId);

    res.render("student/courses", {
      title: "My Courses",
      user: req.session.user,
      courses,
    });
  } catch (error) {
    console.error("Error getting student courses:", error);
    req.flash("error_msg", "An error occurred while retrieving your courses");
    res.redirect("/student/dashboard");
  }
};

// View course details
exports.getCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.session.user.user_id;

    // Check if student is enrolled in this course
    const courses = await Student.getEnrolledCourses(studentId);
    const isEnrolled = courses.some((course) => course.course_id == courseId);

    if (!isEnrolled) {
      req.flash("error_msg", "You are not enrolled in this course");
      return res.redirect("/student/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);

    // Get course instructors
    const [instructors] = await Course.getInstructors(courseId);

    // Get course modules
    const [modules] = await db.query(
      `SELECT * FROM modules 
             WHERE course_id = ? AND published = 1
             ORDER BY position ASC`,
      [courseId],
    );

    // Get course materials
    const materials = await Course.getMaterials(courseId);

    // Get module pages - order by created_at
    const [pages] = await db.query(
      `SELECT p.*, m.title AS module_title 
             FROM pages p
             JOIN modules m ON p.module_id = m.module_id
             WHERE m.course_id = ? AND p.published = 1
             ORDER BY m.position ASC, p.created_at ASC`,
      [courseId],
    );

    // Get assignments by module - without joining on module_id
    const [moduleAssignments] = await db.query(
      `SELECT a.* 
             FROM assignments a
             WHERE a.course_id = ? 
             ORDER BY a.due_date ASC`,
      [courseId],
    );

    // Group materials by module
    const materialsByModule = {};

    // First, add all modules as keys
    if (modules && modules.length > 0) {
      modules.forEach((module) => {
        materialsByModule[module.title] = [];
      });
    }

    // Add a "General Materials" group for materials without modules
    materialsByModule["General Materials"] = [];

    // Assign all materials to General Materials for now
    // (In a real implementation, we'd assign them to specific modules)
    if (materials && materials.length > 0) {
      materials.forEach((material) => {
        materialsByModule["General Materials"].push(material);
      });
    }

    // Create a pages by module object
    const pagesByModule = {};

    // Create an assignments by module object
    const assignmentsByModule = {};

    // First, add all modules as keys
    if (modules && modules.length > 0) {
      modules.forEach((module) => {
        pagesByModule[module.title] = [];
        assignmentsByModule[module.title] = [];
      });
    }

    // Now assign pages to their modules
    if (pages && pages.length > 0) {
      pages.forEach((page) => {
        if (!pagesByModule[page.module_title]) {
          pagesByModule[page.module_title] = [];
        }
        pagesByModule[page.module_title].push(page);
      });
    }

    // Create a simple module_assignment mapping to organize assignments by module
    // This is a temporary solution until a proper module_assignment table exists in the database
    const moduleAssignmentMap = {};

    // In a real system, this would come from a database table
    // For now, we'll distribute assignments to modules evenly for demonstration
    if (
      modules &&
      modules.length > 0 &&
      moduleAssignments &&
      moduleAssignments.length > 0
    ) {
      // Assign each assignment to a module in round-robin fashion
      moduleAssignments.forEach((assignment, index) => {
        const moduleIndex = index % modules.length;
        const moduleId = modules[moduleIndex].module_id;

        if (!moduleAssignmentMap[moduleId]) {
          moduleAssignmentMap[moduleId] = [];
        }

        moduleAssignmentMap[moduleId].push(assignment);
      });
    }

    // Assign assignments to their modules based on the mapping
    if (modules && modules.length > 0) {
      modules.forEach((module) => {
        const moduleId = module.module_id;
        if (
          moduleAssignmentMap[moduleId] &&
          moduleAssignmentMap[moduleId].length > 0
        ) {
          if (!assignmentsByModule[module.title]) {
            assignmentsByModule[module.title] = [];
          }

          moduleAssignmentMap[moduleId].forEach((assignment) => {
            assignmentsByModule[module.title].push(assignment);
          });
        }
      });
    }

    // Also keep the General Assignments for assignments not assigned to modules
    // This is optional - we can comment this out if we want all assignments to be under modules
    /* 
        if (moduleAssignments && moduleAssignments.length > 0) {
            // Create General Assignments category if it doesn't exist
            if (!assignmentsByModule["General Assignments"]) {
                assignmentsByModule["General Assignments"] = [];
            }
            
            // Add all assignments to General Assignments section
            moduleAssignments.forEach(assignment => {
                assignmentsByModule["General Assignments"].push(assignment);
            });
        }
        */

    // Get assignments (for the assignments section at the bottom)
    const assignments = await Course.getAssignments(courseId);

    // Get student's grades for this course
    const [grades] = await db.query(
      `SELECT s.*, a.points_possible as max_points
             FROM enhanced_submissions s
             JOIN enhanced_assignments a ON s.assignment_id = a.assignment_id
             WHERE s.assignment_id = ? AND s.student_id = ? AND s.score IS NOT NULL`,
      [courseId, studentId],
    );

    const grade =
      grades.length > 0
        ? {
            points: grades[0].score,
            max_points: grades[0].max_points,
            feedback: grades[0].feedback,
            graded_at: grades[0].graded_at,
          }
        : null;

    // Get course announcements
    const announcements = await Announcement.findAll({
      target_type: "course",
      course_id: courseId,
      is_active: true,
    });

    res.render("student/course-details", {
      title: course.title,
      user: req.session.user,
      course,
      instructors,
      modules,
      materials,
      materialsByModule,
      pages,
      pagesByModule,
      assignmentsByModule,
      assignments,
      grades,
      announcements,
    });
  } catch (error) {
    console.error("Error getting course details:", error);
    req.flash("error_msg", "An error occurred while retrieving course details");
    res.redirect("/student/courses");
  }
};

// View assignment details
exports.getAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.session.user.user_id;

    // Get assignment details
    const [assignments] = await db.query(
      `SELECT a.*, m.module_id, m.title AS module_title, c.course_id, c.course_code, c.title AS course_title, c.credit_hours 
             FROM enhanced_assignments a
             JOIN modules m ON a.module_id = m.module_id
             JOIN courses c ON m.course_id = c.course_id
             WHERE a.assignment_id = ?`,
      [assignmentId],
    );

    if (assignments.length === 0) {
      console.error(`Assignment not found: ID ${assignmentId}`);
      req.flash("error_msg", "Assignment not found");
      return res.redirect("/student/courses");
    }

    const assignment = assignments[0];
    const courseId = assignment.course_id;

    // Check if student is enrolled in this course
    const courses = await Student.getEnrolledCourses(studentId);
    const isEnrolled = courses.some((course) => course.course_id == courseId);

    if (!isEnrolled) {
      console.error(
        `Access denied: Student ${studentId} not enrolled in course ${courseId}`,
      );
      req.flash("error_msg", "You do not have access to this assignment");
      return res.redirect("/student/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);

    // Get student's submission if exists
    const [submissions] = await db.query(
      `SELECT s.*, 
                    CASE 
                        WHEN s.file_url IS NOT NULL THEN s.file_url
                        WHEN s.content IS NOT NULL THEN NULL
                        ELSE NULL
                    END as file_url,
                    CASE 
                        WHEN s.file_url IS NOT NULL THEN SUBSTRING_INDEX(s.file_url, '.', -1)
                        ELSE NULL
                    END as file_type,
                    CASE 
                        WHEN s.file_url IS NOT NULL THEN SUBSTRING_INDEX(s.file_url, '/', -1)
                        ELSE NULL
                    END as file_name,
                    CASE
                        WHEN s.score IS NOT NULL THEN 'graded'
                        WHEN s.submitted_at IS NOT NULL THEN 'submitted'
                        ELSE 'not_submitted'
                    END as status
             FROM enhanced_submissions s
             WHERE s.assignment_id = ? AND s.student_id = ?
             ORDER BY s.submitted_at DESC
             LIMIT 1`,
      [assignmentId, studentId],
    );

    const submission = submissions.length > 0 ? submissions[0] : null;

    // Get student's grade for this assignment
    const [grades] = await db.query(
      `SELECT s.*, a.points_possible as max_points,
                    CASE 
                        WHEN s.score IS NULL THEN 'not_graded'
                        ELSE 'graded'
                    END as grade_status
             FROM enhanced_submissions s
             JOIN enhanced_assignments a ON s.assignment_id = a.assignment_id
             WHERE s.assignment_id = ? AND s.student_id = ?`,
      [assignmentId, studentId],
    );

    const grade =
      grades.length > 0
        ? {
            points: grades[0].score,
            max_points: grades[0].max_points,
            feedback: grades[0].feedback,
            graded_at: grades[0].graded_at,
            status: grades[0].grade_status,
          }
        : null;

    // Determine if student can resubmit
    const canResubmit =
      submission &&
      assignment.allow_late_submissions &&
      (!grade ||
        grade.points === null ||
        (assignment.available_until &&
          new Date(assignment.available_until) > new Date())) &&
      (!assignment.max_submissions ||
        submission.submission_count < assignment.max_submissions);

    // Check if assignment is currently available
    const now = new Date();
    const isAvailable =
      (!assignment.available_from ||
        new Date(assignment.available_from) <= now) &&
      (!assignment.available_until ||
        new Date(assignment.available_until) >= now) &&
      assignment.published === 1;

    // Get allowed file types if this is a file upload assignment
    let allowedFileTypes = [];
    if (
      assignment.submission_type === "file_upload" &&
      assignment.allowed_file_types
    ) {
      allowedFileTypes = assignment.allowed_file_types
        .split(",")
        .map((type) => type.trim().toLowerCase());
    }

    res.render("student/assignment-details", {
      title: assignment.title,
      user: req.session.user,
      assignment,
      course,
      submission,
      grade,
      canResubmit,
      isAvailable,
      allowedFileTypes,
      now: new Date(),
    });
  } catch (error) {
    console.error("Error getting assignment:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    });
    req.flash("error_msg", "An error occurred while retrieving the assignment");
    res.redirect("/student/courses");
  }
};

// Submit assignment
exports.submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.session.user.user_id;
    const { submissionText } = req.body;
    const submissionFile = req.file;

    // Get assignment details
    const [assignments] = await db.query(
      `SELECT a.*, m.module_id, m.title AS module_title, c.course_id, c.course_code, c.title AS course_title
             FROM enhanced_assignments a
             JOIN modules m ON a.module_id = m.module_id
             JOIN courses c ON m.course_id = c.course_id
             WHERE a.assignment_id = ?`,
      [assignmentId],
    );

    if (assignments.length === 0) {
      console.error(`Assignment not found: ID ${assignmentId}`);
      return res.status(404).send(`
                <script>
                    alert('Assignment not found');
                    window.location.href = '/student/courses';
                </script>
            `);
    }

    const assignment = assignments[0];
    const courseId = assignment.course_id;

    // Check if student is enrolled in this course
    const courses = await Student.getEnrolledCourses(studentId);
    const isEnrolled = courses.some((course) => course.course_id == courseId);

    if (!isEnrolled) {
      console.error(
        `Access denied: Student ${studentId} not enrolled in course ${courseId}`,
      );
      return res.status(403).send(`
                <script>
                    alert('You do not have access to this assignment');
                    window.location.href = '/student/courses';
                </script>
            `);
    }

    // Check if submission is within deadline
    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isLate = dueDate && now > dueDate;

    if (isLate && !assignment.allow_late_submissions) {
      console.error(
        `Late submission rejected: Assignment ${assignmentId}, Student ${studentId}`,
      );
      return res.status(400).send(`
                <script>
                    alert('Assignment submission deadline has passed');
                    window.location.href = '/student/assignments/${assignmentId}';
                </script>
            `);
    }

    // Check if assignment is currently available
    const isAvailable =
      (!assignment.available_from ||
        new Date(assignment.available_from) <= now) &&
      (!assignment.available_until ||
        new Date(assignment.available_until) >= now) &&
      assignment.published === 1;

    if (!isAvailable) {
      console.error(
        `Assignment not available: ID ${assignmentId}, Student ${studentId}`,
      );
      return res.status(400).send(`
                <script>
                    alert('This assignment is not currently available for submission');
                    window.location.href = '/student/assignments/${assignmentId}';
                </script>
            `);
    }

    // Check if student has already submitted
    const [existingSubmission] = await db.query(
      "SELECT * FROM enhanced_submissions WHERE assignment_id = ? AND student_id = ?",
      [assignmentId, studentId],
    );

    if (existingSubmission.length > 0) {
      console.error(
        `Duplicate submission attempt: Assignment ${assignmentId}, Student ${studentId}`,
      );
      return res.status(400).send(`
                <script>
                    alert('You have already submitted this assignment');
                    window.location.href = '/student/assignments/${assignmentId}';
                </script>
            `);
    }

    // Prepare submission data
    const submissionData = {
      assignment_id: assignmentId,
      student_id: studentId,
      content: submissionText || null,
      file_url: submissionFile
        ? `/storage/assignments/${submissionFile.filename}`
        : null,
      file_type: submissionFile ? submissionFile.mimetype.split("/")[1] : null,
      file_name: submissionFile ? submissionFile.originalname : null,
      submitted_at: now,
      is_late: isLate,
    };

    // Save submission
    const [result] = await db.query(
      `INSERT INTO enhanced_submissions
            (assignment_id, student_id, content, file_url, file_type, file_name, submitted_at, is_late)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionData.assignment_id,
        submissionData.student_id,
        submissionData.content,
        submissionData.file_url,
        submissionData.file_type,
        submissionData.file_name,
        submissionData.submitted_at,
        submissionData.is_late,
      ],
    );

    console.log(
      `Submission successful: Assignment ${assignmentId}, Student ${studentId}`,
    );

    // Return JSON response with submission data
    res.json({
      success: true,
      message: "Assignment submitted successfully!",
      submission: {
        ...submissionData,
        submission_id: result.insertId,
      },
    });
  } catch (error) {
    console.error("Error submitting assignment:", error);
    res.status(400).json({
      success: false,
      error:
        error.message || "An error occurred while submitting the assignment",
    });
  }
};

// Request assignment resubmission
exports.getResubmitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const studentId = req.session.user.user_id;

    // Check if assignment exists
    const [assignments] = await db.query(
      "SELECT * FROM enhanced_assignments WHERE assignment_id = ?",
      [assignmentId],
    );

    if (assignments.length === 0) {
      req.flash("error_msg", "Assignment not found");
      return res.redirect(`/student/assignments/${assignmentId}`);
    }

    // Check if student has already submitted
    const [submissions] = await db.query(
      "SELECT * FROM enhanced_submissions WHERE assignment_id = ? AND student_id = ?",
      [assignmentId, studentId],
    );

    if (submissions.length === 0) {
      req.flash("error_msg", "You have not submitted this assignment yet");
      return res.redirect(`/student/assignments/${assignmentId}`);
    }

    const assignment = assignments[0];
    const submission = submissions[0];

    // Get course details
    const [courseDetails] = await db.query(
      `SELECT c.course_id, c.course_code, c.title
             FROM courses c
             JOIN modules m ON c.course_id = m.course_id
             JOIN enhanced_assignments a ON m.module_id = a.module_id
             WHERE a.assignment_id = ?`,
      [assignmentId],
    );

    if (courseDetails.length === 0) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/student/courses");
    }

    res.render("student/resubmit-assignment", {
      title: `Resubmit - ${assignment.title}`,
      user: req.session.user,
      assignment,
      submission,
      course: courseDetails[0],
    });
  } catch (error) {
    console.error("Error getting resubmission page:", error);
    req.flash(
      "error_msg",
      "An error occurred while loading the resubmission page",
    );
    res.redirect(`/student/assignments/${req.params.id}`);
  }
};

// View grades
exports.getGrades = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Get all courses with grades
    const courses = await Student.getEnrolledCourses(studentId);

    // Get course weights and grades
    const [courseGrades] = await db.query(
      `SELECT 
                c.course_id,
                c.course_code,
                c.title,
                c.credit_hours,
                c.semester_id,
                cw.quiz_weight,
                cw.assignment_weight,
                cw.midterm_weight,
                cw.final_weight,
                g.quiz_score,
                g.assignment_score,
                g.midterm_score,
                g.final_score,
                g.total_score,
                g.status,
                g.posted_at,
                g.approved_at,
                s.semester_name,
                s.start_date,
                s.end_date,
                CONCAT(u.first_name, ' ', u.last_name) as instructor_name
             FROM courses c
             JOIN enrollments e ON c.course_id = e.course_id
             LEFT JOIN course_weights cw ON c.course_id = cw.course_id
             LEFT JOIN grades g ON c.course_id = g.course_id AND g.student_id = e.student_id
             LEFT JOIN semesters s ON c.semester_id = s.semester_id
             LEFT JOIN course_instructors ci ON c.course_id = ci.course_id
             LEFT JOIN users u ON ci.instructor_id = u.user_id
             WHERE e.student_id = ?
             ORDER BY s.start_date DESC, c.course_code`,
      [studentId],
    );

    // Process grades to calculate weighted scores
    const processedGrades = courseGrades.map((course) => {
      const weights = {
        quiz: course.quiz_weight || 0,
        assignment: course.assignment_weight || 0,
        midterm: course.midterm_weight || 0,
        final: course.final_weight || 0,
      };

      // Only consider posted and approved grades
      const isGradePosted =
        course.status === "posted" && course.posted_at && course.approved_at;

      const scores = {
        quiz: isGradePosted ? course.quiz_score || 0 : null,
        assignment: isGradePosted ? course.assignment_score || 0 : null,
        midterm: isGradePosted ? course.midterm_score || 0 : null,
        final: isGradePosted ? course.final_score || 0 : null,
      };

      // Calculate weighted total
      let weightedTotal = 0;
      let totalWeight = 0;

      if (scores.quiz !== null && weights.quiz > 0) {
        weightedTotal += (scores.quiz * weights.quiz) / 100;
        totalWeight += weights.quiz;
      }
      if (scores.assignment !== null && weights.assignment > 0) {
        weightedTotal += (scores.assignment * weights.assignment) / 100;
        totalWeight += weights.assignment;
      }
      if (scores.midterm !== null && weights.midterm > 0) {
        weightedTotal += (scores.midterm * weights.midterm) / 100;
        totalWeight += weights.midterm;
      }
      if (scores.final !== null && weights.final > 0) {
        weightedTotal += (scores.final * weights.final) / 100;
        totalWeight += weights.final;
      }

      // Calculate final grade only if there are posted grades
      const finalGrade =
        totalWeight > 0 ? (weightedTotal / totalWeight) * 100 : null;

      // Calculate letter grade
      let letterGrade = null;
      if (finalGrade !== null) {
        if (finalGrade >= 90) letterGrade = "A";
        else if (finalGrade >= 85) letterGrade = "A-";
        else if (finalGrade >= 80) letterGrade = "B+";
        else if (finalGrade >= 75) letterGrade = "B";
        else if (finalGrade >= 70) letterGrade = "B-";
        else if (finalGrade >= 65) letterGrade = "C+";
        else if (finalGrade >= 60) letterGrade = "C";
        else if (finalGrade >= 55) letterGrade = "C-";
        else if (finalGrade >= 50) letterGrade = "D";
        else letterGrade = "F";
      }

      return {
        ...course,
        weights,
        scores,
        finalGrade,
        letterGrade,
        isGradePosted,
        totalWeight,
        weightedTotal,
        gradeStatus: isGradePosted ? "posted" : "pending",
      };
    });

    // Get current semester
    const [currentSemester] = await db.query(
      `SELECT * FROM semesters WHERE is_active = 1 LIMIT 1`,
    );

    // Filter current courses (not completed)
    const currentCourses = processedGrades.filter(
      (course) => course.semester_id === currentSemester[0]?.semester_id,
    );

    // Get previous semesters with courses
    const [previousSemesters] = await db.query(
      `SELECT DISTINCT s.*, 
                    (SELECT AVG(g.total_score) 
                     FROM grades g 
                     JOIN courses c ON g.course_id = c.course_id
                     WHERE c.semester_id = s.semester_id 
                     AND g.student_id = ? 
                     AND g.status = 'posted'
                     AND g.posted_at IS NOT NULL
                     AND g.approved_at IS NOT NULL) as gpa
             FROM semesters s
             JOIN courses c ON s.semester_id = c.semester_id
             JOIN enrollments e ON c.course_id = e.course_id
             WHERE e.student_id = ? AND s.is_active = 0
             ORDER BY s.start_date DESC`,
      [studentId, studentId],
    );

    // Get courses for each previous semester
    for (let semester of previousSemesters) {
      semester.courses = processedGrades.filter(
        (course) => course.semester_id === semester.semester_id,
      );
    }

    // Get GPA history
    const [gpaHistory] = await db.query(
      `SELECT 
                s.semester_name,
                s.start_date,
                COALESCE(gr.semester_gpa, 0) as gpa
             FROM semesters s
             LEFT JOIN gpa_records gr ON s.semester_id = gr.semester_id AND gr.student_id = ?
             WHERE s.semester_id IN (
                 SELECT DISTINCT c.semester_id 
                 FROM courses c
                 JOIN enrollments e ON c.course_id = e.course_id
                 WHERE e.student_id = ?
             )
             ORDER BY s.start_date ASC`,
      [studentId, studentId],
    );

    res.render("student/grades", {
      title: "My Grades",
      user: req.session.user,
      courses: processedGrades,
      currentCourses,
      grades: processedGrades,
      gpa: await Student.calculateGPA(studentId),
      currentSemester: currentSemester[0] || null,
      previousSemesters,
      gpaHistory,
    });
  } catch (error) {
    console.error("Error getting grades:", error);
    req.flash("error_msg", "An error occurred while retrieving your grades");
    res.redirect("/student/dashboard");
  }
};

// View attendance
exports.getAttendance = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;
    const courseId = req.query.course_id;

    // Get attendance records
    const attendance = await Student.getAttendance(studentId, courseId);

    // Get courses for filtering
    const courses = await Student.getEnrolledCourses(studentId);

    res.render("student/attendance", {
      title: "My Attendance",
      user: req.session.user,
      attendance,
      courses,
      selectedCourse: courseId,
    });
  } catch (error) {
    console.error("Error getting attendance:", error);
    req.flash(
      "error_msg",
      "An error occurred while retrieving attendance records",
    );
    res.redirect("/student/dashboard");
  }
};

// View announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Get all announcements visible to this student
    const announcements = await Announcement.getVisibleAnnouncements(
      studentId,
      "student",
    );

    res.render("student/announcements", {
      title: "Announcements",
      user: req.session.user,
      announcements,
    });
  } catch (error) {
    console.error("Error getting announcements:", error);
    req.flash("error_msg", "An error occurred while retrieving announcements");
    res.redirect("/student/dashboard");
  }
};

// Get GPA calculator page
exports.getGpaCalculator = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Get current GPA
    const currentGpa = await Student.calculateGPA(studentId);

    // Get current courses with grades
    const [currentCourses] = await db.query(
      `SELECT c.*, g.total_score, g.status
             FROM courses c
             JOIN enrollments e ON c.course_id = e.course_id
             LEFT JOIN grades g ON c.course_id = g.course_id AND g.student_id = e.student_id
             WHERE e.student_id = ? AND e.status = 'active'`,
      [studentId],
    );

    // Get total credits taken for GPA
    const [creditsResult] = await db.query(
      `SELECT SUM(c.credit_hours) as total_credits
             FROM enrollments e
             JOIN courses c ON e.course_id = c.course_id
             WHERE e.student_id = ? AND e.final_grade IS NOT NULL`,
      [studentId],
    );

    const totalCredits = creditsResult[0]?.total_credits || 0;

    res.render("student/gpa-calculator", {
      title: "GPA Calculator",
      user: req.session.user,
      currentCourses: currentCourses || [],
      currentGpa: currentGpa || 0,
      totalCredits,
    });
  } catch (error) {
    console.error("Error in getGpaCalculator:", error);
    req.flash(
      "error_msg",
      "An error occurred while loading the GPA calculator",
    );
    res.redirect("/student/dashboard");
  }
};

// Calculate estimated GPA
exports.postGpaCalculator = async (req, res) => {
  try {
    const {
      course_id,
      grade,
      include_current,
      exclude_course,
      previous_grade,
    } = req.body;
    const studentId = req.session.user.user_id;

    // Current GPA and courses
    const currentGpa = parseFloat(await Student.calculateGPA(studentId)) || 0;
    const courses = await Student.getEnrolledCourses(studentId);

    // If we're including current GPA in calculation
    let totalPoints = 0;
    let totalCredits = 0;

    if (include_current === "yes" && currentGpa > 0) {
      // Get completed courses credit total
      const [completedCourses] = await db.query(
        `SELECT SUM(c.credit_hours) AS total_credits
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                WHERE e.student_id = ? AND e.final_grade IS NOT NULL`,
        [studentId],
      );

      const completedCredits = completedCourses[0].total_credits || 0;
      totalPoints = currentGpa * completedCredits;
      totalCredits = completedCredits;
    }

    // Add new course grades to calculation
    const courseIds = Array.isArray(course_id) ? course_id : [course_id];
    const grades = Array.isArray(grade) ? grade : [grade];
    const excludeCourses = Array.isArray(exclude_course)
      ? exclude_course
      : [exclude_course];
    const previousGrades = Array.isArray(previous_grade)
      ? previous_grade
      : [previous_grade];

    const gradePoints = {
      "A+": 4.0,
      A: 4.0,
      "A-": 3.7,
      "B+": 3.3,
      B: 3.0,
      "B-": 2.7,
      "C+": 2.3,
      C: 2.0,
      "C-": 1.7,
      "D+": 1.3,
      D: 1.0,
      "D-": 0.7,
      F: 0.0,
    };

    let excludedPoints = 0;
    let excludedCredits = 0;

    for (let i = 0; i < courseIds.length; i++) {
      if (courseIds[i] && grades[i]) {
        // Find the course to get credit hours
        const course = courses.find((c) => c.course_id == courseIds[i]);

        if (course) {
          const gradeValue = grades[i].toUpperCase();
          const points = gradePoints[gradeValue] || 0;

          if (excludeCourses[i] === "true") {
            const prevGradeValue = previousGrades[i]?.toUpperCase();
            const prevPoints = gradePoints[prevGradeValue] || 0;
            excludedPoints += prevPoints * course.credit_hours;
            excludedCredits += course.credit_hours;
          } else {
            totalPoints += points * course.credit_hours;
            totalCredits += course.credit_hours;
          }
        }
      }
    }

    // Calculate estimated GPA
    const estimatedGpa =
      totalCredits > 0
        ? (
            (totalPoints - excludedPoints) /
            (totalCredits - excludedCredits)
          ).toFixed(2)
        : 0;

    // Get current courses for display
    const [currentCourses] = await db.query(
      `SELECT c.*, g.total_score, g.status
             FROM courses c
             JOIN enrollments e ON c.course_id = e.course_id
             LEFT JOIN grades g ON c.course_id = g.course_id AND g.student_id = e.student_id
             WHERE e.student_id = ? AND e.status = 'active'`,
      [studentId],
    );

    res.render("student/gpa-calculator", {
      title: "GPA Calculator",
      user: req.session.user,
      currentCourses: currentCourses || [],
      currentGpa: currentGpa || 0,
      estimatedGpa,
      formData: req.body,
      gradePoints: Object.keys(gradePoints),
      calculationDetails: {
        totalPoints,
        totalCredits,
        excludedPoints,
        excludedCredits,
        coursesIncluded: courseIds.length,
      },
    });
  } catch (error) {
    console.error("Error calculating GPA:", error);
    req.flash("error_msg", "An error occurred while calculating your GPA");
    res.redirect("/student/gpa-calculator");
  }
};

// View module page
exports.getModulePage = async (req, res) => {
  try {
    const { courseId, moduleId, pageId } = req.params;
    const studentId = req.session.user.user_id;

    // Check if student is enrolled in this course
    const courses = await Student.getEnrolledCourses(studentId);
    const isEnrolled = courses.some((course) => course.course_id == courseId);

    if (!isEnrolled) {
      req.flash("error_msg", "You are not enrolled in this course");
      return res.redirect("/student/courses");
    }

    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      req.flash("error_msg", "Course not found");
      return res.redirect("/student/courses");
    }

    // Get module details
    const [modules] = await db.query(
      "SELECT * FROM modules WHERE module_id = ? AND course_id = ?",
      [moduleId, courseId],
    );

    if (!modules || modules.length === 0) {
      req.flash("error_msg", "Module not found");
      return res.redirect(`/student/courses/${courseId}`);
    }

    const module = modules[0];

    // Get page content
    const [page] = await db.query(
      `SELECT p.*, m.title AS module_title 
             FROM pages p
             JOIN modules m ON p.module_id = m.module_id
             WHERE p.page_id = ? AND p.module_id = ? AND m.course_id = ?`,
      [pageId, moduleId, courseId],
    );

    if (!page || page.length === 0) {
      req.flash("error_msg", "Page not found");
      return res.redirect(`/student/courses/${courseId}`);
    }

    // Get all pages in this module for navigation
    const [modulePages] = await db.query(
      `SELECT * FROM pages 
             WHERE module_id = ? AND published = 1
             ORDER BY created_at ASC`,
      [moduleId],
    );

    // Get assignments for this module
    let moduleAssignments = [];
    try {
      // Get assignments with submission status
      const [assignments] = await db.query(
        `SELECT a.*, 
                        (SELECT COUNT(*) FROM enhanced_submissions 
                         WHERE assignment_id = a.assignment_id AND student_id = ?) as is_submitted
                 FROM enhanced_assignments a
                 WHERE a.module_id = ?
                 ORDER BY a.due_date ASC`,
        [studentId, moduleId],
      );
      moduleAssignments = assignments;
    } catch (error) {
      console.error("Error getting module assignments:", error);
      // If there's an error, just get assignments without submission status
      const [assignments] = await db.query(
        `SELECT a.*, 0 as is_submitted
                 FROM enhanced_assignments a
                 WHERE a.module_id = ?
                 ORDER BY a.due_date ASC`,
        [moduleId],
      );
      moduleAssignments = assignments;
    }

    // Find current page index and get next page
    const currentPageIndex = modulePages.findIndex(
      (p) => p.page_id === parseInt(pageId),
    );
    const nextPage =
      currentPageIndex < modulePages.length - 1
        ? modulePages[currentPageIndex + 1]
        : null;
    const prevPage =
      currentPageIndex > 0 ? modulePages[currentPageIndex - 1] : null;

    res.render("student/module-page", {
      title: page[0].title,
      user: req.session.user,
      page: page[0],
      course,
      module,
      modulePages,
      moduleAssignments,
      nextPage,
      prevPage,
      courseId,
      moduleId,
    });
  } catch (error) {
    console.error("Error getting module page:", error);
    req.flash("error_msg", "An error occurred while loading the page");
    res.redirect("/student/dashboard");
  }
};

// Get unofficial transcript
exports.getTranscript = async (req, res) => {
  try {
    const studentId = req.session.user.user_id;

    // Get student profile
    const [profile] = await db.query(
      "SELECT * FROM student_profiles WHERE user_id = ?",
      [studentId],
    );

    // Get course history with grades
    const [courses] = await db.query(
      `SELECT 
                c.course_code,
                c.course_name,
                c.credit_hours,
                g.total_score,
                g.letter_grade,
                s.semester_name,
                s.start_date,
                s.end_date
             FROM enrollments e
             JOIN courses c ON e.course_id = c.course_id
             JOIN semesters s ON e.semester_id = s.semester_id
             LEFT JOIN grades g ON e.course_id = g.course_id AND e.student_id = g.student_id
             WHERE e.student_id = ?
             ORDER BY s.start_date DESC, c.course_code`,
      [studentId],
    );

    // Organize courses by semester
    const courseHistory = {};
    courses.forEach((course) => {
      if (!courseHistory[course.semester_name]) {
        courseHistory[course.semester_name] = [];
      }
      courseHistory[course.semester_name].push({
        ...course,
        grade_points: calculateGradePoints(course.total_score),
      });
    });

    // Get GPA history
    const [gpaHistory] = await db.query(
      `SELECT 
                s.semester_name,
                gr.semester_gpa as gpa
             FROM gpa_records gr
             JOIN semesters s ON gr.semester_id = s.semester_id
             WHERE gr.student_id = ?
             ORDER BY s.start_date DESC`,
      [studentId],
    );

    // Calculate total credits
    const totalCredits = courses.reduce((sum, course) => {
      return sum + (course.letter_grade ? course.credit_hours : 0);
    }, 0);

    // Get current GPA
    const currentGpa = await Student.calculateGPA(studentId);

    res.render("student/transcript", {
      title: "Unofficial Transcript",
      user: req.session.user,
      profile: profile[0],
      courseHistory,
      gpaHistory,
      totalCredits,
      gpa: {
        current: currentGpa,
        semester: gpaHistory[0]?.gpa || 0,
      },
    });
  } catch (error) {
    console.error("Error in getTranscript:", error);
    req.flash(
      "error_msg",
      "An error occurred while generating your transcript",
    );
    res.redirect("/student/dashboard");
  }
};

// Helper function to calculate grade points
function calculateGradePoints(score) {
  if (!score) return null;
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
