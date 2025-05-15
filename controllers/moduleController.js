const { validationResult } = require('express-validator');
const Module = require('../models/Module');
const Page = require('../models/Page');
const Quiz = require('../models/Quiz');
const EnhancedAssignment = require('../models/EnhancedAssignment');
const Course = require('../models/Course');
const { upload, deleteFile } = require('../utils/upload');
const db = require('../db');
const Instructor = require('../models/Instructor');

// Helper function to check if instructor is authorized for a module
const checkModuleAuthorization = async (moduleId, instructorId) => {
    try {
        // Get module details
        const module = await Module.findById(moduleId);
        if (!module) {
            return {
                authorized: false,
                message: 'Module not found'
            };
        }
        
        // Check if instructor is assigned to the course
        const course = await Course.findById(module.course_id);
        const [instructors] = await Course.getInstructors(module.course_id);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            return {
                authorized: false,
                message: 'You are not authorized to access this module'
            };
        }
        
        return {
            authorized: true,
            module,
            course
        };
    } catch (error) {
        console.error('Error checking module authorization:', error);
        return {
            authorized: false,
            message: 'An error occurred while checking authorization'
        };
    }
};

// MODULE MANAGEMENT
// Get all modules for a course
exports.getModules = async (req, res) => {
    try {
        const courseId = req.params.id;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            req.flash('error_msg', 'You are not authorized to view modules for this course');
            return res.redirect('/instructor/courses');
        }
        
        // Get course details
        const course = await Course.findById(courseId);
        
        // Get modules
        const modules = await Module.findByCourse(courseId);
        
        // For each module, get its contents
        for (const module of modules) {
            module.contents = await Module.getContents(module.module_id);
        }
        
        res.render('instructor/modules/index', {
            title: `Modules - ${course.title}`,
            user: req.session.user,
            course,
            modules
        });
    } catch (error) {
        console.error('Error getting modules:', error);
        req.flash('error_msg', 'An error occurred while retrieving course modules');
        res.redirect('/instructor/courses');
    }
};

// Create a new module
exports.createModule = async (req, res) => {
    try {
        const courseId = req.params.id;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            req.flash('error_msg', 'You are not authorized to add modules to this course');
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/courses/${courseId}/modules`);
        }
        
        // Create module
        const moduleData = {
            course_id: courseId,
            title: req.body.title,
            description: req.body.description,
            published: req.body.published === 'true'
        };
        
        await Module.create(moduleData);
        
        req.flash('success_msg', 'Module created successfully');
        res.redirect(`/instructor/courses/${courseId}/modules`);
    } catch (error) {
        console.error('Error creating module:', error);
        req.flash('error_msg', 'An error occurred while creating the module');
        res.redirect(`/instructor/courses/${req.params.id}/modules`);
    }
};

// Update module
exports.updateModule = async (req, res) => {
    try {
        const courseId = req.params.id;
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            req.flash('error_msg', 'You are not authorized to update modules for this course');
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/courses/${courseId}/modules`);
        }
        
        // Update module
        const moduleData = {
            title: req.body.title,
            description: req.body.description,
            published: req.body.published === 'true'
        };
        
        await Module.update(moduleId, moduleData);
        
        req.flash('success_msg', 'Module updated successfully');
        res.redirect(`/instructor/courses/${courseId}/modules`);
    } catch (error) {
        console.error('Error updating module:', error);
        req.flash('error_msg', 'An error occurred while updating the module');
        res.redirect(`/instructor/courses/${req.params.id}/modules`);
    }
};

// Toggle module publish status
exports.toggleModulePublish = async (req, res) => {
    try {
        const courseId = req.params.id;
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            req.flash('error_msg', 'You are not authorized to update modules for this course');
            return res.redirect('/instructor/courses');
        }
        
        // Get current module details
        const module = await Module.findById(moduleId);
        if (!module) {
            req.flash('error_msg', 'Module not found');
            return res.redirect(`/instructor/courses/${courseId}/modules`);
        }
        
        // Toggle published status
        const moduleData = {
            published: !module.published
        };
        
        await Module.update(moduleId, moduleData);
        
        req.flash('success_msg', `Module ${moduleData.published ? 'published' : 'unpublished'} successfully`);
        res.redirect(`/instructor/courses/${courseId}/modules`);
    } catch (error) {
        console.error('Error toggling module publish status:', error);
        req.flash('error_msg', 'An error occurred while updating the module');
        res.redirect(`/instructor/courses/${req.params.id}/modules`);
    }
};

