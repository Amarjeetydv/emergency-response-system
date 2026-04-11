const Log = require('../models/logModel');
const Emergency = require('../models/emergencyModel');
const User = require('../models/userModel');

const getLogs = async (req, res) => {
  try {
    const logs = await Log.findAllRecent(500);
    res.json(logs);
  } catch (error) {
    console.error('getLogs', error);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const emergencies = await Emergency.findAll();
    const users = await User.getAll();

    const analytics = {
      totalEmergencies: emergencies.length,
      statusCounts: {
        pending: emergencies.filter(e => e.status === 'pending').length,
        escalated: emergencies.filter(e => e.status === 'escalated').length,
        active: emergencies.filter(e => ['accepted', 'in_progress'].includes(e.status)).length,
        completed: emergencies.filter(e => e.status === 'completed').length,
      },
      responderStats: {
        total: users.filter(u => u.role !== 'citizen' && u.role !== 'admin').length,
        pendingApproval: users.filter(u => u.approval_status === 'pending').length
      }
    };
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};

module.exports = { getLogs, getAnalytics };
