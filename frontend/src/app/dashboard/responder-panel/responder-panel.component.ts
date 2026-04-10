import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { EmergencyService } from '../../emergency.service';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-responder-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './responder-panel.component.html',
  styleUrls: ['./responder-panel.component.scss']
})
export class ResponderPanelComponent implements OnInit, OnDestroy {
  emergencies: any[] = [];
  trackLocation = false;
  processingMap: { [key: number]: boolean } = {};
  consentMap: { [key: number]: boolean } = {};
  private sub?: Subscription;
  private geoWatchId?: number;
  private userId = 0;

  constructor(
    private emergencyService: EmergencyService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const u = this.authService.getUser();
    this.userId = u?.id ?? u?._id ?? 0;
    this.load();
    this.sub = this.emergencyService.getLiveUpdates().subscribe((ev) => {
      if (ev.type === 'NEW' || ev.type === 'STATUS') {
        const row = ev.data;
        if (!row?.id) return;
        const i = this.emergencies.findIndex((x) => x.id === row.id);
        if (i >= 0) {
          this.emergencies[i] = row;
        } else {
          this.emergencies = [row, ...this.emergencies];
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.geoWatchId != null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
    }
  }

  load(): void {
    this.emergencyService.getEmergencies().subscribe({
      next: (rows) => (this.emergencies = rows || []),
      error: () => (this.emergencies = [])
    });
  }

  accept(e: any): void {
    console.log(`[Accept] Initiating for Emergency ID: ${e.id}`);
    
    if (!this.consentMap[e.id]) {
      console.warn(`[Accept] Consent not granted for ID: ${e.id}`);
      alert('Please check the location sharing agreement first.');
      return;
    }

    this.processingMap[e.id] = true;

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      this.finalizeAccept(e, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('[Geolocation] Success:', pos.coords);
        this.finalizeAccept(e, pos);
      },
      (err) => {
        console.warn('[Geolocation] Error/Denied:', err.message);
        this.finalizeAccept(e, null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private finalizeAccept(e: any, pos: GeolocationPosition | null): void {
    const payload: any = { status: 'accepted' };
    if (pos) {
      payload.responder_lat = pos.coords.latitude;
      payload.responder_lng = pos.coords.longitude;
    }

    this.emergencyService.updateStatus(e.id, payload).subscribe({
      next: () => {
        console.log(`[Accept] API Success for ID: ${e.id}`);
        this.processingMap[e.id] = false;
        
        if (pos) {
          this.emergencyService.emitResponderLocation({
            responderId: this.userId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        }

        // Visual feedback: update local object immediately
        e.status = 'accepted';
        e.assigned_responder = this.userId;
        this.load(); // Refresh list to get latest details
      },
      error: (err) => {
        console.error('[Accept] API Error:', err);
        this.processingMap[e.id] = false;
        alert('Failed to accept request. Please try again.');
      }
    });
  }

  startProgress(e: any): void {
    this.emergencyService.updateStatus(e.id, { status: 'in_progress' }).subscribe(() => this.load());
  }

  complete(e: any): void {
    this.emergencyService.updateStatus(e.id, { status: 'completed' }).subscribe(() => this.load());
  }

  toggleSharing(): void {
    this.trackLocation = !this.trackLocation;
    if (!this.trackLocation && this.geoWatchId != null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = undefined;
      return;
    }
    if (!navigator.geolocation || !this.userId) return;
    this.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.emergencyService.emitResponderLocation({
          responderId: this.userId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  trackById(index: number, item: any): number {
    return item.id;
  }

  isAssigned(e: any): boolean {
    return e.assigned_responder === this.userId;
  }

  canAccept(e: any): boolean {
    return e.status === 'pending';
  }

  canStart(e: any): boolean {
    return e.status === 'accepted' && this.isAssigned(e);
  }

  canComplete(e: any): boolean {
    return e.status === 'in_progress' && this.isAssigned(e);
  }

  formatStatus(s: string): string {
    return (s || '').replace(/_/g, ' ');
  }
}
