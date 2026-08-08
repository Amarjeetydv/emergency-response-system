# Phase 5C Deployment & DevOps Readiness Audit

This audit evaluates the containerization parameters, deployment topology options, reverse proxy requirements, database persistence, and security settings for the **Emergency Response Coordination System (ERCS)**.

---

## 1. Executive Summary
The ERCS application is production-ready at a local configuration level. To transition into cloud deployment, we audit and design the containerization strategy:
* **Container Suitability:** Both the frontend (Vite React) and backend (Express Node) compile/test cleanly. The backend's graceful shutdowns, fail-fast checks, and split healthchecks (`/health/live`, `/health/ready`) map perfectly into container orchestrators.
* **Storage and Persistence:** The database require named Docker volumes to survive restarts, while local file uploads (`uploads/`) require a persistent disk path mount.
* **Socket.io Staging Constraints:** Websocket upgrades and CORS routes require reverse-proxy rules. Scaling horizontally in the future would require a Redis adapter for pub/sub session synchronization.

---

## 2. Component Design & Strategies

### Backend Container (`backend/Dockerfile`)
* **Base Image:** `node:20-alpine` (lightweight, secure LTS release).
* **Dependency Caching:** Copies `package.json` and runs `npm ci --only=production` to keep dev dependencies out of the build.
* **Container Security:** Runs under the default unprivileged `node` user instead of root.
* **Storage Mount:** A persistent volume bound to `/app/uploads` to store citizen file attachments.

### Frontend Container (`frontend/Dockerfile` or Static CDN)
* **Strategy Choice:** Multi-stage build producing static files served by Nginx (Option A). This is the standard deployment approach for SPAs, providing high-efficiency static caching and routing rules.
* **SPA Routing Fallbacks:** Nginx handles React router path redirects via:
  `try_files $uri $uri/ /index.html;`

### Database Persistence & Backups
* **Local Staging:** MySQL container running with volume mounts:
  `-v db_data:/var/lib/mysql`
* **Production:** A cloud-managed database (e.g. AWS RDS) is recommended for production deployment to isolate data backups and security groups.

---

## 3. Environment Variables & Secrets
The container setups will consume these standard variables:
* **Backend:** `NODE_ENV=production`, `PORT=5000`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`.
* **Frontend:** Build-time variables `VITE_API_BASE_URL` and `VITE_SOCKET_URL` (no backend secrets must ever be mapped to these keys).

---

## 4. Docker Compose Topology (`docker-compose.yml`)
For local production-like verification, a three-service Compose stack is planned:
1. `mysql`: Database server with named volume storage, monitored via `mysqladmin ping` healthchecks.
2. `backend`: Express API server, dependent on `mysql` health checks, exposing port `5000`.
3. `frontend`: Static server exposing port `80` (or `443` for HTTPS local staging checks).

---

## 5. Security & Isolation Verification
* **Unprivileged user:** The Node container execution context restricts root exploits.
* **Port Protection:** Only the reverse proxy/load-balancer exposes port `80`/`443` publicly. The database and backend containers communicate internally via private Docker networks.
* **Docker Ignore:** `.dockerignore` will exclude `node_modules`, `.env`, and the backup directory `frontend-angular/` from container contexts.

---

## 6. Phase 5C Implementation Roadmap

```text
5C.1 Create .dockerignore files for frontend and backend
                       │
                       ▼
5C.2 Write backend Dockerfile (Alpine-based, non-root user)
                       │
                       ▼
5C.3 Write frontend Dockerfile (Multi-stage static compiler)
                       │
                       ▼
5C.4 Configure local docker-compose.yml stack
                       │
                       ▼
5C.5 Set up local SSL/TLS Nginx gateway for verification
```
---

## 7. Testing & Verification Plan
- Build frontend and backend containers locally.
- Run `docker compose up` and verify the services connect and startup checks succeed.
- Inspect container configurations using `docker inspect` to confirm non-root user setups.
- Run the full integration test suite against the Docker-compose API endpoints.
