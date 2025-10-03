'use client';

import React, { useState } from 'react';
import { 
  X,
  ChevronRight,
  ChevronLeft,
  Upload,
  Database,
  Target,
  CheckCircle,
  Play,
  ArrowRight
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: string;
  tab?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'upload',
    title: 'Upload Documents',
    description: 'Start by uploading CVs and job descriptions. Drag and drop files or click to browse.',
    icon: Upload,
    action: 'Go to Upload Tab',
    tab: 'upload'
  },
  {
    id: 'database',
    title: 'Review Database',
    description: 'Check your uploaded documents in the database. Make sure everything looks correct.',
    icon: Database,
    action: 'View Database',
    tab: 'database'
  },
  {
    id: 'match',
    title: 'Run AI Matching',
    description: 'Select a job description and CVs, then run AI matching to find the best candidates.',
    icon: Target,
    action: 'Start Matching',
    tab: 'match'
  }
];

interface QuickTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export default function QuickTutorial({ isOpen, onClose, onNavigate }: QuickTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const currentTutorialStep = tutorialSteps[currentStep];
  const IconComponent = currentTutorialStep.icon;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = () => {
    if (currentTutorialStep.tab) {
      onNavigate(currentTutorialStep.tab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Tutorial Modal */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
              }}
            >
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Quick Tutorial</h2>
              <p className="text-sm text-slate-600">Step {currentStep + 1} of {tutorialSteps.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 shadow-sm text-slate-600 hover:text-slate-800 hover:bg-white/80 transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex space-x-2">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  index <= currentStep 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600' 
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ 
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)'
            }}
          >
            <IconComponent className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">
            {currentTutorialStep.title}
          </h3>
          <p className="text-slate-600 font-medium leading-relaxed">
            {currentTutorialStep.description}
          </p>
        </div>

        {/* Action Button */}
        {currentTutorialStep.action && (
          <button
            onClick={handleAction}
            className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 mb-6"
          >
            <span className="font-semibold">{currentTutorialStep.action}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 text-slate-600 hover:bg-white/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">Previous</span>
          </button>

          <div className="flex space-x-2">
            {tutorialSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentStep 
                    ? 'bg-blue-500' 
                    : 'bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 text-slate-600 hover:bg-white/80 transition-all duration-200"
          >
            <span className="font-medium">
              {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