// Delete module
exports.deleteModule = async (req, res) => {
    try {
        const courseId = req.params.id;
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            req.flash('error_msg', 'You are not authorized to delete modules for this course');
            return res.redirect('/instructor/courses');
        }
        
        // Delete module
        await Module.delete(moduleId);
        
        req.flash('success_msg', 'Module deleted successfully');
        res.redirect(`/instructor/courses/${courseId}/modules`);
    } catch (error) {
        console.error('Error deleting module:', error);
        req.flash('error_msg', 'An error occurred while deleting the module');
        res.redirect(`/instructor/courses/${req.params.id}/modules`);
    }
};

// Reorder modules
exports.reorderModules = async (req, res) => {
    try {
        const courseId = req.params.id;
        const instructorId = req.session.user.user_id;
        
        // Check if instructor is assigned to this course
        const [instructors] = await Course.getInstructors(courseId);
        const isInstructorAssigned = instructors.some(instructor => instructor.user_id == instructorId);
        
        if (!isInstructorAssigned) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update modules for this course'
            });
        }
        
        // Update module positions
        const { positions } = req.body;
        await Module.updatePositions(positions);
        
        res.json({
            success: true,
            message: 'Module order updated successfully'
        });
    } catch (error) {
        console.error('Error reordering modules:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating module order'
        });
    }
};

// PAGE MANAGEMENT
// Get all pages for a module
exports.getPages = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get pages
        const pages = await Page.findByModule(moduleId);
        
        res.render('instructor/pages/index', {
            title: `Pages - ${auth.module.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            pages
        });
    } catch (error) {
        console.error('Error getting pages:', error);
        req.flash('error_msg', 'An error occurred while retrieving module pages');
        res.redirect('/instructor/courses');
    }
};

// Get page creation form
exports.getCreatePage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        res.render('instructor/pages/create', {
            title: 'Create Page',
            user: req.session.user,
            course: auth.course,
            module: auth.module
        });
    } catch (error) {
        console.error('Error getting page creation form:', error);
        req.flash('error_msg', 'An error occurred while preparing the page form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages`);
    }
};

// Create a new page
exports.createPage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/pages/create`);
        }
        
        // Create page
        const pageData = {
            module_id: moduleId,
            title: req.body.title,
            content: req.body.content,
            published: req.body.published === 'true',
            created_by: instructorId
        };
        
        const pageId = await Page.create(pageData);
        
        req.flash('success_msg', 'Page created successfully');
        res.redirect(`/instructor/modules/${moduleId}/pages/${pageId}`);
    } catch (error) {
        console.error('Error creating page:', error);
        req.flash('error_msg', 'An error occurred while creating the page');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages/create`);
    }
};

// View page
exports.getPage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get page with creator info
        const page = await Page.getWithCreator(pageId);
        
        if (!page || page.module_id != moduleId) {
            req.flash('error_msg', 'Page not found');
            return res.redirect(`/instructor/modules/${moduleId}/pages`);
        }
        
        res.render('instructor/pages/view', {
            title: page.title,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            page
        });
    } catch (error) {
        console.error('Error viewing page:', error);
        req.flash('error_msg', 'An error occurred while retrieving the page');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages`);
    }
};

// Get page edit form
exports.getEditPage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get page
        const page = await Page.findById(pageId);
        
        if (!page || page.module_id != moduleId) {
            req.flash('error_msg', 'Page not found');
            return res.redirect(`/instructor/modules/${moduleId}/pages`);
        }
        
        res.render('instructor/pages/edit', {
            title: `Edit - ${page.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            page
        });
    } catch (error) {
        console.error('Error getting page edit form:', error);
        req.flash('error_msg', 'An error occurred while preparing the edit form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages`);
    }
};

// Update page
exports.updatePage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/pages/${pageId}/edit`);
        }
        
        // Check if page belongs to the module
        const page = await Page.findById(pageId);
        if (!page || page.module_id != moduleId) {
            req.flash('error_msg', 'Page not found');
            return res.redirect(`/instructor/modules/${moduleId}/pages`);
        }
        
        // Update page
        const pageData = {
            title: req.body.title,
            content: req.body.content,
            published: req.body.published === 'true'
        };
        
        await Page.update(pageId, pageData);
        
        req.flash('success_msg', 'Page updated successfully');
        res.redirect(`/instructor/modules/${moduleId}/pages/${pageId}`);
    } catch (error) {
        console.error('Error updating page:', error);
        req.flash('error_msg', 'An error occurred while updating the page');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages/${req.params.pageId}/edit`);
    }
};

