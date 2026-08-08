const Log = require('../models/logModel');
const Emergency = require('../models/emergencyModel');
const User = require('../models/userModel');

const getLogs = async (req, res) => {
  try {
    const logs = await Log.findAllRecent(500);
    res.json(logs);
  } catch (error) {
    console.error('getLogs Controller Error:', error);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
};

const getAnalytics = async (req, res) => {
  try {
    // Database-level aggregations
    const emergencyStats = await Emergency.getAnalyticsSummary();
    const responderStatsRows = await User.getResponderAnalytics();

    const statusCounts = {
      pending: 0,
      escalated: 0,
      active: 0,
      completed: 0
    };

    emergencyStats.statusCounts.forEach(row => {
      if (row.status === 'pending') statusCounts.pending = row.count;
      else if (row.status === 'escalated') statusCounts.escalated = row.count;
      else if (['accepted', 'in_progress'].includes(row.status)) statusCounts.active += row.count;
      else if (row.status === 'completed') statusCounts.completed = row.count;
    });

    let responderTotal = 0;
    let pendingApproval = 0;

    responderStatsRows.forEach(row => {
      responderTotal += row.count;
      if (row.approval_status === 'pending') {
        pendingApproval = row.count;
      }
    });

    const analytics = {
      totalEmergencies: emergencyStats.total,
      statusCounts,
      responderStats: {
        total: responderTotal,
        pendingApproval
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('getAnalytics Controller Error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};

module.exports = { getLogs, getAnalytics };
