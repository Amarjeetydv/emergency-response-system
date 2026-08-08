import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EmergencyService } from './emergency.service';
import { AuthService } from './auth.service';

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
    private emergencyService: EmergencyService,
    private authService: AuthService
  ) {}

  private getRoleFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return String(payload?.role || '').toLowerCase().trim();
    } catch {
      return '';
    }
  }

  private getLandingRouteByRole(role: string): string {
    // All roles are rendered inside the shared dashboard route.
    return '/dashboard';
  }

  onLogin(form: NgForm) {
    if (form.invalid) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService.login(this.credentials).subscribe({
      next: (res: any) => {
        const token = res?.token || '';
        const roleFromUser = String(res?.user?.role || '').toLowerCase().trim();
        const roleFromToken = token ? this.getRoleFromToken(token) : '';
        const role = roleFromUser || roleFromToken || 'citizen';

        // keep backward compatibility with any existing guards/services
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({ ...(res?.user || {}), token }));
        localStorage.setItem('role', role);
        localStorage.setItem('userRole', role);

        this.router.navigateByUrl(this.getLandingRouteByRole(role), { replaceUrl: true });
        this.isSubmitting = false;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Invalid email or password';
        console.error('Login error:', err);
      }
    });
  }

  logout() {
    localStorage.clear(); sessionStorage.clear(); location.reload();
  }
}
