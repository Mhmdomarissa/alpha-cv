'use client';

import React, { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedProps {
  children: ReactNode;
  requireRole?: 'admin' | 'user';
  fallbackPath?: string;
}

export default function Protected({ 
  children, 
  requireRole,
  fallbackPath = '/login' 
}: ProtectedProps) {
  const router = useRouter();
  const { user, loading, initFromStorage } = useAuthStore();

  useEffect(() => {
    // Initialize auth from storage on mount
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // No user, redirect to login
        router.push(fallbackPath);
        return;
      }

      if (requireRole && user.role !== requireRole) {
        // User doesn't have required role
        if (user.role === 'admin') {
          router.push('/admin/users');
        } else {
          router.push('/'); // Redirect to main app
        }
        return;
      }
    }
  }, [user, loading, requireRole, router, fallbackPath]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated or doesn't have required role
  if (!user || (requireRole && user.role !== requireRole)) {
    return null;
  }

  return <>{children}</>;
}
