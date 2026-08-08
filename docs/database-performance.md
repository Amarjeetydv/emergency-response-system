# ERCS Database Performance & Index Documentation

This document describes the schema structure, indexing strategies, pagination, and database aggregates implemented in Phase 3.

---

## 1. Existing Database Schema Overview

The database uses a MySQL server engine. The tables are:
- `users`: Stores user accounts, roles (`citizen`, `responder`, `admin`, etc.), and approval status.
- `emergencies`: Primary incident registry with spatial decimal coordinates, status, and assignment keys.
- `logs`: Audit log for state transitions.
- `messages`: Chat logs.

---

## 2. Optimization Indexes Added

The following indices were added to optimize list feeds, order query structures, and cron scans:

| Table | Index Name | Columns Indexed | Reason |
|---|---|---|---|
| `emergencies` | `idx_emergencies_status` | `status` | Speeds up pending/escalated cron scans and dashboard status aggregates. |
| `emergencies` | `idx_emergencies_created_at` | `created_at` | Speeds up timeline feed ordering (`ORDER BY created_at DESC`). |

### Explain Plan Analysis Examples

#### Query 1: Fetching Stale Emergencies (Cron Trigger)
```sql
EXPLAIN SELECT id FROM emergencies WHERE status = 'pending' AND created_at < NOW() - INTERVAL 5 MINUTE;
```
* **Before Indexing:** Table scan (all rows examined, index scan = `NULL`).
* **After Indexing:** Index Range Scan using `idx_emergencies_status`. Rows examined is filtered directly to `pending` records.

#### Query 2: Listing Emergencies
```sql
EXPLAIN SELECT * FROM emergencies ORDER BY created_at DESC LIMIT 50;
```
* **Before Indexing:** Full table scan requiring filesort.
* **After Indexing:** Scan on `idx_emergencies_created_at` in reverse direction (zero filesort, O(N) where N is limit size).

---

## 3. Server-side Pagination Strategy

To prevent unbounded array loads, pagination parameters `page` and `limit` are parsed:
- Default parameters: `page = 1`, `limit = 50`.
- Maximum limit capped at 100.
- Implemented using SQL `LIMIT` and `OFFSET` clauses constructed programmatically via safe integer validation.

---

## 4. Connection Pool Configuration

The MySQL pool is configured in `backend/config/db.js`:
- **Pool Size:** `connectionLimit: 10` (Default connection pool size, optimal for Node's single-threaded event loop throughput).
- **Error/Release Hooks:** Automatically releases connection contexts back to pool after query completes.