// Delete page
exports.deletePage = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Check if page belongs to the module
        const page = await Page.findById(pageId);
        if (!page || page.module_id != moduleId) {
            req.flash('error_msg', 'Page not found');
            return res.redirect(`/instructor/modules/${moduleId}/pages`);
        }
        
        // Delete page
        await Page.delete(pageId);
        
        req.flash('success_msg', 'Page deleted successfully');
        res.redirect(`/instructor/modules/${moduleId}/pages`);
    } catch (error) {
        console.error('Error deleting page:', error);
        req.flash('error_msg', 'An error occurred while deleting the page');
        res.redirect(`/instructor/modules/${req.params.moduleId}/pages`);
    }
};

// Toggle page publish status
exports.togglePagePublish = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const pageId = req.params.pageId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if page belongs to the module
        const page = await Page.findById(pageId);
        if (!page || page.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Page not found'
            });
        }
        
        // Toggle publish status
        const result = await Page.togglePublish(pageId);
        
        res.json({
            success: result.success,
            published: result.published,
            message: `Page is now ${result.published ? 'published' : 'unpublished'}`
        });
    } catch (error) {
        console.error('Error toggling page publish status:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating page status'
        });
    }
};

// QUIZ MANAGEMENT
// Get all quizzes for a module
exports.getQuizzes = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get quizzes
        const quizzes = await Quiz.findByModule(moduleId);
        
        res.render('instructor/quizzes/index', {
            title: `Quizzes - ${auth.module.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            quizzes
        });
    } catch (error) {
        console.error('Error getting quizzes:', error);
        req.flash('error_msg', 'An error occurred while retrieving module quizzes');
        res.redirect('/instructor/courses');
    }
};

// Get quiz creation form
exports.getCreateQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        res.render('instructor/quizzes/create', {
            title: 'Create Quiz',
            user: req.session.user,
            course: auth.course,
            module: auth.module
        });
    } catch (error) {
        console.error('Error getting quiz creation form:', error);
        req.flash('error_msg', 'An error occurred while preparing the quiz form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes`);
    }
};

// Create a new quiz
exports.createQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/quizzes/create`);
        }
        
        // Create quiz
        const quizData = {
            module_id: moduleId,
            title: req.body.title,
            description: req.body.description,
            time_limit: req.body.time_limit,
            allowed_attempts: req.body.allowed_attempts,
            shuffle_questions: req.body.shuffle_questions === 'true',
            shuffle_answers: req.body.shuffle_answers === 'true',
            start_date: req.body.start_date || null,
            end_date: req.body.end_date || null,
            published: req.body.published === 'true',
            created_by: instructorId,
            points_possible: req.body.points_possible || 0,
            grade_release_option: req.body.grade_release_option || 'immediate',
            show_correct_answers: req.body.show_correct_answers === 'true'
        };
        
        const quizId = await Quiz.create(quizData);
        
        req.flash('success_msg', 'Quiz created successfully');
        res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}`);
    } catch (error) {
        console.error('Error creating quiz:', error);
        req.flash('error_msg', 'An error occurred while creating the quiz');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes/create`);
    }
};

// View quiz
exports.getQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get quiz with questions
        const quiz = await Quiz.getWithQuestions(quizId, true); // true to include correct answers
        
        if (!quiz || quiz.module_id != moduleId) {
            req.flash('error_msg', 'Quiz not found');
            return res.redirect(`/instructor/modules/${moduleId}/quizzes`);
        }
        
        res.render('instructor/quizzes/view', {
            title: quiz.title,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            quiz
        });
    } catch (error) {
        console.error('Error viewing quiz:', error);
        req.flash('error_msg', 'An error occurred while retrieving the quiz');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes`);
    }
};

// Edit quiz form
exports.getEditQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get quiz
        const quiz = await Quiz.findById(quizId);
        
        if (!quiz || quiz.module_id != moduleId) {
            req.flash('error_msg', 'Quiz not found');
            return res.redirect(`/instructor/modules/${moduleId}/quizzes`);
        }
        
        res.render('instructor/quizzes/edit', {
            title: `Edit - ${quiz.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            quiz
        });
    } catch (error) {
        console.error('Error getting quiz edit form:', error);
        req.flash('error_msg', 'An error occurred while preparing the edit form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes`);
    }
};

