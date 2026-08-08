# Phase 5B Production Configuration & Operational Readiness Audit

This audit evaluates the system settings, environment variable bindings, security headers, health endpoints, graceful shutdowns, and error diagnostics for the **Emergency Response Coordination System (ERCS)**.

---

## 1. Executive Summary
The ERCS project has implemented a secure cookie authentication flow and a reliable database layer. However, the system requires configuration validation and operational hardening before production staging:
* **Missing Startup Validation:** The server does not validate the presence of critical environment variables (like `JWT_SECRET` or `DB_HOST`), which can cause partial runtime failures.
* **Overloaded Health Checks:** The current `/health` endpoint executes database queries on every query request, which can deplete connection pools under high-frequency load balancer polling.
* **Incomplete Sockets Shutdown:** Graceful shutdown routines close the HTTP server but leave persistent Socket.io connections dangling, preventing clean port releases.
* **CSP Map Blocking:** The Content Security Policy lacks image mapping exceptions for `openstreetmap.org`, which will block map tile loading in the Admin Dashboard.

---

## 2. Environment Variables & Separation

### Frontend Variables (Vite)
- `VITE_API_BASE_URL`: Sets the REST base endpoint.
- `VITE_SOCKET_URL`: Explicit websocket server origin.

### Backend Variables (Express)
- `PORT`, `NODE_ENV`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `CORS_ORIGINS`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`.

### Environment Separations
- **Cookie Security:** The refresh token cookie is configured with the `Secure` attribute in `production` only, allowing development to continue using local HTTP.
- **Origins Control:** CORS is set to permit dynamic localhost bindings in development, and enforces explicitly declared domains in production.

---

## 3. Configuration Validation & Boot Checks
To prevent runtime configuration bugs, the application should validate variables immediately on startup:
* **Critical Keys:** Validate the presence of `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET`.
* **Fail-Fast Action:** If any critical keys are missing, the server logs a clear error message and exits with status `1`.

---

## 4. Operational Health Diagnostics
To optimize load balancer polling, we recommend exposing separate `/health/live` and `/health/ready` endpoints:

1. **Liveness Probe (`/health/live`):** Returns `200 OK` instantly to indicate the process is running.
2. **Readiness Probe (`/health/ready`):** Executes a basic database connection check (`SELECT 1`). If the database connection fails, it returns `503 Service Unavailable`.

---

## 5. Graceful Shutdown Audit
Active Socket.io connections are persistent and must be closed manually before port releases.
* **Proposed Lifecycle:**
  ```text
  SIGTERM/SIGINT  ──>  io.close()  ──>  server.close()  ──>  db.end()  ──>  process.exit(0)
  ```
This ensures active connections and requests complete cleanly before the process exits.

---

## 6. Production Error boundaries
* **Development:** API errors include stack traces and SQL query details.
* **Production:** Stack details are stripped. Standard errors return a generic `Internal server error` message, while full error details are printed to the JSON logs.

---

## 7. Security Headers & CSP Audit
The Leaflet integration requires specific exceptions:
* **Current CSP:**
  `img-src 'self' data: https://unpkg.com https://*.imagekit.io https://*.arcgisonline.com;`
* **Vulnerability:** The Admin Dashboard uses OpenStreetMap tiles (`https://*.tile.openstreetmap.org`). This is currently blocked by the CSP configuration.
* **Fix Required:** Update the CSP `img-src` string to include `https://*.tile.openstreetmap.org`.

---

## 8. Failure Handling & Recovery
* **Database Outage:** If the database goes offline during startup, the validation will fail fast. If the database fails at runtime, `/health/ready` will alert the orchestrator to route traffic away, and connection pools will automatically retry pings.

---

## 9. Phase 5B Implementation Roadmap

```text
5B.1 Startup Validation checks (fail-fast on missing keys)
                    │
                    ▼
5B.2 Separation of health diagnostics (/health/live & /health/ready)
                    │
                    ▼
5B.3 Complete Socket.io close handlers in graceful shutdowns
                    │
                    ▼
5B.4 CSP adjustments (OpenStreetMap image exceptions)
```
---

## 10. Testing Strategy
- Verify server exits with status `1` when `JWT_SECRET` is unset.
- Query `/health/live` and verify no database logs are created.
- Verify map tile loading is permitted by the CSP in the browser console.
- Run the full regression test suite (15/15 tests) to confirm no contract breakages.
