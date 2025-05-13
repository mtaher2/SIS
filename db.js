const mysql = require('mysql2');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get a promise-based wrapper for the pool
const promisePool = pool.promise();

// Test connection
promisePool.query('SELECT 1')
    .then(() => {
        console.log('Connected to MySQL database successfully');
    })
    .catch(err => {
        console.error('Failed to connect to MySQL database:', err);
        process.exit(1);
    });

module.exports = promisePool; 