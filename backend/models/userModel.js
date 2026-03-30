const db = require('../config/db');

const User = {
  findByEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },

  findById: async (id) => {
    const [rows] = await db.query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  create: async (userData) => {
    const { name, email, password, role, phone } = userData;
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, role, phone || null]
    );
    return result.insertId;
  }
};

module.exports = User;
