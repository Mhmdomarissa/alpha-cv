'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye, User, Briefcase, Clock, Search, Play, CheckSquare, Square, Filter, Download, Trash2, BarChart3, Calendar, Target, Zap, Users, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading';
import StructuredPreview from './StructuredPreview';
import { formatDate } from '@/lib/utils';
import { CVListItem, JDListItem } from '@/lib/types';

export default function DatabaseTable() {
  const { 
    cvs, 
    jds, 
    loadCVs, 
    loadJDs, 
    loadingStates, 
    selectedCVs, 
    selectedJD, 
    selectCV, 
    deselectCV, 
    selectJD, 
    runMatch, 
    setCurrentTab 
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<(CVListItem | JDListItem) & { type: 'cv' | 'jd' } | null>(null);
  const [filterByType, setFilterByType] = useState<'all' | 'cv' | 'jd'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'experience'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    if (cvs.length === 0) loadCVs();
    if (jds.length === 0) loadJDs();
  }, [cvs.length, jds.length, loadCVs, loadJDs]);

  // Enhanced filtering and sorting
  const getFilteredAndSortedData = () => {
    let allItems: Array<(CVListItem | JDListItem) & { type: 'cv' | 'jd' }> = [
      ...cvs.map(cv => ({ ...cv, type: 'cv' as const })),
      ...jds.map(jd => ({ ...jd, type: 'jd' as const }))
    ];

    // Apply search filter
    if (searchQuery) {
      allItems = allItems.filter(item => {
        const searchableText = [
          'full_name' in item ? item.full_name : '',
          item.job_title,
          item.filename
        ].join(' ').toLowerCase();
        return searchableText.includes(searchQuery.toLowerCase());
      });
    }

    // Apply type filter
    if (filterByType !== 'all') {
      allItems = allItems.filter(item => item.type === filterByType);
    }

    // Apply sorting
    allItems.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime();
          break;
        case 'name':
          const nameA = 'full_name' in a ? a.full_name : a.job_title;
          const nameB = 'full_name' in b ? b.full_name : b.job_title;
          comparison = nameA.localeCompare(nameB);
          break;
        case 'experience':
          comparison = parseInt(a.years_of_experience || '0') - parseInt(b.years_of_experience || '0');
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return allItems;
  };

  const filteredData = getFilteredAndSortedData();
  const filteredCVs = filteredData.filter(item => item.type === 'cv') as (CVListItem & { type: 'cv' })[];
  const filteredJDs = filteredData.filter(item => item.type === 'jd') as (JDListItem & { type: 'jd' })[];

  // Analytics calculations
  const analytics = {
    totalDocuments: cvs.length + jds.length,
    processedDocuments: cvs.filter(cv => cv.has_structured_data).length + jds.filter(jd => jd.has_structured_data).length,
    averageExperience: {
      cvs: cvs.length > 0 ? Math.round(cvs.reduce((sum, cv) => sum + parseInt(cv.years_of_experience || '0'), 0) / cvs.length) : 0,
      jds: jds.length > 0 ? Math.round(jds.reduce((sum, jd) => sum + parseInt(jd.years_of_experience || '0'), 0) / jds.length) : 0
    },
    matchReadiness: cvs.length > 0 && jds.length > 0
  };

  const isLoading = loadingStates.cvs.isLoading || loadingStates.jds.isLoading;

  const handleViewDetails = (item: CVListItem | JDListItem, type: 'cv' | 'jd') => {
    setSelectedItem({ ...item, type });
  };

  const handleCVToggle = (cvId: string) => {
    if (selectedCVs.includes(cvId)) {
      deselectCV(cvId);
    } else {
      selectCV(cvId);
    }
  };

  const handleJDSelect = (jdId: string) => {
    selectJD(jdId === selectedJD ? null : jdId);
  };

  const handleStartAnalyzing = async () => {
    if (selectedCVs.length > 0 && selectedJD) {
      await runMatch();
      setCurrentTab('match');
    }
  };

  const renderCVRow = (cv: CVListItem) => {
    const isSelected = selectedCVs.includes(cv.id);
    return (
      <tr key={cv.id} className={`border-b hover:bg-muted/50 ${isSelected ? 'bg-blue-50' : ''}`}>
        <td className="p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCVToggle(cv.id)}
            className="p-1"
          >
            {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
          </Button>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">{cv.full_name}</p>
              <p className="text-sm text-muted-foreground">{cv.filename}</p>
            </div>
          </div>
        </td>
      <td className="p-4">
        <Badge variant="secondary">CV</Badge>
      </td>
      <td className="p-4">{cv.job_title}</td>
      <td className="p-4">{cv.years_of_experience}</td>
      <td className="p-4">
        <div className="flex gap-1">
          <Badge variant="outline">{cv.skills_count} skills</Badge>
          <Badge variant="outline">{cv.responsibilities_count} resp.</Badge>
        </div>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {formatDate(cv.upload_date)}
        </td>
        <td className="p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewDetails(cv, 'cv')}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    );
  };

  const renderJDRow = (jd: JDListItem) => {
    const isSelected = selectedJD === jd.id;
    return (
      <tr key={jd.id} className={`border-b hover:bg-muted/50 ${isSelected ? 'bg-green-50' : ''}`}>
        <td className="p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleJDSelect(jd.id)}
            className="p-1"
          >
            {isSelected ? <CheckSquare className="h-5 w-5 text-green-600" /> : <Square className="h-5 w-5" />}
          </Button>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium">{jd.job_title}</p>
              <p className="text-sm text-muted-foreground">{jd.filename}</p>
            </div>
          </div>
        </td>
      <td className="p-4">
        <Badge variant="secondary">JD</Badge>
      </td>
      <td className="p-4">{jd.job_title}</td>
      <td className="p-4">{jd.years_of_experience}</td>
      <td className="p-4">
        <div className="flex gap-1">
          <Badge variant="outline">{jd.skills_count} skills</Badge>
          <Badge variant="outline">{jd.responsibilities_count} resp.</Badge>
        </div>
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {formatDate(jd.upload_date)}
        </td>
        <td className="p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewDetails(jd, 'jd')}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="elevated" className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <Users className="w-7 h-7 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Candidate CVs</p>
              <p className="text-3xl font-bold text-neutral-900">{cvs.length}</p>
              <p className="text-xs text-neutral-400 mt-1">
                Avg. {analytics.averageExperience.cvs}yr experience
              </p>
            </div>
          </div>
        </Card>

        <Card variant="elevated" className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-accent-100 rounded-xl">
              <Target className="w-7 h-7 text-accent-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Job Descriptions</p>
              <p className="text-3xl font-bold text-neutral-900">{jds.length}</p>
              <p className="text-xs text-neutral-400 mt-1">
                Avg. {analytics.averageExperience.jds}yr required
              </p>
            </div>
          </div>
        </Card>

        <Card variant="elevated" className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-success-100 rounded-xl">
              <BarChart3 className="w-7 h-7 text-success-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Processed</p>
              <p className="text-3xl font-bold text-neutral-900">{analytics.processedDocuments}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {Math.round((analytics.processedDocuments / analytics.totalDocuments) * 100) || 0}% completion
              </p>
            </div>
          </div>
        </Card>

        <Card variant="elevated" className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${analytics.matchReadiness ? 'bg-success-100' : 'bg-warning-100'}`}>
              <Zap className={`w-7 h-7 ${analytics.matchReadiness ? 'text-success-600' : 'text-warning-600'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Match Ready</p>
              <p className={`text-3xl font-bold ${analytics.matchReadiness ? 'text-success-600' : 'text-warning-600'}`}>
                {analytics.matchReadiness ? 'Yes' : 'No'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {selectedCVs.length} CVs, {selectedJD ? 1 : 0} JD selected
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <Input
                  placeholder="Search by name, job title, or filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-neutral-50 border-neutral-200 focus:bg-white"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'experience')}
                className="px-3 py-2 border border-neutral-200 rounded-lg bg-white text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="name">Sort by Name</option>
                <option value="experience">Sort by Experience</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={filterByType === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterByType('all')}
                >
                  All ({filteredData.length})
                </Button>
                <Button
                  variant={filterByType === 'cv' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterByType('cv')}
                >
                  CVs ({cvs.length})
                </Button>
                <Button
                  variant={filterByType === 'jd' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterByType('jd')}
                >
                  Job Descriptions ({jds.length})
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Premium Data Table */}
      <Card variant="elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary-600" />
                Document Library
              </CardTitle>
              <p className="text-sm text-neutral-500 mt-1">
                {filteredData.length} of {analytics.totalDocuments} documents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Bulk Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mx-6 mb-4">
            <TabsTrigger value="all">All Documents ({filteredData.length})</TabsTrigger>
            <TabsTrigger value="cvs">CVs ({filteredCVs.length})</TabsTrigger>
            <TabsTrigger value="jds">Job Descriptions ({filteredJDs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4 text-left font-medium">Document</th>
                        <th className="p-4 text-left font-medium">Type</th>
                        <th className="p-4 text-left font-medium">Job Title</th>
                        <th className="p-4 text-left font-medium">Experience</th>
                        <th className="p-4 text-left font-medium">Content</th>
                        <th className="p-4 text-left font-medium">Upload Date</th>
                        <th className="p-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map(item => 
                        item.type === 'cv' ? renderCVRow(item as CVListItem) : renderJDRow(item as JDListItem)
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cvs">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4 text-left font-medium">Select</th>
                        <th className="p-4 text-left font-medium">CV</th>
                        <th className="p-4 text-left font-medium">Type</th>
                        <th className="p-4 text-left font-medium">Job Title</th>
                        <th className="p-4 text-left font-medium">Experience</th>
                        <th className="p-4 text-left font-medium">Content</th>
                        <th className="p-4 text-left font-medium">Upload Date</th>
                        <th className="p-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCVs.map(renderCVRow)}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jds">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4 text-left font-medium">Select</th>
                        <th className="p-4 text-left font-medium">Job Description</th>
                        <th className="p-4 text-left font-medium">Type</th>
                        <th className="p-4 text-left font-medium">Job Title</th>
                        <th className="p-4 text-left font-medium">Experience</th>
                        <th className="p-4 text-left font-medium">Content</th>
                        <th className="p-4 text-left font-medium">Upload Date</th>
                        <th className="p-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJDs.map(renderJDRow)}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Premium Action Panel */}
      <Card variant="elevated" className="border-primary-200 bg-gradient-to-r from-primary-50 via-white to-accent-50">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Zap className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">AI Matching Analysis</h3>
                  <p className="text-sm text-neutral-500">
                    Hungarian algorithm with explainable results
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedCVs.length > 0 ? 'bg-success-500' : 'bg-neutral-300'}`}></div>
                  <span className="font-medium">{selectedCVs.length} CVs selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedJD ? 'bg-success-500' : 'bg-neutral-300'}`}></div>
                  <span className="font-medium">{selectedJD ? '1' : '0'} JD selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  <span className="text-neutral-600">
                    {selectedCVs.length > 0 && selectedJD 
                      ? `Ready for ${selectedCVs.length} candidate analysis`
                      : 'Select documents to begin'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedCVs.length > 0 || selectedJD ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    selectedCVs.forEach(cvId => deselectCV(cvId));
                    selectJD(null);
                  }}
                >
                  Clear Selection
                </Button>
              ) : null}
              
              <Button
                onClick={handleStartAnalyzing}
                disabled={selectedCVs.length === 0 || !selectedJD || loadingStates.matching.isLoading}
                variant="gradient"
                size="lg"
                loading={loadingStates.matching.isLoading}
                className="min-w-[160px]"
              >
                {loadingStates.matching.isLoading ? (
                  'Analyzing...'
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Preview Modal */}
      {selectedItem && (
        <StructuredPreview
          item={selectedItem!}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
