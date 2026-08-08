import { apiClient } from './client';
import { User } from '../../types';

export const userApi = {
  getUsers: () => {
    return apiClient.get<User[]>('/auth/users');
  },

  approveUser: (id: number) => {
    return apiClient.patch(`/auth/users/${id}/approve`, {});
  },

  updateUserRole: (userId: number, role: string) => {
    return apiClient.patch(`/auth/users/${userId}/role`, { role });
  },

  deleteUser: (userId: number) => {
    return apiClient.delete(`/auth/users/${userId}`);
  },
};
