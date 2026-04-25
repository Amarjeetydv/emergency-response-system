
const db = require('../config/db');

const User = {

  findByEmail: async (email) => {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },


  findById: async (id) => {
    const result = await db.query(
      'SELECT id, name, email, role, phone, approval_status FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },


  create: async (userData) => {
    const { name, email, password, role, phone, approval_status } = userData;
    let query = 'INSERT INTO users (name, email, password, role, phone';
    let values = [name, email, password, role, phone || null];
    let placeholders = ['$1', '$2', '$3', '$4', '$5'];
    if (approval_status !== undefined && approval_status !== null) {
      query += ', approval_status';
      values.push(approval_status);
      placeholders.push(`$${placeholders.length + 1}`);
    }
    query += `) VALUES (${placeholders.join(', ')}) RETURNING id`;
    const result = await db.query(query, values);
    return result.rows[0].id;
  },

  // Get all users

  getAll: async () => {
    const result = await db.query('SELECT id, name, email, role, phone, approval_status FROM users');
    return result.rows;
  },

  // Set approval status for responder

  setApprovalStatus: async (id, status) => {
    await db.query('UPDATE users SET approval_status = $1 WHERE id = $2', [status, id]);
  },


  updateRole: async (id, role) => {
    const result = await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    return result.rowCount;
  },


  delete: async (id) => {
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount;
  }
};

module.exports = User;
