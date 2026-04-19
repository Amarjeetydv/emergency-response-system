const db = require('../config/db');

const Emergency = {
  create: async (citizenId, emergencyType, latitude, longitude, description, mediaUrl) => {
    const sql = `
      INSERT INTO emergencies 
      (citizen_id, emergency_type, latitude, longitude, status, description, media_url, assigned_responder) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;
    
    const params = [citizenId, emergencyType, latitude, longitude, 'pending', description || null, mediaUrl || null, null];
    
    const [rows] = await db.execute(sql, params);
    return rows[0].id;
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

  findNearby: async (lat, lng, radiusKm) => {
    const sql = `
      SELECT e.*, u.name as citizen_name, r.name as responder_name,
      (6371 * acos(cos(radians(?)) * cos(radians(e.latitude)) * cos(radians(e.longitude) - radians(?)) + sin(radians(?)) * sin(radians(e.latitude)))) AS distance
      FROM emergencies e
      JOIN users u ON e.citizen_id = u.id
      LEFT JOIN users r ON e.assigned_responder = r.id
      WHERE (6371 * acos(cos(radians(?)) * cos(radians(e.latitude)) * cos(radians(e.longitude) - radians(?)) + sin(radians(?)) * sin(radians(e.latitude)))) <= ?
      ORDER BY distance ASC
    `;
    // PostgreSQL doesn't support HAVING for calculated columns in this context easily, so we repeat the formula in WHERE
    const [rows] = await db.execute(sql, [lat, lng, lat, lat, lng, lat, radiusKm]);
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
  },

  claim: async (id, responderId, lat, lng) => {
    const sql = `
      UPDATE emergencies 
      SET status = 'accepted', 
          assigned_responder = ?, 
          responder_lat = ?, 
          responder_lng = ? 
      WHERE id = ? AND status IN ('pending', 'escalated')
    `;
    const [result] = await db.execute(sql, [responderId, lat, lng, id]);
    return result.affectedRows;
  },

  escalate: async (id) => {
    const sql = `
      UPDATE emergencies 
      SET status = 'escalated' 
      WHERE id = ? AND status = 'pending'
    `;
    const [result] = await db.execute(sql, [id]);
    return result.affectedRows;
  },

  findStalePending: async (thresholdMinutes = 5) => {
    const sql = `
      SELECT id FROM emergencies 
      WHERE status = 'pending' 
      AND created_at < (NOW() - INTERVAL ? MINUTE)
    `;
    const [rows] = await db.execute(sql, [thresholdMinutes]);
    return rows;
  }
};

module.exports = Emergency;
