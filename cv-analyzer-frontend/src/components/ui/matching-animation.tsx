'use client';

import React from 'react';
import { Target } from 'lucide-react';

interface MatchingAnimationProps {
  isVisible: boolean;
}

export default function MatchingAnimation({ isVisible }: MatchingAnimationProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-spin mb-4">
            <Target className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Matching...</h2>
        </div>
      </div>
    </div>
  );
}
