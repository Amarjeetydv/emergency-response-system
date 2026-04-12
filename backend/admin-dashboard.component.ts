import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmergencyService } from '../emergency.service';
import * as L from 'leaflet';
import 'leaflet.heat';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-container p-4">
      <header class="mb-4">
        <h1>🛡️ Admin Command Center</h1>
      </header>

      <!-- Stats Section -->
      <div class="row mb-4" *ngIf="stats">
        <div class="col-md-3">
          <div class="card p-3 bg-light">
            <h5>🚨 Total Requests</h5>
            <h2>{{ stats.totalEmergencies }}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card p-3 bg-danger text-white">
            <h5>🔥 Escalated</h5>
            <h2>{{ stats.statusCounts.escalated }}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card p-3 bg-info text-white">
            <h5>🚑 Active Responders</h5>
            <h2>{{ stats.responderStats.total }}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card p-3 bg-warning">
            <h5>⏳ Pending Approval</h5>
            <h2>{{ stats.responderStats.pendingApproval }}</h2>
          </div>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><button class="nav-link" [class.active]="activeTab === 'map'" (click)="activeTab = 'map'">Live Tracking</button></li>
        <li class="nav-item"><button class="nav-link" [class.active]="activeTab === 'users'" (click)="activeTab = 'users'">User Management</button></li>
      </ul>

      <div [hidden]="activeTab !== 'map'">
        <div class="mb-2">
          <button class="btn btn-sm" [ngClass]="showHeatmap ? 'btn-dark' : 'btn-outline-dark'" (click)="toggleHeatmap()">
            {{ showHeatmap ? '🔥 Hide Heatmap' : '🔥 Show Heatmap' }}
          </button>
        </div>
        <div id="adminMap" style="height: 600px; border-radius: 10px;"></div>
      </div>

      <div *ngIf="activeTab === 'users'">
        <table class="table glass-panel">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td>{{ u.name }}</td>
              <td><span class="badge bg-secondary">{{ u.role }}</span></td>
              <td>
                <span class="badge" [ngClass]="u.approval_status === 'approved' ? 'bg-success' : 'bg-warning'">
                  {{ u.approval_status || 'N/A' }}
                </span>
              </td>
              <td>
                <button *ngIf="u.approval_status === 'pending'" class="btn btn-sm btn-success" (click)="approve(u.id)">Approve</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeTab: 'map' | 'users' = 'map';
  stats: any;
  users: any[] = [];
  showHeatmap = false;
  private map!: L.Map;
  private markers: { [key: string]: L.Marker } = {};
  private heatmapLayer: any;
  private subs = new Subscription();
  private emergencyService = inject(EmergencyService);

  ngOnInit() {
    this.loadData();
    setTimeout(() => this.initMap(), 100);

    this.subs.add(this.emergencyService.getLiveUpdates().subscribe(() => this.loadData()));
    this.subs.add(this.emergencyService.onResponderLocationUpdate().subscribe(data => this.updateResponderMarker(data)));
  }

  loadData() {
    this.emergencyService.getAnalytics().subscribe(s => this.stats = s);
    this.emergencyService.getUsers().subscribe(u => this.users = u);
    this.emergencyService.getEmergencies().subscribe(list => {
      this.updateIncidentMarkers(list);
      this.updateHeatmap(list);
    });
  }

  initMap() {
    this.map = L.map('adminMap').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
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
      if (this.markers[key]) this.map.removeLayer(this.markers[key]);
      
      const color = e.status === 'escalated' ? 'red' : (e.status === 'pending' ? 'orange' : 'blue');
      const marker = L.circleMarker([e.latitude, e.longitude], {
        color, radius: 10, fillOpacity: 0.8
      }).bindPopup(`<b>${e.emergency_type}</b><br>Status: ${e.status}`);
      
      marker.addTo(this.map);
      this.markers[key] = marker;
    });
  }

  updateResponderMarker(data: any) {
    const key = `res_${data.responderId}`;
    if (this.markers[key]) this.map.removeLayer(this.markers[key]);

    const icon = L.divIcon({
      html: '<div style="font-size: 24px;">🚑</div>',
      className: 'responder-icon'
    });

    const marker = L.marker([data.latitude, data.longitude], { icon })
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
