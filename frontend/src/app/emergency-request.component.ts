import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyService } from './emergency.service';
import { Router } from '@angular/router';

declare var L: any; // Leaflet Global Variable

@Component({
  selector: 'app-emergency-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="request-container glass-panel shadow-lg">
      <div class="header-urgent">
        <h2>🚨 Report Emergency</h2>
        <p>Your location will be sent to dispatchers immediately.</p>
      </div>
      
      <p class="instruction-text">Tap the map or drag the marker to your location</p>
      <div class="map-wrapper">
        <div id="map" class="mini-map"></div>
      </div>
      
      <div class="location-info" *ngIf="request.latitude !== 0">
        <div class="coord-badge">
          <span class="label">LAT</span>
          <span class="value">{{ request.latitude.toFixed(6) }}</span>
          <span class="label">LNG</span>
          <span class="value">{{ request.longitude.toFixed(6) }}</span>
        </div>
      </div>

      <form (ngSubmit)="submitRequest()">
        <div class="form-group">
          <label>Nature of Emergency</label>
        <select [(ngModel)]="request.emergency_type" name="type" required>
            <option value="police">🚓 Police / Security</option>
            <option value="medical">🚑 Medical Emergency</option>
            <option value="fire">🚒 Fire / Rescue</option>
            <option value="other">❓ Other</option>
        </select>
        </div>
        
        <button type="submit" class="btn-danger btn-block" [disabled]="!request.latitude || isSubmitting">
          {{ isSubmitting ? 'Dispatching Help...' : 'SEND EMERGENCY ALERT' }}
        </button>
      </form>
      <div *ngIf="successMessage" class="success-banner">{{ successMessage }}</div>
      <div *ngIf="errorMessage" class="error-banner">{{ errorMessage }}</div>
    </div>
  `,
  styles: [`
    .request-container {
      padding: 2rem;
      max-width: 500px;
      margin: auto;
    }
    .header-urgent h2 { color: var(--danger); margin-bottom: 0.5rem; }
    #map { height: 250px; width: 100%; }
    .mini-map { 
      height: 250px;
      width: 100% !important;
      display: block;
      margin-bottom: 1.5rem; 
      border-radius: 12px;
      border: 2px solid #eee;
      overflow: hidden;
      z-index: 1;
    }
    .location-info {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .instruction-text { font-size: 0.85rem; color: var(--secondary); margin-bottom: 0.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    select {
      width: 100%;
      padding: 0.8rem;
      border-radius: 8px;
      border: 1px solid #ddd;
      margin-bottom: 1.5rem;
      font-size: 1rem;
    }
    .btn-block { width: 100%; padding: 1rem; font-size: 1.1rem; }
    
    .success-banner {
      background: var(--success);
      color: white;
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 8px;
      text-align: center;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
    `]
})
export class EmergencyRequestComponent implements OnInit, AfterViewInit {
  @Input() embedMode = false;
  @Output() submitted = new EventEmitter<void>();

  request = { emergency_type: 'police', latitude: 0, longitude: 0 };
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  private map: any;
  private marker: any;

  private emergencyService = inject(EmergencyService);
  private router = inject(Router);

  ngOnInit() {
    // Initial detection moved to ngAfterViewInit to ensure map is ready
  }

  ngAfterViewInit() {
    // Initialize Leaflet Map
    try {
      // Default center: India [20.5937, 78.9629]
      this.map = L.map('map').setView([20.5937, 78.9629], 5);

      // Add Free Satellite Imagery (Esri World Imagery)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }).addTo(this.map);

      // Auto-detect location on load
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          this.request.latitude = pos.coords.latitude;
          this.request.longitude = pos.coords.longitude;
          this.updateMap(true, "You are here");
        }, () => {
          // Default to New Delhi if location blocked
          this.request.latitude = 28.6139;
          this.request.longitude = 77.2090;
          this.updateMap(true, "Default Location");
        });
      }

      // Map Click Event
      this.map.on('click', (e: any) => {
        this.request.latitude = e.latlng.lat;
        this.request.longitude = e.latlng.lng;
        this.updateMap(false);
      });

      // Fix for map resizing issues in Angular
      setTimeout(() => this.map.invalidateSize(), 500);

    } catch (e) {
      console.error("Leaflet initialization failed", e);
    }
  }

  updateMap(adjustZoom: boolean = true, popupText?: string) {
    if (!this.map) return;

    if (!this.marker) {
      // Fix for default Leaflet icons not loading in some build systems
      const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      this.marker = L.marker([this.request.latitude, this.request.longitude], {
        draggable: true,
        icon: redIcon
      }).addTo(this.map);

      if (popupText) this.marker.bindPopup(popupText).openPopup();

      this.marker.on('dragend', (event: any) => {
        const pos = event.target.getLatLng();
        this.request.latitude = pos.lat;
        this.request.longitude = pos.lng;
      });
    } else {
      this.marker.setLatLng([this.request.latitude, this.request.longitude]);
    }

    if (adjustZoom) this.map.setView([this.request.latitude, this.request.longitude], 16);
    else this.map.panTo([this.request.latitude, this.request.longitude]);
  }

  submitRequest() {
    this.errorMessage = '';
    this.isSubmitting = true;
    this.emergencyService.createEmergency(this.request).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Emergency reported. Responders have been notified.';
        this.submitted.emit();
        if (!this.embedMode) {
          setTimeout(() => this.router.navigate(['/dashboard']), 2500);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Could not submit request.';
      }
    });
  }
}
