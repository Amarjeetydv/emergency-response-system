const db = require('../config/db');

const Log = {
  create: async (emergencyId, status, updatedBy) => {
    const sql = 'INSERT INTO logs (emergency_id, status, updated_by) VALUES (?, ?, ?)';
    const [result] = await db.execute(sql, [emergencyId, status, updatedBy]);
    return result.insertId;
  },

  findByEmergencyId: async (emergencyId) => {
    const sql = 'SELECT l.*, u.name as updater_name FROM logs l JOIN users u ON l.updated_by = u.id WHERE l.emergency_id = ? ORDER BY l.timestamp DESC';
    const [rows] = await db.execute(sql, [emergencyId]);
    return rows;
  }
};

module.exports = Log;
