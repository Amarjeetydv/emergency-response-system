import { Component, OnInit } from '@angular/core';
import { EmergencyService } from './emergency.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var mappls: any;

@Component({
  selector: 'app-emergency-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emergency-request.component.html',
  styleUrls: ['./emergency-request.component.scss']
})
export class EmergencyRequestComponent implements OnInit {
  map: any;
  private activeMarker?: any;
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
    this.map = new mappls.Map('map', {
      center: [0, 0],
      zoom: 2,
      hybrid: true
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.lat = pos.coords.latitude;
        this.lng = pos.coords.longitude;
        this.map.setCenter([this.lat, this.lng]);
        this.updateMarker({ lat: this.lat, lng: this.lng }, "You are here");
      });
    }

    this.map.addListener('click', (e: any) => {
      this.lat = e.lngLat.lat;
      this.lng = e.lngLat.lng;
      this.updateMarker({ lat: this.lat, lng: this.lng });
    });
  }

  private updateMarker(latlng: {lat: number, lng: number}, popupText?: string) {
    if (!this.activeMarker) {
      this.activeMarker = new mappls.Marker({
        map: this.map,
        position: latlng,
        popupHtml: popupText,
        draggable: true
      });
    } else {
      this.activeMarker.setPosition(latlng);
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
