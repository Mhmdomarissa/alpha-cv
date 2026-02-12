import React from 'react';
import { X } from 'lucide-react';

interface QueueStatusModalProps {
  isOpen: boolean;
  queuePosition: number | null;
  estimatedWaitTime: number | null; // seconds
  message: string | null;
  onClose?: () => void;
}

export default function QueueStatusModal({
  isOpen,
  queuePosition,
  estimatedWaitTime,
  message,
  onClose,
}: QueueStatusModalProps) {
  if (!isOpen) return null;

  const waitMinutes = estimatedWaitTime ? Math.ceil(estimatedWaitTime / 60) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Matching Queue</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="animate-spin h-6 w-6 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-gray-700 font-medium">Waiting in queue...</p>
              {queuePosition !== null && (
                <p className="text-sm text-gray-500">
                  Your position: <span className="font-semibold">#{queuePosition}</span>
                </p>
              )}
            </div>
          </div>

          {message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          )}

          {waitMinutes !== null && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Estimated wait time:</span>{' '}
                {waitMinutes} {waitMinutes === 1 ? 'minute' : 'minutes'}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Your matching request will start automatically once it's your turn.
              <br />
              You can close this window - we'll notify you when it's ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
