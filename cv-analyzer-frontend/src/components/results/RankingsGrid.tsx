'use client';

import { useState, useEffect } from 'react';
import { Play, Settings, Trophy, TrendingUp, Users, Target, BarChart3, Zap, Filter, Download, Eye, ArrowUpDown, Award, Brain } from 'lucide-react';
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
  } = useAppStore();

  const [showWeights, setShowWeights] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateBreakdown | null>(null);
  const [sortBy, setSortBy] = useState<'overall' | 'skills' | 'responsibilities' | 'title' | 'experience'>('overall');
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);

  useEffect(() => {
    if (jds.length === 0) {
      loadJDs();
    }
  }, [jds.length, loadJDs]);

  const isMatching = loadingStates.matching.isLoading;
  const matchError = loadingStates.matching.error;

  const handleRunMatch = async () => {
    if (!selectedJD) {
      alert('Please select a job description first');
      return;
    }
    await runMatch();
  };

  const candidates = matchResult?.candidates || [];
  
  // Enhanced sorting and filtering
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

  // Advanced analytics calculations
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

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Brain className="h-6 w-6 text-primary-600" />
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
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWeights(!showWeights)}
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
          >
            <Zap className="h-4 w-4 mr-2" />
            {isMatching ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Processing Status */}
      {isMatching && (
        <Card className="border-primary-200 bg-primary-50/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <LoadingSpinner size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-primary-900">
                  Running AI Analysis...
                </h3>
                <p className="text-primary-700">
                  Processing candidates with Hungarian algorithm
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced JD Selection */}
      <Card variant="elevated">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-accent-100 rounded-lg">
              <Target className="h-5 w-5 text-accent-600" />
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
                className={`cursor-pointer transition-all duration-200 ${
                  selectedJD === jd.id 
                    ? 'ring-2 ring-primary-500 bg-primary-50 border-primary-200' 
                    : 'hover:shadow-md hover:border-neutral-300'
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
                      <Badge variant="default" className="bg-primary-600 text-white">
                        <Award className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <Badge variant="outline" className="text-xs bg-accent-50 text-accent-700 border-accent-200">
                      {jd.skills_count} skills
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-primary-50 text-primary-700 border-primary-200">
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
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{matchError}</p>
          </CardContent>
        </Card>
      )}

      {/* Premium Analytics Dashboard */}
      {matchResult && showAnalytics && (
        <Card variant="elevated" className="border-accent-200 bg-gradient-to-r from-accent-50 via-white to-primary-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-accent-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-accent-600" />
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
              <div className="text-center p-4 bg-white rounded-lg border border-neutral-200">
                <Users className="h-6 w-6 text-primary-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-neutral-900">{analytics.total}</p>
                <p className="text-sm text-neutral-500">Total Candidates</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-neutral-200">
                <Trophy className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-neutral-900">{formatPercentage(analytics.bestScore)}</p>
                <p className="text-sm text-neutral-500">Best Match</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-neutral-200">
                <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-neutral-900">{formatPercentage(analytics.avgScore)}</p>
                <p className="text-sm text-neutral-500">Average Score</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-neutral-200">
                <Award className="h-6 w-6 text-success-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-neutral-900">{analytics.qualifiedCandidates}</p>
                <p className="text-sm text-neutral-500">Qualified (≥70%)</p>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border border-neutral-200">
                <Eye className="h-6 w-6 text-warning-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-neutral-900">{analytics.marginallyCandidates}</p>
                <p className="text-sm text-neutral-500">Marginal (50-70%)</p>
              </div>
            </div>

            {/* Dimension Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900">Performance by Dimension</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                      <span className="font-medium">Skills</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-primary-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.skills * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.skills)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-accent-500 rounded-full"></div>
                      <span className="font-medium">Responsibilities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-accent-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.responsibilities * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.responsibilities)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                      <span className="font-medium">Job Title</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-success-500 rounded-full" 
                          style={{ width: `${analytics.averageByDimension.title * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{formatPercentage(analytics.averageByDimension.title)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-warning-500 rounded-full"></div>
                      <span className="font-medium">Experience</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="h-2 bg-warning-500 rounded-full" 
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
                  <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-success-800">Excellent (≥80%)</span>
                      <span className="text-success-700 font-bold">
                        {candidates.filter(c => c.overall_score >= 0.8).length}
                      </span>
                    </div>
                    <div className="w-full bg-success-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-success-500 rounded-full" 
                        style={{ width: `${(candidates.filter(c => c.overall_score >= 0.8).length / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-primary-800">Good (70-80%)</span>
                      <span className="text-primary-700 font-bold">
                        {candidates.filter(c => c.overall_score >= 0.7 && c.overall_score < 0.8).length}
                      </span>
                    </div>
                    <div className="w-full bg-primary-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-primary-500 rounded-full" 
                        style={{ width: `${(candidates.filter(c => c.overall_score >= 0.7 && c.overall_score < 0.8).length / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-warning-800">Fair (50-70%)</span>
                      <span className="text-warning-700 font-bold">
                        {analytics.marginallyCandidates}
                      </span>
                    </div>
                    <div className="w-full bg-warning-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-warning-500 rounded-full" 
                        style={{ width: `${(analytics.marginallyCandidates / analytics.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-error-50 border border-error-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-error-800">Poor (&lt;50%)</span>
                      <span className="text-error-700 font-bold">
                        {candidates.filter(c => c.overall_score < 0.5).length}
                      </span>
                    </div>
                    <div className="w-full bg-error-200 rounded-full h-2">
                      <div 
                        className="h-2 bg-error-500 rounded-full" 
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
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Settings className="h-5 w-5 text-primary-600" />
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
                      className="px-3 py-2 border border-neutral-200 rounded-lg bg-white text-sm"
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
                      className="w-20"
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
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                    <label className="text-sm font-medium text-primary-800">Skills Weight</label>
                  </div>
                  <p className="text-2xl font-bold text-primary-900">
                    {formatPercentage(matchResult.normalized_weights.skills / 100)}
                  </p>
                  <p className="text-xs text-primary-600 mt-1">Hungarian assignments</p>
                </div>
                <div className="p-4 bg-accent-50 border border-accent-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-accent-500 rounded-full"></div>
                    <label className="text-sm font-medium text-accent-800">Responsibilities</label>
                  </div>
                  <p className="text-2xl font-bold text-accent-900">
                    {formatPercentage(matchResult.normalized_weights.responsibilities / 100)}
                  </p>
                  <p className="text-xs text-accent-600 mt-1">Optimal matching</p>
                </div>
                <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                    <label className="text-sm font-medium text-success-800">Job Title</label>
                  </div>
                  <p className="text-2xl font-bold text-success-900">
                    {formatPercentage(matchResult.normalized_weights.job_title / 100)}
                  </p>
                  <p className="text-xs text-success-600 mt-1">Cosine similarity</p>
                </div>
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-warning-500 rounded-full"></div>
                    <label className="text-sm font-medium text-warning-800">Experience</label>
                  </div>
                  <p className="text-2xl font-bold text-warning-900">
                    {formatPercentage(matchResult.normalized_weights.experience / 100)}
                  </p>
                  <p className="text-xs text-warning-600 mt-1">Ratio calculation</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Candidate Rankings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 p-6">
                {sortedCandidates.map((candidate, index) => (
                  <Card
                    key={candidate.cv_id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedCandidate?.cv_id === candidate.cv_id 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : ''
                    }`}
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-muted-foreground">
                              #{index + 1}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium">{candidate.cv_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {candidate.cv_job_title} • {candidate.cv_years} years
                            </p>
                          </div>
                        </div>
                        
                                                  <div className="flex items-center gap-6">
                            {/* Component Scores with Progress Bars */}
                            <div className="grid grid-cols-4 gap-4 flex-1">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Skills</span>
                                  <Badge variant={getScoreBadgeVariant(candidate.skills_score)} className="text-xs">
                                    {formatPercentage(candidate.skills_score)}
                                  </Badge>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      candidate.skills_score >= 0.7 ? 'bg-green-500' :
                                      candidate.skills_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${candidate.skills_score * 100}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {candidate.skills_assignments.length} assignments
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Resp.</span>
                                  <Badge variant={getScoreBadgeVariant(candidate.responsibilities_score)} className="text-xs">
                                    {formatPercentage(candidate.responsibilities_score)}
                                  </Badge>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      candidate.responsibilities_score >= 0.7 ? 'bg-green-500' :
                                      candidate.responsibilities_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${candidate.responsibilities_score * 100}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {candidate.responsibilities_assignments.length} assignments
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Title</span>
                                  <Badge variant={getScoreBadgeVariant(candidate.job_title_score)} className="text-xs">
                                    {formatPercentage(candidate.job_title_score)}
                                  </Badge>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      candidate.job_title_score >= 0.7 ? 'bg-green-500' :
                                      candidate.job_title_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${candidate.job_title_score * 100}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  cosine similarity
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">Years</span>
                                  <Badge variant={getScoreBadgeVariant(candidate.years_score)} className="text-xs">
                                    {formatPercentage(candidate.years_score)}
                                  </Badge>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      candidate.years_score >= 0.7 ? 'bg-green-500' :
                                      candidate.years_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${candidate.years_score * 100}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {candidate.cv_years} years
                                </div>
                              </div>
                            </div>
                            
                            {/* Overall Score */}
                            <div className="text-center min-w-[100px]">
                              <div className="flex items-center justify-center mb-2">
                                <div className="relative w-16 h-16">
                                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                                    <path
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeDasharray={`${candidate.overall_score * 100}, 100`}
                                      className={
                                        candidate.overall_score >= 0.7 ? 'text-green-500' :
                                        candidate.overall_score >= 0.5 ? 'text-amber-500' : 'text-red-500'
                                      }
                                    />
                                    <path
                                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      className="text-muted"
                                      opacity="0.2"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold">
                                      {Math.round(candidate.overall_score * 100)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">Overall Score</p>
                            </div>
                          </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
    </div>
  );
}
