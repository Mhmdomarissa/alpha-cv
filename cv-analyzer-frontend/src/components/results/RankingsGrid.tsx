// components/results/RankingsGrid.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { 
  Play, Settings, Trophy, TrendingUp, Users, Target, BarChart3, Zap, Filter, Download, Eye, ArrowUpDown, Award, Brain, Star, CheckCircle, Lightbulb
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import WeightsPanel from './WeightsPanel';
import CandidateDetail from './CandidateDetail';
import { formatPercentage, getScoreBadgeVariant, getMatchQualityColor, getMatchQualityLabel } from '@/lib/utils';
import { CandidateBreakdown } from '@/lib/types';

export default function RankingsGrid() {
  const {
    jds,
    selectedJD,
    selectJD,
    matchResult,
    runMatch,
    loadingStates,
    loadJDs,
    cvs,
    selectedCVs,
    selectAllCVs
  } = useAppStore();
  
  const [showWeights, setShowWeights] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateBreakdown | null>(null);
  const [sortBy, setSortBy] = useState<'overall' | 'skills' | 'responsibilities' | 'title' | 'experience'>('overall');
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (jds.length === 0) {
      loadJDs();
    }
  }, [jds.length, loadJDs]);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  const isMatching = loadingStates.matching.isLoading;
  const matchError = loadingStates.matching.error;
  
  const handleRunMatch = async () => {
    if (!selectedJD) {
      alert('Please select a job description first');
      return;
    }
    
    if (selectedCVs.length === 0) {
      selectAllCVs();
    }
    
    await runMatch();
  };
  
  const candidates = matchResult?.candidates || [];
  
  const getSortedCandidates = () => {
    let filtered = candidates.filter(c => c.overall_score >= filterThreshold / 100);
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'skills': return b.skills_score - a.skills_score;
        case 'responsibilities': return b.responsibilities_score - a.responsibilities_score;
        case 'title': return b.job_title_score - a.job_title_score;
        case 'experience': return b.years_score - a.years_score;
        default: return b.overall_score - a.overall_score;
      }
    });
  };
  
  const sortedCandidates = getSortedCandidates();
  
  const analytics = {
    total: candidates.length,
    filtered: sortedCandidates.length,
    avgScore: candidates.length > 0 ? candidates.reduce((sum, c) => sum + c.overall_score, 0) / candidates.length : 0,
    bestScore: candidates.length > 0 ? Math.max(...candidates.map(c => c.overall_score)) : 0,
    worstScore: candidates.length > 0 ? Math.min(...candidates.map(c => c.overall_score)) : 0,
    scoreStdDev: candidates.length > 1 ? Math.sqrt(candidates.reduce((sum, c) => sum + Math.pow(c.overall_score - (candidates.reduce((s, cv) => s + cv.overall_score, 0) / candidates.length), 2), 0) / candidates.length) : 0,
    qualifiedCandidates: candidates.filter(c => c.overall_score >= 0.7).length,
    marginallyCandidates: candidates.filter(c => c.overall_score >= 0.5 && c.overall_score < 0.7).length,
    averageByDimension: {
      skills: candidates.length > 0 ? candidates.reduce((sum, c) => sum + c.skills_score, 0) / candidates.length : 0,
      responsibilities: candidates.length > 0 ? candidates.reduce((sum, c) => sum + c.responsibilities_score, 0) / candidates.length : 0,
      title: candidates.length > 0 ? candidates.reduce((sum, c) => sum + c.job_title_score, 0) / candidates.length : 0,
      experience: candidates.length > 0 ? candidates.reduce((sum, c) => sum + c.years_score, 0) / candidates.length : 0,
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'from-emerald-500 to-teal-500';
    if (score >= 0.6) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-pink-500';
  };
  
  const getScoreBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.6) return 'bg-amber-500';
    return 'bg-rose-500';
  };
  
  const getScoreBadge = (score: number) => {
    if (score >= 0.8) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (score >= 0.6) return { label: 'Good', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Needs Review', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  };
  
  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">AI Matching Results</h2>
              <p className="text-neutral-500">
                Hungarian algorithm with explainable insights
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="transition-all duration-300 hover:shadow-md"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWeights(!showWeights)}
            className="transition-all duration-300 hover:shadow-md"
          >
            <Settings className="h-4 w-4 mr-2" />
            Weights
          </Button>
          <Button
            onClick={handleRunMatch}
            disabled={!selectedJD || isMatching}
            variant="primary"
            size="md"
            loading={isMatching}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isMatching ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </div>
      
      {/* Processing Status */}
      {isMatching && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <LoadingSpinner size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-indigo-900">
                  Running AI Analysis...
                </h3>
                <p className="text-indigo-700">
                  Processing candidates with Hungarian algorithm
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Enhanced JD Selection */}
      <Card variant="elevated" className="shadow-lg border-indigo-100">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-md">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Job Description Selection</h3>
              <p className="text-sm text-neutral-500 font-normal">Choose a position to analyze against</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jds.map((jd) => (
              <Card
                key={jd.id}
                className={`cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${
                  selectedJD === jd.id 
                    ? 'ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-md' 
                    : 'hover:border-indigo-300'
                }`}
                onClick={() => selectJD(jd.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-neutral-900 mb-1">{jd.job_title}</h4>
                      <p className="text-sm text-neutral-500">
                        {jd.years_of_experience} years required
                      </p>
                    </div>
                    {selectedJD === jd.id && (
                      <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md">
                        <Award className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">
                      {jd.skills_count} skills
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                      {jd.responsibilities_count} resp.
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-neutral-400">
                    {jd.filename}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {jds.length === 0 && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No job descriptions available</p>
              <p className="text-sm text-neutral-400">Upload some JDs first to start matching</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Weights Panel */}
      {showWeights && <WeightsPanel />}
      
      {/* Error Display */}
      {matchError && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4">
            <p className="text-rose-700">{matchError}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Premium Analytics Dashboard */}
      {matchResult && showAnalytics && (
        <Card variant="elevated" className="shadow-xl border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-md">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Matching Analytics</h3>
                <p className="text-sm text-neutral-500 font-normal">Comprehensive performance insights</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-white rounded-xl border border-indigo-100 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{analytics.total}</p>
                <p className="text-sm text-neutral-500">Total Candidates</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-xl border border-amber-100 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{formatPercentage(analytics.bestScore)}</p>
                <p className="text-sm text-neutral-500">Best Match</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-xl border border-emerald-100 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{formatPercentage(analytics.avgScore)}</p>
                <p className="text-sm text-neutral-500">Average Score</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-xl border border-green-100 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{analytics.qualifiedCandidates}</p>
                <p className="text-sm text-neutral-500">Qualified (≥70%)</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-xl border border-blue-100 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{analytics.marginallyCandidates}</p>
                <p className="text-sm text-neutral-500">Marginal (50-70%)</p>
              </div>
            </div>
            
            {/* Dimension Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900">Performance by Dimension</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-100 shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                      <span className="font-medium">Skills</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.skills * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.skills)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-cyan-100 shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                      <span className="font-medium">Responsibilities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.responsibilities * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.responsibilities)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100 shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                      <span className="font-medium">Job Title</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.title * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.title)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100 shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"></div>
                      <span className="font-medium">Experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.experience * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.experience)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900">Quality Distribution</h4>
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-emerald-800">Excellent (≥80%)</span>
                      <span className="text-emerald-700 font-bold">
                        {candidates.filter(c => c.overall_score >= 0.8).length}
                      </span>
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" 
                        style={{ width: `${(candidates.filter(c => c.overall_score >= 0.8).length / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-indigo-800">Good (70-80%)</span>
                      <span className="text-indigo-700 font-bold">
                        {candidates.filter(c => c.overall_score >= 0.7 && c.overall_score < 0.8).length}
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                        style={{ width: `${(candidates.filter(c => c.overall_score >= 0.7 && c.overall_score < 0.8).length / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-amber-800">Fair (50-70%)</span>
                      <span className="text-amber-700 font-bold">
                        {analytics.marginallyCandidates}
                      </span>
                    </div>
                    <div className="w-full bg-amber-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" 
                        style={{ width: `${(analytics.marginallyCandidates / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-rose-800">Poor (&lt;50%)</span>
                      <span className="text-rose-700 font-bold">
                        {candidates.filter(c => c.overall_score < 0.5).length}
                      </span>
                    </div>
                    <div className="w-full bg-rose-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full" 
                        style={{ width: `${(candidates.filter(c => c.overall_score < 0.5).length / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Results Section */}
      {matchResult && (
        <>
          {/* Enhanced Weights & Controls */}
          <Card variant="elevated" className="shadow-lg border-indigo-100">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-md">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Algorithm Configuration</h3>
                    <p className="text-sm text-neutral-500 font-normal">Active weights and controls</p>
                  </div>
                </CardTitle>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-neutral-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-neutral-200 rounded-lg bg-white text-sm shadow-sm transition-all duration-300 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="overall">Sort by Overall</option>
                      <option value="skills">Sort by Skills</option>
                      <option value="responsibilities">Sort by Responsibilities</option>
                      <option value="title">Sort by Job Title</option>
                      <option value="experience">Sort by Experience</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Filter ≥</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filterThreshold}
                      onChange={(e) => setFilterThreshold(parseInt(e.target.value))}
                      className="w-20 accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-neutral-700 min-w-[40px]">
                      {filterThreshold}%
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                    <label className="text-sm font-medium text-indigo-800">Skills Weight</label>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">
                    {formatPercentage(matchResult.normalized_weights.skills / 100)}
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">Hungarian assignments</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                    <label className="text-sm font-medium text-cyan-800">Responsibilities</label>
                  </div>
                  <p className="text-2xl font-bold text-cyan-900">
                    {formatPercentage(matchResult.normalized_weights.responsibilities / 100)}
                  </p>
                  <p className="text-xs text-cyan-600 mt-1">Optimal matching</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"></div>
                    <label className="text-sm font-medium text-emerald-800">Job Title</label>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatPercentage(matchResult.normalized_weights.job_title / 100)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Cosine similarity</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"></div>
                    <label className="text-sm font-medium text-amber-800">Experience</label>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatPercentage(matchResult.normalized_weights.experience / 100)}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Ratio calculation</p>
                </div>
              </div>
              
              {sortedCandidates.length !== analytics.total && (
                <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Filter className="h-4 w-4" />
                    <span>
                      Showing {sortedCandidates.length} of {analytics.total} candidates 
                      {filterThreshold > 0 && ` (≥${filterThreshold}% score)`}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Rankings Grid */}
          <Card className="shadow-lg border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-md">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Ranked Candidates</h3>
                  <p className="text-sm text-neutral-500 font-normal">
                    {sortedCandidates.length} candidate{sortedCandidates.length !== 1 ? 's' : ''} sorted by {sortBy === 'overall' ? 'overall match' : sortBy}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4 p-6">
                {sortedCandidates.map((candidate, index) => {
                  const badge = getScoreBadge(candidate.overall_score);
                  const isHovered = hoveredCard === candidate.cv_id;
                  
                  return (
                    <div
                      key={candidate.cv_id}
                      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 transform hover:-translate-y-1 hover:shadow-xl cursor-pointer ${
                        selectedCandidate?.cv_id === candidate.cv_id 
                          ? 'ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200' 
                          : 'bg-white border-neutral-200 hover:border-indigo-300'
                      }`}
                      onClick={() => setSelectedCandidate(candidate)}
                      onMouseEnter={() => setHoveredCard(candidate.cv_id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        animation: isVisible ? `fadeInUp 0.6s ease-out ${index * 0.1}s forwards` : 'none',
                        opacity: 0
                      }}
                    >
                      {/* Animated background effect */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${getScoreColor(candidate.overall_score)} opacity-0 ${isHovered ? 'opacity-10' : ''} transition-opacity duration-500`}></div>
                      
                      <div className="relative z-10 p-6">
                        {/* Match Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <div 
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-lg transition-all duration-500 ${getScoreBgColor(candidate.overall_score)}`}
                                >
                                  #{index + 1}
                                </div>
                                {index === 0 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                                    <Star className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-xl text-neutral-900 mb-1">
                                  {candidate.cv_name || 'Unknown Candidate'}
                                </h4>
                                <p className="text-base text-neutral-600">
                                  {candidate.cv_job_title || 'No title'} • {candidate.cv_years} years experience
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-6">
                            {/* Overall Score with Circular Progress */}
                            <div className="text-center">
                              <div className="relative w-20 h-20 mx-auto mb-2">
                                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                                  <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeDasharray={`${candidate.overall_score * 100}, 100`}
                                    className={`transition-all duration-1000 ${getScoreBgColor(candidate.overall_score)}`}
                                    strokeLinecap="round"
                                  />
                                  <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    className="text-neutral-200"
                                    opacity="0.3"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-lg font-bold text-neutral-900">
                                    {Math.round(candidate.overall_score * 100)}%
                                  </span>
                                </div>
                              </div>
                              <div 
                                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 ${badge.color}`}
                              >
                                {badge.label}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Quick Score Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="text-center p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-indigo-500 to-purple-500"
                                style={{ 
                                  width: `${(candidate.skills_score || 0) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="text-sm font-medium text-indigo-800">
                              Skills: {Math.round((candidate.skills_score || 0) * 100)}%
                            </p>
                          </div>
                          <div className="text-center p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-cyan-500 to-blue-500"
                                style={{ 
                                  width: `${(candidate.responsibilities_score || 0) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="text-sm font-medium text-cyan-800">
                              Experience: {Math.round((candidate.responsibilities_score || 0) * 100)}%
                            </p>
                          </div>
                          <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-500 to-teal-500"
                                style={{ 
                                  width: `${(candidate.job_title_score || 0) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="text-sm font-medium text-emerald-800">
                              Title: {Math.round((candidate.job_title_score || 0) * 100)}%
                            </p>
                          </div>
                          <div className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-amber-500 to-orange-500"
                                style={{ 
                                  width: `${(candidate.years_score || 0) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="text-sm font-medium text-amber-800">
                              Years: {Math.round((candidate.years_score || 0) * 100)}%
                            </p>
                          </div>
                        </div>
                        
                        {/* Why This Match Works */}
                        <div 
                          className="p-4 rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md"
                          style={{ 
                            background: candidate.overall_score >= 0.8 
                              ? 'linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))' 
                              : candidate.overall_score >= 0.6 
                                ? 'linear-gradient(to right, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))' 
                                : 'linear-gradient(to right, rgba(244, 63, 94, 0.1), rgba(236, 72, 153, 0.1))',
                            borderColor: candidate.overall_score >= 0.8 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : candidate.overall_score >= 0.6 
                                ? 'rgba(245, 158, 11, 0.3)' 
                                : 'rgba(244, 63, 94, 0.3)'
                          }}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <Lightbulb className="w-5 h-5" style={{ 
                              color: candidate.overall_score >= 0.8 
                                ? 'rgb(5, 150, 105)' 
                                : candidate.overall_score >= 0.6 
                                  ? 'rgb(217, 119, 6)' 
                                  : 'rgb(236, 72, 153)'
                            }} />
                            <span className="font-medium text-sm" style={{ 
                              color: candidate.overall_score >= 0.8 
                                ? 'rgb(5, 150, 105)' 
                                : candidate.overall_score >= 0.6 
                                  ? 'rgb(217, 119, 6)' 
                                  : 'rgb(236, 72, 153)'
                            }}>
                              Why This Match Works:
                            </span>
                          </div>
                          <div className="text-sm" style={{ 
                            color: candidate.overall_score >= 0.8 
                              ? 'rgb(5, 150, 105)' 
                              : candidate.overall_score >= 0.6 
                                ? 'rgb(217, 119, 6)' 
                                : 'rgb(236, 72, 153)'
                          }}>
                            {candidate.overall_score >= 0.8 && "• Strong alignment across all key areas"}
                            {candidate.overall_score >= 0.6 && candidate.overall_score < 0.8 && "• Good fit with some areas for development"}
                            {candidate.overall_score < 0.6 && "• Potential candidate requiring further evaluation"}
                            {(candidate.skills_score || 0) >= 0.8 && " • Excellent technical skills match"}
                            {(candidate.years_score || 0) >= 0.8 && " • Experience level aligns perfectly"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetail
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
      
      {/* Custom Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}