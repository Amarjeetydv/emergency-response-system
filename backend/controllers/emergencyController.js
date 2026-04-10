const Emergency = require('../models/emergencyModel');
const Log = require('../models/logModel');

const ALLOWED_STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

// Helper: Haversine formula to calculate distance in Kilometers
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
  if (current === 'pending' && next === 'accepted') {
    return { ok: true };
  }
  if (current === 'accepted' && next === 'in_progress') {
    if (row.assigned_responder === userId) return { ok: true };
    return { ok: false, message: 'Only the assigned responder can move this to in progress' };
  }
  if (current === 'in_progress' && next === 'completed') {
    if (row.assigned_responder === userId) return { ok: true };
    return { ok: false, message: 'Only the assigned responder can complete this' };
  }
  if (next === 'cancelled') {
    return { ok: false, message: 'Cancel is not allowed for this role via this action' };
  }
  return { ok: false, message: 'Invalid status transition' };
}

// @desc    Report a new emergency (citizen)
// @route   POST /api/emergencies
const createEmergency = async (req, res) => {
  const { emergency_type, latitude, longitude } = req.body;

  if (req.user.role !== 'citizen') {
    return res.status(403).json({ message: 'Only citizens can create emergency requests' });
  }

  if (!emergency_type || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Please provide emergency type, latitude, and longitude' });
  }

  try {
    const insertId = await Emergency.create(
      req.user.id,
      emergency_type,
      latitude,
      longitude
    );

    await Log.create(insertId, 'pending', req.user.id);

    const io = req.app.get('socketio');
    const payload = await Emergency.findByIdDetailed(insertId);
    io.emit('newEmergency', payload);

    res.status(201).json({ id: insertId, message: 'Emergency reported successfully' });
  } catch (error) {
    console.error('Create Emergency Error:', error);
    res.status(500).json({ message: 'Error reporting emergency', error: error.message });
  }
};

// @desc    List emergencies (citizen: own; admin / responders: all)
// @route   GET /api/emergencies
const getAllEmergencies = async (req, res) => {
  try {
    if (req.user.role === 'citizen') {
      const rows = await Emergency.findByCitizenId(req.user.id);
      return res.json(rows);
    }
    if (canViewEmergencyFeed(req.user)) {
      let rows = await Emergency.findAll();
      const { lat, lng } = req.query;

      // Nearest Responder Logic: Filter by distance (50km radius)
      if (lat && lng) {
        const rLat = parseFloat(lat);
        const rLng = parseFloat(lng);
        rows = rows.filter(e => calculateDistance(rLat, rLng, e.latitude, e.longitude) <= 50);
      }

      return res.json(rows);
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching emergencies' });
  }
};

// @desc    Specific handler for accepting a request with location
// @route   POST /api/emergencies/accept-request
const acceptRequest = async (req, res) => {
  const { request_id, responder_lat, responder_lng } = req.body;
  const responder_id = req.user.id;

  try {
    const existing = await Emergency.findById(request_id);
    if (!existing || existing.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer available' });
    }

    // Update database: query should handle the additional responder location fields
    await Emergency.update('accepted', responder_id, responder_lat, responder_lng, request_id);
    const updated = await Emergency.findByIdDetailed(request_id);

    const io = req.app.get('socketio');
    // Real-time: Notify everyone that the request is taken
    io.emit('requestAccepted', updated);
    io.emit('emergencyUpdate', updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id
const updateStatus = async (req, res) => {
  const { status, responder_id, responder_lat, responder_lng } = req.body;
  const emergencyId = Number(req.params.id);

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }

  try {
    const existing = await Emergency.findById(emergencyId);
    if (!existing) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    const uid = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isOwnerCitizen = req.user.role === 'citizen' && existing.citizen_id === uid;
    const responderOk = canActAsResponder(req.user);

    if (isOwnerCitizen) {
      if (status !== 'cancelled') {
        return res.status(403).json({ message: 'You can only cancel your own request' });
      }
      if (!['pending', 'accepted', 'in_progress'].includes(existing.status)) {
        return res.status(400).json({ message: 'This emergency cannot be cancelled' });
      }
      await Emergency.update('cancelled', null, null, null, emergencyId);
      await Log.create(emergencyId, 'cancelled', uid);
      const io = req.app.get('socketio');
      const payload = await Emergency.findByIdDetailed(emergencyId);
      io.emit('emergencyUpdate', payload);
      return res.json({ message: 'Status updated' });
    }

    if (!isAdmin && !responderOk) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (isAdmin && status === 'cancelled') {
      await Emergency.update('cancelled', existing.assigned_responder, null, null, emergencyId);
      await Log.create(emergencyId, 'cancelled', uid);
      const io = req.app.get('socketio');
      io.emit('emergencyUpdate', await Emergency.findByIdDetailed(emergencyId));
      return res.json({ message: 'Status updated' });
    }

    const check = validateTransition(existing.status, status, {
      isAdmin,
      userId: uid,
      row: existing
    });
    if (!check.ok) {
      return res.status(400).json({ message: check.message });
    }

    let assignId = existing.assigned_responder;
    if (status === 'accepted' && existing.status === 'pending') {
      assignId = responder_id != null ? Number(responder_id) : uid;
    }

    // Strict cleaning of the status string to ensure it matches MySQL ENUM values exactly
    const cleanStatus = String(status).trim().toLowerCase().replace(/[^a-z_]/g, '');
    
    await Emergency.update(cleanStatus, assignId, responder_lat, responder_lng, emergencyId);
    await Log.create(emergencyId, status, uid);

    const io = req.app.get('socketio');
    io.emit('emergencyUpdate', await Emergency.findByIdDetailed(emergencyId));

    res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('updateEmergencyStatus', error);
    res.status(500).json({ message: 'Error updating status' });
  }
};

// @desc    Get admin logs
// @route   GET /api/emergencies/admin/logs
const getAdminLogs = async (req, res) => {
  try {
    const logs = await Emergency.findAll();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
};

module.exports = { createEmergency, getAllEmergencies, updateStatus, acceptRequest, getAdminLogs };
