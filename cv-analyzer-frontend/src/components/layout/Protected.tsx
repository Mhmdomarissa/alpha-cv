'use client';

import React, { useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedProps {
  children: ReactNode;
  requireRole?: 'admin' | 'user' | 'recruiter' | 'manager' | 'evp';
  fallbackPath?: string;
}

export default function Protected({ 
  children, 
  requireRole,
  fallbackPath = '/login' 
}: ProtectedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, authHydrated } = useAuthStore();

  useEffect(() => {
    if (!authHydrated || loading) return;

    if (!user) {
      const here = pathname && pathname !== '/login' ? `${pathname}${typeof window !== 'undefined' ? window.location.search : ''}` : '';
      const q = here ? `?from=${encodeURIComponent(here)}` : '';
      router.push(`${fallbackPath}${q}`);
      return;
    }

    if (requireRole && user.role !== requireRole) {
      router.push('/');
    }
  }, [user, loading, authHydrated, requireRole, router, fallbackPath, pathname]);

  if (!authHydrated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (requireRole && user.role !== requireRole)) {
    return null;
  }

  return <>{children}</>;
}
