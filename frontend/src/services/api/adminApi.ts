import { apiClient } from './client';
import { AuditLog, Analytics } from '../../types';

export const adminApi = {
  getLogs: () => {
    return apiClient.get<AuditLog[]>('/admin/logs');
  },

  getAnalytics: () => {
    return apiClient.get<Analytics>('/admin/analytics');
  },
};
