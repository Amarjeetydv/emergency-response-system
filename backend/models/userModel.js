const db = require('../config/db');

const User = {
  findByEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },

  findById: async (id) => {
    const [rows] = await db.query(
      'SELECT id, name, email, role, phone, approval_status FROM users WHERE id = ?',
      [id]
    );
    return rows[0];
  },

  create: async (userData) => {
    const { name, email, password, role, phone, approval_status } = userData;
    // Add approval_status if present
    let query = 'INSERT INTO users (name, email, password, role, phone';
    let values = [name, email, password, role, phone || null];
    if (approval_status !== undefined && approval_status !== null) {
      query += ', approval_status';
      values.push(approval_status);
    }
    query += ') VALUES (?, ?, ?, ?, ?' + (approval_status !== undefined && approval_status !== null ? ', ?' : '') + ')';
    const [result] = await db.execute(query, values);
    return result.insertId;
  },

  // Get all users
  getAll: async () => {
    const [rows] = await db.query('SELECT id, name, email, role, phone, approval_status FROM users');
    return rows;
  },

  // Set approval status for responder
  setApprovalStatus: async (id, status) => {
    await db.execute('UPDATE users SET approval_status = ? WHERE id = ?', [status, id]);
  },

  updateRole: async (id, role) => {
    const [result] = await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    return result.affectedRows;
  }
};

module.exports = User;