// Update quiz
exports.updateQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}/edit`);
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            req.flash('error_msg', 'Quiz not found');
            return res.redirect(`/instructor/modules/${moduleId}/quizzes`);
        }
        
        // Update quiz
        const quizData = {
            title: req.body.title,
            description: req.body.description,
            time_limit: req.body.time_limit,
            allowed_attempts: req.body.allowed_attempts,
            shuffle_questions: req.body.shuffle_questions === 'true',
            shuffle_answers: req.body.shuffle_answers === 'true',
            start_date: req.body.start_date || null,
            end_date: req.body.end_date || null,
            published: req.body.published === 'true',
            points_possible: req.body.points_possible || 0,
            grade_release_option: req.body.grade_release_option || 'immediate',
            show_correct_answers: req.body.show_correct_answers === 'true'
        };
        
        await Quiz.update(quizId, quizData);
        
        req.flash('success_msg', 'Quiz updated successfully');
        res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}`);
    } catch (error) {
        console.error('Error updating quiz:', error);
        req.flash('error_msg', 'An error occurred while updating the quiz');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes/${req.params.quizId}/edit`);
    }
};

// Delete quiz
exports.deleteQuiz = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            req.flash('error_msg', 'Quiz not found');
            return res.redirect(`/instructor/modules/${moduleId}/quizzes`);
        }
        
        // Delete quiz
        await Quiz.delete(quizId);
        
        req.flash('success_msg', 'Quiz deleted successfully');
        res.redirect(`/instructor/modules/${moduleId}/quizzes`);
    } catch (error) {
        console.error('Error deleting quiz:', error);
        req.flash('error_msg', 'An error occurred while deleting the quiz');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes`);
    }
};

// Toggle quiz publish status
exports.toggleQuizPublish = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Toggle publish status (assuming a togglePublish method exists in Quiz model)
        const published = !quiz.published;
        await Quiz.update(quizId, { ...quiz, published });
        
        res.json({
            success: true,
            published,
            message: `Quiz is now ${published ? 'published' : 'unpublished'}`
        });
    } catch (error) {
        console.error('Error toggling quiz publish status:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating quiz status'
        });
    }
};

// Get quiz questions
exports.getQuizQuestions = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            const error = new Error(auth.message);
            error.statusCode = 403;
            throw error;
        }
        
        // Get quiz with questions
        const quiz = await Quiz.getWithQuestions(quizId, true); // true to include correct answers
        
        if (!quiz || quiz.module_id != moduleId) {
            return res.status(404).render('errors/not-found', {
                title: '404 - Not Found',
                message: 'Quiz not found',
                user: req.session.user
            });
        }
        
        res.render('instructor/quizzes/questions', {
            title: `Questions - ${quiz.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            quiz
        });
    } catch (error) {
        console.error('Error getting quiz questions:', error);
        req.flash('error_msg', 'An error occurred while retrieving quiz questions');
        res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes`);
    }
};

// Get quiz questions data (JSON)
exports.getQuizQuestionsData = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Get questions with options
        const quizData = await Quiz.getWithQuestions(quizId, true);
        
        // Return questions data
        return res.json({
            success: true,
            questions: quizData.questions || []
        });
    } catch (error) {
        console.error('Error getting quiz questions data:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving quiz questions'
        });
    }
};

