const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const db = require('./config/db'); // This will run the connection check
const admin = require('firebase-admin');

// Load env vars
dotenv.config();

// Initialize Firebase Admin
// Note: Place your serviceAccountKey.json in the config folder
try {
  const serviceAccount = require("./config/firebase-service-account.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization failed. Push notifications will not work.', error.message);
}

// Route files
const authRoutes = require('./routes/authRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { processEscalations } = require('./controllers/emergencyController');
const Message = require('./models/messageModel');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend's URL
    methods: ["GET", "POST", "PUT"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Example: Listen for location updates from responders
  socket.on('updateLocation', (data) => {
    // data should contain { responderId, latitude, longitude }
    console.log('Location update:', data);
    // Broadcast the location update to other clients (e.g., a dispatcher dashboard)
    io.emit('responderLocationUpdate', data);
  });

  // Chat System
  socket.on('joinChat', (emergencyId) => {
    socket.join(`chat_${emergencyId}`);
    console.log(`User ${socket.id} joined chat_${emergencyId}`);
  });

  socket.on('sendMessage', async (data) => {
    const { emergencyId, senderId, message, senderName } = data;
    try {
      await Message.create(emergencyId, senderId, message);
      io.to(`chat_${emergencyId}`).emit('receiveMessage', { senderId, message, senderName, timestamp: new Date() });
    } catch (err) {
      console.error('Chat error:', err);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
