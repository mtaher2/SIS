const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Create a connection pool with enhanced configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sis',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test the connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
    } catch (error) {
        console.error('Database connection failed:', error);
        // Retry connection after 5 seconds
        setTimeout(testConnection, 5000);
    }
}

// Handle connection errors
pool.on('error', (err) => {
    console.error('Database pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
        console.log('Attempting to reconnect to database...');
        testConnection();
    }
});

// Initial connection test
testConnection();

// Export the connection pool
module.exports = pool; 
