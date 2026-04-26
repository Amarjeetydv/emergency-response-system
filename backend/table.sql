CREATE DATABASE ercs;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'police', 'ambulance', 'fire', 'admin', 'responder', 'dispatcher') DEFAULT 'citizen',
  phone VARCHAR(20),
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users MODIFY COLUMN role ENUM('citizen', 'police', 'ambulance', 'fire', 'admin', 'responder', 'dispatcher') NOT NULL;



CREATE TABLE `emergencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `citizen_id` int NOT NULL,
  `emergency_type` varchar(255) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `status` enum('pending','accepted','in_progress','completed','cancelled','escalated') NOT NULL DEFAULT 'pending',
  `description` text DEFAULT NULL,
  `media_url` varchar(255) DEFAULT NULL,
  `assigned_responder` int DEFAULT NULL,
  `responder_lat` decimal(10,8) DEFAULT NULL,
  `responder_lng` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `citizen_id` (`citizen_id`),
  KEY `assigned_responder` (`assigned_responder`),
  CONSTRAINT `emergencies_ibfk_1` FOREIGN KEY (`citizen_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `emergencies_ibfk_2` FOREIGN KEY (`assigned_responder`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    updated_by INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
    CONSTRAINT fk_logs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emergency_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);


UPDATE users SET role='admin' WHERE email='admin@gmail.com';

ALTER TABLE users ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL;

-- Run these commands to fix the "Unknown column" error in your existing database
ALTER TABLE emergencies ADD COLUMN responder_lat DECIMAL(10,8) DEFAULT NULL AFTER assigned_responder;
ALTER TABLE emergencies ADD COLUMN responder_lng DECIMAL(11,8) DEFAULT NULL AFTER responder_lat;
ALTER TABLE emergencies MODIFY COLUMN status ENUM('pending','accepted','in_progress','completed','cancelled','escalated') NOT NULL DEFAULT 'pending';
ALTER TABLE emergencies ADD COLUMN description TEXT DEFAULT NULL AFTER status;
ALTER TABLE emergencies ADD COLUMN media_url VARCHAR(255) DEFAULT NULL AFTER description;
ALTER TABLE logs MODIFY COLUMN updated_by INT NULL;

-- Fix for User Deletion (Foreign Key Constraint Issues):
-- If you get 'Duplicate foreign key constraint name', it means the name is already taken.
-- If you get 'Can't DROP; check that column/key exists', the name provided is incorrect.
-- 
-- 1. Run this to find the ACTUAL constraint name: SHOW CREATE TABLE logs;
-- 2. Drop the existing constraint using the name found (e.g., 'logs_user_fk'):
--    ALTER TABLE logs DROP FOREIGN KEY logs_user_fk;
-- 3. Add it back with the correct behavior:
--    ALTER TABLE logs ADD CONSTRAINT logs_user_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
