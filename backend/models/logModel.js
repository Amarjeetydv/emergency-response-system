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
  },

  findAllRecent: async (limit = 500) => {
    const lim = Math.min(Math.max(parseInt(String(limit), 10) || 500, 1), 1000);
    const sql = `
      SELECT l.*, u.name as updater_name, e.emergency_type, e.status as emergency_status
      FROM logs l
      JOIN users u ON l.updated_by = u.id
      JOIN emergencies e ON l.emergency_id = e.id
      ORDER BY l.timestamp DESC
      LIMIT ${lim}
    `;
    const [rows] = await db.execute(sql);
    return rows;
  }
};

module.exports = Log;
