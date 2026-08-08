# ERCS Production Configuration & Operational Readiness

This document describes the environment separation, health diagnostic endpoints, startup validation rules, and error handling configurations for the **Emergency Response Coordination System (ERCS)** production environment.

---

## 1. Environment Variable Separations

Configure backend environments using standard key bindings, loading parameters dynamically based on `NODE_ENV`.

### Required Variables Checklist
- `NODE_ENV`: Runs as `production` in staging/cloud, and `development` locally.
- `PORT`: Port binding (default `5000` in production).
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL connection credentials.
- `JWT_SECRET`: Signing token secret.
- `CORS_ORIGINS`: Limits client access boundaries.

---

## 2. Server Startup Validation (Fail-Fast)
To prevent servers from running in a semi-broken state, the boot script must validate all required parameters:

```javascript
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ CRITICAL: Missing required variables: ${missing.join(', ')}`);
  process.exit(1);
}
```

---

## 3. High-Performance Health Diagnostics

Expose independent liveness and readiness endpoints to optimize load balancer health checking loops.

### 1. Liveness Probe (`/health/live`)
- **Action:** Quick process health check. Returns `200 OK` instantly to ensure the Node process is running.
- **DB Interaction:** None (protects connection pools from redundant connection queries).

### 2. Readiness Probe (`/health/ready`)
- **Action:** Full system health probe. Queries the database pool with a simple `SELECT 1` ping.
- **Response:** Returns `200 OK` if the DB is reachable, or `503 Service Unavailable` if database pooling fails.

---

## 4. Graceful Shutdown Design

Shut down servers cleanly when receiving `SIGTERM` or `SIGINT` signals:

1. **Stop Sockets:** Execute `io.close()` to disconnect active clients.
2. **Stop HTTP Server:** Call `server.close()` to stop accepting new requests.
3. **Shutdown DB Pool:** Run `db.end()` to drain connection pools cleanly.
4. **Exit Process:** Shut down with code `0`.
