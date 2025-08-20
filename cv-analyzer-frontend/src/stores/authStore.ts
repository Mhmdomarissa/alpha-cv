'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Hardcoded credentials as requested - stored in single location for easy removal later
const AUTH_CONFIG = {
  username: 'zak',
  password: 'zakzak@0987654321',
} as const;

interface AuthState {
  isAuthenticated: boolean;
  user: { username: string } | null;
  error: string | null;
  isLoading: boolean;
  
  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => boolean;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      error: null,
      isLoading: false,

      login: async (username: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check credentials against hardcoded values
          if (username.trim() === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
            set({
              isAuthenticated: true,
              user: { username: AUTH_CONFIG.username },
              error: null,
              isLoading: false,
            });
            return true;
          } else {
            set({
              isAuthenticated: false,
              user: null,
              error: 'Invalid username or password. Please check your credentials and try again.',
              isLoading: false,
            });
            return false;
          }
        } catch {
          set({
            isAuthenticated: false,
            user: null,
            error: 'An error occurred during login. Please try again.',
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          error: null,
          isLoading: false,
        });
        
        // Clear any additional session data if needed
        if (typeof window !== 'undefined') {
          // Clear any additional localStorage items if needed in the future
          console.log('🔐 User logged out successfully');
        }
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: () => {
        const state = get();
        return state.isAuthenticated && state.user !== null;
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'cv-analyzer-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        // Don't persist error or loading states
      }),
    }
  )
);
