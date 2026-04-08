'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  FileText,
  RefreshCw,
  Search,
  FolderOpen,
  Target,
  Eye,
  CheckSquare,
  Square,
  Loader2,
  Trash2,
  MoreVertical,
  MessageSquare,
  X,
  Pencil,
  Save,
  FileText as FileTextIcon,
  ListChecks,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';
import { Button } from '@/components/ui/button-enhanced';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CVListItem, JDListItem } from '@/lib/types';

const FilePreviewModal = dynamic(
  () => import('@/components/ui/file-preview-modal').then((mod) => mod.FilePreviewModal),
  { ssr: false }
);

const ITEMS_PER_PAGE = 24;
const CATEGORY_ALL = '__all__';

function getCVDisplay(cv: CVListItem) {
  return {
    name: cv.full_name || cv.filename || 'Unknown',
    title: cv.job_title || '—',
    years: cv.years_of_experience ?? '—',
    skillsCount: cv.skills_count ?? 0,
    category: (cv as CVListItem & { category?: string }).category ?? 'General',
    filename: cv.filename || '',
  };
}

function getJDDisplay(jd: JDListItem) {
  return {
    title: jd.job_title || jd.filename || 'Untitled',
    skillsCount: jd.skills_count ?? 0,
  };
}

export default function DatabasePageNew() {
  const {
    cvs,
    jds,
    totalCVs,
    totalJDs,
    selectedCVs,
    selectedJD,
    loadCVs,
    loadJDs,
    loadMoreCVs,
    loadMoreJDs,
    selectCV,
    deselectCV,
    selectJD,
    selectAllCVs,
    deselectAllCVs,
    setCurrentTab,
    runMatch,
    deleteCV,
    deleteJD,
    loadingStates, databaseActiveTab,
  } = useAppStore();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>(CATEGORY_ALL);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ id: string; name: string; type: 'cv' | 'jd' } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [openMenuCVId, setOpenMenuCVId] = useState<string | null>(null);
  const [openMenuJDId, setOpenMenuJDId] = useState<string | null>(null);
  const [view, setView] = useState<'candidates' | 'jobs'>(
    databaseActiveTab === 'jds' ? 'jobs' : 'candidates'
  );
  const [detailCVId, setDetailCVId] = useState<string | null>(null);
  const [notesSummary, setNotesSummary] = useState<Record<string, number>>({});
  const [detailCV, setDetailCV] = useState<any>(null);
  const [detailNotes, setDetailNotes] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [detailJDId, setDetailJDId] = useState<string | null>(null);
  const [detailJD, setDetailJD] = useState<any>(null);
  const [detailJDLoading, setDetailJDLoading] = useState(false);
  const [notesFilter, setNotesFilter] = useState<'all' | 'with_notes' | 'without_notes'>('all');
  const [showSelectedCVs, setShowSelectedCVs] = useState(false);
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);

  // Load CV or JD as blob for preview (blob URL for PDF/iframe; keep blob for DOCX to avoid refetch 0 B)
  useEffect(() => {
    if (!preview) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setPreviewBlob(null);
      setPreviewLoadError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewLoadError(null);
    setPreviewBlob(null);
    (async () => {
      try {
        if (preview.type === 'cv') {
          const { blob, filename: apiFilename } = await api.downloadCV(preview.id);
          if (cancelled) return;
          setPreviewBlobUrl(URL.createObjectURL(blob));
          setPreviewBlob(blob);
          if (apiFilename && apiFilename !== preview.name) {
            setPreview(prev => prev ? { ...prev, name: apiFilename } : null);
          }
        } else {
          const url = `${getApiBaseUrl()}/api/storage/files/${preview.type}/${preview.id}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.statusText || 'Failed to load document');
          const blob = await res.blob();
          if (cancelled) return;
          if (blob.size === 0) throw new Error('Document is empty');
          setPreviewBlobUrl(URL.createObjectURL(blob));
          setPreviewBlob(blob);
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewLoadError(e instanceof Error ? e.message : 'Failed to load document');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview?.id, preview?.type]);

  const closePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewBlob(null);
    setPreview(null);
    setPreviewLoadError(null);
    setPreviewLoading(false);
  };

  useEffect(() => {
    loadCVs();
    loadJDs();
  }, [loadCVs, loadJDs]);

  useEffect(() => {
    if (cvs.length === 0) return;
    const ids = cvs.map((c) => c.id).filter(Boolean);
    if (ids.length === 0) return;
    api.getNotesSummary(ids).then((r) => {
      const next: Record<string, number> = {};
      (r.summaries || []).forEach((s: any) => {
        if (s.cv_id && (s.notes_count || 0) > 0) next[s.cv_id] = s.notes_count;
      });
      setNotesSummary(next);
    }).catch(() => { });
  }, [cvs]);

  useEffect(() => {
    if (!detailCVId) {
      setDetailCV(null);
      setDetailNotes([]);
      return;
    }
    setDetailLoading(true);
    Promise.all([
      api.getCVDetails(detailCVId),
      api.getCVNotes(detailCVId),
    ]).then(([cvRes, notesRes]) => {
      setDetailCV(cvRes);
      setDetailNotes(notesRes.notes || []);
    }).catch(() => {
      setDetailCV(null);
      setDetailNotes([]);
    }).finally(() => setDetailLoading(false));
  }, [detailCVId]);

  useEffect(() => {
    if (!detailJDId) {
      setDetailJD(null);
      return;
    }
    setDetailJDLoading(true);
    api
      .getJDDetails(detailJDId)
      .then(setDetailJD)
      .catch(() => setDetailJD(null))
      .finally(() => setDetailJDLoading(false));
  }, [detailJDId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    api
      .getCategories()
      .then((r) => {
        if (!cancelled) setCategories(r.categories || {});
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => { cancelled = true; };
  }, [cvs.length]);

  const filteredCVs = useMemo(() => {
    let list = cvs;
    if (activeFolder !== CATEGORY_ALL) {
      list = list.filter((cv) => ((cv as CVListItem & { category?: string }).category ?? 'General') === activeFolder);
    }
    if (notesFilter === 'with_notes') {
      list = list.filter((cv) => (notesSummary[cv.id] ?? 0) > 0);
    } else if (notesFilter === 'without_notes') {
      list = list.filter((cv) => (notesSummary[cv.id] ?? 0) === 0);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (cv) =>
          cv.full_name?.toLowerCase().includes(q) ||
          cv.job_title?.toLowerCase().includes(q) ||
          cv.filename?.toLowerCase().includes(q) ||
          cv.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cvs, activeFolder, search, notesFilter, notesSummary]);

  const filteredJDs = useMemo(() => {
    if (!search.trim()) return jds;
    const q = search.toLowerCase();
    return jds.filter(
      (jd) =>
        jd.job_title?.toLowerCase().includes(q) ||
        jd.filename?.toLowerCase().includes(q) ||
        jd.id.toLowerCase().includes(q)
    );
  }, [jds, search]);

  const totalPages = Math.ceil(filteredCVs.length / ITEMS_PER_PAGE) || 1;
  const paginatedCVs = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredCVs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCVs, page]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [page, totalPages]);

  const selectedJDDisplay = selectedJD ? jds.find((j) => j.id === selectedJD) : null;
  const canMatch = selectedCVs.length > 0 && selectedJD;

  const handleMatch = async () => {
    if (!canMatch) return;
    await runMatch();
    setCurrentTab('match');
  };

  const toggleCV = (id: string) => {
    if (selectedCVs.includes(id)) deselectCV(id);
    else selectCV(id);
  };

  const allOnPageSelected = paginatedCVs.length > 0 && paginatedCVs.every((cv) => selectedCVs.includes(cv.id));

  const selectAllInFolder = () => {
    if (allOnPageSelected) {
      paginatedCVs.forEach((cv) => deselectCV(cv.id));
    } else {
      paginatedCVs.forEach((cv) => {
        if (!selectedCVs.includes(cv.id)) selectCV(cv.id);
      });
    }
  };

  const selectedCVList = useMemo(
    () => cvs.filter((cv) => selectedCVs.includes(cv.id)),
    [cvs, selectedCVs]
  );

  const previewFileName = (item: { filename?: string; full_name?: string; job_title?: string }, type: 'cv' | 'jd') => {
    const base = item.filename || (type === 'cv' ? item.full_name : item.job_title) || 'document';

    // Check if it's already a valid extension
    const lower = base.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
      return base;
    }

    // Default to PDF if no extension or unknown
    return `${base}.pdf`;
  };

  const openPreview = (id: string, type: 'cv' | 'jd', name: string, item?: CVListItem | JDListItem) => {
    // If item is available, use previewFileName logic
    if (item) {
      const fileName = previewFileName(item, type);
      setPreview({ id, type, name: fileName });
      return;
    }

    // If only name provided, check its extension
    const lower = name.toLowerCase();
    const fileName = (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc'))
      ? name
      : `${name}.pdf`;

    setPreview({ id, type, name: fileName });
  };

  const handleAddNote = async () => {
    if (!detailCVId || !newNoteText.trim() || !user?.username) return;
    setSavingNote(true);
    try {
      await api.addOrUpdateNote(detailCVId, newNoteText.trim(), user.username);
      const res = await api.getCVNotes(detailCVId);
      setDetailNotes(res.notes || []);
      setNotesSummary((prev) => ({ ...prev, [detailCVId]: (res.notes || []).length }));
      setNewNoteText('');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveEditNote = async () => {
    if (editingNoteIndex == null || !detailCVId || !editNoteText.trim() || !user?.username) return;
    setSavingNote(true);
    try {
      await api.addOrUpdateNote(detailCVId, editNoteText.trim(), user.username);
      const res = await api.getCVNotes(detailCVId);
      setDetailNotes(res.notes || []);
      setEditingNoteIndex(null);
      setEditNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (hrUser: string) => {
    if (!detailCVId || !user?.username || !window.confirm('Delete this note?')) return;
    try {
      await api.deleteCVNote(detailCVId, hrUser);
      const res = await api.getCVNotes(detailCVId);
      setDetailNotes(res.notes || []);
      setNotesSummary((prev) => ({ ...prev, [detailCVId]: (res.notes || []).length }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCV = async (id: string) => {
    if (!window.confirm('Delete this CV? This cannot be undone.')) return;
    setOpenMenuCVId(null);
    await deleteCV(id);
  };

  const handleDeleteJD = async (id: string) => {
    if (!window.confirm('Delete this job description? This cannot be undone.')) return;
    await deleteJD(id);
  };

  const folderList = useMemo(() => {
    const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    return entries;
  }, [categories]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-gray-50 to-[#eff6ff]/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Database</h1>
          <p className="text-gray-600 mt-0.5">
            Select a folder, choose candidates and a job description, then run matching.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-gray-200">
              <Users className="w-3.5 h-3.5" />
              Loaded {cvs.length}{totalCVs != null ? ` of ${totalCVs}` : ''} candidates
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-gray-200">
              <FileText className="w-3.5 h-3.5" />
              Loaded {jds.length}{totalJDs != null ? ` of ${totalJDs}` : ''} JDs
            </span>
            {(selectedCVs.length > 0 || selectedJD) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-gray-200">
                <ListChecks className="w-3.5 h-3.5 text-[#00529b]" />
                {selectedCVs.length} selected{selectedJD ? ' • 1 JD selected' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[220px] sm:min-w-[260px] lg:min-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={view === 'candidates' ? 'Search candidates...' : 'Search job descriptions...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full min-w-0 pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] focus:ring-offset-0 focus:border-[#00529b]"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadCVs(); loadJDs(); }}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            {canMatch && (
              <Button
                variant="primary"
                onClick={handleMatch}
                className="inline-flex items-center gap-2 bg-[#00529b] hover:bg-[#003d73] !text-white border-0"
              >
                <Target className="w-4 h-4 !text-white" />
                <span className="!text-white">
                  Match {selectedCVs.length} with {selectedJDDisplay ? getJDDisplay(selectedJDDisplay).title : 'JD'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4 lg:gap-6">
        {/* Sidebar: Folders + JDs - stacks on mobile */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:gap-6 bg-white border border-gray-200 rounded-2xl p-4 h-fit lg:sticky lg:top-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Folders
            </h2>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setActiveFolder(CATEGORY_ALL); setPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${activeFolder === CATEGORY_ALL ? 'bg-[#00529b] hover:bg-[#003d73] !text-white' : 'text-gray-700 hover:bg-gray-100 hover:!text-gray-900'
                  }`}
              >
                <span className={activeFolder === CATEGORY_ALL ? '!text-white' : ''}>All candidates</span>
                <span className={activeFolder === CATEGORY_ALL ? '!text-white' : 'text-gray-500'}>{cvs.length}</span>
              </button>
              {loadingCategories ? (
                <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                folderList.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveFolder(cat); setPage(1); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${activeFolder === cat ? 'bg-[#00529b] hover:bg-[#003d73] !text-white' : 'text-gray-700 hover:bg-gray-100 hover:!text-gray-900'
                      }`}
                  >
                    <span className={`truncate ${activeFolder === cat ? '!text-white' : ''}`}>{cat}</span>
                    <span className={activeFolder === cat ? '!text-white' : 'text-gray-500'}>{count}</span>
                  </button>
                ))
              )}
            </nav>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Job descriptions
            </h2>
            <p className="text-xs text-gray-500 mb-2">Select one to match with candidates.</p>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {jds.length === 0 ? (
                <p className="text-xs text-gray-500 px-2">No JDs yet. Upload from Upload tab.</p>
              ) : (
                jds.map((jd) => (
                  <label
                    key={jd.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${selectedJD === jd.id ? 'bg-[#00529b]/10 text-[#00529b] font-medium' : 'hover:bg-gray-100'
                      }`}
                  >
                    <input
                      type="radio"
                      name="jd"
                      checked={selectedJD === jd.id}
                      onChange={() => selectJD(jd.id)}
                      className="sr-only"
                    />
                    <span className="truncate flex-1">{getJDDisplay(jd).title}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {(selectedCVs.length > 0 || selectedJD) && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <p className="text-xs text-gray-600">
                {selectedCVs.length} candidate{selectedCVs.length !== 1 ? 's' : ''} selected
                {selectedJD && ` • 1 JD selected`}
              </p>
            </div>
          )}
        </aside>

        {/* Main: Search + List */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
              <button
                type="button"
                onClick={() => setView('candidates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'candidates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Candidates ({cvs.length})
              </button>
              <button
                type="button"
                onClick={() => setView('jobs')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'jobs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Job descriptions ({jds.length})
              </button>
            </div>
            {view === 'candidates' && (
              <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                <select
                  value={notesFilter}
                  onChange={(e) => { setNotesFilter(e.target.value as 'all' | 'with_notes' | 'without_notes'); setPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] focus:border-[#00529b]"
                  title="Filter by notes"
                >
                  <option value="all">All candidates</option>
                  <option value="with_notes">With notes</option>
                  <option value="without_notes">Without notes</option>
                </select>
                <Button variant="outline" size="sm" onClick={selectAllInFolder}>
                  {allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                </Button>
              </div>
            )}
          </div>

          {view === 'candidates' && filteredCVs.length > 0 && (
            <p className="text-sm text-gray-500 mb-2">
              {totalCVs != null && totalCVs > cvs.length
                ? `${filteredCVs.length} of ${totalCVs} candidate${totalCVs !== 1 ? 's' : ''}`
                : `${filteredCVs.length} candidate${filteredCVs.length !== 1 ? 's' : ''}`}
              {activeFolder !== CATEGORY_ALL && ` in ${activeFolder}`}
            </p>
          )}
          <div className="flex-1 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            {view === 'jobs' ? (
              filteredJDs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <FileText className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="font-medium text-gray-700">{search ? 'No job descriptions match your search.' : 'No job descriptions yet.'}</p>
                  <p className="text-sm mt-1">Upload JDs from the Upload tab.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {filteredJDs.map((jd) => {
                      const d = getJDDisplay(jd);
                      const isSelected = selectedJD === jd.id;
                      return (
                        <div
                          key={jd.id}
                          className={`rounded-xl border-2 p-4 transition-colors ${isSelected ? 'border-[#00529b] bg-[#00529b]/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => selectJD(isSelected ? null : jd.id)}
                              className="shrink-0 mt-0.5 p-0.5 rounded text-gray-500 hover:text-[#00529b]"
                              aria-label={isSelected ? 'Deselect JD' : 'Select JD for matching'}
                              title={isSelected ? 'Deselect' : 'Select for matching'}
                            >
                              {isSelected ? <CheckSquare className="w-5 h-5 text-[#00529b]" /> : <Square className="w-5 h-5" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 truncate">{d.title}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">{d.skillsCount} skills</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                className="inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 rounded-lg text-neutral-700 hover:bg-neutral-100 focus:ring-neutral-500 active:bg-neutral-200 text-sm gap-2 h-8 w-8 p-0"
                                title="View details & notes"
                                onClick={() => setDetailJDId(jd.id)}
                                aria-label="View details & notes"
                              >
                                <FileTextIcon className="w-4 h-4" aria-hidden />
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openPreview(jd.id, 'jd', d.title, jd)}
                                aria-label="Preview PDF"
                                title="View PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setOpenMenuJDId(openMenuJDId === jd.id ? null : jd.id)}
                                  aria-label="More"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                                {openMenuJDId === jd.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuJDId(null)} />
                                    <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                                      <button
                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        onClick={() => { handleDeleteJD(jd.id); setOpenMenuJDId(null); }}
                                      >
                                        <Trash2 className="w-4 h-4" /> Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalJDs != null && jds.length < totalJDs && (
                    <div className="px-4 pb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => loadMoreJDs()}
                        disabled={loadingStates.jds.isLoading}
                      >
                        {loadingStates.jds.isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        ) : null}
                        Load more job descriptions ({jds.length} of {totalJDs} loaded)
                      </Button>
                    </div>
                  )}
                </>
              )
            ) : filteredCVs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Users className="w-12 h-12 mb-3 text-gray-300" />
                <p className="font-medium text-gray-700">
                  {search ? 'No candidates match your search.' : activeFolder !== CATEGORY_ALL ? 'No candidates in this folder.' : 'No CVs yet.'}
                </p>
                <p className="text-sm mt-1">
                  {!search && activeFolder === CATEGORY_ALL && 'Upload CVs from the Upload tab.'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {paginatedCVs.map((cv) => {
                    const d = getCVDisplay(cv);
                    const isSelected = selectedCVs.includes(cv.id);
                    const noteCount = notesSummary[cv.id] ?? 0;
                    return (
                      <div
                        key={cv.id}
                        className={`rounded-xl border-2 p-4 transition-colors ${isSelected ? 'border-[#00529b] bg-[#00529b]/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleCV(cv.id)}
                            className="shrink-0 mt-0.5 p-0.5 rounded text-gray-500 hover:text-[#00529b]"
                            aria-label={isSelected ? 'Deselect' : 'Select'}
                          >
                            {isSelected ? <CheckSquare className="w-5 h-5 text-[#00529b]" /> : <Square className="w-5 h-5" />}
                          </button>
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => setDetailCVId(cv.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setDetailCVId(cv.id)}
                          >
                            <h3 className="font-semibold text-gray-900 line-clamp-2">{d.name}</h3>
                            <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{d.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{d.years} years • {d.skillsCount} skills</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                {d.category}
                              </span>
                              {noteCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" /> {noteCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setDetailCVId(cv.id)}
                              title="View details & notes"
                            >
                              <FileTextIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openPreview(cv.id, 'cv', d.name, cv)}
                              aria-label="Preview PDF"
                              title="View PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setOpenMenuCVId(openMenuCVId === cv.id ? null : cv.id)}
                                aria-label="More"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                              {openMenuCVId === cv.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuCVId(null)} />
                                  <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                                    <button
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                      onClick={() => handleDeleteCV(cv.id)}
                                    >
                                      <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(totalPages > 1 || (totalCVs != null && cvs.length < totalCVs)) && (
                  <div className="flex flex-col gap-2 px-4 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredCVs.length)} of {totalCVs != null ? totalCVs : filteredCVs.length}
                      </p>
                      {totalPages > 1 && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                    {totalCVs != null && cvs.length < totalCVs && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => loadMoreCVs()}
                        disabled={loadingStates.cvs.isLoading}
                      >
                        {loadingStates.cvs.isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        ) : null}
                        Load more candidates ({cvs.length} of {totalCVs} loaded)
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Detail panel: full CV + notes + View PDF */}
      {detailCVId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Candidate details & notes</h2>
            <button
              type="button"
              onClick={() => { setDetailCVId(null); setEditingNoteIndex(null); setNewNoteText(''); setEditNoteText(''); }}
              className="p-2 rounded-lg hover:bg-gray-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#00529b]" />
                <p className="text-gray-500 mt-2">Loading details...</p>
              </div>
            ) : detailCV ? (
              <>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <h3 className="text-base font-bold text-gray-900">
                    {detailCV.candidate?.full_name || detailCV.structured_info?.full_name || 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {detailCV.candidate?.job_title || detailCV.structured_info?.job_title || '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {detailCV.candidate?.years_of_experience ?? detailCV.structured_info?.years_of_experience ?? '—'} years
                    {' • '}
                    {(detailCV.candidate?.skills || detailCV.structured_info?.skills_sentences || []).length} skills
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Category: {detailCV.structured_info?.category ?? 'General'}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 w-full bg-[#00529b] hover:bg-[#003d73]"
                    onClick={() => {
                      const displayName = detailCV.candidate?.full_name || detailCV.filename || 'document';
                      const fileName = previewFileName({ filename: detailCV.filename, full_name: displayName }, 'cv');
                      setPreview({ id: detailCVId, type: 'cv', name: fileName });
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View full PDF
                  </Button>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const skills = detailCV.candidate?.skills || detailCV.structured_info?.skills_sentences || [];
                      return (
                        <>
                          {skills.slice(0, 30).map((s: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800">{s}</span>
                          ))}
                          {skills.length > 30 && <span className="text-xs text-gray-500">+{skills.length - 30} more</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Responsibilities</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {(detailCV.candidate?.responsibilities || detailCV.structured_info?.responsibility_sentences || []).slice(0, 15).map((r: string, i: number) => (
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
                                className="w-full text-sm border border-gray-300 rounded p-2 resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEditNote} disabled={savingNote}>
                                  {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  Save
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
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={() => { setEditingNoteIndex(i); setEditNoteText(note.note || ''); }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs text-red-600 hover:underline"
                                      onClick={() => handleDeleteNote(note.hr_user)}
                                    >
                                      Delete
                                    </button>
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
                      className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="mt-2 bg-[#00529b] hover:bg-[#003d73]"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNoteText.trim()}
                    >
                      {savingNote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                      Add note
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500">Failed to load details.</p>
            )}
          </div>
        </div>
      )}

      {/* Backdrop when detail panel is open */}
      {detailCVId && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => { setDetailCVId(null); setEditingNoteIndex(null); setNewNoteText(''); setEditNoteText(''); }}
          aria-hidden
        />
      )}
      {detailJDId && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setDetailJDId(null)}
          aria-hidden
        />
      )}

      {/* JD detail panel */}
      {detailJDId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">JD details</h2>
            <button
              type="button"
              onClick={() => setDetailJDId(null)}
              className="p-2 rounded-lg hover:bg-gray-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {detailJDLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#00529b]" />
                <p className="text-gray-500 mt-2">Loading JD...</p>
              </div>
            ) : detailJD ? (
              <>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <h3 className="text-base font-bold text-gray-900">
                    {detailJD.job_requirements?.job_title || detailJD.structured_info?.job_title || detailJD.filename || 'Untitled'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {detailJD.job_requirements?.years_of_experience ?? detailJD.structured_info?.years_of_experience ?? '—'} years
                    {' • '}
                    {(detailJD.job_requirements?.skills || detailJD.structured_info?.skills || []).length} skills
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 w-full bg-[#00529b] hover:bg-[#003d73]"
                    onClick={() => {
                      const title = detailJD.job_requirements?.job_title || detailJD.filename || 'document';
                      const fileName = previewFileName({ filename: detailJD.filename, job_title: title }, 'jd');
                      setPreview({ id: detailJDId, type: 'jd', name: fileName });
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View full PDF
                  </Button>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Required skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailJD.job_requirements?.skills || detailJD.structured_info?.skills || []).slice(0, 30).map((s: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Responsibilities</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {(detailJD.job_requirements?.responsibilities || detailJD.structured_info?.responsibilities || []).slice(0, 15).map((r: string, i: number) => (
                      <li key={i} className="line-clamp-2">{r}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-gray-500">Failed to load JD.</p>
            )}
          </div>
        </div>
      )}

      {/* How to match - short hint */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">How to run a match</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Select a folder (or keep &quot;All candidates&quot;) to filter candidates.</li>
          <li>Select one job description in the sidebar (or from the Job descriptions view).</li>
          <li>Select the candidates you want to match (use &quot;Select all on this page&quot; or tick individual cards).</li>
          <li>Click &quot;Match N with [JD name]&quot; to run AI matching and see results on the Match tab.</li>
        </ol>
      </div>

      {/* Preview modal: CV and JD both loaded as blob so PDF/DOCX display in iframe (same as CVs) */}
      {preview && (previewLoading || previewLoadError || !previewBlobUrl) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
            {previewLoadError ? (
              <>
                <p className="text-red-600">{previewLoadError}</p>
                <Button onClick={closePreview} variant="outline">Close</Button>
              </>
            ) : (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-[#00529b]" />
                <p className="text-gray-700">Loading document…</p>
              </>
            )}
          </div>
        </div>
      ) : preview && previewBlobUrl ? (
        <FilePreviewModal
          isOpen
          onClose={closePreview}
          fileUrl={previewBlobUrl}
          fileName={preview.name}
          fileId={preview.id}
          fileType="application/pdf"
          blob={previewBlob}
        />
      ) : null}

      {/* Selected CVs modal */}
      <Dialog open={showSelectedCVs} onOpenChange={setShowSelectedCVs}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-white">
          <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[#00529b]" />
              Selected CVs ({selectedCVList.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto py-2 min-h-0">
            {selectedCVList.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No CVs selected.</p>
            ) : (
              <ul className="space-y-1">
                {selectedCVList.map((cv) => {
                  const d = getCVDisplay(cv);
                  return (
                    <li
                      key={cv.id}
                      className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{d.name}</p>
                        <p className="text-xs text-gray-500 truncate">{d.title}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deselectCV(cv.id)}
                        className="shrink-0 text-gray-500 hover:text-red-600"
                        aria-label={`Remove ${d.name} from selection`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {selectedCVList.length > 0 && (
            <div className="border-t border-gray-200 pt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => { deselectAllCVs(); setShowSelectedCVs(false); }}>
                Clear all
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating selection popup (chat-like) */}
      {(selectedCVs.length > 0 || selectedJD) && (
        <div className="fixed bottom-4 right-4 z-50">
          {showSelectionPopup && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSelectionPopup(false)}
                aria-hidden
              />
              <div className="relative z-50 w-[320px] sm:w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Selection</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {selectedCVs.length} CV{selectedCVs.length !== 1 ? 's' : ''} selected
                      {selectedJD ? ' • 1 JD selected' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                    onClick={() => setShowSelectionPopup(false)}
                    aria-label="Close selection"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-[50vh] overflow-auto p-3">
                  {selectedCVList.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No CVs selected.</p>
                  ) : (
                    <ul className="space-y-1">
                      {selectedCVList.map((cv) => {
                        const d = getCVDisplay(cv);
                        return (
                          <li
                            key={cv.id}
                            className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">{d.name}</p>
                              <p className="text-xs text-gray-500 truncate">{d.title}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deselectCV(cv.id)}
                              className="shrink-0 text-gray-500 hover:text-red-600"
                              aria-label={`Remove ${d.name} from selection`}
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSelectedCVs(true)}
                    className="flex-1"
                  >
                    View all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { deselectAllCVs(); }}
                    disabled={selectedCVs.length === 0}
                    className="flex-1"
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowSelectionPopup((v) => !v)}
            className="relative z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#00529b] hover:bg-[#003d73] !text-white shadow-lg shadow-blue-900/20 transition-colors"
            aria-label="Open selection"
          >
            <ListChecks className="w-5 h-5 !text-white" />
            <span className="text-sm font-semibold !text-white">
              Selection ({selectedCVs.length})
            </span>
            {selectedJD && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20 !text-white">
                JD ✓
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
