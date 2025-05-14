/**
 * Migration to add profile_image column to users table
 * 
 * This migration adds a profile_image column to the users table
 * to store the path to the user's profile image.
 */

const db = require('../db');

async function migrateTables() {
    try {
        console.log('Starting migration to add profile_image column to users table...');
        
        // Check if column already exists
        const [columns] = await db.query('SHOW COLUMNS FROM users LIKE ?', ['profile_image']);
        
        if (columns.length === 0) {
            console.log('Column does not exist, adding profile_image column...');
            // Add the profile_image column if it doesn't exist
            await db.query(`
                ALTER TABLE users
                ADD COLUMN profile_image VARCHAR(255) DEFAULT NULL
            `);
            console.log('Migration successful: Added profile_image column to users table');
        } else {
            console.log('Column already exists, no changes needed');
        }
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// Run the migration
migrateTables().then(() => {
    console.log('Migration script completed');
    process.exit(0);
}).catch(err => {
    console.error('Error running migration script:', err);
    process.exit(1);
}); 