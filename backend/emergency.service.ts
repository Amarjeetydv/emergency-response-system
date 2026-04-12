import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class EmergencyService {
  private apiUrl = 'http://localhost:5000/api/emergencies';
  private authUrl = 'http://localhost:5000/api/auth';
  private socket: Socket;
  private updates = new Subject<{ type: string, data: any }>();

  constructor(private http: HttpClient, private auth: AuthService) {
    this.socket = io('http://localhost:5000');
    
    this.socket.on('newEmergency', (data) => this.updates.next({ type: 'NEW', data }));
    this.socket.on('emergencyUpdate', (data) => this.updates.next({ type: 'STATUS', data }));
  }

  private getHeaders() {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
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

  getAnalytics(): Observable<any> {
    return this.http.get('http://localhost:5000/api/admin/analytics', { headers: this.getHeaders() });
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.authUrl}/users`, { headers: this.getHeaders() });
  }

  approveUser(id: number): Observable<any> {
    return this.http.post(`${this.authUrl}/approve/${id}`, {}, { headers: this.getHeaders() });
  }

  updateUserRole(id: number, role: string): Observable<any> {
    return this.http.put(`${this.authUrl}/role/${id}`, { role }, { headers: this.getHeaders() });
  }

  createEmergency(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data, { headers: this.getHeaders() });
  }

  getEmergencies(): Observable<any> {
    return this.http.get(this.apiUrl, { headers: this.getHeaders() });
  }

  getNearby(lat: number, lng: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?lat=${lat}&lng=${lng}`, { headers: this.getHeaders() });
  }

  acceptRequest(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept-request`, payload, { headers: this.getHeaders() });
  }

  updateStatus(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data, { headers: this.getHeaders() });
  }

  getLiveUpdates() {
    return this.updates.asObservable();
  }

  onResponderLocationUpdate(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('responderLocationUpdate', (data) => observer.next(data));
    });
  }

  emitResponderLocation(data: any) {
    this.socket.emit('updateLocation', data);
  }

  updateDeviceToken(token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-token`, { token }, { headers: this.getHeaders() });
  }

  getChatHistory(emergencyId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${emergencyId}/chat`, { headers: this.getHeaders() });
  }

  joinChat(emergencyId: number) {
    this.socket.emit('joinChat', emergencyId);
  }

  sendMessage(data: { emergencyId: number, senderId: number, senderName: string, message: string }) {
    this.socket.emit('sendMessage', data);
  }

  onMessage(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('receiveMessage', (data) => observer.next(data));
    });
  }
}
