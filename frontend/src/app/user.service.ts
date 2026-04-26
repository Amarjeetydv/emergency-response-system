import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private authUrl = environment.apiUrl ? `${environment.apiUrl}/auth` : '/api/auth';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const directToken = localStorage.getItem('token');
    if (directToken) {
      return new HttpHeaders({ Authorization: `Bearer ${directToken}` });
    }

    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const t = u?.token;
    return new HttpHeaders(t ? { Authorization: `Bearer ${t}` } : {});
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.authUrl}/users`, { headers: this.headers() });
  }

  approveResponder(userId: number): Observable<any> {
    return this.http.patch(
      `${this.authUrl}/users/${userId}/approve`,
      {},
      { headers: this.headers() }
    );
  }

  updateUserRole(userId: number, newRole: string): Observable<any> {
    return this.http.patch(
      `${this.authUrl}/users/${userId}/role`,
      { role: newRole },
      { headers: this.headers() }
    );
  }
}
