const db = require('../config/db');
const Emergency = require('../models/emergencyModel');
const Log = require('../models/logModel');

let ImageKit;
try {
  ImageKit = require('imagekit');
} catch (e) {
  console.warn('ImageKit module not found. Image uploads will be disabled.');
}

// Initialize ImageKit
let imagekit = null;
if (ImageKit && process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function canActAsResponder(user) {
  if (!user) return false;
  if (['responder', 'dispatcher'].includes(user.role)) return true;
  if (['police', 'fire', 'ambulance'].includes(user.role)) {
    return user.approval_status === 'approved';
  }
  return false;
}

function canViewEmergencyFeed(user) {
  return user.role === 'admin' || canActAsResponder(user);
}

function validateTransition(current, next, { isAdmin, userId, row }) {
  if (isAdmin) return { ok: true };

  // Terminal states cannot be changed
  if (['completed', 'cancelled'].includes(current)) {
    return { ok: false, message: 'Emergency is already closed' };
  }

  // Flow: pending -> accepted
  if (current === 'pending' && next === 'accepted') return { ok: true };
  
  // Flow: pending -> escalated (System timeout)
  if (current === 'pending' && next === 'escalated') return { ok: true };
  if (current === 'escalated' && next === 'accepted') return { ok: true };

  // Flow: accepted -> in_progress
  if (current === 'accepted' && next === 'in_progress') {
    if (row.assigned_responder === userId) return { ok: true };
    return { ok: false, message: 'Only the assigned responder can move this to in progress' };
  }

  // Flow: in_progress -> completed
  if (current === 'in_progress' && next === 'completed') {
    if (row.assigned_responder === userId) return { ok: true };
    return { ok: false, message: 'Only the assigned responder can complete this' };
  }

  return { ok: false, message: `Invalid status transition from ${current} to ${next}` };
}

const emergencyService = {
  createEmergency: async (citizenId, type, lat, lng, description, file, io) => {
    let media_url = null;
    if (file && imagekit) {
      try {
        const uploadResponse = await imagekit.upload({
          file: file.buffer,
          fileName: `emergency-${Date.now()}-${file.originalname}`,
          folder: '/emergencies'
        });
        media_url = uploadResponse.url;
      } catch (err) {
        console.error('ImageKit Service Upload Error:', err.message);
      }
    }

    const insertId = await Emergency.create(
      citizenId,
      type,
      lat,
      lng,
      description || null,
      media_url
    );

    await Log.create(insertId, 'pending', citizenId);
    const payload = await Emergency.findByIdDetailed(insertId);
    
    if (io && payload) {
      io.to('admin').to('responders').emit('newEmergency', payload);
    }

    return payload;
  },

  acceptEmergency: async (requestId, responderId, lat, lng, io) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Check atomic claim
      const sqlClaim = `
        UPDATE emergencies 
        SET status = 'accepted', 
            assigned_responder = ?, 
            responder_lat = ?, 
            responder_lng = ? 
        WHERE id = ? AND status IN ('pending', 'escalated')
      `;
      const [result] = await connection.execute(sqlClaim, [responderId, lat ?? null, lng ?? null, requestId]);
      
      if (result.affectedRows === 0) {
        const err = new Error('Request already taken by another responder');
        err.statusCode = 409;
        throw err;
      }

      // Log the transition inside same transaction
      const sqlLog = `
        INSERT INTO logs (emergency_id, status, updated_by) 
        VALUES (?, 'accepted', ?)
      `;
      await connection.execute(sqlLog, [requestId, responderId]);

      await connection.commit();
      
      const updated = await Emergency.findByIdDetailed(requestId);
      if (io && updated) {
        io.to('admin').to('responders').to(`citizen_${updated.citizen_id}`).emit('requestAccepted', updated);
        io.to('admin').to('responders').to(`citizen_${updated.citizen_id}`).emit('emergencyUpdate', updated);
      }
      return updated;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  updateEmergencyStatus: async (emergencyId, status, user, responderLat, responderLng, io) => {
    const existing = await Emergency.findById(emergencyId);
    if (!existing) {
      const err = new Error('Emergency not found');
      err.statusCode = 404;
      throw err;
    }

    const uid = user.id;
    const isAdmin = user.role === 'admin';
    const isOwnerCitizen = user.role === 'citizen' && existing.citizen_id === uid;
    const responderOk = canActAsResponder(user);

    // 1. Citizen Cancellation Check
    if (isOwnerCitizen) {
      if (status !== 'cancelled') {
        const err = new Error('You can only cancel your own request');
        err.statusCode = 403;
        throw err;
      }
      if (!['pending', 'accepted', 'in_progress'].includes(existing.status)) {
        const err = new Error('This emergency cannot be cancelled');
        err.statusCode = 400;
        throw err;
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute("UPDATE emergencies SET status = 'cancelled', assigned_responder = NULL, responder_lat = NULL, responder_lng = NULL WHERE id = ?", [emergencyId]);
        await connection.execute("INSERT INTO logs (emergency_id, status, updated_by) VALUES (?, 'cancelled', ?)", [emergencyId, uid]);
        await connection.commit();

        const payload = await Emergency.findByIdDetailed(emergencyId);
        if (io && payload) {
          io.to('admin').to('responders').to(`citizen_${payload.citizen_id}`).emit('emergencyUpdate', payload);
        }
        return { message: 'Status updated' };
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // 2. Role validation
    if (!isAdmin && !responderOk) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    // 3. Admin Cancellation Check
    if (isAdmin && status === 'cancelled') {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute("UPDATE emergencies SET status = 'cancelled', responder_lat = NULL, responder_lng = NULL WHERE id = ?", [emergencyId]);
        await connection.execute("INSERT INTO logs (emergency_id, status, updated_by) VALUES (?, 'cancelled', ?)", [emergencyId, uid]);
        await connection.commit();

        const payload = await Emergency.findByIdDetailed(emergencyId);
        if (io && payload) {
          io.to('admin').to('responders').to(`citizen_${payload.citizen_id}`).emit('emergencyUpdate', payload);
        }
        return { message: 'Status updated' };
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // 4. Validate normal transitions
    const check = validateTransition(existing.status, status, {
      isAdmin,
      userId: uid,
      row: existing
    });
    if (!check.ok) {
      const err = new Error(check.message);
      err.statusCode = 400;
      throw err;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let assignId = existing.assigned_responder;
      if (status === 'accepted' && (existing.status === 'pending' || existing.status === 'escalated')) {
        assignId = uid;
        const sqlClaim = `
          UPDATE emergencies 
          SET status = 'accepted', 
              assigned_responder = ?, 
              responder_lat = ?, 
              responder_lng = ? 
          WHERE id = ? AND status IN ('pending', 'escalated')
        `;
        const [result] = await connection.execute(sqlClaim, [assignId, responderLat ?? null, responderLng ?? null, emergencyId]);
        if (result.affectedRows === 0) {
          const err = new Error('This request has already been accepted by another responder.');
          err.statusCode = 409;
          throw err;
        }
      } else {
        const cleanStatus = String(status).trim().toLowerCase().replace(/[^a-z_]/g, '');
        const sqlUpdate = `
          UPDATE emergencies 
          SET status = ?, 
              assigned_responder = ?, 
              responder_lat = ?, 
              responder_lng = ? 
          WHERE id = ?
        `;
        await connection.execute(sqlUpdate, [cleanStatus, assignId, responderLat ?? null, responderLng ?? null, emergencyId]);
      }

      const sqlLog = `
        INSERT INTO logs (emergency_id, status, updated_by) 
        VALUES (?, ?, ?)
      `;
      await connection.execute(sqlLog, [emergencyId, status, uid]);
      await connection.commit();

      const payload = await Emergency.findByIdDetailed(emergencyId);
      if (io && payload) {
        io.to('admin').to('responders').to(`citizen_${payload.citizen_id}`).emit('emergencyUpdate', payload);
      }
      return { message: 'Status updated' };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
};

module.exports = {
  emergencyService,
  canViewEmergencyFeed,
  calculateDistance
};