// Create quiz question
exports.createQuizQuestion = async (req, res) => {
    try {
        console.log('Quiz question creation request received:', {
            moduleId: req.params.moduleId,
            quizId: req.params.quizId,
            body: req.body
        });
        
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            console.log('Authorization failed:', auth.message);
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            console.log('Quiz not found or does not belong to module:', {
                quizId,
                moduleId,
                quizModuleId: quiz ? quiz.module_id : null
            });
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Ensure Content-Type headers are set
        res.setHeader('Content-Type', 'application/json');
        
        // Process the question data from the request
        const questionData = {
            quiz_id: quizId,
            type: req.body.type,
            question_text: req.body.question_text,
            points: req.body.points || 1,
            options: req.body.options || []
        };
        
        console.log('Processed question data:', JSON.stringify(questionData, null, 2));
        console.log('Question type:', questionData.type);
        console.log('Options count:', questionData.options.length);
        
        // Clean and validate the question type
        const validTypes = ['multiple_choice', 'true_false', 'matching', 'short_answer', 'essay', 'fill_blank', 'dropdown', 'drag_drop'];
        
        // Normalize the question type
        let normalizedType = questionData.type.toLowerCase().trim();
        if (normalizedType === 'multiplechoice') normalizedType = 'multiple_choice';
        if (normalizedType === 'truefalse') normalizedType = 'true_false';
        if (normalizedType === 'shortanswer') normalizedType = 'short_answer';
        if (normalizedType === 'fillblank') normalizedType = 'fill_blank';
        if (normalizedType === 'dragdrop') normalizedType = 'drag_drop';
        
        questionData.type = normalizedType;
        
        if (!validTypes.includes(normalizedType)) {
            console.log('Invalid question type:', questionData.type);
            return res.status(400).json({
                success: false,
                message: `Invalid question type '${questionData.type}'. Must be one of: ${validTypes.join(', ')}`
            });
        }
        
        // Validate question text
        if (!questionData.question_text || questionData.question_text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Question text is required'
            });
        }
        
        console.log('Validated question type:', questionData.type);
        
        // Validate options based on question type
        if (questionData.type === 'multiple_choice' || questionData.type === 'dropdown') {
            // For multiple choice, require at least 2 options and one correct answer
            if (!questionData.options || questionData.options.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Multiple choice questions must have at least 2 options'
                });
            }
            
            // Ensure at least one option is marked as correct
            const hasCorrectOption = questionData.options.some(opt => opt.is_correct);
            if (!hasCorrectOption) {
                return res.status(400).json({
                    success: false,
                    message: 'Multiple choice questions must have at least one correct answer'
                });
            }
        } else if (questionData.type === 'true_false') {
            // Ensure true_false has exactly 2 options: True and False
            // If user didn't provide correct format, normalize it
            const correctAnswer = req.body.true_false_correct === 'true';
            questionData.options = [
                { option_text: 'True', is_correct: correctAnswer },
                { option_text: 'False', is_correct: !correctAnswer }
            ];
            console.log('Normalized true/false options:', questionData.options);
        } else if (questionData.type === 'short_answer') {
            // For short answer, require at least one accepted answer
            if (!questionData.options || questionData.options.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Short answer questions must have at least one accepted answer'
                });
            }
            
            // Ensure all options are marked as correct
            questionData.options = questionData.options.map(opt => ({
                ...opt,
                is_correct: true
            }));
        } else if (questionData.type === 'matching') {
            // For matching, check that we have at least 2 pairs
            if (!questionData.options || questionData.options.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: 'Matching questions must have at least 2 pairs (4 items total)'
                });
            }
            
            // Validate matching pairs have both sides
            const hasBothSides = questionData.options.every(opt => 
                opt.hasOwnProperty('matching_id') !== undefined && 
                opt.hasOwnProperty('side') && 
                (opt.side === 'left' || opt.side === 'right')
            );
            
            if (!hasBothSides) {
                console.log('Invalid matching options format:', questionData.options);
                return res.status(400).json({
                    success: false,
                    message: 'Matching questions must include properly formatted pairs with left and right sides'
                });
            }
            
            // Ensure all options are marked as correct
            questionData.options = questionData.options.map(opt => ({
                ...opt,
                is_correct: true
            }));
        }
        
        // Create the question
        const questionId = await Quiz.addQuestion(questionData);
        console.log('Question created successfully with ID:', questionId);
        
        if (req.xhr || req.headers.accept.includes('json')) {
            // Return JSON response for AJAX requests
            return res.json({
                success: true,
                question_id: questionId,
                message: 'Question added successfully'
            });
        } else {
            // Redirect for regular form submissions
            req.flash('success_msg', 'Question added successfully');
            res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}/questions`);
        }
    } catch (error) {
        console.error('Error creating quiz question:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        
        // Set the Content-Type header explicitly
        res.setHeader('Content-Type', 'application/json');
        
        if (req.xhr || req.headers.accept.includes('json')) {
            return res.status(500).json({
                success: false,
                message: `An error occurred while adding the question: ${error.message || 'Unknown error'}`
            });
        } else {
            req.flash('error_msg', 'An error occurred while adding the question');
            res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes/${req.params.quizId}/questions`);
        }
    }
};

