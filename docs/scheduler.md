# ERCS Scheduler Documentation

This document describes the incident lifecycle escalation job rules, concurrency controls, and distributed limits.

---

## 1. Job Description & Parameters

- **Job Purpose:** Automatic escalation of emergency incidents left in `'pending'` status for too long.
- **Schedule:** Runs every 1 minute (`* * * * *`).
- **Escalation Threshold:** 5 minutes.
- **Query Conditions:**
  - Status must be `'pending'`.
  - Creation time must be older than 5 minutes (`created_at < NOW() - INTERVAL 5 MINUTE`).
- **Action:** Transition status to `'escalated'` and emit update socket telemetry to admins and responders.

---

## 2. In-Process Concurrency Protection (Overlap Guard)

To prevent a long-running execution of the cron job from overlapping with a subsequent run within the same backend instance, an execution flag check is evaluated:

```javascript
let isEscalationRunning = false;

const processEscalations = async (io) => {
  if (isEscalationRunning) {
    console.log('[Escalation Cron] Skip: previous execution still active');
    return;
  }
  isEscalationRunning = true;
  try {
    // Execution logic
  } finally {
    isEscalationRunning = false;
  }
};
```

---

## 3. Distributed/Multi-Instance Limitations

- **Current Architecture Risk:** If the Node server is scaled horizontally across multiple servers or container replicas, each process mounts its own `node-cron` schedule. While database-level changes are protected by atomic SQL updates (`UPDATE emergencies SET status = 'escalated' WHERE id = ? AND status = 'pending'`), multiple instances will execute redundant database query scans.
- **Production Recommendation:** For horizontal scaling, disable local crons and execute a single scheduler worker instance (e.g. AWS ECS Scheduled Task or Kubernetes CronJob), or manage distributed locks using Redis.
