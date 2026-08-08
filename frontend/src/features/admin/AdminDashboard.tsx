import React, { useState, useEffect, useRef } from 'react';
import { userApi } from '../../services/api/userApi';
import { adminApi } from '../../services/api/adminApi';
import { emergencyApi } from '../../services/api/emergencyApi';
import socketService from '../../services/socket/socketService';
import { User, Emergency, ResponderLocation, Analytics } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSpinner';

interface AdminDashboardProps {
  activeTab?: 'map' | 'users' | 'incidents';
  setActiveTab?: (tab: 'map' | 'users' | 'incidents') => void;
  showHeatmap?: boolean;
  setShowHeatmap?: (show: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  showHeatmap: propShowHeatmap,
  setShowHeatmap: propSetShowHeatmap,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'map' | 'users' | 'incidents'>('incidents');
  const activeTab = propActiveTab !== undefined ? propActiveTab : internalActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setInternalActiveTab;

  const [internalShowHeatmap, setInternalShowHeatmap] = useState(false);
  const showHeatmap = propShowHeatmap !== undefined ? propShowHeatmap : internalShowHeatmap;
  const setShowHeatmap = propSetShowHeatmap !== undefined ? propSetShowHeatmap : setInternalShowHeatmap;

  const { showNotification } = useNotification();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [incidents, setIncidents] = useState<Emergency[]>([]);
  
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Emergency | null>(null);
  
  const [responderList, setResponderList] = useState<ResponderLocation[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: number; name: string } | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const heatmapLayerRef = useRef<any>(null);
  
  // Track Leaflet markers
  const markersRef = useRef<{ [key: string]: any }>({});
  
  // Custom icons
  const sourceIconRef = useRef<any>(null);
  const destIconRef = useRef<any>(null);

  const L = (window as any).L;

  const loadData = async (silent = false) => {
    if (!silent) setDataLoading(true);
    try {
      const statsRes = await adminApi.getAnalytics();
      setStats(statsRes.data);
    } catch (e) {
      console.error('Failed to load stats', e);
    }

    try {
      const usersRes = await userApi.getUsers();
      setUsers(usersRes.data || []);
    } catch (e) {
      console.error('Failed to load users', e);
    }

    try {
      const emergenciesRes = await emergencyApi.getEmergencies();
      const list = emergenciesRes.data || [];
      setIncidents(list);
      updateIncidentMarkers(list);
      updateHeatmap(list);
    } catch (e) {
      console.error('Failed to load emergencies', e);
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  // Socket updates connection
  useEffect(() => {
    loadData();

    const unsubscribeNew = socketService.subscribe('newEmergency', () => {
      loadData();
    });

    const unsubscribeUpdate = socketService.subscribe('emergencyUpdate', () => {
      loadData();
    });

    const unsubscribeLocation = socketService.subscribe('responderLocationUpdate', (data: ResponderLocation) => {
      updateResponderMarker(data);
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
      unsubscribeLocation();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Map Initialization
  useEffect(() => {
    if (activeTab === 'map' && !mapInstanceRef.current && L) {
      initMap();
    } else if (activeTab === 'map' && mapInstanceRef.current) {
      // Leaflet needs to re-calculate its size when container becomes visible
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          fitToRelevantMarkers();
        }
      }, 100);
    }
  }, [activeTab]);

  const initMap = async () => {
    if (!L) return;

    try {
      // Load Leaflet plugins dynamically just as in Angular
      try {
        await import('leaflet.markercluster');
      } catch (err) {
        console.warn('leaflet.markercluster import warning', err);
      }
      try {
        await import('leaflet.heat');
      } catch (err) {
        console.warn('leaflet.heat import warning', err);
      }

      const map = L.map('adminMap').setView([0, 0], 2);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      // Setup Cluster Group
      try {
        clusterRef.current = (L as any).markerClusterGroup({ chunkedLoading: true });
        map.addLayer(clusterRef.current);
      } catch (err) {
        console.warn('leaflet.markercluster not available, adding directly to map', err);
        clusterRef.current = null;
      }

      // Labeled icons for Source / Destination
      sourceIconRef.current = L.divIcon({
        html: `<div class="marker-badge marker-source">S</div>`,
        className: 'marker-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      destIconRef.current = L.divIcon({
        html: `<div class="marker-badge marker-dest">D</div>`,
        className: 'marker-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      // Bind current incident markers & heatmap if loaded
      if (incidents.length > 0) {
        updateIncidentMarkers(incidents);
        updateHeatmap(incidents);
        map.setView([incidents[0].latitude, incidents[0].longitude], 12);
      }
    } catch (e) {
      console.error('Leaflet admin map initialization failed', e);
    }
  };

  const updateIncidentMarkers = (list: Emergency[]) => {
    if (!mapInstanceRef.current || !L) return;

    list.forEach((e) => {
      const key = `inc_${e.id}`;
      const lat = parseFloat(e.latitude as any);
      const lng = parseFloat(e.longitude as any);

      if (isNaN(lat) || isNaN(lng)) return;

      // Remove old marker
      if (markersRef.current[key]) {
        const old = markersRef.current[key];
        if (clusterRef.current) {
          clusterRef.current.removeLayer(old);
        } else {
          mapInstanceRef.current.removeLayer(old);
        }
      }

      let marker: any;
      const isSource = !!e.is_source;
      const isDest = !!e.is_destination;

      if (isSource || isDest) {
        const icon = isSource ? sourceIconRef.current : destIconRef.current;
        marker = L.marker([lat, lng], { icon });
        const labelText = isSource
          ? `Source: ${e.name || 'Dispatch Center'}`
          : `Destination: ${e.emergency_type || 'Incident Location'}`;
        marker.bindTooltip(labelText, {
          permanent: true,
          direction: 'right',
          className: 'marker-label',
        });
        marker.options.role = isSource ? 'source' : 'destination';
      } else {
        const color =
          e.status === 'escalated' ? 'red' : e.status === 'pending' ? 'orange' : 'blue';
        marker = L.circleMarker([lat, lng], {
          color,
          radius: 10,
          fillOpacity: 0.8,
        }).bindPopup(
          `<b>${(e.emergency_type || e.type || 'Incident').toUpperCase()}</b><br>Status: ${
            e.status
          }<br><small>${e.description || ''}</small>`
        );
        marker.options.role = 'incident';
      }

      if (clusterRef.current) {
        clusterRef.current.addLayer(marker);
      } else {
        marker.addTo(mapInstanceRef.current);
      }

      markersRef.current[key] = marker;
    });
  };

  const updateHeatmap = (list: Emergency[]) => {
    if (!mapInstanceRef.current || !L) return;

    if (heatmapLayerRef.current && mapInstanceRef.current.hasLayer(heatmapLayerRef.current)) {
      mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
    }

    const points = list
      .map((e) => {
        const lat = parseFloat(e.latitude as any);
        const lng = parseFloat(e.longitude as any);
        if (isNaN(lat) || isNaN(lng)) return null;
        return [lat, lng, e.status === 'escalated' ? 1.0 : 0.5];
      })
      .filter(Boolean) as [number, number, number][];

    try {
      heatmapLayerRef.current = (L as any).heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
      });

      if (showHeatmap) {
        heatmapLayerRef.current.addTo(mapInstanceRef.current);
      }
    } catch (err) {
      console.warn('Could not update Leaflet heatmap layer', err);
    }
  };

  useEffect(() => {
    if (mapInstanceRef.current && heatmapLayerRef.current) {
      if (showHeatmap) {
        if (!mapInstanceRef.current.hasLayer(heatmapLayerRef.current)) {
          heatmapLayerRef.current.addTo(mapInstanceRef.current);
        }
      } else {
        if (mapInstanceRef.current.hasLayer(heatmapLayerRef.current)) {
          mapInstanceRef.current.removeLayer(heatmapLayerRef.current);
        }
      }
    }
  }, [showHeatmap]);

  const toggleHeatmap = () => {
    setShowHeatmap(!showHeatmap);
  };

  const updateResponderMarker = (data: ResponderLocation) => {
    if (!mapInstanceRef.current || !L) return;

    const key = `res_${data.responderId}`;
    const lat = parseFloat(data.latitude as any);
    const lng = parseFloat(data.longitude as any);

    if (isNaN(lat) || isNaN(lng)) return;

    // Save previous coordinates for animation
    let prevCoords: [number, number] | null = null;
    
    // Remove old marker
    if (markersRef.current[key]) {
      const old = markersRef.current[key];
      const oldLatLng = old.getLatLng();
      prevCoords = [oldLatLng.lat, oldLatLng.lng];

      if (clusterRef.current) {
        clusterRef.current.removeLayer(old);
      } else {
        mapInstanceRef.current.removeLayer(old);
      }
    }

    const role = data.role || '';
    const bg =
      role === 'police'
        ? '#0ea5a4'
        : role === 'fire'
        ? '#ef4444'
        : role === 'ambulance'
        ? '#6366f1'
        : '#f97316';

    const html = `<div style="background:${bg};width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${
      data.name ? data.name[0] : 'R'
    }</div>`;

    const icon = L.divIcon({
      html,
      className: 'responder-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([lat, lng], { icon }).bindPopup(
      `<b>${data.name || 'Responder'}</b><br>ID: ${data.responderId}<br>Role: ${
        role || '—'
      }<br>Updated: ${new Date((data.ts || Date.now() / 1000) * 1000).toLocaleString()}`
    );

    if (clusterRef.current) {
      clusterRef.current.addLayer(marker);
    } else {
      marker.addTo(mapInstanceRef.current);
    }

    markersRef.current[key] = marker;

    // Interpolate marker transition if coordinates changed
    if (prevCoords) {
      animateMarker(marker, prevCoords, [lat, lng], 800);
    }

    // Update responder list state
    setResponderList((prev) => {
      const existingIdx = prev.findIndex((r) => r.responderId === data.responderId);
      const entry = { ...data, latitude: lat, longitude: lng };
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = entry;
        return updated;
      } else {
        const updated = [entry, ...prev];
        if (updated.length > 50) {
          updated.pop();
        }
        return updated;
      }
    });
  };

  const animateMarker = (
    marker: any,
    from: [number, number],
    to: [number, number],
    duration = 800
  ) => {
    if (!marker || !mapInstanceRef.current) return;
    const start = { lat: from[0], lng: from[1] };
    const end = { lat: to[0], lng: to[1] };
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      
      if (marker && marker.setLatLng) {
        marker.setLatLng([lat, lng]);
      }
      
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (marker && marker.setLatLng) {
        marker.setLatLng([end.lat, end.lng]);
        if (clusterRef.current && typeof clusterRef.current.refreshClusters === 'function') {
          clusterRef.current.refreshClusters();
        }
      }
    };

    requestAnimationFrame(step);
  };

  const fitToRelevantMarkers = () => {
    if (!mapInstanceRef.current || !L) return;

    const pts: any[] = [];
    const srcDstPts: any[] = [];

    Object.keys(markersRef.current).forEach((k) => {
      const m = markersRef.current[k];
      if (!m) return;
      const latlng = typeof m.getLatLng === 'function' ? m.getLatLng() : null;
      if (!latlng) return;
      pts.push(latlng);
      const role = m.options?.role;
      if (role === 'source' || role === 'destination') {
        srcDstPts.push(latlng);
      }
    });

    const toUse = srcDstPts.length >= 2 ? srcDstPts : pts.length ? pts : null;
    if (toUse && toUse.length > 0) {
      try {
        const bounds = L.latLngBounds(toUse);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      } catch (err) {
        console.warn('fitToRelevantMarkers failed', err);
      }
    }
  };

  const centerOnResponder = (responderId: number) => {
    const key = `res_${responderId}`;
    const marker = markersRef.current[key];
    if (marker && mapInstanceRef.current) {
      mapInstanceRef.current.setView(marker.getLatLng(), 15, { animate: true });
      marker.openPopup();
    } else {
      const r = responderList.find((rr) => rr.responderId === responderId);
      if (r && mapInstanceRef.current) {
        mapInstanceRef.current.setView([r.latitude, r.longitude], 15, { animate: true });
      }
    }
  };

  const fitAll = () => {
    if (!mapInstanceRef.current || !L) return;
    const latlngs: any[] = [];
    Object.keys(markersRef.current).forEach((k) => {
      const m = markersRef.current[k];
      if (m && typeof m.getLatLng === 'function') {
        latlngs.push(m.getLatLng());
      }
    });

    if (latlngs.length === 0 && incidents.length > 0) {
      latlngs.push(...incidents.map((i) => L.latLng(i.latitude, i.longitude)));
    }

    if (latlngs.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60] });
    }
  };

