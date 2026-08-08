import React, { useState, useEffect } from 'react';
import { emergencyApi } from '../../services/api/emergencyApi';
import socketService from '../../services/socket/socketService';
import EmergencyRequest from './EmergencyRequest';
import { Emergency } from '../../types';

interface CitizenPanelProps {
  onReportCreated?: (report: any) => void;
}

export const CitizenPanel: React.FC<CitizenPanelProps> = ({ onReportCreated }) => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);

  const fetchEmergencies = async () => {
    try {
      const response = await emergencyApi.getEmergencies();
      setEmergencies(response.data || []);
    } catch (err) {
      console.error('Failed to fetch emergencies in citizen panel', err);
      setEmergencies([]);
    }
  };

  useEffect(() => {
    fetchEmergencies();

    // Subscribe to real-time events to refresh list
    const unsubscribeNew = socketService.subscribe('newEmergency', () => {
      fetchEmergencies();
    });

    const unsubscribeUpdate = socketService.subscribe('emergencyUpdate', () => {
      fetchEmergencies();
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, []);

  const handleSubmitted = (report: any) => {
    if (report?.id) {
      const exists = emergencies.some((item) => item.id === report.id);
      if (!exists) {
        setEmergencies((prev) => [report, ...prev]);
      }
    }
    if (onReportCreated) {
      onReportCreated(report);
    }
    fetchEmergencies();
  };

  const handleCancel = async (id: number) => {
    try {
      await emergencyApi.updateStatus(id, { status: 'cancelled' });
      fetchEmergencies();
    } catch (err) {
      console.error('Failed to cancel emergency request', err);
    }
  };

  return (
    <div className="citizen-panel">
      <section className="report-section">
        <EmergencyRequest embedMode={true} onSubmitted={handleSubmitted} />
      </section>

      <section className="list-section">
        <h3>Your requests</h3>
        <p className="hint">Statuses update live: Pending → Accepted → In progress → Completed.</p>
        
        {emergencies.length === 0 ? (
          <div className="empty">No requests yet.</div>
        ) : (
          <ul className="request-list">
            {emergencies.map((e) => (
              <li key={e.id} className="request-card">
                <div className="row">
                  <span className="type">{e.emergency_type}</span>
                  <span className="status" data-status={e.status}>
                    {e.status}
                  </span>
                </div>
                <div className="meta">
                  {Number(e.latitude || 0).toFixed(4)}, {Number(e.longitude || 0).toFixed(4)}
                  {e.responder_name && <span> · Responder: {e.responder_name}</span>}
                </div>
                {['pending', 'accepted', 'in_progress'].includes(e.status) && (
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => handleCancel(e.id)}
                  >
                    Cancel request
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default CitizenPanel;
