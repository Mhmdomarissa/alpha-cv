/**
 * User Session Store - Isolated per-user state
 * ============================================
 * 
 * Prevents one user's actions from affecting other users' UI state
 * Environment-aware configuration for development vs production
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

interface UserSessionState {
  // User-specific session ID
  sessionId: string;
  
  // Per-user loading states
  loadingStates: {
    cvs: boolean;
    jds: boolean;
    matching: boolean;
    upload: boolean;
    careers: boolean;
    applications: boolean;
  };
  
  // Per-user data with isolation
  userCvs: any[];
  userJds: any[];
  userMatchResult: any | null;
  userCareersData: any[];
  userApplications: any[];
  
  // Request queuing for concurrent operations
  requestQueue: Map<string, Promise<any>>;
  
  // Performance monitoring
  lastRequestTime: number;
  requestCount: number;
  
  // Actions
  setLoading: (operation: keyof UserSessionState['loadingStates'], loading: boolean) => void;
  setUserCvs: (cvs: any[]) => void;
  setUserJds: (jds: any[]) => void;
  setUserMatchResult: (result: any | null) => void;
  setUserCareersData: (data: any[]) => void;
  setUserApplications: (applications: any[]) => void;
  queueRequest: <T>(key: string, requestFn: () => Promise<T>) => Promise<T>;
  clearUserData: () => void;
  resetSession: () => void;
}

export const useUserSessionStore = create<UserSessionState>()(
  devtools(
    (set, get) => ({
      // Generate unique session ID
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      
      loadingStates: {
        cvs: false,
        jds: false,
        matching: false,
        upload: false,
        careers: false,
        applications: false,
      },
      
      userCvs: [],
      userJds: [],
      userMatchResult: null,
      userCareersData: [],
      userApplications: [],
      
      // Request queuing
      requestQueue: new Map(),
      
      // Performance monitoring
      lastRequestTime: 0,
      requestCount: 0,
      
      setLoading: (operation, loading) =>
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [operation]: loading,
          },
        })),
      
      setUserCvs: (cvs) => set({ userCvs: cvs }),
      setUserJds: (jds) => set({ userJds: jds }),
      setUserMatchResult: (result) => set({ userMatchResult: result }),
      setUserCareersData: (data) => set({ userCareersData: data }),
      setUserApplications: (applications) => set({ userApplications: applications }),
      
      // Request queuing to prevent duplicate requests
      queueRequest: async <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
        const state = get();
        
        // Check if request is already in progress
        if (state.requestQueue.has(key)) {
          console.log(`🔄 Request ${key} already in progress, waiting...`);
          return await state.requestQueue.get(key);
        }
        
        // Create new request
        const requestPromise = requestFn().finally(() => {
          // Remove from queue when complete
          set((state) => {
            const newQueue = new Map(state.requestQueue);
            newQueue.delete(key);
            return { requestQueue: newQueue };
          });
        });
        
        // Add to queue
        set((state) => ({
          requestQueue: new Map(state.requestQueue).set(key, requestPromise),
          requestCount: state.requestCount + 1,
          lastRequestTime: Date.now(),
        }));
        
        return await requestPromise;
      },
      
      clearUserData: () =>
        set({
          userCvs: [],
          userJds: [],
          userMatchResult: null,
          userCareersData: [],
          userApplications: [],
          loadingStates: {
            cvs: false,
            jds: false,
            matching: false,
            upload: false,
            careers: false,
            applications: false,
          },
          requestQueue: new Map(),
        }),
      
      resetSession: () => {
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set({
          sessionId: newSessionId,
          userCvs: [],
          userJds: [],
          userMatchResult: null,
          userCareersData: [],
          userApplications: [],
          loadingStates: {
            cvs: false,
            jds: false,
            matching: false,
            upload: false,
            careers: false,
            applications: false,
          },
          requestQueue: new Map(),
          requestCount: 0,
          lastRequestTime: 0,
        });
      },
    }),
    {
      name: 'user-session-store',
    }
  )
);
