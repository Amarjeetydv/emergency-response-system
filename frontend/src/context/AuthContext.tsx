import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../services/api/authApi';
import { apiClient, setAccessToken } from '../services/api/client';
import socketService from '../services/socket/socketService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize Auth from cookie session check
  useEffect(() => {
    const initializeAuth = async () => {
      const storedUserStr = localStorage.getItem('user');
      if (storedUserStr) {
        try {
          // Attempt to retrieve a fresh access token using the HttpOnly refresh token
          const res = await apiClient.post('/auth/refresh');
          const newToken = res.data?.token || '';
          setAccessToken(newToken);
          setToken(newToken);
          
          const parsedUser = JSON.parse(storedUserStr) as User;
          setUser({ ...parsedUser, token: newToken });
          socketService.connect(newToken);
        } catch (err) {
          console.warn('Initial session restore failed, clearing storage');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          localStorage.removeItem('userRole');
        }
      }
      setLoading(false);
    };

    initializeAuth();

    // Listen to token refresh and session expiration events from Axios client
    const handleRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newToken = customEvent.detail;
      setToken(newToken);
      setUser((prev) => (prev ? { ...prev, token: newToken } : null));
      socketService.emitUpdateToken(newToken);
    };

    const handleExpired = () => {
      logout();
    };

    window.addEventListener('ercs_token_refreshed', handleRefreshed);
    window.addEventListener('ercs_session_expired', handleExpired);

    return () => {
      window.removeEventListener('ercs_token_refreshed', handleRefreshed);
      window.removeEventListener('ercs_session_expired', handleExpired);
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const response = await authApi.login(credentials);
    const data = response.data;
    
    const responseToken = data?.token || '';
    const userRole = String(data?.user?.role || '').toLowerCase().trim();
    const role = userRole || 'citizen';

    const fullUser: User = {
      ...(data?.user || {}),
      token: responseToken,
    };

    setAccessToken(responseToken);

    // Save profile metadata only (no raw secret tokens in localStorage)
    localStorage.setItem('user', JSON.stringify(fullUser));
    localStorage.setItem('role', role);
    localStorage.setItem('userRole', role);

    setUser(fullUser);
    setToken(responseToken);
    
    socketService.reconnect(responseToken);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Failed to call logout API endpoint:', err);
    }
    
    // Clear storage and client states
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('userRole');
    sessionStorage.clear();
    setAccessToken(null);
    
    setUser(null);
    setToken(null);
    
    socketService.disconnect();

    window.location.href = '/login';
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
