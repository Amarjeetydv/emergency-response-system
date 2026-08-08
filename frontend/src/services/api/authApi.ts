import { apiClient } from './client';

export const authApi = {
  login: (credentials: { email: string; password: string }) => {
    return apiClient.post('/auth/login', credentials);
  },
  register: (user: any) => {
    return apiClient.post('/auth/register', user);
  },
  logout: () => {
    return apiClient.post('/auth/logout');
  },
};
