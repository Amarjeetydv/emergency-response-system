const Emergency = require('../models/emergencyModel');

exports.createEmergency = async (req, res) => {
    try {
        const { emergency_type, latitude, longitude } = req.body;
        const citizenId = req.user.id; // Set by auth middleware

        const emergencyId = await Emergency.create(citizenId, emergency_type, latitude, longitude);
        const newEmergency = await Emergency.findById(emergencyId);

        // Broadcast to all connected clients
        const io = req.app.get('socketio');
        io.emit('newEmergency', newEmergency);

        res.status(201).json({ message: 'Emergency reported', emergency: newEmergency });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllEmergencies = async (req, res) => {
    try {
        const emergencies = await Emergency.findAll();
        res.json(emergencies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const responderId = req.user.id;

        await Emergency.update(id, status, responderId);
        const updated = await Emergency.findById(id);

        const io = req.app.get('socketio');
        io.emit('emergencyUpdate', updated);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// New handler for Admin Logs
exports.getAdminLogs = async (req, res) => {
    try {
        // Fetch logs (this would typically query a separate logs table or join)
        const logs = await Emergency.findAll(); 
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
