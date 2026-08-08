const logger = {
  info: (event, metadata = {}) => {
    console.log(JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      level: 'INFO', 
      event, 
      ...metadata 
    }));
  },
  error: (event, error, metadata = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      event,
      errorMessage: error?.message,
      errorStack: error?.stack,
      ...metadata
    }));
  },
  warn: (event, metadata = {}) => {
    console.warn(JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      level: 'WARN', 
      event, 
      ...metadata 
    }));
  }
};

module.exports = logger;
