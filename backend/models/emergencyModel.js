const db = require('../config/db');

const Emergency = {
  create: async (citizenId, emergencyType, latitude, longitude) => {
    // 3. Update query to include status and assigned_responder
    const sql = `
      INSERT INTO emergencies 
      (citizen_id, emergency_type, latitude, longitude, status, assigned_responder) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    // 4. Set defaults: status is 'pending', assigned_responder is null
    // We use || null to ensure no 'undefined' values reach the database
    const params = [citizenId, emergencyType, latitude, longitude, 'pending', null];
    
    const [result] = await db.execute(sql, params);
    return result.insertId;
  },

  findAll: async () => {
    const sql = `
      SELECT e.*, u.name as citizen_name 
      FROM emergencies e 
      JOIN users u ON e.citizen_id = u.id 
      ORDER BY e.created_at DESC
    `;
    const [rows] = await db.execute(sql);
    return rows;
  },

  findById: async (id) => {
    const sql = 'SELECT * FROM emergencies WHERE id = ?';
    const [rows] = await db.execute(sql, [id]);
    return rows[0];
  },

  update: async (id, status, responderId) => {
    let sql = 'UPDATE emergencies SET';
    const params = [];
    const updates = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (responderId) {
      updates.push('assigned_responder = ?');
      params.push(responderId);
    }

    if (updates.length === 0) {
      return 0; // No updates to perform
    }

    sql += ' ' + updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    const [result] = await db.execute(sql, params);
    return result.affectedRows;
  }
};

module.exports = Emergency;
