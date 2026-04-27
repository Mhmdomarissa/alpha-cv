'use client';

import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  User,
  Mail,
  Phone,
  FileText,
  Download,
  X,
  Loader2,
  MessageSquare,
  Save,
  Eye,
  DollarSign,
  Search,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { useCareersStore } from '@/stores/careersStore';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';

const FilePreviewModal = dynamic(
  () => import('@/components/ui/file-preview-modal').then((mod) => mod.FilePreviewModal),
  { ssr: false }
);

export default function ApplicationsList() {
  const { applications, isLoading, selectedJob, viewingCVData, setViewingCVData, loadJobApplications } = useCareersStore();
  const { setCurrentTab, setCareersMatchData } = useAppStore();
  const { user } = useAuthStore();
  const [downloadingCV, setDownloadingCV] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'email_application' | 'other'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'salary_high' | 'salary_low'>('recent');
  
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
    setDetailNotes([]);
    setEditingNoteIndex(null);
    setEditNoteText('');
    setNewNoteText('');
    try {
      const cvData = await api.getCVDetails(cvId);
      const jobApplicationFromList = applications.find((app) => app.application_id === cvId);
      const jobApplication = (cvData as any).job_application || jobApplicationFromList;
      const content = {
        candidate: cvData.candidate,
        structured_info: cvData.structured_info,
        text_info: cvData.text_info,
        upload_date: (cvData as any).upload_date,
        job_application: jobApplication
          ? {
              applicant_name: jobApplicationFromList?.applicant_name,
              applicant_email: jobApplicationFromList?.applicant_email,
              applicant_phone: jobApplicationFromList?.applicant_phone,
              application_date: jobApplicationFromList?.application_date,
              expected_salary: jobApplicationFromList?.expected_salary ?? (jobApplication as any).expected_salary,
              application_status: (jobApplication as any).application_status,
              years_of_experience: (jobApplication as any).years_of_experience,
            }
          : null,
      };
      setViewingCVData({ cvId, filename, content: JSON.stringify(content) });
    } catch (error) {
      console.error('Failed to load CV data:', error);
      setViewingCVData({ cvId, filename, content: 'Failed to load CV content' });
    } finally {
      setLoadingCVData(false);
    }
  };

  const [detailNotes, setDetailNotes] = useState<any[]>([]);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [savingPanelNote, setSavingPanelNote] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ cvId: string; fileName: string } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Load PDF via download API (works for job applications; avoids CORS and ensures file is available)
  useEffect(() => {
    if (!pdfPreview) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setPdfLoadError(null);
      return;
    }
    let cancelled = false;
    setPdfLoading(true);
    setPdfLoadError(null);
    (async () => {
      try {
        const { blob } = await api.downloadCV(pdfPreview.cvId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setPdfLoadError(e instanceof Error ? e.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfPreview?.cvId]);

  const closePdfPreview = () => {
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setPdfPreview(null);
    setPdfLoadError(null);
    setPdfLoading(false);
  };

  useEffect(() => {
    if (!viewingCVData?.cvId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCVNotes(viewingCVData.cvId);
        if (!cancelled) setDetailNotes(res.notes || []);
      } catch {
        if (!cancelled) setDetailNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewingCVData?.cvId]);

  const handlePanelAddNote = async () => {
    if (!viewingCVData?.cvId || !newNoteText.trim() || !user?.username) return;
    setSavingPanelNote(true);
    try {
      await api.addOrUpdateNote(viewingCVData.cvId, newNoteText.trim(), user.username);
      const res = await api.getCVNotes(viewingCVData.cvId);
      setDetailNotes(res.notes || []);
      setNewNoteText('');
      if (selectedJob) await loadJobApplications(selectedJob.job_id);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPanelNote(false);
    }
  };

  const handlePanelSaveEditNote = async () => {
    if (editingNoteIndex == null || !viewingCVData?.cvId || !editNoteText.trim() || !user?.username) return;
    setSavingPanelNote(true);
    try {
      await api.addOrUpdateNote(viewingCVData.cvId, editNoteText.trim(), user.username);
      const res = await api.getCVNotes(viewingCVData.cvId);
      setDetailNotes(res.notes || []);
      setEditingNoteIndex(null);
      setEditNoteText('');
    } finally {
      setSavingPanelNote(false);
    }
  };

  const handlePanelDeleteNote = async (hrUser: string) => {
    if (!viewingCVData?.cvId || !user?.username || !window.confirm('Delete this note?')) return;
    try {
      await api.deleteCVNote(viewingCVData.cvId, hrUser);
      const res = await api.getCVNotes(viewingCVData.cvId);
      setDetailNotes(res.notes || []);
      if (selectedJob) await loadJobApplications(selectedJob.job_id);
    } catch (e) {
      console.error(e);
    }
  };

  const previewFileName = (filename: string, displayName: string) => {
    const base = filename || displayName || 'document';
    return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  };



  const filteredApplications = useMemo(() => {
    let list = applications || [];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a: any) => {
        const name = String(a?.applicant_name || '').toLowerCase();
        const email = String(a?.applicant_email || '').toLowerCase();
        const phone = String(a?.applicant_phone || '').toLowerCase();
        const file = String(a?.cv_filename || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || file.includes(q);
      });
    }
    if (sourceFilter !== 'all') {
      list = list.filter((a: any) => {
        const src = a?.source;
        if (sourceFilter === 'email_application') return src === 'email_application';
        return src !== 'email_application';
      });
    }
    const byDate = (s?: string) => {
      const t = s ? Date.parse(s) : 0;
      return Number.isFinite(t) ? t : 0;
    };
    const bySalary = (n: any) => (typeof n === 'number' && Number.isFinite(n) ? n : -1);
    const sorted = [...list].sort((a: any, b: any) => {
      if (sortBy === 'recent') return byDate(b?.application_date) - byDate(a?.application_date);
      if (sortBy === 'salary_high') return bySalary(b?.expected_salary) - bySalary(a?.expected_salary);
      if (sortBy === 'salary_low') return bySalary(a?.expected_salary) - bySalary(b?.expected_salary);
      return 0;
    });
    return sorted;
  }, [applications, query, sourceFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[neutral-900]" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No applicants yet</p>
        <p className="text-sm text-gray-500 mt-1">
          Share the job posting link to start receiving applications
        </p>
      </div>
    );
  }

  const totalCount = applications.length;
  const visibleCount = filteredApplications.length;
  const naukriCount = applications.filter((a: any) => a?.source === 'email_application').length;
  const withSalaryCount = applications.filter((a: any) => typeof a?.expected_salary === 'number').length;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Applicants</span>
            <span className="text-xs text-gray-500">
              Showing {visibleCount} of {totalCount}
              {naukriCount > 0 ? ` • Naukri: ${naukriCount}` : ''}
              {withSalaryCount > 0 ? ` • Salary: ${withSalaryCount}` : ''}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Search, filter, and open a candidate to review details, notes, and PDF.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative w-full sm:w-[320px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, filename…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[neutral-900] focus:border-[neutral-900]"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[neutral-900] focus:border-[neutral-900]"
                title="Filter by source"
              >
                <option value="all">All sources</option>
                <option value="email_application">Naukri (email)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="inline-flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[neutral-900] focus:border-[neutral-900]"
                title="Sort"
              >
                <option value="recent">Most recent</option>
                <option value="salary_high">Salary (high → low)</option>
                <option value="salary_low">Salary (low → high)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-xs sm:text-sm border-collapse min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700">Candidate</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700">Email</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700">Expected salary</th>
            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700">Applied</th>
            <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredApplications.map((application) => (
            <tr
              key={application.application_id}
              className="border-b border-gray-100 hover:bg-gray-50/80 align-top"
            >
              <td className="py-2 sm:py-3 px-2 sm:px-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 block truncate">{application.applicant_name}</span>
                    {application.source === 'email_application' && (
                      <Badge variant="secondary" className="ml-0 sm:ml-1 text-xs bg-purple-50 text-purple-700 border-0">
                        Naukri
                      </Badge>
                    )}
                    {application.cv_filename && (
                      <p className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-[180px]" title={application.cv_filename}>
                        {application.cv_filename}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2 sm:py-3 px-2 sm:px-4">
                <a href={`mailto:${application.applicant_email}`} className="text-[neutral-900] hover:underline truncate block max-w-[120px] sm:max-w-[200px]" title={application.applicant_email}>
                  {application.applicant_email}
                </a>
                {application.applicant_phone && (
                  <p className="text-xs text-gray-500 mt-0.5">{application.applicant_phone}</p>
                )}
              </td>
              <td className="py-2 sm:py-3 px-2 sm:px-4">
                {application.expected_salary != null ? (
                  <span className="font-medium text-gray-900 whitespace-nowrap">AED {application.expected_salary.toLocaleString()}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 whitespace-nowrap">
                {formatDate(application.application_date)}
              </td>
              <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                <div className="flex items-center justify-end gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 text-gray-700 h-7 sm:h-8 text-xs sm:text-sm"
                    onClick={() => handleViewDetails(application.application_id, application.cv_filename)}
                    title="View details & notes"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Details</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 text-gray-700 h-7 sm:h-8 text-xs sm:text-sm"
                    onClick={() => {
                      const name = application.applicant_name || 'document';
                      const fn = previewFileName(application.cv_filename, name);
                      setPdfPreview({ cvId: application.application_id, fileName: fn });
                    }}
                    title="View PDF"
                  >
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      
      {/* Right-side panel: Candidate details & notes */}
      {viewingCVData && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => {
              setViewingCVData(null);
              setEditingNoteIndex(null);
              setEditNoteText('');
              setNewNoteText('');
            }}
            aria-hidden
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-white border-l border-gray-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">Candidate details & notes</h2>
              <button
                type="button"
                onClick={() => {
                  setViewingCVData(null);
                  setEditingNoteIndex(null);
                  setEditNoteText('');
                  setNewNoteText('');
                }}
                className="p-2 rounded-lg hover:bg-gray-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
              {loadingCVData ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[neutral-900]" />
                  <p className="text-gray-500 mt-2">Loading details...</p>
                </div>
              ) : (
                (() => {
                  try {
                    const data = JSON.parse(viewingCVData.content);
                    const candidate = data.candidate;
                    const structured = data.structured_info;
                    const jobApplication = data.job_application;
                    const skills = candidate?.skills || structured?.skills_sentences || [];
                    const responsibilities = candidate?.responsibilities || structured?.responsibility_sentences || [];
                    const displayName = jobApplication?.applicant_name || candidate?.full_name || 'Unknown';
                    const fileName = previewFileName(viewingCVData.filename, displayName);
                    return (
                      <>
                        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                          <h3 className="text-base font-bold text-gray-900">
                            {displayName}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {candidate?.job_title || '—'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {candidate?.years_of_experience ?? '—'} years • {skills.length} skills
                          </p>
                          {structured?.category && (
                            <p className="text-xs text-gray-500 mt-1">Category: {structured.category}</p>
                          )}
                          {jobApplication?.expected_salary != null && (
                            <p className="text-sm font-semibold text-gray-800 mt-2 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              Salary asked: AED {Number(jobApplication.expected_salary).toLocaleString()}
                            </p>
                          )}
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-[neutral-900] hover:bg-[neutral-800] text-white"
                            onClick={() => setPdfPreview({ cvId: viewingCVData.cvId, fileName })}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View full PDF
                          </Button>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Skills</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.slice(0, 30).map((s: string, i: number) => (
                              <span key={i} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800">{s}</span>
                            ))}
                            {skills.length > 30 && <span className="text-xs text-gray-500">+{skills.length - 30} more</span>}
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Responsibilities</h4>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {responsibilities.slice(0, 15).map((r: string, i: number) => (
                              <li key={i} className="line-clamp-2">{r}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Notes ({detailNotes.length})
                          </h4>
                          <div className="space-y-3 max-h-48 overflow-y-auto">
                            {detailNotes.length === 0 ? (
                              <p className="text-sm text-gray-500">No notes yet. Add one below.</p>
                            ) : (
                              detailNotes.map((note: any, i: number) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                  {editingNoteIndex === i ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={editNoteText}
                                        onChange={(e) => setEditNoteText(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:ring-2 focus:ring-[neutral-900]"
                                        rows={2}
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={handlePanelSaveEditNote} disabled={savingPanelNote} className="bg-[neutral-900] hover:bg-[neutral-800]">
                                          {savingPanelNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                          <span className="ml-1">Save</span>
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { setEditingNoteIndex(null); setEditNoteText(''); }}>Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm text-gray-800">{note.note}</p>
                                      <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-gray-500">{note.hr_user} • {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : ''}</span>
                                        {note.hr_user === user?.username && (
                                          <div className="flex gap-2">
                                            <button type="button" className="text-xs text-[neutral-900] hover:underline" onClick={() => { setEditingNoteIndex(i); setEditNoteText(note.note || ''); }}>Edit</button>
                                            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => handlePanelDeleteNote(note.hr_user)}>Delete</button>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <textarea
                              value={newNoteText}
                              onChange={(e) => setNewNoteText(e.target.value)}
                              placeholder="Add a note..."
                              className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:ring-2 focus:ring-[neutral-900]"
                              rows={2}
                            />
                            <Button
                              size="sm"
                              className="mt-2 bg-[neutral-900] hover:bg-[neutral-800] text-white"
                              onClick={handlePanelAddNote}
                              disabled={savingPanelNote || !newNoteText.trim()}
                            >
                              {savingPanelNote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                              Add note
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  } catch {
                    return (
                      <p className="text-gray-500">Failed to load details.</p>
                    );
                  }
                })()
              )}
            </div>
          </div>
        </>
      )}

      {pdfPreview && (
        pdfLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-[neutral-900]" />
              <p className="text-gray-700">Loading PDF...</p>
            </div>
          </div>
        ) : pdfLoadError ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 max-w-sm flex flex-col items-center gap-3">
              <p className="text-red-600">{pdfLoadError}</p>
              <Button onClick={closePdfPreview} variant="outline">Close</Button>
            </div>
          </div>
        ) : pdfBlobUrl ? (
          <FilePreviewModal
            isOpen
            onClose={closePdfPreview}
            fileUrl={pdfBlobUrl}
            fileName={pdfPreview.fileName}
            fileId={pdfPreview.cvId}
            fileType="application/pdf"
          />
        ) : null
      )}
    </div>
  );
}