// Update quiz question
exports.updateQuizQuestion = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const questionId = req.params.questionId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Process the question data from the request
        const questionData = {
            type: req.body.type,
            question_text: req.body.question_text,
            points: req.body.points || 1,
            options: req.body.options || []
        };
        
        // Update the question
        await Quiz.updateQuestion(questionId, questionData);
        
        if (req.xhr || req.headers.accept.includes('json')) {
            // Return JSON response for AJAX requests
            res.setHeader('Content-Type', 'application/json');
            return res.json({
                success: true,
                message: 'Question updated successfully'
            });
        } else {
            // Redirect for regular form submissions
            req.flash('success_msg', 'Question updated successfully');
            res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}/questions`);
        }
    } catch (error) {
        console.error('Error updating quiz question:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        
        if (req.xhr || req.headers.accept.includes('json')) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({
                success: false,
                message: `An error occurred while updating the question: ${error.message || 'Unknown error'}`
            });
        } else {
            req.flash('error_msg', 'An error occurred while updating the question');
            res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes/${req.params.quizId}/questions`);
        }
    }
};

// Delete quiz question
exports.deleteQuizQuestion = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const quizId = req.params.quizId;
        const questionId = req.params.questionId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if quiz belongs to the module
        const quiz = await Quiz.findById(quizId);
        if (!quiz || quiz.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Delete the question
        await Quiz.deleteQuestion(questionId);
        
        if (req.xhr || req.headers.accept.includes('json')) {
            // Return JSON response for AJAX requests
            res.setHeader('Content-Type', 'application/json');
            return res.json({
                success: true,
                message: 'Question deleted successfully'
            });
        } else {
            // Redirect for regular form submissions
            req.flash('success_msg', 'Question deleted successfully');
            res.redirect(`/instructor/modules/${moduleId}/quizzes/${quizId}/questions`);
        }
    } catch (error) {
        console.error('Error deleting quiz question:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        
        if (req.xhr || req.headers.accept.includes('json')) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({
                success: false,
                message: `An error occurred while deleting the question: ${error.message || 'Unknown error'}`
            });
        } else {
            req.flash('error_msg', 'An error occurred while deleting the question');
            res.redirect(`/instructor/modules/${req.params.moduleId}/quizzes/${req.params.quizId}/questions`);
        }
    }
};

// ASSIGNMENT MANAGEMENT
// Functions similar to pages and quizzes
// For brevity, not including all assignment functions here

// Get all assignments for a module
exports.getAssignments = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get assignments
        const assignments = await EnhancedAssignment.findByModule(moduleId);
        
        res.render('instructor/assignments/index', {
            title: `Assignments - ${auth.module.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            assignments
        });
    } catch (error) {
        console.error('Error getting assignments:', error);
        req.flash('error_msg', 'An error occurred while retrieving module assignments');
        res.redirect('/instructor/courses');
    }
};

// Get assignment creation form
exports.getCreateAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        res.render('instructor/assignments/create', {
            title: 'Create Assignment',
            user: req.session.user,
            course: auth.course,
            module: auth.module
        });
    } catch (error) {
        console.error('Error getting assignment creation form:', error);
        req.flash('error_msg', 'An error occurred while preparing the assignment form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments`);
    }
};

// Create a new assignment
exports.createAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/assignments/create`);
        }
        
        // Create assignment
        const assignmentData = {
            module_id: moduleId,
            title: req.body.title,
            instructions: req.body.instructions,
            submission_type: req.body.submission_type,
            allowed_file_types: req.body.allowed_file_types,
            points_possible: req.body.points_possible,
            due_date: req.body.due_date || null,
            available_from: req.body.available_from || null,
            available_until: req.body.available_until || null,
            allow_late_submissions: req.body.allow_late_submissions === 'true',
            late_submission_deduction: req.body.late_submission_deduction || 0,
            published: req.body.published === 'true',
            created_by: instructorId
        };
        
        const assignmentId = await EnhancedAssignment.create(assignmentData);
        
        req.flash('success_msg', 'Assignment created successfully');
        res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}`);
    } catch (error) {
        console.error('Error creating assignment:', error);
        req.flash('error_msg', 'An error occurred while creating the assignment');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments/create`);
    }
};

// View assignment
exports.getAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get assignment with course info
        const assignment = await EnhancedAssignment.getWithCourseInfo(assignmentId);
        
        if (!assignment || assignment.module_id != moduleId) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments`);
        }
        
        // Get submissions
        const submissions = await EnhancedAssignment.getSubmissions(assignmentId);
        
        res.render('instructor/assignments/view', {
            title: assignment.title,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            assignment,
            submissions
        });
    } catch (error) {
        console.error('Error viewing assignment:', error);
        req.flash('error_msg', 'An error occurred while retrieving the assignment');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments`);
    }
};

// Get assignment edit form
exports.getEditAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get assignment
        const assignment = await EnhancedAssignment.findById(assignmentId);
        
        if (!assignment || assignment.module_id != moduleId) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments`);
        }
        
        res.render('instructor/assignments/edit', {
            title: `Edit - ${assignment.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            assignment
        });
    } catch (error) {
        console.error('Error getting assignment edit form:', error);
        req.flash('error_msg', 'An error occurred while preparing the edit form');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments`);
    }
};

