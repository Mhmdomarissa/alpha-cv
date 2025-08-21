'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from './LoginPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    const initAuth = async () => {
      try {
        // Small delay to avoid flash
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const isAuth = checkAuth();
        setShowLogin(!isAuth);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        setShowLogin(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, [checkAuth]);

  const handleLoginSuccess = () => {
    setShowLogin(false);
  };

  // Show loading spinner during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Checking authentication..." />
      </div>
    );
  }

  // Show login page if not authenticated
  if (showLogin || !isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
};

export default AuthGuard;
