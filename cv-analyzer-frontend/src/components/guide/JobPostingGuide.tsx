'use client';

import React, { useState } from 'react';
import { 
  Briefcase,
  FileText,
  Target,
  Building,
  Settings,
  CheckCircle,
  ArrowRight,
  Users,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Star,
  X,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  AlertCircle
} from 'lucide-react';

interface JobPostingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  details: string[];
  tips: string[];
  required: boolean;
}

const jobPostingSteps: JobPostingStep[] = [
  {
    id: 'basic-info',
    title: 'Basic Job Information',
    description: 'Set up the fundamental details of your job posting',
    icon: FileText,
    required: true,
    details: [
      'Job title (e.g., "Senior Software Engineer")',
      'Department or team',
      'Employment type (Full-time, Part-time, Contract)',
      'Location (Remote, On-site, Hybrid)',
      'Salary range (optional but recommended)'
    ],
    tips: [
      'Use clear, specific job titles that candidates will search for',
      'Include remote work options to attract more candidates',
      'Be transparent about salary ranges to set expectations'
    ]
  },
  {
    id: 'description',
    title: 'Job Description',
    description: 'Write a compelling and detailed job description',
    icon: Target,
    required: true,
    details: [
      'Company overview and mission',
      'Role responsibilities and daily tasks',
      'Key performance indicators (KPIs)',
      'Growth opportunities and career path',
      'Team structure and reporting relationships'
    ],
    tips: [
      'Use bullet points for easy scanning',
      'Focus on outcomes and impact, not just tasks',
      'Include specific examples of projects or challenges',
      'Highlight unique aspects of your company culture'
    ]
  },
  {
    id: 'requirements',
    title: 'Skills & Requirements',
    description: 'Define the qualifications and skills needed',
    icon: Users,
    required: true,
    details: [
      'Required technical skills',
      'Preferred qualifications',
      'Years of experience needed',
      'Education requirements',
      'Certifications or licenses',
      'Soft skills and personality traits'
    ],
    tips: [
      'Distinguish between "must-have" and "nice-to-have" skills',
      'Focus on skills that directly impact job performance',
      'Consider transferable skills from other industries',
      'Avoid overly restrictive requirements that limit diversity'
    ]
  },
  {
    id: 'company-details',
    title: 'Company Information',
    description: 'Showcase your company and what makes it special',
    icon: Building,
    required: false,
    details: [
      'Company size and industry',
      'Company culture and values',
      'Benefits and perks',
      'Work environment',
      'Recent achievements or awards',
      'Social responsibility initiatives'
    ],
    tips: [
      'Use authentic photos of your office and team',
      'Highlight unique benefits that set you apart',
      'Share employee testimonials or success stories',
      'Include diversity and inclusion initiatives'
    ]
  },
  {
    id: 'application-settings',
    title: 'Application Settings',
    description: 'Configure how candidates apply and screening process',
    icon: Settings,
    required: true,
    details: [
      'Application deadline',
      'Required documents (resume, cover letter, portfolio)',
      'Screening questions',
      'Interview process overview',
      'Timeline for hiring decision',
      'Contact information for questions'
    ],
    tips: [
      'Set realistic deadlines to allow quality applications',
      'Ask relevant screening questions to filter candidates',
      'Provide clear timeline expectations',
      'Make it easy for candidates to ask questions'
    ]
  }
];

const bestPractices = [
  {
    title: 'Write Inclusive Job Descriptions',
    description: 'Use gender-neutral language and focus on skills rather than personality traits',
    icon: Users
  },
  {
    title: 'Be Specific About Requirements',
    description: 'Clearly distinguish between must-have and nice-to-have qualifications',
    icon: Target
  },
  {
    title: 'Highlight Company Culture',
    description: 'Showcase what makes your company unique and attractive to candidates',
    icon: Star
  },
  {
    title: 'Set Clear Expectations',
    description: 'Provide realistic timelines and transparent application processes',
    icon: Clock
  }
];

export default function JobPostingGuide() {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [showBestPractices, setShowBestPractices] = useState(false);

  const toggleStep = (stepId: string) => {
    setActiveStep(activeStep === stepId ? null : stepId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)'
                }}
              >
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Job Posting Guide
                </h1>
                <p className="text-slate-600 font-medium">
                  Create compelling job postings that attract top talent
                </p>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 shadow-sm text-slate-600 hover:text-slate-800 hover:bg-white/80 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Creating Effective Job Postings</h2>
                  <p className="text-slate-600 font-medium">Follow these steps to attract the right candidates</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                      <Target className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Clear Requirements</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Define specific skills and qualifications to attract qualified candidates
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center">
                      <Star className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Company Culture</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Showcase what makes your company unique and attractive to candidates
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Step-by-Step Process</h2>
                  <p className="text-slate-600 font-medium">Follow these steps to create your job posting</p>
                </div>
              </div>

              <div className="space-y-4">
                {jobPostingSteps.map((step, index) => {
                  const IconComponent = step.icon;
                  const isActive = activeStep === step.id;
                  
                  return (
                    <div key={step.id} className="border border-white/20 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="w-full flex items-center justify-between p-6 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md"
                              style={{ 
                                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)'
                              }}
                            >
                              {index + 1}
                            </div>
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                              style={{ 
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
                              }}
                            >
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-slate-800 text-lg">{step.title}</h3>
                              {step.required && (
                                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 font-medium">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-slate-600 font-medium">{step.description}</p>
                          </div>
                        </div>
                        {isActive ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      
                      {isActive && (
                        <div className="p-6 bg-white/40 backdrop-blur-sm border-t border-white/20 animate-slide-up">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                What to Include
                              </h4>
                              <ul className="space-y-2">
                                {step.details.map((detail, detailIndex) => (
                                  <li key={detailIndex} className="flex items-start space-x-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2"></div>
                                    <span className="text-sm text-slate-600">{detail}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                                <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" />
                                Pro Tips
                              </h4>
                              <ul className="space-y-2">
                                {step.tips.map((tip, tipIndex) => (
                                  <li key={tipIndex} className="flex items-start space-x-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2"></div>
                                    <span className="text-sm text-slate-600">{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Best Practices */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Star className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Best Practices</h3>
                  <p className="text-sm text-slate-600">Tips for success</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {bestPractices.map((practice, index) => {
                  const IconComponent = practice.icon;
                  return (
                    <div key={index} className="p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-sm mb-1">{practice.title}</h4>
                          <p className="text-xs text-slate-600">{practice.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                  <span className="font-medium">Create Job Posting</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <span className="font-medium text-slate-700">View Templates</span>
                  <FileText className="w-4 h-4 text-slate-400" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <span className="font-medium text-slate-700">Analytics</span>
                  <Target className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Help & Support */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                  style={{ 
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Need Help?</h3>
                  <p className="text-sm text-slate-600">Get support</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Contact HR Team</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <FileText className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-slate-700">View Examples</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <Settings className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-slate-700">Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
