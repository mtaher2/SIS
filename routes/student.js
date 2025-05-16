const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const studentController = require('../controllers/studentController');
const { isAuthenticated, isStudent } = require('../utils/auth');

// Apply middleware to all student routes
router.use(isAuthenticated, isStudent);

// Dashboard
router.get('/dashboard', studentController.getDashboard);

// Profile management
router.get('/profile', studentController.getProfile);
router.get('/update-profile', studentController.getUpdateProfile);
router.post('/update-profile', studentController.postUpdateProfile);

// Course management
router.get('/courses', studentController.getCourses);
router.get('/courses/:id', studentController.getCourse);

// Grades
router.get('/grades', studentController.getGrades);

// Attendance
router.get('/attendance', studentController.getAttendance);

// Announcements
router.get('/announcements', studentController.getAnnouncements);

// GPA Calculator
router.get('/gpa-calculator', studentController.getGpaCalculator);
router.post('/gpa-calculator', studentController.postGpaCalculator);

router.post('/courses/:id/enroll', studentController.enrollInCourse);


module.exports = router; 