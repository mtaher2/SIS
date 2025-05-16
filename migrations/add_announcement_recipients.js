const db = require('../db');

async function createAnnouncementRecipientsTable() {
    try {
        console.log('Starting migration: Creating announcement_recipients table...');

        // Check if the table already exists
        const [tables] = await db.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'announcement_recipients'
        `);

        if (tables.length === 0) {
            // Create the announcement_recipients table
            await db.query(`
                CREATE TABLE announcement_recipients (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    announcement_id INT NOT NULL,
                    user_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    UNIQUE KEY unique_recipient (announcement_id, user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            // Add a new target type to the announcements table if it doesn't exist yet
            // First, check if the target_type column allows 'specific_users'
            const [columns] = await db.query(`
                SHOW COLUMNS FROM announcements WHERE Field = 'target_type'
            `);
            
            console.log('Adding specific_users to target_type ENUM if needed...');
            
            // Get the current enum values
            const enumValues = columns[0].Type;
            
            // Check if 'specific_users' is already in the enum list
            if (!enumValues.includes('specific_users')) {
                // Get the enum values without the enum() wrapper
                const valuesList = enumValues
                    .substring(5, enumValues.length - 1)
                    .split(',')
                    .map(value => value.trim());
                
                // Add the new value
                valuesList.push("'specific_users'");
                
                // Create the new enum
                const newEnum = `enum(${valuesList.join(',')})`;
                
                // Alter the table
                await db.query(`
                    ALTER TABLE announcements
                    MODIFY COLUMN target_type ${newEnum} NOT NULL
                `);
            }
            
            console.log('Migration completed successfully');
            return true;
        } else {
            console.log('Table announcement_recipients already exists. Skipping migration.');
            return false;
        }
    } catch (error) {
        console.error('Error creating announcement_recipients table:', error);
        throw error;
    }
}

module.exports = createAnnouncementRecipientsTable; 