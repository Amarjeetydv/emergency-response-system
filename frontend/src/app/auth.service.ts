import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = environment.apiUrl ? `${environment.apiUrl}/auth` : '/api/auth';

  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.authUrl}/login`, credentials);
  }

  getUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
  }

  getToken(): string | null {
    const directToken = localStorage.getItem('token');
    if (directToken) return directToken;
    return this.getUser()?.token || null;
  }

  isAuthenticated(): boolean {
    return !!this.getUser() && !!this.getToken();
  }

  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    location.href = '/login';
  }
}
