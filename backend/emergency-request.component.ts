import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { EmergencyService } from './emergency.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-emergency-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emergency-request.component.html',
  styleUrls: ['./emergency-request.component.scss']
})
export class EmergencyRequestComponent implements OnInit {
  map!: L.Map;
  private activeMarker?: L.Marker;
  emergencyType: string = 'Medical';
  // Initialize with null to satisfy strict null checks
  lat: number | null = null;
  lng: number | null = null;
  isSubmitting: boolean = false;

  constructor(private emergencyService: EmergencyService) {}

  ngOnInit() {
    this.initMap();
  }

  initMap() {
    // Fix for Leaflet default marker icons in Angular
    const iconDefault = L.icon({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Initialize map
    this.map = L.map('map', {
      center: [0, 0],
      zoom: 2
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    this.map.locate({ setView: true, maxZoom: 16 });

    // Use explicit type L.LocationEvent for better type safety
    this.map.on('locationfound', (e: L.LocationEvent) => {
      this.lat = e.latlng.lat;
      this.lng = e.latlng.lng;
      this.updateMarker(e.latlng, "You are here");
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.lat = e.latlng.lat;
      this.lng = e.latlng.lng;
      this.updateMarker(e.latlng);
    });
  }

  private updateMarker(latlng: L.LatLngExpression, popupText?: string) {
    if (this.activeMarker) {
      this.map.removeLayer(this.activeMarker);
    }
    this.activeMarker = L.marker(latlng).addTo(this.map);
    if (popupText) {
      this.activeMarker.bindPopup(popupText).openPopup();
    }
  }

  submitRequest() {
    if (this.lat === null || this.lng === null) {
      alert('Please wait for your location to be found or click on the map.');
      return;
    }

    this.isSubmitting = true;
    const data = {
      emergency_type: this.emergencyType,
      latitude: this.lat,
      longitude: this.lng
    };

    this.emergencyService.createEmergency(data).subscribe({
      next: (res) => {
        alert('Emergency Reported! Help is on the way.');
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting = false;
      }
    });
  }
}
