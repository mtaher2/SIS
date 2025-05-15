const db = require('../db');

class Page {
    // Find page by ID
    static async findById(pageId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM pages WHERE page_id = ?',
                [pageId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding page by ID:', error);
            throw error;
        }
    }

    // Get all pages for a module
    static async findByModule(moduleId) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM pages WHERE module_id = ? ORDER BY created_at',
                [moduleId]
            );
            return rows;
        } catch (error) {
            console.error('Error finding pages by module:', error);
            throw error;
        }
    }

    // Create a new page
    static async create(pageData) {
        try {
            const [result] = await db.query(
                `INSERT INTO pages 
                (module_id, title, content, published, created_by) 
                VALUES (?, ?, ?, ?, ?)`,
                [
                    pageData.module_id,
                    pageData.title,
                    pageData.content || null,
                    pageData.published || false,
                    pageData.created_by
                ]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error creating page:', error);
            throw error;
        }
    }

    // Update page
    static async update(pageId, pageData) {
        try {
            const [result] = await db.query(
                `UPDATE pages SET
                title = ?,
                content = ?,
                published = ?
                WHERE page_id = ?`,
                [
                    pageData.title,
                    pageData.content || null,
                    pageData.published !== undefined ? pageData.published : false,
                    pageId
                ]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating page:', error);
            throw error;
        }
    }

    // Delete page
    static async delete(pageId) {
        try {
            const [result] = await db.query(
                'DELETE FROM pages WHERE page_id = ?',
                [pageId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting page:', error);
            throw error;
        }
    }

    // Get page with creator info
    static async getWithCreator(pageId) {
        try {
            const [rows] = await db.query(
                `SELECT p.*, u.first_name, u.last_name, u.profile_image 
                FROM pages p
                JOIN users u ON p.created_by = u.user_id
                WHERE p.page_id = ?`,
                [pageId]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error getting page with creator info:', error);
            throw error;
        }
    }

    // Get all pages for a course (across all modules)
    static async findByCourse(courseId) {
        try {
            const [rows] = await db.query(
                `SELECT p.*, m.title as module_title
                FROM pages p
                JOIN modules m ON p.module_id = m.module_id
                WHERE m.course_id = ?
                ORDER BY m.position, p.created_at`,
                [courseId]
            );
            return rows;
        } catch (error) {
            console.error('Error finding pages by course:', error);
            throw error;
        }
    }

    // Toggle publish status
    static async togglePublish(pageId) {
        try {
            // Get current publish status
            const [pageResult] = await db.query(
                'SELECT published FROM pages WHERE page_id = ?',
                [pageId]
            );
            
            if (!pageResult.length) {
                throw new Error('Page not found');
            }
            
            const currentStatus = pageResult[0].published;
            
            // Toggle status
            const [result] = await db.query(
                'UPDATE pages SET published = ? WHERE page_id = ?',
                [!currentStatus, pageId]
            );
            
            return {
                success: result.affectedRows > 0,
                published: !currentStatus
            };
        } catch (error) {
            console.error('Error toggling page publish status:', error);
            throw error;
        }
    }
}

module.exports = Page; 