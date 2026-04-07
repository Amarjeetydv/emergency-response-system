const Log = require('../models/logModel');

const getLogs = async (req, res) => {
  try {
    const logs = await Log.findAllRecent(500);
    res.json(logs);
  } catch (error) {
    console.error('getLogs', error);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
};

module.exports = { getLogs };
