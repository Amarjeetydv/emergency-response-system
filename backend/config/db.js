const mysql = require('mysql2/promise');
require('dotenv').config();


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_CA ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA.replace(/\\n/g, '\n')
  } : undefined
});

pool.getConnection()
  .then(connection => {
    console.log(`✅ Connected to MySQL database at ${process.env.DB_HOST}`);
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the MySQL database:', err.stack);
  });

module.exports = pool;
