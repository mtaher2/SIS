const db = require('../db');

class Instructor {
    // Find instructor profile by user ID
    static async findByUserId(userId) {
        try {
            const [rows] = await db.query(
                `SELECT ip.*, u.first_name, u.last_name, u.email, u.username
                FROM instructor_profiles ip
                JOIN users u ON ip.user_id = u.user_id
                WHERE ip.user_id = ?`,
                [userId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding instructor profile:', error);
            throw error;
        }
    }

    // Create a new instructor profile
    static async create(profileData) {
        try {
            console.log('Creating new instructor profile with data:', profileData);
            const [result] = await db.query(
                `INSERT INTO instructor_profiles 
                (user_id, department, office_location, office_hours, phone)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    profileData.user_id,
                    profileData.department,
                    profileData.office_location || null,
                    profileData.office_hours || null,
                    profileData.phone || null
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating instructor profile:', error);
            throw error;
        }
    }

    // Update instructor profile
    static async update(userId, profileData) {
        try {
            console.log('Updating instructor profile for user ID:', userId);
            console.log('Update data:', profileData);
            
            // First check if the instructor profile exists
            const [existingProfile] = await db.query(
                'SELECT * FROM instructor_profiles WHERE user_id = ?',
                [userId]
            );
            
            if (existingProfile.length === 0) {
                console.log('No existing profile found, creating new one');
                // If profile doesn't exist, create it
                const profileWithUserId = {
                    ...profileData,
                    user_id: userId
                };
                return await this.create(profileWithUserId);
            }
            
            // Update existing profile
            const [result] = await db.query(
                `UPDATE instructor_profiles SET
                department = ?,
                office_location = ?,
                office_hours = ?,
                phone = ?
                WHERE user_id = ?`,
                [
                    profileData.department,
                    profileData.office_location || null,
                    profileData.office_hours || null,
                    profileData.phone || null,
                    userId
                ]
            );
            console.log('Update result:', result);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating instructor profile:', error);
            throw error;
        }
    }

    // Get all courses taught by an instructor
    static async getAssignedCourses(userId) {
        try {
            const [rows] = await db.query(
                `SELECT c.*, s.semester_name,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.course_id) AS enrolled_students
                FROM course_instructors ci
                JOIN courses c ON ci.course_id = c.course_id
                JOIN semesters s ON c.semester_id = s.semester_id
                WHERE ci.instructor_id = ?
                ORDER BY s.start_date DESC, c.title`,
                [userId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting assigned courses:', error);
            throw error;
        }
    }

    // Get all students enrolled in a specific course taught by the instructor
    static async getCourseStudents(courseId, instructorId) {
        try {
            // First check if instructor is assigned to this course
            const [instructorCheck] = await db.query(
                'SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [courseId, instructorId]
            );
            
            if (instructorCheck.length === 0) {
                throw new Error('Instructor is not assigned to this course');
            }
            
            // Check if student_profiles table exists
            let hasStudentProfiles = true;
            try {
                await db.query('SELECT 1 FROM student_profiles LIMIT 1');
            } catch (err) {
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    hasStudentProfiles = false;
                }
            }
            
            // Get students
            let query;
            if (hasStudentProfiles) {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username,
                        e.enrollment_id, e.status, e.final_grade,
                        sp.student_id
                    FROM enrollments e
                    JOIN users u ON e.student_id = u.user_id
                    JOIN student_profiles sp ON u.user_id = sp.user_id
                    WHERE e.course_id = ?
                    ORDER BY u.last_name, u.first_name
                `;
            } else {
                query = `
                    SELECT u.user_id, u.first_name, u.last_name, u.email, u.username,
                        e.enrollment_id, e.status, e.final_grade,
                        CONCAT('STU', u.user_id) as student_id
                    FROM enrollments e
                    JOIN users u ON e.student_id = u.user_id
                    WHERE e.course_id = ?
                    ORDER BY u.last_name, u.first_name
                `;
            }
            
            const [rows] = await db.query(query, [courseId]);
            return rows;
        } catch (error) {
            console.error('Error getting course students:', error);
            throw error;
        }
    }

    // Record student grade for an assignment
    static async recordGrade(gradeData) {
        try {
            // Check if a grade already exists
            const [existingGrade] = await db.query(
                'SELECT * FROM grades WHERE student_id = ? AND assignment_id = ?',
                [gradeData.student_id, gradeData.assignment_id]
            );
            
            if (existingGrade.length > 0) {
                // Update existing grade
                const [result] = await db.query(
                    `UPDATE grades SET
                    points_earned = ?,
                    graded_by = ?,
                    comments = ?
                    WHERE student_id = ? AND assignment_id = ?`,
                    [
                        gradeData.points_earned,
                        gradeData.graded_by,
                        gradeData.comments || null,
                        gradeData.student_id,
                        gradeData.assignment_id
                    ]
                );
                
                return existingGrade[0].grade_id;
            } else {
                // Insert new grade
                const [result] = await db.query(
                    `INSERT INTO grades
                    (student_id, assignment_id, points_earned, graded_by, comments)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        gradeData.student_id,
                        gradeData.assignment_id,
                        gradeData.points_earned,
                        gradeData.graded_by,
                        gradeData.comments || null
                    ]
                );
                
                return result.insertId;
            }
        } catch (error) {
            console.error('Error recording grade:', error);
            throw error;
        }
    }

    // Record final grade for a student in a course
    static async recordFinalGrade(courseId, studentId, finalGrade, instructorId) {
        try {
            // Check if instructor is assigned to this course
            const [instructorCheck] = await db.query(
                'SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [courseId, instructorId]
            );
            
            if (instructorCheck.length === 0) {
                throw new Error('Instructor is not assigned to this course');
            }
            
            // Update final grade
            const [result] = await db.query(
                'UPDATE enrollments SET final_grade = ? WHERE course_id = ? AND student_id = ?',
                [finalGrade, courseId, studentId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error recording final grade:', error);
            throw error;
        }
    }

    // Record student attendance
    static async recordAttendance(attendanceData) {
        try {
            // Check if instructor is assigned to this course
            const [instructorCheck] = await db.query(
                'SELECT * FROM course_instructors WHERE course_id = ? AND instructor_id = ?',
                [attendanceData.course_id, attendanceData.recorded_by]
            );
            
            if (instructorCheck.length === 0) {
                throw new Error('Instructor is not assigned to this course');
            }
            
            // Check if attendance record already exists
            const [existingRecord] = await db.query(
                'SELECT * FROM attendance WHERE course_id = ? AND student_id = ? AND class_date = ?',
                [attendanceData.course_id, attendanceData.student_id, attendanceData.class_date]
            );
            
            if (existingRecord.length > 0) {
                // Update existing record
                const [result] = await db.query(
                    `UPDATE attendance SET
                    status = ?,
                    recorded_by = ?
                    WHERE attendance_id = ?`,
                    [
                        attendanceData.status,
                        attendanceData.recorded_by,
                        existingRecord[0].attendance_id
                    ]
                );
                
                return existingRecord[0].attendance_id;
            } else {
                // Insert new record
                const [result] = await db.query(
                    `INSERT INTO attendance
                    (course_id, student_id, class_date, status, recorded_by)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        attendanceData.course_id,
                        attendanceData.student_id,
                        attendanceData.class_date,
                        attendanceData.status,
                        attendanceData.recorded_by
                    ]
                );
                
                return result.insertId;
            }
        } catch (error) {
            console.error('Error recording attendance:', error);
            throw error;
        }
    }
}

module.exports = Instructor;