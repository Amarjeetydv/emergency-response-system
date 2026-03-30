const db = require('../config/db');
const Emergency = require('../models/emergencyModel');
const Log = require('../models/logModel');

// @desc    Report a new emergency
// @route   POST /api/emergencies
const createEmergency = async (req, res) => {
  const { emergency_type, latitude, longitude } = req.body;

  // 1. Validation: Ensure required fields are present
  if (!emergency_type || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Please provide emergency type, latitude, and longitude' });
  }

  try {
    // 2. Fix the call: Pass variables individually, not as an array
    const insertId = await Emergency.create(
      req.user.id, // Comes from JWT via protect middleware
      emergency_type,
      latitude,
      longitude
    );

    // 3. Create initial log entry
    await Log.create(insertId, 'pending', req.user.id);

    // Get the socket.io instance from the app
    const io = req.app.get('socketio');
    // Broadcast the new emergency to all connected clients (dispatchers)
    io.emit('newEmergency', {
      id: insertId,
      citizen_id: req.user.id,
      citizen_name: req.user.name,
      emergency_type,
      latitude,
      longitude,
      status: 'pending'
    });

    res.status(201).json({ id: insertId, message: 'Emergency reported successfully' });
  } catch (error) {
    console.error('Create Emergency Error:', error); // Log actual error for debugging
    res.status(500).json({ message: 'Error reporting emergency', error: error.message });
  }
};

// @desc    Get all emergencies
// @route   GET /api/emergencies
const getAllEmergencies = async (req, res) => {
  try {
    const rows = await Emergency.findAll();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching emergencies' });
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id
const updateEmergencyStatus = async (req, res) => {
  const { status, responder_id } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    // Use the model update method
    await Emergency.update(req.params.id, status, responder_id);
    
    // Create log entry for the update
    await Log.create(req.params.id, status, req.user.id);

    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status' });
  }
};

module.exports = { createEmergency, getAllEmergencies, updateEmergencyStatus };
