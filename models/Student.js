const db = require('../db');

class Student {
    // Find student profile by user ID
    static async findByUserId(userId) {
        try {
            const [rows] = await db.query(
                `SELECT sp.*, u.first_name, u.last_name, u.email, u.username
                FROM student_profiles sp
                JOIN users u ON sp.user_id = u.user_id
                WHERE sp.user_id = ?`,
                [userId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding student profile:', error);
            throw error;
        }
    }

    // Create a new student profile
    static async create(profileData) {
        try {
            const [result] = await db.query(
                `INSERT INTO student_profiles 
                (user_id, student_id, date_of_birth, address, phone, enrollment_date, current_semester)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    profileData.user_id,
                    profileData.student_id,
                    profileData.date_of_birth || null,
                    profileData.address || null,
                    profileData.phone || null,
                    profileData.enrollment_date,
                    profileData.current_semester || 1
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating student profile:', error);
            throw error;
        }
    }

    // Update student profile
    static async update(userId, profileData) {
        try {
            const [result] = await db.query(
                `UPDATE student_profiles SET
                date_of_birth = ?,
                address = ?,
                phone = ?,
                current_semester = ?
                WHERE user_id = ?`,
                [
                    profileData.date_of_birth || null,
                    profileData.address || null,
                    profileData.phone || null,
                    profileData.current_semester,
                    userId
                ]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating student profile:', error);
            throw error;
        }
    }

    // Get all enrolled courses for a student
    static async getEnrolledCourses(userId) {
        try {
            const [rows] = await db.query(
                `SELECT c.*, e.enrollment_id, e.status, e.final_grade,
                    s.semester_name,
                    CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                JOIN semesters s ON c.semester_id = s.semester_id
                LEFT JOIN course_instructors ci ON c.course_id = ci.course_id
                LEFT JOIN users u ON ci.instructor_id = u.user_id
                WHERE e.student_id = ?
                ORDER BY s.start_date DESC, c.title`,
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting enrolled courses:', error);
            throw error;
        }
    }

    // Get all grades for a student
    static async getGrades(userId) {
        try {
            const [rows] = await db.query(
                `SELECT g.*, a.title AS assignment_title, a.max_points,
                    c.course_code, c.title AS course_title, c.credit_hours
                FROM grades g
                JOIN assignments a ON g.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE g.student_id = ?
                ORDER BY g.graded_at DESC`,
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting student grades:', error);
            throw error;
        }
    }

    // Calculate GPA for a student
    static async calculateGPA(userId) {
        try {
            const [rows] = await db.query(
                `SELECT c.credit_hours, e.final_grade
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                WHERE e.student_id = ? AND e.final_grade IS NOT NULL`,
                [userId]
            );
            
            if (rows.length === 0) {
                return 0.0;
            }
            
            let totalPoints = 0;
            let totalCredits = 0;
            
            for (const row of rows) {
                totalPoints += row.final_grade * row.credit_hours;
                totalCredits += row.credit_hours;
            }
            
            return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0.0;
        } catch (error) {
            console.error('Error calculating GPA:', error);
            throw error;
        }
    }

    // Get student attendance records
    static async getAttendance(userId, courseId = null) {
        try {
            let query = `
                SELECT a.*, c.course_code, c.title AS course_title
                FROM attendance a
                JOIN courses c ON a.course_id = c.course_id
                WHERE a.student_id = ?
            `;
            
            const params = [userId];
            
            if (courseId) {
                query += ' AND a.course_id = ?';
                params.push(courseId);
            }
            
            query += ' ORDER BY a.class_date DESC';
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error getting attendance records:', error);
            throw error;
        }
    }
}

module.exports = Student; 