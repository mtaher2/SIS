const db = require('../db');

class Message {
    // Find message by ID
    static async findById(id) {
        try {
            const [rows] = await db.query(
                `SELECT m.*,
                    CONCAT(s.first_name, ' ', s.last_name) AS sender_name,
                    CONCAT(r.first_name, ' ', r.last_name) AS receiver_name,
                    s.email AS sender_email,
                    r.email AS receiver_email
                FROM messages m
                JOIN users s ON m.sender_id = s.user_id
                JOIN users r ON m.receiver_id = r.user_id
                WHERE m.message_id = ?`,
                [id]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding message by ID:', error);
            throw error;
        }
    }

    // Create a new message
    static async create(messageData) {
        try {
            const [result] = await db.query(
                `INSERT INTO messages 
                (sender_id, receiver_id, subject, content)
                VALUES (?, ?, ?, ?)`,
                [
                    messageData.sender_id,
                    messageData.receiver_id,
                    messageData.subject,
                    messageData.content
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error creating message:', error);
            throw error;
        }
    }

    // Mark message as read
    static async markAsRead(id) {
        try {
            const [result] = await db.query(
                'UPDATE messages SET is_read = true WHERE message_id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error marking message as read:', error);
            throw error;
        }
    }

    // Delete message
    static async delete(id, userId) {
        try {
            // Make sure user is either sender or receiver
            const [message] = await db.query(
                'SELECT * FROM messages WHERE message_id = ?',
                [id]
            );
            
            if (message.length === 0) {
                throw new Error('Message not found');
            }
            
            if (message[0].sender_id !== userId && message[0].receiver_id !== userId) {
                throw new Error('Unauthorized to delete this message');
            }
            
            const [result] = await db.query(
                'DELETE FROM messages WHERE message_id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    }

    // Get all messages for a user (inbox or sent)
    static async getMessages(userId, type = 'inbox') {
        try {
            let query;
            
            if (type === 'inbox') {
                query = `
                    SELECT m.*,
                        CONCAT(s.first_name, ' ', s.last_name) AS sender_name,
                        s.email AS sender_email
                    FROM messages m
                    JOIN users s ON m.sender_id = s.user_id
                    WHERE m.receiver_id = ?
                    ORDER BY m.sent_at DESC
                `;
            } else if (type === 'sent') {
                query = `
                    SELECT m.*,
                        CONCAT(r.first_name, ' ', r.last_name) AS receiver_name,
                        r.email AS receiver_email
                    FROM messages m
                    JOIN users r ON m.receiver_id = r.user_id
                    WHERE m.sender_id = ?
                    ORDER BY m.sent_at DESC
                `;
            } else {
                throw new Error('Invalid message type specified');
            }
            
            const [rows] = await db.query(query, [userId]);
            return rows;
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }

    // Get conversation between two users
    static async getConversation(user1Id, user2Id) {
        try {
            const [rows] = await db.query(
                `SELECT m.*,
                    CONCAT(s.first_name, ' ', s.last_name) AS sender_name,
                    CONCAT(r.first_name, ' ', r.last_name) AS receiver_name
                FROM messages m
                JOIN users s ON m.sender_id = s.user_id
                JOIN users r ON m.receiver_id = r.user_id
                WHERE (m.sender_id = ? AND m.receiver_id = ?)
                   OR (m.sender_id = ? AND m.receiver_id = ?)
                ORDER BY m.sent_at ASC`,
                [user1Id, user2Id, user2Id, user1Id]
            );
            return rows;
        } catch (error) {
            console.error('Error getting conversation:', error);
            throw error;
        }
    }

    // Get unread message count
    static async getUnreadCount(userId) {
        try {
            const [rows] = await db.query(
                'SELECT COUNT(*) AS unread_count FROM messages WHERE receiver_id = ? AND is_read = false',
                [userId]
            );
            return rows[0].unread_count;
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }
}

module.exports = Message; 