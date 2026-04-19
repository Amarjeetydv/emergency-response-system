import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EmergencyService } from './emergency.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  credentials = {
    email: '',
    password: ''
  };

  errorMessage: string = '';
  isSubmitting: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private emergencyService: EmergencyService
  ) {}

  onLogin(form: NgForm) {
    if (form.invalid) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    this.http.post<any>(`${environment.apiUrl}/auth/login`, this.credentials).subscribe({
      next: (user) => {
        this.isSubmitting = false;
        localStorage.setItem('user', JSON.stringify(user));
        this.emergencyService.reconnectSocket();
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Invalid email or password';
        console.error('Login error:', err);
      }
    });
  }
}
