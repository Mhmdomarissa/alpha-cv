import { create } from 'zustand';
import { api } from '@/lib/api';
import { getToken, setToken, clearToken } from '@/lib/auth';
import { UserProfile } from '@/lib/types';
import { logger } from '@/lib/logger';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  loading: boolean;
  /** False until the first `initFromStorage` (or public-route skip) finishes — avoids Protected redirect before hydration. */
  authHydrated: boolean;
  error: string | null;
}

interface AuthActions {
  initFromStorage: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; role?: 'admin' | 'user' | 'recruiter' | 'manager'; error?: string }>;
  verifyPassword: (username: string, password: string) => Promise<{ success: boolean; requires_otp?: boolean; error?: string }>;
  sendOTP: (username: string, password: string) => Promise<{ success: boolean; masked_email?: string; error?: string }>;
  verifyOTP: (username: string, otp: string) => Promise<{ success: boolean; role?: 'admin' | 'user' | 'recruiter' | 'manager'; error?: string }>;
  logout: () => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  token: null,
  user: null,
  loading: false,
  authHydrated: false,
  error: null,

  // Actions
  initFromStorage: async () => {
    set({ loading: true });
    const safetyTimer = setTimeout(() => {
      set({ loading: false, authHydrated: true });
    }, 6000);
    try {
      const token = getToken();
      if (token) {
        logger.info('Found token in storage, fetching user profile');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), 5000)
        );
        const user = await Promise.race([api.me(token), timeoutPromise]) as UserProfile;
        set({ token, user, loading: false, error: null });
        logger.info('Auth session restored');
      } else {
        set({ loading: false });
        logger.info('No token found in storage');
      }
    } catch (error) {
      logger.error('Failed to restore auth session:', error);
      clearToken();
      set({ token: null, user: null, loading: false, error: null });
    } finally {
      clearTimeout(safetyTimer);
      set({ authHydrated: true });
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      logger.info('Attempting login');
      const response = await api.login(username, password);
      
      // Store token
      setToken(response.access_token);
      
      // Get user profile
      const user = await api.me(response.access_token);
      
      set({
        token: response.access_token,
        user,
        loading: false,
        error: null,
        authHydrated: true,
      });

      logger.info('Login successful');
      return { success: true, role: user.role };
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      logger.error('Login failed:', error);
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  verifyPassword: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      logger.info('Verifying password');
      const response = await api.verifyPassword(username, password);
      
      if (response.success) {
        set({ loading: false, error: null });
        logger.info(`Password verified successfully. Requires OTP: ${response.requires_otp}`);
        return { success: true, requires_otp: response.requires_otp };
      } else {
        throw new Error('Password verification failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Invalid credentials';
      logger.error('Password verification failed:', error);
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  sendOTP: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      logger.info('Sending OTP');
      const response = await api.sendOTP(username, password);
      
      if (response.success) {
        set({ loading: false, error: null });
        logger.info('OTP sent successfully');
        return { success: true, masked_email: response.masked_email };
      } else {
        throw new Error('Failed to send OTP');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to send OTP';
      logger.error('Send OTP failed:', error);
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  verifyOTP: async (username: string, otp: string) => {
    set({ loading: true, error: null });
    try {
      logger.info('Verifying OTP');
      const response = await api.verifyOTP(username, otp);
      
      // Store token
      setToken(response.access_token);
      
      // Get user profile
      const user = await api.me(response.access_token);
      
      set({
        token: response.access_token,
        user,
        loading: false,
        error: null,
        authHydrated: true,
      });

      logger.info('OTP verification successful');
      return { success: true, role: user.role };
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'OTP verification failed';
      logger.error('OTP verification failed:', error);
      set({ loading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    logger.info('Logging out user');
    clearToken();
    set({ token: null, user: null, loading: false, error: null, authHydrated: true });
  },

  clearError: () => {
    set({ error: null });
  },
}));
