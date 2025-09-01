'use client';

import React, { useState } from 'react';
import { 
  FileDown, 
  Users, 
  BarChart3, 
  Calendar, 
  Filter,
  TrendingUp,
  Target,
  Award,
  CheckCircle,
  AlertCircle,
  Download,
  Printer,
  Share2,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, StatsCard } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { LoadingSpinner, ProgressBar } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import { formatDate, formatPercentage, getScoreColor } from '@/lib/utils';

interface ReportConfig {
  type: 'detailed' | 'summary' | 'executive';
  includeCharts: boolean;
  includeAssignments: boolean;
  includeAlternatives: boolean;
  dateRange: 'all' | 'last_week' | 'last_month';
}

export default function ReportGenerator() {
  const { cvs, jds, matchResult, systemHealth } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<ReportConfig>({
    type: 'detailed',
    includeCharts: true,
    includeAssignments: true,
    includeAlternatives: false,
    dateRange: 'all'
  });

  const generatePDFReport = async () => {
    setIsGenerating(true);
    
    try {
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In a real implementation, this would generate and download a PDF
      const reportData = generateReportData();
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cv-matching-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateReportData = () => {
    const totalCandidates = cvs.length;
    const totalJobs = jds.length;
    const totalMatches = matchResult?.candidates.length || 0;
    
    const highQualityMatches = matchResult?.candidates?.filter(c => 
      c.overall_score >= 0.7
    ).length || 0;
    
    const averageScore = (matchResult?.candidates?.reduce((sum, c) => 
      sum + c.overall_score, 0
    ) || 0) / (totalMatches || 1);

    return {
      metadata: {
        generated_at: new Date().toISOString(),
        report_type: config.type,
        date_range: config.dateRange,
      },
      summary: {
        total_candidates: totalCandidates,
        total_jobs: totalJobs,
        total_matches: totalMatches,
        high_quality_matches: highQualityMatches,
        average_score: averageScore,
        system_health: systemHealth?.status || 'unknown',
      },
      detailed_results: config.type === 'detailed' ? {
        candidates: matchResult?.candidates || [],
        include_assignments: config.includeAssignments,
        include_alternatives: config.includeAlternatives,
      } : undefined,
      insights: {
        top_skills_demand: extractTopSkills(),
        best_matches: matchResult?.candidates?.slice(0, 5) || [],
        improvement_areas: generateInsights(),
      }
    };
  };

  const extractTopSkills = () => {
    if (!jds.length) return [];
    
    // Mock implementation - in real scenario, extract from JD data
    return [
      { skill: 'Python', demand: 85 },
      { skill: 'React', demand: 78 },
      { skill: 'Machine Learning', demand: 72 },
      { skill: 'AWS', demand: 65 },
      { skill: 'SQL', demand: 60 },
    ];
  };

  const generateInsights = () => {
    const insights = [];
    
    if (matchResult && matchResult.candidates && matchResult.candidates.length > 0) {
      const avgScore = matchResult.candidates.reduce((sum, c) => sum + c.overall_score, 0) / matchResult.candidates.length;
      
      if (avgScore < 0.5) {
        insights.push({
          type: 'warning',
          title: 'Low Average Match Score',
          description: 'Consider expanding search criteria or reviewing job requirements',
          impact: 'High'
        });
      }
      
      if (matchResult.candidates.filter(c => c.overall_score >= 0.8).length === 0) {
        insights.push({
          type: 'info',
          title: 'No Excellent Matches Found',
          description: 'Consider skills training programs or broader candidate sourcing',
          impact: 'Medium'
        });
      }
    }
    
    return insights;
  };

  const totalCandidates = cvs.length;
  const totalJobs = jds.length;
  const totalMatches = matchResult?.candidates.length || 0;
  const highQualityMatches = matchResult?.candidates?.filter(c => c.overall_score >= 0.7).length || 0;
  
  return (
    <div className="space-y-8">
      {/* Report Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-heading-1 font-bold text-neutral-900">Analytics & Reports</h2>
            <p className="text-neutral-600 mt-1">Generate comprehensive matching reports and insights</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" icon={<Share2 />}>
              Share
            </Button>
            <Button variant="outline" icon={<Mail />}>
              Email
            </Button>
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Candidates"
            value={totalCandidates.toString()}
            subtitle="CVs processed"
            icon={<Users />}
            trend={{
              value: 12,
              label: 'vs last period',
              positive: true,
            }}
          />
          
          <StatsCard
            title="Active Positions"
            value={totalJobs.toString()}
            subtitle="Job descriptions"
            icon={<Target />}
            trend={{
              value: 5,
              label: 'new this week',
              positive: true,
            }}
          />
          
          <StatsCard
            title="Successful Matches"
            value={totalMatches.toString()}
            subtitle="AI-powered matches"
            icon={<BarChart3 />}
          />
          
          <StatsCard
            title="Quality Rate"
            value={totalMatches > 0 ? formatPercentage(highQualityMatches / totalMatches) : '0%'}
            subtitle="High-quality matches"
            icon={<Award />}
            trend={{
              value: 8,
              label: 'improvement',
              positive: true,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Report Configuration */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary-600" />
                Report Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Report Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Report Type
                  </label>
                  <div className="space-y-2">
                    {(['summary', 'detailed', 'executive'] as const).map((type) => (
                      <label key={type} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="reportType"
                          value={type}
                          checked={config.type === type}
                          onChange={(e) => setConfig(prev => ({ ...prev, type: e.target.value as any }))}
                          className="text-primary-600"
                        />
                        <span className="text-sm capitalize">{type} Report</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Include Options */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Include in Report
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.includeCharts}
                        onChange={(e) => setConfig(prev => ({ ...prev, includeCharts: e.target.checked }))}
                        className="text-primary-600"
                      />
                      <span className="text-sm">Charts & Visualizations</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.includeAssignments}
                        onChange={(e) => setConfig(prev => ({ ...prev, includeAssignments: e.target.checked }))}
                        className="text-primary-600"
                      />
                      <span className="text-sm">Detailed Assignments</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.includeAlternatives}
                        onChange={(e) => setConfig(prev => ({ ...prev, includeAlternatives: e.target.checked }))}
                        className="text-primary-600"
                      />
                      <span className="text-sm">Alternative Matches</span>
                    </label>
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Date Range
                  </label>
                  <select
                    value={config.dateRange}
                    onChange={(e) => setConfig(prev => ({ ...prev, dateRange: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Time</option>
                    <option value="last_week">Last Week</option>
                    <option value="last_month">Last Month</option>
                  </select>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={generatePDFReport}
                  loading={isGenerating}
                  loadingText="Generating..."
                  className="w-full"
                  variant="primary"
                  icon={<FileDown />}
                >
                  Generate PDF Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Matching Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                Matching Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-neutral-900">Score Distribution</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Excellent (≥80%)</span>
                        <span>{matchResult?.candidates?.filter(c => c.overall_score >= 0.8).length || 0}</span>
                      </div>
                      <ProgressBar 
                        value={totalMatches > 0 ? (matchResult?.candidates?.filter(c => c.overall_score >= 0.8).length || 0) / totalMatches * 100 : 0} 
                        variant="success" 
                        size="sm" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good (60-79%)</span>
                        <span>{matchResult?.candidates?.filter(c => c.overall_score >= 0.6 && c.overall_score < 0.8).length || 0}</span>
                      </div>
                      <ProgressBar 
                        value={totalMatches > 0 ? (matchResult?.candidates?.filter(c => c.overall_score >= 0.6 && c.overall_score < 0.8).length || 0) / totalMatches * 100 : 0} 
                        variant="default" 
                        size="sm" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Fair (&lt;60%)</span>
                        <span>{matchResult?.candidates?.filter(c => c.overall_score < 0.6).length || 0}</span>
                      </div>
                      <ProgressBar 
                        value={totalMatches > 0 ? (matchResult?.candidates?.filter(c => c.overall_score < 0.6).length || 0) / totalMatches * 100 : 0} 
                        variant="error" 
                        size="sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-neutral-900">Top Skills in Demand</h4>
                  <div className="space-y-2">
                    {extractTopSkills().slice(0, 5).map((skill, index) => (
                      <div key={skill.skill} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                          <span className="text-sm">{skill.skill}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary-500 rounded-full transition-all duration-300"
                              style={{ width: `${skill.demand}%` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-600 w-8">{skill.demand}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights & Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary-600" />
                AI Insights & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generateInsights().length > 0 ? (
                  generateInsights().map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 bg-neutral-50 rounded-lg">
                      {insight.type === 'warning' ? (
                        <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-neutral-900">{insight.title}</h4>
                          <Badge 
                            variant="outline" 
                            className={
                              insight.impact === 'High' ? 'border-red-200 text-red-700' :
                              insight.impact === 'Medium' ? 'border-yellow-200 text-yellow-700' :
                              'border-green-200 text-green-700'
                            }
                          >
                            {insight.impact} Impact
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-600">{insight.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                    <p>No insights available yet</p>
                    <p className="text-sm">Upload CVs and JDs to generate AI-powered insights</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
