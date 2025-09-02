'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import { config } from '@/lib/config';

export default function LoginForm() {
  const router = useRouter();
  const { login, loading, error, clearError } = useAuthStore();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (error) clearError();
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.username.trim()) {
      setFormError('Username is required');
      return;
    }
    if (!formData.password.trim()) {
      setFormError('Password is required');
      return;
    }

    const result = await login(formData.username, formData.password);
    
    if (result.success && result.role) {
      // Redirect based on role
      if (result.role === 'admin') {
        router.push('/admin/users');
      } else {
        router.push('/'); // Redirect to main app (dashboard with tabs)
      }
    }
    // Error handling is done by the store
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
      <Card className="w-full max-w-md mx-auto p-8 shadow-lg" style={{ backgroundColor: 'white', borderColor: 'var(--gray-200)' }}>
        <div className="space-y-6">
          {/* Header with Logo */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <span className="text-white text-xl font-bold">⚡</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--gray-900)' }}>{config.appName}</h1>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Sign in to your account</p>
            </div>
          </div>

        {/* Error Banner */}
        {displayError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{displayError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearError();
                  setFormError(null);
                }}
                className="h-auto p-1 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium" style={{ color: 'var(--gray-700)' }}>
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                disabled={loading}
                required
                className="h-12 text-base"
                style={{ borderColor: 'var(--gray-300)', backgroundColor: 'var(--gray-50)' }}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--gray-700)' }}>
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={loading}
                required
                className="h-12 text-base"
                style={{ borderColor: 'var(--gray-300)', backgroundColor: 'var(--gray-50)' }}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium" 
              disabled={loading}
              style={{ 
                background: loading ? 'var(--gray-400)' : 'var(--gradient-primary)',
                borderColor: 'transparent'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
