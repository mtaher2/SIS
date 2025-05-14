const mysql = require('mysql2');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Create a connection pool with enhanced configuration
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,  // 30 seconds
    connectTimeout: 60000, // 60 seconds
    acquireTimeout: 60000, // 60 seconds
    timeout: 60000 // 60 seconds general timeout
});

// Get a promise-based wrapper for the pool
const promisePool = pool.promise();

// Improved connection handling with retry mechanism
const getConnection = async (retries = 3) => {
    try {
        await promisePool.query('SELECT 1');
        return promisePool;
    } catch (error) {
        console.error('Database connection error:', error.message);
        
        if (retries > 0) {
            console.log(`Retrying connection... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return getConnection(retries - 1);
        } else {
            console.error('Max connection retries reached. Could not connect to database.');
            throw error;
        }
    }
};

// Test connection with retry
const testConnection = async () => {
    try {
        await getConnection();
        console.log('Connected to MySQL database successfully');
    } catch (err) {
        console.error('Failed to connect to MySQL database:', err);
        process.exit(1);
    }
};

// Run the connection test
testConnection();

// Export both the promise pool and the improved connection handler
module.exports = promisePool;
module.exports.getConnection = getConnection; 