-- Run against existing `ercs` database if emergencies still use legacy statuses.
-- Converts assigned -> accepted, resolved -> completed, then applies the new enum.

USE ercs;

ALTER TABLE emergencies MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';

UPDATE emergencies SET status = 'accepted' WHERE status = 'assigned';
UPDATE emergencies SET status = 'completed' WHERE status = 'resolved';

ALTER TABLE emergencies MODIFY COLUMN status
  ENUM('pending','accepted','in_progress','completed','cancelled')
  NOT NULL DEFAULT 'pending';
