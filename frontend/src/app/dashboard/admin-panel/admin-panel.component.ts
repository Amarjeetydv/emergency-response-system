import { Component, OnDestroy, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { UserService } from '../../user.service';
import { EmergencyService } from '../../emergency.service';

declare var L: any;

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss']
})
export class AdminPanelComponent implements OnInit, OnDestroy, AfterViewInit {
  tab: 'emergencies' | 'users' | 'logs' | 'track' = 'emergencies';

  users: any[] = [];
  emergencies: any[] = [];
  logs: any[] = [];

  private sub?: Subscription;
  private map?: any;
  private markers = new Map<number, any>();
  private mapReady = false;

  constructor(
    private userService: UserService,
    private emergencyService: EmergencyService
  ) {}

  ngOnInit(): void {
    this.refreshData();
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
      if (ev.type === 'LOCATION') {
        this.applyResponderPing(ev.data);
      }
    });
  }

  ngAfterViewInit(): void {
    this.mapReady = true;
    if (this.tab === 'track') {
      this.initMapSoon();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.teardownMap();
  }

  setTab(t: typeof this.tab): void {
    if (this.tab === 'track' && t !== 'track') {
      this.teardownMap();
    }
    this.tab = t;
    if (t === 'track') {
      this.initMapSoon();
    }
  }

  private teardownMap(): void {
    this.markers.forEach((m) => m.remove());
    this.markers.clear();
    this.map?.remove();
    this.map = undefined;
  }

  private initMapSoon(): void {
    if (!this.mapReady) return;
    setTimeout(() => this.ensureMap(), 0);
  }

  private ensureMap(): void {
    const el = document.getElementById('admin-responder-map');
    if (!el || this.map) return;

    this.map = L.map(el).setView([20, 78], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  private applyResponderPing(data: { responderId?: number; latitude?: number; longitude?: number }): void {
    const id = data?.responderId;
    const lat = data?.latitude;
    const lng = data?.longitude;
    if (id == null || lat == null || lng == null) return;

    this.ensureMap();
    if (!this.map) return;

    let m = this.markers.get(id);
    if (!m) {
      m = L.marker([lat, lng]).addTo(this.map);
      m.bindPopup(`Responder #${id}`);
      this.markers.set(id, m);
    } else {
      m.setLatLng([lat, lng]);
    }
    this.map.panTo([lat, lng]);
  }

  refreshData(): void {
    this.userService.getUsers().subscribe({
      next: (u) => (this.users = u || []),
      error: () => (this.users = [])
    });
    this.emergencyService.getEmergencies().subscribe({
      next: (e) => (this.emergencies = e || []),
      error: () => (this.emergencies = [])
    });
    this.emergencyService.getLogs().subscribe({
      next: (l) => (this.logs = l || []),
      error: () => (this.logs = [])
    });
  }

  onRoleChange(userId: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.userService.updateUserRole(userId, value).subscribe(() => this.refreshData());
  }

  onApprove(userId: number): void {
    this.userService.approveResponder(userId).subscribe(() => this.refreshData());
  }

  formatStatus(s: string): string {
    return (s || '').replace(/_/g, ' ');
  }
}
