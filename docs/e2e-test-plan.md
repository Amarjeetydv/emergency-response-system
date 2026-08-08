# ERCS E2E Verification Plan

This document maps the complete manual and automated end-to-end verification workflows for the **Emergency Response Coordination System (ERCS)**.

---

## 1. Citizen Workflow

Verify the complete citizen lifecycle:
1. **Registration:**
   - Navigate to `/register`.
   - Complete registration using role `Citizen`.
   - Confirm redirects to `/login` upon success.
2. **Login:**
   - Sign in with credentials.
   - Confirm redirect to `/dashboard`.
3. **Location Permission:**
   - Browser asks for location. Allow permission.
   - Verify coordinate status displays `Location detected` with dynamic coordinates.
4. **Emergency Creation:**
   - Select emergency category (e.g. `medical`, `fire`, `police`).
   - Enter descriptive context.
   - Attach file evidence (image/video < 5MB).
   - Click submit.
5. **Incident Tracking:**
   - Verify card displays under active requests.
   - Verify card status displays `Pending`.

---

## 2. Responder Workflow

Verify responder transitions:
1. **Registration & Approval:**
   - Register account as a Responder (e.g. `Police`).
   - Note state is initially set to `pending`.
   - Log in as Admin, navigate to user management, and approve the responder account.
2. **Login:**
   - Sign in with responder credentials.
   - Verify panel displays active leaflet maps and dispatches feed.
3. **Claiming:**
   - Review pending incident lists.
   - Tick the consent agreement checklist, then click `Claim`.
   - Verify status transitions to `Accepted`.
4. **Lifecycle Progress:**
   - Click `Start Response`. Verify status updates to `In Progress`.
   - Click `Complete`. Verify status updates to `Completed`.

---

## 3. Administrative Workflows

Verify administration controls:
1. **Operational Metrics:**
   - Verify dashboard counters calculate active, pending, and total logs.
2. **User Management:**
   - Toggle approval states for responders.
   - Delete test profiles using confirm modals.

---

## 4. Security Verification

Verify protection boundaries:
1. **Rate Limiting:** Query login endpoint rapidly. Verify `429 Too Many Requests` is returned.
2. **Session Rotation:** Confirm browser refresh cookie updates during API calls.
3. **File size bounds:** Attempt uploading a 6MB file. Verify browser and server reject it.
