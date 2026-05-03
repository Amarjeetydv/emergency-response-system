import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
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
          <a class="menu-item active">📊 Dashboard</a>
          <a class="menu-item" *ngIf="role === 'admin'">🛡️ Admin Tools</a>
          <a class="menu-item" [class.active]="role === 'citizen'">📱 My Reports</a>
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
          <app-admin-dashboard *ngIf="role === 'admin'"></app-admin-dashboard>
          
          <app-responder-panel *ngIf="showResponder && role !== 'admin'"></app-responder-panel>
          
          <app-citizen-panel *ngIf="role === 'citizen'"></app-citizen-panel>

          <!-- Feedback for Responders awaiting approval -->
          <div *ngIf="!showResponder && ['police','fire','ambulance'].includes(role)" class="card glass-panel text-center">
            <h3>Account Pending</h3>
            <p>Your responder credentials are being verified by an administrator.</p>
            <div class="badge pending">Pending Approval</div>
          </div>
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
    .user-footer { padding: 1rem; border-top: 1px solid #334155; }
    .btn-logout { width: 100%; padding: 0.75rem; background: #ef4444; border: none; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .content-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .top-navbar { height: 64px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; }
    .toggle-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b; }
    .top-meta { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
    .top-meta strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
    .sidebar-backdrop { display: none; }
    
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
    }
  `]
})
export class DashboardComponent implements OnInit {
  role = '';
  showResponder = false;
  isCollapsed = false;

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.role = user?.role || 'citizen';
    this.showResponder = canUseResponderDashboard(user);
    this.isCollapsed = window.innerWidth <= 768;
  }
}
