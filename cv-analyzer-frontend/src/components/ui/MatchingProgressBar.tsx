'use client';

import React from 'react';
import { Target, Brain, Users, CheckCircle, Clock } from 'lucide-react';

interface MatchingProgressBarProps {
  totalCVs: number;
  processedCVs: number;
  currentStage: 'initializing' | 'processing' | 'analyzing' | 'scoring' | 'finalizing';
  estimatedTimeRemaining?: number;
  isVisible: boolean;
}

const stageInfo = {
  initializing: {
    title: 'Initializing',
    description: 'Setting up AI models and preparing data...',
    icon: Target,
    color: 'text-[#00529b]',
    bgColor: 'bg-[#00529b]/10',
  },
  processing: {
    title: 'Processing CVs',
    description: 'Extracting and analyzing candidate information...',
    icon: Users,
    color: 'text-[#00529b]',
    bgColor: 'bg-[#00529b]/10',
  },
  analyzing: {
    title: 'Analyzing Matches',
    description: 'Comparing skills and experience with job requirements...',
    icon: Brain,
    color: 'text-[#00529b]',
    bgColor: 'bg-[#00529b]/10',
  },
  scoring: {
    title: 'Calculating Scores',
    description: 'Computing weighted match scores and rankings...',
    icon: CheckCircle,
    color: 'text-[#00529b]',
    bgColor: 'bg-[#00529b]/10',
  },
  finalizing: {
    title: 'Finalizing',
    description: 'Preparing your match results...',
    icon: Clock,
    color: 'text-[#00529b]',
    bgColor: 'bg-[#00529b]/10',
  },
};

export default function MatchingProgressBar({
  totalCVs,
  processedCVs,
  currentStage,
  estimatedTimeRemaining,
  isVisible,
}: MatchingProgressBarProps) {
  if (!isVisible) return null;

  const progress = totalCVs > 0 ? (processedCVs / totalCVs) * 100 : 0;
  const stage = stageInfo[currentStage];
  const Icon = stage.icon;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
        {/* Headline + engaging line */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            AI Matching in Progress
          </h2>
          <p className="text-sm text-gray-500">
            Finding the best candidates for your role — stay tuned
          </p>
        </div>

        {/* Current stage icon with pulse */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 rounded-2xl ${stage.bgColor} flex items-center justify-center animate-matching-pulse`}>
            <Icon className={`w-10 h-10 ${stage.color}`} />
          </div>
        </div>

        {/* Animated waiting dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#00529b] animate-matching-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{stage.title}</span>
            <span className="text-sm font-semibold text-[#00529b]">
              {processedCVs} / {totalCVs}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-[#00529b] rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">{stage.description}</p>
        </div>

        {/* Stage steps */}
        <div className="flex justify-between items-center mb-5">
          {Object.entries(stageInfo).map(([key, info], index) => {
            const isActive = key === currentStage;
            const isCompleted = Object.keys(stageInfo).indexOf(currentStage) > index;
            const IconSmall = info.icon;
            return (
              <div key={key} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted ? 'bg-emerald-500 text-white' : isActive ? `${info.bgColor} ${info.color}` : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : <IconSmall className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] mt-1 ${isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {index + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time remaining */}
        {estimatedTimeRemaining != null && estimatedTimeRemaining > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
            <Clock className="w-4 h-4 text-[#00529b]" />
            <span>About {formatTime(estimatedTimeRemaining)} remaining</span>
          </div>
        )}

        {/* Compact stats */}
        <div className="flex justify-between text-xs text-gray-500 px-1">
          <span>Processed: {processedCVs}</span>
          <span>Remaining: {Math.max(0, totalCVs - processedCVs)}</span>
        </div>
      </div>
    </div>
  );
}
