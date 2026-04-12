CREATE DATABASE ercs;

-- CREATE TABLE `users` (
--   `id` int NOT NULL AUTO_INCREMENT,
--   `name` varchar(255) NOT NULL,
--   `email` varchar(255) NOT NULL,
--   `password` varchar(255) NOT NULL,
--   `role` enum('citizen','responder','dispatcher') NOT NULL,
--   `phone` varchar(20) DEFAULT NULL,
--   `latitude` decimal(10,8) DEFAULT NULL,
--   `longitude` decimal(11,8) DEFAULT NULL,
--   `availability` enum('available','unavailable') DEFAULT 'available',
--   PRIMARY KEY (`id`),
--   UNIQUE KEY `email` (`email`)
-- ) ENGINE=InnoDB;


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
    updated_by INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id)
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


UPDATE users SET role = 'admin' WHERE email = 'admin@gmail.com';
ALTER TABLE users ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL;

-- Run these commands to fix the "Unknown column" error in your existing database
ALTER TABLE emergencies ADD COLUMN responder_lat DECIMAL(10,8) DEFAULT NULL AFTER assigned_responder;
ALTER TABLE emergencies ADD COLUMN responder_lng DECIMAL(11,8) DEFAULT NULL AFTER responder_lat;
ALTER TABLE emergencies MODIFY COLUMN status ENUM('pending','accepted','in_progress','completed','cancelled','escalated') NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN fcm_token TEXT DEFAULT NULL;
