'use client';

import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Download,
  X,
  Loader2,
  MessageSquare,
  Edit3,
  Save,
  Calendar
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { LoadingCard } from '@/components/ui/loading';

export default function ApplicationsList() {
  const { applications, isLoading, selectedJob, viewingCVData, setViewingCVData, loadJobApplications } = useCareersStore();
  const { setCurrentTab, setCareersMatchData } = useAppStore();
  const { user } = useAuthStore();
  const [downloadingCV, setDownloadingCV] = useState<string | null>(null);
  
  // Note editing state
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDownloadCV = async (cvId: string) => {
    setDownloadingCV(cvId);
    try {
      const { blob, filename } = await api.downloadCV(cvId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // Use the filename from server response
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download CV:', error);
    } finally {
      setDownloadingCV(null);
    }
  };

  const [loadingCVData, setLoadingCVData] = useState(false);

  // Note handling functions
  const handleEditNote = (cvId: string, currentNote: string = '') => {
    setEditingNote(cvId);
    setNoteText(currentNote);
  };

  const handleSaveNote = async (cvId: string) => {
    if (!noteText.trim()) return;
    
    setSavingNote(cvId);
    try {
      await api.addOrUpdateNote(cvId, noteText.trim(), user?.username || 'anonymous');
      setEditingNote(null);
      setNoteText('');
      
      // Reload applications to get updated note data
      if (selectedJob) {
        await loadJobApplications(selectedJob.job_id);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSavingNote(null);
    }
  };

  const handleCancelNote = () => {
    setEditingNote(null);
    setNoteText('');
  };

  const handleViewDetails = async (cvId: string, filename: string) => {
    setLoadingCVData(true);
    try {
      // Get CV data from the database (similar to how the eye button works in DB view)
      const response = await api.getCVDetails(cvId);
      
      // Extract structured data from the nested structure
      const cvData = (response as any).cv;
      const structuredData = cvData?.structured_info;
      const candidate = cvData?.candidate;
      const textInfo = cvData?.text_info;
      
      // Find the job application data from the current applications list
      const jobApplicationFromList = applications.find(app => app.application_id === cvId);
      
      // Use job application data from CV response if available (includes phone number)
      const jobApplicationFromCV = cvData?.job_application;
      
      // Prefer CV job application data (has phone) over list data (missing phone)
      const jobApplication = jobApplicationFromCV || jobApplicationFromList;
      
      
      // Create formatted content with structured data and job application
      const content = {
        candidate: candidate,
        structured: structuredData,
        textInfo: textInfo,
        uploadDate: cvData?.upload_date,
        job_application: jobApplication
      };
      
      setViewingCVData({ cvId, filename, content: JSON.stringify(content, null, 2) });
    } catch (error) {
      console.error('Failed to load CV data:', error);
      setViewingCVData({ cvId, filename, content: 'Failed to load CV content' });
    } finally {
      setLoadingCVData(false);
    }
  };



  // No need to sort since we're not showing match scores
  const sortedApplications = applications;

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
      
      {sortedApplications.map((application) => (
        <Card key={application.application_id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-neutral-900">
                        {application.applicant_name}
                      </h3>
                      {/* Email/Naukri Source Badge */}
                      {application.source === 'email_application' && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 border border-purple-300">
                          <Mail className="w-3 h-3 mr-1" />
                          From Naukri
                        </Badge>
                      )}
                      {application.expected_salary && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          AED {application.expected_salary.toLocaleString()}
                        </Badge>
                      )}
                      {application.has_notes && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {application.notes_count || 0} note{(application.notes_count || 0) > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">
                      Applied {formatDate(application.application_date)}
                    </p>
                  </div>
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

                {/* Notes Section */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {application.has_notes && application.latest_note_text && editingNote !== application.application_id && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <MessageSquare className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">Latest Note</span>
                            <span className="text-xs text-yellow-600">
                              by {application.latest_note_author}
                            </span>
                            {application.latest_note_date && (
                              <span className="text-xs text-yellow-600">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {formatDate(application.latest_note_date)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                            {application.latest_note_text}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditNote(application.application_id, application.latest_note_text)}
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 ml-2"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Note editing form */}
                  {editingNote === application.application_id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          {application.has_notes ? 'Edit Note' : 'Add Note'}
                        </span>
                      </div>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add your note about this candidate..."
                        className="w-full p-2 border border-blue-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                      />
                      <div className="flex justify-end space-x-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelNote}
                          disabled={savingNote === application.application_id}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveNote(application.application_id)}
                          disabled={!noteText.trim() || savingNote === application.application_id}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {savingNote === application.application_id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-1" />
                              Save Note
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Add note button for candidates without notes */}
                  {!application.has_notes && editingNote !== application.application_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNote(application.application_id)}
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Add Note
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col space-y-2 ml-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownloadCV(application.application_id)}
                  disabled={downloadingCV === application.application_id}
                >
                  {downloadingCV === application.application_id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download CV
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  className="bg-primary-600 hover:bg-primary-700"
                  onClick={() => handleViewDetails(application.application_id, application.cv_filename)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* CV Data Modal */}
      {viewingCVData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CV Details</h3>
                <p className="text-sm text-gray-500">{viewingCVData.filename}</p>
              </div>
              <button
                onClick={() => setViewingCVData(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {loadingCVData ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">Loading CV content...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    try {
                      const data = JSON.parse(viewingCVData.content);
                      
                      // Handle both direct structure and nested cv structure
                      const cvData = data.cv || data;
                      
                      const candidate = cvData.candidate;
                      const structured = cvData.structured_info || cvData.structured;
                      const textInfo = cvData.text_info || cvData.textInfo;
                      const uploadDate = cvData.upload_date || cvData.uploadDate;
                      const jobApplication = cvData.job_application;
                      
                      return (
                        <>
                          {/* Candidate Information */}
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">Full Name</label>
                                <p className="text-gray-900">{jobApplication?.applicant_name || candidate?.full_name || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Job Title</label>
                                <p className="text-gray-900">{candidate?.job_title || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Experience</label>
                                <p className="text-gray-900">{candidate?.years_of_experience || 'N/A'} years</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Upload Date</label>
                                <p className="text-gray-900">{uploadDate ? new Date(uploadDate).toLocaleDateString() : 'N/A'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Contact Information */}
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information (Job Application)</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-gray-500">Email</label>
                                <p className="text-gray-900">{jobApplication?.applicant_email || candidate?.contact_info?.email || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Phone</label>
                                <p className="text-gray-900">{jobApplication?.applicant_phone || candidate?.contact_info?.phone || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Application Date</label>
                                <p className="text-gray-900">{jobApplication?.application_date ? new Date(jobApplication.application_date).toLocaleDateString() : 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Application Status</label>
                                <p className="text-gray-900 capitalize">{jobApplication?.application_status || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Expected Salary</label>
                                <p className="text-gray-900">{jobApplication?.expected_salary ? `AED ${jobApplication.expected_salary.toLocaleString()}` : 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-500">Years of Experience</label>
                                <p className="text-gray-900">{jobApplication?.years_of_experience ? `${jobApplication.years_of_experience} years` : 'N/A'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Skills */}
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Skills ({candidate?.skills_count || 0})
                            </h3>
                            <div className="space-y-2">
                              {candidate?.skills?.map((skill: string, index: number) => (
                                <div key={index} className="text-gray-800">{skill}</div>
                              ))}
                            </div>
                          </div>

                          {/* Responsibilities */}
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Responsibilities ({candidate?.responsibilities_count || 0})
                            </h3>
                            <div className="space-y-2">
                              {candidate?.responsibilities?.map((responsibility: string, index: number) => (
                                <div key={index} className="text-gray-800">• {responsibility}</div>
                              ))}
                            </div>
                          </div>

                          {/* Text Preview */}
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Text Preview</h3>
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-gray-800 text-sm whitespace-pre-wrap">
                                {textInfo?.extracted_text_preview || 'No preview available'}
                              </p>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              Text length: {textInfo?.extracted_text_length || 0} characters
                            </p>
                          </div>

                        </>
                      );
                    } catch (error) {
                      return (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono max-h-96 overflow-auto">
                            {viewingCVData.content}
                          </pre>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button
                variant="outline"
                onClick={() => setViewingCVData(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}