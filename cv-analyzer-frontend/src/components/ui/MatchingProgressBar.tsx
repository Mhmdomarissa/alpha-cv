'use client';
import React from 'react';
import { motion } from 'framer-motion';
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
    title: 'Initializing Matching',
    description: 'Setting up AI models and preparing data...',
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  processing: {
    title: 'Processing CVs',
    description: 'Extracting and analyzing candidate information...',
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  analyzing: {
    title: 'Analyzing Matches',
    description: 'Comparing skills and experience with job requirements...',
    icon: Brain,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  scoring: {
    title: 'Calculating Scores',
    description: 'Computing weighted match scores and rankings...',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  finalizing: {
    title: 'Finalizing Results',
    description: 'Preparing final match results and rankings...',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className={`w-16 h-16 rounded-full ${stage.bgColor} flex items-center justify-center mx-auto mb-4`}
          >
            <Icon className={`w-8 h-8 ${stage.color} animate-pulse`} />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            AI Matching in Progress
          </h2>
          <p className="text-gray-600">
            Analyzing {totalCVs} candidate{totalCVs !== 1 ? 's' : ''} for the best matches
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              {stage.title}
            </span>
            <span className="text-sm font-semibold text-indigo-600">
              {processedCVs} / {totalCVs} CVs
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {stage.description}
            </span>
            <span className="text-xs font-medium text-gray-700">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Stage Indicators */}
        <div className="flex justify-between items-center mb-6">
          {Object.entries(stageInfo).map(([key, info], index) => {
            const isActive = key === currentStage;
            const isCompleted = Object.keys(stageInfo).indexOf(currentStage) > index;
            const Icon = info.icon;
            
            return (
              <div key={key} className="flex flex-col items-center">
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? `${info.bgColor} ${info.color}`
                      : 'bg-gray-200 text-gray-400'
                  }`}
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </motion.div>
                <span className={`text-xs mt-1 ${
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}>
                  {index + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time Estimation */}
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Estimated time remaining: {formatTime(estimatedTimeRemaining)}</span>
            </div>
          </div>
        )}

        {/* Animated Dots */}
        <div className="flex justify-center mt-6">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-indigo-500 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </div>

        {/* Progress Details */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">CVs Processed:</span>
              <span className="font-semibold text-gray-900 ml-2">
                {processedCVs}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Remaining:</span>
              <span className="font-semibold text-gray-900 ml-2">
                {totalCVs - processedCVs}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
