'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackerApi } from '@/lib/trackerApi';
import { useAuthStore } from '@/stores/authStore';
import type { TrackerApplication, TrackerCandidate, TrackerJobOpening } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';

/* ─────────────────────────── constants ───────────────────────────── */

type ViewMode = 'jobOpenings' | 'candidateProfiles';

const statusOptions = [
  'MRF Pending', 'PO Pending', 'Selected', 'Security Clearance Pending',
  'Offer Released', 'Offer Accepted', 'Offer Declined', 'Serving Notice Period',
  'Visa Pending', 'Visa Rejected', 'Joining Pending', 'Joined',
];
const jobStatusOptions = ['Open', 'Profiles Submitted', 'Interview Scheduled', 'Feedback Pending', 'On Hold', 'Closed', 'Cancelled'];
const recruiterOptions = ['Asif', 'Abdul Baqi', 'Arsalan', 'Advith', 'Shalini', 'Mary', 'Faraz'];
const accountManagerOptions = ['Moin', 'Harris', 'Des', 'Youssef', 'Mustafa'];

/* ─────────────────────────── helpers ─────────────────────────────── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

function statusColor(s: string) {
  const k = s.toLowerCase();
  // Candidate profile statuses
  if (k.includes('joined') && !k.includes('pending')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (k.includes('visa rejected') || k.includes('offer declined')) return 'bg-red-100 text-red-800 border-red-200';
  if (k.includes('offer released') || k.includes('offer accepted')) return 'bg-green-100 text-green-800 border-green-200';
  if (k.includes('selected')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (k.includes('security') || k.includes('clearance')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (k.includes('visa')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (k.includes('notice')) return 'bg-purple-100 text-purple-800 border-purple-200';
  // Requirement status statuses
  if (k === 'open') return 'bg-green-100 text-green-800 border-green-200';
  if (k === 'profiles submitted') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (k === 'interview scheduled') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (k === 'feedback pending') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (k === 'on hold') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (k === 'closed') return 'bg-gray-200 text-gray-700 border-gray-300';
  if (k === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${statusColor(label)}`}>
      {label}
    </span>
  );
}


/* ─────────────────────────── dialogs ─────────────────────────────── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function FormInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-white text-gray-900 placeholder:text-gray-400 border-gray-300 focus:border-[#00529b] focus:ring-[#00529b]"
    />
  );
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] [color-scheme:light]"
      />
    </div>
  );
}

function EditJobOpeningDialog({ job, onClose, onSaved }: { job: TrackerJobOpening | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const [reqDate, setReqDate] = useState('');
  const [role, setRole] = useState('');
  const [client, setClient] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [status, setStatus] = useState('Open');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setReqDate(job.req_date ? String(job.req_date) : '');
    setRole(job.title || '');
    setClient(job.location || '');
    setRecruiter(job.hiring_manager || '');
    setAccountManager(job.department || '');
    setStatus(job.status || 'Open');
  }, [job]);

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white text-gray-900">
        <DialogHeader><DialogTitle className="text-[#00529b]">Edit Requirement</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={reqDate} onChange={setReqDate} label="Requirement date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Role"><FormInput value={role} onChange={setRole} placeholder="e.g. DevOps Engineer" /></FieldRow></div>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue /></SelectTrigger>
              <SelectContent>{jobStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Recruiter">
            <Select value={recruiter} onValueChange={setRecruiter}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiterOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Account Manager">
            <Select value={accountManager} onValueChange={setAccountManager}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select AM" /></SelectTrigger>
              <SelectContent>{accountManagerOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!token || !job || !role.trim() || saving} onClick={async () => {
            if (!token || !job) return; setSaving(true);
            try {
              await trackerApi.updateJobOpening(token, job.id, {
                title: role.trim(),
                location: client.trim() || undefined,
                status,
                hiring_manager: recruiter.trim() || undefined,
                department: accountManager.trim() || undefined,
                req_date: reqDate || null,
              } as any);
              onSaved(); onClose();
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditApplicationDialog({
  app, cand, onClose, onSaved,
}: { app: TrackerApplication | null; cand: TrackerCandidate | null; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const [appliedDate, setAppliedDate] = useState('');
  const [position, setPosition] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('MRF Pending');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!app) return;
    setAppliedDate(app.applied_date ? String(app.applied_date) : '');
    setPosition(app.position || ''); setClient(app.client || '');
    setStatus(app.status || 'MRF Pending'); setRecruiter(app.recruiter || '');
    setAccountManager(app.account_manager || ''); setComment(app.comment || '');
  }, [app]);

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">Edit Application</DialogTitle>
          {cand && <p className="text-sm text-gray-500 mt-1">Candidate: <span className="font-semibold text-gray-800">{cand.name}</span></p>}
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={appliedDate} onChange={setAppliedDate} label="Application date" /></FieldRow>
          <FieldRow label="Position"><FormInput value={position} onChange={setPosition} placeholder="e.g. DevOps Engineer" /></FieldRow>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Recruiter">
            <Select value={recruiter} onValueChange={setRecruiter}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiterOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Account Manager">
            <Select value={accountManager} onValueChange={setAccountManager}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select AM" /></SelectTrigger>
              <SelectContent>{accountManagerOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <div className="sm:col-span-2">
            <FieldRow label="Comment">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add notes or comments..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] resize-none"
              />
            </FieldRow>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!token || !app || saving} onClick={async () => {
            if (!token || !app) return; setSaving(true);
            try {
              await trackerApi.updateApplication(token, app.id, {
                applied_date: appliedDate || null, position: position || null, client: client || null,
                status: status || null, recruiter: recruiter || null, account_manager: accountManager || null,
                comment: comment || null,
              });
              onSaved(); onClose();
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewJobOpeningDialog({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [role, setRole] = useState('');
  const [client, setClient] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [status, setStatus] = useState('Open');
  const [saving, setSaving] = useState(false);

  const reset = () => { setReqDate(''); setRole(''); setClient(''); setRecruiter(''); setAccountManager(''); setStatus('Open'); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#00529b] hover:bg-[#003d73] text-white gap-1.5"><Plus className="w-4 h-4" /> New Requirement</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-white text-gray-900">
        <DialogHeader><DialogTitle className="text-[#00529b]">Create Requirement</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={reqDate} onChange={setReqDate} label="Requirement date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Role"><FormInput value={role} onChange={setRole} placeholder="e.g. DevOps Engineer" /></FieldRow></div>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue /></SelectTrigger>
              <SelectContent>{jobStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Recruiter">
            <Select value={recruiter} onValueChange={setRecruiter}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiterOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Account Manager">
            <Select value={accountManager} onValueChange={setAccountManager}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select AM" /></SelectTrigger>
              <SelectContent>{accountManagerOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!role.trim() || !token || saving} onClick={async () => {
            if (!token) return; setSaving(true);
            try {
              await trackerApi.createJobOpening(token, {
                title: role.trim(),
                location: client.trim() || undefined,
                status,
                hiring_manager: recruiter.trim() || undefined,
                department: accountManager.trim() || undefined,
                req_date: reqDate || null,
              } as any);
              setOpen(false); reset(); onCreated();
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewCandidateDialog({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  // candidate fields
  const [name, setName] = useState('');
  // application fields
  const [appliedDate, setAppliedDate] = useState('');
  const [position, setPosition] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('MRF Pending');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setAppliedDate(''); setPosition(''); setClient('');
    setStatus('MRF Pending'); setRecruiter(''); setAccountManager(''); setComment('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#00529b] hover:bg-[#003d73] text-white gap-1.5"><Plus className="w-4 h-4" /> New Candidate</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-[#00529b]">Add Candidate</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={appliedDate} onChange={setAppliedDate} label="Date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Candidate Name"><FormInput value={name} onChange={setName} placeholder="e.g. Ahmed Hassan" /></FieldRow></div>
          <FieldRow label="Position"><FormInput value={position} onChange={setPosition} placeholder="e.g. DevOps Engineer" /></FieldRow>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue /></SelectTrigger>
              <SelectContent>{statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Recruiter">
            <Select value={recruiter} onValueChange={setRecruiter}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>{recruiterOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Account Manager">
            <Select value={accountManager} onValueChange={setAccountManager}>
              <SelectTrigger className="bg-white border-gray-300"><SelectValue placeholder="Select AM" /></SelectTrigger>
              <SelectContent>{accountManagerOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
          <div className="sm:col-span-2">
            <FieldRow label="Comment">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add notes or comments..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] resize-none"
              />
            </FieldRow>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name.trim() || !token || saving} onClick={async () => {
            if (!token) return; setSaving(true);
            try {
              // Create candidate first, then create application record with all tracking fields
              const cand = await trackerApi.createCandidate(token, { name: name.trim() } as any);
              await trackerApi.createApplication(token, {
                candidate_id: cand.id,
                applied_date: appliedDate || undefined,
                position: position.trim() || undefined,
                client: client.trim() || undefined,
                status,
                recruiter: recruiter || undefined,
                account_manager: accountManager || undefined,
                comment: comment.trim() || undefined,
              });
              setOpen(false); reset(); onCreated();
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── main page ───────────────────────────── */

