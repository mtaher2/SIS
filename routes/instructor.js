const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const instructorController = require('../controllers/instructorController');
const { isAuthenticated, isInstructor } = require('../utils/auth');
const { upload } = require('../utils/upload');

// Apply middleware to all instructor routes
router.use(isAuthenticated, isInstructor);

// Dashboard
router.get('/dashboard', instructorController.getDashboard);

// Profile management
router.get('/profile', instructorController.getProfile);
router.get('/update-profile', instructorController.getUpdateProfile);
router.post('/update-profile', [
    check('department', 'Department is required').notEmpty()
], instructorController.postUpdateProfile);

// Course management
router.get('/courses', instructorController.getCourses);
router.get('/courses/:id', instructorController.getCourse);

// Course material management
router.get('/courses/:id/add-material', instructorController.getAddMaterial);
router.post('/courses/:id/add-material', upload.single('file'), [
    check('title', 'Title is required').notEmpty(),
    check('material_type', 'Material type is required').notEmpty()
], instructorController.postAddMaterial);
router.post('/courses/:id/materials/:materialId/delete', instructorController.deleteMaterial);

// Assignment management
router.get('/courses/:id/add-assignment', instructorController.getAddAssignment);
router.post('/courses/:id/add-assignment', [
    check('title', 'Title is required').notEmpty(),
    check('due_date', 'Due date is required').notEmpty(),
    check('max_points', 'Maximum points must be a valid number').isNumeric(),
    check('weight_percentage', 'Weight percentage must be a valid number').isNumeric()
], instructorController.postAddAssignment);

// Grading
router.get('/courses/:courseId/assignments/:assignmentId/grade', instructorController.getGradeAssignment);
router.post('/courses/:courseId/assignments/:assignmentId/grade', instructorController.postGradeAssignment);

// Announcement management
router.get('/announcements', instructorController.getAnnouncements);
router.get('/announcements/create', instructorController.getCreateAnnouncement);
router.post('/announcements/create', [
    check('title', 'Title is required').notEmpty(),
    check('content', 'Content is required').notEmpty(),
    check('target_type', 'Target type is required').notEmpty()
], instructorController.postCreateAnnouncement);

module.exports = router; 