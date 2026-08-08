# ERCS Portfolio Interview Preparation Guide

This guide compiles explanations of architectural and security decisions implemented across the **Emergency Response Coordination System (ERCS)**.

---

## 1. Core Technology Stack Decisions

### Why React?
* Employs component decomposition to keep dashboard layouts (Citizen/Responder/Admin panels) modular, interactive, and fast via state rendering.

### Why Express?
* Minimalist web framework perfect for RESTful API routing, middleware chaining (limiting, auth, requests tracing), and integration with Socket.io.

### Why MySQL?
* Relational database matching ERCS requirements. Enables atomic operations, foreign keys, transaction locks for CLAIM operations, and index querying.

### Why Socket.io?
* Real-time engine wrapper utilizing WebSockets. Provides automatic reconnections and multiplexing rooms (role-based isolation).

---

## 2. Hardened Session Security

### Memory Access Tokens + HttpOnly Cookies
* **Risk:** Storing JWT inside `localStorage` exposes it to Cross-Site Scripting (XSS).
* **Fix:** The access token is saved in transient React state. The refresh token is stored in an `HttpOnly` cookie. This makes token theft via javascript exploits impossible.

### Token Rotation & Replay Protection
* When a client refreshes its session, the old refresh token is marked as revoked, and a new one is set in the cookie.
* If a revoked/rotated token is reused (indicates a replay attack/theft), the backend revokes all active sessions for that user to block hijackers.

### Axios Queue (Single-Flight Lock)
* Multiple parallel API calls returning 401 simultaneously could trigger a cascade of token refreshes.
* The interceptor locks updates behind an `isRefreshing` state, pausing concurrent requests in a promise queue, then resolves and retries them once the token update completes.

---

## 3. Concurrency & Database Operations

### How are concurrent claiming race conditions prevented?
* When a responder claims an emergency, the database query runs inside an atomic transaction utilizing row locks:
  ```sql
  SELECT * FROM emergencies WHERE id = ? FOR UPDATE;
  ```
  If another responder attempts to claim the same ID, the second thread blocks until the first completes. The service checks `status === 'pending'` inside the lock, preventing double assignments.

---

## 4. Graceful Shutdown & Observability

### Graceful Shutdown Sequence
* Upon receiving `SIGTERM` or `SIGINT`, the backend:
  1. Closes Socket.io server to reject new WS connections.
  2. Closes the HTTP server to stop accepting REST API calls.
  3. Drains and terminates the MySQL database connection pool.
  4. Exits process with status `0`.
