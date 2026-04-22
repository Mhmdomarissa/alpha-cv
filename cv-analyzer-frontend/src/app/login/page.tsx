'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthStore } from '@/stores/authStore';
import { safeRedirectPath } from '@/lib/safe-redirect';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthStore();
  const [initTimeout, setInitTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInitTimeout(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user && !loading) {
      const from = safeRedirectPath(searchParams.get('from'));
      router.replace(from ?? '/');
    }
  }, [user, loading, router, searchParams]);

  if (user && !loading) {
    return null;
  }

  if (!loading || initTimeout) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-slate-600">Preparing your workspace...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-slate-600">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
