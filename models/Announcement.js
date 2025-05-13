const db = require('../db');

class Announcement {
    // Find announcement by ID
    static async findById(id) {
        try {
            const [rows] = await db.query(
                `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                    u.role_id, r.role_name,
                    c.course_code, c.title AS course_title
                FROM announcements a
                JOIN users u ON a.created_by = u.user_id
                JOIN roles r ON u.role_id = r.role_id
                LEFT JOIN courses c ON a.course_id = c.course_id
                WHERE a.announcement_id = ?`,
                [id]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding announcement by ID:', error);
            throw error;
        }
    }

    // Create a new announcement
    static async create(announcementData) {
        try {
            const [result] = await db.query(
                `INSERT INTO announcements 
                (title, content, created_by, target_type, course_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    announcementData.title,
                    announcementData.content,
                    announcementData.created_by,
                    announcementData.target_type,
                    announcementData.course_id || null,
                    announcementData.is_active !== undefined ? announcementData.is_active : true
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating announcement:', error);
            throw error;
        }
    }

    // Update announcement
    static async update(id, announcementData) {
        try {
            const [result] = await db.query(
                `UPDATE announcements SET
                title = ?,
                content = ?,
                target_type = ?,
                course_id = ?,
                is_active = ?
                WHERE announcement_id = ?`,
                [
                    announcementData.title,
                    announcementData.content,
                    announcementData.target_type,
                    announcementData.course_id || null,
                    announcementData.is_active !== undefined ? announcementData.is_active : true,
                    id
                ]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating announcement:', error);
            throw error;
        }
    }

    // Delete announcement
    static async delete(id) {
        try {
            const [result] = await db.query(
                'DELETE FROM announcements WHERE announcement_id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting announcement:', error);
            throw error;
        }
    }

    // Get all announcements (with filtering options)
    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                    u.role_id, r.role_name,
                    c.course_code, c.title AS course_title
                FROM announcements a
                JOIN users u ON a.created_by = u.user_id
                JOIN roles r ON u.role_id = r.role_id
                LEFT JOIN courses c ON a.course_id = c.course_id
            `;
            
            const conditions = [];
            const params = [];
            
            // Apply filters
            if (filters.created_by) {
                conditions.push('a.created_by = ?');
                params.push(filters.created_by);
            }
            
            if (filters.target_type) {
                conditions.push('a.target_type = ?');
                params.push(filters.target_type);
            }
            
            if (filters.course_id) {
                conditions.push('a.course_id = ?');
                params.push(filters.course_id);
            }
            
            if (filters.is_active !== undefined) {
                conditions.push('a.is_active = ?');
                params.push(filters.is_active);
            }
            
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
            
            // Add ordering
            query += ' ORDER BY a.created_at DESC';
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error finding announcements:', error);
            throw error;
        }
    }

    // Get announcements visible to a specific user
    static async getVisibleAnnouncements(userId, userRole) {
        try {
            let query;
            let params;
            
            if (userRole === 'admin') {
                // Admin can see all announcements
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    WHERE a.is_active = true
                    ORDER BY a.created_at DESC
                `;
                params = [];
            } else if (userRole === 'instructor') {
                // Instructors see all public announcements, instructor-targeted ones, and their course-specific ones
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    WHERE a.is_active = true
                    AND (
                        a.target_type = 'all'
                        OR a.target_type = 'instructors'
                        OR (a.target_type = 'course' AND a.course_id IN (
                            SELECT course_id FROM course_instructors WHERE instructor_id = ?
                        ))
                    )
                    ORDER BY a.created_at DESC
                `;
                params = [userId];
            } else if (userRole === 'student') {
                // Students see all public announcements, student-targeted ones, and their enrolled course-specific ones
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    WHERE a.is_active = true
                    AND (
                        a.target_type = 'all'
                        OR a.target_type = 'students'
                        OR (a.target_type = 'course' AND a.course_id IN (
                            SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'
                        ))
                    )
                    ORDER BY a.created_at DESC
                `;
                params = [userId];
            } else {
                // For unauthenticated users or unknown roles, show only public announcements
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    WHERE a.is_active = true AND a.target_type = 'all'
                    ORDER BY a.created_at DESC
                `;
                params = [];
            }
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            console.error('Error getting visible announcements:', error);
            throw error;
        }
    }
}

module.exports = Announcement; 