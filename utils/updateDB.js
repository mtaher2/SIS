const db = require('../db');

async function updateAnnouncementsTable() {
    try {
        console.log('Starting database migration for spam detection fields...');
        
        // Check if columns already exist
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'announcements' 
            AND TABLE_SCHEMA = DATABASE()
            AND COLUMN_NAME IN ('is_spam', 'spam_confidence')
        `);
        
        // Add columns if they don't exist
        if (columns.length < 2) {
            console.log('Adding new columns to announcements table...');
            
            // Add is_spam column
            if (!columns.some(col => col.COLUMN_NAME === 'is_spam')) {
                await db.query(`
                    ALTER TABLE announcements 
                    ADD COLUMN is_spam BOOLEAN DEFAULT FALSE
                `);
                console.log('Added is_spam column');
            }
            
            // Add spam_confidence column
            if (!columns.some(col => col.COLUMN_NAME === 'spam_confidence')) {
                await db.query(`
                    ALTER TABLE announcements 
                    ADD COLUMN spam_confidence DECIMAL(5,4) DEFAULT 0
                `);
                console.log('Added spam_confidence column');
            }
            
            console.log('Database migration completed successfully');
        } else {
            console.log('Spam detection columns already exist. No changes needed.');
        }
    } catch (error) {
        console.error('Error updating database schema:', error);
        throw error;
    }
}

module.exports = { updateAnnouncementsTable }; 