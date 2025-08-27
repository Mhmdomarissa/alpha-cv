'use client';

import { useState } from 'react';
import { RotateCcw, Info } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WeightsPanel() {
  const { matchWeights, setMatchWeights } = useAppStore();
  
  // Local state for slider values (we'll normalize when applying)
  const [localWeights, setLocalWeights] = useState(matchWeights);

  const handleWeightChange = (dimension: keyof typeof matchWeights, value: number) => {
    const newWeights = { ...localWeights, [dimension]: value };
    setLocalWeights(newWeights);
    setMatchWeights(newWeights);
  };

  const resetToDefaults = () => {
    const defaults = {
      skills: 80,
      responsibilities: 15,
      job_title: 2.5,
      experience: 2.5,
    };
    setLocalWeights(defaults);
    setMatchWeights(defaults);
  };

  const total = Object.values(localWeights).reduce((sum, val) => sum + val, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Matching Weights Configuration
            <Badge variant="secondary">{total.toFixed(1)}% total</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Weights will be automatically normalized before matching. Higher weights give more importance to that dimension.
          </AlertDescription>
        </Alert>

        {/* Weight Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Skills Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Skills Matching</label>
              <Badge variant="outline">{localWeights.skills}%</Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={localWeights.skills}
              onChange={(e) => handleWeightChange('skills', parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <p className="text-xs text-muted-foreground">
              How CV skills match JD required skills using Hungarian algorithm
            </p>
          </div>

          {/* Responsibilities Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Responsibilities Matching</label>
              <Badge variant="outline">{localWeights.responsibilities}%</Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={localWeights.responsibilities}
              onChange={(e) => handleWeightChange('responsibilities', parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <p className="text-xs text-muted-foreground">
              How CV responsibilities match JD required responsibilities
            </p>
          </div>

          {/* Job Title Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Job Title Similarity</label>
              <Badge variant="outline">{localWeights.job_title}%</Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={localWeights.job_title}
              onChange={(e) => handleWeightChange('job_title', parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <p className="text-xs text-muted-foreground">
              Cosine similarity between CV job title and JD job title
            </p>
          </div>

          {/* Experience Weight */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Experience Ratio</label>
              <Badge variant="outline">{localWeights.experience}%</Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={localWeights.experience}
              onChange={(e) => handleWeightChange('experience', parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <p className="text-xs text-muted-foreground">
              Ratio rule: min(1.0, CV_years / JD_required_years)
            </p>
          </div>
        </div>

        {/* Algorithm Explanation */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Algorithm Explanation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong>Hungarian Algorithm:</strong> Used for skills and responsibilities to find optimal 1:1 assignments between JD requirements and CV capabilities.
            </p>
            <p>
              <strong>Cosine Similarity:</strong> Used for job title and individual skill/responsibility comparisons using all-mpnet-base-v2 embeddings.
            </p>
            <p>
              <strong>Ratio Rule:</strong> Used for experience scoring to reward candidates who meet or exceed requirements.
            </p>
            <p>
              <strong>Final Score:</strong> Weighted average of all dimensions, normalized to sum to 1.0.
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
