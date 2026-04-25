
-- PostgreSQL schema for Emergency Response Coordination System

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'citizen' CHECK (role IN ('citizen', 'police', 'ambulance', 'fire', 'admin', 'responder', 'dispatcher')),
  phone VARCHAR(20),
  approval_status VARCHAR(20) CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergencies (
  id SERIAL PRIMARY KEY,
  citizen_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emergency_type VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','in_progress','completed','cancelled','escalated')),
  description TEXT DEFAULT NULL,
  media_url VARCHAR(255) DEFAULT NULL,
  assigned_responder INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
  responder_lat DECIMAL(10,8) DEFAULT NULL,
  responder_lng DECIMAL(11,8) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  emergency_id INTEGER NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  emergency_id INTEGER NOT NULL REFERENCES emergencies(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Set admin role for admin@gmail.com if needed
-- UPDATE users SET role = 'admin' WHERE email = 'admin@gmail.com';
