'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X, Zap, Eye, EyeOff, Lock, User, Mail, KeyRound } from 'lucide-react';
import { config } from '@/lib/config';
import { Typewriter } from '@/components/ui/Typewriter';

export default function LoginForm() {
  const router = useRouter();
  const { verifyPassword, sendOTP, verifyOTP, login, loading, error, clearError, user } = useAuthStore();
  
  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpIssuedForKey, setOtpIssuedForKey] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>(''); // Store email for display
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submittingOtp, setSubmittingOtp] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    otp: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // If username/password changes, invalidate the "OTP already issued" marker
  useEffect(() => {
    const key = `${formData.username}::${formData.password}`;
    if (otpIssuedForKey && otpIssuedForKey !== key) {
      setOtpIssuedForKey(null);
      setOtpSent(false);
      setUserEmail('');
      setFormData(prev => ({ ...prev, otp: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.username, formData.password]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (error) clearError();
    if (formError) setFormError(null);
  };

  const handlePasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingPassword) return;
    
    // Basic validation
    if (!formData.username.trim()) {
      setFormError('Username is required');
      return;
    }
    if (!formData.password.trim()) {
      setFormError('Password is required');
      return;
    }

    try {
      setSubmittingPassword(true);
      // Verify password
      const result = await verifyPassword(formData.username, formData.password);
      
      if (result && result.success) {
        // Check if OTP is required
        // Admin users: requires_otp === false -> login directly
        // Regular users: requires_otp === true -> send OTP automatically
        if (result.requires_otp === false) {
          // Admin user - login directly (no OTP needed)
          setFormError(null);
          const loginResult = await login(formData.username, formData.password);
          if (loginResult && loginResult.success) {
            // Redirect based on role
            if (loginResult.role === 'admin') {
              router.push('/admin/users');
            } else {
              router.push('/');
            }
          }
          // Don't proceed to OTP step for admin
          return;
        } else {
          // Regular user (requires_otp === true or undefined) - send OTP automatically
          // No need to manually enter email - it's stored in the database
          setFormError(null);
          const key = `${formData.username}::${formData.password}`;

          // IMPORTANT: Do NOT generate a new OTP if one was already issued for the same credentials.
          // Only generate a new OTP when the user explicitly clicks "Resend OTP".
          if (otpIssuedForKey === key && otpSent) {
            setStep('otp');
            return;
          }

          const otpResult = await sendOTP(formData.username, formData.password);
          if (otpResult && otpResult.success) {
            setOtpSent(true);
            setOtpIssuedForKey(key);
            setStep('otp');
            // Use masked email from response if available
            setUserEmail(otpResult.masked_email || 'your registered email');
          }
        }
      }
      // Error handling is done by the store
    } finally {
      setSubmittingPassword(false);
    }
  };


  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingOtp) return;
    
    // Basic validation
    if (!formData.otp.trim()) {
      setFormError('OTP is required');
      return;
    }
    if (formData.otp.length !== 6) {
      setFormError('OTP must be 6 digits');
      return;
    }

    try {
      setSubmittingOtp(true);
      const result = await verifyOTP(formData.username, formData.otp);
      
      if (result && result.success) {
        // Redirect immediately based on role
        if (result.role === 'admin') {
          router.push('/admin/users'); // Admin users go to admin panel
        } else {
          router.push('/'); // HR/regular users go to main app (with careers tab)
        }
      }
      // Error handling is done by the store
    } finally {
      setSubmittingOtp(false);
    }
  };


  const handleResendOTP = async () => {
    setOtpSent(false);
    setFormData(prev => ({ ...prev, otp: '' }));
    
    const result = await sendOTP(formData.username, formData.password);
    
    if (result && result.success) {
      setOtpSent(true);
      setOtpIssuedForKey(`${formData.username}::${formData.password}`);
      setFormError(null);
    }
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
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-white/30 shadow-2xl">
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
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
                Welcome back
              </h1>
              <p className="text-slate-600 font-medium min-h-[1.5em]">
                <Typewriter text="Sign in to your Alpha CV account" speed={40} delay={300} cursor={false} />
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
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

          {/* Login Form - Sequential Steps */}
          {step === 'password' && (
            <form onSubmit={handlePasswordVerify} className="space-y-6">
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
              disabled={loading || submittingPassword}
              className="w-full py-4 px-6 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)' }}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                </div>
              ) : (
                  'Continue'
              )}
            </button>
          </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              {/* Success Message */}
              <div className="p-4 rounded-xl bg-green-50/90 backdrop-blur-sm border border-green-200/70">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      OTP sent to {userEmail || 'your registered email'}
                    </p>
                    <p className="text-xs text-green-700/90 mt-1">
                      OTP is valid for 5 minutes. If you request a new OTP, the old one becomes invalid.
                    </p>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      className="text-xs font-semibold text-green-700 hover:text-green-900 underline mt-2"
                      disabled={loading || submittingOtp}
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>
              </div>

              {/* OTP Field */}
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-semibold text-slate-700">
                  Enter OTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    value={formData.otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData(prev => ({ ...prev, otp: value }));
                      if (error) clearError();
                      if (formError) setFormError(null);
                    }}
                    placeholder="Enter 6-digit OTP"
                    disabled={loading}
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/80 backdrop-blur-sm border border-white/30 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-center text-2xl tracking-widest"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Check your email for the 6-digit code. It expires in 5 minutes.
                </p>
              </div>

              {/* Verify OTP Button */}
              <button
                type="submit"
                disabled={loading || submittingOtp}
                className="w-full py-4 px-6 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, rgba(0, 82, 155, 0.7) 0%, rgba(0, 61, 115, 0.7) 100%)' }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Verify OTP'
                )}
              </button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => {
                  setStep('password');
                  setFormData(prev => ({ ...prev, otp: '' }));
                  setFormError(null);
                }}
                className="w-full py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors duration-200"
              >
                ← Back
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 font-medium">
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
