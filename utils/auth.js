/**
 * Authentication and Authorization middleware
 */

// Check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error_msg', 'Please log in to access this resource');
    return res.redirect('/auth/login');
};

// Restrict access to only home, login and signup pages for unauthenticated users
const restrictAccess = (req, res, next) => {
    const publicPaths = ['/', '/auth/login', '/auth/register'];
    const isPublicPath = publicPaths.includes(req.path);
    
    // Allow access to static files and public paths
    if (req.path.startsWith('/public/') || isPublicPath || req.session.user) {
        return next();
    }
    
    req.flash('error_msg', 'Please log in to access this resource');
    return res.redirect('/auth/login');
};

// Check if user is an admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'Access denied. Admin privileges required.');
    return res.redirect('/');
};

// Check if user is an instructor
const isInstructor = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'instructor') {
        return next();
    }
    req.flash('error_msg', 'Access denied. Instructor privileges required.');
    return res.redirect('/');
};

// Check if user is a student
const isStudent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
        return next();
    }
    req.flash('error_msg', 'Access denied. Student privileges required.');
    return res.redirect('/');
};

// Check if user is either an admin or instructor
const isAdminOrInstructor = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'instructor')) {
        return next();
    }
    req.flash('error_msg', 'Access denied. Admin or instructor privileges required.');
    return res.redirect('/');
};

// Check if user is either an admin or the instructor assigned to the specific course
const isAdminOrCourseInstructor = async (req, res, next) => {
    try {
        if (!req.session.user) {
            req.flash('error_msg', 'Please log in to access this resource');
            return res.redirect('/auth/login');
        }
        
        // Admin can access any course
        if (req.session.user.role === 'admin') {
            return next();
        }
        
        // Check if instructor is assigned to this course
        if (req.session.user.role === 'instructor') {
            const courseId = req.params.id;
            const db = require('../db');
            
            const [rows] = await db.query(
                'SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [courseId, req.session.user.user_id]
            );
            
            if (rows.length > 0) {
                return next();
            }
        }
        
        req.flash('error_msg', 'Access denied. You are not authorized to access this course.');
        return res.redirect('/');
    } catch (error) {
        console.error('Error in authorization middleware:', error);
        req.flash('error_msg', 'An error occurred. Please try again later.');
        return res.redirect('/');
    }
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isInstructor,
    isStudent,
    isAdminOrInstructor,
    isAdminOrCourseInstructor,
    restrictAccess
}; 