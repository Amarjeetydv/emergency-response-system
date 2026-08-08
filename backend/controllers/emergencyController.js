const Emergency = require('../models/emergencyModel');
const Message = require('../models/messageModel');
const Log = require('../models/logModel');
const { emergencyService, canViewEmergencyFeed } = require('../services/emergencyService');

// @desc    Report a new emergency (citizen)
// @route   POST /api/emergencies
const createEmergency = async (req, res) => {
  const { emergency_type, emergencyType, description, latitude, longitude } = req.body || {};
  const finalEmergencyType = emergency_type || emergencyType;
  const parsedLat = (latitude !== undefined && latitude !== null) ? parseFloat(latitude) : NaN;
  const parsedLng = (longitude !== undefined && longitude !== null) ? parseFloat(longitude) : NaN;

  if (req.user.role !== 'citizen') {
    return res.status(403).json({ message: 'Only citizens can create emergency requests' });
  }

  if (!finalEmergencyType || isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ 
      message: 'Please provide emergency type, latitude, and longitude',
      received: { type: finalEmergencyType, lat: parsedLat, lng: parsedLng }
    });
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return res.status(400).json({
      message: 'Latitude must be between -90 and 90, and longitude must be between -180 and 180'
    });
  }

  try {
    const io = req.app.get('socketio');
    const payload = await emergencyService.createEmergency(
      req.user.id,
      finalEmergencyType,
      parsedLat,
      parsedLng,
      description,
      req.file,
      io
    );

    res.status(201).json({ id: payload.id, message: 'Emergency reported successfully', data: payload });
  } catch (error) {
    console.error('Create Emergency Controller Error:', error);
    res.status(500).json({ message: 'Error reporting emergency' });
  }
};

// @desc    List emergencies (citizen: own; admin / responders: all)
// @route   GET /api/emergencies
const getAllEmergencies = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  const offset = (page - 1) * limit;

  try {
    if (req.user.role === 'citizen') {
      const rows = await Emergency.findByCitizenId(req.user.id, limit, offset);
      return res.json(rows);
    }

    if (canViewEmergencyFeed(req.user)) {
      let rows;
      const { lat, lng } = req.query;

      // Nearest Responder Logic: Filter by distance (50km radius)
      if (lat && lng) {
        const rLat = parseFloat(lat);
        const rLng = parseFloat(lng);
        console.log(`Executing database-level proximity search for: ${rLat}, ${rLng}`);
        // Spatial database aggregation lookup:
        rows = await Emergency.findNearby(rLat, rLng, 50);
      } else {
        // Fetch paginated feed
        rows = await Emergency.findAll(limit, offset);
      }

      return res.json(rows);
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (error) {
    console.error('getAllEmergencies Controller Error:', error);
    res.status(500).json({ message: 'Error fetching emergencies' });
  }
};

// @desc    Specific handler for accepting a request with location
// @route   POST /api/emergencies/accept-request
const acceptRequest = async (req, res) => {
  const { request_id, responder_lat, responder_lng } = req.body;
  const responder_id = req.user.id; 

  if (!request_id) {
    return res.status(400).json({ message: 'Missing required request id' });
  }

  try {
    const io = req.app.get('socketio');
    const updated = await emergencyService.acceptEmergency(
      request_id,
      responder_id,
      responder_lat,
      responder_lng,
      io
    );
    res.json(updated);
  } catch (error) {
    console.error('acceptRequest Controller Error:', error);
    const status = error.statusCode || 500;
    const msg = status === 409 ? error.message : 'Error accepting request';
    res.status(status).json({ message: msg });
  }
};

// @desc    Get chat history for an emergency
// @route   GET /api/emergencies/:id/chat
const getChatHistory = async (req, res) => {
  const emergencyId = req.params.id;
  try {
    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }
    const isAdmin = req.user.role === 'admin';
    const isCitizenOwner = emergency.citizen_id === req.user.id;
    const isAssignedResponder = emergency.assigned_responder === req.user.id;

    if (!isAdmin && !isCitizenOwner && !isAssignedResponder) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const messages = await Message.findByEmergencyId(emergencyId);
    res.json(messages);
  } catch (error) {
    console.error('getChatHistory Controller Error:', error);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id
const updateStatus = async (req, res) => {
  const { status, responder_lat, responder_lng } = req.body;
  const emergencyId = Number(req.params.id);

  try {
    const io = req.app.get('socketio');
    const result = await emergencyService.updateEmergencyStatus(
      emergencyId,
      status,
      req.user,
      responder_lat,
      responder_lng,
      io
    );
    res.json(result);
  } catch (error) {
    console.error('updateStatus Controller Error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Error updating status' });
  }
};

// @desc    Get admin logs
// @route   GET /api/emergencies/admin/logs
const getAdminLogs = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  const offset = (page - 1) * limit;

  try {
    const logs = await Emergency.findAll(limit, offset);
    res.json(logs);
  } catch (error) {
    console.error('getAdminLogs Controller Error:', error);
    res.status(500).json({ message: 'Error fetching logs' });
  }
};

// Overlap scheduler guard
let isEscalationRunning = false;

const processEscalations = async (io) => {
  if (isEscalationRunning) {
    console.log('[Escalation Cron] Skip: previous execution still active');
    return;
  }
  isEscalationRunning = true;

  try {
    const staleRequests = await Emergency.findStalePending(5); // 5 minute timeout
    
    for (const req of staleRequests) {
      // Use atomic escalation check
      const affected = await Emergency.escalate(req.id);
      if (affected === 0) continue; 

      await Log.create(req.id, 'escalated', null); 
      const detailed = await Emergency.findByIdDetailed(req.id);
      
      if (io && detailed) {
        io.to('admin').to('responders').emit('emergencyEscalated', detailed);
        io.to('admin').to('responders').to(`citizen_${detailed.citizen_id}`).emit('emergencyUpdate', detailed);
      }

      console.log(`[Escalation] Emergency #${req.id} escalated due to timeout.`);
    }
  } catch (error) {
    console.error('Escalation logic error:', error);
  } finally {
    isEscalationRunning = false;
  }
};

module.exports = { 
  createEmergency, 
  getAllEmergencies, 
  updateStatus, 
  acceptRequest, 
  getAdminLogs,
  processEscalations,
  getChatHistory
};
