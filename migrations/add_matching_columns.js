const db = require('../db');

async function addMatchingColumns() {
    try {
        console.log('Starting migration: Adding matching columns to question_options table');
        
        // Check if columns already exist
        const [columns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'question_options' 
            AND COLUMN_NAME IN ('matching_id', 'side')
        `);
        
        // Add matching_id column if it doesn't exist
        if (!columns.some(col => col.COLUMN_NAME === 'matching_id')) {
            console.log('Adding matching_id column...');
            await db.query(`
                ALTER TABLE question_options
                ADD COLUMN matching_id INT DEFAULT NULL
            `);
            console.log('matching_id column added successfully');
        } else {
            console.log('matching_id column already exists');
        }
        
        // Add side column if it doesn't exist
        if (!columns.some(col => col.COLUMN_NAME === 'side')) {
            console.log('Adding side column...');
            await db.query(`
                ALTER TABLE question_options
                ADD COLUMN side VARCHAR(10) DEFAULT NULL
            `);
            console.log('side column added successfully');
        } else {
            console.log('side column already exists');
        }
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Execute the migration if this script is run directly
if (require.main === module) {
    addMatchingColumns()
        .then(() => {
            console.log('Migration executed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addMatchingColumns; 