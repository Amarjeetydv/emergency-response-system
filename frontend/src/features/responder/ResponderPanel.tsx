import React, { useState, useEffect, useRef } from 'react';
import { emergencyApi } from '../../services/api/emergencyApi';
import socketService from '../../services/socket/socketService';
import { useAuth } from '../../context/AuthContext';
import { Emergency } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSpinner';

export const ResponderPanel: React.FC = () => {
  const { showNotification } = useNotification();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [trackLocation, setTrackLocation] = useState(false);
  const [processingMap, setProcessingMap] = useState<{ [key: number]: boolean }>({});
  const [consentMap, setConsentMap] = useState<{ [key: number]: boolean }>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [confirmCompleteIncident, setConfirmCompleteIncident] = useState<Emergency | null>(null);
  
  const { user } = useAuth();
  const userId = user?.id ?? 0;

  const geoWatchIdRef = useRef<number | undefined>(undefined);

  const fetchEmergencies = async (silent = false) => {
    if (!silent) setDataLoading(true);
    try {
      const response = await emergencyApi.getEmergencies();
      setEmergencies(response.data || []);
    } catch (err) {
      console.error('Failed to load emergencies in responder panel', err);
      setEmergencies([]);
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencies();

    // Subscribe to live socket updates
    const unsubscribeNew = socketService.subscribe('newEmergency', (row: Emergency) => {
      if (!row?.id) return;
      setEmergencies((prev) => {
        const idx = prev.findIndex((x) => x.id === row.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = row;
          return updated;
        } else {
          return [row, ...prev];
        }
      });
    });

    const unsubscribeUpdate = socketService.subscribe('emergencyUpdate', (row: Emergency) => {
      if (!row?.id) return;
      setEmergencies((prev) => {
        const idx = prev.findIndex((x) => x.id === row.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = row;
          return updated;
        } else {
          return [row, ...prev];
        }
      });
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
      if (geoWatchIdRef.current !== undefined) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, []);

  const accept = (e: Emergency) => {
    console.log(`[Accept] Initiating for Emergency ID: ${e.id}`);
    
    if (!consentMap[e.id]) {
      console.warn(`[Accept] Consent not granted for ID: ${e.id}`);
      showNotification('warning', 'Please check the location sharing agreement first.', 'Location Consent');
      return;
    }

    setProcessingMap((prev) => ({ ...prev, [e.id]: true }));

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      finalizeAccept(e, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[Geolocation] Success:', pos.coords);
        finalizeAccept(e, pos);
      },
      (err) => {
        console.warn('[Geolocation] Error/Denied:', err.message);
        finalizeAccept(e, null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const finalizeAccept = async (e: Emergency, pos: GeolocationPosition | null) => {
    const payload: any = { request_id: e.id };
    if (pos) {
      payload.responder_lat = pos.coords.latitude;
      payload.responder_lng = pos.coords.longitude;
    }

    try {
      await emergencyApi.acceptEmergencyRequest(payload);
      console.log(`[Accept] API Success for ID: ${e.id}`);
      setProcessingMap((prev) => ({ ...prev, [e.id]: false }));
      
      if (pos) {
        socketService.emitResponderLocation({
          responderId: userId,
          name: user?.name,
          role: user?.role,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }

      showNotification('success', 'Emergency request accepted. Dispatching...', 'Accept Request');
      fetchEmergencies(true);
    } catch (err: any) {
      console.error('[Accept] API Error:', err);
      setProcessingMap((prev) => ({ ...prev, [e.id]: false }));
      const detail = err?.response?.data?.message || err?.message || 'Failed to accept request. Please try again.';
      showNotification('error', detail, 'Accept Request');
    }
  };

  const startProgress = async (e: Emergency) => {
    setProcessingMap((prev) => ({ ...prev, [e.id]: true }));
    try {
      await emergencyApi.updateStatus(e.id, { status: 'in_progress' });
      showNotification('success', 'Incident status updated to In Progress', 'Start Progress');
      fetchEmergencies(true);
    } catch (err: any) {
      console.error('Failed to start progress', err);
      setProcessingMap((prev) => ({ ...prev, [e.id]: false }));
      showNotification('error', err?.response?.data?.message || err.message || 'Failed to start progress', 'Start Progress');
    }
  };

  const complete = async (e: Emergency) => {
    setConfirmCompleteIncident(e);
  };

  const executeCompleteIncident = async (id: number) => {
    setProcessingMap((prev) => ({ ...prev, [id]: true }));
    try {
      await emergencyApi.updateStatus(id, { status: 'completed' });
      showNotification('success', 'Incident marked completed successfully', 'Complete Incident');
      fetchEmergencies(true);
    } catch (err: any) {
      console.error('Failed to complete request', err);
      setProcessingMap((prev) => ({ ...prev, [id]: false }));
      showNotification('error', err?.response?.data?.message || err.message || 'Failed to complete request', 'Complete Incident');
    }
  };

  const toggleSharing = () => {
    const newTrackValue = !trackLocation;
    setTrackLocation(newTrackValue);

    if (!newTrackValue && geoWatchIdRef.current !== undefined) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = undefined;
      return;
    }

    if (!navigator.geolocation || !userId) return;

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        socketService.emitResponderLocation({
          responderId: userId,
          name: user?.name,
          role: user?.role,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const isAssigned = (e: Emergency): boolean => {
    return e.assigned_responder === userId;
  };

  const canAccept = (e: Emergency): boolean => {
    return e.status === 'pending';
  };

  const canStart = (e: Emergency): boolean => {
    return e.status === 'accepted' && isAssigned(e);
  };

  const canComplete = (e: Emergency): boolean => {
    return e.status === 'in_progress' && isAssigned(e);
  };

  const formatStatus = (s: string): string => {
    return (s || '').replace(/_/g, ' ');
  };

  return (
    <div className="responder-panel">
      <div className="panel-header">
        <h3>Active Emergency Requests</h3>
        <button
          onClick={toggleSharing}
          className={`btn-track ${trackLocation ? 'active' : ''}`}
        >
          {trackLocation ? '🛑 Stop Global Tracking' : '📍 Enable Live Tracking'}
        </button>
      </div>

      <div className="emergency-list">
        {dataLoading ? (
          <LoadingSkeleton rows={3} />
        ) : emergencies.length === 0 ? (
          <div className="empty-state card glass-panel text-center p-5 text-muted">
            No active emergencies found in your region.
          </div>
        ) : (
          emergencies.map((e) => (
          <div
            key={e.id}
            className={`emergency-card ${isAssigned(e) ? 'assigned-to-me' : ''}`}
          >
            <div className="card-info">
              <strong>#{e.id} - {(e.emergency_type || '').toUpperCase()}</strong>
              <p>
                {e.latitude}, {e.longitude}
              </p>
              <div className="status-badge" data-status={e.status}>
                {formatStatus(e.status)}
              </div>
            </div>

            <div className="card-actions">
              {/* SHOW ACCEPT BUTTON ONLY FOR PENDING */}
              {canAccept(e) && (
                <div className="accept-workflow">
                  <div className="consent-box">
                    <input
                      type="checkbox"
                      id={`share-${e.id}`}
                      checked={!!consentMap[e.id]}
                      onChange={(evt) =>
                        setConsentMap((prev) => ({ ...prev, [e.id]: evt.target.checked }))
                      }
                    />
                    <label htmlFor={`share-${e.id}`}>Share location for this dispatch</label>
                  </div>
                  <button
                    onClick={() => accept(e)}
                    className="btn-accept"
                    disabled={!consentMap[e.id] || processingMap[e.id]}
                  >
                    {processingMap[e.id] ? '⌛ Processing...' : '🚨 Accept Request'}
                  </button>
                </div>
              )}

              {/* SHOW "ACCEPTED" FEEDBACK */}
              {e.status === 'accepted' && isAssigned(e) && (
                <button className="btn-feedback accepted" disabled>
                  ✅ Accepted
                </button>
              )}

              {/* SUBSEQUENT ACTIONS */}
              {canStart(e) && (
                <button
                  onClick={() => startProgress(e)}
                  className="btn-action"
                  disabled={processingMap[e.id]}
                >
                  {processingMap[e.id] ? '⌛ Updating...' : '🚀 Start Progress'}
                </button>
              )}
              {canComplete(e) && (
                <button
                  onClick={() => complete(e)}
                  className="btn-action success"
                  disabled={processingMap[e.id]}
                >
                  {processingMap[e.id] ? '⌛ Updating...' : '🏁 Complete'}
                </button>
              )}

            </div>
          </div>
        ))
        )}
      </div>

      {confirmCompleteIncident && (
        <ConfirmDialog
          title="Complete Emergency Request"
          message={`Are you sure you want to mark incident #${confirmCompleteIncident.id} as completed? This will close the incident status and release responder dispatches.`}
          confirmLabel="Complete"
          confirmClass="btn-success"
          onConfirm={() => {
            executeCompleteIncident(confirmCompleteIncident.id);
            setConfirmCompleteIncident(null);
          }}
          onCancel={() => setConfirmCompleteIncident(null)}
        />
      )}
    </div>
  );
};

export default ResponderPanel;
