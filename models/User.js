const db = require('../db');
const bcrypt = require('bcrypt');

class User {
    // Find user by ID
    static async findById(id) {
        try {
            const [rows] = await db.query(
                `SELECT users.*, roles.role_name as role 
                FROM users 
                JOIN roles ON users.role_id = roles.role_id 
                WHERE users.user_id = ?`,
                [id]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    // Find user by username
    static async findByUsername(username) {
        try {
            const [rows] = await db.query(
                `SELECT users.*, roles.role_name as role 
                FROM users 
                JOIN roles ON users.role_id = roles.role_id 
                WHERE users.username = ?`,
                [username]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by username:', error);
            throw error;
        }
    }

    // Find user by email
    static async findByEmail(email) {
        try {
            const [rows] = await db.query(
                `SELECT users.*, roles.role_name as role 
                FROM users 
                JOIN roles ON users.role_id = roles.role_id 
                WHERE users.email = ?`,
                [email]
            );
            return rows.length ? rows[0] : null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    // Create a new user
    static async create(userData) {
        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            // Get role ID
            const [roleRows] = await db.query(
                'SELECT role_id FROM roles WHERE role_name = ?',
                [userData.role]
            );
            
            if (!roleRows.length) {
                throw new Error(`Role '${userData.role}' not found`);
            }
            
            const roleId = roleRows[0].role_id;
            
            // Insert user
            const [result] = await db.query(
                `INSERT INTO users 
                (username, password, email, first_name, last_name, role_id) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userData.username,
                    hashedPassword,
                    userData.email,
                    userData.first_name,
                    userData.last_name,
                    roleId
                ]
            );
            
            return result.insertId;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    // Update user profile
    static async update(id, userData) {
        try {
            // Update user data
            const [result] = await db.query(
                `UPDATE users SET 
                first_name = ?, 
                last_name = ?, 
                email = ?,
                is_active = ?
                WHERE user_id = ?`,
                [
                    userData.first_name,
                    userData.last_name,
                    userData.email,
                    userData.is_active !== undefined ? userData.is_active : 1,
                    id
                ]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    // Update user password
    static async updatePassword(id, newPassword) {
        try {
            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Update password
            const [result] = await db.query(
                'UPDATE users SET password = ? WHERE user_id = ?',
                [hashedPassword, id]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating password:', error);
            throw error;
        }
    }

    // Delete user
    static async delete(id) {
        try {
            const [result] = await db.query(
                'DELETE FROM users WHERE user_id = ?',
                [id]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }

    // Get all users by role
    static async findByRole(role) {
        try {
            const [rows] = await db.query(
                `SELECT users.*, roles.role_name as role 
                FROM users 
                JOIN roles ON users.role_id = roles.role_id 
                WHERE roles.role_name = ?`,
                [role]
            );
            return rows;
        } catch (error) {
            console.error(`Error finding users with role '${role}':`, error);
            throw error;
        }
    }

    // Get all users
    static async findAll() {
        try {
            const [rows] = await db.query(
                `SELECT users.*, roles.role_name as role 
                FROM users 
                JOIN roles ON users.role_id = roles.role_id`
            );
            return rows;
        } catch (error) {
            console.error('Error finding all users:', error);
            throw error;
        }
    }

    // Verify password
    static async verifyPassword(user, password) {
        try {
            return await bcrypt.compare(password, user.password);
        } catch (error) {
            console.error('Error verifying password:', error);
            throw error;
        }
    }
}

module.exports = User; 