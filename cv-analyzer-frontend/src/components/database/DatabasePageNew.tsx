'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  User as UserIcon,
  MapPin,
  Building2,
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
import { Skeleton, LoadingCard } from '@/components/ui/loading';

const FilePreviewModal = dynamic(
  () => import('@/components/ui/file-preview-modal').then((mod) => mod.FilePreviewModal),
  { ssr: false }
);

const ITEMS_PER_PAGE = 50;
const CATEGORY_ALL = '__all__';

function getCVDisplay(cv: CVListItem) {
  return {
    name: cv.full_name || cv.filename || 'Unknown',
    title: cv.job_title || '—',
    years: cv.years_of_experience ?? '—',
    skillsCount: cv.skills_count ?? 0,
    category: (cv as CVListItem & { category?: string }).category ?? 'General',
    filename: cv.filename || '',
    expectedSalary: (cv as any).job_application?.expected_salary ?? (cv as any).expected_salary ?? '—',
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
  const [folderCVs, setFolderCVs] = useState<Record<string, { items: CVListItem[]; total: number | null }>>({});
  const [loadingFolderCVs, setLoadingFolderCVs] = useState<Record<string, boolean>>({});
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
  const [serverSearchCVs, setServerSearchCVs] = useState<{ items: CVListItem[]; total: number | null }>({
    items: [],
    total: null,
  });
  const [serverSearching, setServerSearching] = useState(false);

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

  const loadFolderCVPage = async (category: string, offset: number) => {
    setLoadingFolderCVs((s) => ({ ...s, [category]: true }));
    try {
      const res = await api.listCVs({ category, limit: ITEMS_PER_PAGE, offset });
      setFolderCVs((s) => {
        const prev = s[category]?.items ?? [];
        const nextItems = offset === 0 ? res.cvs : [...prev, ...res.cvs];
        const nextTotal = typeof res.total === 'number' ? res.total : (s[category]?.total ?? null);
        return { ...s, [category]: { items: nextItems, total: nextTotal } };
      });
    } catch {
      // swallow here; UI already handles "no candidates" states
    } finally {
      setLoadingFolderCVs((s) => ({ ...s, [category]: false }));
    }
  };

  useEffect(() => {
    if (activeFolder === CATEGORY_ALL) return;
    if ((folderCVs[activeFolder]?.items?.length ?? 0) > 0) return;
    loadFolderCVPage(activeFolder, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder]);

  const isServerSearchMode = !!search.trim();

  // Server-side search across ALL CVs (avoids missing results due to local 200/50-item pagination)
  useEffect(() => {
    if (!isServerSearchMode) {
      setServerSearchCVs({ items: [], total: null });
      setServerSearching(false);
      return;
    }

    let cancelled = false;
    setServerSearching(true);
    const t = setTimeout(() => {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const category = activeFolder === CATEGORY_ALL ? undefined : activeFolder;
      api
        .listCVs({ q: search.trim(), category, limit: ITEMS_PER_PAGE, offset })
        .then((res) => {
          if (cancelled) return;
          setServerSearchCVs({ items: res.cvs ?? [], total: typeof res.total === 'number' ? res.total : null });
        })
        .catch(() => {
          if (cancelled) return;
          setServerSearchCVs({ items: [], total: 0 });
        })
        .finally(() => {
          if (cancelled) return;
          setServerSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, activeFolder, page, isServerSearchMode]);

  const filteredCVs = useMemo(() => {
    if (isServerSearchMode) {
      // In server-search mode, `serverSearchCVs.items` is already the authoritative page list.
      return serverSearchCVs.items;
    }

    const source = activeFolder === CATEGORY_ALL ? cvs : (folderCVs[activeFolder]?.items ?? []);
    let list = source;
    if (activeFolder !== CATEGORY_ALL) {
      // When using server-side folder pagination, the list is already scoped by folder.
    }
    if (notesFilter === 'with_notes') {
      list = list.filter((cv) => (notesSummary[cv.id] ?? 0) > 0);
    } else if (notesFilter === 'without_notes') {
      list = list.filter((cv) => (notesSummary[cv.id] ?? 0) === 0);
    }
    return list;
  }, [cvs, activeFolder, folderCVs, isServerSearchMode, serverSearchCVs.items, notesFilter, notesSummary]);

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

  const activeTotalCount =
    isServerSearchMode
      ? serverSearchCVs.total
      : activeFolder === CATEGORY_ALL
        ? totalCVs
        : (categories[activeFolder] ?? folderCVs[activeFolder]?.total ?? null);

  const activeLoadedCount =
    isServerSearchMode
      ? serverSearchCVs.items.length
      : activeFolder === CATEGORY_ALL
        ? cvs.length
        : (folderCVs[activeFolder]?.items?.length ?? 0);

  // When not searching, the server knows the true total for folders; client may have partial list loaded.
  const totalItemsForPaging = activeTotalCount ?? filteredCVs.length;
  const totalPages = Math.ceil(totalItemsForPaging / ITEMS_PER_PAGE) || 1;
  const paginatedCVs = useMemo(() => {
    if (isServerSearchMode) return filteredCVs;
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

  const loadMoreActiveFolder = async () => {
    // In server-search mode, pagination is handled by (page -> API fetch) not by loading more into memory.
    if (isServerSearchMode) return;
    if (activeFolder === CATEGORY_ALL) return loadMoreCVs();
    return loadFolderCVPage(activeFolder, activeLoadedCount);
  };

  const handleNextPage = async () => {
    if (isServerSearchMode) {
      if (page < totalPages) setPage((p) => Math.min(totalPages, p + 1));
      return;
    }
    const nextPageEndIndex = page * ITEMS_PER_PAGE;
    const hasNextPageLocally = filteredCVs.length > nextPageEndIndex;

    // If we already have enough items locally to render the next page, just advance.
    if (hasNextPageLocally) {
      setPage((p) => Math.min(totalPages, p + 1));
      return;
    }

    // Otherwise, fetch more from server if we know there's more to load, then advance.
    if (activeTotalCount != null && activeLoadedCount < activeTotalCount) {
      await loadMoreActiveFolder();
      setPage((p) => Math.min(totalPages, p + 1));
      return;
    }

    // Fallback: if totals are unknown, still allow advancing within computed pages.
    if (page < totalPages) {
      setPage((p) => Math.min(totalPages, p + 1));
    }
  };

  const pagingStart = paginatedCVs.length > 0 ? (page - 1) * ITEMS_PER_PAGE + 1 : 0;
  const pagingEnd = paginatedCVs.length > 0 ? (page - 1) * ITEMS_PER_PAGE + paginatedCVs.length : 0;

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
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
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
                <ListChecks className="w-3.5 h-3.5 text-primary" />
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
              className="w-full min-w-0 pl-9 pr-9 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {view === 'candidates' && serverSearching && search.trim() ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : null}
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
                className="inline-flex items-center gap-2 bg-gradient-primary text-white border-0 shadow-lg shadow-blue-900/20"
              >
                <Target className="w-4 h-4 text-white" />
                <span className="text-white">
                  Match {selectedCVs.length} with {selectedJDDisplay ? getJDDisplay(selectedJDDisplay).title : 'JD'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4 lg:gap-6">
        {/* Sidebar: Folders + JDs - stacks on mobile */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 lg:gap-6 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-4 h-fit lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Folders
            </h2>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setActiveFolder(CATEGORY_ALL); setPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${activeFolder === CATEGORY_ALL ? 'bg-gradient-primary text-white shadow-lg shadow-blue-900/20' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <span className={activeFolder === CATEGORY_ALL ? 'text-white' : ''}>All candidates</span>
                <span className={activeFolder === CATEGORY_ALL ? 'text-white/90' : 'text-gray-500'}>{totalCVs ?? cvs.length}</span>
              </button>
              {loadingCategories ? (
                <div className="space-y-2 py-2">
                  <Skeleton width="100%" height="32px" className="rounded-lg" />
                  <Skeleton width="100%" height="32px" className="rounded-lg" />
                  <Skeleton width="100%" height="32px" className="rounded-lg" />
                </div>
              ) : (
                folderList.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveFolder(cat); setPage(1); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${activeFolder === cat ? 'bg-gradient-primary text-white shadow-lg shadow-blue-900/20' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                  >
                    <span className={`truncate ${activeFolder === cat ? 'text-white' : ''}`}>{cat}</span>
                    <span className={activeFolder === cat ? 'text-white/90' : 'text-gray-500'}>{count}</span>
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${selectedJD === jd.id ? 'bg-[neutral-900]/10 text-primary font-medium' : 'hover:bg-gray-100'
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
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[neutral-900] focus:border-[neutral-900]"
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
              {activeTotalCount != null && activeTotalCount > activeLoadedCount
                ? `${filteredCVs.length} of ${activeTotalCount} candidate${activeTotalCount !== 1 ? 's' : ''}`
                : `${filteredCVs.length} candidate${filteredCVs.length !== 1 ? 's' : ''}`}
              {activeFolder !== CATEGORY_ALL && ` in ${activeFolder}`}
            </p>
          )}
          <div className="flex-1 overflow-auto rounded-2xl border border-gray-200/60 bg-white/60 backdrop-blur-sm shadow-sm">
            {view === 'jobs' ? (
              loadingStates.jds.isLoading && jds.length === 0 ? (
                <div className="grid grid-cols-1 gap-4 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <LoadingCard key={i} type="jd" />
                  ))}
                </div>
              ) : filteredJDs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <FileText className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="font-medium text-gray-700">{search ? 'No job descriptions match your search.' : 'No job descriptions yet.'}</p>
                  <p className="text-sm mt-1">Upload JDs from the Upload tab.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 p-4">
                    {filteredJDs.map((jd) => {
                      const d = getJDDisplay(jd);
                      const isSelected = selectedJD === jd.id;
                      return (
                        <div
                          key={jd.id}
                          className={`rounded-2xl border p-5 transition-colors shadow-sm ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={() => selectJD(isSelected ? null : jd.id)}
                              className="shrink-0 mt-0.5 p-0.5 rounded text-gray-500 hover:text-primary"
                              aria-label={isSelected ? 'Deselect JD' : 'Select JD for matching'}
                              title={isSelected ? 'Deselect' : 'Select for matching'}
                            >
                              {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                            </button>
                            <div
                              className="min-w-0 flex-1 cursor-pointer"
                              onClick={() => setDetailJDId(jd.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setDetailJDId(jd.id)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">{d.title}</h3>
                                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                    {jd.filename || 'Job description'}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                      {d.skillsCount} skills
                                    </span>
                                    {jd.upload_date && jd.upload_date !== 'Unknown' && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                        {new Date(jd.upload_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-center gap-2">
                                  <div className="w-14 h-14 rounded-xl bg-gradient-primary/10 border border-blue-100 flex items-center justify-center shadow-inner">
                                    <FileText className="w-7 h-7 text-blue-600" />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0 border-l border-gray-100 pl-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-full hover:bg-blue-50 hover:text-blue-600"
                                onClick={() => openPreview(jd.id, 'jd', d.title, jd)}
                                title="View Raw Document (PDF/DOCX)"
                              >
                                <FileTextIcon className="w-4.5 h-4.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-full hover:bg-blue-50 hover:text-blue-600"
                                title="View Full Text & Analysis"
                                onClick={() => setDetailJDId(jd.id)}
                              >
                                <Eye className="w-4.5 h-4.5" />
                              </Button>
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 rounded-full hover:bg-gray-100"
                                  onClick={() => setOpenMenuJDId(openMenuJDId === jd.id ? null : jd.id)}
                                  aria-label="More"
                                >
                                  <MoreVertical className="w-4.5 h-4.5" />
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
            ) : (loadingStates.cvs.isLoading || loadingFolderCVs[activeFolder]) && paginatedCVs.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingCard key={i} type="cv" />
                ))}
              </div>
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
                <div className="grid grid-cols-1 gap-4 p-4">
                  {paginatedCVs.map((cv) => {
                    const d = getCVDisplay(cv);
                    const isSelected = selectedCVs.includes(cv.id);
                    const noteCount = notesSummary[cv.id] ?? 0;
                    return (
                      <div
                        key={cv.id}
                        className={`rounded-2xl border p-5 transition-colors shadow-sm ${isSelected ? 'border-[#00529b] bg-blue-50/30' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => toggleCV(cv.id)}
                            className="shrink-0 mt-0.5 p-0.5 rounded text-gray-500 hover:text-primary"
                            aria-label={isSelected ? 'Deselect' : 'Select'}
                          >
                            {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                          </button>
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => setDetailCVId(cv.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setDetailCVId(cv.id)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">{d.name}</h3>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                    {d.years}y
                                  </span>
                                  {noteCount > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#00529b] border border-blue-200 inline-flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> {noteCount}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-700 mt-1 line-clamp-2">{d.title}</div>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="text-[10px] font-bold text-[#00529b] bg-blue-50 px-2 py-1 rounded-md border border-blue-100 uppercase tracking-tighter">
                                    Applied for
                                  </div>
                                  <div className="text-sm font-bold text-gray-900 truncate max-w-[300px]">
                                    {cv.applied_job_title || 'General Database'}
                                  </div>
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-xl bg-gradient-primary/10 border border-blue-100 flex items-center justify-center shadow-inner">
                                  <UserIcon className="w-7 h-7 text-[#00529b]" />
                                </div>
                                {d.expectedSalary !== '—' && (
                                  <div className="flex flex-col items-center mt-1">
                                    <div className="text-[9px] uppercase tracking-tighter text-gray-400 font-bold leading-none mb-0.5">
                                      Exp. Salary
                                    </div>
                                    <div className="text-sm font-black text-emerald-600 whitespace-nowrap">
                                      {d.expectedSalary}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                {d.category}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                {d.skillsCount} skills
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 border-l border-gray-100 pl-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-full hover:bg-blue-50 hover:text-[#00529b]"
                              onClick={() => openPreview(cv.id, 'cv', d.name, cv)}
                              title="View Raw Document (PDF/DOCX)"
                            >
                              <FileTextIcon className="w-4.5 h-4.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-full hover:bg-blue-50 hover:text-[#00529b]"
                              onClick={() => setDetailCVId(cv.id)}
                              title="View Full Text & Analysis"
                            >
                              <Eye className="w-4.5 h-4.5" />
                            </Button>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-full hover:bg-gray-100"
                                onClick={() => setOpenMenuCVId(openMenuCVId === cv.id ? null : cv.id)}
                                aria-label="More"
                              >
                                <MoreVertical className="w-4.5 h-4.5" />
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

                {(totalPages > 1 || (activeTotalCount != null && activeLoadedCount < activeTotalCount)) && (
                  <div className="flex flex-col gap-2 px-4 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {pagingStart}–{pagingEnd} of {totalItemsForPaging}
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
                            onClick={handleNextPage}
                            disabled={
                              page >= totalPages &&
                              !(activeTotalCount != null && activeLoadedCount < activeTotalCount)
                            }
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Detail panel: full CV + notes + View PDF */}
      {detailCVId && (
        <div className="fixed inset-y-0 right-0 z-[999] w-full sm:max-w-lg bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Candidate details & notes</h2>
          </div>
          <button
            type="button"
            onClick={() => { setDetailCVId(null); setEditingNoteIndex(null); setNewNoteText(''); setEditNoteText(''); }}
            className="fixed top-[76px] right-3 z-[1005] p-2 rounded-full bg-gradient-primary text-white shadow-lg shadow-blue-900/20 transition-all duration-200 hover:scale-110"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                  {(() => {
                    const es = detailCV.job_application?.expected_salary || 
                               detailCV.candidate?.expected_salary || 
                               detailCV.structured_info?.expected_salary;
                    return es ? (
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        Expected Salary: {es}
                      </p>
                    ) : null;
                  })()}
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 w-full bg-gradient-primary !text-white border-0 shadow-lg shadow-blue-900/20 hover:opacity-95"
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
                            <span key={i} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-800">
                              {i + 1}. {s}
                            </span>
                          ))}
                          {skills.length > 30 && <span className="text-xs text-gray-500">+{skills.length - 30} more</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Responsibilities</h4>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                    {(detailCV.candidate?.responsibilities || detailCV.structured_info?.responsibility_sentences || []).slice(0, 15).map((r: string, i: number) => (
                      <li key={i}>
                        <span className="line-clamp-2">{r}</span>
                      </li>
                    ))}
                  </ol>
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
                                <Button
                                  size="sm"
                                  onClick={handleSaveEditNote}
                                  disabled={savingNote}
                                  className="bg-gradient-primary text-white shadow-lg shadow-blue-900/20"
                                >
                                  {savingNote ? <Loader2 className="w-4 h-4 animate-spin text-white mr-1" /> : <Save className="w-4 h-4 text-white mr-1" />}
                                  <span className="text-white">Save</span>
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
                      className="mt-2 bg-gradient-primary text-white shadow-lg shadow-blue-900/20"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNoteText.trim()}
                    >
                      {savingNote ? <Loader2 className="w-4 h-4 animate-spin mr-2 text-white" /> : <MessageSquare className="w-4 h-4 mr-2 text-white" />}
                      <span className="text-white">Add note</span>
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
          className="fixed inset-0 z-[998] bg-black/30"
          onClick={() => { setDetailCVId(null); setEditingNoteIndex(null); setNewNoteText(''); setEditNoteText(''); }}
          aria-hidden
        />
      )}
      {detailJDId && (
        <div
          className="fixed inset-0 z-[998] bg-black/30"
          onClick={() => setDetailJDId(null)}
          aria-hidden
        />
      )}

      {/* JD detail panel */}
      {detailJDId && (
        <div className="fixed inset-y-0 right-0 z-[999] w-full sm:max-w-lg bg-white border-l border-gray-200 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">JD details</h2>
          </div>
          <button
            type="button"
            onClick={() => setDetailJDId(null)}
            className="fixed top-[76px] right-3 z-[1005] p-2 rounded-full bg-gradient-primary text-white shadow-lg shadow-blue-900/20 transition-all duration-200 hover:scale-110"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {detailJDLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                    className="mt-3 w-full bg-gradient-primary !text-white border-0 shadow-lg shadow-blue-900/20 hover:opacity-95"
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
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
              <ListChecks className="w-5 h-5 text-primary" />
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
            className="relative z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-primary !text-white shadow-lg shadow-blue-900/20 transition-colors"
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
