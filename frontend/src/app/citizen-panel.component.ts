import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmergencyRequestComponent } from './emergency-request.component';
import { EmergencyService } from './emergency.service';

@Component({
  selector: 'app-citizen-panel',
  standalone: true,
  imports: [CommonModule, EmergencyRequestComponent],
  template: `
    <section class="citizen-dashboard">
      <div class="welcome-banner">
        <h2>Emergency Portal</h2>
        <p>Rapid response coordination for registered citizens.</p>
      </div>
      <div class="content-grid">
        <app-emergency-request></app-emergency-request>

        <div class="emergency-list card glass-panel">
          <h3>Your Recent Emergency Requests</h3>
          <p *ngIf="userEmergencies.length === 0">No emergency requests found.</p>
          <div *ngFor="let emergency of userEmergencies; trackBy: trackById" class="emergency-item">
            <div class="emergency-header">
              <h4>Emergency #{{ emergency.id }} - {{ emergency.emergency_type | titlecase }}</h4>
              <span class="status-badge status-{{ emergency.status }}">{{ emergency.status | titlecase }}</span>
            </div>
            <p class="reported-at">Reported: {{ emergency.created_at | date:'medium' }}</p>
            
            <div *ngIf="emergency.status !== 'cancelled'" class="status-stepper" [ngClass]="'stepper-status-' + emergency.status">
              <div class="step" [class.active]="isStepActive(emergency.status, 'pending')">
                <div class="circle" [class.filled]="isStepActive(emergency.status, 'pending')"></div>
                <div class="label" [ngClass]="{'active-status pending': emergency.status === 'pending'}">Pending</div>
              </div>
              <div class="line" [class.active]="isLineActive(emergency.status, 'pending', 'accepted')"></div>
              <div class="step" [class.active]="isStepActive(emergency.status, 'accepted')">
                <div class="circle" [class.filled]="isStepActive(emergency.status, 'accepted')"></div>
                <div class="label" [ngClass]="{'active-status accepted': emergency.status === 'accepted'}">Accepted</div>
              </div>
              <div class="line" [class.active]="isLineActive(emergency.status, 'accepted', 'in_progress')"></div>
              <div class="step" [class.active]="isStepActive(emergency.status, 'in_progress')">
                <div class="circle" [class.filled]="isStepActive(emergency.status, 'in_progress')"></div>
                <div class="label" [ngClass]="{'active-status in_progress': emergency.status === 'in_progress'}">In Progress</div>
              </div>
              <div class="line" [class.active]="isLineActive(emergency.status, 'in_progress', 'completed')"></div>
              <div class="step" [class.active]="isStepActive(emergency.status, 'completed')">
                <div class="circle" [class.filled]="isStepActive(emergency.status, 'completed')"></div>
                <div class="label" [ngClass]="{'active-status completed': emergency.status === 'completed'}">Completed</div>
              </div>
            </div>
            <p *ngIf="emergency.status === 'cancelled'" class="cancelled-message">This emergency was cancelled.</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .citizen-dashboard { animation: fadeIn 0.5s ease-out; }
    .welcome-banner { margin-bottom: 2rem; padding: 1.5rem; border-radius: 12px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; }
    .welcome-banner h2 { font-size: 1.8rem; margin: 0; color: #fff; }
    .welcome-banner p { color: rgba(255,255,255,0.7); margin: 0.5rem 0 0; }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .emergency-list { margin-top: 2rem; padding: 1.5rem; }
    .emergency-list h3 { margin-bottom: 1.5rem; color: var(--text-color); }
    .emergency-item {
      background-color: var(--background-light);
      border-radius: 10px;
      padding: 1.2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border: 1px solid var(--border-color);
    }
    .emergency-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .emergency-header h4 { margin: 0; color: var(--primary); font-size: 1.1rem; }
    .reported-at { font-size: 0.85rem; color: var(--secondary); margin-bottom: 1rem; }
    .cancelled-message { color: var(--danger); font-weight: 600; text-align: center; margin-top: 1rem; }

    .status-badge {
      padding: 0.3em 0.6em;
      border-radius: 5px;
      font-size: 0.75rem;
      font-weight: bold;
      color: white;
    }
    .status-pending { background-color: #ff9800; }
    .status-accepted { background-color: var(--info); }
    .status-in_progress { background-color: var(--primary); }
    .status-completed { background-color: #4caf50; }
    .status-cancelled { background-color: var(--danger); }

    .active-status {
      padding: 2px 8px;
      border-radius: 4px;
      color: white !important;
      font-weight: bold;
    }
    .active-status.pending { background-color: #ff9800; }
    .active-status.accepted { background-color: var(--info); }
    .active-status.in_progress { background-color: var(--primary); }
    .active-status.completed { background-color: #4caf50; }

    .status-stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1.5rem;
      position: relative;
    }
    .status-stepper .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    .status-stepper .circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: var(--border-color);
      border: 2px solid var(--border-color);
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }
    .status-stepper .circle.filled {
      background-color: var(--primary);
      border-color: var(--primary);
    }
    .status-stepper .step.active .circle {
      background-color: var(--primary);
      border-color: var(--primary);
    }
    .status-stepper .step.active .label {
      color: var(--primary);
      font-weight: 600;
    }
    .status-stepper .label {
      font-size: 0.75rem;
      margin-top: 0.5rem;
      color: var(--secondary);
      transition: color 0.3s ease;
    }
    .status-stepper .line {
      flex: 1;
      height: 2px;
      background-color: var(--border-color);
      margin: 0 -12px;
      position: relative;
      z-index: 0;
      transition: background-color 0.3s ease;
    }
    .status-stepper .line.active {
      background-color: var(--primary);
    }

    .stepper-status-pending .circle.filled, .stepper-status-pending .line.active {
      background-color: #ff9800 !important;
      border-color: #ff9800 !important;
    }
    .stepper-status-pending .step.active .label { color: #ff9800 !important; }

    .stepper-status-completed .circle.filled, .stepper-status-completed .line.active {
      background-color: #4caf50 !important;
      border-color: #4caf50 !important;
    }
    .stepper-status-completed .step.active .label { color: #4caf50 !important; }
    
    .content-grid { display: grid; gap: 2rem; }
  `]
})
export class CitizenPanelComponent implements OnInit {
  userEmergencies: any[] = [];
  private emergencyService = inject(EmergencyService);

  statusOrder: { [key: string]: number } = {
    'pending': 0,
    'accepted': 1,
    'in_progress': 2,
    'completed': 3
  };

  ngOnInit(): void {
    this.fetchEmergencies();
    this.emergencyService.getLiveUpdates().subscribe(event => {
      if (event.type === 'NEW' || event.type === 'STATUS') {
        this.fetchEmergencies();
      }
    });
  }

  fetchEmergencies(): void {
    this.emergencyService.getEmergencies().subscribe({
      next: (emergencies) => {
        this.userEmergencies = emergencies;
      },
      error: (err) => {
        console.error('Error fetching emergencies:', err);
        this.userEmergencies = [];
      }
    });
  }

  isStepActive(currentStatus: string, step: string): boolean {
    if (currentStatus === 'cancelled') return false;
    return this.statusOrder[currentStatus] >= this.statusOrder[step];
  }

  isLineActive(currentStatus: string, startStep: string, endStep: string): boolean {
    if (currentStatus === 'cancelled') return false;
    return this.statusOrder[currentStatus] >= this.statusOrder[endStep];
  }

  trackById(index: number, item: any): number {
    return item.id;
  }
}
