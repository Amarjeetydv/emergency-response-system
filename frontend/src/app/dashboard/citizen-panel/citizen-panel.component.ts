import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EmergencyService } from '../../emergency.service';
import { EmergencyRequestComponent } from '../../emergency-request.component';

@Component({
  selector: 'app-citizen-panel',
  standalone: true,
  imports: [CommonModule, EmergencyRequestComponent],
  templateUrl: './citizen-panel.component.html',
  styleUrls: ['./citizen-panel.component.scss']
})
export class CitizenPanelComponent implements OnInit, OnDestroy {
  emergencies: any[] = [];
  private sub?: Subscription;

  constructor(private emergencyService: EmergencyService) {}

  ngOnInit(): void {
    this.refresh();
    this.sub = this.emergencyService.getLiveUpdates().subscribe((ev) => {
      if (ev.type === 'NEW' || ev.type === 'STATUS') {
        this.refresh();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(): void {
    this.emergencyService.getEmergencies().subscribe({
      next: (rows) => (this.emergencies = rows || []),
      error: () => (this.emergencies = [])
    });
  }

  cancel(id: number): void {
    this.emergencyService.updateStatus(id, { status: 'cancelled' }).subscribe(() => this.refresh());
  }
}
