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
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log(`✅ Connected to MySQL database at ${process.env.DB_HOST}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL Connection Failed:');
    console.error(`   Host: ${process.env.DB_HOST}`);
    console.error(`   Error: ${err.message}`);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  execute: (text, params) => pool.execute(text, params)
};