export default function TrackerPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const canWrite = user?.role === 'admin' || user?.role === 'manager';
  const [view, setView] = useState<ViewMode>('jobOpenings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [jobOpenings, setJobOpenings] = useState<TrackerJobOpening[]>([]);
  const [candidates, setCandidates] = useState<TrackerCandidate[]>([]);
  const [applications, setApplications] = useState<TrackerApplication[]>([]);

  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [editJob, setEditJob] = useState<TrackerJobOpening | null>(null);
  const [editApp, setEditApp] = useState<{ app: TrackerApplication; cand: TrackerCandidate } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'job' | 'candidate' | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const [jobs, cands, apps] = await Promise.all([
        trackerApi.listJobOpenings(token), trackerApi.listCandidates(token), trackerApi.listApplications(token),
      ]);
      setJobOpenings(jobs); setCandidates(cands); setApplications(apps);
    } catch (e: any) { setError(e?.message || 'Failed to load data'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const candById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  // Map candidate_id → first application (a candidate may appear multiple times if they have
  // multiple applications; for the flat table we show one row per candidate using their latest app)
  const appByCandId = useMemo(() => {
    const m = new Map<string, TrackerApplication>();
    // iterate oldest→newest so the latest app wins
    [...applications].reverse().forEach((a) => m.set(a.candidate_id, a));
    return m;
  }, [applications]);

  const candidateRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates
      .map((cand) => ({ cand, app: appByCandId.get(cand.id) ?? null }))
      .filter(({ app }) => filterStatus === 'all' || (app?.status ?? '') === filterStatus)
      .filter(({ cand, app }) => {
        if (!s) return true;
        return (
          cand.name.toLowerCase().includes(s) ||
          (app?.position || '').toLowerCase().includes(s) ||
          (app?.client || '').toLowerCase().includes(s) ||
          (app?.recruiter || '').toLowerCase().includes(s) ||
          (app?.account_manager || '').toLowerCase().includes(s) ||
          (app?.comment || '').toLowerCase().includes(s)
        );
      });
  }, [candidates, appByCandId, filterStatus, search]);

  const visibleJobOpenings = useMemo(() => {
    const s = search.trim().toLowerCase();
    return jobOpenings
      .filter((j) => filterStatus === 'all' || (j.status ?? '') === filterStatus)
      .filter((j) => {
        if (!s) return true;
        return (
          (j.title || '').toLowerCase().includes(s) ||
          (j.location || '').toLowerCase().includes(s) ||
          (j.hiring_manager || '').toLowerCase().includes(s) ||
          (j.department || '').toLowerCase().includes(s)
        );
      });
  }, [jobOpenings, filterStatus, search]);


  /* ── sidebar ── */
  const SidebarContent = (
    <>
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-[15px] font-bold text-white leading-tight">Candidate Tracker</div>
              <div className="text-[11px] text-blue-200 mt-0.5">Recruiting workspace</div>
            </div>
          )}
        </div>
      </div>

      <nav className="px-3 pt-4 space-y-1 flex-1">
        {([
          { id: 'jobOpenings', label: 'Requirement Status', icon: Briefcase, count: jobOpenings.length },
          { id: 'candidateProfiles', label: 'Candidate Status', icon: Users, count: candidates.length },
        ] as const).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => { setView(id); setMobileSidebarOpen(false); setFilterStatus('all'); setSearch(''); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
              view === id ? 'bg-white text-[#00529b] shadow font-semibold' : 'text-white/90 hover:bg-white/10'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {sidebarOpen && (
              <span className="flex-1 text-sm">{label}</span>
            )}
            {sidebarOpen && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${view === id ? 'bg-[#00529b]/10 text-[#00529b]' : 'bg-white/20 text-white'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 pb-4 mt-auto">
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm transition-colors"
        >
          {sidebarOpen ? <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[#f8fafc]">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-gradient-to-b from-[#00529b] to-[#003060] transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-[64px]'
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-72 flex flex-col bg-gradient-to-b from-[#00529b] to-[#003060] shadow-2xl z-10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#00529b] transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Candidate Tracker</span>
            <div className="ml-auto flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin text-[#00529b]" />}
              <button onClick={refresh} disabled={loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#00529b] transition-colors" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page header */}
        <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {view === 'jobOpenings' ? 'Requirement Status' : 'Candidate Status'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {view === 'jobOpenings'
                  ? `${jobOpenings.length} requirement${jobOpenings.length !== 1 ? 's' : ''}${canWrite ? ' · click Edit to update any row' : ''}`
                  : `${candidateRows.length} candidate${candidateRows.length !== 1 ? 's' : ''}${canWrite ? ' · hover a row and click Edit to update' : ''}`}
              </p>
              {!canWrite && (
                <p className="text-xs text-amber-700 mt-1">
                  Read-only access (ask your manager to update)
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canWrite ? (
                view === 'jobOpenings'
                  ? <NewJobOpeningDialog onCreated={refresh} />
                  : <NewCandidateDialog onCreated={refresh} />
              ) : null}
              <button
                disabled={!token || loading}
                onClick={async () => {
                  if (!token) return;
                  const blob = view === 'jobOpenings'
                    ? await trackerApi.exportJobOpeningsXlsx(token)
                    : await trackerApi.exportCandidatesXlsx(token);
                  downloadBlob(blob, view === 'jobOpenings' ? 'job_openings.xlsx' : 'candidates.xlsx');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[220px] bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value="all">All Status</SelectItem>
                {(view === 'jobOpenings' ? jobStatusOptions : statusOptions).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={view === 'jobOpenings' ? 'Search role, client, recruiter…' : 'Search name, position, client…'}
                className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00529b]/30 focus:border-[#00529b]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content area — scrollable */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
            </div>
          )}

          {view === 'jobOpenings' ? (
            /* ────── Requirement Status table ────── */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3.5 text-left w-[120px]">Date</th>
                      <th className="px-4 py-3.5 text-left">Role</th>
                      <th className="px-4 py-3.5 text-left w-[150px]">Client</th>
                      <th className="px-4 py-3.5 text-left w-[160px]">Recruiter</th>
                      <th className="px-4 py-3.5 text-left w-[160px]">Account Manager</th>
                      <th className="px-4 py-3.5 text-left w-[200px]">Status</th>
                      <th className="px-4 py-3.5 text-right w-[80px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleJobOpenings.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-500">No requirements yet. Create one above.</td></tr>
                    ) : visibleJobOpenings.map((j) => (
                      <tr key={j.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {j.req_date ? String(j.req_date) : <span className="text-gray-400">—</span>}
                        </td>
                        {/* Role — stored in title */}
                        <td className="px-4 py-3 font-semibold text-gray-900">{j.title}</td>
                        {/* Client — stored in location */}
                        <td className="px-4 py-3 text-gray-600">{j.location || <span className="text-gray-400">—</span>}</td>
                        {/* Recruiter — stored in hiring_manager */}
                        <td className="px-4 py-3">
                          {canWrite ? (
                            <Select value={j.hiring_manager || ''} onValueChange={async (v: string) => {
                              if (!token) return;
                              setRowBusy((s) => ({ ...s, [j.id]: true }));
                              try { await trackerApi.updateJobOpening(token, j.id, { hiring_manager: v } as any); await refresh(); }
                              finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                            }}>
                              <SelectTrigger className="w-full max-w-[150px] h-8 text-xs border-gray-200 bg-white" disabled={!!rowBusy[j.id]}>
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>{recruiterOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-gray-700">{j.hiring_manager || '—'}</span>
                          )}
                        </td>
                        {/* Account Manager — stored in department */}
                        <td className="px-4 py-3">
                          {canWrite ? (
                            <Select value={j.department || ''} onValueChange={async (v: string) => {
                              if (!token) return;
                              setRowBusy((s) => ({ ...s, [j.id]: true }));
                              try { await trackerApi.updateJobOpening(token, j.id, { department: v } as any); await refresh(); }
                              finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                            }}>
                              <SelectTrigger className="w-full max-w-[150px] h-8 text-xs border-gray-200 bg-white" disabled={!!rowBusy[j.id]}>
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>{accountManagerOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-gray-700">{j.department || '—'}</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge label={j.status} />
                            {canWrite ? (
                              <Select value={j.status} onValueChange={async (v: string) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { status: v } as any); await refresh(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}>
                                <SelectTrigger className="w-[32px] h-7 p-0 border-transparent bg-transparent hover:border-gray-300" disabled={!!rowBusy[j.id]}>
                                  <span className="sr-only">Change status</span>
                                  <Pencil className="w-3 h-3 mx-auto text-gray-400" />
                                </SelectTrigger>
                                <SelectContent>{jobStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            {canWrite ? (
                              <>
                                <button
                                  onClick={() => setEditJob(j)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(j.id); setConfirmDeleteType('job'); }}
                                  disabled={!!rowBusy[j.id]}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ────── Candidate Status table ────── */
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3.5 text-left w-[120px]">Date</th>
                      <th className="px-4 py-3.5 text-left w-[160px]">Candidate Name</th>
                      <th className="px-4 py-3.5 text-left w-[150px]">Position</th>
                      <th className="px-4 py-3.5 text-left w-[140px]">Client</th>
                      <th className="px-4 py-3.5 text-left w-[200px]">Status</th>
                      <th className="px-4 py-3.5 text-left w-[150px]">Recruiter</th>
                      <th className="px-4 py-3.5 text-left w-[160px]">Account Manager</th>
                      <th className="px-4 py-3.5 text-left">Comment</th>
                      <th className="px-4 py-3.5 text-right w-[80px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {candidateRows.length === 0 ? (
                      <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-500">No candidates yet. Add one above.</td></tr>
                    ) : candidateRows.map(({ cand, app }) => (
                      <tr key={cand.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {app?.applied_date ? String(app.applied_date) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{cand.name}</td>
                        <td className="px-4 py-3 text-gray-700">{app?.position || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700">{app?.client || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">
                          {app ? <StatusBadge label={app.status} /> : <span className="text-gray-400 text-xs">No record</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{app?.recruiter || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700">{app?.account_manager || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[220px]">
                          {app?.comment
                            ? <span className="line-clamp-2 text-sm">{app.comment}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            {canWrite ? (
                              <>
                                <button
                                  onClick={async () => {
                                    if (!token) return;
                                    let resolvedApp = app;
                                    if (!resolvedApp) {
                                      resolvedApp = await trackerApi.createApplication(token, {
                                        candidate_id: cand.id,
                                        status: 'MRF Pending',
                                      });
                                      await refresh();
                                    }
                                    setEditApp({ app: resolvedApp, cand });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(cand.id); setConfirmDeleteType('candidate'); }}
                                  disabled={!!rowBusy[cand.id]}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditJobOpeningDialog job={editJob} onClose={() => setEditJob(null)} onSaved={refresh} />
      <EditApplicationDialog
        app={editApp?.app ?? null}
        cand={editApp?.cand ?? null}
        onClose={() => setEditApp(null)}
        onSaved={refresh}
      />

      {/* Delete confirmation dialog */}
      {confirmDeleteId && confirmDeleteType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteType(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Delete {confirmDeleteType === 'job' ? 'Requirement' : 'Candidate'}?</p>
                <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteType(null); }}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  if (!token || !confirmDeleteId) return;
                  setRowBusy((s) => ({ ...s, [confirmDeleteId]: true }));
                  try {
                    if (confirmDeleteType === 'job') {
                      await trackerApi.deleteJobOpening(token, confirmDeleteId);
                    } else {
                      await trackerApi.deleteCandidate(token, confirmDeleteId);
                    }
                    await refresh();
                  } finally {
                    setRowBusy((s) => ({ ...s, [confirmDeleteId]: false }));
                    setConfirmDeleteId(null); setConfirmDeleteType(null);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
