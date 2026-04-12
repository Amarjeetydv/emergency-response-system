const Emergency = require('../models/emergencyModel');
const Log = require('../models/logModel');
const Message = require('../models/messageModel');
const admin = require('firebase-admin');
const OpenAI = require('openai');

const ALLOWED_STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'escalated'];

// Initialize OpenAI (ensure OPENAI_API_KEY is in your .env)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } catch (error) {
    console.error('OpenAI initialization failed:', error.message);
  }
}

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

async function sendPushNotification(title, body, data = {}) {
  const message = {
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    topic: 'emergencies'
  };

  try {
    await admin.messaging().send(message);
  } catch (error) {
    console.error('FCM Error:', error);
  }
}

/**
 * Uses AI to classify the emergency based on user description
 */
async function classifyEmergencyText(text) {
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an emergency dispatcher. Classify the user's input into exactly one of these categories: police, ambulance, fire, or other. Only output the category name in lowercase." },
        { role: "user", content: text }
      ],
      temperature: 0,
    });
    const category = response.choices[0].message.content.trim().toLowerCase();
    return ['police', 'ambulance', 'fire'].includes(category) ? category : 'other';
  } catch (error) {
    console.error('NLP Classification Error:', error);
    return null; // Return null so we can fallback to the manual type
  }
}

// @desc    Report a new emergency (citizen)
// @route   POST /api/emergencies
const createEmergency = async (req, res) => {
  const { emergency_type, description, latitude, longitude } = req.body;

  if (req.user.role !== 'citizen') {
    return res.status(403).json({ message: 'Only citizens can create emergency requests' });
  }

  if (!emergency_type || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Please provide emergency type, latitude, and longitude' });
  }

  try {
    let finalType = emergency_type;

    // If description is provided, use AI to classify or verify the type
    if (description && description.length > 5) {
      const aiType = await classifyEmergencyText(description);
      if (aiType) finalType = aiType;
    }

    const insertId = await Emergency.create(
      req.user.id,
      finalType,
      latitude,
      longitude
    );

    await Log.create(insertId, 'pending', req.user.id);

    const io = req.app.get('socketio');
    const payload = await Emergency.findByIdDetailed(insertId);
    io.emit('newEmergency', payload);

    // Send Push Notification to all responders
    sendPushNotification(
      `NEW EMERGENCY: ${emergency_type.toUpperCase()}`,
      `A new request has been reported at your location. Please check the dashboard.`
    );

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
  const responder_id = req.user.id; // Correct: Use the ID from the authenticated token

  if (!request_id || !responder_lat || !responder_lng) {
    return res.status(400).json({ message: 'Missing required location data' });
  }

  try {
    // Atomic update: only update if status is still pending
    const affectedRows = await Emergency.claim(
      request_id, 
      responder_id, 
      responder_lat, 
      responder_lng
    );

    if (affectedRows === 0) {
      return res.status(409).json({ message: 'Request already taken by another responder' });
    }

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

// @desc    Get chat history for an emergency
// @route   GET /api/emergencies/:id/chat
const getChatHistory = async (req, res) => {
  try {
    const messages = await Message.findByEmergencyId(req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chat history' });
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id
const updateStatus = async (req, res) => {
  const { status, responder_lat, responder_lng } = req.body;
  const emergencyId = Number(req.params.id);
  const responder_id = req.user.id; // Use secure ID from JWT

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
    if (status === 'accepted' && (existing.status === 'pending' || existing.status === 'escalated')) {
      assignId = responder_id != null ? Number(responder_id) : uid;
      
      // Atomic update: only update if status is still pending
      const affectedRows = await Emergency.claim(
        emergencyId,
        assignId,
        responder_lat,
        responder_lng
      );

      if (affectedRows === 0) {
        return res.status(409).json({ message: 'This request has already been accepted by another responder.' });
      }
    } else {
      // For other status transitions, use the standard update
      const cleanStatus = String(status).trim().toLowerCase().replace(/[^a-z_]/g, '');
      await Emergency.update(cleanStatus, assignId, responder_lat, responder_lng, emergencyId);
    }
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

const processEscalations = async (io) => {
  try {
    const staleRequests = await Emergency.findStalePending(5); // 5 minute timeout
    
    for (const req of staleRequests) {
      // Use atomic escalation to prevent overwriting if a responder accepted it just now
      const affected = await Emergency.escalate(req.id);
      if (affected === 0) continue; 

      await Log.create(req.id, 'escalated', 0); // 0 represents System/Automation
      
      const detailed = await Emergency.findByIdDetailed(req.id);
      
      // Notify dispatchers specifically or broadcast high-priority update
      io.emit('emergencyEscalated', detailed);
      io.emit('emergencyUpdate', detailed);
      
      // Send High-Priority Push Notification
      sendPushNotification(
        `CRITICAL: Escalated Emergency #${req.id}`,
        `An emergency has not been accepted for 5 minutes and requires immediate attention!`,
        { priority: 'high', emergencyId: String(req.id) }
      );

      console.log(`[Escalation] Emergency #${req.id} escalated due to timeout.`);
    }
  } catch (error) {
    console.error('Escalation logic error:', error);
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
