'use client';

import { X, User, Briefcase, FileText, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils';
import { CVListItem, JDListItem } from '@/lib/types';

interface StructuredPreviewProps {
  item: (CVListItem | JDListItem) & { type: 'cv' | 'jd' };
  onClose: () => void;
}

export default function StructuredPreview({ item, onClose }: StructuredPreviewProps) {
  const isCV = item.type === 'cv';
  const cvItem = isCV ? (item as CVListItem) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isCV ? (
                <User className="h-5 w-5 text-blue-500" />
              ) : (
                <Briefcase className="h-5 w-5 text-green-500" />
              )}
              {isCV ? cvItem?.full_name : item.job_title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {item.filename} • Uploaded {formatDate(item.upload_date)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="skills">Skills & Responsibilities</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Document Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Type
                      </label>
                      <p className="font-medium">
                        {isCV ? 'Curriculum Vitae' : 'Job Description'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Filename
                      </label>
                      <p className="font-medium">{item.filename}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Upload Date
                      </label>
                      <p className="font-medium">{formatDate(item.upload_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Content Length
                      </label>
                      <p className="font-medium">{item.text_length} characters</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Processing Status
                      </label>
                      <Badge variant={item.has_structured_data ? 'success' : 'secondary'}>
                        {item.has_structured_data ? 'Processed' : 'Pending'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Professional Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isCV && cvItem && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Full Name
                        </label>
                        <p className="font-medium">{cvItem.full_name}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Job Title
                      </label>
                      <p className="font-medium">{item.job_title}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Years of Experience
                      </label>
                      <p className="font-medium">{item.years_of_experience}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Content Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Content Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Skills Count
                      </label>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {item.skills_count} skills
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        Responsibilities Count
                      </label>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {item.responsibilities_count} responsibilities
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="skills" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Skills */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Skills
                      <Badge variant="secondary">{item.skills_count}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {item.skills && item.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {item.skills.slice(0, 20).map((skill, index) => (
                          <Badge key={index} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                        {item.skills.length > 20 && (
                          <Badge variant="secondary">
                            +{item.skills.length - 20} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No skills data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Placeholder for Responsibilities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Responsibilities
                      <Badge variant="secondary">{item.responsibilities_count}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Responsibility details would be displayed here based on the structured data format.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="raw" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Raw Document Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Document ID
                      </label>
                      <p className="font-mono text-sm bg-muted p-2 rounded">
                        {item.id}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Structured Data Available
                      </label>
                      <p className="text-sm">
                        {item.has_structured_data ? (
                          <span className="text-green-600">✓ Yes - Document has been processed</span>
                        ) : (
                          <span className="text-orange-600">⚠ No - Document pending processing</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Content Preview
                      </label>
                      <div className="text-sm bg-muted p-3 rounded max-h-32 overflow-y-auto">
                        Raw content would be displayed here. This would include the extracted text
                        and structured information returned by the backend API.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