// Update assignment
exports.updateAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error_msg', errors.array()[0].msg);
            return res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}/edit`);
        }
        
        // Check if assignment belongs to the module
        const assignment = await EnhancedAssignment.findById(assignmentId);
        if (!assignment || assignment.module_id != moduleId) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments`);
        }
        
        // Update assignment
        const assignmentData = {
            title: req.body.title,
            instructions: req.body.instructions,
            submission_type: req.body.submission_type,
            allowed_file_types: req.body.allowed_file_types,
            points_possible: req.body.points_possible,
            due_date: req.body.due_date || null,
            available_from: req.body.available_from || null,
            available_until: req.body.available_until || null,
            allow_late_submissions: req.body.allow_late_submissions === 'true',
            late_submission_deduction: req.body.late_submission_deduction || 0,
            published: req.body.published === 'true'
        };
        
        await EnhancedAssignment.update(assignmentId, assignmentData);
        
        req.flash('success_msg', 'Assignment updated successfully');
        res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}`);
    } catch (error) {
        console.error('Error updating assignment:', error);
        req.flash('error_msg', 'An error occurred while updating the assignment');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments/${req.params.assignmentId}/edit`);
    }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Check if assignment belongs to the module
        const assignment = await EnhancedAssignment.findById(assignmentId);
        if (!assignment || assignment.module_id != moduleId) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments`);
        }
        
        // Delete assignment
        await EnhancedAssignment.delete(assignmentId);
        
        req.flash('success_msg', 'Assignment deleted successfully');
        res.redirect(`/instructor/modules/${moduleId}/assignments`);
    } catch (error) {
        console.error('Error deleting assignment:', error);
        req.flash('error_msg', 'An error occurred while deleting the assignment');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments`);
    }
};

// Toggle assignment publish status
exports.toggleAssignmentPublish = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            return res.status(403).json({
                success: false,
                message: auth.message
            });
        }
        
        // Check if assignment belongs to the module
        const assignment = await EnhancedAssignment.findById(assignmentId);
        if (!assignment || assignment.module_id != moduleId) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        // Toggle publish status
        const result = await EnhancedAssignment.togglePublish(assignmentId);
        
        res.json({
            success: result.success,
            published: result.published,
            message: `Assignment is now ${result.published ? 'published' : 'unpublished'}`
        });
    } catch (error) {
        console.error('Error toggling assignment publish status:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating assignment status'
        });
    }
};

// Get submissions for an assignment
exports.getSubmissions = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get assignment with course info
        const assignment = await EnhancedAssignment.getWithCourseInfo(assignmentId);
        
        if (!assignment || assignment.module_id != moduleId) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments`);
        }
        
        // Get submissions with student info
        const [submissions] = await db.query(
            `SELECT es.*, u.first_name, u.last_name, u.email,
                    CASE WHEN es.score IS NOT NULL THEN TRUE ELSE FALSE END as graded,
                    CASE WHEN es.is_late = 1 THEN TRUE ELSE FALSE END as is_late,
                    (SELECT COUNT(*) FROM enhanced_submissions es2 
                     WHERE es2.assignment_id = es.assignment_id 
                     AND es2.student_id = es.student_id 
                     AND es2.submitted_at < es.submitted_at) as submission_count
             FROM enhanced_submissions es
             JOIN users u ON es.student_id = u.user_id
             WHERE es.assignment_id = ?
             ORDER BY es.submitted_at DESC`,
            [assignmentId]
        );
        
        res.render('instructor/assignments/submissions', {
            title: `Submissions - ${assignment.title}`,
            user: req.session.user,
            course: auth.course,
            module: auth.module,
            assignment,
            submissions
        });
    } catch (error) {
        console.error('Error getting assignment submissions:', error);
        req.flash('error_msg', 'An error occurred while retrieving submissions');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments`);
    }
};

