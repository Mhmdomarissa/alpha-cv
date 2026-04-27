// components/results/WeightsPanel.tsx
'use client';
import { useState, useEffect } from 'react';
import { RotateCcw, Info, Sliders } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WeightsPanel() {
  const { matchWeights, setMatchWeights } = useAppStore();
  
  // Default weights
  const defaultWeights = {
    skills: 80,
    responsibilities: 15,
    job_title: 2.5,
    experience: 2.5,
  };
  
  // Local state for slider values
  const [localWeights, setLocalWeights] = useState(defaultWeights);
  const [normalizedWeights, setNormalizedWeights] = useState(defaultWeights);
  
  // Update local weights when matchWeights change
  useEffect(() => {
    if (matchWeights) {
      setLocalWeights(matchWeights);
    }
  }, [matchWeights]);
  
  // Normalize weights to ensure they total 100%
  const normalizeWeights = (weights: typeof defaultWeights) => {
    const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
    if (total <= 0) return defaultWeights;
    
    // Calculate the normalized weights
    const normalized = { ...weights };
    const keys = Object.keys(weights) as (keyof typeof weights)[];
    
    // If total is not 100, adjust proportionally
    if (total !== 100) {
      keys.forEach(key => {
        normalized[key] = (weights[key] / total) * 100;
      });
    }
    
    return normalized;
  };
  
  // Update normalized weights when local weights change
  useEffect(() => {
    const normalized = normalizeWeights(localWeights);
    setNormalizedWeights(normalized);
  }, [localWeights]);
  
  const handleWeightChange = (dimension: keyof typeof localWeights, value: number) => {
    const newWeights = { ...localWeights, [dimension]: value };
    setLocalWeights(newWeights);
    setMatchWeights(newWeights);
  };
  
  const resetToDefaults = () => {
    setLocalWeights(defaultWeights);
    setMatchWeights(defaultWeights);
  };
  
  const total = Object.values(localWeights).reduce((sum, val) => sum + val, 0);
  
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-neutral-900" />
            Matching Weights Configuration
            <Badge variant="secondary" className="ml-2 bg-neutral-100 text-neutral-900 border-neutral-200">
              {total.toFixed(1)}% total
            </Badge>
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
          <div className="space-y-3 p-4 bg-white rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-900">Skills Matching</label>
              <Badge variant="outline" className="bg-neutral-900 text-white border-neutral-900">
                {localWeights.skills}%
              </Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"  // Step of 5 for skills
              value={localWeights.skills}
              onChange={(e) => handleWeightChange('skills', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #171717 0%, #171717 ${localWeights.skills}%, #f5f5f5 ${localWeights.skills}%, #f5f5f5 100%)`
              }}
            />
            <p className="text-xs text-gray-500">
              How CV skills match JD required skills using Hungarian algorithm
            </p>
          </div>
          
          {/* Responsibilities Weight */}
          <div className="space-y-3 p-4 bg-white rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-900">Responsibilities Matching</label>
              <Badge variant="outline" className="bg-neutral-900 text-white border-neutral-900">
                {localWeights.responsibilities}%
              </Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"  // Step of 5 for responsibilities
              value={localWeights.responsibilities}
              onChange={(e) => handleWeightChange('responsibilities', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #171717 0%, #171717 ${localWeights.responsibilities}%, #f5f5f5 ${localWeights.responsibilities}%, #f5f5f5 100%)`
              }}
            />
            <p className="text-xs text-gray-500">
              How CV responsibilities match JD required responsibilities
            </p>
          </div>
          
          {/* Job Title Weight */}
          <div className="space-y-3 p-4 bg-white rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-900">Job Title Similarity</label>
              <Badge variant="outline" className="bg-neutral-900 text-white border-neutral-900">
                {localWeights.job_title}%
              </Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"  // Step of 1 for job title
              value={localWeights.job_title}
              onChange={(e) => handleWeightChange('job_title', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #171717 0%, #171717 ${localWeights.job_title}%, #f5f5f5 ${localWeights.job_title}%, #f5f5f5 100%)`
              }}
            />
            <p className="text-xs text-gray-500">
              Cosine similarity between CV job title and JD job title
            </p>
          </div>
          
          {/* Experience Weight */}
          <div className="space-y-3 p-4 bg-white rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-900">Experience Ratio</label>
              <Badge variant="outline" className="bg-neutral-900 text-white border-neutral-900">
                {localWeights.experience}%
              </Badge>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"  // Step of 1 for experience
              value={localWeights.experience}
              onChange={(e) => handleWeightChange('experience', parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #171717 0%, #171717 ${localWeights.experience}%, #f5f5f5 ${localWeights.experience}%, #f5f5f5 100%)`
              }}
            />
            <p className="text-xs text-gray-500">
              Ratio rule: min(1.0, CV_years / JD_required_years)
            </p>
          </div>
        </div>
        
        {/* Normalized Values Display */}
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <h4 className="text-sm font-medium text-neutral-900 mb-3">Normalized Weights (Total: 100%)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-900">
                {normalizedWeights.skills.toFixed(1)}%
              </div>
              <div className="text-xs text-neutral-500">Skills</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-900">
                {normalizedWeights.responsibilities.toFixed(1)}%
              </div>
              <div className="text-xs text-neutral-500">Responsibilities</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-900">
                {normalizedWeights.job_title.toFixed(1)}%
              </div>
              <div className="text-xs text-neutral-500">Job Title</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-900">
                {normalizedWeights.experience.toFixed(1)}%
              </div>
              <div className="text-xs text-neutral-500">Experience</div>
            </div>
          </div>
        </div>
        
        {/* Algorithm Explanation */}
        <Card className="bg-neutral-50 border-neutral-200">
          <CardHeader>
            <CardTitle className="text-base text-neutral-900">Algorithm Explanation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong className="text-neutral-900">Hungarian Algorithm:</strong> Used for skills and responsibilities to find optimal 1:1 assignments between JD requirements and CV capabilities.
            </p>
            <p>
              <strong className="text-neutral-900">Cosine Similarity:</strong> Used for job title and individual skill/responsibility comparisons using all-mpnet-base-v2 embeddings.
            </p>
            <p>
              <strong className="text-neutral-900">Ratio Rule:</strong> Used for experience scoring to reward candidates who meet or exceed requirements.
            </p>
            <p>
              <strong className="text-neutral-900">Final Score:</strong> Weighted average of all dimensions, normalized to sum to 1.0.
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}