# Phase 5 Production Authentication, Deployment & DevOps Audit

This audit evaluates the current state of the **Emergency Response Coordination System (ERCS)** backend and frontend architectures, identifying potential production vulnerabilities, systems configuration gaps, and roadmap strategies for transition to a staging or production-ready cloud environment.

---

## 1. Executive Summary
The ERCS project has evolved through four hardening phases. The core database layer, security middleware, and real-time frontend/backend elements are verified as working. However, transitioning this system to a secure production environment requires addressing:
* **Stateless JWT Expirations:** Long-lived 30-day tokens stored in client `localStorage` are vulnerable to XSS theft and lack revocation control.
* **Persistent Socket Lifetimes:** Sockets verify user roles on initial connection handshakes but do not actively monitor account status or role changes once established.
* **Distributed Cron Execution Overlaps:** The escalation background scheduler relies on single-node in-process state variables, which fail to protect against concurrency overlaps when scaled to multiple load-balanced instances.

---

## 2. Current Architecture Review
* **Frontend:** Single-page React application using Vite. Client requests route through an Axios client containing token interception and automated 401 redirect behaviors.
* **Backend:** Express application hosting real-time Socket.io routes, manual MySQL query mappings, node-cron triggers, structured loggers, and in-process rate limits.
* **Database:** Connection pools manage up to 10 connections. Startup procedures execute manual index additions directly.

---

## 3. Authentication Security Lifecycle

```text
Registration  ──>  Login  ──>  JWT Sign (expires: 30d)  ──>  localStorage Storage
                                                                     │
  ┌──────────────────────────────────────────────────────────────────┘
  ▼
API Headers (Bearer Token)  ──>  Socket Handshake Verification  ──>  Role-Based Rooms
```

### JWT Management Details
* **Algorithm:** HMAC SHA256 (HS256).
* **Secret Management:** Loaded via `process.env.JWT_SECRET` in server setup.
* **Payload:** `{ id: user.id, email: user.email, role: user.role }`.
* **Token Expiration:** Fixed at **30 days** (`expiresIn: "30d"`).
* **Storage Location:** Stored in client `localStorage` under keys `token`, `user`, and `role`.
* **Revocation Controls:** Currently, no token blacklist exists on the server. If a token is stolen, it remains valid until the 30-day cryptographical expiration is met.

---

## 4. Evaluation: HTTP-Only Refresh Token Migration

Stashing tokens in `localStorage` subjects the application to Cross-Site Scripting (XSS) leaks. If a third-party dependency is compromised, user tokens can be read programmatically.

### Proposed Architecture

```text
Login Request  ──>  Set-Cookie: refreshToken (HTTP-Only, Secure, SameSite=Lax, /refresh)
               ──>  Body: accessToken (short-lived, 15 minutes, Memory-only)
```

### Technical Implications
* **Security Benefits:** Prevents Javascript from reading the refresh token. Even if an XSS vulnerability occurs, the attacker cannot steal the session.
* **CORS & SameSite Constraints:** Requires deploying frontend and backend on matching parent domains (e.g. `app.ercs.com` and `api.ercs.com`) to allow `SameSite=Lax` cookie exchanges.
* **Socket.io Impact:** The socket handshake must verify cookies sent in the initial HTTP headers or fetch a short-lived access token from memory.
* **Recommendation:** Migrate to a **short-lived Access Token (15 mins, in memory)** paired with an **HTTP-Only Secure Refresh Token (7 days, cookie)**. This satisfies resume-level security criteria without creating undue local development friction.

---

## 5. Socket.io Authentication Audit
* **Current State:** The socket connection executes `User.findById(decoded.id)` during the initial connection handshake.
* **Risks identified:**
  1. **Role Revocation bypass:** If a responder is deactivated or an admin changes a user's role while they have an active socket, the socket session remains active. The socket keeps its role-based room subscriptions (`admin` or `responders`).
  2. **Spoofing Prevention:** Location updates and chat messaging execute validation checks comparing `socket.user.id` against parameters to block ID spoofing.
* **Recommendation:** Implement a periodic connection token re-validation filter (e.g. every 10 minutes) or trigger socket disconnect dispatches directly from the Express user-update controllers when user roles or approvals change.

---

## 6. Rate Limiting Audit
* **Current State:** Middleware holds an in-memory `Map` tracking request counts by IP.
* **Routes Protected:** `/api/auth/login` (5/min), `/api/auth/register` (5/min), and all `/api/*` endpoints (60/min).
* **Evaluation:**
  - **Single Instance:** In-memory tracking is lightweight and has zero infrastructure cost.
  - **Multi-Instance:** Load balancers distribute requests, meaning rate limits are not shared. An attacker can bypass limits by routing requests across multiple servers.