// View a submission
exports.getSubmission = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const submissionId = req.params.submissionId;
        const instructorId = req.session.user.user_id;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Get assignment details
        const [assignmentRows] = await db.query(
            `SELECT ea.*, m.title as module_name, c.title as course_name, c.course_id
             FROM enhanced_assignments ea
             JOIN modules m ON ea.module_id = m.module_id
             JOIN courses c ON m.course_id = c.course_id
             WHERE ea.assignment_id = ?`,
            [assignmentId]
        );
        
        if (assignmentRows.length === 0) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}`);
        }
        
        const assignment = assignmentRows[0];
        
        // Get submission with student info and grading details
        const [submissionRows] = await db.query(
            `SELECT es.*, u.first_name, u.last_name, u.email, u.username,
                    IFNULL(es.file_url, '') as file_url,
                    IFNULL(es.file_name, '') as file_name,
                    IFNULL(es.file_type, '') as file_type,
                    IFNULL(es.feedback, '') as feedback,
                    IFNULL(es.score, '') as score,
                    CASE WHEN es.score IS NOT NULL THEN TRUE ELSE FALSE END as graded,
                    CASE WHEN es.is_late = 1 THEN TRUE ELSE FALSE END as is_late,
                    (SELECT CONCAT(u2.first_name, ' ', u2.last_name) 
                     FROM users u2 
                     WHERE u2.user_id = es.graded_by) as graded_by_name
             FROM enhanced_submissions es
             JOIN users u ON es.student_id = u.user_id
             WHERE es.submission_id = ?`,
            [submissionId]
        );
        
        if (submissionRows.length === 0) {
            req.flash('error_msg', 'Submission not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}/submissions`);
        }
        
        const submission = submissionRows[0];
        
        // Render the submission view
        res.render('instructor/assignments/submission', {
            title: `Submission - ${submission.first_name} ${submission.last_name}`,
            user: req.session.user,
            course: {
                course_id: assignment.course_id,
                course_name: assignment.course_name
            },
            module: {
                module_id: moduleId,
                module_name: assignment.module_name
            },
            assignment,
            submission
        });
    } catch (error) {
        console.error('Error viewing submission:', error);
        req.flash('error_msg', 'An error occurred while retrieving the submission');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments/${req.params.assignmentId}/submissions`);
    }
};

// Grade a submission
exports.gradeSubmission = async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const assignmentId = req.params.assignmentId;
        const submissionId = req.params.submissionId;
        const instructorId = req.session.user.user_id;
        const { score, feedback } = req.body;
        
        // Check authorization
        const auth = await checkModuleAuthorization(moduleId, instructorId);
        if (!auth.authorized) {
            req.flash('error_msg', auth.message);
            return res.redirect('/instructor/courses');
        }
        
        // Validate score
        const [assignmentRows] = await db.query(
            'SELECT points_possible FROM enhanced_assignments WHERE assignment_id = ?',
            [assignmentId]
        );
        
        if (assignmentRows.length === 0) {
            req.flash('error_msg', 'Assignment not found');
            return res.redirect(`/instructor/modules/${moduleId}`);
        }
        
        const assignment = assignmentRows[0];
        const maxScore = parseFloat(assignment.points_possible);
        const parsedScore = parseFloat(score);
        
        if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore) {
            req.flash('error_msg', `Score must be between 0 and ${maxScore}`);
            return res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}/submissions/${submissionId}`);
        }

        // Get submission details
        const [submission] = await db.query(
            `SELECT es.*, m.course_id
             FROM enhanced_submissions es
             JOIN enhanced_assignments ea ON es.assignment_id = ea.assignment_id
             JOIN modules m ON ea.module_id = m.module_id
             WHERE es.submission_id = ?`,
            [submissionId]
        );

        if (!submission || submission.length === 0) {
            req.flash('error_msg', 'Submission not found');
            return res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}/submissions`);
        }

        // Update submission with grade
        await db.query(
            `UPDATE enhanced_submissions 
             SET score = ?, 
                 feedback = ?, 
                 graded_by = ?, 
                 graded_at = NOW(),
                 grade_percentage = (score / ?) * 100
             WHERE submission_id = ?`,
            [parsedScore, feedback, instructorId, maxScore, submissionId]
        );

        // Automatically calculate and update student grades
        await Instructor.calculateStudentGrades(submission[0].student_id, submission[0].course_id);
        
        req.flash('success_msg', 'Grade recorded successfully');
        res.redirect(`/instructor/modules/${moduleId}/assignments/${assignmentId}/submissions`);
    } catch (error) {
        console.error('Error grading submission:', error);
        req.flash('error_msg', 'An error occurred while grading the submission');
        res.redirect(`/instructor/modules/${req.params.moduleId}/assignments/${req.params.assignmentId}/submissions`);
    }
}; 
