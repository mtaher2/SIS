const db = require('../db');

class EnhancedAssignment {
    // Find assignment by ID
    static async findById(assignmentId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM enhanced_assignments WHERE assignment_id = ?',
                [assignmentId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding assignment by ID:', error);
            throw error;
        }
    }

    // Get all assignments for a module
    static async findByModule(moduleId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM enhanced_assignments WHERE module_id = ? ORDER BY created_at',
                [moduleId]
            );
            return rows;
        } catch (error) {
            console.error('Error finding assignments by module:', error);
            throw error;
        }
    }

    // Create a new assignment
    static async create(assignmentData) {
        try {
            const [result] = await db.query(
                `INSERT INTO enhanced_assignments 
                (module_id, title, instructions, submission_type, allowed_file_types,
                points_possible, due_date, available_from, available_until,
                allow_late_submissions, late_submission_deduction, published, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    assignmentData.module_id,
                    assignmentData.title,
                    assignmentData.instructions || null,
                    assignmentData.submission_type || 'file_upload',
                    assignmentData.allowed_file_types || null,
                    assignmentData.points_possible || 0,
                    assignmentData.due_date || null,
                    assignmentData.available_from || null,
                    assignmentData.available_until || null,
                    assignmentData.allow_late_submissions !== undefined ? assignmentData.allow_late_submissions : true,
                    assignmentData.late_submission_deduction || 0,
                    assignmentData.published || false,
                    assignmentData.created_by
                ]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error creating assignment:', error);
            throw error;
        }
    }

    // Update assignment
    static async update(assignmentId, assignmentData) {
        try {
            const [result] = await db.query(
                `UPDATE enhanced_assignments SET
                title = ?,
                instructions = ?,
                submission_type = ?,
                allowed_file_types = ?,
                points_possible = ?,
                due_date = ?,
                available_from = ?,
                available_until = ?,
                allow_late_submissions = ?,
                late_submission_deduction = ?,
                published = ?
                WHERE assignment_id = ?`,
                [
                    assignmentData.title,
                    assignmentData.instructions || null,
                    assignmentData.submission_type || 'file_upload',
                    assignmentData.allowed_file_types || null,
                    assignmentData.points_possible || 0,
                    assignmentData.due_date || null,
                    assignmentData.available_from || null,
                    assignmentData.available_until || null,
                    assignmentData.allow_late_submissions !== undefined ? assignmentData.allow_late_submissions : true,
                    assignmentData.late_submission_deduction || 0,
                    assignmentData.published !== undefined ? assignmentData.published : false,
                    assignmentId
                ]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating assignment:', error);
            throw error;
        }
    }

    // Delete assignment
    static async delete(assignmentId) {
        try {
            const [result] = await db.query(
                'DELETE FROM enhanced_assignments WHERE assignment_id = ?',
                [assignmentId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting assignment:', error);
            throw error;
        }
    }

    // Get assignment with course and module info
    static async getWithCourseInfo(assignmentId) {
        try {
            const [rows] = await db.query(
                `SELECT ea.*, m.title as module_title, c.course_id, c.title as course_title,
                        u.first_name, u.last_name
                FROM enhanced_assignments ea
                JOIN modules m ON ea.module_id = m.module_id
                JOIN courses c ON m.course_id = c.course_id
                JOIN users u ON ea.created_by = u.user_id
                WHERE ea.assignment_id = ?`,
                [assignmentId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error getting assignment with course info:', error);
            throw error;
        }
    }

    // Submit assignment
    static async submitAssignment(submissionData) {
        try {
            // Check if the assignment exists and is available
            const [assignment] = await db.query(
                `SELECT * FROM enhanced_assignments 
                WHERE assignment_id = ?`,
                [submissionData.assignment_id]
            );
            
            if (!assignment.length) {
                throw new Error('Assignment not found');
            }
            
            const now = new Date();
            const dueDate = assignment[0].due_date ? new Date(assignment[0].due_date) : null;
            const isLate = dueDate && now > dueDate;
            
            // Check if submission already exists
            const [existingSubmission] = await db.query(
                `SELECT * FROM enhanced_submissions 
                WHERE assignment_id = ? AND student_id = ?`,
                [submissionData.assignment_id, submissionData.student_id]
            );
            
            if (existingSubmission.length) {
                // Update existing submission
                const [result] = await db.query(
                    `UPDATE enhanced_submissions SET
                    submission_text = ?,
                    file_path = ?,
                    external_url = ?,
                    submission_date = NOW(),
                    is_late = ?,
                    updated_at = NOW()
                    WHERE submission_id = ?`,
                    [
                        submissionData.submission_text || null,
                        submissionData.file_path || null,
                        submissionData.external_url || null,
                        isLate,
                        existingSubmission[0].submission_id
                    ]
                );
                
                return {
                    submission_id: existingSubmission[0].submission_id,
                    is_updated: true,
                    is_late: isLate
                };
            } else {
                // Create new submission
                const [result] = await db.query(
                    `INSERT INTO enhanced_submissions
                    (assignment_id, student_id, submission_text, file_path, external_url, submission_date, is_late)
                    VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                    [
                        submissionData.assignment_id,
                        submissionData.student_id,
                        submissionData.submission_text || null,
                        submissionData.file_path || null,
                        submissionData.external_url || null,
                        isLate
                    ]
                );
                
                return {
                    submission_id: result.insertId,
                    is_updated: false,
                    is_late: isLate
                };
            }
        } catch (error) {
            console.error('Error submitting assignment:', error);
            throw error;
        }
    }

    // Grade submission
    static async gradeSubmission(submissionId, gradeData) {
        try {
            const [result] = await db.query(
                `UPDATE enhanced_submissions SET
                score = ?,
                feedback = ?,
                graded_by = ?,
                graded_at = NOW()
                WHERE submission_id = ?`,
                [
                    gradeData.score,
                    gradeData.feedback || null,
                    gradeData.graded_by,
                    submissionId
                ]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error grading submission:', error);
            throw error;
        }
    }

    // Get student submissions for an assignment
    static async getSubmissions(assignmentId) {
        try {
            const [rows] = await db.query(
                `SELECT es.*, u.first_name, u.last_name, u.username
                FROM enhanced_submissions es
                JOIN users u ON es.student_id = u.user_id
                WHERE es.assignment_id = ?
                ORDER BY es.submission_date DESC`,
                [assignmentId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting assignment submissions:', error);
            throw error;
        }
    }

    // Get a specific submission
    static async getSubmission(submissionId) {
        try {
            const [rows] = await db.query(
                `SELECT es.*, u.first_name, u.last_name, u.username,
                        ea.title as assignment_title, ea.due_date, ea.points_possible
                FROM enhanced_submissions es
                JOIN users u ON es.student_id = u.user_id
                JOIN enhanced_assignments ea ON es.assignment_id = ea.assignment_id
                WHERE es.submission_id = ?`,
                [submissionId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error getting submission:', error);
            throw error;
        }
    }

    // Get student submission for an assignment
    static async getStudentSubmission(assignmentId, studentId) {
        try {
            const [rows] = await db.query(
                `SELECT * FROM enhanced_submissions
                WHERE assignment_id = ? AND student_id = ?`,
                [assignmentId, studentId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error getting student submission:', error);
            throw error;
        }
    }

    // Get all assignments for a course (across all modules)
    static async findByCourse(courseId) {
        try {
            const [rows] = await db.query(
                `SELECT ea.*, m.title as module_title
                FROM enhanced_assignments ea
                JOIN modules m ON ea.module_id = m.module_id
                WHERE m.course_id = ?
                ORDER BY m.position, ea.created_at`,
                [courseId]
            );
            return rows;
        } catch (error) {
            console.error('Error finding assignments by course:', error);
            throw error;
        }
    }

    // Toggle publish status
    static async togglePublish(assignmentId) {
        try {
            // Get current publish status
            const [assignmentResult] = await db.query(
                'SELECT published FROM enhanced_assignments WHERE assignment_id = ?',
                [assignmentId]
            );
            
            if (!assignmentResult.length) {
                throw new Error('Assignment not found');
            }
            
            const currentStatus = assignmentResult[0].published;
            
            // Toggle status
            const [result] = await db.query(
                'UPDATE enhanced_assignments SET published = ? WHERE assignment_id = ?',
                [!currentStatus, assignmentId]
            );
            
            return {
                success: result.affectedRows > 0,
                published: !currentStatus
            };
        } catch (error) {
            console.error('Error toggling assignment publish status:', error);
            throw error;
        }
    }
}

module.exports = EnhancedAssignment; 