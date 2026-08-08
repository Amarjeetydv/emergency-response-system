# Emergency Response Coordination System (ERCS)

A professional full-stack, real-time platform designed to coordinate emergency response operations. The system allows citizens to file emergency requests, enables responders to claim incidents with live location sharing, and provides administrators with a central command dashboard for resource routing, responder approvals, and automated escalations.

---

## Technical Architecture

The platform architecture divides responsibilities between a React frontend interface, an Express API + WebSocket server, and a relational MySQL store.

```text
       HTTPS/WSS Request (Internet)
                     │
                     ▼
         ┌───────────────────────┐
         │  TLS Reverse Proxy    │  (Nginx Gateway Port 8080)
         └───────────┬───────────┘
                     │
             ┌───────┴───────┐
             ▼               ▼
      ┌────────────┐   ┌────────────┐
      │  Frontend  │   │  Backend   │
      │  (React /  │   │  (Express  │
      │   Vite)    │   │   NodeJS)  │
      └────────────┘   └──────┬─────┘
                              │
                              ▼
                       ┌────────────┐
                       │   MySQL    │
                       │ (Database) │
                       └────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript | Component framework for modular Single-Page Application (SPA) structure. |
| **Frontend Tooling** | Vite 8 + Sass | High-performance bundler and development server. |
| **Map Widgets** | Leaflet 1.9 | Renders satellite maps, incident circles, and responder marker locations. |
| **Map Clustering** | leaflet.markercluster | Clusters dense map markers to maintain visibility. |
| **Map Hotspots** | leaflet.heat | Renders geographical hotspot densities for incidents. |
| **WebSocket Client**| socket.io-client 4.8 | Emits responder coordinates and listens to server dispatches. |
| **Backend Framework**| Express 5.2 (Node.js) | Handles REST routing, CORS rules, and security middlewares. |
| **WebSocket Server**| socket.io 4.8 | Manages WebSocket connection authentications and events. |
| **Background Cron** | node-cron 3.0 | Daemon script running every minute to escalate unassigned dispatches. |
| **Database Driver** | mysql2 3.19 | Handles asynchronous connection pooling and transactions. |
| **Crypto Hashing**  | bcryptjs 3.0 | Hashes passwords during registration and verifies them on login. |
| **Auth Tokens** | jsonwebtoken 9.0 | Generates and signs JWT credentials for secure user session management. |
| **File Parser** | Multer 1.4 | Parses incoming multipart form-data attachments. |

---

## Key Security Hardening Details

1. **Short-Lived Access Tokens:** In-memory access tokens expire in **15 minutes**, protecting active sessions from script reading (XSS).
2. **HttpOnly Refresh Cookies:** Stored in browser cookies with properties: `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, and `Secure` (production-only).
3. **Token Rotation & Replay Protection:** Re-using a previously rotated refresh token triggers automatic invalidation of all sessions for that user account.
4. **Axios Request Queue:** Central interceptor pauses failed 401 requests during active refreshes, retrying queued calls when completed.
5. **Fail-Fast Startup checks:** Validates core environment parameters on startup.
6. **Liveness & Readiness Probes:** Exposes separate endpoints `/health/live` (process check) and `/health/ready` (database check).
7. **Graceful Shutdown:** Stops socket servers and drains SQL pools before exiting.

---

## User Roles & Operations

### 1. Citizen
* Pins location coordinates using Leaflet map indicators.
* Logs requests with category types, descriptions, and file uploads (< 5MB limit).
* Tracks own reported history and exports logs as CSV tables.

### 2. Approved Responder
* Views active emergency dispatches on a leaflet command map.
* Claims dispatches atomically after checking location sharing consent.
* Transitions incidents through progress sequence states: `Accepted` -> `In Progress` -> `Completed`.

### 3. Administrator
* Views total summaries (active responders, pending approvals, case loads).
* User Management Panel: approves pending responders, deletes profiles, and updates roles.
* Incident Queue Panel: monitors detailed case descriptions, media urls, and log records.

---

## Database Design

The MySQL schema enforces relational constraints and index mappings:

- `users`: Tracks profiles, hashed passwords, roles, and approval status attributes.
- `emergencies`: Tracks coordinates, category types, responder links, and upload urls.
- `refresh_tokens`: Tracks SHA256 hashed refresh cookies.
- `logs`: Audit table tracking status changes.

---

## Project Structure

```text
emergency-response-coordination-system/
├── backend/
│   ├── config/db.js                 # Database connection pool setup
│   ├── controllers/                 # REST Route controllers
│   ├── middleware/                  # Auth limits and tracing middlewares
│   ├── models/                      # MySQL models and queries
│   ├── routes/                      # Router mappings
│   ├── tests/                       # Automated integration tests
│   ├── server.js                    # Startup boot, sockets, and crons
│   ├── Dockerfile
│   └── table.sql                    # Initial SQL schema
├── frontend/
│   ├── src/
│   │   ├── components/              # Shared confirmation/spinner views
│   │   ├── context/                 # Auth and alert context providers
│   │   ├── features/                # Citizen, Responder, and Admin dashboards
│   │   ├── pages/                   # Login and Register entry points
│   │   ├── services/                # API Client and Sockets instances
│   │   ├── index.scss               # Global styling layouts
│   │   └── main.tsx                 # Bootstrapping React
│   ├── Dockerfile
│   └── nginx.conf                   # Static server reverse proxy config
├── docker-compose.yml               # Development & orchestration stack
└── README.md
```

---

## Local Setup & Dev Workflow

### Prerequisites
* **Node.js**: v20 or higher
* **MySQL**: v8.0 or higher

### 1. Database Configuration
```sql
CREATE DATABASE ercs;
```
Import schema:
```bash
mysql -u root -p ercs < backend/table.sql
```

### 2. Run Backend
```bash
cd backend
npm install
npm run dev
```
The backend initializes the `refresh_tokens` table on boot and listens on port `5000`.

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
The React development server compiles assets and starts on `http://localhost:5173`.
