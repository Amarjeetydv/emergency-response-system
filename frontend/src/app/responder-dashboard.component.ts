import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyService } from './emergency.service';
import { AuthService } from './auth.service'; // Assuming AuthService exists
import { environment } from '../environments/environment';
import { getMessaging, getToken, onMessage } from "firebase/messaging";

@Component({
  selector: 'app-responder-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container p-4">
      <h2>🚑 Available Emergencies (Nearby)</h2>
      
      <div *ngIf="emergencies.length === 0" class="alert alert-info">
        No pending emergencies in your area.
      </div>

      <div class="grid">
        <div *ngFor="let e of emergencies; trackBy: trackByEmergencyId" class="card glass-panel mb-3 p-3">
          <div class="d-flex justify-content-between">
            <h4>{{ e.emergency_type | titlecase }}</h4>
            <span class="badge" [ngClass]="{
              'bg-warning': e.status === 'pending',
              'bg-danger': e.status === 'escalated',
              'bg-info': e.status === 'accepted',
              'bg-primary': e.status === 'in_progress'
            }">{{ e.status | uppercase }}</span>
          </div>
          
          <p class="text-muted small mb-2" *ngIf="currentCoords">
            📍 <strong>Distance:</strong> {{ getDistanceToIncident(e) }} km away
          </p>
          
          <div class="form-check mb-3" *ngIf="e.status === 'pending'">
            <input type="checkbox" class="form-check-input" [id]="'share-' + e.id" [(ngModel)]="consentMap[e.id]" [name]="'consent-' + e.id">
            <label class="form-check-label" [for]="'share-' + e.id">I agree to share my live location with dispatch</label>
          </div>

          <!-- Lifecycle Actions -->
          <button *ngIf="e.status === 'pending'"
            class="btn btn-danger w-100" 
            (click)="onAccept(e.id)" [disabled]="processingMap[e.id] || !consentMap[e.id]">
            {{ processingMap[e.id] ? 'Accepting...' : 'ACCEPT EMERGENCY' }}
          </button>

          <button *ngIf="e.status === 'accepted'"
            class="btn btn-primary w-100" 
            (click)="updateLifecycle(e.id, 'in_progress')">
            MARK AS ARRIVED / IN PROGRESS
          </button>

          <button *ngIf="e.status === 'in_progress'"
            class="btn btn-success w-100" 
            (click)="updateLifecycle(e.id, 'completed')">
            MARK AS COMPLETED
          </button>
        </div>
      </div>
    </div>
  `
})
export class ResponderDashboardComponent implements OnInit {
  emergencies: any[] = [];
  myUserId = 0;
  consentMap: { [key: number]: boolean } = {};
  processingMap: { [key: number]: boolean } = {};
  currentCoords: { lat: number, lng: number } | null = null;

  private emergencyService = inject(EmergencyService);
  private authService = inject(AuthService);

  trackByEmergencyId(index: number, item: any): number {
    return item.id;
  }

  ngOnInit() {
    const user = this.authService.getUser();
    this.myUserId = user?.id ?? user?._id ?? 0;

    this.loadNearbyEmergencies();
    this.setupNotifications();

    // Real-time: Listen for updates
    this.emergencyService.getLiveUpdates().subscribe(ev => {
      if (ev.type === 'NEW') {
        this.loadNearbyEmergencies();
      }
      if (ev.type === 'STATUS') {
        const row = ev.data;
        // Remove from list if someone else accepted it, or if it's finished
        if ((row.status === 'accepted' && row.assigned_responder !== this.myUserId) || 
            ['completed', 'cancelled'].includes(row.status)) {
          this.emergencies = this.emergencies.filter(x => x.id !== row.id);
        } else {
          // Update status for items already in list (e.g. transition to 'escalated')
          const idx = this.emergencies.findIndex(x => x.id === row.id);
          if (idx !== -1) {
            this.emergencies[idx] = row;
          }
        }
      }
    });
  }

  async setupNotifications() {
    try {
      const messaging = getMessaging();
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: environment.vapidKey });
        
        if (token) {
          this.emergencyService.updateDeviceToken(token).subscribe();
        }
      }

      onMessage(messaging, (payload: any) => {
        console.log('Foreground Message received: ', payload);
      });
    } catch (err) {
      console.error('Unable to get permission or token', err);
    }
  }

  loadNearbyEmergencies() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        this.currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.emergencyService.getNearby(pos.coords.latitude, pos.coords.longitude)
          .subscribe(data => {
            // Show pending requests or requests already assigned to me
            this.emergencies = data.filter(e => 
              e.status === 'pending' || 
              e.status === 'escalated' || 
              e.assigned_responder === this.myUserId
            );
          });
      });
    }
  }

  getDistanceToIncident(emergency: any): number {
    if (!this.currentCoords) return 0;
    return this.emergencyService.calculateDistance(
      this.currentCoords.lat,
      this.currentCoords.lng,
      emergency.latitude,
      emergency.longitude
    );
  }

  onAccept(requestId: number) {
    if (!this.consentMap[requestId]) {
      alert('You must agree to share your location to accept this request.');
      return;
    }

    this.processingMap[requestId] = true;
    
    // Step 1: Get current responder location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const payload = {
          request_id: requestId,
          responder_lat: pos.coords.latitude,
          responder_lng: pos.coords.longitude
        };

        // Step 2: Call Backend API
        this.emergencyService.acceptRequest(payload).subscribe({
          next: () => {
            this.processingMap[requestId] = false;
            
            // Send live location update via Socket.io
            this.emergencyService.emitResponderLocation({
              responderId: this.myUserId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            });

            // Update local status so the button changes state immediately
            const emergency = this.emergencies.find(e => e.id === requestId);
            if (emergency) {
              emergency.status = 'accepted';
              emergency.assigned_responder = this.myUserId;
            }
            alert('Emergency Accepted! Navigate to the location.');
          },
          error: (err) => {
            this.processingMap[requestId] = false;
            
            if (err.status === 409) {
              alert('Incident already claimed. Thank you for your readiness!');
              this.emergencies = this.emergencies.filter(x => x.id !== requestId);
            } else {
              alert(err.error?.message || 'An error occurred while accepting the request.');
            }
          }
        });
      },
      () => {
        this.processingMap[requestId] = false;
        alert('Location access is required to accept emergencies.');
      }
    );
  }

  updateLifecycle(id: number, nextStatus: string) {
    this.emergencyService.updateStatus(id, { status: nextStatus }).subscribe(() => {
      const emergency = this.emergencies.find(e => e.id === id);
      if (emergency) emergency.status = nextStatus;
    });
  }
}
