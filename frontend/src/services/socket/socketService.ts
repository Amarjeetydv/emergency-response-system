import { io, Socket } from 'socket.io-client';
import { Emergency, ResponderLocation } from '../../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.VITE_API_BASE_URL 
    ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '') 
    : window.location.origin);

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [event: string]: Set<(data: any) => void> } = {
    newEmergency: new Set(),
    emergencyUpdate: new Set(),
    responderLocationUpdate: new Set(),
  };
  private statusListeners = new Set<(status: 'connected' | 'reconnecting' | 'disconnected') => void>();

  onStatusChange(callback: (status: 'connected' | 'reconnecting' | 'disconnected') => void) {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.statusListeners.forEach((cb) => cb(status));
  }

  getStatus(): 'connected' | 'reconnecting' | 'disconnected' {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'reconnecting';
  }

  connect(token: string | null) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.io connected:', this.socket?.id);
      this.setStatus('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket.io disconnected');
      this.setStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.setStatus('reconnecting');
    });

    // Wire up events
    this.socket.on('newEmergency', (data: Emergency) => {
      this.listeners.newEmergency.forEach((cb) => cb(data));
    });

    this.socket.on('emergencyUpdate', (data: Emergency) => {
      this.listeners.emergencyUpdate.forEach((cb) => cb(data));
    });

    this.socket.on('responderLocationUpdate', (data: ResponderLocation) => {
      this.listeners.responderLocationUpdate.forEach((cb) => cb(data));
    });
  }

  reconnect(token: string | null) {
    console.log('Reconnecting socket...');
    this.connect(token);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emitUpdateToken(token: string) {
    if (this.socket) {
      console.log('Sending token refresh update to Socket.io');
      this.socket.emit('updateToken', token);
    }
  }

  emitResponderLocation(payload: { responderId: number; name?: string; role?: string; latitude: number; longitude: number }) {
    if (this.socket) {
      this.socket.emit('updateLocation', payload);
    } else {
      console.warn('Cannot emit updateLocation: socket is not connected.');
    }
  }

  subscribe(event: 'newEmergency' | 'emergencyUpdate' | 'responderLocationUpdate', callback: (data: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
    return () => {
      if (this.listeners[event]) {
        this.listeners[event].delete(callback);
      }
    };
  }
}

export const socketService = new SocketService();
export default socketService;
