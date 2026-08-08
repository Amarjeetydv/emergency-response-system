# ERCS Phase 6 Productization Baseline

This baseline documents the current active system components, endpoints, and workflows of the **Emergency Response Coordination System (ERCS)** before starting the Phase 6 polish.

---

## 1. Application Modules & Routing
* **Client Pages:** Single-Page Application using React Router.
  - `/login`: Public login form.
  - `/register`: Public user registration form.
  - `/dashboard`: Protected central operational dashboard (renders Citizen panel, Responder panel, or Admin panel depending on user credentials).

---

## 2. User Roles & Authorization
* **Citizen:** Can request assistance, detect coordinates, submit file attachments, and track active cases.
* **Responder:** Can claim pending dispatches, navigate to targets, and update emergency status. Requires administrative approval status (`approved`) to claim.
* **Admin:** Can review metrics, toggle approval gates, delete users, and monitor incidents.

---

## 3. Active REST API Endpoints

### Authentication `/api/auth`
- `POST /register`: Registers new profiles.
- `POST /login`: Authenticates profiles and stores refresh session.
- `POST /refresh`: Rotates credentials and issues new access tokens.
- `POST /logout`: Revokes database sessions and deletes HttpOnly cookies.
- `GET /users`: Fetches paginated user accounts (Admin only).
- `PATCH /users/:id/approve`: Approves responder profiles (Admin only).
- `PATCH /users/:id/role`: Alters account permission roles (Admin only).
- `DELETE /users/:id`: Destroys user records (Admin only).

### Emergencies `/api/emergencies`
- `POST /`: Submits new incident requests (Citizen only).
- `GET /`: Lists paginated incidents.
- `GET /:id`: Retrieves detailed incident metadata.
- `PUT /:id`: Updates status sequences (Responder/Citizen only).
- `POST /accept-request`: Claims dispatches atomically (Responder only).

### Diagnostics & Analytics
- `GET /api/admin/analytics`: Computes active database summaries (Admin only).
- `GET /health/live`: Lightweight Express process check.
- `GET /health/ready`: MySQL connectivity connection test.

---

## 4. Socket.io Event Interfaces
* **Client Emit:**
  - `updateToken`: Transmits rotated access tokens statelessly.
  - `updateLocation`: Broadcasts geolocation updates to monitors.
* **Server Broadcast:**
  - `newEmergency`: Broadcasts newly created cases.
  - `emergencyUpdate`: Emits changes to claimed dispatches.
  - `responderLocationUpdate`: Updates responder tracking pins on maps.

---

## 5. Emergency Lifecycle State Sequence
```text
[Pending]  ──(Claim Action)──>  [Accepted]  ──(Start Action)──>  [In Progress]  ──(Finish Action)──>  [Completed]
```

---

## 6. Database Entities
- `users`: Stores name, email, hashed passwords, roles, and responder approval tags.
- `emergencies`: Tracks coordinates, category types, responder IDs, status stages, and upload references.
- `refresh_tokens`: Tracks SHA256 hashed refresh cookies.
- `messages`: Historical table for incident chat records.

---

## 7. Current Active Test Suites
* **19/19 Integration Tests Passing:**
  - `tests/emergency.test.js` (Phase 1 lifecycle gates)
  - `tests/security.test.js` (Phase 2 CORS, rates, uploads, and roles check)
  - `tests/performance.test.js` (Phase 3 pagination, health, and aggregates check)
  - `tests/auth.test.js` (Phase 5A cookie refresh and rotation check)
  - `tests/config.test.js` (Phase 5B liveness, readiness, and CSP check)