  const handleRoleChange = async (userId: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    try {
      await userApi.updateUserRole(userId, newRole);
      showNotification('success', `User role successfully changed to ${newRole}`, 'Change Role');
      loadData(true);
    } catch (err: any) {
      console.error('Failed to change role', err);
      showNotification('error', err?.response?.data?.message || err.message || 'Failed to update user role', 'Change Role');
    }
  };

  const approve = async (id: number) => {
    try {
      await userApi.approveUser(id);
      showNotification('success', 'Responder credentials approved successfully', 'Responder Approval');
      loadData(true);
    } catch (err: any) {
      console.error('Failed to approve user', err);
      showNotification('error', err?.response?.data?.message || err.message || 'Failed to approve responder', 'Responder Approval');
    }
  };

  const deleteUser = async (id: number, name: string) => {
    setConfirmDeleteUser({ id, name });
  };

  const executeDeleteUser = async (id: number) => {
    try {
      await userApi.deleteUser(id);
      showNotification('success', 'User deleted successfully', 'Delete User');
      loadData(true);
    } catch (err: any) {
      const detail =
        err?.response?.data?.details || err?.response?.data?.message || err.message || err;
      showNotification('error', 'Failed to delete user: ' + detail, 'Delete User');
    }
  };

  const isImage = (url?: string): boolean => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(url);
  };

  const isVideo = (url?: string): boolean => {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  };

  const openMedia = (url?: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = roleFilter ? u.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="admin-wrapper">
      {/* Analytics Overview */}
      {stats && (
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-soft-primary">🚨</div>
            <div className="stat-content">
              <span className="stat-label">Total Requests</span>
              <h2 className="stat-value">{stats.totalEmergencies}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-soft-danger">🔥</div>
            <div className="stat-content">
              <span className="stat-label">Escalated</span>
              <h2 className="stat-value text-danger">{stats.statusCounts.escalated}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-soft-info">🚑</div>
            <div className="stat-content">
              <span className="stat-label">Active Responders</span>
              <h2 className="stat-value text-info">{stats.responderStats.total}</h2>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-soft-warning">⏳</div>
            <div className="stat-content">
              <span className="stat-label">Pending Approval</span>
              <h2 className="stat-value text-warning">{stats.responderStats.pendingApproval}</h2>
            </div>
          </div>
        </section>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidents')}
          >
            📋 Incident Logs
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            📍 Live Tracking
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 User Management
          </button>
        </li>
      </ul>

      {/* Map Tab */}
      <div style={{ display: activeTab === 'map' ? 'block' : 'none' }}>
        <div className="mb-2 d-flex gap-2">
          <button
            className={`btn btn-sm ${showHeatmap ? 'btn-dark' : 'btn-outline-dark'}`}
            onClick={toggleHeatmap}
          >
            {showHeatmap ? '🔥 Hide Heatmap' : '🔥 Show Heatmap'}
          </button>
          <button className="btn btn-sm btn-outline-dark" onClick={fitAll}>
            🔍 Fit All Markers
          </button>
        </div>
        
        <div style={{ position: 'relative' }}>
          <div id="adminMap" style={{ height: '600px', borderRadius: '12px', width: '100%' }}></div>
          
          {responderList.length > 0 && (
            <div className="map-overlay card p-2 shadow">
              <h5 className="border-bottom pb-1 mb-2">Live Responders</h5>
              {responderList.map((res) => (
                <div
                  key={res.responderId}
                  className="responder-row d-flex align-items-center justify-content-between"
                  style={{ gap: '0.5rem', padding: '6px 0' }}
                >
                  <div className="d-flex align-items-center" style={{ gap: '0.5rem' }}>
                    <div className="responder-avatar">
                      {res.name ? res.name[0] : 'R'}
                    </div>
                    <div>
                      <div className="small fw-bold">{res.name || `Id: ${res.responderId}`}</div>
                      <div className="smallest text-muted">{res.role || '—'}</div>
                    </div>
                  </div>
                  <button
                    className="btn btn-xs btn-outline-primary"
                    onClick={() => centerOnResponder(res.responderId)}
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                  >
                    Center
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div className="toolbar card mb-3 p-3">
            <div className="row g-2">
              <div className="col-md-6">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="citizen">Citizen</option>
                  <option value="police">Police</option>
                  <option value="fire">Fire</option>
                  <option value="ambulance">Ambulance</option>
                </select>
              </div>
            </div>
          </div>

          {dataLoading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="table-responsive card glass-panel">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th>User Details</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="avatar-sm me-2">{u.name ? u.name[0] : '?'}</div>
                        <div>
                          <div className="fw-bold">{u.name}</div>
                          <div className="text-muted small">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm w-auto shadow-none"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e)}
                      >
                        <option value="citizen">Citizen</option>
                        <option value="police">Police</option>
                        <option value="ambulance">Ambulance</option>
                        <option value="fire">Fire</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          u.approval_status === 'approved' ? 'bg-success' : 'bg-warning'
                        }`}
                      >
                        {u.approval_status || 'N/A'}
                      </span>
                    </td>
                    <td className="text-end">
                      {u.approval_status === 'pending' && (
                        <button className="btn btn-sm btn-primary me-1" onClick={() => approve(u.id)}>
                          Approve
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteUser(u.id, u.name)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center p-5 text-muted">
                      No users found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        dataLoading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="table-responsive card glass-panel">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Incident</th>
                  <th>Citizen</th>
                  <th style={{ width: '25%' }}>Details</th>
                  <th>Status</th>
                  <th>Evidence</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="fw-bold">#{e.id}</div>
                      <span className="badge bg-dark">
                        {(e.emergency_type || e.type || '').toUpperCase()}
                      </span>
                    </td>
                    <td>{e.citizen_name || `User #${e.citizen_id}`}</td>
                    <td>
                      <div className="text-truncate" style={{ maxWidth: '250px' }} title={e.description}>
                        <small className="text-secondary">{e.description || 'No description provided.'}</small>
                      </div>
                      <div className="text-muted smallest">
                        {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          e.status === 'escalated'
                            ? 'bg-danger'
                            : e.status === 'pending'
                            ? 'bg-warning'
                            : e.status === 'in_progress'
                            ? 'bg-primary'
                            : 'bg-success'
                        }`}
                      >
                        {(e.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {(e.media_url || e.mediaUrl) ? (
                        <div className="media-frame">
                          {isImage(e.media_url || e.mediaUrl) && (
                            <img
                              src={e.media_url || e.mediaUrl}
                              className="media-thumb"
                              alt="thumb"
                              onClick={() => openMedia(e.media_url || e.mediaUrl)}
                            />
                          )}
                          {isVideo(e.media_url || e.mediaUrl) && (
                            <video src={e.media_url || e.mediaUrl} className="media-thumb" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted smallest">None</span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        title="View Details"
                        onClick={() => setSelectedIncident(e)}
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div
            className="modal-content card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2">
              <h3 className="m-0 text-primary">Incident #{selectedIncident.id} Details</h3>
              <button className="btn-close" onClick={() => setSelectedIncident(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <p className="mb-1">
                  <strong>Type:</strong>{' '}
                  <span className="badge bg-dark ms-2">
                    {(selectedIncident.emergency_type || selectedIncident.type || '').toUpperCase()}
                  </span>
                </p>
                <p className="mb-1">
                  <strong>Status:</strong>{' '}
                  <span
                    className={`badge ms-2 ${
                      selectedIncident.status === 'escalated'
                        ? 'bg-danger'
                        : selectedIncident.status === 'pending'
                        ? 'bg-warning'
                        : selectedIncident.status === 'in_progress'
                        ? 'bg-primary'
                        : 'bg-success'
                    }`}
                  >
                    {(selectedIncident.status || '').toUpperCase()}
                  </span>
                </p>
                <p className="mb-1">
                  <strong>Reported By:</strong>{' '}
                  {selectedIncident.citizen_name || `User #${selectedIncident.citizen_id}`}
                </p>
                <p className="mb-1">
                  <strong>Responder:</strong> {selectedIncident.responder_name || 'Not Assigned'}
                </p>
                <p className="mb-1">
                  <strong>Created At:</strong>{' '}
                  {selectedIncident.created_at
                    ? new Date(selectedIncident.created_at).toLocaleString()
                    : '—'}
                </p>
              </div>
              <div className="col-md-6 mb-3 border-start">
                <p className="mb-1">
                  <strong>Location (Lat, Lng):</strong> {selectedIncident.latitude},{' '}
                  {selectedIncident.longitude}
                </p>
                <p className="mb-1">
                  <strong>Description:</strong>
                </p>
                <p className="text-secondary small p-2 bg-light rounded">
                  {selectedIncident.description || 'No description provided.'}
                </p>
              </div>
            </div>
            {(selectedIncident.media_url || selectedIncident.mediaUrl) && (
              <div className="mt-3">
                <p className="mb-2">
                  <strong>Evidence Attachment:</strong>
                </p>
                <div className="media-container text-center bg-dark p-2 rounded shadow-inner">
                  {isImage(selectedIncident.media_url || selectedIncident.mediaUrl) && (
                    <img
                      src={selectedIncident.media_url || selectedIncident.mediaUrl}
                      className="img-fluid rounded"
                      alt="evidence detail"
                      style={{ maxHeight: '400px', objectFit: 'contain' }}
                    />
                  )}
                  {isVideo(selectedIncident.media_url || selectedIncident.mediaUrl) && (
                    <video
                      src={selectedIncident.media_url || selectedIncident.mediaUrl}
                      className="img-fluid rounded"
                      controls
                      style={{ maxHeight: '400px' }}
                    />
                  )}
                </div>
              </div>
            )}
            <div className="mt-4 text-end">
              <button className="btn btn-secondary px-4" onClick={() => setSelectedIncident(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteUser && (
        <ConfirmDialog
          title="Delete User Account"
          message={`Are you sure you want to delete user '${confirmDeleteUser.name}'? This cannot be undone and will permanently remove all associated user files, reports, and logs.`}
          confirmLabel="Delete User"
          confirmClass="btn-danger"
          onConfirm={() => {
            executeDeleteUser(confirmDeleteUser.id);
            setConfirmDeleteUser(null);
          }}
          onCancel={() => setConfirmDeleteUser(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
