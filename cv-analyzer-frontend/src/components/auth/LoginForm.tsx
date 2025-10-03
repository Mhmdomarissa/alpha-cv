'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X, Zap, Eye, EyeOff, Lock, User } from 'lucide-react';
import { config } from '@/lib/config';

export default function LoginForm() {
  const router = useRouter();
  const { login, loading, error, clearError, user } = useAuthStore();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    
    if (result && result.success) {
      // Redirect immediately based on role
      if (result.role === 'admin') {
        router.push('/admin/users'); // Admin users go to admin panel
      } else {
        router.push('/'); // HR/regular users go to main app (with careers tab)
      }
    }
    // Error handling is done by the store
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-blue-100/40 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/30 to-blue-600/30 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-700/30 blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 border border-white/30 shadow-2xl">
          {/* Header */}
          <div className="text-center space-y-6 mb-8">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-3xl group hover:scale-105 transition-all duration-300 shadow-2xl">
                <svg 
                  width="64" 
                  height="64" 
                  viewBox="0 0 200 200" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="group-hover:rotate-12 transition-transform duration-300"
                >
                  <g transform="translate(0,200) scale(0.1,-0.1)" fill="#00529b">
                    <path d="M0 1000 l0 -1000 1000 0 1000 0 0 1000 0 1000 -1000 0 -1000 0 0 -1000z m925 779 c-153 -31 -275 -94 -275 -142 0 -11 -20 -62 -44 -111 -25 -50 -50 -118 -57 -151 -11 -53 -10 -65 6 -99 26 -54 21 -90 -21 -159 -27 -46 -37 -74 -38 -107 l-1 -45 53 -3 52 -3 0 -38 c0 -23 6 -44 15 -51 11 -9 13 -16 5 -24 -16 -16 -12 -44 9 -56 17 -9 19 -18 14 -85 -5 -63 -3 -75 11 -81 31 -12 5 -24 -52 -24 -37 0 -66 6 -81 16 -22 16 -23 22 -18 91 5 66 4 74 -15 84 -16 9 -19 17 -14 44 4 19 2 36 -4 40 -5 3 -10 21 -10 40 0 36 -13 46 -53 38 -69 -13 -74 46 -12 163 25 46 45 91 45 98 0 7 -9 34 -20 58 -17 40 -18 53 -9 104 5 33 30 100 55 150 24 49 44 100 44 111 0 22 42 63 89 87 82 42 230 74 346 74 l70 0 -90 -19z m55 -1181 c27 -29 38 -73 45 -188 5 -72 4 -99 -7 -111 -14 -18 -119 -91 -123 -87 -2 2 2 27 8 56 9 43 8 64 -6 116 -9 36 -17 79 -17 98 -1 40 -25 111 -40 116 -5 2 -10 8 -10 13 0 5 29 9 65 9 53 0 68 -4 85 -22z"/>
                  </g>
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
                Welcome Back
              </h1>
              <p className="text-slate-600 font-medium">
                Sign in to your Alpha CV account
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50/90 backdrop-blur-sm border border-red-200/70 animate-slide-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">{displayError}</span>
                </div>
                <button
                  onClick={() => {
                    clearError();
                    setFormError(null);
                  }}
                  className="p-1 rounded-lg hover:bg-red-100/50 transition-colors duration-200"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  disabled={loading}
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                  className="w-full pl-12 pr-12 py-4 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)' }}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 opacity-60 animate-pulse"></div>
        <div className="absolute -bottom-4 -left-4 w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

    </div>
  );
}
