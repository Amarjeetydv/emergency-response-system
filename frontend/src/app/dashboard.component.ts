import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { EmergencyService } from './emergency.service';
import { AdminDashboardComponent } from './admin-dashboard.component'; // Ensure this points to the new file
import { ResponderPanelComponent } from './dashboard/responder-panel/responder-panel.component';
import { CitizenPanelComponent } from './dashboard/citizen-panel/citizen-panel.component';

function canUseResponderDashboard(user: any): boolean {
  if (!user) return false;
  const role = user.role;
  if (role === 'responder' || role === 'dispatcher') return true;
  if (['police', 'fire', 'ambulance'].includes(role)) {
    return user.approval_status === 'approved';
  }
  return false;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AdminDashboardComponent, ResponderPanelComponent, CitizenPanelComponent],
  template: `
    <div class="app-wrapper" [class.sidebar-collapsed]="isCollapsed">
      <!-- Sidebar Navigation -->
      <aside class="side-nav">
        <div class="nav-brand">
          <span class="brand-icon">⚡</span>
          <span class="brand-text">ERCS Pro</span>
        </div>
        
        <div class="nav-menu">
          <div class="menu-label">Main Menu</div>
          <button class="menu-item menu-button" [class.active]="selectedSection === 'overview'" (click)="setSection('overview')">📊 Dashboard</button>
          <button class="menu-item menu-button" *ngIf="role === 'admin'" [class.active]="selectedSection === 'admin-tools'" (click)="setSection('admin-tools')">🛡️ Admin Portal Tools</button>
          <button class="menu-item menu-button" *ngIf="role === 'citizen' || showResponder" [class.active]="selectedSection === 'my-reports'" (click)="setSection('my-reports')">📱 My Reports</button>
        </div>

        <div class="user-footer">
          <button (click)="authService.logout()" class="btn-logout">
            <span class="logout-icon">🚪</span>
            <span class="logout-text">Sign Out</span>
          </button>
        </div>
      </aside>
      <div class="sidebar-backdrop" *ngIf="!isCollapsed" (click)="isCollapsed = true"></div>

      <div class="content-area">
        <nav class="top-navbar">
          <button class="toggle-btn" (click)="isCollapsed = !isCollapsed">☰</button>
          <div class="top-meta">
            <span class="badge bg-light text-dark me-2">{{ role | uppercase }}</span>
            <strong>{{ (authService.getUser())?.name }}</strong>
          </div>
        </nav>

        <div class="p-4">
          <ng-container [ngSwitch]="selectedSection">
            <section *ngSwitchCase="'overview'" class="stacked-view">
              <div class="hero-panel card glass-panel">
                <div class="hero-copy">
                  <div class="eyebrow">Emergency Coordination</div>
                  <h2>{{ role === 'admin' ? 'Admin command center' : role === 'citizen' ? 'My reports and live status' : 'Responder operations' }}</h2>
                  <p>
                    {{ role === 'admin' ? 'Monitor incidents, manage users, and keep dispatch moving.' : role === 'citizen' ? 'Track your requests, export reports, and see live status updates.' : 'Accept, track, and complete emergency requests with live location sharing.' }}
                  </p>
                </div>
                <div class="hero-actions">
                  <button *ngIf="role === 'admin'" class="hero-action" (click)="setSection('admin-tools')">Open admin tools</button>
                  <button *ngIf="role === 'citizen' || showResponder" class="hero-action" (click)="setSection('my-reports')">Open my reports</button>
                </div>
              </div>

              <app-admin-dashboard *ngIf="role === 'admin'"></app-admin-dashboard>
              <app-responder-panel *ngIf="showResponder && role !== 'admin'"></app-responder-panel>
              <app-citizen-panel *ngIf="role === 'citizen'" (reportCreated)="onReportCreated($event)"></app-citizen-panel>

              <div *ngIf="!showResponder && ['police','fire','ambulance'].includes(role)" class="card glass-panel text-center pending-card">
                <h3>Account Pending</h3>
                <p>Your responder credentials are being verified by an administrator.</p>
                <div class="badge pending">Pending Approval</div>
              </div>
            </section>

            <section *ngSwitchCase="'admin-tools'" class="section-layout admin-tools-layout">
              <ng-container *ngIf="role === 'admin'">
                <div class="section-header">
                  <div>
                    <div class="eyebrow">Admin Portal Tools</div>
                    <h2>What the admin portal should include</h2>
                    <p>Shortcuts below jump into the live dashboard so a dispatcher can act quickly.</p>
                  </div>
                  <div class="header-actions">
                    <button class="hero-action secondary" (click)="loadAdminStats()" [disabled]="adminStatsLoading">
                      {{ adminStatsLoading ? 'Refreshing...' : 'Refresh analytics' }}
                    </button>
                    <span class="refresh-note" *ngIf="adminStatsLastRefreshed">Updated {{ adminStatsLastRefreshed | date:'shortTime' }}</span>
                  </div>
                </div>

                <div class="tool-grid">
                  <button type="button" class="tool-card" *ngFor="let tool of adminTools" (click)="openAdminTool(tool.key)">
                    <div class="tool-icon">{{ tool.icon }}</div>
                    <div class="tool-body">
                      <h3>{{ tool.title }}</h3>
                      <p>{{ tool.description }}</p>
                    </div>
                    <span class="tool-pill" [class.tool-pill-active]="selectedAdminTool === tool.key">
                      {{ selectedAdminTool === tool.key ? 'Active' : 'Open' }}
                    </span>
                  </button>
                </div>

                <div class="selected-tool-preview" *ngIf="activeAdminTool as activeTool">
                  <div class="eyebrow">Selected tool</div>
                  <h3>{{ activeTool.title }}</h3>
                  <p>{{ activeTool.description }}</p>
                  <button class="hero-action" type="button" (click)="openAdminTool(activeTool.key)">Open {{ activeTool.title }}</button>
                </div>

                <div class="summary-grid" *ngIf="stats">
                  <div class="summary-card">
                    <span>Open Incidents</span>
                    <strong>{{ stats?.statusCounts?.pending || 0 }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Escalated</span>
                    <strong>{{ stats?.statusCounts?.escalated || 0 }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Active Responders</span>
                    <strong>{{ stats?.responderStats?.total || 0 }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Pending Approvals</span>
                    <strong>{{ stats?.responderStats?.pendingApproval || 0 }}</strong>
                  </div>
                </div>

                <div #adminDashboardHost>
                  <app-admin-dashboard *ngIf="role === 'admin'"></app-admin-dashboard>
                </div>
              </ng-container>
            </section>

            <section *ngSwitchCase="'my-reports'" class="section-layout reports-layout">
              <ng-container *ngIf="role === 'citizen' || showResponder">
                <div class="section-header">
                  <div>
                    <div class="eyebrow">My Reports</div>
                    <h2>Your requests, live statuses, and exportable history</h2>
                    <p>Track every request you submitted, see the current state, and export a record when needed.</p>
                  </div>
                  <button class="hero-action secondary" (click)="downloadMyReports()" [disabled]="myReports.length === 0">Download CSV</button>
                </div>

                <div class="summary-grid">
                  <div class="summary-card">
                    <span>Total reports</span>
                    <strong>{{ getReportStats().total }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Pending / escalated</span>
                    <strong>{{ getReportStats().pending }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Accepted / in progress</span>
                    <strong>{{ getReportStats().accepted }}</strong>
                  </div>
                  <div class="summary-card">
                    <span>Completed / closed</span>
                    <strong>{{ getReportStats().completed }}</strong>
                  </div>
                </div>

                <div class="report-list card glass-panel">
                  <div class="report-list-header">
                    <h3>Recent requests</h3>
                    <span>{{ myReports.length }} items</span>
                  </div>
                  <div *ngIf="myReports.length === 0" class="empty-state">No requests yet. Create one from the request form below.</div>
                  <div class="report-item" *ngFor="let report of myReports | slice:0:5">
                    <div class="report-top">
                      <div>
                        <div class="report-type">{{ report.emergency_type || report.type || 'incident' }}</div>
                        <div class="report-meta">#{{ report.id }} · {{ report.created_at | date:'medium' }}</div>
                      </div>
                      <span class="report-status" [attr.data-status]="report.status">{{ report.status }}</span>
                    </div>
                    <div class="report-details">
                      <span>Lat: {{ report.latitude }}</span>
                      <span>Lng: {{ report.longitude }}</span>
                      <span *ngIf="report.responder_name">Responder: {{ report.responder_name }}</span>
                    </div>
                  </div>
                </div>

                <app-citizen-panel *ngIf="role === 'citizen'" (reportCreated)="onReportCreated($event)"></app-citizen-panel>
              </ng-container>
            </section>
          </ng-container>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-wrapper { display: flex; min-height: 100vh; background: #f8fafc; position: relative; }
    .side-nav { width: 260px; background: #1e293b; color: #f8fafc; display: flex; flex-direction: column; transition: transform 0.3s ease, width 0.3s ease; flex-shrink: 0; }
    .nav-brand { padding: 1.5rem; display: flex; align-items: center; background: rgba(0,0,0,0.1); }
    .brand-icon { font-size: 1.5rem; margin-right: 0.75rem; }
    .brand-text { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.5px; }
    .nav-menu { padding: 1.5rem; flex: 1; }
    .menu-label { font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 1rem; }
    .menu-item { display: block; padding: 0.75rem 1rem; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 0.5rem; transition: all 0.2s; }
    .menu-item:hover, .menu-item.active { background: #334155; color: #fff; }
    .menu-button { width: 100%; text-align: left; border: none; background: transparent; cursor: pointer; font: inherit; }
    .user-footer { padding: 1rem; border-top: 1px solid #334155; }
    .btn-logout { width: 100%; padding: 0.75rem; background: #ef4444; border: none; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .content-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top-navbar { height: 64px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; }
    .toggle-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .top-meta { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
    .top-meta strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    .sidebar-backdrop { display: none; }

    .stacked-view, .section-layout { display: flex; flex-direction: column; gap: 1rem; }
    .admin-tools-layout { padding-left: 0.85rem; padding-right: 0.25rem; }
    .reports-layout { padding-left: 0.5rem; padding-right: 0.25rem; }
    .hero-panel { padding: 1.25rem; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    .hero-copy h2, .section-header h2 { margin: 0.25rem 0 0.35rem; font-size: clamp(1.2rem, 2vw, 1.8rem); }
    .hero-copy p, .section-header p { margin: 0; color: #475569; max-width: 62ch; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; color: #2563eb; font-size: 0.74rem; font-weight: 700; }
    .hero-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .hero-action { border: none; background: #2563eb; color: #fff; padding: 0.8rem 1rem; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .hero-action.secondary { background: #e2e8f0; color: #0f172a; }
    .hero-action:disabled { opacity: 0.55; cursor: not-allowed; }
    .header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; }
    .refresh-note { font-size: 0.82rem; color: #64748b; }
    .pending-card { padding: 1rem; }
    .section-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .tool-grid, .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.9rem; }
    .tool-card { border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; padding: 1rem; display: flex; gap: 0.9rem; text-align: left; cursor: pointer; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05); transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .tool-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
    .tool-card.active { border-color: #2563eb; box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.15), 0 10px 26px rgba(37, 99, 235, 0.12); }
    .tool-icon { width: 42px; height: 42px; border-radius: 12px; display:flex; align-items:center; justify-content:center; background: #eef2ff; font-size: 1.25rem; flex-shrink: 0; }
    .tool-body h3 { margin: 0; font-size: 1rem; }
    .tool-body p { margin: 0.25rem 0 0; color: #64748b; font-size: 0.92rem; }
    .tool-pill { margin-left: auto; align-self: flex-start; padding: 0.25rem 0.55rem; border-radius: 999px; background: #e2e8f0; color: #334155; font-size: 0.78rem; font-weight: 700; }
    .tool-pill-active { background: #dbeafe; color: #1d4ed8; }
    .selected-tool-preview { border: 1px solid #dbeafe; background: linear-gradient(180deg, #eff6ff, #ffffff); border-radius: 16px; padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .selected-tool-preview h3 { margin: 0; }
    .selected-tool-preview p { margin: 0; color: #475569; }
    .summary-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .summary-card span { color: #64748b; font-size: 0.88rem; }
    .summary-card strong { font-size: 1.6rem; color: #0f172a; }
    .report-list { padding: 1rem; }
    .report-list-header { display:flex; align-items:center; justify-content:space-between; gap: 1rem; margin-bottom: 0.9rem; }
    .report-list-header h3 { margin: 0; }
    .report-list-header span { color: #64748b; font-size: 0.9rem; }
    .empty-state { padding: 0.9rem; color: #64748b; background: #f8fafc; border-radius: 12px; }
    .report-item { border-top: 1px solid #e2e8f0; padding: 0.85rem 0; display: flex; flex-direction: column; gap: 0.55rem; }
    .report-item:first-of-type { border-top: none; padding-top: 0.2rem; }
    .report-top { display:flex; align-items:flex-start; justify-content:space-between; gap: 1rem; }
    .report-type { font-weight: 700; text-transform: capitalize; }
    .report-meta, .report-details { color: #64748b; font-size: 0.9rem; }
    .report-details { display:flex; flex-wrap: wrap; gap: 0.65rem; }
    .report-status { padding: 0.25rem 0.65rem; border-radius: 999px; background: #e2e8f0; text-transform: capitalize; font-size: 0.82rem; }
    .report-status[data-status='pending'], .report-status[data-status='escalated'] { background: #fef3c7; }
    .report-status[data-status='accepted'], .report-status[data-status='in_progress'] { background: #dbeafe; }
    .report-status[data-status='completed'] { background: #dcfce7; }
    .report-status[data-status='cancelled'] { background: #fee2e2; }
    
    /* Responsive Logic */
    .sidebar-collapsed .side-nav { width: 0; overflow: hidden; }
    .sidebar-collapsed .brand-text, .sidebar-collapsed .logout-text { display: none; }
    @media (max-width: 768px) {
      .side-nav { position: fixed; height: 100%; z-index: 1001; left: 0; top: 0; width: min(82vw, 280px); transform: translateX(0); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
      .sidebar-collapsed .side-nav { width: min(82vw, 280px); transform: translateX(-100%); overflow: visible; }
      .sidebar-backdrop { display: block; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000; }
      .top-navbar { padding: 0 0.85rem; }
      .top-meta strong { max-width: 112px; font-size: 0.9rem; }
      .p-4 { padding: 0.85rem !important; }
      .hero-panel, .section-header { flex-direction: column; align-items: flex-start; }
      .tool-grid, .summary-grid { grid-template-columns: 1fr; }
      .admin-tools-layout { padding-left: 0; padding-right: 0; }
      .reports-layout { padding-left: 0; padding-right: 0; }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  role = '';
  showResponder = false;
  isCollapsed = false;
  selectedSection: 'overview' | 'admin-tools' | 'my-reports' = 'overview';
  selectedAdminTool = 'map';
  activeAdminTool: { key: string; title: string; description: string; icon: string } | null = null;
  stats: any = null;
  adminStatsLoading = false;
  adminStatsLastRefreshed: Date | null = null;
  myReports: any[] = [];
  private liveUpdatesSub?: Subscription;

  @ViewChild(AdminDashboardComponent) adminDashboard?: AdminDashboardComponent;
  @ViewChild('adminDashboardHost') adminDashboardHost?: ElementRef<HTMLDivElement>;

  readonly adminTools = [
    {
      key: 'map',
      title: 'Live Tracking',
      description: 'Open the map, inspect active markers, and follow responders in real time.',
      icon: '📍'
    },
    {
      key: 'incidents',
      title: 'Incident Queue',
      description: 'Review open, escalated, and completed incidents from one place.',
      icon: '🚨'
    },
    {
      key: 'users',
      title: 'User Management',
      description: 'Approve responders, change roles, and keep accounts in good standing.',
      icon: '👥'
    },
    {
      key: 'heatmap',
      title: 'Heatmap View',
      description: 'Toggle density view to identify hotspots and repeated calls.',
      icon: '🔥'
    },
    {
      key: 'refresh',
      title: 'Refresh Data',
      description: 'Pull the latest incidents, users, and analytics in one click.',
      icon: '🔄'
    }
  ];

  constructor(public authService: AuthService, private emergencyService: EmergencyService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.role = user?.role || 'citizen';
    this.showResponder = canUseResponderDashboard(user);
    this.isCollapsed = window.innerWidth <= 768;
    this.activeAdminTool = this.adminTools.find(tool => tool.key === this.selectedAdminTool) || this.adminTools[0] || null;

    this.loadPersonalReports();
    if (this.role === 'admin') {
      this.loadAdminStats();
    }

    this.liveUpdatesSub = this.emergencyService.getLiveUpdates().subscribe((event) => {
      if (event.type === 'NEW' || event.type === 'STATUS') {
        if (this.role === 'citizen') {
          this.loadPersonalReports();
        }
        if (this.role === 'admin') {
          this.loadAdminStats();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.liveUpdatesSub?.unsubscribe();
  }

  setSection(section: 'overview' | 'admin-tools' | 'my-reports'): void {
    this.selectedSection = section;
    this.isCollapsed = window.innerWidth <= 768 ? true : this.isCollapsed;
  }

  loadAdminStats(): void {
    this.adminStatsLoading = true;
    this.emergencyService.getAnalytics().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.adminStatsLastRefreshed = new Date();
      },
      error: () => (this.stats = null),
      complete: () => (this.adminStatsLoading = false)
    });
  }

  loadPersonalReports(): void {
    const user = this.authService.getUser();
    const userId = user?.id ?? user?._id ?? null;
    this.emergencyService.getEmergencies().subscribe({
      next: (rows) => {
        const reports = (rows || []).filter((row: any) => {
          if (this.role === 'citizen' && userId != null) {
            return row.citizen_id === userId || row.citizenId === userId || row.user_id === userId || row.userId === userId;
          }
          return true;
        });
        this.myReports = reports;
      },
      error: () => (this.myReports = [])
    });
  }

  onReportCreated(report: any): void {
    if (!report) {
      this.loadPersonalReports();
      return;
    }

    const normalized = {
      ...report,
      status: report.status || 'pending'
    };

    if (this.role === 'citizen') {
      const exists = this.myReports.some((item) => item.id === normalized.id);
      if (!exists) {
        this.myReports = [normalized, ...this.myReports];
      }
    }

    if (this.role === 'admin') {
      this.loadAdminStats();
    }
  }

  getReportStats(): { total: number; pending: number; accepted: number; completed: number } {
    const counts = { total: this.myReports.length, pending: 0, accepted: 0, completed: 0 };
    for (const report of this.myReports) {
      const status = String(report.status || '').toLowerCase();
      if (status === 'pending' || status === 'escalated') counts.pending += 1;
      if (status === 'accepted' || status === 'in_progress') counts.accepted += 1;
      if (status === 'completed' || status === 'cancelled') counts.completed += 1;
    }
    return counts;
  }

  downloadMyReports(): void {
    if (!this.myReports.length) return;

    const header = ['id', 'type', 'status', 'latitude', 'longitude', 'responder', 'created_at'];
    const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = this.myReports.map((report) => [
      report.id,
      report.emergency_type || report.type || '',
      report.status || '',
      report.latitude ?? '',
      report.longitude ?? '',
      report.responder_name || '',
      report.created_at || ''
    ]);

    const csv = [header.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openAdminTool(key: string): void {
    this.selectedSection = 'admin-tools';
    this.selectedAdminTool = key;
    this.activeAdminTool = this.adminTools.find(tool => tool.key === key) || this.activeAdminTool;
    if (!this.adminDashboard) return;

    switch (key) {
      case 'map':
        this.adminDashboard.setActiveTab('map');
        break;
      case 'incidents':
        this.adminDashboard.setActiveTab('incidents');
        break;
      case 'users':
        this.adminDashboard.setActiveTab('users');
        break;
      case 'heatmap':
        this.adminDashboard.setActiveTab('map');
        this.adminDashboard.toggleHeatmap();
        break;
      case 'refresh':
        this.adminDashboard.loadData();
        this.loadAdminStats();
        break;
    }

    setTimeout(() => {
      this.adminDashboardHost?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
