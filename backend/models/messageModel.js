const db = require('../config/db');

const Message = {
  create: async (emergencyId, senderId, message) => {
    const sql = 'INSERT INTO messages (emergency_id, sender_id, message) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [emergencyId, senderId, message]);
    return result.insertId;
  },

  findByEmergencyId: async (emergencyId) => {
    const sql = `
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.emergency_id = ? ORDER BY m.timestamp ASC`;
    const [rows] = await db.execute(sql, [emergencyId]);
    return rows;
  }
};

module.exports = Message;
