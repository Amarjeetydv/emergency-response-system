import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyService } from './emergency.service';
import { AuthService } from './auth.service'; // Assuming AuthService exists

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
            <span class="badge bg-warning">Pending</span>
          </div>
          <p>Distance: Calculating...</p>
          
          <div class="form-check mb-3" *ngIf="e.status === 'pending'">
            <input type="checkbox" class="form-check-input" [id]="'share-' + e.id" [(ngModel)]="consentMap[e.id]" [name]="'consent-' + e.id">
            <label class="form-check-label" [for]="'share-' + e.id">I agree to share my live location with dispatch</label>
          </div>

          <button 
            class="btn w-100" 
            [ngClass]="e.status === 'pending' ? 'btn-danger' : 'btn-success'"
            (click)="onAccept(e.id)"
            [disabled]="processingMap[e.id] || e.status !== 'pending' || !consentMap[e.id]">
            {{ e.status === 'pending' ? (processingMap[e.id] ? 'Processing...' : 'ACCEPT EMERGENCY') : 'ACCEPTED' }}
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

  private emergencyService = inject(EmergencyService);
  private authService = inject(AuthService);

  trackByEmergencyId(index: number, item: any): number {
    return item.id;
  }

  ngOnInit() {
    const user = this.authService.getUser();
    this.myUserId = user?.id ?? user?._id ?? 0;

    this.loadNearbyEmergencies();

    // Real-time: Listen for updates
    this.emergencyService.getLiveUpdates().subscribe(ev => {
      if (ev.type === 'NEW') {
        this.loadNearbyEmergencies();
      }
      // Only remove from list if someone ELSE accepted it
      if (ev.type === 'STATUS' && ev.data.status !== 'pending' && ev.data.assigned_responder !== this.myUserId) {
        // Remove from list if someone else accepted it
        this.emergencies = this.emergencies.filter(x => x.id !== ev.data.id);
      }
    });
  }

  loadNearbyEmergencies() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        this.emergencyService.getNearby(pos.coords.latitude, pos.coords.longitude)
          .subscribe(data => {
            // Show pending requests or requests already assigned to me
            this.emergencies = data.filter(e => e.status === 'pending' || e.assigned_responder === this.myUserId);
          });
      });
    }
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
            alert(err.error?.message || 'Failed to accept request');
          }
        });
      },
      () => {
        this.processingMap[requestId] = false;
        alert('Location access is required to accept emergencies.');
      }
    );
  }
}
