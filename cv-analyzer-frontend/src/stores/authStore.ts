import { create } from 'zustand';
import { api } from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { logger } from '@/lib/logger';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthActions {
  initFromStorage: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; role?: 'admin' | 'user'; error?: string }>;
  logout: () => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  token: null,
  user: null,
  loading: false,
  error: null,

  // Actions
  initFromStorage: async () => {
    set({ loading: true });
    try {
      const token = getToken();
      if (token) {
        logger.info('Found token in storage, fetching user profile');
        const user = await api.me(token);
        set({ token, user, loading: false, error: null });
        logger.info(`Restored auth session for user: ${user.username} (${user.role})`);
      } else {
        set({ loading: false });
        logger.info('No token found in storage');
      }
    } catch (error) {
      logger.error('Failed to restore auth session:', error);
      clearToken();
      set({ token: null, user: null, loading: false, error: 'Session expired' });
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      logger.info(`Attempting login for user: ${username}`);
      const response = await api.login(username, password);
      
      // Store token
      setToken(response.access_token);
      
      // Get user profile
      const user = await api.me(response.access_token);
      
      set({ 
        token: response.access_token, 
        user, 
        loading: false, 
        error: null 
      });
      
      logger.info(`Login successful for user: ${user.username} (${user.role})`);
      return { success: true, role: user.role };
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      logger.error('Login failed:', error);
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    logger.info('Logging out user');
    clearToken();
    set({ token: null, user: null, loading: false, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
