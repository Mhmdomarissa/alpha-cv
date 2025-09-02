'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Component that initializes authentication state from storage on app startup
 * Should be included once at the root level
 */
export default function AuthInitializer() {
  const initFromStorage = useAuthStore((state) => state.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  // This component doesn't render anything
  return null;
}
