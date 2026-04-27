/**
 * AI-Enhanced Candidate Card Component
 * 
 * Premium card design for top candidates with LLM analysis.
 * Shows matched/missing/bonus skills, AI-generated summaries,
 * and dual scoring (semantic + AI).
 */

import React, { useState } from 'react';
import { Star, Target, ChevronDown, ChevronUp, Briefcase, Calendar } from 'lucide-react';

export const AIEnhancedCard = ({ candidate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    cv_id,
    cv_name,
    cv_job_title,
    cv_years,
    overall_score,
    semantic_score,
    llm_analysis,
    skills_score,
    responsibilities_score,
    job_title_score,
    years_score
  } = candidate;
  
  // Extract LLM analysis data
  const {
    llm_score = overall_score * 100,
    matched_skills = [],
    missing_skills = [],
    extra_skills = [],
    responsibility_match = "Unknown",
    overall_fit = "",
    red_flags = []
  } = llm_analysis || {};
  
  // Convert scores to percentages
  const semanticPercent = (semantic_score || overall_score) * 100;
  const aiPercent = llm_score;
  
  return (
    <div className="
      relative p-6 rounded-xl
      bg-gradient-to-br from-white to-blue-50
      shadow-xl hover:shadow-2xl
      transition-all duration-300
      hover:scale-[1.02]
      border-2 border-transparent
      before:absolute before:inset-0 before:-z-10 before:rounded-xl
      before:bg-gradient-to-r before:from-yellow-400 before:to-blue-500
      before:p-[2px]
    ">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
            {cv_name.charAt(0)}
          </div>
          
          {/* Info */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{cv_name}</h3>
            <p className="text-gray-600 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {cv_job_title}
            </p>
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {cv_years} years experience
            </p>
          </div>
        </div>
        
        {/* Badge */}
        <div className="flex flex-col gap-1">
          <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            AI Enhanced
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium text-center">
            💎 Premium
          </span>
        </div>
      </div>
      
      {/* Scores Section */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Semantic Score */}
        <div className="px-4 py-3 rounded-lg bg-gray-100">
          <div className="text-xs text-gray-500 mb-1">Semantic Match</div>
          <div className="text-lg font-bold text-gray-700">{semanticPercent.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Vector Similarity</div>
        </div>
        
        {/* AI Score */}
        <div className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600">
          <div className="text-xs text-green-100 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3" /> AI Score
          </div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            {aiPercent.toFixed(1)}%
            <Target className="w-5 h-5" />
          </div>
          <div className="text-xs text-green-100">Contextual Analysis</div>
        </div>
      </div>
      
      {/* Skills Breakdown */}
      {matched_skills.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs">✓</span>
            Matched Skills ({matched_skills.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {matched_skills.map((skill, idx) => (
              <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {missing_skills.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs">✗</span>
            Missing Skills ({missing_skills.length})
          </h4>
          <div className="flex flex-wrap  gap-2">
            {missing_skills.map((skill, idx) => (
              <span key={idx} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {extra_skills.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-xs">💎</span>
            Bonus Skills ({extra_skills.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {extra_skills.map((skill, idx) => (
              <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* AI Analysis Summary */}
      <div className="border-t border-gray-200 pt-4">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left hover:bg-gray-50 p-2 rounded-lg transition"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            📝 AI Analysis
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {isExpanded && (
          <div className="mt-3 p-4 bg-blue-50 rounded-lg space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Overall Fit:</div>
              <p className="text-sm text-gray-800 leading-relaxed">{overall_fit}</p>
            </div>
            
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-1">Responsibility Match:</div>
              <p className="text-sm text-gray-800">{responsibility_match}</p>
            </div>
            
            {red_flags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-600 mb-1">⚠️ Red Flags:</div>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {red_flags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button className="flex-1 px-4 py-2 bg-gradient-primary text-white rounded-lg font-medium transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
          <Briefcase className="w-4 h-4 text-white" />
          <span className="text-white">View Full CV</span>
        </button>
        <button className="flex-1 px-4 py-2 bg-gradient-primary text-white rounded-lg font-medium transition shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
          <Star className="w-4 h-4 text-white" />
          <span className="text-white">Shortlist</span>
        </button>
      </div>
    </div>
  );
};

export default AIEnhancedCard;
