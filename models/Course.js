const db = require('../db');

class Course {
    // Find course by ID
    static async findById(id) {
        try {
            const [rows] = await db.query(
                `SELECT c.*, s.semester_name, s.start_date, s.end_date
                FROM courses c
                JOIN semesters s ON c.semester_id = s.semester_id
                WHERE c.course_id = ?`,
                [id]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding course by ID:', error);
            throw error;
        }
    }

    // Find course by course code
    static async findByCourseCode(courseCode) {
        try {
            const [rows] = await db.query(
                `SELECT c.*, s.semester_name, s.start_date, s.end_date
                FROM courses c
                JOIN semesters s ON c.semester_id = s.semester_id
                WHERE c.course_code = ?`,
                [courseCode]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding course by code:', error);
            throw error;
        }
    }

    // Create a new course
    static async create(courseData) {
        try {
            const [result] = await db.query(
                `INSERT INTO courses 
                (course_code, title, description, credit_hours, semester_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    courseData.course_code,
                    courseData.title,
                    courseData.description || null,
                    courseData.credit_hours,
                    courseData.semester_id,
                    courseData.is_active !== undefined ? courseData.is_active : true
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating course:', error);
            throw error;
        }
    }

    // Update course
    static async update(id, courseData) {
        try {
            const [result] = await db.query(
                `UPDATE courses SET
                course_code = ?,
                title = ?,
                description = ?,
                credit_hours = ?,
                semester_id = ?,
                is_active = ?
                WHERE course_id = ?`,
                [
                    courseData.course_code,
                    courseData.title,
                    courseData.description || null,
                    courseData.credit_hours,
                    courseData.semester_id,
                    courseData.is_active !== undefined ? courseData.is_active : true,
                    id
                ]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating course:', error);
            throw error;
        }
    }

    // Delete course
    static async delete(id) {
        try {
            const [result] = await db.query(
                'DELETE FROM courses WHERE course_id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting course:', error);
            throw error;
        }
    }

    // Get all courses (optionally filter by semester and/or active status)
    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT c.*, s.semester_name, s.start_date, s.end_date,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.course_id) AS enrolled_students,
                    (SELECT CONCAT(u.first_name, ' ', u.last_name) 
                     FROM course_instructors ci 
                     JOIN users u ON ci.instructor_id = u.user_id 
                     WHERE ci.course_id = c.course_id 
                     LIMIT 1) AS instructor_name
                FROM courses c
                JOIN semesters s ON c.semester_id = s.semester_id
            `;
            
            const params = [];
            const conditions = [];
            
            if (filters.semester_id) {
                conditions.push('c.semester_id = ?');
                params.push(filters.semester_id);
            }
            
            if (filters.is_active !== undefined) {
                conditions.push('c.is_active = ?');
                params.push(filters.is_active);
            }
            
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            
            query += ' ORDER BY s.start_date DESC, c.title';
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error finding courses:', error);
            throw error;
        }
    }

    // Search courses by name, code, or description
    static async search(searchTerm, filters = {}) {
        try {
            // First get all courses with the given filters
            const courses = await this.findAll(filters);
            
            // If no search term, return all courses
            if (!searchTerm) {
                return courses;
            }
            
            // Apply search filter (case insensitive)
            const searchTermLower = searchTerm.toLowerCase();
            return courses.filter(course => 
                course.title.toLowerCase().includes(searchTermLower) || 
                course.course_code.toLowerCase().includes(searchTermLower) ||
                (course.description && course.description.toLowerCase().includes(searchTermLower))
            );
        } catch (error) {
            console.error('Error searching courses:', error);
            throw error;
        }
    }

    // Assign instructor to course
    static async assignInstructor(courseId, instructorId) {
        try {
            // Check if assignment already exists
            const [existingAssignment] = await db.query(
                'SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [courseId, instructorId]
            );
            
            if (existingAssignment.length > 0) {
                return existingAssignment[0].assignment_id;
            }
            
            const [result] = await db.query(
                'INSERT INTO course_instructors (course_id, instructor_id) VALUES (?, ?)',
                [courseId, instructorId]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error assigning instructor to course:', error);
            throw error;
        }
    }

    // Remove instructor from course
    static async removeInstructor(courseId, instructorId) {
        try {
            const [result] = await db.query(
                'DELETE FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [courseId, instructorId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error removing instructor from course:', error);
            throw error;
        }
    }

    // Get all instructors for a course
    static async getInstructors(courseId) {
        try {
            // Check if instructor_profiles table exists or has entries first
            let hasProfiles = true;
            try {
                const [profileCheck] = await db.query('SELECT 1 FROM instructor_profiles LIMIT 1');
                if (profileCheck.length === 0) {
                    hasProfiles = false;
                }
            } catch (err) {
                // Table might not exist
                hasProfiles = false;
            }
            
            let query;
            if (hasProfiles) {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username,
                        ip.department, ip.office_location, ip.office_hours,
                        ci.assignment_id, ci.assigned_at
                    FROM course_instructors ci
                    JOIN users u ON ci.instructor_id = u.user_id
                    LEFT JOIN instructor_profiles ip ON u.user_id = ip.user_id
                    WHERE ci.course_id = ?
                    ORDER BY u.last_name, u.first_name`;
            } else {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username,
                        NULL as department, NULL as office_location, NULL as office_hours,
                        ci.assignment_id, ci.assigned_at
                    FROM course_instructors ci
                    JOIN users u ON ci.instructor_id = u.user_id
                    WHERE ci.course_id = ?
                    ORDER BY u.last_name, u.first_name`;
            }
            
            const [rows] = await db.query(query, [courseId]);
            return [rows, hasProfiles];
        } catch (error) {
            console.error('Error getting course instructors:', error);
            throw error;
        }
    }

    // Enroll student in a course
    static async enrollStudent(courseId, studentId) {
        try {
            // Check if enrollment already exists
            const [existingEnrollment] = await db.query(
                'SELECT * FROM enrollments WHERE course_id = ? AND student_id = ?',
                [courseId, studentId]
            );
            
            if (existingEnrollment.length > 0) {
                // If enrollment exists but was dropped, reactivate it
                if (existingEnrollment[0].status === 'dropped') {
                    await db.query(
                        'UPDATE enrollments SET status = ? WHERE enrollment_id = ?',
                        ['active', existingEnrollment[0].enrollment_id]
                    );
                }
                
                return existingEnrollment[0].enrollment_id;
            }
            
            const [result] = await db.query(
                'INSERT INTO enrollments (course_id, student_id) VALUES (?, ?)',
                [courseId, studentId]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error enrolling student in course:', error);
            throw error;
        }
    }

    // Remove student from course (mark as dropped)
    static async dropStudent(courseId, studentId) {
        try {
            const [result] = await db.query(
                'UPDATE enrollments SET status = ? WHERE course_id = ? AND student_id = ?',
                ['dropped', courseId, studentId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error dropping student from course:', error);
            throw error;
        }
    }

    // Get course materials
    static async getMaterials(courseId) {
        try {
            const [rows] = await db.query(
                `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by_name
                FROM materials m
                JOIN users u ON m.uploaded_by = u.user_id
                WHERE m.course_id = ?
                ORDER BY m.upload_date DESC`,
                [courseId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting course materials:', error);
            throw error;
        }
    }

    // Add course material
    static async addMaterial(materialData) {
        try {
            const [result] = await db.query(
                `INSERT INTO materials
                (course_id, title, description, file_path, link_url, material_type, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    materialData.course_id,
                    materialData.title,
                    materialData.description || null,
                    materialData.file_path || null,
                    materialData.link_url || null,
                    materialData.material_type,
                    materialData.uploaded_by
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error adding course material:', error);
            throw error;
        }
    }

    // Delete course material
    static async deleteMaterial(materialId, uploadedBy) {
        try {
            // Check if the user is the uploader
            const [material] = await db.query(
                'SELECT * FROM materials WHERE material_id = ?',
                [materialId]
            );
            
            if (material.length === 0) {
                throw new Error('Material not found');
            }
            
            // Delete the material
            const [result] = await db.query(
                'DELETE FROM materials WHERE material_id = ?',
                [materialId]
            );
            
            return {
                success: result.affectedRows > 0,
                filePath: material[0].file_path
            };
        } catch (error) {
            console.error('Error deleting course material:', error);
            throw error;
        }
    }

    // Get course assignments
    static async getAssignments(courseId) {
        try {
            const [rows] = await db.query(
                `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
                FROM assignments a
                JOIN users u ON a.created_by = u.user_id
                WHERE a.course_id = ?
                ORDER BY a.due_date`,
                [courseId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting course assignments:', error);
            throw error;
        }
    }

    // Get students enrolled in a course
    static async getEnrolledStudents(courseId, filters = {}) {
        try {
            // First check if student_profiles table exists
            let hasStudentProfiles = true;
            try {
                await db.query('SELECT 1 FROM student_profiles LIMIT 1');
            } catch (err) {
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    hasStudentProfiles = false;
                }
            }
            
            let query;
            if (hasStudentProfiles) {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username, u.is_active, 
                           sp.student_id, e.enrollment_id, e.status, e.enrollment_date,
                           0 as submission_count
                    FROM enrollments e
                    JOIN users u ON e.student_id = u.user_id
                    JOIN student_profiles sp ON u.user_id = sp.user_id
                `;
            } else {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username, u.is_active,
                           CONCAT('STU', u.user_id) as student_id, e.enrollment_id, e.status, e.enrollment_date,
                           0 as submission_count
                    FROM enrollments e
                    JOIN users u ON e.student_id = u.user_id
                `;
            }
            
            const params = [];
            const conditions = ['e.course_id = ?'];
            params.push(courseId);
            
            // Apply status filter
            if (filters.status) {
                conditions.push('e.status = ?');
                params.push(filters.status);
            }
            
            // Apply search filter
            if (filters.search) {
                if (hasStudentProfiles) {
                    conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR sp.student_id LIKE ?)');
                    const searchTerm = `%${filters.search}%`;
                    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
                } else {
                    conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)');
                    const searchTerm = `%${filters.search}%`;
                    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
                }
            }
            
            query += ` WHERE ${conditions.join(' AND ')}`;
            query += ' ORDER BY u.first_name, u.last_name';
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error getting enrolled students:', error);
            throw error;
        }
    }

    // Add assignment
    static async addAssignment(assignmentData) {
        try {
            const [result] = await db.query(
                `INSERT INTO assignments
                (course_id, title, description, due_date, max_points, weight_percentage, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    assignmentData.course_id,
                    assignmentData.title,
                    assignmentData.description || null,
                    assignmentData.due_date,
                    assignmentData.max_points,
                    assignmentData.weight_percentage,
                    assignmentData.created_by
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error adding assignment:', error);
            throw error;
        }
    }

    // Update assignment
    static async updateAssignment(assignmentId, assignmentData) {
        try {
            const [result] = await db.query(
                `UPDATE assignments SET
                title = ?,
                description = ?,
                due_date = ?,
                max_points = ?,
                weight_percentage = ?
                WHERE assignment_id = ?`,
                [
                    assignmentData.title,
                    assignmentData.description || null,
                    assignmentData.due_date,
                    assignmentData.max_points,
                    assignmentData.weight_percentage,
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
    static async deleteAssignment(assignmentId) {
        try {
            const [result] = await db.query(
                'DELETE FROM assignments WHERE assignment_id = ?',
                [assignmentId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting assignment:', error);
            throw error;
        }
    }
}

module.exports = Course; 