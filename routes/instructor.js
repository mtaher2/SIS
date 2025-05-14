const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const instructorController = require('../controllers/instructorController');
const moduleController = require('../controllers/moduleController');
const { isAuthenticated, isInstructor } = require('../utils/auth');
const { upload } = require('../utils/upload');

// Apply middleware to all instructor routes
router.use(isAuthenticated, isInstructor);

// Dashboard
router.get('/dashboard', instructorController.getDashboard);

// Profile management
router.get('/profile', instructorController.getProfile);
router.get('/update-profile', instructorController.getUpdateProfile);
router.post('/update-profile', upload.single('profile_image'), [
    check('department', 'Department is required').notEmpty()
], instructorController.postUpdateProfile);

// Course management
router.get('/courses', instructorController.getCourses);
router.get('/courses/:id', instructorController.getCourse);

// Module management
router.get('/courses/:id/modules', moduleController.getModules);
router.post('/courses/:id/modules', [
    check('title', 'Title is required').notEmpty()
], moduleController.createModule);
router.put('/courses/:id/modules/:moduleId', [
    check('title', 'Title is required').notEmpty()
], moduleController.updateModule);
router.post('/courses/:id/modules/:moduleId/toggle-publish', moduleController.toggleModulePublish);
router.delete('/courses/:id/modules/:moduleId', moduleController.deleteModule);
router.post('/courses/:id/modules/reorder', moduleController.reorderModules);

// Page management
router.get('/modules/:moduleId/pages', moduleController.getPages);
router.get('/modules/:moduleId/pages/create', moduleController.getCreatePage);
router.post('/modules/:moduleId/pages', [
    check('title', 'Title is required').notEmpty()
], moduleController.createPage);
router.get('/modules/:moduleId/pages/:pageId', moduleController.getPage);
router.get('/modules/:moduleId/pages/:pageId/edit', moduleController.getEditPage);
router.put('/modules/:moduleId/pages/:pageId', [
    check('title', 'Title is required').notEmpty()
], moduleController.updatePage);
router.delete('/modules/:moduleId/pages/:pageId', moduleController.deletePage);
router.post('/modules/:moduleId/pages/:pageId/toggle-publish', moduleController.togglePagePublish);

// Quiz management
router.get('/modules/:moduleId/quizzes', moduleController.getQuizzes);
router.get('/modules/:moduleId/quizzes/create', moduleController.getCreateQuiz);
router.post('/modules/:moduleId/quizzes', [
    check('title', 'Title is required').notEmpty()
], moduleController.createQuiz);
router.get('/modules/:moduleId/quizzes/:quizId', moduleController.getQuiz);
router.get('/modules/:moduleId/quizzes/:quizId/edit', moduleController.getEditQuiz);
router.put('/modules/:moduleId/quizzes/:quizId', [
    check('title', 'Title is required').notEmpty()
], moduleController.updateQuiz);
router.delete('/modules/:moduleId/quizzes/:quizId', moduleController.deleteQuiz);
router.post('/modules/:moduleId/quizzes/:quizId/toggle-publish', moduleController.toggleQuizPublish);
router.get('/modules/:moduleId/quizzes/:quizId/questions', moduleController.getQuizQuestions);
router.get('/modules/:moduleId/quizzes/:quizId/questions/data', moduleController.getQuizQuestionsData);
router.post('/modules/:moduleId/quizzes/:quizId/questions', moduleController.createQuizQuestion);
router.put('/modules/:moduleId/quizzes/:quizId/questions/:questionId', moduleController.updateQuizQuestion);
router.delete('/modules/:moduleId/quizzes/:quizId/questions/:questionId', moduleController.deleteQuizQuestion);

// Enhanced assignment management
router.get('/modules/:moduleId/assignments', moduleController.getAssignments);
router.get('/modules/:moduleId/assignments/create', moduleController.getCreateAssignment);
router.post('/modules/:moduleId/assignments', [
    check('title', 'Title is required').notEmpty()
], moduleController.createAssignment);
router.get('/modules/:moduleId/assignments/:assignmentId', moduleController.getAssignment);
router.get('/modules/:moduleId/assignments/:assignmentId/edit', moduleController.getEditAssignment);
router.put('/modules/:moduleId/assignments/:assignmentId', [
    check('title', 'Title is required').notEmpty()
], moduleController.updateAssignment);
router.delete('/modules/:moduleId/assignments/:assignmentId', moduleController.deleteAssignment);
router.post('/modules/:moduleId/assignments/:assignmentId/toggle-publish', moduleController.toggleAssignmentPublish);
router.get('/modules/:moduleId/assignments/:assignmentId/submissions', moduleController.getAssignmentSubmissions);
router.get('/modules/:moduleId/assignments/:assignmentId/submissions/:submissionId', moduleController.getSubmission);
router.post('/modules/:moduleId/assignments/:assignmentId/submissions/:submissionId/grade', moduleController.gradeSubmission);

// Course material management (legacy)
router.get('/courses/:id/add-material', instructorController.getAddMaterial);
router.post('/courses/:id/add-material', upload.single('file'), [
    check('title', 'Title is required').notEmpty(),
    check('material_type', 'Material type is required').notEmpty()
], instructorController.postAddMaterial);
router.post('/courses/:id/materials/:materialId/delete', instructorController.deleteMaterial);

// Student management
router.get('/courses/:id/students', instructorController.getCourseStudents);
router.get('/courses/:id/add-students', instructorController.getAddStudents);
router.post('/courses/:id/add-students', instructorController.postAddStudents);
router.post('/courses/:id/students/:studentId/remove', instructorController.removeStudentFromCourse);

// Assignment management (legacy)
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