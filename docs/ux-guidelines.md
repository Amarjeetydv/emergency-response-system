# ERCS UI & UX Guidelines

This document outlines the patterns and guidelines established in Phase 4 to maintain a consistent, accessible, and user-friendly experience across the Emergency Response Coordination System (ERCS).

---

## 1. Notification (Toast) Patterns

Native browser alerts (`alert()`) are disabled. Instead, use the `showNotification` trigger from the `useNotification` context hook:

```typescript
const { showNotification } = useNotification();

// Formats
showNotification('success', 'Request processed successfully', 'Header Title');
showNotification('error', 'Operation failed detail', 'Header Title');
showNotification('warning', 'Agreement verification failed', 'Header Title');
showNotification('info', 'Incident state updated', 'Header Title');
```

- **Placement:** Renders in the top-right corner of the viewport.
- **Lifetime:** Toasts fade out automatically after 4 seconds, or can be closed manually using the close button.
- **Accessibility:** Configured with `role="alert"` and `aria-live="polite"`.

---

## 2. Confirmation Dialog (Modal) Patterns

Native browser confirms (`confirm()`) are replaced by the focus-trapped `<ConfirmDialog>` component located in `components/common/ConfirmDialog.tsx`.
- **Requirements:**
  - Must clearly outline the record or action affected.
  - Buttons must display explicit actions (e.g. `"Delete User"`, `"Complete"`, `"Cancel"`), not generic `"OK"`.
  - Closing modal via `Escape` key must cancel the operation.
  - Tabbing through button controls must trap focus inside the modal overlay.

---

## 3. Loading & Async Feedback Patterns

All async request channels must display visual indicators to block duplicate operations and indicate execution:
- **Buttons:** Disable during request (`disabled={isSubmitting}`).
- **Feeds/Lists:** Render `<LoadingSkeleton />` placeholder components inside tables and feed queues while API results load.

---

## 4. Location Auto-Sensing UX States

Geolocation sharing indicators must display active progress:
- `'detecting'`: ⏳ Detecting location... (Locating GPS satellite coords).
- `'detected'`: 📍 Location detected (Marker placed on map coordinates).
- `'failed'`: ⚠️ Location sharing unavailable. Set manually. (Fallback option).

---

## 5. File Upload Restrictions

- **Size Limits:** Enforce maximum size validation checks at **5MB** to align client limits with server-side payload safety boundaries.
- **Format Warnings:** Prompt users with explicit toast warnings if they attempt to load files with forbidden formats.
