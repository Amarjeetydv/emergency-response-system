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
      SELECT e.*, u.name as citizen_name, r.name as responder_name
      FROM emergencies e
      JOIN users u ON e.citizen_id = u.id
      LEFT JOIN users r ON e.assigned_responder = r.id
      ORDER BY e.created_at DESC
    `;
    const [rows] = await db.execute(sql);
    return rows;
  },

  findByCitizenId: async (citizenId) => {
    const sql = `
      SELECT e.*, u.name as citizen_name, r.name as responder_name
      FROM emergencies e
      JOIN users u ON e.citizen_id = u.id
      LEFT JOIN users r ON e.assigned_responder = r.id
      WHERE e.citizen_id = ?
      ORDER BY e.created_at DESC
    `;
    const [rows] = await db.execute(sql, [citizenId]);
    return rows;
  },

  findById: async (id) => {
    const sql = 'SELECT * FROM emergencies WHERE id = ?';
    const [rows] = await db.execute(sql, [id]);
    return rows[0];
  },

  findByIdDetailed: async (id) => {
    const sql = `
      SELECT e.*, u.name as citizen_name, r.name as responder_name
      FROM emergencies e
      JOIN users u ON e.citizen_id = u.id
      LEFT JOIN users r ON e.assigned_responder = r.id
      WHERE e.id = ?
    `;
    const [rows] = await db.execute(sql, [id]);
    return rows[0];
  },

  update: async (status, responderId, responderLat, responderLng, id) => {
    const sql = `
      UPDATE emergencies 
      SET status = ?, 
          assigned_responder = ?, 
          responder_lat = ?, 
          responder_lng = ? 
      WHERE id = ?
    `;
    // Sanitize parameters: Ensure status is a lowercase string and coordinates are numbers or null
    const params = [String(status).trim().toLowerCase().replace(/[^a-z_]/g, ''), responderId, responderLat ?? null, responderLng ?? null, id];
    const [result] = await db.execute(sql, params);
    return result.affectedRows;
  }
};

module.exports = Emergency;
