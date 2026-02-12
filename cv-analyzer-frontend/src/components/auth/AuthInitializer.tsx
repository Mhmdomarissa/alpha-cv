'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Component that initializes authentication state from storage on app startup
 * Should be included once at the root level
 */
export default function AuthInitializer() {
  const initFromStorage = useAuthStore((state) => state.initFromStorage);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only initialize once on mount
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initFromStorage();
    }
  }, []); // Empty dependency array - only run once on mount

  // This component doesn't render anything
  return null;
}
