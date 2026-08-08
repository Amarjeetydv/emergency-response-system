# ERCS Production Deployment Architecture

This document describes the containerized staging and production deployment architectures recommended for the **Emergency Response Coordination System (ERCS)**.

---

## 1. System Topology Overview

The target deployment model uses a single-server, high-efficiency containerized topology suited for portfolio staging:

```text
       HTTPS/WSS Request (Internet)
                     │
                     ▼
         ┌───────────────────────┐
         │  TLS Reverse Proxy    │  (TLS Termination & Fallbacks)
         └───────────┬───────────┘
                     │
             ┌───────┴───────┐
             ▼               ▼
      ┌────────────┐   ┌────────────┐
      │  Frontend  │   │  Backend   │
      │  (Static   │   │  Container │
      │   Assets)  │   │  (Express) │
      └────────────┘   └──────┬─────┘
                              │
                              ▼
                       ┌────────────┐
                       │   MySQL    │
                       │ (Database) │
                       └────────────┘
```

---

## 2. Component Strategies

### 1. Frontend Deployment
* **Recommendation:** Multi-stage Docker build producing static production assets, served via the reverse proxy (e.g. Nginx) with single-page application (SPA) routing fallbacks redirecting unmatched paths to `index.html`.
* **API URLs:** Managed through environment variables (`VITE_API_BASE_URL` / `VITE_SOCKET_URL`) embedded at build-time.

### 2. Backend Containerization
* **Base Image:** Minimal `node:20-alpine` (stable, compact LTS release).
* **Security:** Configured to run as a non-root `node` system user.
* **Storage Mounts:** Local filesystem directory (`uploads/`) is mounted as a persistent Docker volume to preserve citizen file attachments.

### 3. Database Persistence
* **Staging/Local:** A MySQL container with a named Docker volume (`db_data`) mounted to `/var/lib/mysql`.
* **Production:** A cloud-managed instance (such as AWS RDS) for automated backups and failover.

### 4. Reverse Proxy Routing
* Encapsulates all services behind a unified HTTPS port (`443`) with TLS termination.
* Routes `/api/*` and socket upgrades `/socket.io/*` directly to the Node container, serving other paths from the static frontend build directories.
