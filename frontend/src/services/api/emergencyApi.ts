import { apiClient } from './client';
import { Emergency } from '../../types';

export const emergencyApi = {
  createEmergency: (data: FormData | object) => {
    // If FormData, Axios handles multipart automatically when we pass FormData
    return apiClient.post<{ data: Emergency }>('/emergencies', data);
  },

  getEmergencies: () => {
    return apiClient.get<Emergency[]>('/emergencies');
  },

  getNearby: (lat: number, lng: number) => {
    return apiClient.get<Emergency[]>(`/emergencies?lat=${lat}&lng=${lng}`);
  },

  acceptEmergencyRequest: (data: { request_id: number; responder_lat?: number; responder_lng?: number }) => {
    return apiClient.post('/emergencies/accept-request', data);
  },

  updateStatus: (id: number, body: { status: string; responder_id?: number }) => {
    return apiClient.put(`/emergencies/${id}`, body);
  },

  updateDeviceToken: (token: string) => {
    return apiClient.post('/emergencies/update-token', { token });
  },

  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(2)); // Return distance rounded to 2 decimal places
  },
};
