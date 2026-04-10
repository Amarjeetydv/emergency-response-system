import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const t = u?.token;
    return new HttpHeaders(t ? { Authorization: `Bearer ${t}` } : {});
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:5000/api/auth/users', { headers: this.headers() });
  }

  approveResponder(userId: number): Observable<any> {
    return this.http.patch(
      `http://localhost:5000/api/auth/users/${userId}/approve`,
      {},
      { headers: this.headers() }
    );
  }

  updateUserRole(userId: number, newRole: string): Observable<any> {
    return this.http.patch(
      `http://localhost:5000/api/auth/users/${userId}/role`,
      { role: newRole },
      { headers: this.headers() }
    );
  }
}
