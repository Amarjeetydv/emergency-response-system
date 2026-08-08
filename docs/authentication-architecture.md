# ERCS Authentication Architecture

This document describes the hardened production authentication lifecycle implemented in Phase 5A.

---

## 1. Token Lifecycles & Design

### Access Token (Stateless)
- **Format:** JWT signed via HMAC SHA256 (`jwt.sign`) using `process.env.JWT_SECRET`.
- **Lifetime:** **15 minutes** (`expiresIn: "15m"`).
- **Claims:** `{ id, email, role }` (no personal identifiable info).
- **Storage:** Client memory (`AuthContext.tsx` / `client.ts`). Never written to `localStorage` or cookies.

### Refresh Token (Database Persisted)
- **Format:** Secure cryptographically random 40-character hex string.
- **Lifetime:** **7 days**.
- **Persistence:** SHA256 hash stored in `refresh_tokens` database table.
- **Storage:** Stored in a secure `HttpOnly` cookie under the subpath `/api/auth`.
- **Security Options:** `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, and `Secure` (production-only).

---

## 2. Dynamic Token Rotation & Replay Protection

When `/api/auth/refresh` is hit:
1. The server checks the refresh token cookie, computes its SHA256 hash, and looks it up in `refresh_tokens`.
2. If valid and not expired, a new refresh token is generated, and the old token is revoked (`revoked_at = NOW()`) and updated with `replaced_by = newHash` in an atomic database transaction.
3. If an old, already-rotated token is sent again, the server detects token reuse (replay attempt) and immediately revokes all sessions associated with that user to mitigate session hijacking.

---

## 3. Axios Interceptor Refresh Queue

The client-side API client `client.ts` uses an Axios interceptor to manage token expiration:
* Pauses outgoing requests when a `401 Unauthorized` response is caught.
* Sends a single POST request to `/api/auth/refresh` to rotate the token.
* Pushes concurrent requests during active refresh operations into a promise queue, then resolves the queue with the new access token and retries them.

---

## 4. Socket.io Re-authentication

Sockets authenticate via access tokens during the handshake phase:
1. When the client refreshes its access token, it emits an `updateToken` socket event to update the server session statelessly.
2. The server decodes the new token, updates `socket.user`, and dynamically recalculates room memberships if a user's role has changed, preventing stale privilege leaks.
