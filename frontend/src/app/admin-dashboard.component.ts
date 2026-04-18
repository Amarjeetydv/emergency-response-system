import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyService } from './emergency.service';
import * as L from 'leaflet';
import 'leaflet.heat';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-wrapper">
      <!-- Analytics Overview -->
      <section class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon bg-soft-primary">🚨</div>
          <div class="stat-content">
            <span class="stat-label">Total Requests</span>
            <h2 class="stat-value">{{ stats.totalEmergencies }}</h2>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-soft-danger">🔥</div>
          <div class="stat-content">
            <span class="stat-label">Escalated</span>
            <h2 class="stat-value text-danger">{{ stats.statusCounts.escalated }}</h2>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-soft-info">🚑</div>
          <div class="stat-content">
            <span class="stat-label">Active Responders</span>
            <h2 class="stat-value text-info">{{ stats.responderStats.total }}</h2>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bg-soft-warning">⏳</div>
          <div class="stat-content">
            <span class="stat-label">Pending Approval</span>
            <h2 class="stat-value text-warning">{{ stats.responderStats.pendingApproval }}</h2>
          </div>
        </div>
      </section>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><button class="nav-link" [class.active]="activeTab === 'incidents'" (click)="setActiveTab('incidents')">📋 Incident Logs</button></li>
        <li class="nav-item"><button class="nav-link" [class.active]="activeTab === 'map'" (click)="setActiveTab('map')">📍 Live Tracking</button></li>
        <li class="nav-item"><button class="nav-link" [class.active]="activeTab === 'users'" (click)="setActiveTab('users')">👥 User Management</button></li>
      </ul>

      <div [hidden]="activeTab !== 'map'">
        <div class="mb-2">
          <button class="btn btn-sm" [ngClass]="showHeatmap ? 'btn-dark' : 'btn-outline-dark'" (click)="toggleHeatmap()">
            {{ showHeatmap ? '🔥 Hide Heatmap' : '🔥 Show Heatmap' }}
          </button>
        </div>
        <div id="adminMap" style="height: 600px; border-radius: 12px; width: 100%;"></div>
      </div>

      <div *ngIf="activeTab === 'users'">
        <div class="toolbar card mb-3 p-3">
          <div class="row g-2">
            <div class="col-md-6">
              <input type="text" class="form-control" placeholder="Search by name or email..." [(ngModel)]="userSearchTerm">
            </div>
            <div class="col-md-4">
              <select class="form-select" [(ngModel)]="roleFilter">
                <option value="">All Roles</option>
                <option value="citizen">Citizen</option>
                <option value="police">Police</option>
                <option value="fire">Fire</option>
                <option value="ambulance">Ambulance</option>
              </select>
            </div>
          </div>
        </div>

        <div class="table-responsive card glass-panel">
          <table class="table align-middle">
            <thead class="table-light">
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers()">
                <td>
                  <div class="d-flex align-items-center">
                    <div class="avatar-sm me-2">{{ u.name[0] }}</div>
                    <div>
                      <div class="fw-bold">{{ u.name }}</div>
                      <div class="text-muted small">{{ u.email }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select class="form-select form-select-sm w-auto shadow-none" [value]="u.role" (change)="onRoleChange(u.id, $event)">
                    <option value="citizen">Citizen</option>
                    <option value="police">Police</option>
                    <option value="ambulance">Ambulance</option>
                    <option value="fire">Fire</option>
                  </select>
                </td>
                <td>
                  <span class="badge" [ngClass]="u.approval_status === 'approved' ? 'bg-success' : 'bg-warning'">
                    {{ u.approval_status || 'N/A' }}
                  </span>
                </td>
                <td class="text-end">
                  <button *ngIf="u.approval_status === 'pending'" class="btn btn-sm btn-primary me-1" (click)="approve(u.id)">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="deleteUser(u.id, u.name)">🗑️</button>
                </td>
              </tr>
              <tr *ngIf="filteredUsers().length === 0">
                <td colspan="4" class="text-center p-5 text-muted">No users found matching your criteria.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="activeTab === 'incidents'">
        <div class="table-responsive card glass-panel">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Incident</th>
                <th>Citizen</th>
                <th style="width: 25%">Details</th>
                <th>Status</th>
                <th>Evidence</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of incidents">
                <td>
                  <div class="fw-bold">#{{ e.id }}</div>
                  <span class="badge bg-dark">{{ (e.emergency_type || e.type) | uppercase }}</span>
                </td>
                <td>{{ e.citizen_name || 'User #' + e.citizen_id }}</td>
                <td>
                  <div class="text-truncate" style="max-width: 250px;" [title]="e.description">
                    <small class="text-secondary">{{ e.description || 'No description provided.' }}</small>
                  </div>
                  <div class="text-muted smallest">{{ e.created_at | date:'medium' }}</div>
                </td>
                <td>
                  <span class="badge" [ngClass]="{
                    'bg-danger': e.status === 'escalated',
                    'bg-warning': e.status === 'pending',
                    'bg-primary': e.status === 'in_progress',
                    'bg-success': e.status === 'completed'
                  }">{{ e.status | uppercase }}</span>
                </td>
                <td>
                  <div *ngIf="e.media_url || e.mediaUrl" class="media-frame">
                    <img *ngIf="isImage(e.media_url || e.mediaUrl)" [src]="e.media_url || e.mediaUrl" class="media-thumb" (click)="openMedia(e.media_url || e.mediaUrl)">
                    <video *ngIf="isVideo(e.media_url || e.mediaUrl)" [src]="e.media_url || e.mediaUrl" class="media-thumb"></video>
                  </div>
                  <span *ngIf="!(e.media_url || e.mediaUrl)" class="text-muted smallest">None</span>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-primary" title="View Details" (click)="viewIncident(e)">👁️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Incident Detail Modal -->
      <div class="modal-overlay" *ngIf="selectedIncident" (click)="closeIncidentModal()">
        <div class="modal-content card p-4 shadow-lg" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2">
            <h3 class="m-0 text-primary">Incident #{{ selectedIncident.id }} Details</h3>
            <button class="btn-close" (click)="closeIncidentModal()"></button>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <p class="mb-1"><strong>Type:</strong> <span class="badge bg-dark ms-2">{{ (selectedIncident.emergency_type || selectedIncident.type) | uppercase }}</span></p>
              <p class="mb-1"><strong>Status:</strong> <span class="badge ms-2" [ngClass]="{'bg-danger': selectedIncident.status === 'escalated', 'bg-warning': selectedIncident.status === 'pending', 'bg-primary': selectedIncident.status === 'in_progress', 'bg-success': selectedIncident.status === 'completed'}">{{ selectedIncident.status | uppercase }}</span></p>
              <p class="mb-1"><strong>Reported By:</strong> {{ selectedIncident.citizen_name || 'User #' + selectedIncident.citizen_id }}</p>
              <p class="mb-1"><strong>Responder:</strong> {{ selectedIncident.responder_name || 'Not Assigned' }}</p>
              <p class="mb-1"><strong>Created At:</strong> {{ selectedIncident.created_at | date:'medium' }}</p>
            </div>
            <div class="col-md-6 mb-3 border-start">
              <p class="mb-1"><strong>Location (Lat, Lng):</strong> {{ selectedIncident.latitude }}, {{ selectedIncident.longitude }}</p>
              <p class="mb-1"><strong>Description:</strong></p>
              <p class="text-secondary small p-2 bg-light rounded">{{ selectedIncident.description || 'No description provided.' }}</p>
            </div>
          </div>
          <div class="mt-3" *ngIf="selectedIncident.media_url || selectedIncident.mediaUrl">
            <p class="mb-2"><strong>Evidence Attachment:</strong></p>
            <div class="media-container text-center bg-dark p-2 rounded shadow-inner">
              <img *ngIf="isImage(selectedIncident.media_url || selectedIncident.mediaUrl)" [src]="selectedIncident.media_url || selectedIncident.mediaUrl" class="img-fluid rounded" style="max-height: 400px; object-fit: contain;">
              <video *ngIf="isVideo(selectedIncident.media_url || selectedIncident.mediaUrl)" [src]="selectedIncident.media_url || selectedIncident.mediaUrl" class="img-fluid rounded" controls style="max-height: 400px;"></video>
            </div>
          </div>
          <div class="mt-4 text-end">
            <button class="btn btn-secondary px-4" (click)="closeIncidentModal()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-wrapper { 
      padding: 1.5rem; 
      background: #f4f7f9; 
      min-height: 100vh; 
      width: 100%;
    }
    .stats-grid, .nav-tabs, .toolbar, .table-responsive, .map-container-wrapper { width: 100%; display: block; }
    [hidden] { display: none !important; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: #fff; padding: 1.5rem; border-radius: 12px; display: flex; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .stat-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-right: 1rem; }
    .stat-label { color: #64748b; font-size: 0.875rem; font-weight: 500; }
    .stat-value { margin: 0; font-weight: 700; }
    .bg-soft-primary { background: #e0e7ff; } .bg-soft-danger { background: #fee2e2; } .bg-soft-info { background: #e0f2fe; } .bg-soft-warning { background: #fef3c7; }
    .avatar-sm { width: 36px; height: 36px; background: #6366f1; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .media-thumb { width: 60px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer; transition: transform 0.2s; }
    .media-thumb:hover { transform: scale(1.1); }
    .smallest { font-size: 0.75rem; }
    .nav-tabs .nav-link { border: none; color: #64748b; font-weight: 500; padding: 1rem 1.5rem; }
    .nav-tabs .nav-link.active { color: #6366f1; border-bottom: 3px solid #6366f1; background: transparent; }
    .table-responsive { border: none; border-radius: 12px; overflow: hidden; }
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; backdrop-filter: blur(4px); }
    .modal-content { width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; background: white; border-radius: 16px; border: none; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeTab: 'map' | 'users' | 'incidents' = 'incidents';
  stats: any;
  users: any[] = [];
  incidents: any[] = [];

  userSearchTerm = '';
  roleFilter = '';

  showHeatmap = false;
  private map!: L.Map;
  private markers: { [key: string]: any } = {};
  private heatmapLayer: any;
  private subs = new Subscription();
  private emergencyService = inject(EmergencyService);

  ngOnInit() {
    this.loadData();
    setTimeout(() => this.initMap(), 100);
    
    // Correctly handle live updates and responder locations
    this.subs.add(this.emergencyService.getLiveUpdates().subscribe(ev => {
      if (ev.type === 'NEW' || ev.type === 'STATUS') {
        this.loadData();
      } else if (ev.type === 'LOCATION') {
        this.updateResponderMarker(ev.data);
      }
    }));
  }

  setActiveTab(tab: 'map' | 'users' | 'incidents') {
    this.activeTab = tab;
    if (tab === 'map' && this.map) {
      // Leaflet needs to re-calculate its size when the container becomes visible
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  filteredUsers() {
    return this.users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(this.userSearchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(this.userSearchTerm.toLowerCase());
      const matchesRole = this.roleFilter ? u.role === this.roleFilter : true;
      return matchesSearch && matchesRole;
    });
  }

  loadData() {
    this.emergencyService.getAnalytics().subscribe((s: any) => this.stats = s);
    this.emergencyService.getUsers().subscribe((u: any[]) => this.users = u);
    this.emergencyService.getEmergencies().subscribe((list: any[]) => {
      this.incidents = list;
      this.updateIncidentMarkers(list);
      this.updateHeatmap(list);
    });
  }

  isImage(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(url);
  }

  isVideo(url: string): boolean {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  }

  openMedia(url: string) {
    window.open(url, '_blank');
  }

  onRoleChange(userId: number, event: Event) {
    const role = (event.target as HTMLSelectElement).value;
    this.emergencyService.updateUserRole(userId, role).subscribe(() => {
      this.loadData();
    });
  }


  deleteUser(id: number, name: string) {
    if (confirm(`Are you sure you want to delete user '${name}'? This cannot be undone.`)) {
      this.emergencyService.deleteUser(id).subscribe({
        next: () => this.loadData(),
        error: (err: any) => {
          const detail = err?.error?.details || err?.error?.message || err.message || err;
          alert('Failed to delete user: ' + detail);
        }
      });
    }
  }

  // Incident details modal logic

  selectedIncident: any = null;
  viewIncident(incident: any) {
    this.selectedIncident = incident;
  }
  closeIncidentModal() {
    this.selectedIncident = null;
  }

  initMap() {
    this.map = L.map('adminMap').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    
    // If we already have incidents, center the map on the first one
    if (this.incidents.length > 0) {
      this.map.setView([this.incidents[0].latitude, this.incidents[0].longitude], 12);
    }
  }

  toggleHeatmap() {
    this.showHeatmap = !this.showHeatmap;
    if (this.showHeatmap && this.heatmapLayer) {
      this.heatmapLayer.addTo(this.map);
    } else if (this.heatmapLayer) {
      this.map.removeLayer(this.heatmapLayer);
    }
  }

  updateHeatmap(incidents: any[]) {
    // Remove old layer if exists
    if (this.heatmapLayer && this.map.hasLayer(this.heatmapLayer)) {
      this.map.removeLayer(this.heatmapLayer);
    }

    // Prepare data points: [lat, lng, intensity]
    const points = incidents.map(e => [
      e.latitude, 
      e.longitude, 
      e.status === 'escalated' ? 1.0 : 0.5 // Higher intensity for escalated
    ]);

    // Create new heatmap layer
    this.heatmapLayer = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
    });

    if (this.showHeatmap) {
      this.heatmapLayer.addTo(this.map);
    }
  }

  updateIncidentMarkers(incidents: any[]) {
    incidents.forEach(e => {
      const key = `inc_${e.id}`;
      const lat = parseFloat(e.latitude);
      const lng = parseFloat(e.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      if (this.markers[key]) this.map.removeLayer(this.markers[key]);
      
      const color = e.status === 'escalated' ? 'red' : (e.status === 'pending' ? 'orange' : 'blue');
      const marker = L.circleMarker([lat, lng], {
        color, radius: 10, fillOpacity: 0.8
      }).bindPopup(`<b>${(e.emergency_type || e.type || 'Incident').toUpperCase()}</b><br>Status: ${e.status}<br><small>${e.description || ''}</small>`);
      
      marker.addTo(this.map);
      this.markers[key] = marker;
    });
  }

  updateResponderMarker(data: any) {
    const key = `res_${data.responderId}`;
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    if (this.markers[key]) this.map.removeLayer(this.markers[key]);

    const icon = L.divIcon({
      html: '<div style="font-size: 24px;">🚑</div>',
      className: 'responder-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const marker = L.marker([lat, lng], { icon })
      .bindPopup(`Responder ID: ${data.responderId}`)
      .addTo(this.map);
    
    this.markers[key] = marker;
  }

  approve(id: number) {
    this.emergencyService.approveUser(id).subscribe(() => this.loadData());
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.map) this.map.remove();
  }
}
