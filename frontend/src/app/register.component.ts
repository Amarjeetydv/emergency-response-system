import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './login.component.scss' // Reusing auth styles
})
export class RegisterComponent {
  user = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'citizen'
  };

  errorMessage: string = '';
  successMessage: string = '';
  isSubmitting: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  onRegister() {
    if (this.user.password !== this.user.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const registrationData = {
      name: this.user.name,
      email: this.user.email,
      password: this.user.password,
      role: this.user.role
    };

    this.http.post<any>('http://localhost:5000/api/auth/register', registrationData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.errorMessage = '';
        this.successMessage = 'Account created successfully! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Registration failed. Try again.';
      }
    });
  }
}
