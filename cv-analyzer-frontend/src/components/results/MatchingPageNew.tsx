'use client';

import React, { useState } from 'react';
import { 
  Target, 
  Brain, 
  TrendingUp, 
  Users, 
  Award, 
  ChevronDown, 
  ChevronUp, 
  BarChart3, 
  Eye, 
  Download, 
  Settings,
  Star,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Zap,
  Clock,
  Filter
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function MatchingPageNew() {
  const { matchResult, matchWeights, setMatchWeights, cvs, jds, selectedJD } = useAppStore();
  
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'skills' | 'experience'>('score');
  const [filterThreshold, setFilterThreshold] = useState(0);

  if (!matchResult?.candidates || matchResult.candidates.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="heading-lg">AI Matching Results</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--gray-600)' }}>
            Step 3: Run Match
          </p>
        </div>

        <div className="text-center py-16">
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--gray-100)' }}
          >
            <Target className="w-10 h-10" style={{ color: 'var(--gray-400)' }} />
          </div>
          <h3 className="heading-md mb-4" style={{ color: 'var(--gray-700)' }}>
            No matches yet
          </h3>
          <p className="text-base mb-6" style={{ color: 'var(--gray-500)' }}>
            Select CVs and a job description from the Database to run AI matching
          </p>
          <button
            onClick={() => useAppStore.getState().setCurrentTab('database')}
            className="btn-primary"
          >
            <ArrowRight className="w-4 h-4" />
            Go to Database
          </button>
        </div>
      </div>
    );
  }

  const totalMatches = matchResult.candidates.length;
  const excellentMatches = matchResult.candidates.filter(c => c.overall_score >= 0.8).length;
  const goodMatches = matchResult.candidates.filter(c => c.overall_score >= 0.6 && c.overall_score < 0.8).length;
  const averageScore = matchResult.candidates.reduce((sum, c) => sum + c.overall_score, 0) / totalMatches;
  const topScore = Math.max(...matchResult.candidates.map(c => c.overall_score));

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'var(--green-600)';
    if (score >= 0.6) return 'var(--yellow-600)';
    return 'var(--red-600)';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return { label: 'Excellent', color: 'var(--green-50)', textColor: 'var(--green-700)' };
    if (score >= 0.6) return { label: 'Good', color: 'var(--yellow-50)', textColor: 'var(--yellow-700)' };
    return { label: 'Needs Review', color: 'var(--red-50)', textColor: 'var(--red-700)' };
  };

  const sortedCandidates = [...matchResult.candidates]
    .filter(candidate => candidate.overall_score >= filterThreshold)
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.overall_score - a.overall_score;
        case 'skills':
          return (b.skills_score || 0) - (a.skills_score || 0);
        case 'experience':
          return (b.years_score || 0) - (a.years_score || 0);
        default:
          return b.overall_score - a.overall_score;
      }
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="heading-lg">AI Matching Results</h1>
        <p className="text-lg mt-2" style={{ color: 'var(--gray-600)' }}>
          Step 3: Intelligent Candidate Analysis Complete
        </p>
        <p className="text-base mt-1" style={{ color: 'var(--gray-500)' }}>
          Our AI has analyzed {totalMatches} candidate{totalMatches !== 1 ? 's' : ''} using advanced algorithms
        </p>
      </div>

      {/* Premium Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <Users className="w-6 h-6" style={{ color: 'var(--primary-600)' }} />
            </div>
          </div>
          <div className="heading-md">{totalMatches}</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Total Matches</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Candidates analyzed
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <Award className="w-6 h-6" style={{ color: 'var(--green-600)' }} />
            </div>
          </div>
          <div className="heading-md" style={{ color: 'var(--green-600)' }}>
            {Math.round(topScore * 100)}%
          </div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Best Match</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Highest scoring candidate
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--yellow-50)' }}
            >
              <BarChart3 className="w-6 h-6" style={{ color: 'var(--yellow-600)' }} />
            </div>
          </div>
          <div className="heading-md">{Math.round(averageScore * 100)}%</div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Average Score</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            Across all candidates
          </p>
        </div>

        <div className="card-elevated text-center">
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-50)' }}
            >
              <Star className="w-6 h-6" style={{ color: 'var(--green-600)' }} />
            </div>
          </div>
          <div className="heading-md" style={{ color: 'var(--green-600)' }}>
            {excellentMatches}
          </div>
          <p className="text-sm" style={{ color: 'var(--gray-600)' }}>Excellent Matches</p>
          <p className="text-xs mt-1" style={{ color: 'var(--gray-500)' }}>
            80%+ compatibility
          </p>
        </div>
      </div>

      {/* Quality Distribution */}
      <div className="card-elevated">
        <div className="flex items-center space-x-3 mb-6">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary-50)' }}
          >
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
          </div>
          <div>
            <h3 className="heading-sm">Quality Distribution</h3>
            <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
              Breakdown of candidate match quality
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(excellentMatches / totalMatches) * 100}%`,
                  backgroundColor: 'var(--green-500)'
                }}
              />
            </div>
            <div className="font-semibold" style={{ color: 'var(--green-600)' }}>
              {excellentMatches} Excellent
            </div>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              80-100% Match
            </p>
          </div>

          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(goodMatches / totalMatches) * 100}%`,
                  backgroundColor: 'var(--yellow-500)'
                }}
              />
            </div>
            <div className="font-semibold" style={{ color: 'var(--yellow-600)' }}>
              {goodMatches} Good
            </div>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              60-79% Match
            </p>
          </div>

          <div className="text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${((totalMatches - excellentMatches - goodMatches) / totalMatches) * 100}%`,
                  backgroundColor: 'var(--red-500)'
                }}
              />
            </div>
            <div className="font-semibold" style={{ color: 'var(--red-600)' }}>
              {totalMatches - excellentMatches - goodMatches} Needs Review
            </div>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              &lt;60% Match
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowWeights(!showWeights)}
            className="btn-outline"
          >
            <Settings className="w-4 h-4" />
            {showWeights ? 'Hide' : 'Show'} Weights
            {showWeights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            style={{
              borderColor: 'var(--gray-300)',
            }}
          >
            <option value="score">Sort by Overall Score</option>
            <option value="skills">Sort by Skills Match</option>
            <option value="experience">Sort by Experience</option>
          </select>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--gray-500)' }} />
            <select
              value={filterThreshold}
              onChange={(e) => setFilterThreshold(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              style={{
                borderColor: 'var(--gray-300)',
              }}
            >
              <option value={0}>All Matches</option>
              <option value={0.6}>Good+ (60%+)</option>
              <option value={0.8}>Excellent (80%+)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="btn-outline">
            <Download className="w-4 h-4" />
            Export Results
          </button>
          <button className="btn-secondary">
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Algorithm Configuration (Weights) */}
      {showWeights && (
        <div className="card-elevated">
          <div className="flex items-center space-x-3 mb-6">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-50)' }}
            >
              <Brain className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <h3 className="heading-sm">AI Algorithm Configuration</h3>
              <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                Adjust matching weights to fine-tune results
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(matchWeights).map(([key, value]) => (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-sm" style={{ color: 'var(--gray-700)' }}>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                  </label>
                  <span className="text-sm font-medium" style={{ color: 'var(--primary-600)' }}>
                    {Math.round(value * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value}
                  onChange={(e) => setMatchWeights({
                    ...matchWeights,
                    [key]: parseFloat(e.target.value)
                  })}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{ 
                    background: `linear-gradient(to right, var(--primary-500) 0%, var(--primary-500) ${value * 100}%, var(--gray-300) ${value * 100}%, var(--gray-300) 100%)`
                  }}
                />
                <div className="text-xs" style={{ color: 'var(--gray-500)' }}>
                  {key === 'skills' && 'Technical skills matching'}
                  {key === 'responsibilities' && 'Job responsibilities alignment'}
                  {key === 'job_title' && 'Job title similarity'}
                  {key === 'experience' && 'Years of experience fit'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings Grid */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--green-50)' }}
          >
            <Target className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
          </div>
          <div>
            <h3 className="heading-sm">Ranked Candidates</h3>
            <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
              {sortedCandidates.length} candidate{sortedCandidates.length !== 1 ? 's' : ''} sorted by {sortBy === 'score' ? 'overall match' : sortBy}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {sortedCandidates.map((candidate, index) => {
            const badge = getScoreBadge(candidate.overall_score);
            const isExpanded = expandedMatch === candidate.cv_id;
            
            return (
              <div 
                key={candidate.cv_id}
                className="border rounded-xl p-6 transition-all duration-200 hover:shadow-md"
                style={{ borderColor: 'var(--gray-200)' }}
              >
                {/* Match Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: getScoreColor(candidate.overall_score) }}
                      >
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg" style={{ color: 'var(--gray-900)' }}>
                          {candidate.cv_name || 'Unknown Candidate'}
                        </h4>
                        <p className="text-sm" style={{ color: 'var(--gray-600)' }}>
                          {candidate.cv_job_title || 'No title'} • {candidate.cv_years} years experience
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold" style={{ color: getScoreColor(candidate.overall_score) }}>
                          {Math.round(candidate.overall_score * 100)}%
                        </span>
                        <div 
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: badge.color,
                            color: badge.textColor
                          }}
                        >
                          {badge.label}
                        </div>
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--gray-500)' }}>
                        Overall Match Score
                      </p>
                    </div>

                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : candidate.cv_id)}
                      className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                      ) : (
                        <ChevronDown className="w-5 h-5" style={{ color: 'var(--gray-400)' }} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Score Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(candidate.skills_score || 0) * 100}%`,
                          backgroundColor: 'var(--primary-500)'
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>
                      Skills: {Math.round((candidate.skills_score || 0) * 100)}%
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(candidate.responsibilities_score || 0) * 100}%`,
                          backgroundColor: 'var(--green-500)'
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>
                      Experience: {Math.round((candidate.responsibilities_score || 0) * 100)}%
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(candidate.job_title_score || 0) * 100}%`,
                          backgroundColor: 'var(--yellow-500)'
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>
                      Title: {Math.round((candidate.job_title_score || 0) * 100)}%
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(candidate.years_score || 0) * 100}%`,
                          backgroundColor: 'var(--red-500)'
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--gray-700)' }}>
                      Years: {Math.round((candidate.years_score || 0) * 100)}%
                    </p>
                  </div>
                </div>

                {/* Why This Match Works */}
                <div 
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--primary-50)' }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Lightbulb className="w-4 h-4" style={{ color: 'var(--primary-600)' }} />
                    <span className="font-medium text-sm" style={{ color: 'var(--primary-700)' }}>
                      Why This Match Works:
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--primary-700)' }}>
                    {candidate.overall_score >= 0.8 && "• Strong alignment across all key areas"}
                    {candidate.overall_score >= 0.6 && candidate.overall_score < 0.8 && "• Good fit with some areas for development"}
                    {candidate.overall_score < 0.6 && "• Potential candidate requiring further evaluation"}
                    {(candidate.skills_score || 0) >= 0.8 && " • Excellent technical skills match"}
                    {(candidate.years_score || 0) >= 0.8 && " • Experience level aligns perfectly"}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-6 space-y-6 animate-fade-in">
                    {/* Skills Assignments */}
                    {candidate.skills_assignments && candidate.skills_assignments.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <Brain className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                          <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                            Skills Analysis ({candidate.skills_assignments.length} matches)
                          </h4>
                        </div>
                        <div className="grid gap-3 max-h-64 overflow-y-auto">
                          {candidate.skills_assignments.slice(0, 10).map((assignment, idx) => {
                            const similarity = assignment.score;
                            const quality = similarity >= 0.7 ? 'excellent' : 
                                           similarity >= 0.5 ? 'good' : 'weak';
                            const qualityColor = similarity >= 0.7 ? 'var(--green-500)' :
                                               similarity >= 0.5 ? 'var(--yellow-500)' : 'var(--red-500)';
                            
                            return (
                              <div 
                                key={idx}
                                className="p-3 rounded-lg border transition-all duration-200"
                                style={{ borderColor: 'var(--gray-200)' }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--gray-900)' }}>
                                      Required: {assignment.jd_item}
                                    </div>
                                    <div className="text-sm mb-2" style={{ color: 'var(--gray-700)' }}>
                                      Candidate has: {assignment.cv_item}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className="h-1.5 rounded-full transition-all duration-300"
                                          style={{ 
                                            width: `${similarity * 100}%`,
                                            backgroundColor: qualityColor
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium" style={{ color: qualityColor }}>
                                        {Math.round(similarity * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {candidate.skills_assignments.length > 10 && (
                            <div className="text-center py-2">
                              <span className="text-sm" style={{ color: 'var(--gray-500)' }}>
                                ... and {candidate.skills_assignments.length - 10} more skills
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Responsibilities Assignments */}
                    {candidate.responsibilities_assignments && candidate.responsibilities_assignments.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <Target className="w-5 h-5" style={{ color: 'var(--green-600)' }} />
                          <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                            Responsibilities Analysis ({candidate.responsibilities_assignments.length} matches)
                          </h4>
                        </div>
                        <div className="grid gap-3 max-h-64 overflow-y-auto">
                          {candidate.responsibilities_assignments.slice(0, 5).map((assignment, idx) => {
                            const similarity = assignment.score;
                            const qualityColor = similarity >= 0.7 ? 'var(--green-500)' :
                                               similarity >= 0.5 ? 'var(--yellow-500)' : 'var(--red-500)';
                            
                            return (
                              <div 
                                key={idx}
                                className="p-3 rounded-lg border transition-all duration-200"
                                style={{ borderColor: 'var(--gray-200)' }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--gray-900)' }}>
                                      Required: {assignment.jd_item.length > 100 ? assignment.jd_item.substring(0, 100) + '...' : assignment.jd_item}
                                    </div>
                                    <div className="text-sm mb-2" style={{ color: 'var(--gray-700)' }}>
                                      Experience: {assignment.cv_item.length > 100 ? assignment.cv_item.substring(0, 100) + '...' : assignment.cv_item}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className="h-1.5 rounded-full transition-all duration-300"
                                          style={{ 
                                            width: `${similarity * 100}%`,
                                            backgroundColor: qualityColor
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium" style={{ color: qualityColor }}>
                                        {Math.round(similarity * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {candidate.responsibilities_assignments.length > 5 && (
                            <div className="text-center py-2">
                              <span className="text-sm" style={{ color: 'var(--gray-500)' }}>
                                ... and {candidate.responsibilities_assignments.length - 5} more responsibilities
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Alternative Matches Preview */}
                    {candidate.skills_alternatives && candidate.skills_alternatives.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <Eye className="w-5 h-5" style={{ color: 'var(--purple-600)' }} />
                          <h4 className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                            Alternative Skill Matches
                          </h4>
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--purple-100)', color: 'var(--purple-700)' }}>
                            AI Insights
                          </span>
                        </div>
                        <div className="space-y-2">
                          {candidate.skills_alternatives.slice(0, 3).map((alternative, idx) => (
                            <div 
                              key={idx}
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--purple-50)', border: '1px solid var(--purple-200)' }}
                            >
                              <div className="text-sm" style={{ color: 'var(--purple-900)' }}>
                                <strong>Alternative options</strong> for required skill #{alternative.jd_index + 1}:
                              </div>
                              <div className="mt-2 space-y-1">
                                {alternative.items.slice(0, 2).map((item, itemIdx) => (
                                  <div key={itemIdx} className="flex justify-between items-center text-xs">
                                    <span style={{ color: 'var(--purple-800)' }}>
                                      {item.cv_item.length > 60 ? item.cv_item.substring(0, 60) + '...' : item.cv_item}
                                    </span>
                                    <span className="font-medium" style={{ color: 'var(--purple-600)' }}>
                                      {Math.round(item.score * 100)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary Statistics */}
                    <div 
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}
                    >
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold" style={{ color: 'var(--primary-600)' }}>
                            {candidate.skills_assignments ? 
                              candidate.skills_assignments.filter(a => a.score >= 0.7).length : 0}
                            /{candidate.skills_assignments ? candidate.skills_assignments.length : 0}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--gray-600)' }}>
                            Excellent Skills Matches
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: 'var(--green-600)' }}>
                            {candidate.responsibilities_assignments ? 
                              candidate.responsibilities_assignments.filter(a => a.score >= 0.7).length : 0}
                            /{candidate.responsibilities_assignments ? candidate.responsibilities_assignments.length : 0}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--gray-600)' }}>
                            Strong Experience Matches
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sortedCandidates.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--gray-400)' }} />
            <h3 className="heading-sm mb-2" style={{ color: 'var(--gray-700)' }}>
              No matches found
            </h3>
            <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
              Try adjusting your filter criteria to see more results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
