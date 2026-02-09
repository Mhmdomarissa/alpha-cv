'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [initTimeout, setInitTimeout] = useState(false);

  useEffect(() => {
    // Set a timeout to show login form even if auth init is slow
    const timeout = setTimeout(() => {
      setInitTimeout(true);
    }, 2000); // Show form after 2 seconds max

    return () => clearTimeout(timeout);
  }, []);

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

  // Show login form immediately or after timeout
  if (!loading || initTimeout) {
    return <LoginForm />;
  }

  // Show minimal loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">Loading...</p>
      </div>
    </div>
  );
}
