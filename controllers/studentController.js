const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Announcement = require('../models/Announcement');
const Message = require('../models/Message');
const { validationResult } = require('express-validator');
const db = require('../db');

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
            'student'
        );
        
        // Get unread message count
        const unreadCount = await Message.getUnreadCount(studentId);
        
        // Calculate stats
        const stats = {
            currentCourses: courses ? courses.filter(course => !course.is_completed).length : 0,
            completedCourses: courses ? courses.filter(course => course.is_completed).length : 0,
            totalCredits: courses ? courses.reduce((total, course) => total + (parseInt(course.credit_hours) || 0), 0) : 0
        };
        
        // Get current courses for display
        const currentCourses = courses ? courses.filter(course => !course.is_completed).slice(0, 3) : [];
        
        // Get upcoming assignments
        const upcomingAssignments = [];
        
        // Get GPA history for chart
        const gpaHistory = [];
        
        res.render('student/dashboard', {
            title: 'Student Dashboard',
            user: req.session.user,
            profile,
            courses,
            gpa,
            stats,
            currentCourses,
            upcomingAssignments,
            gpaHistory,
            recentAnnouncements: announcements ? announcements.slice(0, 5) : [], // Only show 5 most recent
            unreadCount
        });
    } catch (error) {
        console.error('Error in student dashboard:', error);
        req.flash('error_msg', 'An error occurred while loading the dashboard');
        res.redirect('/');
    }
};

// View profile
exports.getProfile = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        const profile = await Student.findByUserId(studentId);
        
        res.render('student/profile', {
            title: 'My Profile',
            user: req.session.user,
            profile
        });
    } catch (error) {
        console.error('Error getting student profile:', error);
        req.flash('error_msg', 'An error occurred while retrieving your profile');
        res.redirect('/student/dashboard');
    }
};

// Update profile form
exports.getUpdateProfile = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        const profile = await Student.findByUserId(studentId);
        
        res.render('student/update-profile', {
            title: 'Update Profile',
            user: req.session.user,
            profile
        });
    } catch (error) {
        console.error('Error getting update profile form:', error);
        req.flash('error_msg', 'An error occurred while preparing the profile form');
        res.redirect('/student/profile');
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
            phone: req.body.phone
        };
        
        await Student.update(studentId, profileData);
        
        req.flash('success_msg', 'Profile updated successfully');
        res.redirect('/student/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error_msg', 'An error occurred while updating your profile');
        res.redirect('/student/update-profile');
    }
};

// Course management - list student's courses
exports.getCourses = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        const courses = await Student.getEnrolledCourses(studentId);
        
        res.render('student/courses', {
            title: 'My Courses',
            user: req.session.user,
            courses
        });
    } catch (error) {
        console.error('Error getting student courses:', error);
        req.flash('error_msg', 'An error occurred while retrieving your courses');
        res.redirect('/student/dashboard');
    }
};

// View course details
exports.getCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.session.user.user_id;
        
        // Check if student is enrolled in this course
        const courses = await Student.getEnrolledCourses(studentId);
        const isEnrolled = courses.some(course => course.course_id == courseId);
        
        if (!isEnrolled) {
            req.flash('error_msg', 'You are not enrolled in this course');
            return res.redirect('/student/courses');
        }
        
        // Get course details
        const course = await Course.findById(courseId);
        
        // Get course instructors
        const instructors = await Course.getInstructors(courseId);
        
        // Get course materials
        const materials = await Course.getMaterials(courseId);
        
        // Get assignments
        const assignments = await Course.getAssignments(courseId);
        
        // Get student's grades for this course
        const [grades] = await db.query(
            `SELECT g.*, a.title AS assignment_title, a.max_points, a.weight_percentage
            FROM grades g
            JOIN assignments a ON g.assignment_id = a.assignment_id
            WHERE g.student_id = ? AND a.course_id = ?`,
            [studentId, courseId]
        );
        
        // Get course announcements
        const announcements = await Announcement.findAll({
            target_type: 'course',
            course_id: courseId,
            is_active: true
        });
        
        res.render('student/course-details', {
            title: course.title,
            user: req.session.user,
            course,
            instructors,
            materials,
            assignments,
            grades,
            announcements
        });
    } catch (error) {
        console.error('Error getting course details:', error);
        req.flash('error_msg', 'An error occurred while retrieving course details');
        res.redirect('/student/courses');
    }
};

