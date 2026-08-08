import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyService } from './emergency.service';
let Leaflet: any = null;
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
      min-height: 100%; 
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    }
    .stats-grid, .nav-tabs, .toolbar, .table-responsive { width: 100%; display: block; }
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
    .nav-tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    .nav-item { list-style: none; }
    .nav-tabs .nav-link { border: none; color: #64748b; font-weight: 500; padding: 0.7rem 0.85rem; border-radius: 8px; background: #f8fafc; }
    .nav-tabs .nav-link.active { color: #6366f1; border-bottom: 3px solid #6366f1; background: transparent; }
    .table-responsive { border: none; border-radius: 12px; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; background: #fff; }
    .table { min-width: 880px; margin-bottom: 0; }
    #adminMap { max-width: 100%; }
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; backdrop-filter: blur(4px); }
    .modal-content { width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; background: white; border-radius: 16px; border: none; }
    @media (max-width: 768px) {
      .admin-wrapper { padding: 0.75rem; }
      .stats-grid { grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 1rem; }
      .stat-card { padding: 0.9rem; border-radius: 10px; }
      .stat-value { font-size: 1.15rem; }
      .stat-label { font-size: 0.78rem; }
      .toolbar { padding: 0.75rem !important; }
      .nav-tabs .nav-link { font-size: 0.8rem; padding: 0.55rem 0.65rem; }
      #adminMap { height: 320px !important; }
      .modal-overlay { padding: 0.75rem; }
      .modal-content { border-radius: 12px; max-height: 95vh; }
    }

    @media (max-width: 420px) {
      .admin-wrapper { padding: 0.5rem; }
      .stats-grid { gap: 0.6rem; }
      .stat-card { padding: 0.75rem; }
      .stat-icon { width: 40px; height: 40px; font-size: 1.1rem; margin-right: 0.65rem; }
      .nav-tabs .nav-link { font-size: 0.75rem; padding: 0.5rem 0.55rem; }
      #adminMap { height: 260px !important; }
      .table { min-width: 760px; }
    }

    /* Map overlay and responder styles */
    .map-overlay {
      position: absolute;
      right: 18px;
      top: 18px;
      width: 260px;
      max-height: 420px;
      overflow-y: auto;
      z-index: 2200;
      background: rgba(255,255,255,0.95);
      border-radius: 10px;
    }
    .responder-row { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    .responder-avatar { width: 36px; height: 36px; border-radius: 50%; background: #6366f1; color: white; display:flex; align-items:center; justify-content:center; font-weight:700; }
    .responder-row:last-child { border-bottom: none; }
    .responder-row .btn-group { min-width: 70px; }
    .marker-div-icon { background: transparent; }
    .marker-badge { width: 36px; height: 36px; border-radius: 18px; display:flex; align-items:center; justify-content:center; color: #fff; font-weight:700; box-shadow: 0 1px 3px rgba(0,0,0,0.3); border: 2px solid #fff; }
    .marker-source { background: #10b981; }
    .marker-dest { background: #ef4444; }
    .marker-label { background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 4px; color: #111827; font-size: 0.85rem; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
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
  private map: any;
  private markers: { [key: string]: any } = {};
  private heatmapLayer: any;
  responderList: { responderId: string, name?: string, role?: string, lat?: number, lng?: number, ts?: number }[] = [];
  private cluster: any;
  private sourceIcon: any;
  private destIcon: any;
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
      setTimeout(() => {
        this.map.invalidateSize();
        // Fit map to relevant markers (prefer source/destination if present)
        this.fitToRelevantMarkers();
      }, 100);
    }
  }

  fitToRelevantMarkers() {
    if (!this.map) return;
    // prefer source/destination roles if available
    const pts: any[] = [];
    const srcDstPts: any[] = [];
    Object.keys(this.markers).forEach(k => {
      const m = this.markers[k];
      if (!m) return;
      const latlng = m.getLatLng ? m.getLatLng() : null;
      if (!latlng) return;
      pts.push(latlng);
      const role = (m as any).options?.role;
      if (role === 'source' || role === 'destination') srcDstPts.push(latlng);
    });

    const toUse = srcDstPts.length >= 2 ? srcDstPts : (pts.length ? pts : null);
    if (toUse && toUse.length > 0) {
      try {
        const bounds = Leaflet.latLngBounds(toUse);
        this.map.fitBounds(bounds, { padding: [60, 60] });
      } catch (err) {
        console.warn('fitToRelevantMarkers failed', err);
      }
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

  async initMap() {
    // Dynamically load Leaflet and the heat plugin to avoid adding them to the initial bundle
    if (!Leaflet) {
      try {
        const mod = await import('leaflet');
        Leaflet = (mod as any).default || mod;
      } catch (err) {
        console.error('Failed to load Leaflet:', err);
        return;
      }

      try {
        await import('leaflet.heat');
      } catch (err) {
        console.warn('Failed to load leaflet.heat plugin (optional):', err);
      }
    }

    this.map = Leaflet.map('adminMap').setView([0, 0], 2);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    // Try to load markercluster plugin and create a cluster group
    try {
      await import('leaflet.markercluster');
      this.cluster = (Leaflet as any).markerClusterGroup({ chunkedLoading: true });
      this.map.addLayer(this.cluster);
    } catch (err) {
      console.warn('leaflet.markercluster not available, continuing without clustering', err);
      this.cluster = null;
    }

    // Create simple labeled icons for Source and Destination
    this.sourceIcon = Leaflet.divIcon({
      html: `<div class="marker-badge marker-source">S</div>`,
      className: 'marker-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.destIcon = Leaflet.divIcon({
      html: `<div class="marker-badge marker-dest">D</div>`,
      className: 'marker-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

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
    this.heatmapLayer = (Leaflet as any).heatLayer(points, {
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

      if (this.markers[key]) {
        const old = this.markers[key];
        if (this.cluster) this.cluster.removeLayer(old);
        else this.map.removeLayer(old);
      }

      // Use special icons/labels for Source/Destination when flagged in incident data
      let marker: any;
      const isSource = !!e.is_source;
      const isDest = !!e.is_destination;

      if (isSource || isDest) {
        const icon = isSource ? this.sourceIcon : this.destIcon;
        marker = Leaflet.marker([lat, lng], { icon });
        // Attach a permanent tooltip label next to the marker
        const labelText = isSource ? `Source: ${e.name || 'Dispatch Center'}` : `Destination: ${e.emergency_type || 'Incident Location'}`;
        marker.bindTooltip(labelText, { permanent: true, direction: 'right', className: 'marker-label' });
        // store role for fitBounds filtering
        (marker as any).options.role = isSource ? 'source' : 'destination';
      } else {
        const color = e.status === 'escalated' ? 'red' : (e.status === 'pending' ? 'orange' : 'blue');
        marker = Leaflet.circleMarker([lat, lng], { color, radius: 10, fillOpacity: 0.8 })
          .bindPopup(`<b>${(e.emergency_type || e.type || 'Incident').toUpperCase()}</b><br>Status: ${e.status}<br><small>${e.description || ''}</small>`);
        (marker as any).options.role = 'incident';
      }

      if (this.cluster) this.cluster.addLayer(marker);
      else marker.addTo(this.map);

      this.markers[key] = marker;
    });
  }

  updateResponderMarker(data: any) {
    const key = `res_${data.responderId}`;
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    // Remove old marker if present
    // If clustering is enabled, remove via cluster; otherwise remove from map
    if (this.markers[key]) {
      const old = this.markers[key];
      if (this.cluster) this.cluster.removeLayer(old);
      else this.map.removeLayer(old);
    }

    // Choose color based on role if provided
    const role = data.role || '';
    const bg = role === 'police' ? '#0ea5a4' : (role === 'fire' ? '#ef4444' : (role === 'ambulance' ? '#6366f1' : '#f97316'));

    const html = `<div style="background:${bg};width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${(data.name?data.name[0]:'R')}</div>`;

    const icon = Leaflet.divIcon({ html, className: 'responder-icon', iconSize: [36, 36], iconAnchor: [18, 18] });

    const marker = Leaflet.marker([lat, lng], { icon })
      .bindPopup(`<b>${data.name || 'Responder'}</b><br>ID: ${data.responderId}<br>Role: ${role || '—'}<br>Updated: ${new Date((data.ts || Date.now()/1000)*1000).toLocaleString()}`);

    // Add to cluster if available, else to map
    if (this.cluster) this.cluster.addLayer(marker);
    else marker.addTo(this.map);

    this.markers[key] = marker;

    // Animate marker movement if it existed before (smooth transition)
    // We'll perform a simple interpolation from previous position if available
    // (the previous marker was removed above, but we can check responderList for last coords)
    const prev = this.responderList.find(r => r.responderId === data.responderId);
    if (prev && typeof prev.lat === 'number' && typeof prev.lng === 'number') {
      this.animateMarker(this.markers[key], [prev.lat, prev.lng], [lat, lng], 800);
    }

    // Update responder list (or add)
    const existing = this.responderList.find(r => r.responderId === data.responderId);
    const entry = { responderId: String(data.responderId), name: data.name, role: data.role, lat, lng, ts: data.ts };
    if (existing) {
      Object.assign(existing, entry);
    } else {
      this.responderList.unshift(entry);
      // keep list reasonably small
      if (this.responderList.length > 50) this.responderList.pop();
    }
  }

  centerOnResponder(responderId: string) {
    const key = `res_${responderId}`;
    const marker = this.markers[key];
    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 15, { animate: true });
      marker.openPopup();
    } else {
      const r = this.responderList.find(rr => rr.responderId === responderId);
      if (r && this.map && typeof r.lat === 'number' && typeof r.lng === 'number') {
        this.map.setView([r.lat, r.lng], 15, { animate: true });
      }
    }
  }

  fitAll() {
    const latlngs: any[] = [];
    Object.keys(this.markers).forEach(k => {
      const m = this.markers[k];
      if (m && m.getLatLng) latlngs.push(m.getLatLng());
    });
    if (latlngs.length === 0 && this.incidents.length > 0) {
      latlngs.push(...this.incidents.map(i => Leaflet.latLng(i.latitude, i.longitude)));
    }
    if (latlngs.length > 0) this.map.fitBounds(Leaflet.latLngBounds(latlngs), { padding: [60, 60] });
  }

  // Smoothly animate a marker from 'from' [lat,lng] to 'to' [lat,lng]
  animateMarker(marker: any, from: [number, number], to: [number, number], duration = 800) {
    if (!marker || !this.map) return;
    const start = { lat: from[0], lng: from[1] };
    const end = { lat: to[0], lng: to[1] };
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;
      marker.setLatLng([lat, lng]);
      if (t < 1) requestAnimationFrame(step);
      else {
        marker.setLatLng([end.lat, end.lng]);
        if (this.cluster) (this.cluster as any).refreshClusters();
      }
    };

    requestAnimationFrame(step);
  }

  approve(id: number) {
    this.emergencyService.approveUser(id).subscribe(() => this.loadData());
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.map) this.map.remove();
  }
}
