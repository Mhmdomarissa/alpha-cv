'use client';

import { X, Target, ArrowRight, Award, TrendingUp, Zap, Users, Crown, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  formatPercentage, 
  getScoreBadgeVariant, 
  getMatchQualityColor, 
  getMatchQualityLabel
} from '@/lib/utils';
import { CandidateBreakdown, AssignmentItem, AlternativesItem } from '@/lib/types';
import { useAppStore } from '@/stores/appStore';

interface CandidateDetailProps {
  candidate: CandidateBreakdown;
  onClose: () => void;
}

export default function CandidateDetail({ candidate, onClose }: CandidateDetailProps) {
  const { matchResult } = useAppStore();
  
  const getScoreColor = (score: number) => {
    if (score >= 0.5) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  // Get normalized weights from match result
  const weights = matchResult?.normalized_weights || {
    skills: 80,
    responsibilities: 15,
    job_title: 2.5,
    experience: 2.5
  };

  // Convert weights to 0-1 scale
  const normalizedWeights = {
    skills: weights.skills / 100,
    responsibilities: weights.responsibilities / 100,
    job_title: weights.job_title / 100,
    experience: weights.experience / 100
  };

  const renderAssignments = (assignments: AssignmentItem[], title: string) => {
    const avgScore = assignments.length > 0 
      ? assignments.reduce((sum, a) => sum + a.score, 0) / assignments.length 
      : 0;
    
    const excellentCount = assignments.filter(a => a.score >= 0.8).length;
    const goodCount = assignments.filter(a => a.score >= 0.6 && a.score < 0.8).length;
    const fairCount = assignments.filter(a => a.score >= 0.4 && a.score < 0.6).length;
    const poorCount = assignments.filter(a => a.score < 0.4).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            {title} Assignments ({assignments.length})
          </h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Avg:</span>
            <Badge variant={getScoreBadgeVariant(avgScore)}>
              {formatPercentage(avgScore)}
            </Badge>
          </div>
        </div>

        {/* Assignment Quality Summary */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">{excellentCount}</div>
                <div className="text-xs text-muted-foreground">Excellent (80%+)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">{goodCount}</div>
                <div className="text-xs text-muted-foreground">Good (60-79%)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600">{fairCount}</div>
                <div className="text-xs text-muted-foreground">Fair (40-59%)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">{poorCount}</div>
                <div className="text-xs text-muted-foreground">Poor (&lt;40%)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Individual Assignments */}
        <div className="space-y-3">
          {assignments.map((assignment, index) => (
            <Card key={index} className={`border ${getMatchQualityColor(assignment.score)}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getScoreBadgeVariant(assignment.score)} className="font-medium">
                      {formatPercentage(assignment.score)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getMatchQualityLabel(assignment.score)}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    JD[{assignment.jd_index}] → CV[{assignment.cv_index}]
                  </span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <label className="font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      JD Requirement:
                    </label>
                    <p className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-900">
                      {assignment.jd_item}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium text-muted-foreground flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      CV Match:
                    </label>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      <p className="p-2 bg-green-50 border border-green-200 rounded text-green-900 flex-1">
                        {assignment.cv_item}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Similarity Explanation */}
                <div className="mt-3 pt-3 border-t border-muted">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Hungarian Algorithm Assignment</span>
                    <span>Cosine Similarity: {(assignment.score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderAlternatives = (alternatives: AlternativesItem[], title: string) => (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        <Award className="h-4 w-4" />
        {title} Alternatives (Top 3 per requirement)
      </h4>
      <div className="space-y-4">
        {alternatives.map((alt, jdIndex) => (
          <Card key={jdIndex}>
            <CardContent className="p-4">
              <div className="mb-3">
                <label className="text-sm font-medium text-muted-foreground">
                  JD Requirement [{alt.jd_index}]:
                </label>
                <p className="text-sm mt-1">
                  {/* We'd need the JD item text here, which isn't provided in the alternatives */}
                  Requirement {alt.jd_index}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Alternative Matches:
                </label>
                {alt.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{item.cv_item}</span>
                    <Badge variant={getScoreBadgeVariant(item.score)}>
                      {formatPercentage(item.score)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              {candidate.cv_name} - Detailed Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {candidate.cv_job_title} • {candidate.cv_years} years experience
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="weights">Score Breakdown</TabsTrigger>
              <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
              <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
              <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Score Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold mb-2">
                      {formatPercentage(candidate.overall_score)}
                    </div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold mb-2">
                      {formatPercentage(candidate.skills_score)}
                    </div>
                    <p className="text-sm text-muted-foreground">Skills Match</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold mb-2">
                      {formatPercentage(candidate.responsibilities_score)}
                    </div>
                    <p className="text-sm text-muted-foreground">Responsibilities</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold mb-2">
                      {formatPercentage(candidate.job_title_score)}
                    </div>
                    <p className="text-sm text-muted-foreground">Title Similarity</p>
                  </CardContent>
                </Card>
              </div>

              {/* Candidate Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Candidate Profile</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="font-medium">{candidate.cv_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Role</label>
                    <p className="font-medium">{candidate.cv_job_title || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Experience</label>
                    <p className="font-medium">{candidate.cv_years} years</p>
                  </div>
                </CardContent>
              </Card>

              {/* Assignment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Skills Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {candidate.skills_assignments.length} skill assignments made
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills_assignments.slice(0, 5).map((assignment, index) => (
                          <Badge key={index} variant={assignment.score >= 0.5 ? 'success' : 'warning'}>
                            {formatPercentage(assignment.score)}
                          </Badge>
                        ))}
                        {candidate.skills_assignments.length > 5 && (
                          <Badge variant="secondary">
                            +{candidate.skills_assignments.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Responsibility Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {candidate.responsibilities_assignments.length} responsibility assignments made
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.responsibilities_assignments.slice(0, 5).map((assignment, index) => (
                          <Badge key={index} variant={assignment.score >= 0.5 ? 'success' : 'warning'}>
                            {formatPercentage(assignment.score)}
                          </Badge>
                        ))}
                        {candidate.responsibilities_assignments.length > 5 && (
                          <Badge variant="secondary">
                            +{candidate.responsibilities_assignments.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Score Breakdown Tab */}
            <TabsContent value="weights" className="space-y-6 mt-6">
              {/* Weighted Score Calculation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-blue-500" />
                    Weighted Score Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Skills Component */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            Skills Component
                          </h4>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage(normalizedWeights.skills)} weight
                          </Badge>
                        </div>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Raw Score:</span>
                              <span className="font-medium">{formatPercentage(candidate.skills_score)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Weight:</span>
                              <span className="font-medium">{formatPercentage(normalizedWeights.skills)}</span>
                            </div>
                            <div className="border-t border-blue-300 pt-2 flex justify-between font-bold">
                              <span>Contribution:</span>
                              <span>{formatPercentage(candidate.skills_score * normalizedWeights.skills)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Responsibilities Component */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-green-500" />
                            Responsibilities Component
                          </h4>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage(normalizedWeights.responsibilities)} weight
                          </Badge>
                        </div>
                        <div className="p-4 bg-green-50 border border-green-200 rounded">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Raw Score:</span>
                              <span className="font-medium">{formatPercentage(candidate.responsibilities_score)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Weight:</span>
                              <span className="font-medium">{formatPercentage(normalizedWeights.responsibilities)}</span>
                            </div>
                            <div className="border-t border-green-300 pt-2 flex justify-between font-bold">
                              <span>Contribution:</span>
                              <span>{formatPercentage(candidate.responsibilities_score * normalizedWeights.responsibilities)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Job Title Component */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Crown className="h-4 w-4 text-purple-500" />
                            Job Title Component
                          </h4>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage(normalizedWeights.job_title)} weight
                          </Badge>
                        </div>
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Raw Score:</span>
                              <span className="font-medium">{formatPercentage(candidate.job_title_score)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Weight:</span>
                              <span className="font-medium">{formatPercentage(normalizedWeights.job_title)}</span>
                            </div>
                            <div className="border-t border-purple-300 pt-2 flex justify-between font-bold">
                              <span>Contribution:</span>
                              <span>{formatPercentage(candidate.job_title_score * normalizedWeights.job_title)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Experience Component */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                            Experience Component
                          </h4>
                          <Badge variant="outline" className="font-mono">
                            {formatPercentage(normalizedWeights.experience)} weight
                          </Badge>
                        </div>
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Raw Score:</span>
                              <span className="font-medium">{formatPercentage(candidate.years_score)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Weight:</span>
                              <span className="font-medium">{formatPercentage(normalizedWeights.experience)}</span>
                            </div>
                            <div className="border-t border-amber-300 pt-2 flex justify-between font-bold">
                              <span>Contribution:</span>
                              <span>{formatPercentage(candidate.years_score * normalizedWeights.experience)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Final Calculation */}
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
                      <CardContent className="p-6">
                        <div className="text-center">
                          <h3 className="text-lg font-bold mb-4">Final Score Calculation</h3>
                          <div className="space-y-2 text-sm font-mono">
                            <div>
                              {formatPercentage(candidate.skills_score)} × {formatPercentage(normalizedWeights.skills)} + 
                              {formatPercentage(candidate.responsibilities_score)} × {formatPercentage(normalizedWeights.responsibilities)} +
                            </div>
                            <div>
                              {formatPercentage(candidate.job_title_score)} × {formatPercentage(normalizedWeights.job_title)} + 
                              {formatPercentage(candidate.years_score)} × {formatPercentage(normalizedWeights.experience)}
                            </div>
                            <div className="text-2xl font-bold text-blue-600 mt-4 pt-4 border-t border-blue-300">
                              = {formatPercentage(candidate.overall_score)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Hungarian Algorithm Explanation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Hungarian Algorithm Explanation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <p className="text-muted-foreground">
                      The Hungarian algorithm ensures optimal 1-to-1 assignments between JD requirements and CV items, 
                      maximizing the total similarity score across all matches.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded">
                        <h4 className="font-medium mb-2">Skills Matching</h4>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>• Each JD skill is assigned to exactly one CV skill</li>
                          <li>• Uses cosine similarity between embeddings</li>
                          <li>• Optimizes total similarity across all assignments</li>
                          <li>• {candidate.skills_assignments.length} assignments made</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                        <h4 className="font-medium mb-2">Responsibilities Matching</h4>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>• Each JD responsibility is assigned to exactly one CV responsibility</li>
                          <li>• Uses cosine similarity between embeddings</li>
                          <li>• Ensures no CV responsibility is assigned multiple times</li>
                          <li>• {candidate.responsibilities_assignments.length} assignments made</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills Analysis Tab */}
            <TabsContent value="skills" className="space-y-6 mt-6">
              {renderAssignments(candidate.skills_assignments, 'Skills')}
            </TabsContent>

            {/* Responsibilities Tab */}
            <TabsContent value="responsibilities" className="space-y-6 mt-6">
              {renderAssignments(candidate.responsibilities_assignments, 'Responsibilities')}
            </TabsContent>

            {/* Alternatives Tab */}
            <TabsContent value="alternatives" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  {renderAlternatives(candidate.skills_alternatives, 'Skills')}
                </div>
                <div>
                  {renderAlternatives(candidate.responsibilities_alternatives, 'Responsibilities')}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
