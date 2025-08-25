'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrophyIcon,
  StarIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  ChartBarIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { formatPercentage } from '@/lib/utils';
import { MatchResult, CandidateBreakdown, AssignmentItem, AlternativesItem } from '@/lib/api';

const GOOD_THRESHOLD = 0.50;

const ResultsPage = () => {
  const { 
    matchResults, 
    setCurrentTab, 
    matchResult, 
    matchWeights, 
    setMatchWeights, 
    runMatch, 
    isMatching, 
    matchError,
    currentJD,
    jobDescriptions 
  } = useAppStore();
  const [selectedCandidate, setSelectedCandidate] = useState<MatchResult | null>(null);
  const [selectedNewCandidate, setSelectedNewCandidate] = useState<CandidateBreakdown | null>(null);

  const exportSingleResult = (result: MatchResult) => {
    const csvContent = [
      'Candidate,Overall Score,Skills Score,Experience Score,Education Score,Title Score',
      `${result.cv_filename},${result.overall_score}%,${result.skills_score}%,${result.experience_score}%,${result.education_score}%,${result.title_score}%`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.cv_filename}_analysis_report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportAllResults = () => {
    const csvContent = [
      'Rank,Candidate,Overall Score,Skills Score,Experience Score,Education Score,Title Score',
      ...matchResults
        .sort((a, b) => b.overall_score - a.overall_score)
        .map((result, index) => 
          `${index + 1},${result.cv_filename},${result.overall_score}%,${result.skills_score}%,${result.experience_score}%,${result.education_score}%,${result.title_score}%`
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cv_analysis_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAnalyze = async () => {
    if (!currentJD && jobDescriptions.length === 0) {
      alert('Please upload a job description first');
      return;
    }
    
    const jdToUse = currentJD || jobDescriptions[0];
    await runMatch({ jd_id: jdToUse.id });
  };

  const getScoreColor = (score: number) => {
    if (score >= GOOD_THRESHOLD) return 'text-green-600 bg-green-50';
    return 'text-amber-600 bg-amber-50';
  };

  const renderAssignmentItem = (assignment: AssignmentItem) => (
    <div key={`${assignment.jd_index}-${assignment.cv_index}`} 
         className={`p-3 rounded-lg border ${getScoreColor(assignment.score)}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm">JD → CV Match</span>
        <Badge variant={assignment.score >= GOOD_THRESHOLD ? 'success' : 'warning'}>
          {(assignment.score * 100).toFixed(1)}%
        </Badge>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Required:</span> {assignment.jd_item}
        </div>
        <div>
          <span className="font-medium">Candidate:</span> {assignment.cv_item}
        </div>
      </div>
    </div>
  );

  const renderAlternatives = (alternatives: AlternativesItem, jdItems: string[]) => (
    <div key={alternatives.jd_index} className="p-3 bg-gray-50 rounded-lg">
      <div className="font-medium text-sm mb-2">
        Required: {jdItems[alternatives.jd_index]}
      </div>
      <div className="space-y-1">
        <span className="text-xs text-gray-600">Top alternatives:</span>
        {alternatives.items.slice(0, 3).map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span className="truncate">{item.cv_item}</span>
            <span className={item.score >= GOOD_THRESHOLD ? 'text-green-600' : 'text-amber-600'}>
              {(item.score * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  // Show new matching results if available
  if (matchResult && matchResult.candidates.length > 0) {
    return (
      <div className="space-y-6">
        {/* Header with weights and analyze button */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Matching Results</CardTitle>
                <CardDescription>
                  Job: {matchResult.jd_job_title} | Experience: {matchResult.jd_years} years
                </CardDescription>
              </div>
              <Button onClick={handleAnalyze} disabled={isMatching}>
                {isMatching ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weights Summary */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(matchResult.normalized_weights.skills * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Skills</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(matchResult.normalized_weights.responsibilities * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Responsibilities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(matchResult.normalized_weights.job_title * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Job Title</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {(matchResult.normalized_weights.experience * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Experience</div>
              </div>
            </div>
            
            {matchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800">{matchError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Candidates Ranking */}
        <Card>
          <CardHeader>
            <CardTitle>Candidate Rankings</CardTitle>
            <CardDescription>{matchResult.candidates.length} candidates analyzed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matchResult.candidates.map((candidate, index) => (
                <motion.div
                  key={candidate.cv_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedNewCandidate?.cv_id === candidate.cv_id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedNewCandidate(candidate)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{candidate.cv_name}</h3>
                      <p className="text-sm text-gray-600">
                        {candidate.cv_job_title} | {candidate.cv_years} years experience
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {(candidate.overall_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">#{index + 1}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {(candidate.skills_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Skills</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {(candidate.responsibilities_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Responsibilities</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-600">
                        {(candidate.job_title_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Title</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-orange-600">
                        {(candidate.years_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Experience</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Explainability Panel */}
        {selectedNewCandidate && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analysis: {selectedNewCandidate.cv_name}</CardTitle>
              <CardDescription>Explainable matching breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Skills Assignments */}
              {selectedNewCandidate.skills_assignments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <StarIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Skills Matches ({selectedNewCandidate.skills_assignments.length})
                  </h4>
                  <div className="grid gap-3">
                    {selectedNewCandidate.skills_assignments.map(renderAssignmentItem)}
                  </div>
                  
                  {/* Skills Alternatives */}
                  {selectedNewCandidate.skills_alternatives.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Alternative Skills Matches</h5>
                      <div className="grid gap-2">
                        {selectedNewCandidate.skills_alternatives.map(alt => 
                          renderAlternatives(alt, matchResult.candidates.find(c => c.cv_id === selectedNewCandidate.cv_id)?.skills_assignments.map(a => a.jd_item) || [])
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Responsibilities Assignments */}
              {selectedNewCandidate.responsibilities_assignments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <BriefcaseIcon className="h-5 w-5 mr-2 text-green-600" />
                    Responsibility Matches ({selectedNewCandidate.responsibilities_assignments.length})
                  </h4>
                  <div className="grid gap-3">
                    {selectedNewCandidate.responsibilities_assignments.map(renderAssignmentItem)}
                  </div>
                  
                  {/* Responsibilities Alternatives */}
                  {selectedNewCandidate.responsibilities_alternatives.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Alternative Responsibility Matches</h5>
                      <div className="grid gap-2">
                        {selectedNewCandidate.responsibilities_alternatives.map(alt => 
                          renderAlternatives(alt, matchResult.candidates.find(c => c.cv_id === selectedNewCandidate.cv_id)?.responsibilities_assignments.map(a => a.jd_item) || [])
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Show new matching results if available, otherwise fall back to old results
  if (!matchResult && matchResults.length === 0) {
    return (
      <div className="text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ChartBarIcon className="mx-auto h-16 w-16 text-secondary-400 mb-4" />
          <h2 className="text-2xl font-semibold text-secondary-900 mb-2">
            No Analysis Results
          </h2>
          <p className="text-secondary-600 mb-6">
            Upload documents and run analysis to see matching results here.
          </p>
          <Button onClick={handleAnalyze} disabled={isMatching}>
            {isMatching ? 'Analyzing...' : 'Start Analysis'}
          </Button>
        </motion.div>
      </div>
    );
  }

  const getScoreColorVariant = (score: number | undefined | null) => {
    if (score === undefined || score === null || isNaN(score)) return 'error';
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  const getScoreVariant = (score: number | undefined | null) => {
    if (score === undefined || score === null || isNaN(score)) return 'error';
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'warning';
    return 'error';
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <TrophyIcon className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <StarIcon className="h-5 w-5 text-gray-400" />;
      case 2:
        return <StarIcon className="h-5 w-5 text-yellow-600" />;
      default:
        return <div className="h-5 w-5 rounded-full bg-secondary-300 flex items-center justify-center text-xs font-bold text-secondary-600">{index + 1}</div>;
    }
  };

  // Show old matching results only if new matching system isn't available
  if (!matchResult && matchResults.length > 0) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-secondary-900 mb-4">
            Analysis Results (Legacy)
        </h1>
        <p className="text-lg text-secondary-600">
          {matchResults.length} candidates analyzed and ranked by AI matching
        </p>
      </motion.div>

      {/* Results Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Matching Summary</CardTitle>
            <CardDescription>
              Overall analysis statistics for this job posting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {matchResults.length}
                </div>
                <div className="text-sm text-secondary-600">Candidates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">
                  {formatPercentage(Math.max(...matchResults.map(r => r.overall_score)))}
                </div>
                <div className="text-sm text-secondary-600">Best Match</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning-600">
                  {formatPercentage(matchResults.reduce((acc, r) => acc + r.overall_score, 0) / matchResults.length)}
                </div>
                <div className="text-sm text-secondary-600">Average Match</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {matchResults.filter(r => r.overall_score >= 80).length}
                </div>
                <div className="text-sm text-secondary-600">Strong Matches</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Candidate Rankings */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-secondary-900">
          Candidate Rankings
        </h2>
        
        {matchResults
          .sort((a, b) => b.overall_score - a.overall_score)
          .map((result, index) => (
            <motion.div
              key={result.cv_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-medium transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Candidate Info */}
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex items-center space-x-2">
                        {getRankIcon(index)}
                        <span className="font-medium text-secondary-700">
                          #{index + 1}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-secondary-900 mb-1">
                          {result.cv_filename}
                        </h3>
                        <div className="flex items-center space-x-4">
                          <Badge 
                            variant={getScoreVariant(result.overall_score)}
                            size="lg"
                          >
                            {formatPercentage(result.overall_score)} Match
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Scores */}
                    <div className="grid grid-cols-4 gap-4 min-w-0 flex-1 mx-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DocumentTextIcon className="h-4 w-4 text-primary-600 mr-1" />
                          <span className="text-xs font-medium text-secondary-700">Skills</span>
                        </div>
                        <Progress 
                          value={result.skills_score || 0} 
                          variant={getScoreColorVariant((result.skills_score || 0) / 100)}
                          size="sm"
                        />
                        <span className="text-xs text-secondary-600 mt-1 block">
                          {formatPercentage(result.skills_score)}
                        </span>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <BriefcaseIcon className="h-4 w-4 text-primary-600 mr-1" />
                          <span className="text-xs font-medium text-secondary-700">Experience</span>
                        </div>
                        <Progress 
                          value={result.experience_score || 0} 
                          variant={getScoreColorVariant((result.experience_score || 0) / 100)}
                          size="sm"
                        />
                        <span className="text-xs text-secondary-600 mt-1 block">
                          {formatPercentage(result.experience_score)}
                        </span>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <AcademicCapIcon className="h-4 w-4 text-primary-600 mr-1" />
                          <span className="text-xs font-medium text-secondary-700">Education</span>
                        </div>
                        <Progress 
                          value={result.education_score || 0} 
                          variant={getScoreColorVariant((result.education_score || 0) / 100)}
                          size="sm"
                        />
                        <span className="text-xs text-secondary-600 mt-1 block">
                          {formatPercentage(result.education_score)}
                        </span>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <StarIcon className="h-4 w-4 text-primary-600 mr-1" />
                          <span className="text-xs font-medium text-secondary-700">Title</span>
                        </div>
                        <Progress 
                          value={result.title_score || 0} 
                          variant={getScoreColorVariant((result.title_score || 0) / 100)}
                          size="sm"
                        />
                        <span className="text-xs text-secondary-600 mt-1 block">
                          {formatPercentage(result.title_score)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<EyeIcon className="h-4 w-4" />}
                        onClick={() => setSelectedCandidate(result)}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
                        onClick={() => exportSingleResult(result)}
                      >
                        Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex justify-center space-x-4"
      >
        <Button
          variant="outline"
          onClick={() => setCurrentTab('upload')}
        >
          New Analysis
        </Button>
        <Button 
          variant="primary"
          onClick={() => exportAllResults()}
        >
          Export All Results
        </Button>
      </motion.div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCandidate(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Candidate Details: {selectedCandidate.cv_filename}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCandidate(null)}
                  >
                    ✕
                  </Button>
                </CardTitle>
                <CardDescription>
                  Detailed analysis breakdown and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overall Score */}
                <div className="text-center p-6 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg">
                  <div className="text-3xl font-bold text-primary-600 mb-2">
                    {formatPercentage(selectedCandidate.overall_score)}
                  </div>
                  <div className="text-sm text-primary-700">Overall Match Score</div>
                </div>

                {/* Detailed Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Skills Analysis</h4>
                    <Progress 
                      value={selectedCandidate.skills_score || 0} 
                      variant={getScoreColorVariant((selectedCandidate.skills_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Experience Match</h4>
                    <Progress 
                      value={selectedCandidate.experience_score || 0} 
                      variant={getScoreColorVariant((selectedCandidate.experience_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Education Level</h4>
                    <Progress 
                      value={selectedCandidate.education_score || 0} 
                      variant={getScoreColorVariant((selectedCandidate.education_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Title Relevance</h4>
                    <Progress 
                      value={selectedCandidate.title_score || 0} 
                      variant={getScoreColorVariant((selectedCandidate.title_score || 0) / 100)}
                      showValue
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setSelectedCandidate(null)}>
                    Close
                  </Button>
                  <Button 
                    variant="primary"
                    onClick={() => exportSingleResult(selectedCandidate)}
                  >
                    Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
    );
  }

  // If we reach here, there are no results at all
  return (
    <div className="text-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ChartBarIcon className="mx-auto h-16 w-16 text-secondary-400 mb-4" />
        <h2 className="text-2xl font-semibold text-secondary-900 mb-2">
          No Analysis Results
        </h2>
        <p className="text-secondary-600 mb-6">
          Upload documents and run analysis to see matching results here.
        </p>
        <Button onClick={handleAnalyze} disabled={isMatching}>
          {isMatching ? 'Analyzing...' : 'Start Analysis'}
        </Button>
      </motion.div>
    </div>
  );
};

export default ResultsPage;