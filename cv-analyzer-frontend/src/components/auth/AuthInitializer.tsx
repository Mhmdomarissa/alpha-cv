'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

/** Public routes where we never call /api/auth/me (no need to expose user info). */
const isPublicRoute = (pathname: string) => pathname === '/careers' || pathname.startsWith('/careers/');

/**
 * Component that initializes authentication state from storage on app startup.
 * Skips the auth/me API on public routes (e.g. job post pages) so we don't expose user data.
 */
export default function AuthInitializer() {
  const pathname = usePathname();
  const initFromStorage = useAuthStore((state) => state.initFromStorage);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (pathname == null) return;
    if (isPublicRoute(pathname)) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initFromStorage();
    }
  }, [pathname, initFromStorage]);

  return null;
}
