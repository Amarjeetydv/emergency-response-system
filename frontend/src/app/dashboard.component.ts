import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { AdminPanelComponent } from './dashboard/admin-panel/admin-panel.component';
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
  imports: [CommonModule, AdminPanelComponent, ResponderPanelComponent, CitizenPanelComponent],
  template: `
    <div class="app-container">
      <!-- Sidebar Navigation -->
      <aside class="sidebar">
        <div class="brand">
          <span class="icon">🚨</span>
          <span class="logo-text">ERCS Control</span>
        </div>
        
        <nav class="nav-links">
          <a class="nav-item active">
            <span class="nav-icon">📊</span> Dashboard
          </a>
          <a class="nav-item" *ngIf="role === 'admin'">
            <span class="nav-icon">👥</span> Users
          </a>
          <a class="nav-item" [class.active]="role === 'citizen'">
            <span class="nav-icon">👤</span> Profile
          </a>
        </nav>

        <div class="user-footer">
          <div class="user-info">
            <p class="name">Logged in as:</p>
            <p class="user-display-name">{{ (authService.getUser())?.name }}</p>
          </div>
          <button (click)="authService.logout()" class="logout-btn">Logout</button>
        </div>
      </aside>

      <!-- Main Dashboard Area -->
      <main class="main-content">
        <header class="top-bar card glass-panel">
          <h1>System Overview</h1>
          <div class="live-indicator">
            <span class="dot"></span> Live System Active
          </div>
        </header>

        <div class="dashboard-content">
          <app-admin-panel *ngIf="role === 'admin'"></app-admin-panel>
          
          <app-responder-panel *ngIf="showResponder && role !== 'admin'"></app-responder-panel>
          
          <app-citizen-panel *ngIf="role === 'citizen'"></app-citizen-panel>

          <!-- Feedback for Responders awaiting approval -->
          <div *ngIf="!showResponder && ['police','fire','ambulance'].includes(role)" class="card glass-panel text-center">
            <h3>Account Pending</h3>
            <p>Your responder credentials are being verified by an administrator.</p>
            <div class="badge pending">Pending Approval</div>
          </div>
        </div>
      </main>
    </div>
  `,
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  role = '';
  showResponder = false;

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    this.role = user?.role || 'citizen';
    this.showResponder = canUseResponderDashboard(user);
  }
}
