# ERCS Backend Architecture Documentation

This document describes the design and flow of the Emergency Response Coordination System (ERCS) backend after Phase 3.

---

## 1. High-Level Architecture Flow

```text
                    React Client
                         │
                         ▼
                    API Routes
                         │
                    Middleware (Auth, Rate Limit, Request ID)
                         │
                 ┌───────┴───────┐
                 │               │
             Controller       Socket.io
                 │               │
                 ▼               ▼
              Service        Authorized Rooms (admin, responders, citizen_id)
                 │
                 ▼
           Database Layer (Models & Connection Pool)
                 │
                 ▼
               MySQL
```

---

## 2. Architectural Layers

### A. Routes Layer
- File locations: `backend/routes/`
- Responsibilities: Mount HTTP verbs to URLs and attach authentication/rate-limiting middlewares.

### B. Middleware Layer
- File locations: `backend/middleware/`
- Custom middlewares added/updated:
  - `requestId.js`: Traces requests by injecting a unique UUID context to headers and JSON log pipelines.
  - `authMiddleware.js`: Verifies JWT tokens and attaches authenticated user properties to requests.
  - `customRateLimiter`: Enforces route request threshold limits in memory.

### C. Controller Layer
- File locations: `backend/controllers/`
- Responsibilities: Controller functions parse requests, sanitize incoming parameters, call corresponding services, and serialize JSON outputs.
- Controllers updated:
  - `emergencyController.js`: Decoupled from core queries; invokes `emergencyService` methods.
  - `adminController.js`: Retaining analytics endpoints and querying database-level aggregates directly.

### D. Service Layer
- File locations: `backend/services/`
- Modules added:
  - `emergencyService.js`: Encapsulates transaction blocks, transition rules, and media storage pipelines.

### E. Database Layer
- File locations: `backend/models/` and `backend/config/db.js`
- Responsibilities: Houses custom SQL query structures mapping records to model classes.
