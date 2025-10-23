'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, XCircle, AlertCircle, PlayCircle } from 'lucide-react';

interface EmailProcessingStatus {
  is_processing: boolean;
  last_processed: string | null;
  total_processed_today: number;
  successful_today: number;
  failed_today: number;
  next_scheduled_run: string | null;
}

interface EmailHealthCheck {
  azure_connection: boolean;
  mailbox_accessible: boolean;
  access_token_valid: boolean;
  last_successful_processing: string | null;
  error_message: string | null;
}


export default function EmailPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [status, setStatus] = useState<EmailProcessingStatus | null>(null);
  const [health, setHealth] = useState<EmailHealthCheck | null>(null);

  // Load initial data
  useEffect(() => {
    loadStatus();
    loadHealth();
  }, []);

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to load email status:', error);
    }
  };

  const loadHealth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to load email health:', error);
    }
  };


  const processEmails = async () => {
    setIsProcessing(true);
    setProcessingResult(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/process-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_emails: 50,
          force_reprocess: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProcessingResult(data);
        await loadStatus();
        await loadHealth();
      } else {
        const error = await response.json();
        setProcessingResult({
          success: false,
          message: error.detail || 'Failed to process emails',
        });
      }
    } catch (error) {
      setProcessingResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };



  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return 'Never';
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Email CV Processing</h1>
              <p className="text-sm text-slate-600">Automatic email processing with backend scheduler</p>
            </div>
          </div>
          <button
            onClick={() => {
              loadHealth();
              loadStatus();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors duration-200 flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Automatic Processing Info */}
      <div className="bg-gradient-to-r from-[rgba(0,82,155,0.7)] to-[rgba(0,61,115,0.7)] rounded-2xl p-6 border border-white/30 shadow-lg text-white">
        <div className="flex items-center space-x-3 mb-4">
          <PlayCircle className="w-6 h-6" />
          <h2 className="text-xl font-semibold">Automatic Email Processing</h2>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <p className="text-sm text-white/90">
            <strong>✅ Running:</strong> The backend automatically checks for new emails every 5 minutes. 
            This happens in the background without any user interaction required.
          </p>
          <p className="text-sm text-white/80 mt-2">
            You can also trigger manual processing below for immediate email checking.
          </p>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>Email Service Health</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              {health.azure_connection ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">Azure Connection</p>
                <p className="text-xs text-slate-500">
                  {health.azure_connection ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {health.mailbox_accessible ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">Mailbox Access</p>
                <p className="text-xs text-slate-500">
                  {health.mailbox_accessible ? 'Accessible' : 'Not accessible'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {health.access_token_valid ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">Access Token</p>
                <p className="text-xs text-slate-500">
                  {health.access_token_valid ? 'Valid' : 'Invalid'}
                </p>
              </div>
            </div>
          </div>
          {health.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{health.error_message}</p>
            </div>
          )}
        </div>
      )}

      {/* Manual Processing */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
          <Mail className="w-5 h-5" />
          <span>Manual Email Processing</span>
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Trigger immediate email processing independently of the automatic scheduler. This will check for new CV attachments right now.
        </p>
        <button
          onClick={processEmails}
          disabled={isProcessing}
          className="w-full px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            background: isProcessing ? '#64748b' : 'linear-gradient(135deg, rgba(0,82,155,0.7) 0%, rgba(0,61,115,0.7) 100%)',
            boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(0, 61, 115, 0.3)',
          }}
        >
          <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'Processing...' : 'Process Emails Now'}</span>
        </button>
      </div>

      {/* Processing Results */}
      {processingResult && (
        <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 border shadow-lg ${
          processingResult.success ? 'border-green-200' : 'border-red-200'
        }`}>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
            {processingResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span>Processing Results</span>
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">{processingResult.message}</p>
            {processingResult.processed_count !== undefined && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Total Processed</p>
                  <p className="text-2xl font-bold text-blue-800">{processingResult.processed_count}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Successful</p>
                  <p className="text-2xl font-bold text-green-800">{processingResult.successful_count}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Failed</p>
                  <p className="text-2xl font-bold text-red-800">{processingResult.failed_count}</p>
                </div>
              </div>
            )}
            {processingResult.processing_time && (
              <p className="text-xs text-slate-500">
                Processing time: {processingResult.processing_time.toFixed(2)}s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      {status && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Today's Processing Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 font-medium">Total Processed</p>
              <p className="text-2xl font-bold text-slate-800">{status.total_processed_today}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600 font-medium">Successful</p>
              <p className="text-2xl font-bold text-green-800">{status.successful_today}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600 font-medium">Failed</p>
              <p className="text-2xl font-bold text-red-800">{status.failed_today}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
