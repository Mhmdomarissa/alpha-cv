'use client';

import React from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Star,
  Download
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { Card, CardContent } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { LoadingCard } from '@/components/ui/loading';

export default function ApplicationsList() {
  const { applications, isLoading } = useCareersStore();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'neutral';
    if (score >= 0.8) return 'green';
    if (score >= 0.6) return 'yellow';
    return 'red';
  };

  if (isLoading) {
    return <LoadingCard count={3} />;
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <p className="text-neutral-600">No applications yet</p>
        <p className="text-sm text-neutral-500">
          Share the job posting link to start receiving applications
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <Card key={application.application_id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">
                      {application.applicant_name}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      Applied {formatDate(application.application_date)}
                    </p>
                  </div>
                  {application.match_score && (
                    <Badge 
                      variant="secondary"
                      className={`ml-auto ${
                        getScoreColor(application.match_score) === 'green' ? 'bg-green-100 text-green-800' :
                        getScoreColor(application.match_score) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      <Star className="w-3 h-3 mr-1" />
                      {Math.round(application.match_score * 100)}%
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-neutral-600">
                    <Mail className="w-4 h-4" />
                    <span>{application.applicant_email}</span>
                  </div>
                  
                  {application.applicant_phone && (
                    <div className="flex items-center space-x-2 text-sm text-neutral-600">
                      <Phone className="w-4 h-4" />
                      <span>{application.applicant_phone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-sm text-neutral-600">
                    <FileText className="w-4 h-4" />
                    <span>{application.cv_filename}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2 ml-4">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download CV
                </Button>
                <Button size="sm" className="bg-primary-600 hover:bg-primary-700">
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
