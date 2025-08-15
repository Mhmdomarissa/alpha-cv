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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { formatPercentage } from '@/lib/utils';
import { MatchResult } from '@/lib/api';

const ResultsPage = () => {
  const { matchResults, setCurrentTab } = useAppStore();
  const [selectedCandidate, setSelectedCandidate] = useState<MatchResult | null>(null);

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

  if (matchResults.length === 0) {
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
          <Button onClick={() => setCurrentTab('upload')}>
            Start Analysis
          </Button>
        </motion.div>
      </div>
    );
  }

  const getScoreColor = (score: number | undefined | null) => {
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
          Analysis Results
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
                          variant={getScoreColor((result.skills_score || 0) / 100)}
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
                          variant={getScoreColor((result.experience_score || 0) / 100)}
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
                          variant={getScoreColor((result.education_score || 0) / 100)}
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
                          variant={getScoreColor((result.title_score || 0) / 100)}
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
                      variant={getScoreColor((selectedCandidate.skills_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Experience Match</h4>
                    <Progress 
                      value={selectedCandidate.experience_score || 0} 
                      variant={getScoreColor((selectedCandidate.experience_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Education Level</h4>
                    <Progress 
                      value={selectedCandidate.education_score || 0} 
                      variant={getScoreColor((selectedCandidate.education_score || 0) / 100)}
                      showValue
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-secondary-900">Title Relevance</h4>
                    <Progress 
                      value={selectedCandidate.title_score || 0} 
                      variant={getScoreColor((selectedCandidate.title_score || 0) / 100)}
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
};

export default ResultsPage;