// View grades
exports.getGrades = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        
        // Get all courses with grades
        const courses = await Student.getEnrolledCourses(studentId);
        
        // Get all grades
        const grades = await Student.getGrades(studentId);
        
        // Get GPA
        const gpa = await Student.calculateGPA(studentId);
        
        res.render('student/grades', {
            title: 'My Grades',
            user: req.session.user,
            courses,
            grades,
            gpa
        });
    } catch (error) {
        console.error('Error getting grades:', error);
        req.flash('error_msg', 'An error occurred while retrieving your grades');
        res.redirect('/student/dashboard');
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
        
        res.render('student/attendance', {
            title: 'My Attendance',
            user: req.session.user,
            attendance,
            courses,
            selectedCourse: courseId
        });
    } catch (error) {
        console.error('Error getting attendance:', error);
        req.flash('error_msg', 'An error occurred while retrieving attendance records');
        res.redirect('/student/dashboard');
    }
};

// View announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        
        // Get all announcements visible to this student
        const announcements = await Announcement.getVisibleAnnouncements(
            studentId, 
            'student'
        );
        
        res.render('student/announcements', {
            title: 'Announcements',
            user: req.session.user,
            announcements
        });
    } catch (error) {
        console.error('Error getting announcements:', error);
        req.flash('error_msg', 'An error occurred while retrieving announcements');
        res.redirect('/student/dashboard');
    }
};

// GPA Calculator
exports.getGpaCalculator = async (req, res) => {
    try {
        const studentId = req.session.user.user_id;
        
        // Get all courses
        const courses = await Student.getEnrolledCourses(studentId);
        
        // Get current GPA
        const currentGpa = await Student.calculateGPA(studentId);
        
        res.render('student/gpa-calculator', {
            title: 'GPA Calculator',
            user: req.session.user,
            courses,
            currentGpa
        });
    } catch (error) {
        console.error('Error loading GPA calculator:', error);
        req.flash('error_msg', 'An error occurred while loading the GPA calculator');
        res.redirect('/student/dashboard');
    }
};

// Calculate estimated GPA
exports.postGpaCalculator = async (req, res) => {
    try {
        const { course_id, grade, include_current } = req.body;
        const studentId = req.session.user.user_id;
        
        // Current GPA and courses
        const currentGpa = parseFloat(await Student.calculateGPA(studentId));
        const courses = await Student.getEnrolledCourses(studentId);
        
        // If we're including current GPA in calculation
        let totalPoints = 0;
        let totalCredits = 0;
        
        if (include_current === 'yes' && currentGpa > 0) {
            // Get completed courses credit total
            const [completedCourses] = await db.query(
                `SELECT SUM(c.credit_hours) AS total_credits
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                WHERE e.student_id = ? AND e.final_grade IS NOT NULL`,
                [studentId]
            );
            
            const completedCredits = completedCourses[0].total_credits || 0;
            totalPoints = currentGpa * completedCredits;
            totalCredits = completedCredits;
        }
        
        // Add new course grades to calculation
        const courseIds = Array.isArray(course_id) ? course_id : [course_id];
        const grades = Array.isArray(grade) ? grade : [grade];
        
        for (let i = 0; i < courseIds.length; i++) {
            if (courseIds[i] && grades[i]) {
                // Find the course to get credit hours
                const course = courses.find(c => c.course_id == courseIds[i]);
                
                if (course) {
                    // Convert letter grade to GPA points
                    let points = 0;
                    
                    switch (grades[i].toUpperCase()) {
                        case 'A+': case 'A': points = 4.0; break;
                        case 'A-': points = 3.7; break;
                        case 'B+': points = 3.3; break;
                        case 'B': points = 3.0; break;
                        case 'B-': points = 2.7; break;
                        case 'C+': points = 2.3; break;
                        case 'C': points = 2.0; break;
                        case 'C-': points = 1.7; break;
                        case 'D+': points = 1.3; break;
                        case 'D': points = 1.0; break;
                        case 'D-': points = 0.7; break;
                        case 'F': points = 0.0; break;
                    }
                    
                    totalPoints += points * course.credit_hours;
                    totalCredits += course.credit_hours;
                }
            }
        }
        
        // Calculate estimated GPA
        const estimatedGpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0;
        
        res.render('student/gpa-calculator', {
            title: 'GPA Calculator',
            user: req.session.user,
            courses,
            currentGpa,
            estimatedGpa,
            formData: req.body
        });
    } catch (error) {
        console.error('Error calculating GPA:', error);
        req.flash('error_msg', 'An error occurred while calculating your GPA');
        res.redirect('/student/gpa-calculator');
    }
}; 