import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export type LiveEvent =
  | { type: 'NEW'; data: any }
  | { type: 'STATUS'; data: any }
  | { type: 'LOCATION'; data: { responderId?: number; latitude?: number; longitude?: number } };

@Injectable({
  providedIn: 'root'
})
export class EmergencyService {
  private apiUrl = 'http://localhost:5000/api/emergencies';
  private adminUrl = 'http://localhost:5000/api/admin';
  private socket: Socket;
  private updates = new Subject<LiveEvent>();

  constructor(private http: HttpClient) {
    const token = this.getToken();
    this.socket = io('http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('newEmergency', (data) => this.updates.next({ type: 'NEW', data }));
    this.socket.on('emergencyUpdate', (data) => this.updates.next({ type: 'STATUS', data }));
    this.socket.on('responderLocationUpdate', (data) => this.updates.next({ type: 'LOCATION', data }));
  }

  getLiveUpdates(): Observable<LiveEvent> {
    return this.updates.asObservable();
  }

  /** Call when user logs in so the socket uses a fresh token (optional reconnect). */
  reconnectSocket(): void {
    this.socket.disconnect();
    const token = this.getToken();
    this.socket = io('http://localhost:5000', { auth: { token } });
    this.socket.on('newEmergency', (data) => this.updates.next({ type: 'NEW', data }));
    this.socket.on('emergencyUpdate', (data) => this.updates.next({ type: 'STATUS', data }));
    this.socket.on('responderLocationUpdate', (data) => this.updates.next({ type: 'LOCATION', data }));
  }

  emitResponderLocation(payload: { responderId: number; latitude: number; longitude: number }): void {
    this.socket.emit('updateLocation', payload);
  }

  private getToken(): string | null {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.token || null;
  }

  private getHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(2)); // Return distance rounded to 2 decimal places
  }

  createEmergency(data: { emergency_type: string; latitude: number; longitude: number }): Observable<any> {
    return this.http.post(this.apiUrl, data, { headers: this.getHeaders() });
  }

  getEmergencies(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getNearby(lat: number, lng: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?lat=${lat}&lng=${lng}`, { headers: this.getHeaders() });
  }

  acceptRequest(data: { request_id: number; responder_lat: number; responder_lng: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept-request`, data, { headers: this.getHeaders() });
  }

  updateStatus(id: number, body: { status: string; responder_id?: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/status`, body, { headers: this.getHeaders() });
  }

  getLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.adminUrl}/logs`, { headers: this.getHeaders() });
  }

  updateDeviceToken(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-token`, { token }, { headers: this.getHeaders() });
  }
}
