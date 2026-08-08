import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { emergencyApi } from '../services/api/emergencyApi';
import { adminApi } from '../services/api/adminApi';
import socketService from '../services/socket/socketService';
import AdminDashboard from '../features/admin/AdminDashboard';
import CitizenPanel from '../features/citizen/CitizenPanel';
import ResponderPanel from '../features/responder/ResponderPanel';
import { Emergency, Analytics } from '../types';
import { NotificationProvider } from '../context/NotificationContext';

const DashboardContent: React.FC = () => {
  const { user, logout } = useAuth();
  const role = user?.role || 'citizen';
  const [socketStatus, setSocketStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    const unsubscribeStatus = socketService.onStatusChange((status) => {
      setSocketStatus(status);
    });
    return () => {
      unsubscribeStatus();
    };
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedSection, setSelectedSection] = useState<'overview' | 'admin-tools' | 'my-reports'>('overview');
  const [selectedAdminTab, setSelectedAdminTab] = useState<'map' | 'users' | 'incidents'>('incidents');
  const [adminHeatmap, setAdminHeatmap] = useState(false);
  
  const [stats, setStats] = useState<Analytics | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStatsLastRefreshed, setAdminStatsLastRefreshed] = useState<Date | null>(null);
  
  const [myReports, setMyReports] = useState<Emergency[]>([]);

  const isApprovedResponder = () => {
    if (!user) return false;
    if (role === 'responder' || role === 'dispatcher') return true;
    if (['police', 'fire', 'ambulance'].includes(role)) {
      return user.approval_status === 'approved';
    }
    return false;
  };

  const showResponder = isApprovedResponder();

  const loadAdminStats = async () => {
    setAdminStatsLoading(true);
    try {
      const response = await adminApi.getAnalytics();
      setStats(response.data);
      setAdminStatsLastRefreshed(new Date());
    } catch (e) {
      console.error('Failed to load admin stats', e);
      setStats(null);
    } finally {
      setAdminStatsLoading(false);
    }
  };

  const loadPersonalReports = async () => {
    if (!user) return;
    const userId = user.id;
    try {
      const response = await emergencyApi.getEmergencies();
      const list = response.data || [];
      const reports = list.filter((row: any) => {
        if (role === 'citizen') {
          return (
            row.citizen_id === userId ||
            row.citizenId === userId ||
            row.user_id === userId ||
            row.userId === userId
          );
        }
        return true;
      });
      setMyReports(reports);
    } catch (e) {
      console.error('Failed to load personal reports', e);
      setMyReports([]);
    }
  };

  useEffect(() => {
    setIsCollapsed(window.innerWidth <= 768);
    loadPersonalReports();
    if (role === 'admin') {
      loadAdminStats();
    }

    // Subscribe to live updates
    const unsubscribeNew = socketService.subscribe('newEmergency', () => {
      if (role === 'citizen') {
        loadPersonalReports();
      }
      if (role === 'admin') {
        loadAdminStats();
      }
    });

    const unsubscribeUpdate = socketService.subscribe('emergencyUpdate', () => {
      if (role === 'citizen') {
        loadPersonalReports();
      }
      if (role === 'admin') {
        loadAdminStats();
      }
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, [role]);

  const setSection = (section: 'overview' | 'admin-tools' | 'my-reports') => {
    setSelectedSection(section);
    if (window.innerWidth <= 768) {
      setIsCollapsed(true);
    }
  };

  const getReportStats = () => {
    const counts = { total: myReports.length, pending: 0, accepted: 0, completed: 0 };
    for (const report of myReports) {
      const status = String(report.status || '').toLowerCase();
      if (status === 'pending' || status === 'escalated') counts.pending += 1;
      if (status === 'accepted' || status === 'in_progress') counts.accepted += 1;
      if (status === 'completed' || status === 'cancelled') counts.completed += 1;
    }
    return counts;
  };

  const downloadMyReports = () => {
    if (!myReports.length) return;

    const header = ['id', 'type', 'status', 'latitude', 'longitude', 'responder', 'created_at'];
    const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = myReports.map((report) => [
      report.id,
      report.emergency_type || report.type || '',
      report.status || '',
      report.latitude ?? '',
      report.longitude ?? '',
      report.responder_name || '',
      report.created_at || '',
    ]);

    const csv = [
      header.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openAdminTool = (key: string) => {
    setSelectedSection('admin-tools');
    
    if (key === 'map') {
      setSelectedAdminTab('map');
    } else if (key === 'incidents') {
      setSelectedAdminTab('incidents');
    } else if (key === 'users') {
      setSelectedAdminTab('users');
    } else if (key === 'heatmap') {
      setSelectedAdminTab('map');
      setAdminHeatmap(true);
    } else if (key === 'refresh') {
      loadAdminStats();
    }

    setTimeout(() => {
      const host = document.getElementById('adminDashboardHost');
      if (host) {
        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleReportCreated = () => {
    loadPersonalReports();
    if (role === 'admin') {
      loadAdminStats();
    }
  };

  const adminTools = [
    {
      key: 'map',
      title: 'Live Tracking',
      description: 'Open the map, inspect active markers, and follow responders in real time.',
      icon: '📍',
    },
    {
      key: 'incidents',
      title: 'Incident Queue',
      description: 'Review open, escalated, and completed incidents from one place.',
      icon: '🚨',
    },
    {
      key: 'users',
      title: 'User Management',
      description: 'Approve responders, change roles, and keep accounts in good standing.',
      icon: '👥',
    },
    {
      key: 'heatmap',
      title: 'Heatmap View',
      description: 'Toggle density view to identify hotspots and repeated calls.',
      icon: '🔥',
    },
    {
      key: 'refresh',
      title: 'Refresh Data',
      description: 'Pull the latest incidents, users, and analytics in one click.',
      icon: '🔄',
    },
  ];

  const activeAdminTool = adminTools.find((tool) => {
    if (selectedAdminTab === 'map' && adminHeatmap) return tool.key === 'heatmap';
    if (selectedAdminTab === 'map') return tool.key === 'map';
    return tool.key === selectedAdminTab;
  }) || adminTools[0];

  return (
    <div className={`app-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar Navigation */}
      <aside className="side-nav">
        <div className="nav-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">ERCS Pro</span>
        </div>

        <div className="nav-menu">
          <div className="menu-label">Main Menu</div>
          <button
            className={`menu-item menu-button ${selectedSection === 'overview' ? 'active' : ''}`}
            onClick={() => setSection('overview')}
          >
            📊 Dashboard
          </button>
          {role === 'admin' && (
            <button
              className={`menu-item menu-button ${selectedSection === 'admin-tools' ? 'active' : ''}`}
              onClick={() => setSection('admin-tools')}
            >
              🛡️ Admin Portal Tools
            </button>
          )}
          {(role === 'citizen' || showResponder) && (
            <button
              className={`menu-item menu-button ${selectedSection === 'my-reports' ? 'active' : ''}`}
              onClick={() => setSection('my-reports')}
            >
              📱 My Reports
            </button>
          )}
        </div>

        <div className="user-footer">
          <button onClick={logout} className="btn-logout">
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Sign Out</span>
          </button>
        </div>
      </aside>

      {!isCollapsed && (
        <div className="sidebar-backdrop" onClick={() => setIsCollapsed(true)}></div>
      )}

      <div className="content-area">
        <nav className="top-navbar">
          <button className="toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            ☰
          </button>
          <div className="top-meta d-flex align-items-center">
            <div className="connection-status me-3" title="Live Server Connection State">
              <span className={`status-dot ${socketStatus}`}></span>
              {socketStatus === 'connected' && 'Live'}
              {socketStatus === 'reconnecting' && 'Reconnecting...'}
              {socketStatus === 'disconnected' && 'Offline'}
            </div>
            <span className="badge bg-light text-dark me-2">{(role || '').toUpperCase()}</span>
            <strong>{user?.name}</strong>
          </div>
        </nav>

        <div className="p-4">
          {selectedSection === 'overview' && (
            <section className="stacked-view">
              <div className="hero-panel card glass-panel">
                <div className="hero-copy">
                  <div className="eyebrow">Emergency Coordination</div>
                  <h2>
                    {role === 'admin'
                      ? 'Admin command center'
                      : role === 'citizen'
                      ? 'My reports and live status'
                      : 'Responder operations'}
                  </h2>
                  <p>
                    {role === 'admin'
                      ? 'Monitor incidents, manage users, and keep dispatch moving.'
                      : role === 'citizen'
                      ? 'Track your requests, export reports, and see live status updates.'
                      : 'Accept, track, and complete emergency requests with live location sharing.'}
                  </p>
                </div>
                <div className="hero-actions">
                  {role === 'admin' && (
                    <button className="hero-action" onClick={() => setSection('admin-tools')}>
                      Open admin tools
                    </button>
                  )}
                  {(role === 'citizen' || showResponder) && (
                    <button className="hero-action" onClick={() => setSection('my-reports')}>
                      Open my reports
                    </button>
                  )}
                </div>
              </div>

              {role === 'admin' && <AdminDashboard />}
              {showResponder && role !== 'admin' && <ResponderPanel />}
              {role === 'citizen' && <CitizenPanel onReportCreated={handleReportCreated} />}

              {!showResponder && ['police', 'fire', 'ambulance'].includes(role) && (
                <div className="card glass-panel text-center pending-card">
                  <h3>Account Pending</h3>
                  <p>Your responder credentials are being verified by an administrator.</p>
                  <div className="badge pending">Pending Approval</div>
                </div>
              )}
            </section>
          )}

          {selectedSection === 'admin-tools' && role === 'admin' && (
            <section className="section-layout admin-tools-layout">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Admin Portal Tools</div>
                  <h2>What the admin portal should include</h2>
                  <p>Shortcuts below jump into the live dashboard so a dispatcher can act quickly.</p>
                </div>
                <div className="header-actions">
                  <button
                    className="hero-action secondary"
                    onClick={loadAdminStats}
                    disabled={adminStatsLoading}
                  >
                    {adminStatsLoading ? 'Refreshing...' : 'Refresh analytics'}
                  </button>
                  {adminStatsLastRefreshed && (
                    <span className="refresh-note">
                      Updated {adminStatsLastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="tool-grid">
                {adminTools.map((tool) => (
                  <button
                    type="button"
                    key={tool.key}
                    className={`tool-card ${activeAdminTool.key === tool.key ? 'active' : ''}`}
                    onClick={() => openAdminTool(tool.key)}
                  >
                    <div className="tool-icon">{tool.icon}</div>
                    <div className="tool-body">
                      <h3>{tool.title}</h3>
                      <p>{tool.description}</p>
                    </div>
                    <span className={`tool-pill ${activeAdminTool.key === tool.key ? 'tool-pill-active' : ''}`}>
                      {activeAdminTool.key === tool.key ? 'Active' : 'Open'}
                    </span>
                  </button>
                ))}
              </div>

              {activeAdminTool && (
                <div className="selected-tool-preview">
                  <div className="eyebrow">Selected tool</div>
                  <h3>{activeAdminTool.title}</h3>
                  <p>{activeAdminTool.description}</p>
                  <button className="hero-action" type="button" onClick={() => openAdminTool(activeAdminTool.key)}>
                    Open {activeAdminTool.title}
                  </button>
                </div>
              )}

              {stats && (
                <div className="summary-grid">
                  <div className="summary-card">
                    <span>Open Incidents</span>
                    <strong>{stats.statusCounts.pending}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Escalated</span>
                    <strong>{stats.statusCounts.escalated}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Active Responders</span>
                    <strong>{stats.responderStats.total}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Pending Approvals</span>
                    <strong>{stats.responderStats.pendingApproval}</strong>
                  </div>
                </div>
              )}

              <div id="adminDashboardHost">
                <AdminDashboard
                  activeTab={selectedAdminTab}
                  setActiveTab={(tab) => {
                    setSelectedAdminTab(tab);
                    if (tab !== 'map') setAdminHeatmap(false);
                  }}
                  showHeatmap={adminHeatmap}
                  setShowHeatmap={setAdminHeatmap}
                />
              </div>
            </section>
          )}

          {selectedSection === 'my-reports' && (role === 'citizen' || showResponder) && (
            <section className="section-layout reports-layout">
              <div className="section-header">
                <div>
                  <div className="eyebrow">My Reports</div>
                  <h2>Your requests, live statuses, and exportable history</h2>
                  <p>Track every request you submitted, see the current state, and export a record when needed.</p>
                </div>
                <button
                  className="hero-action secondary"
                  onClick={downloadMyReports}
                  disabled={myReports.length === 0}
                >
                  Download CSV
                </button>
              </div>

              <div className="summary-grid">
                <div className="summary-card">
                  <span>Total reports</span>
                  <strong>{getReportStats().total}</strong>
                </div>
                <div className="summary-card">
                  <span>Pending / escalated</span>
                  <strong>{getReportStats().pending}</strong>
                </div>
                <div className="summary-card">
                  <span>Accepted / in progress</span>
                  <strong>{getReportStats().accepted}</strong>
                </div>
                <div className="summary-card">
                  <span>Completed / closed</span>
                  <strong>{getReportStats().completed}</strong>
                </div>
              </div>

              <div className="report-list card glass-panel">
                <div className="report-list-header">
                  <h3>Recent requests</h3>
                  <span>{myReports.length} items</span>
                </div>
                {myReports.length === 0 ? (
                  <div className="empty-state">No requests yet. Create one from the request form below.</div>
                ) : (
                  myReports.slice(0, 5).map((report) => (
                    <div key={report.id} className="report-item">
                      <div className="report-top">
                        <div>
                          <div className="report-type">
                            {report.emergency_type || report.type || 'incident'}
                          </div>
                          <div className="report-meta">
                            #{report.id} · {report.created_at ? new Date(report.created_at).toLocaleString() : '—'}
                          </div>
                        </div>
                        <span className="report-status" data-status={report.status}>
                          {report.status}
                        </span>
                      </div>
                      <div className="report-details">
                        <span>Lat: {report.latitude}</span>
                        <span>Lng: {report.longitude}</span>
                        {report.responder_name && <span>Responder: {report.responder_name}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {role === 'citizen' && <CitizenPanel onReportCreated={handleReportCreated} />}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  return (
    <NotificationProvider>
      <DashboardContent />
    </NotificationProvider>
  );
};

export default Dashboard;