* **Recommendation:** Maintain the in-memory limiter for simple deployments. If the system is scaled horizontally, migrate to a **Redis-backed rate limiter** (`express-rate-limit` with `rate-limit-redis`).

---

## 7. Scheduler Audit
* **Current State:** `node-cron` fires the escalation task every minute. An in-process boolean `isEscalationRunning` blocks overlapping cron executions.
* **Vulnerability Matrix:**
  * **Server Crash:** Overlap state resets on reboot. Database rows are protected atomically by checking `WHERE status = 'pending'` inside the update query.
  * **Load Balancing (Multi-Instance):** Multiple instances will query the database at the same minute. Although row locks prevent double escalations, it creates database pool bottlenecks.
* **Recommendation:** Transition scheduler configurations to use a **Database Distributed Lock** (e.g. updating a locking row in a `system_locks` table) or route cron tasks through an **external scheduler** (e.g. AWS EventBridge) calling a secure, signature-validated webhook API on the backend.

---

## 8. Environment Variables Audit
* **Critical Variables:**
  - `PORT`, `NODE_ENV`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
  - `JWT_SECRET`
  - `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
  - `CORS_ORIGINS`, `FRONTEND_URL`
* **Vulnerabilities:**
  - `.gitignore` successfully isolates `.env` from git commits.
  - An `.env.example` template is provided to standardise setup.
  - **Secret Isolation Check:** No database passwords or private keys are hardcoded in source control.

---

## 9. Network Security, CORS & HTTPS

### CORS Settings
- **Development:** Dynamically permits localhost mappings.
- **Production:** Restricts access to domains defined in `CORS_ORIGINS`.

### HTTPS Requirements
- Cookied sessions require the `Secure` flag.
- Sockets must connect over `wss://` to prevent mixed-content blocks by browsers.

---

## 10. Containerization & Docker Readiness
The repository currently lacks container configuration files.

### Recommended Docker Architecture
1. **Frontend:** Multi-stage build. Stage 1 compiles React static chunks. Stage 2 copies files to an **Nginx** alpine image for routing.
2. **Backend:** Lightweight NodeJS alpine image exposing port `5000`.
3. **Database:** Do not containerize MySQL for production; recommend utilizing a managed MySQL engine to guarantee database safety.

---

## 11. Database Production Audit
* **Connection Pool:** Set to a max limit of 10 connections.
* **Migrations:** Current schema alterations are tracked in unstructured SQL script files.
* **Recommendation:** Introduce **Knex** or **db-migrate** database migration schemas to track migrations programmatically.

---

## 12. Logging, Health Probes & Monitoring
* **Structured Logs:** Logs write request UUID tracking metadata to stdout in JSON format.
* **Diagnostics:** `/health` evaluates basic database ping responses.
* **Graceful Shutdown:** `SIGTERM` listeners close the HTTP server and terminate database connection pools before exit.
* **Recommendation:** Split `/health` into `/health/live` (process is alive) and `/health/ready` (database is reachable).

---

## 13. Cost-Aware Staging Recommendations

### Option A (Recommended)
* **Design:** Single node instance (Render/Fly.io) + managed database (AWS RDS free tier).
* **Cost:** $0 - $15 / month.
* **Pros:** Zero configuration complexity, suitable for resumes.

### Option B
* **Design:** Multiple nodes + Redis container + Distributed Locks.
* **Cost:** $50+ / month.
* **Pros:** Enterprise-level scaling capabilities.

---

## 14. Prioritized Production Risk Matrix

### P0 — Must Fix Before Production
- **JWT Expiration & Revocation:** Shorten the 30-day token lifetime. Add a database or Redis blocklist to invalidate tokens on user logout.
- **Socket Session Lifecycle:** Add periodic token validation inside active socket streams.

### P1 — Strongly Recommended
- **Lightweight Migrations:** Implement migration scripts using a programmatic library to avoid manual SQL steps.
- **Readiness Probes:** Separate process checks from database health diagnostics.

---

## 15. Implementation Roadmap Proposal

```text
Phase 5A: Authentication Hardening (Short JWT + Session Blocklist)
                    │
                    ▼
Phase 5B: Docker Containerization (Vite-Nginx + Express Dockerfiles)
                    │
                    ▼
Phase 5C: Migrations & Readiness Probes (Knex + Split /health Endpoints)
```
