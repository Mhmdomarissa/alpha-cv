'use client';

import React, { useState } from 'react';
import { 
  Home,
  Upload, 
  Database, 
  Target, 
  Activity,
  Briefcase,
  X,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Play,
  CheckCircle,
  ArrowRight,
  Users,
  FileText,
  BarChart3,
  Settings,
  Zap,
  Lightbulb,
  HelpCircle,
  Plus,
  Edit,
  Building
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  steps: string[];
  tips?: string[];
  features: string[];
}

const guideSections: GuideSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: Home,
    description: 'Your central hub for overview and quick actions',
    steps: [
      'View system statistics and document counts',
      'Access quick action buttons for common tasks',
      'Monitor recent AI matching results',
      'Check system health status'
    ],
    tips: [
      'Use the quick action buttons to jump directly to specific features',
      'Monitor the stats cards to track your document processing progress',
      'Check the system status to ensure everything is running smoothly'
    ],
    features: [
      'Real-time statistics display',
      'Quick action shortcuts',
      'Recent matches overview',
      'System health monitoring'
    ]
  },
  {
    id: 'upload',
    title: 'Upload Documents',
    icon: Upload,
    description: 'Upload CVs and job descriptions for AI processing',
    steps: [
      'Click the Upload tab in the navigation',
      'Drag and drop files or click to browse',
      'Supported formats: PDF, DOC, DOCX, TXT',
      'Wait for processing to complete',
      'Review uploaded documents in the database'
    ],
    tips: [
      'Upload multiple files at once for faster processing',
      'Ensure documents are clear and readable for best AI results',
      'Use descriptive filenames to easily identify documents later'
    ],
    features: [
      'Drag and drop file upload',
      'Multiple file format support',
      'Real-time processing status',
      'Automatic document parsing'
    ]
  },
  {
    id: 'database',
    title: 'Document Database',
    icon: Database,
    description: 'Manage and review all your uploaded documents',
    steps: [
      'View all uploaded CVs and job descriptions',
      'Search and filter documents by name or type',
      'Preview document contents',
      'Delete or manage individual documents',
      'Export documents if needed'
    ],
    tips: [
      'Use the search function to quickly find specific documents',
      'Filter by document type to organize your database',
      'Preview documents before running matches to ensure quality'
    ],
    features: [
      'Document preview and management',
      'Search and filtering capabilities',
      'Bulk operations support',
      'Export functionality'
    ]
  },
  {
    id: 'match',
    title: 'AI Matching',
    icon: Target,
    description: 'Run AI-powered matching between CVs and job descriptions',
    steps: [
      'Ensure you have both CVs and job descriptions uploaded',
      'Select the job description you want to match against',
      'Choose which CVs to include in the matching process',
      'Click "Start AI Matching" to begin processing',
      'Review the matching results and scores'
    ],
    tips: [
      'Match against one job description at a time for best results',
      'Include all relevant CVs for comprehensive matching',
      'Review match scores to identify top candidates',
      'Use the detailed breakdown to understand why candidates match'
    ],
    features: [
      'AI-powered candidate matching',
      'Detailed scoring breakdown',
      'Skills and experience analysis',
      'Exportable results'
    ]
  },
  {
    id: 'performance',
    title: 'Performance Monitoring',
    icon: Activity,
    description: 'Monitor system performance and analytics',
    steps: [
      'View real-time system metrics',
      'Monitor processing times and success rates',
      'Check database performance statistics',
      'Review system health indicators',
      'Access detailed analytics and reports'
    ],
    tips: [
      'Monitor performance regularly to ensure optimal system operation',
      'Check processing times to identify potential bottlenecks',
      'Use analytics to understand usage patterns'
    ],
    features: [
      'Real-time system monitoring',
      'Performance analytics',
      'Health status indicators',
      'Usage statistics'
    ]
  },
  {
    id: 'careers',
    title: 'Job Postings',
    icon: Briefcase,
    description: 'Create and manage job postings for your organization',
    steps: [
      'Click the Careers tab in the navigation',
      'Click "Create New Job Posting"',
      'Fill in job details (title, description, requirements)',
      'Add company information and benefits',
      'Set application deadline and requirements',
      'Publish the job posting',
      'Manage applications and candidates'
    ],
    tips: [
      'Write detailed job descriptions for better candidate matching',
      'Include specific skills and requirements',
      'Set realistic application deadlines',
      'Regularly review and update job postings'
    ],
    features: [
      'Job posting creation and management',
      'Application tracking',
      'Candidate management',
      'Automated matching with uploaded CVs'
    ]
  }
];

