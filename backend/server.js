const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const db = require('./config/db'); // This will run the connection check



// Load env vars
dotenv.config();

// Startup Environment Validation (Fail-Fast)
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL STARTUP ERROR: Missing required configuration variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Route files
const authRoutes = require('./routes/authRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { processEscalations } = require('./controllers/emergencyController');
const Message = require('./models/messageModel');
const jwt = require('jsonwebtoken');
const User = require('./models/userModel');
const Emergency = require('./models/emergencyModel');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  }
});

 

// Security Headers Middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://unpkg.com https://*.imagekit.io https://*.arcgisonline.com https://*.tile.openstreetmap.org; connect-src 'self' ws: wss: http: https:;");
  next();
};

// Custom memory-mapped Rate Limiting Middleware
const rateLimitMap = new Map();
const customRateLimiter = (limit, windowMs) => (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  if (timestamps.length > limit) {
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }
  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const fresh = timestamps.filter(t => now - t < 600000);
    if (fresh.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, fresh);
    }
  }
}, 600000).unref();

// Middleware
app.use(requestId);
app.use((req, res, next) => {
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});
app.use(securityHeaders);
app.use('/api/auth/login', customRateLimiter(5, 60000));
app.use('/api/auth/register', customRateLimiter(5, 60000));
app.use('/api', customRateLimiter(60, 60000));
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Liveness Check: verifies the node process is alive without touching database queues
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date()
  });
});

// Readiness Check: verifies MySQL database pooling connection is ready
app.get('/health/ready', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.status(200).json({
      status: 'READY',
      database: 'CONNECTED',
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Readiness health check database query failure', err);
    res.status(503).json({
      status: 'UNREADY',
      database: 'DISCONNECTED',
      timestamp: new Date()
    });
  }
});

// Health Check for Render/Monitoring (Backward Compatibility)
app.get('/health', async (req, res) => {
  try {
    await db.execute('SELECT 1');
    res.status(200).json({ 
      status: 'UP', 
      database: 'CONNECTED',
      timestamp: new Date() 
    });
  } catch (err) {
    logger.error('Health check database query failure', err);
    res.status(503).json({ 
      status: 'DOWN', 
      database: 'DISCONNECTED',
      timestamp: new Date() 
    });
  }
});

// Make io accessible to our router
app.set('socketio', io);

// Background Tasks: Escalation Cron (Runs every minute)
cron.schedule('* * * * *', () => {
  processEscalations(io);
});

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io middleware for JWT authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.email} (Socket: ${socket.id})`);

  // Room subscriptions based on verified role
  socket.join(`citizen_${socket.user.id}`);
  
  if (socket.user.role === 'admin') {
    socket.join('admin');
  }
  
  if (['police', 'fire', 'ambulance', 'responder', 'dispatcher'].includes(socket.user.role)) {
    socket.join('responders');
  }

  socket.on('updateToken', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        const oldRole = socket.user.role;
        socket.user = user;
        
        if (oldRole !== user.role) {
          console.log(`User ${user.email} role updated: ${oldRole} -> ${user.role}. Modifying socket rooms.`);
          socket.leave('admin');
          socket.leave('responders');
          
          if (user.role === 'admin') {
            socket.join('admin');
          }
          if (['police', 'fire', 'ambulance', 'responder', 'dispatcher'].includes(user.role)) {
            socket.join('responders');
          }
        }
      }
    } catch (err) {
      console.warn(`Socket token update failed:`, err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.email} (Socket: ${socket.id})`);
  });

  // Listen for location updates from responders
  socket.on('updateLocation', (data) => {
    if (!socket.user || !['police', 'fire', 'ambulance', 'responder', 'dispatcher'].includes(socket.user.role)) {
      console.warn(`Unauthenticated location broadcast attempt from socket: ${socket.id}`);
      return;
    }
    const responderId = Number(data.responderId || data.responder_id);
    if (responderId !== socket.user.id) {
      console.warn(`Responder location identity mismatch: socket user ID ${socket.user.id} vs broadcast ID ${responderId}`);
      return; // Prevent identity spoofing
    }
    
    // Broadcast location update only to admins
    io.to('admin').emit('responderLocationUpdate', data);
  });

  // Chat System
  socket.on('joinChat', async (emergencyId) => {
    try {
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) return;

      const isAdmin = socket.user.role === 'admin';
      const isCitizenOwner = emergency.citizen_id === socket.user.id;
      const isAssignedResponder = emergency.assigned_responder === socket.user.id;

      if (isAdmin || isCitizenOwner || isAssignedResponder) {
        socket.join(`chat_${emergencyId}`);
        console.log(`User ${socket.user.email} joined chat_${emergencyId}`);
      } else {
        console.warn(`Unauthorized chat room join attempt for emergency ${emergencyId} from user ${socket.user.email}`);
      }
    } catch (err) {
      console.error('joinChat auth error:', err);
    }
  });

  socket.on('sendMessage', async (data) => {
    const { emergencyId, senderId, message, senderName } = data;
    if (!socket.user || socket.user.id !== Number(senderId)) {
      console.warn(`Spoofed message sender blocked: socket user ID ${socket.user?.id} vs sender ID ${senderId}`);
      return;
    }
    try {
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) return;

      const isAdmin = socket.user.role === 'admin';
      const isCitizenOwner = emergency.citizen_id === socket.user.id;
      const isAssignedResponder = emergency.assigned_responder === socket.user.id;

      if (isAdmin || isCitizenOwner || isAssignedResponder) {
        await Message.create(emergencyId, senderId, message);
        io.to(`chat_${emergencyId}`).emit('receiveMessage', { 
          senderId, 
          message, 
          senderName, 
          timestamp: new Date() 
        });
      }
    } catch (err) {
      console.error('Chat send message error:', err);
    }
  });
});

// Global error-handling middleware (prevents stack trace leaks and formats upload limits)
app.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'The selected file is too large. Please choose a file smaller than 5MB.' });
  }
  if (err.message && err.message.startsWith('Invalid file type')) {
    return res.status(400).json({ message: err.message });
  }
  console.error('Unhandled Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ 
    message: 'An unexpected error occurred on the server.',
    error: isProd ? {} : { message: err.message, stack: err.stack }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server initialized in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🗄️  Attempting connection to Database Host: ${process.env.DB_HOST || 'Not Set'}`);
  
  // Safe index initializations
  (async () => {
    try {
      await db.execute("CREATE INDEX idx_emergencies_status ON emergencies(status)");
    } catch (e) {}
    try {
      await db.execute("CREATE INDEX idx_emergencies_created_at ON emergencies(created_at)");
    } catch (e) {}
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          token_hash VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          revoked_at TIMESTAMP NULL DEFAULT NULL,
          replaced_by VARCHAR(64) NULL DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          KEY idx_token_hash (token_hash)
        ) ENGINE=InnoDB;
      `);
      console.log('✅ Checked/created refresh_tokens table schema');
    } catch (e) {
      console.error('Failed to initialize refresh_tokens table:', e);
    }
  })();
});

// Graceful shutdown for production and development signals
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close active Socket.io connections first
  io.close(() => {
    console.log('Socket.io server closed');
    
    // Close HTTP listener
    server.close(async () => {
      console.log('HTTP server closed');
      try {
        await db.end();
        console.log('Database connection pool terminated');
      } catch (err) {
        console.error('Error closing database pool:', err);
      }
      console.log('Server shut down gracefully');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
