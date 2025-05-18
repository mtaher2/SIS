const db = require('../db');
const spamDetector = require('../utils/spamDetector');

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
            
            if (!rows.length) return null;
            
            // If announcement is targeting specific users, get the recipients
            const announcement = rows[0];
            if (announcement.target_type === 'specific_users') {
                const [recipients] = await db.query(
                    `SELECT ar.user_id, CONCAT(u.first_name, ' ', u.last_name) AS full_name, 
                     r.role_name
                     FROM announcement_recipients ar
                     JOIN users u ON ar.user_id = u.user_id
                     JOIN roles r ON u.role_id = r.role_id
                     WHERE ar.announcement_id = ?`,
                    [id]
                );
                announcement.recipients = recipients;
            }
            
            return announcement;
        } catch (error) {
            console.error('Error finding announcement by ID:', error);
            throw error;
        }
    }

    // Create a new announcement
    static async create(announcementData) {
        try {
            // Start transaction
            await db.query('START TRANSACTION');
            
            // Classify the announcement content
            const spamClassification = await spamDetector.classifyMessage(announcementData.content);
            
            // Create the announcement
            const [result] = await db.query(
                `INSERT INTO announcements 
                (title, content, created_by, target_type, course_id, is_active, is_spam, spam_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    announcementData.title,
                    announcementData.content,
                    announcementData.created_by,
                    announcementData.target_type,
                    announcementData.course_id || null,
                    announcementData.is_active !== undefined ? announcementData.is_active : true,
                    spamClassification.isSpam,
                    spamClassification.confidence
                ]
            );
            
            const announcementId = result.insertId;
            
            // If targeting specific users, add them to the recipients table
            if (announcementData.target_type === 'specific_users' && Array.isArray(announcementData.recipients) && announcementData.recipients.length > 0) {
                const values = announcementData.recipients.map(userId => [announcementId, userId]);
                await db.query(
                    `INSERT INTO announcement_recipients (announcement_id, user_id) VALUES ?`,
                    [values]
                );
            }
            
            // Commit transaction
            await db.query('COMMIT');
            
            return announcementId;
        } catch (error) {
            // Rollback on error
            await db.query('ROLLBACK');
            console.error('Error creating announcement:', error);
            throw error;
        }
    }

    // Update announcement
    static async update(id, announcementData) {
        try {
            // Start transaction
            await db.query('START TRANSACTION');
            
            // Re-classify the content on update
            const spamClassification = await spamDetector.classifyMessage(announcementData.content);
            
            const [result] = await db.query(
                `UPDATE announcements SET
                title = ?,
                content = ?,
                target_type = ?,
                course_id = ?,
                is_active = ?,
                is_spam = ?,
                spam_confidence = ?
                WHERE announcement_id = ?`,
                [
                    announcementData.title,
                    announcementData.content,
                    announcementData.target_type,
                    announcementData.course_id || null,
                    announcementData.is_active !== undefined ? announcementData.is_active : true,
                    spamClassification.isSpam,
                    spamClassification.confidence,
                    id
                ]
            );
            
            // If targeting specific users, update the recipients
            if (announcementData.target_type === 'specific_users' && Array.isArray(announcementData.recipients)) {
                // First delete existing recipients
                await db.query('DELETE FROM announcement_recipients WHERE announcement_id = ?', [id]);
                
                // Then add the new ones
                if (announcementData.recipients.length > 0) {
                    const values = announcementData.recipients.map(userId => [id, userId]);
                    await db.query(
                        `INSERT INTO announcement_recipients (announcement_id, user_id) VALUES ?`,
                        [values]
                    );
                }
            }
            
            // Commit transaction
            await db.query('COMMIT');
            
            return result.affectedRows > 0;
        } catch (error) {
            // Rollback on error
            await db.query('ROLLBACK');
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
            
            if (filters.is_spam !== undefined) {
                conditions.push('a.is_spam = ?');
                params.push(filters.is_spam);
            }
            
            // Apply search filter to title and content
            if (filters.search) {
                conditions.push('(a.title LIKE ? OR a.content LIKE ?)');
                params.push(`%${filters.search}%`);
                params.push(`%${filters.search}%`);
            }
            
            // Filter by creation date
            if (filters.created_after) {
                conditions.push('a.created_at > ?');
                params.push(filters.created_after);
            }
            
            // Filter for specific recipient
            if (filters.recipient_id) {
                conditions.push(`(
                    a.announcement_id IN (
                        SELECT announcement_id 
                        FROM announcement_recipients 
                        WHERE user_id = ?
                    )
                )`);
                params.push(filters.recipient_id);
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            // Add sorting
            query += ' ORDER BY a.created_at DESC';
            
            // Add limit
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(parseInt(filters.limit));
            }
            
            const [rows] = await db.query(query, params);
            
            // For announcements targeting specific users, get the recipients
            const announcements = await Promise.all(rows.map(async (announcement) => {
                if (announcement.target_type === 'specific_users') {
                    const recipients = await this.getRecipients(announcement.announcement_id);
                    announcement.recipients = recipients;
                }
                return announcement;
            }));
            
            return announcements;
        } catch (error) {
            console.error('Error finding announcements:', error);
            throw error;
        }
    }

    // Get announcements visible to a specific user
    static async getVisibleAnnouncements(userId, userRole, filters = {}) {
        try {
            let query;
            let params = [];
            let conditions = ['a.is_active = true'];
            
            // Add date filter if provided
            if (filters.created_after) {
                conditions.push('a.created_at > ?');
                params.push(filters.created_after);
            }
            
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
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY a.created_at DESC
                `;
            } else if (userRole === 'instructor') {
                // Instructors see all public announcements, instructor-targeted ones, their course-specific ones,
                // and announcements where they are specifically targeted
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    LEFT JOIN announcement_recipients ar ON a.announcement_id = ar.announcement_id AND ar.user_id = ?
                    WHERE ${conditions.join(' AND ')}
                    AND (
                        a.target_type = 'all'
                        OR a.target_type = 'instructors'
                        OR (a.target_type = 'course' AND a.course_id IN (
                            SELECT course_id FROM course_instructors WHERE instructor_id = ?
                        ))
                        OR (a.target_type = 'specific_users' AND ar.user_id IS NOT NULL)
                    )
                    ORDER BY a.created_at DESC
                `;
                params.push(userId, userId);
            } else if (userRole === 'student') {
                // Students see all public announcements, student-targeted ones, their enrolled course-specific ones,
                // and announcements where they are specifically targeted
                query = `
                    SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) AS author_name,
                        u.role_id, r.role_name,
                        c.course_code, c.title AS course_title
                    FROM announcements a
                    JOIN users u ON a.created_by = u.user_id
                    JOIN roles r ON u.role_id = r.role_id
                    LEFT JOIN courses c ON a.course_id = c.course_id
                    LEFT JOIN announcement_recipients ar ON a.announcement_id = ar.announcement_id AND ar.user_id = ?
                    WHERE ${conditions.join(' AND ')}
                    AND (
                        a.target_type = 'all'
                        OR a.target_type = 'students'
                        OR (a.target_type = 'course' AND a.course_id IN (
                            SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'
                        ))
                        OR (a.target_type = 'specific_users' AND ar.user_id IS NOT NULL)
                    )
                    ORDER BY a.created_at DESC
                `;
                params.push(userId, userId);
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
                    WHERE ${conditions.join(' AND ')} AND a.target_type = 'all'
                    ORDER BY a.created_at DESC
                `;
            }
            
            const [rows] = await db.query(query, params);
            
            // For announcements targeting specific users, get the recipients
            const announcements = await Promise.all(rows.map(async (announcement) => {
                if (announcement.target_type === 'specific_users') {
                    const recipients = await this.getRecipients(announcement.announcement_id);
                    announcement.recipients = recipients;
                }
                return announcement;
            }));
            
            return announcements;
        } catch (error) {
            console.error('Error getting visible announcements:', error);
            throw error;
        }
    }

    // Get announcement recipients
    static async getRecipients(announcementId) {
        try {
            const [rows] = await db.query(
                `SELECT ar.user_id, CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                 r.role_name, u.email
                 FROM announcement_recipients ar
                 JOIN users u ON ar.user_id = u.user_id
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE ar.announcement_id = ?`,
                [announcementId]
            );
            return rows;
        } catch (error) {
            console.error('Error getting announcement recipients:', error);
            throw error;
        }
    }
}

module.exports = Announcement; 