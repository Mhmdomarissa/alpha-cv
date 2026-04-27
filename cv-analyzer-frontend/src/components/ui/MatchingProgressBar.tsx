'use client';

import React from 'react';
import { Target, Brain, Users, CheckCircle, Clock } from 'lucide-react';
import { Typewriter } from './Typewriter';

interface MatchingProgressBarProps {
  totalCVs: number;
  processedCVs: number;
  currentStage: 'initializing' | 'processing' | 'analyzing' | 'scoring' | 'finalizing';
  estimatedTimeRemaining?: number;
  isVisible: boolean;
  currentBatch?: number;
  totalBatches?: number;
  phase?: 'initializing' | 'batches' | 'llm_verification' | 'finalizing';
}

const stageInfo = {
  initializing: {
    title: 'Initializing',
    description: 'Setting up AI models and preparing data...',
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
  processing: {
    title: 'Processing CVs',
    description: 'Extracting and analyzing candidate information...',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
  analyzing: {
    title: 'Analyzing Matches',
    description: 'Comparing skills and experience with job requirements...',
    icon: Brain,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
  scoring: {
    title: 'Calculating Scores',
    description: 'Computing weighted match scores and rankings...',
    icon: CheckCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
  finalizing: {
    title: 'Finalizing',
    description: 'Preparing your match results...',
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
};

export default function MatchingProgressBar({
  totalCVs,
  processedCVs,
  currentStage,
  estimatedTimeRemaining,
  isVisible,
  currentBatch = 0,
  totalBatches = 0,
  phase = 'initializing',
}: MatchingProgressBarProps) {
  if (!isVisible) return null;

  const progress = totalCVs > 0 ? (processedCVs / totalCVs) * 100 : 0;
  const stage = stageInfo[currentStage];
  const Icon = stage.icon;

  const batchStatusMessage =
    phase === 'batches' && totalBatches > 0 && currentBatch >= 1
      ? (() => {
          if (currentBatch <= 3) {
            const completed = Array.from({ length: currentBatch }, (_, i) => `Batch ${i + 1} matched`).join(', ');
            return currentBatch < totalBatches ? `${completed}…` : `${completed}.`;
          }
          return `Batch 1–${currentBatch} of ${totalBatches} matched${currentBatch < totalBatches ? '…' : '.'}`;
        })()
      : phase === 'llm_verification'
        ? 'Second step: Running AI verification for accurate matching…'
        : phase === 'finalizing'
          ? 'Preparing your match results…'
          : null;

  return (
    <div className="fixed inset-0 z-[100] p-4 animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-[#00529b]/25 via-black/40 to-sky-500/20" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-8 border border-white/60 ring-1 ring-black/5 mx-auto">
        {/* Headline + engaging line */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 mb-1 min-h-[1.5em]">
            <Typewriter text="AI Matching in Progress" speed={50} delay={0} cursor={false} />
          </h2>
          <p className="text-sm text-gray-500 min-h-[1.25em]">
            <Typewriter text="Finding the best candidates for your role — stay tuned" speed={45} delay={200} cursor={false} />
          </p>
        </div>

        {/* Current stage icon with pulse */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-[#00529b]/25 to-sky-500/15 blur-md" />
            <div className={`relative w-20 h-20 rounded-2xl ${stage.bgColor} flex items-center justify-center animate-matching-pulse border border-[#00529b]/15`}>
              <Icon className={`w-10 h-10 ${stage.color}`} />
            </div>
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
            <span className="text-sm font-semibold text-blue-600">
              {processedCVs} / {totalCVs}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-primary rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5 min-h-[1rem]">
            <Typewriter key={currentStage} text={stage.description} speed={30} delay={0} cursor={false} />
          </p>
          {batchStatusMessage && (
            <p className="text-xs font-medium text-blue-600 mt-2 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00529b] animate-matching-dot" />
              {batchStatusMessage}
            </p>
          )}
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

        {/* Compact stats */}
        <div className="flex justify-between text-xs text-gray-500 px-1">
          <span>Processed: {processedCVs}</span>
          <span>Remaining: {Math.max(0, totalCVs - processedCVs)}</span>
        </div>
      </div>
    </div>
  );
}
