const db = require("../db");

class Student {
  // Find student profile by user ID
  static async findByUserId(userId) {
    try {
      const [rows] = await db.query(
        `SELECT sp.*, u.first_name, u.last_name, u.email, u.username
                FROM student_profiles sp
                JOIN users u ON sp.user_id = u.user_id
                WHERE sp.user_id = ?`,
        [userId],
      );
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error("Error finding student profile:", error);
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
          profileData.current_semester || 1,
        ],
      );
      return result.insertId;
    } catch (error) {
      console.error("Error creating student profile:", error);
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
          userId,
        ],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating student profile:", error);
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
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("Error getting enrolled courses:", error);
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
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("Error getting student grades:", error);
      throw error;
    }
  }

  // Calculate GPA for a student
  static async calculateGPA(userId) {
    try {
      // Get completed courses with final grades
      const [completedCourses] = await db.query(
        `SELECT c.credit_hours, e.final_grade
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                WHERE e.student_id = ? AND e.final_grade IS NOT NULL`,
        [userId],
      );

      // Get current courses with grades
      const [currentCourses] = await db.query(
        `SELECT c.credit_hours, g.total_score
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                JOIN grades g ON e.course_id = g.course_id AND e.student_id = g.student_id
                WHERE e.student_id = ? AND e.final_grade IS NULL AND g.status = 'posted'`,
        [userId],
      );

      const gradePoints = {
        "A+": 4.0,
        A: 4.0,
        "A-": 3.7,
        "B+": 3.3,
        B: 3.0,
        "B-": 2.7,
        "C+": 2.3,
        C: 2.0,
        "C-": 1.7,
        "D+": 1.3,
        D: 1.0,
        "D-": 0.7,
        F: 0.0,
      };

      let totalPoints = 0;
      let totalCredits = 0;

      // Process completed courses
      for (const row of completedCourses) {
        const points = gradePoints[row.final_grade] || 0;
        totalPoints += points * row.credit_hours;
        totalCredits += row.credit_hours;
      }

      // Process current courses
      for (const row of currentCourses) {
        const points = calculateGradePoints(row.total_score);
        totalPoints += points * row.credit_hours;
        totalCredits += row.credit_hours;
      }

      return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 0.0;
    } catch (error) {
      console.error("Error calculating GPA:", error);
      throw error;
    }
  }

  // Helper function to calculate grade points from numeric score
  static calculateGradePoints(score) {
    if (!score) return 0;
    if (score >= 90) return 4.0;
    if (score >= 87) return 3.7;
    if (score >= 84) return 3.3;
    if (score >= 80) return 3.0;
    if (score >= 77) return 2.7;
    if (score >= 74) return 2.3;
    if (score >= 70) return 2.0;
    if (score >= 67) return 1.7;
    if (score >= 64) return 1.3;
    if (score >= 60) return 1.0;
    return 0.0;
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
        query += " AND a.course_id = ?";
        params.push(courseId);
      }

      query += " ORDER BY a.class_date DESC";

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error("Error getting attendance records:", error);
      throw error;
    }
  }
}

module.exports = Student;
