'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, X, Zap, Eye, EyeOff, Lock, User, Mail, KeyRound } from 'lucide-react';
import { config } from '@/lib/config';
import { Typewriter } from '@/components/ui/Typewriter';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyPassword, sendOTP, verifyOTP, login, loading, error, clearError, user } = useAuthStore();

  const continueAfterAuth = () => {
    const from = safeRedirectPath(searchParams.get('from'));
    router.push(from ?? '/');
  };
  
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
            continueAfterAuth();
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
        continueAfterAuth();
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
    <div className="min-h-screen w-full flex items-center justify-center bg-transparent py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Left Quote */}
      <div 
        className="hidden lg:block absolute left-16 xl:left-24 top-1/2 -translate-y-1/2 max-w-[320px] pointer-events-none"
        style={{ perspective: '1200px' }}
      >
        <motion.div
          initial={{ opacity: 0, x: -100, rotateY: 45, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          whileHover={{ rotateY: -10, x: 10 }}
          className="space-y-6"
        >
          <div className="w-16 h-1.5 bg-[#00529b] rounded-full mb-8 shadow-sm shadow-blue-900/20"></div>
          <h2 className="text-5xl font-black text-gray-900 leading-[1.1] tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            "AI-BASED <br/>
            <span className="text-[#00529b]">MATCHING"</span>
          </h2>
          <p className="text-gray-800 text-xl font-medium leading-snug tracking-tight italic opacity-90" style={{ fontFamily: "'Playfair Display', serif" }}>
            Precision hiring at the speed of light.
          </p>
        </motion.div>
      </div>

      {/* Right Quote */}
      <div 
        className="hidden lg:block absolute right-16 xl:right-24 top-1/2 -translate-y-1/2 max-w-[320px] text-right pointer-events-none"
        style={{ perspective: '1200px' }}
      >
        <motion.div
          initial={{ opacity: 0, x: 100, rotateY: -45, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          whileHover={{ rotateY: 10, x: -10 }}
          className="space-y-6"
        >
          <div className="w-16 h-1.5 bg-[#00529b] rounded-full mb-8 ml-auto shadow-sm shadow-blue-900/20"></div>
          <h2 className="text-5xl font-black text-gray-900 leading-[1.1] tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            "SMART <br/>
            <span className="text-[#00529b]">INSIGHTS"</span>
          </h2>
          <p className="text-gray-800 text-xl font-medium leading-snug tracking-tight italic opacity-90" style={{ fontFamily: "'Playfair Display', serif" }}>
            Transforming raw CVs into your next hire.
          </p>
        </motion.div>
      </div>

      <div className="relative w-full max-w-md z-10">
        <div className="bg-transparent rounded-3xl p-5 sm:p-10 border border-white/20 shadow-xl backdrop-blur-sm">
          {/* Header */}
          <div className="text-center space-y-6 mb-8">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-none group hover:scale-105 transition-all duration-300 bg-white border border-gray-100 flex items-center justify-center shadow-lg p-2">
                <img
                  src="/alphadatalogo.svg"
                  alt="Alpha Data Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Welcome back
              </h1>
              <p className="text-gray-500 font-medium min-h-[1.5em]">
                <Typewriter text="Sign in to your Alpha CV account" speed={40} delay={300} cursor={false} />
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
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
              <label htmlFor="username" className="text-sm font-semibold text-gray-700">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-[#00529b]" />
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
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#00529b]" />
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
                  className="w-full pl-12 pr-12 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#00529b] transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || submittingPassword}
              className="w-full py-6 rounded-xl bg-gradient-primary text-white shadow-xl shadow-blue-900/20"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                </div>
              ) : (
                  'Continue'
              )}
            </Button>
          </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              {/* Success Message - Neutral */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      OTP sent to {userEmail || 'your registered email'}
                    </p>
                    <p className="text-xs text-blue-600/70 mt-1">
                      OTP is valid for 5 minutes.
                    </p>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      className="text-xs font-semibold text-[#00529b] hover:underline mt-2"
                      disabled={loading || submittingOtp}
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>
              </div>

              {/* OTP Field */}
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-semibold text-gray-700">
                  Enter OTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-[#00529b]" />
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
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-center text-2xl tracking-widest"
                  />
                </div>
              </div>

              {/* Verify OTP Button */}
              <Button
                type="submit"
                disabled={loading || submittingOtp}
                className="w-full py-6 rounded-xl bg-gradient-primary text-white shadow-xl shadow-blue-900/20"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Verify OTP'
                )}
              </Button>

              {/* Back Button */}
              <button
                type="button"
                onClick={() => {
                  setStep('password');
                  setFormData(prev => ({ ...prev, otp: '' }));
                  setFormError(null);
                }}
                className="w-full py-2 text-sm text-gray-500 hover:text-[#00529b] transition-colors duration-200"
              >
                ← Back
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400 font-medium">
              Need an account? Contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
