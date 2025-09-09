'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    // If user is already logged in, redirect to appropriate page
    if (user && !loading) {
      if (user.role === 'admin') {
        router.push('/admin/users'); // Admin users go to admin panel
      } else {
        router.push('/'); // HR/regular users go to main app (with careers tab)
      }
    }
  }, [user, loading, router]);

  // Don't render login form if user is already authenticated
  if (user && !loading) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
