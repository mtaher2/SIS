const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { isAuthenticated, isStudent } = require('../utils/auth');
const { upload } = require('../utils/upload');

// Apply student role middleware to all routes
router.use(isAuthenticated, isStudent);

// Dashboard route
router.get('/dashboard', studentController.getDashboard);

// Profile routes
router.get('/profile', studentController.getProfile);
router.get('/update-profile', studentController.getUpdateProfile);
router.post('/update-profile', studentController.postUpdateProfile);

// Course routes
router.get('/courses', studentController.getCourses);
router.get('/courses/:id', studentController.getCourse);

// Module and page routes
router.get('/courses/:courseId/modules/:moduleId/pages/:pageId', studentController.getModulePage);

// Assignment routes
router.get('/assignments/:id', studentController.getAssignment);
router.post('/assignments/:id/submit', upload.single('submissionFile'), studentController.submitAssignment);
router.get('/assignments/:id/resubmit', studentController.getResubmitAssignment);

// Grades route
router.get('/grades', studentController.getGrades);

// Attendance route
router.get('/attendance', studentController.getAttendance);

// Announcements route
router.get('/announcements', studentController.getAnnouncements);

// GPA Calculator routes
router.get('/gpa-calculator', studentController.getGpaCalculator);
router.post('/gpa-calculator', studentController.postGpaCalculator);

// Transcript Route
router.get('/transcript', studentController.getTranscript);

module.exports = router; 