const jobPostingGuide = {
  title: 'How to Post a Job',
  description: 'Complete guide to creating and managing job postings',
  steps: [
    {
      title: 'Access Job Postings',
      description: 'Navigate to the Careers tab in the main navigation',
      icon: Briefcase
    },
    {
      title: 'Create New Posting',
      description: 'Click the "Create New Job Posting" button',
      icon: Plus
    },
    {
      title: 'Job Information',
      description: 'Fill in basic job details: title, department, location, and type',
      icon: FileText
    },
    {
      title: 'Job Description',
      description: 'Write a detailed description of responsibilities and requirements',
      icon: Edit
    },
    {
      title: 'Skills & Requirements',
      description: 'List required skills, experience level, and qualifications',
      icon: Target
    },
    {
      title: 'Company Details',
      description: 'Add company information, benefits, and culture details',
      icon: Building
    },
    {
      title: 'Application Settings',
      description: 'Set application deadline, requirements, and screening questions',
      icon: Settings
    },
    {
      title: 'Review & Publish',
      description: 'Review all information and publish the job posting',
      icon: CheckCircle
    }
  ]
};

export default function UserGuide() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showJobGuide, setShowJobGuide] = useState(false);

  const toggleSection = (sectionId: string) => {
    setActiveSection(activeSection === sectionId ? null : sectionId);
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
                }}
              >
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  User Guide
                </h1>
                <p className="text-slate-600 font-medium">
                  Learn how to use Alpha CV effectively
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
          {/* Main Guide Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Start */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Quick Start Guide</h2>
                  <p className="text-slate-600 font-medium">Get up and running in minutes</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-3 text-sm font-bold">1</div>
                  <h3 className="font-semibold text-slate-800 mb-2">Upload Documents</h3>
                  <p className="text-sm text-slate-600">Upload CVs and job descriptions</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-3 text-sm font-bold">2</div>
                  <h3 className="font-semibold text-slate-800 mb-2">Run AI Matching</h3>
                  <p className="text-sm text-slate-600">Let AI find the best matches</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center mx-auto mb-3 text-sm font-bold">3</div>
                  <h3 className="font-semibold text-slate-800 mb-2">Review Results</h3>
                  <p className="text-sm text-slate-600">Analyze and export matches</p>
                </div>
              </div>
            </div>

            {/* Platform Features */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Platform Features</h2>
                  <p className="text-slate-600 font-medium">Explore all available tools and capabilities</p>
                </div>
              </div>

              <div className="space-y-4">
                {guideSections.map((section) => {
                  const IconComponent = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div key={section.id} className="border border-white/20 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-6 bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                            style={{ 
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)'
                            }}
                          >
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-slate-800 text-lg">{section.title}</h3>
                            <p className="text-slate-600 font-medium">{section.description}</p>
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
                                <Play className="w-4 h-4 mr-2 text-blue-500" />
                                How to Use
                              </h4>
                              <ol className="space-y-2">
                                {section.steps.map((step, index) => (
                                  <li key={index} className="flex items-start space-x-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                                      {index + 1}
                                    </div>
                                    <span className="text-sm text-slate-600">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                Key Features
                              </h4>
                              <ul className="space-y-2">
                                {section.features.map((feature, index) => (
                                  <li key={index} className="flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                    <span className="text-sm text-slate-600">{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          {section.tips && (
                            <div className="mt-6 p-4 rounded-xl bg-blue-50/50 border border-blue-200/50">
                              <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                                <Lightbulb className="w-4 h-4 mr-2" />
                                Pro Tips
                              </h4>
                              <ul className="space-y-1">
                                {section.tips.map((tip, index) => (
                                  <li key={index} className="text-sm text-blue-700 flex items-start space-x-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
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
            {/* Job Posting Guide */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                  style={{ 
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Job Posting Guide</h3>
                  <p className="text-sm text-slate-600">Step-by-step instructions</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowJobGuide(!showJobGuide)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200"
              >
                <span className="font-medium text-slate-700">How to Post a Job</span>
                {showJobGuide ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              
              {showJobGuide && (
                <div className="mt-4 space-y-3 animate-slide-up">
                  {jobPostingGuide.steps.map((step, index) => {
                    const IconComponent = step.icon;
                    return (
                      <div key={index} className="flex items-start space-x-3 p-3 rounded-xl bg-white/40 backdrop-blur-sm border border-white/20">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800 text-sm">{step.title}</h4>
                          <p className="text-xs text-slate-600">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Need Help?</h3>
                  <p className="text-sm text-slate-600">Get support and assistance</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Documentation</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <Users className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-slate-700">Contact Support</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <Settings className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-slate-700">System Settings</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
              <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                  <span className="font-medium">Start Tutorial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/20 hover:bg-white/80 transition-all duration-200">
                  <span className="font-medium text-slate-700">View Demo</span>
                  <Play className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
