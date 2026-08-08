# Walkthrough — ERCS Production Hardening & Portfolio Polish

This walkthrough records the technical enhancements implemented across the Emergency Response Coordination System (ERCS) migration pipeline.

---

## 1. Key Accomplishments

### Phase 4: Production UX
- **Toast Notifications Context:** Stackable, accessible alerts via `NotificationContext.tsx`.
- **Accessible Confirm Overlays:** Destructive events confirmation overlays using `<ConfirmDialog>`.
- **Live Connection Badge:** Dynamic server connection indicators (`● Live` / `● Offline`).

### Phase 5A: Authentication Hardening
- **Access/Refresh Token Division:** Access tokens are memory-only (15-minute). Refresh tokens use an `HttpOnly` cookie (7-day).
- **SHA256 Session Persistence:** Created `refresh_tokens` table to store SHA256 hashed sessions on database side.
- **Replay Protection:** Auto-invalidates active user sessions if a rotated token is reused.

### Phase 5B: Production Configuration
- **Startup Boot Validation:** Added fail-fast environment checks on boot.
- **Liveness/Readiness Split:** Implemented lightweight liveness probes (`/health/live`) separate from readiness connection tests (`/health/ready`).
- **Graceful Shutdown Update:** Included manual Socket.io listener closure (`io.close`) in the shutdown sequences.
- **CSP OpenStreetMap Leaflet tiles exception:** Updated CSP `img-src` string in `server.js` to allow `openstreetmap.org` resources.

### Phase 5C & 5D: Deployment & DevOps Readiness
- **Docker Build Contexts:** Added `.dockerignore` configs to keep images optimized.
- **Backend Container:** Structured `node:20-alpine` non-root image with local volume mapping.
- **Frontend Container:** Multi-stage image building static Vite files and copying them to an Alpine-based Nginx runner.
- **Nginx Reverse Proxy Configuration:** Configured relative paths routing `/api/` and WebSocket `/socket.io/` connections to the backend container.
- **Docker Compose Stack:** Defined a local orchestration stack linking `mysql`, `backend`, and `frontend`.

### Phase 6: Productization & Polish
- **Error Code Normalization:** Configured user-facing error message mapping, converting 400/409/429/503/500 code structures into human-readable alerts.
- **Form UX & validations:** Added button disabling on submits and input checks.
- **Interview & E2E Guides:** Created `docs/e2e-test-plan.md` and `docs/interview-preparation.md`.
- **README Updates:** Completely overwrote legacy reference documents to match React + Vite layouts.

---

## 2. Verification Outcomes

### Automated Regression Testing
- **Result:** **19/19 PASS** (100% test success rate)
  - Liveness probe instant response: **PASS**
  - Regression (Phase 1, 2, 3, 5A, 5B, 5C, 5D): **PASS**

### React Frontend Build Compiler
- **Command:** `npm run build`
- **Result:** **PASS** (compiled assets dist directory cleanly)
