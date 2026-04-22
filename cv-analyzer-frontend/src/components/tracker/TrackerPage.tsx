'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackerApi, type TrackerTeam } from '@/lib/trackerApi';
import { useAuthStore } from '@/stores/authStore';
import type { TrackerApplication, TrackerCandidate, TrackerFollowUp, TrackerJobOpening, TrackerOption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ManagedSelect } from '@/components/tracker/ManagedSelect';
import { DialogDescription } from '@/components/ui/dialog';
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
  Settings,
  Trash2,
  Upload,
  Users,
  X,
  Shield,
} from 'lucide-react';

function formatDdMmYy(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function isOverdue(next: string | null | undefined, stage: string | null | undefined) {
  if (!next) return false;
  if ((stage || '').trim().toLowerCase() === 'positions closed') return false;
  const d = new Date(next);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function stageBadgeClass(stage: string, overdue: boolean) {
  if (overdue) return 'bg-red-100 text-red-800 border-red-200';
  const k = (stage || '').toLowerCase();
  if (k.includes('scheduled')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (k.includes('pending') || k.includes('profiles submitted') || k.includes('rework') || k.includes('hold')) {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  if (k.includes('closed') || k.includes('cancelled')) return 'bg-gray-200 text-gray-700 border-gray-300';
  return 'bg-blue-100 text-blue-800 border-blue-200';
}

/* ─────────────────────────── constants ───────────────────────────── */

type ViewMode = 'jobOpenings' | 'candidateProfiles' | 'followUps' | 'managerSettings';

const FOLLOW_UP_STAGE_OPTIONS = [
  'Feedback Pending',
  'Interviews Scheduled',
  'Interview Feedback Pending',
  'Rework',
  'Positions Closed',
  'Overdue Follow-ups',
  'Profiles Submitted',
  'Position Cancelled',
  'Hold',
] as const;

// NOTE: Tracker option lists (statuses, recruiters, locations, etc.) are intentionally NOT
// seeded from the frontend. They must only reflect what's already in the DB, and can only
// change via explicit user actions (Add/Edit/Delete in the UI).

/* ─────────────────────────── helpers ─────────────────────────────── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

function isJoinedStatus(s?: string | null) {
  const k = String(s || '').toLowerCase();
  return k.includes('joined') && !k.includes('pending');
}

function _norm(s?: string | null) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isBackoutStatus(s?: string | null) {
  const k = _norm(s);
  return (
    k === 'backout' ||
    k === 'backouts' ||
    k === 'backed out' ||
    k.replace(/\s/g, '') === 'backedout' ||
    k.includes('backout') ||
    k.includes('backed out')
  );
}

function isOfferReleasedStatus(s?: string | null) {
  const k = _norm(s);
  return k === 'offer released' || k.includes('offer released');
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

function LocationFilter({
  value,
  onChange,
  options,
  canManage,
  onAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TrackerOption[];
  canManage: boolean;
  onAdd: (v: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === '__add__') {
            setDraft('');
            setOpen(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger className="h-8 w-[180px] text-[13px] bg-white border-gray-200 text-gray-800">
          <SelectValue placeholder="All Locations" />
        </SelectTrigger>
        <SelectContent className="max-h-72 overflow-y-auto">
          <SelectItem value="all">All Locations</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.value}>
              {o.value}
            </SelectItem>
          ))}
          {canManage ? <SelectItem value="__add__">+ Custom…</SelectItem> : null}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#00529b]">Add Location</DialogTitle>
            <DialogDescription>Add a custom location to the filter list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Al Ain" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const v = draft.trim();
                  if (!v) return;
                  await onAdd(v);
                  onChange(v);
                  setOpen(false);
                }}
                className="bg-[#00529b] hover:bg-[#003d73] text-white"
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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

function EditJobOpeningDialog({
  job,
  onClose,
  onSaved,
  team,
  jobStatusOptions,
  recruiterOptions,
  accountManagerOptions,
  recruitmentManagerOptions,
  locationOptions,
  canManageOptions,
  onAddOption,
  onEditOption,
  onDeleteOption,
}: {
  job: TrackerJobOpening | null;
  onClose: () => void;
  onSaved: () => void;
  team?: TrackerTeam;
  jobStatusOptions: TrackerOption[];
  recruiterOptions: TrackerOption[];
  accountManagerOptions: TrackerOption[];
  recruitmentManagerOptions: TrackerOption[];
  locationOptions: TrackerOption[];
  canManageOptions: boolean;
  onAddOption: (kind: string, value: string) => Promise<void>;
  onEditOption: (kind: string, id: string, value: string) => Promise<void>;
  onDeleteOption: (kind: string, id: string) => Promise<void>;
}) {
  const { token } = useAuthStore();
  const [reqDate, setReqDate] = useState('');
  const [role, setRole] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [recruitmentManager, setRecruitmentManager] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [status, setStatus] = useState('Open');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setReqDate(job.req_date ? String(job.req_date) : '');
    setRole(job.title || '');
    setClient(job.client || job.location || '');
    setLocation(job.work_location || '');
    setRecruiter(job.hiring_manager || '');
    setRecruitmentManager((job as any).recruitment_manager || '');
    setAccountManager(job.department || '');
    setStatus(job.status || 'Open');
  }, [job]);

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">Edit Requirement</DialogTitle>
          <DialogDescription>Update fields for this requirement.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={reqDate} onChange={setReqDate} label="Requirement date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Role"><FormInput value={role} onChange={setRole} placeholder="e.g. DevOps Engineer" /></FieldRow></div>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Location">
            <ManagedSelect
              label="Location"
              value={location}
              canManage={false}
              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
              onChange={setLocation}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Status">
            <ManagedSelect
              label="Status"
              value={status}
              canManage={false}
              options={jobStatusOptions.map((o) => ({ id: o.id, value: o.value }))}
              onChange={setStatus}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruiter">
            <ManagedSelect
              label="Recruiter"
              value={recruiter}
              canManage={false}
              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
              onChange={setRecruiter}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruitment Manager">
            <ManagedSelect
              label="Recruitment Manager"
              value={recruitmentManager}
              canManage={false}
              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              onChange={setRecruitmentManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Account Manager">
            <ManagedSelect
              label="Account Manager"
              value={accountManager}
              canManage={false}
              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              onChange={setAccountManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!token || !job || !role.trim() || saving} onClick={async () => {
            if (!token || !job) return; setSaving(true);
            try {
              await trackerApi.updateJobOpening(token, job.id, {
                title: role.trim(),
                client: client.trim() || undefined,
                // Keep legacy column for backward compatibility
                location: client.trim() || undefined,
                work_location: location.trim() || undefined,
                status,
                hiring_manager: recruiter.trim() || undefined,
                recruitment_manager: recruitmentManager.trim() || undefined,
                department: accountManager.trim() || undefined,
                req_date: reqDate || null,
              } as any, team);
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
  app,
  cand,
  onClose,
  onSaved,
  team,
  statusOptions,
  recruiterOptions,
  accountManagerOptions,
  locationOptions,
  canManageOptions,
  onAddOption,
  onEditOption,
  onDeleteOption,
}: {
  app: TrackerApplication | null;
  cand: TrackerCandidate | null;
  onClose: () => void;
  onSaved: () => void;
  team?: TrackerTeam;
  statusOptions: TrackerOption[];
  recruiterOptions: TrackerOption[];
  accountManagerOptions: TrackerOption[];
  locationOptions: TrackerOption[];
  canManageOptions: boolean;
  onAddOption: (kind: string, value: string) => Promise<void>;
  onEditOption: (kind: string, id: string, value: string) => Promise<void>;
  onDeleteOption: (kind: string, id: string) => Promise<void>;
}) {
  const { token } = useAuthStore();
  const [appliedDate, setAppliedDate] = useState('');
  const [position, setPosition] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('MRF Pending');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!app) return;
    setAppliedDate(app.applied_date ? String(app.applied_date) : '');
    setPosition(app.position || ''); setClient(app.client || '');
    setLocation(app.location || '');
    setStatus(app.status || 'MRF Pending'); setRecruiter(app.recruiter || '');
    setAccountManager(app.account_manager || ''); setComment(app.comment || '');
  }, [app]);

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">Edit Application</DialogTitle>
          <DialogDescription>Update the candidate’s tracking fields.</DialogDescription>
          {cand && <p className="text-sm text-gray-500 mt-1">Candidate: <span className="font-semibold text-gray-800">{cand.name}</span></p>}
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={appliedDate} onChange={setAppliedDate} label="Application date" /></FieldRow>
          <FieldRow label="Position"><FormInput value={position} onChange={setPosition} placeholder="e.g. DevOps Engineer" /></FieldRow>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Location">
            <ManagedSelect
              label="Location"
              value={location}
              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setLocation}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Status">
            <ManagedSelect
              label="Status"
              value={status}
              options={statusOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setStatus}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruiter">
            <ManagedSelect
              label="Recruiter"
              value={recruiter}
              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruiter}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Account Manager">
            <ManagedSelect
              label="Account Manager"
              value={accountManager}
              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setAccountManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
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
                location: location || null,
                status: status || null, recruiter: recruiter || null, account_manager: accountManager || null,
                comment: comment || null,
              }, team);
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

function NewJobOpeningDialog({
  onCreated,
  team,
  jobStatusOptions,
  recruiterOptions,
  accountManagerOptions,
  recruitmentManagerOptions,
  locationOptions,
  canManageOptions,
  onAddOption,
  onEditOption,
  onDeleteOption,
}: {
  onCreated: () => void;
  team?: TrackerTeam;
  jobStatusOptions: TrackerOption[];
  recruiterOptions: TrackerOption[];
  accountManagerOptions: TrackerOption[];
  recruitmentManagerOptions: TrackerOption[];
  locationOptions: TrackerOption[];
  canManageOptions: boolean;
  onAddOption: (kind: string, value: string) => Promise<void>;
  onEditOption: (kind: string, id: string, value: string) => Promise<void>;
  onDeleteOption: (kind: string, id: string) => Promise<void>;
}) {
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [role, setRole] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [recruiter, setRecruiter] = useState('');
  const [recruitmentManager, setRecruitmentManager] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [status, setStatus] = useState('Open');
  const [saving, setSaving] = useState(false);

  const reset = () => { setReqDate(''); setRole(''); setClient(''); setLocation(''); setRecruiter(''); setRecruitmentManager(''); setAccountManager(''); setStatus('Open'); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-[#00529b] hover:bg-[#003d73] !text-white gap-1.5"
        >
          <Plus className="w-4 h-4 text-white" /> New Requirement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">Create Requirement</DialogTitle>
          <DialogDescription>Add a new requirement row.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={reqDate} onChange={setReqDate} label="Requirement date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Role"><FormInput value={role} onChange={setRole} placeholder="e.g. DevOps Engineer" /></FieldRow></div>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Location">
            <ManagedSelect
              label="Location"
              value={location}
              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setLocation}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Status">
            <ManagedSelect
              label="Status"
              value={status}
              options={jobStatusOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setStatus}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruiter">
            <ManagedSelect
              label="Recruiter"
              value={recruiter}
              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruiter}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruitment Manager">
            <ManagedSelect
              label="Recruitment Manager"
              value={recruitmentManager}
              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruitmentManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Account Manager">
            <ManagedSelect
              label="Account Manager"
              value={accountManager}
              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setAccountManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!role.trim() || !token || saving} onClick={async () => {
            if (!token) return; setSaving(true);
            try {
              await trackerApi.createJobOpening(token, {
                title: role.trim(),
                client: client.trim() || undefined,
                // Keep old column in sync for older records / exports (safe, additive).
                location: client.trim() || undefined,
                work_location: location.trim() || undefined,
                status,
                hiring_manager: recruiter.trim() || undefined,
                recruitment_manager: recruitmentManager.trim() || undefined,
                department: accountManager.trim() || undefined,
                req_date: reqDate || null,
              } as any, team);
              setOpen(false); reset(); onCreated();
            } catch (e: any) {
              const msg =
                e?.response?.data?.detail ??
                e?.response?.data?.error ??
                e?.message ??
                'Could not create requirement';
              window.alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewCandidateDialog({
  onCreated,
  team,
  statusOptions,
  recruiterOptions,
  accountManagerOptions,
  recruitmentManagerOptions,
  locationOptions,
  canManageOptions,
  onAddOption,
  onEditOption,
  onDeleteOption,
}: {
  onCreated: () => void;
  team?: TrackerTeam;
  statusOptions: TrackerOption[];
  recruiterOptions: TrackerOption[];
  accountManagerOptions: TrackerOption[];
  recruitmentManagerOptions: TrackerOption[];
  locationOptions: TrackerOption[];
  canManageOptions: boolean;
  onAddOption: (kind: string, value: string) => Promise<void>;
  onEditOption: (kind: string, id: string, value: string) => Promise<void>;
  onDeleteOption: (kind: string, id: string) => Promise<void>;
}) {
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  // candidate fields
  const [name, setName] = useState('');
  // application fields
  const [appliedDate, setAppliedDate] = useState('');
  const [position, setPosition] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('MRF Pending');
  const [recruiter, setRecruiter] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [recruitmentManager, setRecruitmentManager] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setAppliedDate(''); setPosition(''); setClient('');
    setLocation('');
    setStatus('MRF Pending'); setRecruiter(''); setAccountManager(''); setRecruitmentManager(''); setComment('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#00529b] hover:bg-[#003d73] !text-white gap-1.5">
          <Plus className="w-4 h-4 text-white" /> New Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">Add Candidate</DialogTitle>
          <DialogDescription>Create a candidate and tracking record.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Date"><DatePicker value={appliedDate} onChange={setAppliedDate} label="Date" /></FieldRow>
          <div className="sm:col-span-2"><FieldRow label="Candidate Name"><FormInput value={name} onChange={setName} placeholder="e.g. Ahmed Hassan" /></FieldRow></div>
          <FieldRow label="Position"><FormInput value={position} onChange={setPosition} placeholder="e.g. DevOps Engineer" /></FieldRow>
          <FieldRow label="Client"><FormInput value={client} onChange={setClient} placeholder="e.g. FinEdge" /></FieldRow>
          <FieldRow label="Location">
            <ManagedSelect
              label="Location"
              value={location}
              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setLocation}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Status">
            <ManagedSelect
              label="Status"
              value={status}
              options={statusOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setStatus}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruiter">
            <ManagedSelect
              label="Recruiter"
              value={recruiter}
              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruiter}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Account Manager">
            <ManagedSelect
              label="Account Manager"
              value={accountManager}
              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setAccountManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruitment Manager">
            <ManagedSelect
              label="Recruitment Manager"
              value={recruitmentManager}
              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruitmentManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
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
              const cand = await trackerApi.createCandidate(token, { name: name.trim() } as any, team);
              await trackerApi.createApplication(token, {
                candidate_id: cand.id,
                applied_date: appliedDate || undefined,
                position: position.trim() || undefined,
                client: client.trim() || undefined,
                location: location.trim() || undefined,
                status,
                recruiter: recruiter || undefined,
                account_manager: accountManager || undefined,
                recruitment_manager: recruitmentManager || undefined,
                comment: comment.trim() || undefined,
              }, team);
              setOpen(false); reset(); onCreated();
            } catch (e: any) {
              const msg =
                e?.response?.data?.detail ??
                e?.response?.data?.error ??
                e?.message ??
                'Could not create candidate';
              window.alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
            } finally { setSaving(false); }
          }} className="bg-[#00529b] hover:bg-[#003d73] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpDialog({
  mode,
  initial,
  team,
  recruiterOptions,
  accountManagerOptions,
  recruitmentManagerOptions,
  followUpStageOptions,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: TrackerFollowUp;
  team?: TrackerTeam;
  recruiterOptions: TrackerOption[];
  accountManagerOptions: TrackerOption[];
  recruitmentManagerOptions: TrackerOption[];
  followUpStageOptions: TrackerOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState(initial?.client_name ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [recruiterName, setRecruiterName] = useState(initial?.recruiter_name ?? '');
  const [accountManager, setAccountManager] = useState(initial?.account_manager ?? '');
  const [recruitmentManager, setRecruitmentManager] = useState(initial?.recruitment_manager ?? '');
  const [cvSubmittedDate, setCvSubmittedDate] = useState(initial?.cv_submitted_date ?? '');
  const [currentStage, setCurrentStage] = useState(initial?.current_stage ?? 'Feedback Pending');
  const [lastFollowUpDate, setLastFollowUpDate] = useState(initial?.last_follow_up_date ?? '');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(initial?.next_follow_up_date ?? '');
  const [interviewDate, setInterviewDate] = useState(initial?.interview_date ?? '');
  const [clientFeedback, setClientFeedback] = useState(initial?.client_feedback ?? '');
  const [interviewFeedback, setInterviewFeedback] = useState(initial?.interview_feedback ?? '');
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');
  const stageOptions = followUpStageOptions?.length
    ? followUpStageOptions
    : (FOLLOW_UP_STAGE_OPTIONS.map((s) => ({ id: `stage:${s}`, value: s })) as any);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white text-gray-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#00529b]">{mode === 'create' ? 'Add Follow-up' : 'Edit Follow-up'}</DialogTitle>
          <DialogDescription>Manage client and recruiter follow-up records.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <FieldRow label="Client Name">
            <FormInput value={clientName} onChange={setClientName} placeholder="e.g. FinEdge" />
          </FieldRow>
          <FieldRow label="Position">
            <FormInput value={position} onChange={setPosition} placeholder="e.g. Network Engineer" />
          </FieldRow>
          <FieldRow label="Recruiter Name">
            <ManagedSelect
              label="Recruiter"
              value={recruiterName}
              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruiterName}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Recruitment Manager">
            <ManagedSelect
              label="Recruitment Manager"
              value={recruitmentManager}
              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setRecruitmentManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Account Manager">
            <ManagedSelect
              label="Account Manager"
              value={accountManager}
              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setAccountManager}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="Current Stage">
            <ManagedSelect
              label="Current Stage"
              value={currentStage}
              options={stageOptions.map((o: any) => ({ id: o.id, value: o.value }))}
              canManage={false}
              onChange={setCurrentStage}
              onAdd={async () => {}}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          </FieldRow>
          <FieldRow label="CV Submitted Date">
            <DatePicker value={cvSubmittedDate || ''} onChange={setCvSubmittedDate} label="CV Submitted Date" />
          </FieldRow>
          <FieldRow label="Follow Up Date">
            <DatePicker value={lastFollowUpDate || ''} onChange={setLastFollowUpDate} label="Follow Up Date" />
          </FieldRow>
          <FieldRow label="Next Follow-up Date">
            <DatePicker value={nextFollowUpDate || ''} onChange={setNextFollowUpDate} label="Next Follow-up Date" />
          </FieldRow>
          <FieldRow label="Interview Date">
            <DatePicker value={interviewDate || ''} onChange={setInterviewDate} label="Interview Date" />
          </FieldRow>
          <div className="sm:col-span-2">
            <FieldRow label="Client Feedback">
              <textarea
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                rows={2}
                placeholder="Client feedback..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] resize-none"
              />
            </FieldRow>
          </div>
          <div className="sm:col-span-2">
            <FieldRow label="Interview Feedback">
              <textarea
                value={interviewFeedback}
                onChange={(e) => setInterviewFeedback(e.target.value)}
                rows={2}
                placeholder="Interview feedback..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] resize-none"
              />
            </FieldRow>
          </div>
          <div className="sm:col-span-2">
            <FieldRow label="Remarks">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Remarks..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#00529b] focus:ring-1 focus:ring-[#00529b] resize-none"
              />
            </FieldRow>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!token || !clientName.trim() || saving}
            onClick={async () => {
              if (!token) return;
              setSaving(true);
              try {
                const payload = {
                  client_name: clientName.trim(),
                  position: position.trim() || null,
                  recruiter_name: recruiterName.trim() || null,
                  account_manager: accountManager.trim() || null,
                  recruitment_manager: recruitmentManager.trim() || null,
                  cv_submitted_date: cvSubmittedDate || null,
                  current_stage: currentStage,
                  last_follow_up_date: lastFollowUpDate || null,
                  next_follow_up_date: nextFollowUpDate || null,
                  interview_date: interviewDate || null,
                  client_feedback: clientFeedback.trim() || null,
                  interview_feedback: interviewFeedback.trim() || null,
                  remarks: remarks.trim() || null,
                } as any;

                if (mode === 'create') {
                  await trackerApi.createFollowUp(token, payload, team);
                } else {
                  await trackerApi.updateFollowUp(token, initial!.id, payload, team);
                }
                onSaved();
                onClose();
              } catch (e: any) {
                const msg =
                  e?.response?.data?.detail ??
                  e?.response?.data?.error ??
                  e?.message ??
                  'Could not save follow-up';
                window.alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
              } finally {
                setSaving(false);
              }
            }}
            className="bg-[#00529b] hover:bg-[#003d73] text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save
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
  const isAdminLike = user?.role === 'admin' || user?.role === 'evp';
  const isAdmin = user?.role === 'admin';

  const formatDate = useCallback((v?: string | null) => formatDdMmYy(v), []);
  const formatDateTime = useCallback((v?: string | null) => {
    if (!v) return '';
    const raw = String(v).trim();
    // Many backends return timestamps like "2026-04-22 07:00:00" (no timezone).
    // JS treats those as *local time*, which breaks UAE display. Treat tz-less values as UTC.
    const looksLikeHasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
    const isoish =
      looksLikeHasTz
        ? raw
        : raw.includes('T')
          ? `${raw}Z`
          : raw.includes(' ')
            ? `${raw.replace(' ', 'T')}Z`
            : raw;
    const d = new Date(isoish);
    if (Number.isNaN(d.getTime())) return String(v);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`;
  }, []);

  type TeamView = TrackerTeam | 'all';
  const [teamView, setTeamView] = useState<TeamView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tracker_team_view');
      if (saved === 'dubai' || saved === 'abudhabi' || saved === 'all') return saved as TeamView;
    }
    return 'dubai';
  });

  const setTeamViewPersisted = (v: TeamView) => {
    setTeamView(v);
    if (typeof window !== 'undefined') localStorage.setItem('tracker_team_view', v);
  };

  const apiTeam: TrackerTeam | undefined = isAdminLike && teamView !== 'all' ? teamView : undefined;
  const isAllTeamsView = isAdminLike && teamView === 'all';
  /** Requirements grid: admin & manager only; recruiters see this tab as view-only. */
  const canWriteJobs = user?.role === 'manager';
  /** Recruiter persona: `user` and `recruiter` are treated the same, but are now read-only in Tracker. */
  const isRecruiterUser = user?.role === 'recruiter' || user?.role === 'user';
  const canWriteCandidates = user?.role === 'manager';
  const isReadOnlyTracker = !canWriteJobs && !canWriteCandidates;
  const canManageJobOptions = canWriteJobs;
  const canManageCandidateOptions = canWriteCandidates;

  const noopAsync = useCallback(async () => {}, []);

  const [textPeek, setTextPeek] = useState<null | { title: string; text: string }>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTeam, setImportTeam] = useState<TrackerTeam>('abudhabi');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const truncate10 = (v?: string | null) => {
    const s = String(v || '').trim();
    if (!s) return '';
    return s.length <= 10 ? s : `${s.slice(0, 10)}…`;
  };

  // Persist view across page reloads
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tracker_view');
      if (saved === 'jobOpenings' || saved === 'candidateProfiles' || saved === 'followUps' || saved === 'managerSettings') return saved as any;
    }
    return 'jobOpenings';
  });

  const setViewPersisted = (v: ViewMode) => {
    setView(v);
    if (typeof window !== 'undefined') localStorage.setItem('tracker_view', v);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [jobOpenings, setJobOpenings] = useState<TrackerJobOpening[]>([]);
  const [candidates, setCandidates] = useState<TrackerCandidate[]>([]);
  const [applications, setApplications] = useState<TrackerApplication[]>([]);
  const [followUps, setFollowUps] = useState<TrackerFollowUp[]>([]);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [search, setSearch] = useState('');
  const [followupSearch, setFollowupSearch] = useState('');
  const [followupStageFilter, setFollowupStageFilter] = useState('all');
  const [followupNextFrom, setFollowupNextFrom] = useState('');
  const [followupNextTo, setFollowupNextTo] = useState('');
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [editJob, setEditJob] = useState<TrackerJobOpening | null>(null);
  const [editApp, setEditApp] = useState<{ app: TrackerApplication; cand: TrackerCandidate } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'job' | 'candidate' | 'followup' | null>(null);
  const [editFollowUp, setEditFollowUp] = useState<{ mode: 'create' } | { mode: 'edit'; row: TrackerFollowUp } | null>(null);

  const [candidateStatusOptions, setCandidateStatusOptions] = useState<TrackerOption[]>([]);
  const [jobStatusOptions, setJobStatusOptions] = useState<TrackerOption[]>([]);
  const [recruiterOptions, setRecruiterOptions] = useState<TrackerOption[]>([]);
  const [accountManagerOptions, setAccountManagerOptions] = useState<TrackerOption[]>([]);
  const [recruitmentManagerOptions, setRecruitmentManagerOptions] = useState<TrackerOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<TrackerOption[]>([]);
  const [followUpStageOptions, setFollowUpStageOptions] = useState<TrackerOption[]>([]);

  const canAccessManagerSettings = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'evp';
  const [msRecruiters, setMsRecruiters] = useState<TrackerOption[]>([]);
  const [msAccountManagers, setMsAccountManagers] = useState<TrackerOption[]>([]);
  const [msRecruitmentManagers, setMsRecruitmentManagers] = useState<TrackerOption[]>([]);
  const [msLocations, setMsLocations] = useState<TrackerOption[]>([]);
  const [msRequirementStatuses, setMsRequirementStatuses] = useState<TrackerOption[]>([]);
  const [msSelectionStatuses, setMsSelectionStatuses] = useState<TrackerOption[]>([]);
  const [msFollowUpStages, setMsFollowUpStages] = useState<TrackerOption[]>([]);
  const [msSendFollowupId, setMsSendFollowupId] = useState<string>('');
  const [msSendingFollowupReminder, setMsSendingFollowupReminder] = useState(false);
  const [msShowInactive, setMsShowInactive] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [msReminderTime, setMsReminderTime] = useState('09:00');
  const [msReminderTimeId, setMsReminderTimeId] = useState<string | null>(null);
  const [msReminderTimeSaving, setMsReminderTimeSaving] = useState(false);
  const [msAddOpen, setMsAddOpen] = useState<null | 'recruiter' | 'account_manager' | 'recruitment_manager' | 'location' | 'job_status' | 'candidate_status' | 'followup_stage'>(null);
  const [msEdit, setMsEdit] = useState<null | { id: string; kind: 'recruiter' | 'account_manager' | 'recruitment_manager' | 'location' | 'job_status' | 'candidate_status' | 'followup_stage'; value: string }>(null);
  const [msDraft, setMsDraft] = useState('');
  const [msEmailDraft, setMsEmailDraft] = useState('');
  const [msEmailEnabledDraft, setMsEmailEnabledDraft] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      if (isAllTeamsView) {
        const [jobsDXB, rowsDXB, fusDXB, jobsAD, rowsAD, fusAD] = await Promise.all([
          trackerApi.listJobOpenings(token, 'dubai'),
          trackerApi.listCandidateRows(token, 'dubai').catch(() => [] as any[]),
          trackerApi.listFollowUps(token, 'dubai').catch(() => [] as TrackerFollowUp[]),
          trackerApi.listJobOpenings(token, 'abudhabi'),
          trackerApi.listCandidateRows(token, 'abudhabi').catch(() => [] as any[]),
          trackerApi.listFollowUps(token, 'abudhabi').catch(() => [] as TrackerFollowUp[]),
        ]);

        const candsDXB = rowsDXB
          .map((r) => r.candidate)
          .filter(Boolean)
          .map((c: any) => ({ ...c, id: `dubai:${c.id}`, __realId: c.id, __team: 'Dubai' }));
        const appsDXB = rowsDXB
          .map((r) => r.application)
          .filter(Boolean)
          .map((a: any) => ({ ...a, id: `dubai:${a.id}`, candidate_id: `dubai:${a.candidate_id}`, __realId: a.id, __team: 'Dubai' }));
        const candsAD = rowsAD
          .map((r) => r.candidate)
          .filter(Boolean)
          .map((c: any) => ({ ...c, id: `abudhabi:${c.id}`, __realId: c.id, __team: 'Abu Dhabi' }));
        const appsAD = rowsAD
          .map((r) => r.application)
          .filter(Boolean)
          .map((a: any) => ({
            ...a,
            id: `abudhabi:${a.id}`,
            candidate_id: `abudhabi:${a.candidate_id}`,
            __realId: a.id,
            __team: 'Abu Dhabi',
          }));

        setJobOpenings([
          ...jobsDXB.map((j: any) => ({ ...j, id: `dubai:${j.id}`, __realId: j.id, __team: 'Dubai' })),
          ...jobsAD.map((j: any) => ({ ...j, id: `abudhabi:${j.id}`, __realId: j.id, __team: 'Abu Dhabi' })),
        ] as any);
        setCandidates([...candsDXB, ...candsAD] as any);
        setApplications([...appsDXB, ...appsAD] as any);
        setFollowUps([
          ...fusDXB.map((f: any) => ({ ...f, id: `dubai:${f.id}`, __realId: f.id, __team: 'Dubai' })),
          ...fusAD.map((f: any) => ({ ...f, id: `abudhabi:${f.id}`, __realId: f.id, __team: 'Abu Dhabi' })),
        ] as any);
      } else {
        const [jobs, rows, fus] = await Promise.all([
          trackerApi.listJobOpenings(token, apiTeam),
          trackerApi.listCandidateRows(token, apiTeam).catch(() => [] as any[]),
          trackerApi.listFollowUps(token, apiTeam).catch(() => [] as TrackerFollowUp[]),
        ]);
        const cands = rows.map((r) => r.candidate).filter(Boolean);
        const apps = rows.map((r) => r.application).filter(Boolean);
        setJobOpenings(jobs); setCandidates(cands); setApplications(apps as any);
        setFollowUps(fus);
      }
    } catch (e: any) { setError(e?.message || 'Failed to load data'); }
    finally { setLoading(false); }
  }, [token, apiTeam, isAllTeamsView]);

  const loadOptions = useCallback(async () => {
    if (!token) return;
    try {
      const mergeByValue = (a: TrackerOption[], b: TrackerOption[], kind: string) => {
        const seen = new Set<string>();
        const out: TrackerOption[] = [];
        const add = (o: TrackerOption) => {
          const k = `${kind}::${(o.value || '').trim().toLowerCase()}`;
          if (seen.has(k)) return;
          seen.add(k);
          out.push({ ...o, id: `all:${kind}:${o.value}` } as any);
        };
        a.forEach(add);
        b.forEach(add);
        return out;
      };

      const [candStatuses, jobStatuses, recruiters, ams, rms, locs, fuStages] = isAllTeamsView
        ? await Promise.all([
            Promise.all([
              trackerApi.listOptions(token, 'candidate_status', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'candidate_status', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'candidate_status')),
            Promise.all([
              trackerApi.listOptions(token, 'job_status', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'job_status', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'job_status')),
            Promise.all([
              trackerApi.listOptions(token, 'recruiter', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'recruiter', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'recruiter')),
            Promise.all([
              trackerApi.listOptions(token, 'account_manager', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'account_manager', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'account_manager')),
            Promise.all([
              trackerApi.listOptions(token, 'recruitment_manager', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'recruitment_manager', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'recruitment_manager')),
            Promise.all([
              trackerApi.listOptions(token, 'location', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'location', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'location')),
            Promise.all([
              trackerApi.listOptions(token, 'followup_stage', { team: 'dubai' }).catch(() => [] as TrackerOption[]),
              trackerApi.listOptions(token, 'followup_stage', { team: 'abudhabi' }).catch(() => [] as TrackerOption[]),
            ]).then(([a, b]) => mergeByValue(a, b, 'followup_stage')),
          ])
        : await Promise.all([
            trackerApi.listOptions(token, 'candidate_status', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'job_status', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'recruiter', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'account_manager', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'recruitment_manager', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'location', { team: apiTeam }).catch(() => [] as TrackerOption[]),
            trackerApi.listOptions(token, 'followup_stage', { team: apiTeam }).catch(() => [] as TrackerOption[]),
          ]);
      setCandidateStatusOptions(candStatuses);
      setJobStatusOptions(jobStatuses);
      setRecruiterOptions(recruiters);
      setAccountManagerOptions(ams);
      setRecruitmentManagerOptions(rms);
      setLocationOptions(locs);
      setFollowUpStageOptions(fuStages);
    } catch {
      // keep whatever we already have in state
    }
  }, [token, apiTeam, isAllTeamsView]);

  const loadManagerSettings = useCallback(async () => {
    if (!token || !canAccessManagerSettings) return;
    if (isAllTeamsView) return;
    setMsLoading(true);
    try {
      const [recs, ams, rms, locs, reqStatuses, selStatuses, fuStages, reminderTimes] = await Promise.all([
        trackerApi.listOptions(token, 'recruiter', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'account_manager', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'recruitment_manager', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'location', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'job_status', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'candidate_status', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'followup_stage', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
        trackerApi.listOptions(token, 'followup_reminder_send_time', { include_deleted: true, team: apiTeam }).catch(() => [] as TrackerOption[]),
      ]);
      setMsRecruiters(recs);
      setMsAccountManagers(ams);
      setMsRecruitmentManagers(rms);
      setMsLocations(locs);
      setMsRequirementStatuses(reqStatuses);
      setMsSelectionStatuses(selStatuses);
      setMsFollowUpStages(fuStages);
      const rt = (reminderTimes || []).find((r) => !r.is_deleted) || reminderTimes?.[0] || null;
      setMsReminderTime(String(rt?.value || '09:00'));
      setMsReminderTimeId(rt?.id || null);
    } finally {
      setMsLoading(false);
    }
  }, [token, canAccessManagerSettings, apiTeam, isAllTeamsView]);

  useEffect(() => {
    if (view === 'managerSettings') loadManagerSettings();
  }, [view, loadManagerSettings]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadOptions()]);
  }, [refresh, loadOptions]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  const createOption = useCallback(
    async (kind: string, value: string) => {
      if (!token) return;
      if (isAllTeamsView) return;
      await trackerApi.createOption(token, kind, value, apiTeam);
      await loadOptions();
    },
    [token, loadOptions, apiTeam, isAllTeamsView]
  );

  const editOption = useCallback(
    async (kind: string, id: string, value: string) => {
      if (!token) return;
      // Ignore edits on fallback pseudo-items
      if (String(id).startsWith('fallback:')) return;
      if (isAllTeamsView) return;
      await trackerApi.updateOption(token, id, { value }, apiTeam);
      await loadOptions();
    },
    [token, loadOptions, apiTeam, isAllTeamsView]
  );

  const deleteOption = useCallback(
    async (kind: string, id: string) => {
      if (!token) return;
      if (String(id).startsWith('fallback:')) return;
      if (isAllTeamsView) return;
      await trackerApi.deleteOption(token, id, apiTeam);
      await loadOptions();
    },
    [token, loadOptions, apiTeam, isAllTeamsView]
  );

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
      .filter(({ app }) => filterLocation === 'all' || (app?.location ?? '') === filterLocation)
      .filter(({ cand, app }) => {
        if (!s) return true;
        return (
          cand.name.toLowerCase().includes(s) ||
          (app?.position || '').toLowerCase().includes(s) ||
          (app?.client || '').toLowerCase().includes(s) ||
          (app?.location || '').toLowerCase().includes(s) ||
          (app?.recruiter || '').toLowerCase().includes(s) ||
          (app?.account_manager || '').toLowerCase().includes(s) ||
          (app?.recruitment_manager || '').toLowerCase().includes(s) ||
          (app?.comment || '').toLowerCase().includes(s)
        );
      });
  }, [candidates, appByCandId, filterStatus, filterLocation, search]);

  const visibleJobOpenings = useMemo(() => {
    const s = search.trim().toLowerCase();
    return jobOpenings
      .filter((j) => filterStatus === 'all' || (j.status ?? '') === filterStatus)
      .filter((j) => filterLocation === 'all' || ((j as any).work_location ?? '') === filterLocation)
      .filter((j) => {
        if (!s) return true;
        const client = (j as any).client || j.location || '';
        const loc = (j as any).work_location || '';
        return (
          (j.title || '').toLowerCase().includes(s) ||
          String(client).toLowerCase().includes(s) ||
          String(loc).toLowerCase().includes(s) ||
          (j.hiring_manager || '').toLowerCase().includes(s) ||
          (j.department || '').toLowerCase().includes(s)
        );
      });
  }, [jobOpenings, filterStatus, filterLocation, search]);

  const visibleFollowUps = useMemo(() => {
    const q = followupSearch.trim().toLowerCase();
    const stage = followupStageFilter;
    const from = followupNextFrom ? new Date(followupNextFrom) : null;
    const to = followupNextTo ? new Date(followupNextTo) : null;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);

    return [...followUps]
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.client_name || '').toLowerCase().includes(q) ||
          String(r.position || '').toLowerCase().includes(q) ||
          String(r.recruiter_name || '').toLowerCase().includes(q) ||
          String(r.account_manager || '').toLowerCase().includes(q) ||
          String(r.recruitment_manager || '').toLowerCase().includes(q) ||
          String(r.client_feedback || '').toLowerCase().includes(q) ||
          String(r.interview_feedback || '').toLowerCase().includes(q) ||
          String(r.remarks || '').toLowerCase().includes(q)
        );
      })
      .filter((r) => stage === 'all' || String(r.current_stage || '') === stage)
      .filter((r) => {
        if (!from && !to) return true;
        const d = r.next_follow_up_date ? new Date(r.next_follow_up_date) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) => {
        const ad = a.next_follow_up_date ? new Date(a.next_follow_up_date).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.next_follow_up_date ? new Date(b.next_follow_up_date).getTime() : Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd; // ascending
        return String(a.client_name || '').localeCompare(String(b.client_name || ''));
      });
  }, [followUps, followupSearch, followupStageFilter, followupNextFrom, followupNextTo]);

  const requirementCounts = useMemo(() => {
    const isClosed = (s?: string | null) => {
      const k = String(s || '').toLowerCase().trim();
      return k === 'closed' || k === 'cancelled';
    };
    const open = jobOpenings.filter((j) => !isClosed(j.status)).length;
    const closed = jobOpenings.filter((j) => isClosed(j.status)).length;
    return { open, closed };
  }, [jobOpenings]);

  const selectionCounts = useMemo(() => {
    const joined = candidateRows.filter(({ app }) => isJoinedStatus(app?.status)).length;
    let backouts = 0;
    let offerReleased = 0;
    let selections = 0;
    for (const a of applications) {
      const st = _norm(a.status);
      if (!st) continue;
      if (isBackoutStatus(st)) {
        backouts += 1;
        continue;
      }
      if (isOfferReleasedStatus(st)) {
        offerReleased += 1;
        continue;
      }
      selections += 1;
    }
    return { joined, selections, backouts, offerReleased };
  }, [candidateRows, applications]);

  const followUpCounts = useMemo(() => {
    let feedbackPending = 0;
    let positionsClosed = 0;
    let overdue = 0;
    for (const f of followUps) {
      const st = String(f.current_stage || '').trim();
      const k = _norm(st);
      if (k === 'positions closed') positionsClosed += 1;
      if (k === 'feedback pending' || k === 'interview feedback pending') feedbackPending += 1;
      if (isOverdue(f.next_follow_up_date, st) || k === 'overdue follow-ups') overdue += 1;
    }
    return { feedbackPending, positionsClosed, overdue };
  }, [followUps]);

  const msCounts = useMemo(() => {
    const reqByRecruiter = new Map<string, number>();
    const reqByAM = new Map<string, number>();
    const reqByRM = new Map<string, number>();
    for (const j of jobOpenings) {
      const r = (j.hiring_manager || '').trim();
      const am = (j.department || '').trim();
      const rm = (j.recruitment_manager || '').trim();
      if (r) reqByRecruiter.set(r, (reqByRecruiter.get(r) || 0) + 1);
      if (am) reqByAM.set(am, (reqByAM.get(am) || 0) + 1);
      if (rm) reqByRM.set(rm, (reqByRM.get(rm) || 0) + 1);
    }

    const joiningsByRecruiter = new Map<string, number>();
    const joiningsByAM = new Map<string, number>();
    const joiningsByRM = new Map<string, number>();
    for (const a of applications) {
      if (!isJoinedStatus(a.status)) continue;
      const r = (a.recruiter || '').trim();
      const am = (a.account_manager || '').trim();
      const rm = (a.recruitment_manager || '').trim();
      if (r) joiningsByRecruiter.set(r, (joiningsByRecruiter.get(r) || 0) + 1);
      if (am) joiningsByAM.set(am, (joiningsByAM.get(am) || 0) + 1);
      if (rm) joiningsByRM.set(rm, (joiningsByRM.get(rm) || 0) + 1);
    }

    const fuByRecruiter = new Map<string, number>();
    const fuByRM = new Map<string, number>();
    for (const f of followUps) {
      const r = (f.recruiter_name || '').trim();
      const rm = (f.recruitment_manager || '').trim();
      if (r) fuByRecruiter.set(r, (fuByRecruiter.get(r) || 0) + 1);
      if (rm) fuByRM.set(rm, (fuByRM.get(rm) || 0) + 1);
    }

    return { reqByRecruiter, reqByAM, reqByRM, joiningsByRecruiter, joiningsByAM, joiningsByRM, fuByRecruiter, fuByRM };
  }, [jobOpenings, applications, followUps]);


  /* ── sidebar ── */
  const SidebarContent = (
    <>
      {/* Back to Dashboard — always visible at top */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => router.push('/')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-[13px] font-medium"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span>Back to Dashboard</span>}
        </button>
      </div>

      {/* Brand */}
      <div className="px-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-[14px] font-bold text-white leading-tight">Candidate Tracker</div>
              <div className="text-[10px] text-blue-200 mt-0.5">Recruiting workspace</div>
            </div>
          )}
        </div>
      </div>

      <nav className="px-2 pt-3 space-y-0.5 flex-1">
        {([
          { id: 'jobOpenings', label: 'Requirement Status', icon: Briefcase, count: jobOpenings.length, show: true },
          { id: 'candidateProfiles', label: 'Selections & Joinings', icon: Users, count: candidates.length, show: true },
          { id: 'followUps', label: 'Follow-ups', icon: Shield, count: followUps.length, show: true },
          {
            id: 'managerSettings',
            label: 'Manager Settings',
            icon: Settings,
            count: 0,
            show: user?.role === 'admin' || user?.role === 'manager' || user?.role === 'evp',
          },
        ] as const).filter((x) => x.show).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            title={isRecruiterUser && id === 'jobOpenings' ? 'View only — editing is for managers and admins' : undefined}
            onClick={() => {
              setViewPersisted(id);
              setMobileSidebarOpen(false);
              setFilterStatus('all');
              setSearch('');
              setFollowupSearch('');
              setFollowupStageFilter('all');
              setFollowupNextFrom('');
              setFollowupNextTo('');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[13px] ${
              view === id ? 'bg-white text-[#00529b] shadow-sm font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span className="flex-1 truncate">{label}</span>}
            {sidebarOpen && (
              <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-bold tabular-nums ${
                view === id ? 'bg-[#00529b]/10 text-[#00529b]' : 'bg-white/15 text-white/90'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}

      </nav>

      <div className="px-2 pb-3 mt-auto">
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white text-xs transition-colors"
        >
          {sidebarOpen ? <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[#f4f6f9]">
      {/* Desktop sidebar — narrower */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-gradient-to-b from-[#00529b] to-[#002f5f] transition-all duration-200 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-52' : 'w-[52px]'
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-gradient-to-b from-[#00529b] to-[#002f5f] shadow-2xl z-10">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — slim */}
        <header className="shrink-0 bg-white border-b border-gray-200/80">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-[13px] font-semibold text-gray-800">
              {view === 'jobOpenings'
                ? 'Requirement Status'
                : view === 'candidateProfiles'
                  ? 'Selections & Joinings'
                  : view === 'followUps'
                    ? 'Follow-ups'
                    : 'Manager Settings'}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {loading && <Loader2 className="w-4 h-4 animate-spin text-[#00529b]" />}
              <button
                onClick={refreshAll}
                disabled={loading}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#00529b] transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page toolbar */}
        <div className="shrink-0 bg-white border-b border-gray-200/80 px-5 py-3">
          {/* Row 1: title + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[13px] text-gray-400 font-medium">
                  {view === 'jobOpenings'
                    ? `${jobOpenings.length} requirement${jobOpenings.length !== 1 ? 's' : ''}`
                    : view === 'candidateProfiles'
                      ? `${candidateRows.length} candidate${candidateRows.length !== 1 ? 's' : ''}`
                      : `${followUps.length} follow-up${followUps.length !== 1 ? 's' : ''}`}
                </p>
                {view === 'jobOpenings' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-[92px] h-[62px] rounded-xl border border-emerald-200 bg-emerald-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Open</div>
                      <div className="text-[20px] leading-none font-extrabold text-emerald-800 tabular-nums">
                        {requirementCounts.open}
                      </div>
                    </div>
                    <div className="w-[92px] h-[62px] rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Closed</div>
                      <div className="text-[20px] leading-none font-extrabold text-gray-700 tabular-nums">
                        {requirementCounts.closed}
                      </div>
                    </div>
                  </div>
                )}
                {view === 'candidateProfiles' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-[92px] h-[62px] rounded-xl border border-emerald-200 bg-emerald-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Joined</div>
                      <div className="text-[20px] leading-none font-extrabold text-emerald-800 tabular-nums">
                        {selectionCounts.joined}
                      </div>
                    </div>
                    <div className="w-[110px] h-[62px] rounded-xl border border-blue-200 bg-blue-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Selections</div>
                      <div className="text-[20px] leading-none font-extrabold text-blue-800 tabular-nums">
                        {selectionCounts.selections}
                      </div>
                    </div>
                    <div className="w-[110px] h-[62px] rounded-xl border border-red-200 bg-red-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Backouts</div>
                      <div className="text-[20px] leading-none font-extrabold text-red-800 tabular-nums">
                        {selectionCounts.backouts}
                      </div>
                    </div>
                    <div className="w-[130px] h-[62px] rounded-xl border border-amber-200 bg-amber-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Offer released</div>
                      <div className="text-[20px] leading-none font-extrabold text-amber-800 tabular-nums">
                        {selectionCounts.offerReleased}
                      </div>
                    </div>
                  </div>
                )}
                {view === 'followUps' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-[140px] h-[62px] rounded-xl border border-amber-200 bg-amber-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Feedback pending</div>
                      <div className="text-[20px] leading-none font-extrabold text-amber-800 tabular-nums">
                        {followUpCounts.feedbackPending}
                      </div>
                    </div>
                    <div className="w-[140px] h-[62px] rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Position closed</div>
                      <div className="text-[20px] leading-none font-extrabold text-gray-700 tabular-nums">
                        {followUpCounts.positionsClosed}
                      </div>
                    </div>
                    <div className="w-[110px] h-[62px] rounded-xl border border-red-200 bg-red-50 flex flex-col justify-center px-3">
                      <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Overdue</div>
                      <div className="text-[20px] leading-none font-extrabold text-red-800 tabular-nums">
                        {followUpCounts.overdue}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {isReadOnlyTracker && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-700 font-medium">
                  Read-only
                </span>
              )}
              {isRecruiterUser && view === 'jobOpenings' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-600 font-medium">
                  Requirements: view only
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdminLike ? (
                <Select value={teamView} onValueChange={(v) => setTeamViewPersisted(v as any)}>
                  <SelectTrigger className="h-8 w-[170px] text-[13px] bg-white border-gray-200 text-gray-800">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dubai">Dubai</SelectItem>
                    <SelectItem value="abudhabi">Abu Dhabi</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {view === 'candidateProfiles' && isAdmin ? (
                <button
                  disabled={!token || loading}
                  onClick={() => setImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#99f6e4] bg-[#f0fdfa] text-[13px] font-medium text-[#115e59] hover:bg-[#ccfbf1] disabled:opacity-40 transition-colors"
                  title="Upload Selections & Joinings Excel"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Excel
                </button>
              ) : null}
              {view === 'jobOpenings' && canWriteJobs ? (
                <NewJobOpeningDialog
                  onCreated={refreshAll}
                  team={apiTeam}
                  jobStatusOptions={jobStatusOptions}
                  recruiterOptions={recruiterOptions}
                  accountManagerOptions={accountManagerOptions}
                  recruitmentManagerOptions={recruitmentManagerOptions}
                  locationOptions={locationOptions}
                  canManageOptions={canManageJobOptions}
                  onAddOption={createOption}
                  onEditOption={editOption}
                  onDeleteOption={deleteOption}
                />
              ) : null}
              {view === 'candidateProfiles' && canWriteCandidates ? (
                <NewCandidateDialog
                  onCreated={refreshAll}
                  team={apiTeam}
                  statusOptions={candidateStatusOptions}
                  recruiterOptions={recruiterOptions}
                  accountManagerOptions={accountManagerOptions}
                  recruitmentManagerOptions={recruitmentManagerOptions}
                  locationOptions={locationOptions}
                  canManageOptions={canManageCandidateOptions}
                  onAddOption={createOption}
                  onEditOption={editOption}
                  onDeleteOption={deleteOption}
                />
              ) : null}
              <button
                disabled={!token || loading}
                onClick={async () => {
                  if (!token) return;
                  if (view === 'managerSettings') {
                    window.alert('Export is not available for Manager Settings.');
                    return;
                  }
                  if (isAllTeamsView) {
                    const [dxb, ad] = await Promise.all([
                      view === 'jobOpenings'
                        ? trackerApi.exportJobOpeningsXlsx(token, 'dubai')
                        : view === 'candidateProfiles'
                          ? trackerApi.exportCandidatesXlsx(token, 'dubai')
                          : trackerApi.exportFollowUpsXlsx(token, 'dubai'),
                      view === 'jobOpenings'
                        ? trackerApi.exportJobOpeningsXlsx(token, 'abudhabi')
                        : view === 'candidateProfiles'
                          ? trackerApi.exportCandidatesXlsx(token, 'abudhabi')
                          : trackerApi.exportFollowUpsXlsx(token, 'abudhabi'),
                    ]);
                    const base = view === 'jobOpenings' ? 'job_openings' : view === 'candidateProfiles' ? 'candidates' : 'follow_ups';
                    downloadBlob(dxb, `${base}_dubai.xlsx`);
                    downloadBlob(ad, `${base}_abudhabi.xlsx`);
                    return;
                  }

                  const blob =
                    view === 'jobOpenings'
                      ? await trackerApi.exportJobOpeningsXlsx(token, apiTeam)
                      : view === 'candidateProfiles'
                        ? await trackerApi.exportCandidatesXlsx(token, apiTeam)
                        : await trackerApi.exportFollowUpsXlsx(token, apiTeam);
                  downloadBlob(blob, view === 'jobOpenings' ? 'job_openings.xlsx' : view === 'candidateProfiles' ? 'candidates.xlsx' : 'follow_ups.xlsx');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          {/* Row 2: filters (Requirement/Candidate only; Follow-ups & Manager Settings have their own) */}
          {view !== 'followUps' && view !== 'managerSettings' ? (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[180px] text-[13px] bg-white border-gray-200 text-gray-800">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  <SelectItem value="all">All Status</SelectItem>
                  {(view === 'jobOpenings' ? jobStatusOptions : candidateStatusOptions).map((o) => (
                    <SelectItem key={o.id} value={o.value}>{o.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LocationFilter
                value={filterLocation}
                onChange={setFilterLocation}
                options={locationOptions}
                canManage={false}
                onAdd={noopAsync}
              />
              <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={view === 'jobOpenings' ? 'Search role, client…' : 'Search name, position…'}
                  className="w-full h-8 pl-3 pr-8 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00529b]/20 focus:border-[#00529b]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Content area — scrollable */}
        <div
          className={`flex-1 overflow-auto p-4 transition-opacity duration-150 ${
            loading && (jobOpenings.length > 0 || candidates.length > 0) ? 'opacity-60' : 'opacity-100'
          }`}
        >
          {error && (
            <div className="mb-3 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-[13px]">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
            </div>
          )}

          {view === 'jobOpenings' ? (
            /* ────── Requirement Status table ────── */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 text-left w-[110px]">Date</th>
                      {isAllTeamsView ? <th className="px-4 py-3 text-left w-[110px]">Team</th> : null}
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left w-[140px]">Client</th>
                      <th className="px-4 py-3 text-left w-[150px]">Location</th>
                      <th className="px-4 py-3 text-left w-[155px]">Recruiter</th>
                      <th className="px-4 py-3 text-left w-[170px]">Recruitment Manager</th>
                      <th className="px-4 py-3 text-left w-[155px]">Account Manager</th>
                      <th className="px-4 py-3 text-left w-[170px]">Status</th>
                      <th className="px-4 py-3 text-right w-[72px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80">
                    {visibleJobOpenings.length === 0 ? (
                      <tr>
                        <td colSpan={isAllTeamsView ? 10 : 9} className="px-5 py-16 text-center text-gray-400 text-[13px]">
                          {canWriteJobs
                            ? 'No requirements yet — click + New Requirement to add one.'
                            : 'No requirements yet.'}
                        </td>
                      </tr>
                    ) : visibleJobOpenings.map((j) => (
                      <tr key={j.id} className="hover:bg-blue-50/20 transition-colors group">
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-[12px]">
                          {j.req_date ? formatDate(String(j.req_date)) : <span className="text-gray-300">—</span>}
                        </td>
                        {isAllTeamsView ? (
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-[12px]">{(j as any).__team || '—'}</td>
                        ) : null}
                        {/* Role — stored in title */}
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{j.title}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-[12px]">
                          {(j.client || j.location) ? (j.client || j.location) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {canWriteJobs ? (
                            <ManagedSelect
                              label="Location"
                              value={j.work_location || ''}
                              disabled={!!rowBusy[j.id]}
                              canManage={false}
                              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { work_location: v } as any, apiTeam); await refreshAll(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{j.work_location || '—'}</span>
                          )}
                        </td>
                        {/* Recruiter — stored in hiring_manager */}
                        <td className="px-3 py-2">
                          {canWriteJobs ? (
                            <ManagedSelect
                              label="Recruiter"
                              value={j.hiring_manager || ''}
                              disabled={!!rowBusy[j.id]}
                              canManage={false}
                              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { hiring_manager: v } as any, apiTeam); await refreshAll(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{j.hiring_manager || '—'}</span>
                          )}
                        </td>
                        {/* Recruitment Manager */}
                        <td className="px-3 py-2">
                          {canWriteJobs ? (
                            <ManagedSelect
                              label="Recruitment Manager"
                              value={j.recruitment_manager || ''}
                              disabled={!!rowBusy[j.id]}
                              canManage={false}
                              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { recruitment_manager: v } as any, apiTeam); await refreshAll(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{j.recruitment_manager || '—'}</span>
                          )}
                        </td>

                        {/* Account Manager — stored in department */}
                        <td className="px-3 py-2">
                          {canWriteJobs ? (
                            <ManagedSelect
                              label="Account Manager"
                              value={j.department || ''}
                              disabled={!!rowBusy[j.id]}
                              canManage={false}
                              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { department: v } as any, apiTeam); await refreshAll(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{j.department || '—'}</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-3 py-2">
                          {canWriteJobs ? (
                            <ManagedSelect
                              label="Status"
                              value={j.status || ''}
                              disabled={!!rowBusy[j.id]}
                              canManage={false}
                              options={jobStatusOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [j.id]: true }));
                                try { await trackerApi.updateJobOpening(token, j.id, { status: v } as any, apiTeam); await refreshAll(); }
                                finally { setRowBusy((s) => ({ ...s, [j.id]: false })); }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <StatusBadge label={j.status} />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {canWriteJobs ? (
                              <>
                                <button
                                  onClick={() => setEditJob(j)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(j.id); setConfirmDeleteType('job'); }}
                                  disabled={!!rowBusy[j.id]}
                                  className="p-1 rounded-md border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-40"
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
          ) : view === 'candidateProfiles' ? (
            /* ────── Selections & Joinings table ────── */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 text-left w-[110px]">Date</th>
                      {isAllTeamsView ? <th className="px-4 py-3 text-left w-[110px]">Team</th> : null}
                      <th className="px-4 py-3 text-left w-[155px]">Candidate</th>
                      <th className="px-4 py-3 text-left w-[145px]">Position</th>
                      <th className="px-4 py-3 text-left w-[130px]">Client</th>
                      <th className="px-4 py-3 text-left w-[145px]">Location</th>
                      <th className="px-4 py-3 text-left w-[170px]">Status</th>
                      <th className="px-4 py-3 text-left w-[145px]">Recruiter</th>
                      <th className="px-4 py-3 text-left w-[155px]">Account Manager</th>
                      <th className="px-4 py-3 text-left w-[170px]">Recruitment Manager</th>
                      <th className="px-4 py-3 text-left">Comment</th>
                      <th className="px-4 py-3 text-right w-[72px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80">
                    {candidateRows.length === 0 ? (
                      <tr>
                        <td colSpan={isAllTeamsView ? 12 : 11} className="px-5 py-16 text-center text-gray-400 text-[13px]">
                          {canWriteCandidates
                            ? 'No candidates yet — click + New Candidate to add one.'
                            : 'No candidates yet.'}
                        </td>
                      </tr>
                    ) : candidateRows.map(({ cand, app }) => (
                      <tr key={cand.id} className="hover:bg-blue-50/20 transition-colors group">
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-[12px]">
                          {app?.applied_date ? formatDate(String(app.applied_date)) : <span className="text-gray-300">—</span>}
                        </td>
                        {isAllTeamsView ? (
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-[12px]">{(cand as any).__team || '—'}</td>
                        ) : null}
                        <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{cand.name}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-[12px]">{app?.position || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-[12px]">{app?.client || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">
                          {canWriteCandidates ? (
                            <ManagedSelect
                              label="Location"
                              value={app?.location || ''}
                              disabled={!!rowBusy[cand.id]}
                              canManage={false}
                              options={locationOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [cand.id]: true }));
                                try {
                                  const resolvedApp =
                                    app ??
                                    (await trackerApi.createApplication(token, {
                                      candidate_id: cand.id,
                                      status: 'MRF Pending',
                                    }, apiTeam));
                                  await trackerApi.updateApplication(token, resolvedApp.id, { location: v || null }, apiTeam);
                                  await refreshAll();
                                } finally {
                                  setRowBusy((s) => ({ ...s, [cand.id]: false }));
                                }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{app?.location || <span className="text-gray-300">—</span>}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canWriteCandidates ? (
                            <ManagedSelect
                              label="Status"
                              value={app?.status || ''}
                              disabled={!!rowBusy[cand.id]}
                              canManage={false}
                              options={candidateStatusOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [cand.id]: true }));
                                try {
                                  const resolvedApp =
                                    app ??
                                    (await trackerApi.createApplication(token, {
                                      candidate_id: cand.id,
                                      status: 'MRF Pending',
                                    }, apiTeam));
                                  await trackerApi.updateApplication(token, resolvedApp.id, { status: v || null }, apiTeam);
                                  await refreshAll();
                                } finally {
                                  setRowBusy((s) => ({ ...s, [cand.id]: false }));
                                }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : app ? (
                            <StatusBadge label={app.status} />
                          ) : (
                            <span className="text-gray-300 text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canWriteCandidates ? (
                            <ManagedSelect
                              label="Recruiter"
                              value={app?.recruiter || ''}
                              disabled={!!rowBusy[cand.id]}
                              canManage={false}
                              options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [cand.id]: true }));
                                try {
                                  const resolvedApp =
                                    app ??
                                    (await trackerApi.createApplication(token, {
                                      candidate_id: cand.id,
                                      status: 'MRF Pending',
                                    }, apiTeam));
                                  await trackerApi.updateApplication(token, resolvedApp.id, { recruiter: v || null }, apiTeam);
                                  await refreshAll();
                                } finally {
                                  setRowBusy((s) => ({ ...s, [cand.id]: false }));
                                }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{app?.recruiter || <span className="text-gray-300">—</span>}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canWriteCandidates ? (
                            <ManagedSelect
                              label="Account Manager"
                              value={app?.account_manager || ''}
                              disabled={!!rowBusy[cand.id]}
                              canManage={false}
                              options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [cand.id]: true }));
                                try {
                                  const resolvedApp =
                                    app ??
                                    (await trackerApi.createApplication(token, {
                                      candidate_id: cand.id,
                                      status: 'MRF Pending',
                                    }, apiTeam));
                                  await trackerApi.updateApplication(token, resolvedApp.id, { account_manager: v || null }, apiTeam);
                                  await refreshAll();
                                } finally {
                                  setRowBusy((s) => ({ ...s, [cand.id]: false }));
                                }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{app?.account_manager || <span className="text-gray-300">—</span>}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canWriteCandidates ? (
                            <ManagedSelect
                              label="Recruitment Manager"
                              value={app?.recruitment_manager || ''}
                              disabled={!!rowBusy[cand.id]}
                              canManage={false}
                              options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                              onChange={async (v) => {
                                if (!token) return;
                                setRowBusy((s) => ({ ...s, [cand.id]: true }));
                                try {
                                  const resolvedApp =
                                    app ??
                                    (await trackerApi.createApplication(token, {
                                      candidate_id: cand.id,
                                      status: 'MRF Pending',
                                    }, apiTeam));
                                  await trackerApi.updateApplication(token, resolvedApp.id, { recruitment_manager: v || null }, apiTeam);
                                  await refreshAll();
                                } finally {
                                  setRowBusy((s) => ({ ...s, [cand.id]: false }));
                                }
                              }}
                              onAdd={noopAsync}
                              onEdit={noopAsync as any}
                              onDelete={noopAsync as any}
                            />
                          ) : (
                            <span className="text-[12px] text-gray-600">{app?.recruitment_manager || <span className="text-gray-300">—</span>}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-[12px] max-w-[200px]">
                          {app?.comment
                            ? <span className="line-clamp-2">{app.comment}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {canWriteCandidates ? (
                              <>
                                <button
                                  onClick={async () => {
                                    if (!token) return;
                                    let resolvedApp = app;
                                    if (!resolvedApp) {
                                      resolvedApp = await trackerApi.createApplication(token, {
                                        candidate_id: cand.id,
                                        status: 'MRF Pending',
                                      }, apiTeam);
                                      await refresh();
                                    }
                                    setEditApp({ app: resolvedApp, cand });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(cand.id); setConfirmDeleteType('candidate'); }}
                                  disabled={!!rowBusy[cand.id]}
                                  className="p-1 rounded-md border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-40"
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
          ) : view === 'followUps' ? (
            /* ────── Follow-ups table ────── */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[13px] text-gray-600">
                      Default sort: <span className="font-semibold text-gray-800">Next Follow-up Date (ASC)</span>
                    </div>
                    {canWriteCandidates ? (
                      <Button
                        size="sm"
                        onClick={() => setEditFollowUp({ mode: 'create' })}
                        className="bg-[#00529b] hover:bg-[#003d73] !text-white gap-1.5"
                      >
                        <Plus className="w-4 h-4 text-white" /> New Follow-up
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="relative sm:col-span-2">
                      <input
                        value={followupSearch}
                        onChange={(e) => setFollowupSearch(e.target.value)}
                        placeholder="Search follow-ups (client, position, recruiter, manager…)"
                        className="h-8 w-full pl-3 pr-8 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00529b]/20 focus:border-[#00529b]"
                      />
                      {followupSearch ? (
                        <button
                          onClick={() => setFollowupSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label="Clear follow-up search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <Select value={followupStageFilter} onValueChange={setFollowupStageFilter}>
                      <SelectTrigger className="h-8 w-full text-[13px] bg-white border-gray-200 text-gray-800">
                        <SelectValue placeholder="Current Stage" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto pointer-events-auto">
                        <SelectItem value="all">All Stages</SelectItem>
                        {(followUpStageOptions?.length ? followUpStageOptions : (FOLLOW_UP_STAGE_OPTIONS.map((s) => ({ id: `stage:${s}`, value: s })) as any)).map((o: any) => (
                          <SelectItem key={o.id} value={o.value}>{o.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={followupNextFrom}
                        onChange={(e) => setFollowupNextFrom(e.target.value)}
                        className="h-8 px-2 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00529b]/20 focus:border-[#00529b] w-full"
                        aria-label="Next Follow-up Date from"
                      />
                      <span className="text-[12px] text-gray-400">to</span>
                      <input
                        type="date"
                        value={followupNextTo}
                        onChange={(e) => setFollowupNextTo(e.target.value)}
                        className="h-8 px-2 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00529b]/20 focus:border-[#00529b] w-full"
                        aria-label="Next Follow-up Date to"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1500px] text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 text-left w-[160px]">Client Name</th>
                      {isAllTeamsView ? <th className="px-4 py-3 text-left w-[110px]">Team</th> : null}
                      <th className="px-4 py-3 text-left w-[160px]">Position</th>
                      <th className="px-4 py-3 text-left w-[160px]">Recruiter Name</th>
                      <th className="px-4 py-3 text-left w-[170px]">Account Manager</th>
                      <th className="px-4 py-3 text-left w-[170px]">Recruitment Manager</th>
                      <th className="px-4 py-3 text-left w-[140px]">CV Submitted Date</th>
                      <th className="px-4 py-3 text-left w-[190px]">Current Stage</th>
                      <th className="px-4 py-3 text-left w-[140px]">Follow Up Date</th>
                      <th className="px-4 py-3 text-left w-[150px]">Next Follow-up Date</th>
                      <th className="px-4 py-3 text-left w-[170px]">Last Reminder Sent</th>
                      <th className="px-4 py-3 text-left w-[130px]">Interview Date</th>
                      <th className="px-4 py-3 text-left w-[220px]">Client Feedback</th>
                      <th className="px-4 py-3 text-left w-[220px]">Interview Feedback</th>
                      <th className="px-4 py-3 text-left w-[220px]">Remarks</th>
                      <th className="px-4 py-3 text-right w-[90px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80">
                    {visibleFollowUps.length === 0 ? (
                      <tr>
                        <td colSpan={isAllTeamsView ? 16 : 15} className="px-5 py-16 text-center text-gray-400 text-[13px]">
                          {canWriteCandidates
                            ? 'No follow-ups yet — click + New Follow-up to add one.'
                            : 'No follow-ups yet.'}
                        </td>
                      </tr>
                    ) : visibleFollowUps.map((r) => {
                      const overdue = isOverdue(r.next_follow_up_date, r.current_stage);
                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors group ${
                            overdue ? 'bg-red-50 hover:bg-red-50' : 'hover:bg-blue-50/20'
                          }`}
                        >
                          <td className="px-4 py-2.5 font-semibold text-gray-900">{r.client_name}</td>
                          {isAllTeamsView ? (
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-[12px]">{(r as any).__team || '—'}</td>
                          ) : null}
                          <td className="px-4 py-2.5 text-gray-700">{r.position || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2">
                            {canWriteCandidates ? (
                              <ManagedSelect
                                label="Recruiter"
                                value={r.recruiter_name || ''}
                                disabled={!!rowBusy[r.id]}
                                canManage={false}
                                options={recruiterOptions.map((o) => ({ id: o.id, value: o.value }))}
                                onChange={async (v) => {
                                  if (!token) return;
                                  setRowBusy((s) => ({ ...s, [r.id]: true }));
                                  try { await trackerApi.updateFollowUp(token, r.id, { recruiter_name: v } as any, apiTeam); await refresh(); }
                                  finally { setRowBusy((s) => ({ ...s, [r.id]: false })); }
                                }}
                                onAdd={noopAsync}
                                onEdit={noopAsync as any}
                                onDelete={noopAsync as any}
                              />
                            ) : (
                              <span className="text-[12px] text-gray-700">{r.recruiter_name || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canWriteCandidates ? (
                              <ManagedSelect
                                label="Account Manager"
                                value={r.account_manager || ''}
                                disabled={!!rowBusy[r.id]}
                                canManage={false}
                                options={accountManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                                onChange={async (v) => {
                                  if (!token) return;
                                  setRowBusy((s) => ({ ...s, [r.id]: true }));
                                  try { await trackerApi.updateFollowUp(token, r.id, { account_manager: v } as any, apiTeam); await refresh(); }
                                  finally { setRowBusy((s) => ({ ...s, [r.id]: false })); }
                                }}
                                onAdd={noopAsync}
                                onEdit={noopAsync as any}
                                onDelete={noopAsync as any}
                              />
                            ) : (
                              <span className="text-[12px] text-gray-700">{r.account_manager || '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canWriteCandidates ? (
                              <ManagedSelect
                                label="Recruitment Manager"
                                value={r.recruitment_manager || ''}
                                disabled={!!rowBusy[r.id]}
                                canManage={false}
                                options={recruitmentManagerOptions.map((o) => ({ id: o.id, value: o.value }))}
                                onChange={async (v) => {
                                  if (!token) return;
                                  setRowBusy((s) => ({ ...s, [r.id]: true }));
                                  try { await trackerApi.updateFollowUp(token, r.id, { recruitment_manager: v } as any, apiTeam); await refresh(); }
                                  finally { setRowBusy((s) => ({ ...s, [r.id]: false })); }
                                }}
                                onAdd={noopAsync}
                                onEdit={noopAsync as any}
                                onDelete={noopAsync as any}
                              />
                            ) : (
                              <span className="text-[12px] text-gray-700">{r.recruitment_manager || '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-[12px] whitespace-nowrap">{r.cv_submitted_date ? formatDate(String(r.cv_submitted_date)) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5">
                            {canWriteCandidates ? (
                              <ManagedSelect
                                label="Current Stage"
                                value={r.current_stage || ''}
                                disabled={!!rowBusy[r.id]}
                                canManage={false}
                                options={(followUpStageOptions?.length ? followUpStageOptions : (FOLLOW_UP_STAGE_OPTIONS.map((s) => ({ id: `stage:${s}`, value: s })) as any)).map((o: any) => ({ id: o.id, value: o.value }))}
                                onChange={async (v) => {
                                  if (!token) return;
                                  setRowBusy((s) => ({ ...s, [r.id]: true }));
                                  try { await trackerApi.updateFollowUp(token, r.id, { current_stage: v } as any, apiTeam); await refresh(); }
                                  finally { setRowBusy((s) => ({ ...s, [r.id]: false })); }
                                }}
                                onAdd={noopAsync}
                                onEdit={noopAsync as any}
                                onDelete={noopAsync as any}
                              />
                            ) : (
                              <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-semibold ${stageBadgeClass(r.current_stage, overdue)}`}>
                                {overdue && r.current_stage !== 'Overdue Follow-ups' ? `Overdue Follow-ups` : r.current_stage}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-[12px] whitespace-nowrap">{r.last_follow_up_date ? formatDate(String(r.last_follow_up_date)) : <span className="text-gray-300">—</span>}</td>
                          <td className={`px-4 py-2.5 text-[12px] whitespace-nowrap ${overdue ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                            {r.next_follow_up_date ? formatDate(String(r.next_follow_up_date)) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-[12px] whitespace-nowrap">
                            {r.reminder_last_sent_at ? (
                              <span title={formatDateTime(String(r.reminder_last_sent_at))}>{formatDateTime(String(r.reminder_last_sent_at))}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-[12px] whitespace-nowrap">{r.interview_date ? formatDate(String(r.interview_date)) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {r.client_feedback ? (
                              <button
                                type="button"
                                className="text-left text-[12px] text-gray-700 hover:text-[#00529b] underline-offset-2 hover:underline"
                                title="Click to view full text"
                                onClick={() => setTextPeek({ title: 'Client Feedback', text: String(r.client_feedback) })}
                              >
                                {truncate10(r.client_feedback)}
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {r.interview_feedback ? (
                              <button
                                type="button"
                                className="text-left text-[12px] text-gray-700 hover:text-[#00529b] underline-offset-2 hover:underline"
                                title="Click to view full text"
                                onClick={() => setTextPeek({ title: 'Interview Feedback', text: String(r.interview_feedback) })}
                              >
                                {truncate10(r.interview_feedback)}
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {r.remarks ? (
                              <button
                                type="button"
                                className="text-left text-[12px] text-gray-700 hover:text-[#00529b] underline-offset-2 hover:underline"
                                title="Click to view full text"
                                onClick={() => setTextPeek({ title: 'Remarks', text: String(r.remarks) })}
                              >
                                {truncate10(r.remarks)}
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {canWriteCandidates ? (
                                <>
                                  <button
                                    onClick={() => setEditFollowUp({ mode: 'edit', row: r })}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                  >
                                    <Pencil className="w-3 h-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => { setConfirmDeleteId(r.id); setConfirmDeleteType('followup'); }}
                                    className="p-1 rounded-md border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ────── Manager Settings ────── */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {!canAccessManagerSettings ? (
                <div className="p-6 text-[13px] text-gray-600">
                  You don’t have access to Manager Settings.
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[14px] font-bold text-gray-900">Manager Settings</div>
                      <div className="text-[12px] text-gray-500 mt-0.5">
                        Central master list for Recruiters, Account Managers, and Recruitment Managers.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-[12px] text-gray-600">
                        <input
                          type="checkbox"
                          checked={msShowInactive}
                          onChange={(e) => setMsShowInactive(e.target.checked)}
                        />
                        Show inactive
                      </label>
                      {isAdmin && teamView === 'dubai' ? (
                        <Button
                          variant="outline"
                          disabled={!token || msLoading}
                          className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={async () => {
                            if (!token) return;
                            if (!window.confirm('This will CLEAR ALL Dubai Tracker data (Requirement Status, Selections & Joinings, Follow-ups, and Manager Settings). Abu Dhabi data will NOT be affected. Continue?')) return;
                            const res = await fetch('/api/tracker/admin/clear-team?team=dubai&confirm=CLEAR', {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!res.ok) {
                              const msg = await res.text();
                              window.alert(msg || 'Failed to clear Dubai data');
                              return;
                            }
                            window.alert('Dubai tracker data cleared.');
                            await refreshAll();
                            await loadManagerSettings();
                          }}
                          title="Clear Dubai tracker tables only"
                        >
                          Clear Dubai Data
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={loadManagerSettings}
                        disabled={!token || msLoading}
                        className="h-8"
                      >
                        {msLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Refresh
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 mt-5">
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-[13px] font-bold text-gray-800">Follow-up Reminders</div>
                          <div className="text-[12px] text-gray-500 mt-0.5">
                            Uses the selected Account Manager (To) and Recruitment Manager (CC) emails from Manager Settings. Enable sending with{' '}
                            <code className="px-1 py-0.5 bg-gray-100 rounded">SEND_EMAIL_REMINDER_FOLLOWUP=true</code>.
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-3 mb-3">
                          <div className="text-[12px] font-semibold text-gray-800">Send time (UAE)</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Choose the daily time reminders should be sent for this team (Dubai/Abu Dhabi). Changing the time today will send again at the new time.
                          </div>
                          <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                            <input
                              type="time"
                              value={msReminderTime}
                              onChange={(e) => setMsReminderTime(e.target.value)}
                              className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00529b] focus:border-[#00529b] w-full sm:w-[160px]"
                            />
                            <Button
                              disabled={!token || msReminderTimeSaving || !msReminderTime}
                              className="bg-[#00529b] hover:bg-[#003d73] !text-white h-9"
                              onClick={async () => {
                                if (!token) return;
                                const v = (msReminderTime || '').trim();
                                if (!v) return;
                                setMsReminderTimeSaving(true);
                                try {
                                  if (msReminderTimeId) {
                                    await trackerApi.updateOption(token, msReminderTimeId, { value: v }, apiTeam);
                                  } else {
                                    const created = await trackerApi.createOption(token, 'followup_reminder_send_time', v, apiTeam);
                                    setMsReminderTimeId(created.id);
                                  }
                                  window.alert('Reminder send time saved.');
                                  await loadManagerSettings();
                                } catch (e: any) {
                                  const msg =
                                    e?.response?.data?.detail ??
                                    e?.response?.data?.error ??
                                    e?.message ??
                                    'Failed to save reminder time';
                                  window.alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
                                } finally {
                                  setMsReminderTimeSaving(false);
                                }
                              }}
                            >
                              {msReminderTimeSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Save time
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="text-[12px] font-semibold text-gray-800">Send reminder now</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Select a Follow-up row and send an email (To/CC resolved automatically from the row).
                          </div>
                          <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex-1">
                              <Select value={msSendFollowupId} onValueChange={setMsSendFollowupId}>
                                <SelectTrigger className="h-9 bg-white border-gray-300 text-gray-900">
                                  <SelectValue placeholder="Select follow-up…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(followUps || [])
                                    .slice()
                                    .sort((a, b) => {
                                      const ad = a.next_follow_up_date ? new Date(a.next_follow_up_date).getTime() : Number.POSITIVE_INFINITY;
                                      const bd = b.next_follow_up_date ? new Date(b.next_follow_up_date).getTime() : Number.POSITIVE_INFINITY;
                                      return ad - bd;
                                    })
                                    .slice(0, 200)
                                    .map((f) => {
                                      const label = `${f.client_name}${f.position ? ` • ${f.position}` : ''}${f.next_follow_up_date ? ` • Next: ${formatDate(f.next_follow_up_date)}` : ''}`;
                                      return (
                                        <SelectItem key={f.id} value={f.id}>
                                          {label}
                                        </SelectItem>
                                      );
                                    })}
                                </SelectContent>
                              </Select>
                              <div className="text-[10px] text-gray-400 mt-1">
                                Showing up to 200 follow-ups (sorted by Next Follow-up Date).
                              </div>
                            </div>
                            <Button
                              disabled={!token || !msSendFollowupId || msSendingFollowupReminder}
                              className="bg-[#0f766e] hover:bg-[#115e59] !text-white h-9"
                              onClick={async () => {
                                if (!token || !msSendFollowupId) return;
                                setMsSendingFollowupReminder(true);
                                try {
                                  await trackerApi.sendFollowupReminderNow(token, msSendFollowupId, undefined, apiTeam);
                                  window.alert('Reminder email sent.');
                                  await refresh();
                                } catch (e: any) {
                                  const msg =
                                    e?.response?.data?.detail ??
                                    e?.response?.data?.error ??
                                    e?.message ??
                                    'Failed to send reminder';
                                  window.alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
                                } finally {
                                  setMsSendingFollowupReminder(false);
                                }
                              }}
                              title="Send reminder email now"
                            >
                              {msSendingFollowupReminder ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Send now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {([
                      { kind: 'recruiter', label: 'Recruiters', rows: msRecruiters },
                      { kind: 'account_manager', label: 'Account Managers', rows: msAccountManagers },
                      { kind: 'recruitment_manager', label: 'Recruitment Managers', rows: msRecruitmentManagers },
                      { kind: 'location', label: 'Locations', rows: msLocations },
                      { kind: 'job_status', label: 'Requirement Status (Status)', rows: msRequirementStatuses },
                      { kind: 'candidate_status', label: 'Selections & Joinings (Status)', rows: msSelectionStatuses },
                      { kind: 'followup_stage', label: 'Follow-ups (Current Stage)', rows: msFollowUpStages },
                    ] as const).map((sec) => {
                      const rows = (sec.rows || []).filter((r) => msShowInactive || !r.is_deleted);
                      const inactiveCount = (sec.rows || []).filter((r) => r.is_deleted).length;
                      const showsEmail = sec.kind === 'account_manager' || sec.kind === 'recruitment_manager';
                      const showsReminder = sec.kind === 'account_manager';
                      const colSpan = 1 + (showsEmail ? 1 : 0) + (showsReminder ? 1 : 0) + 1 + 1;
                      return (
                        <div key={sec.kind} className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                            <div className="text-[13px] font-bold text-gray-800">{sec.label}</div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!token || inactiveCount === 0}
                                onClick={async () => {
                                  if (!token) return;
                                  if (!window.confirm(`Permanently delete ${inactiveCount} inactive entr${inactiveCount === 1 ? 'y' : 'ies'}? This only cleans tracker settings; historical records stay unchanged.`)) return;
                                  await trackerApi.purgeInactiveOptions(token, sec.kind);
                                  await loadManagerSettings();
                                  await loadOptions();
                                }}
                                className="h-8"
                                title="Permanently delete inactive (soft-deleted) names"
                              >
                                Purge inactive
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setMsAddOpen(sec.kind);
                                  setMsDraft('');
                                  setMsEmailDraft('');
                                  setMsEmailEnabledDraft(true);
                                }}
                                className="bg-[#00529b] hover:bg-[#003d73] !text-white h-8"
                                disabled={!token}
                              >
                                <Plus className="w-4 h-4 text-white mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                              <thead>
                                <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                  <th className="px-3 py-2 text-left">Name</th>
                                  {showsEmail ? (
                                    <th className="px-3 py-2 text-left">Email</th>
                                  ) : null}
                                  {showsReminder ? (
                                    <th className="px-3 py-2 text-left w-[120px]">Reminder</th>
                                  ) : null}
                                  <th className="px-3 py-2 text-left w-[70px]">Active</th>
                                  <th className="px-3 py-2 text-right w-[90px]">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {rows.length === 0 ? (
                                  <tr>
                                    <td colSpan={colSpan} className="px-3 py-8 text-center text-gray-400">No entries</td>
                                  </tr>
                                ) : rows.map((r) => (
                                  <tr key={r.id} className="hover:bg-blue-50/20">
                                    <td className="px-3 py-2 font-semibold text-gray-900">{r.value}</td>
                                    {sec.kind !== 'recruiter' ? (
                                      <td className="px-3 py-2 text-[12px] text-gray-700">{r.email || '—'}</td>
                                    ) : null}
                                    {sec.kind === 'account_manager' ? (
                                      <td className="px-3 py-2">
                                        <button
                                          className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${
                                            (r.email_enabled ?? true)
                                              ? 'border-green-200 text-green-700 hover:bg-green-50'
                                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                          }`}
                                          title="Toggle sending reminders for this Account Manager"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!token) return;
                                            await trackerApi.updateOption(token, r.id, { email_enabled: !(r.email_enabled ?? true) });
                                            await loadManagerSettings();
                                            await loadOptions();
                                          }}
                                        >
                                          {(r.email_enabled ?? true) ? 'ON' : 'OFF'}
                                        </button>
                                      </td>
                                    ) : null}
                                    <td className="px-3 py-2 text-[12px] text-gray-700">{r.is_deleted ? 'No' : 'Yes'}</td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={() => {
                                            setMsEdit({ id: r.id, kind: sec.kind, value: r.value });
                                            setMsDraft(r.value);
                                            setMsEmailDraft(String(r.email || ''));
                                            setMsEmailEnabledDraft(Boolean(r.email_enabled ?? true));
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-[#00529b] hover:text-[#00529b] transition-colors"
                                        >
                                          <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (!token) return;
                                            if (!window.confirm('Mark as inactive? Historical records will stay unchanged.')) return;
                                            await trackerApi.deleteOption(token, r.id);
                                            await loadManagerSettings();
                                            await loadOptions();
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add dialog */}
                  {msAddOpen ? (
                    <Dialog open onOpenChange={(o) => { if (!o) setMsAddOpen(null); }}>
                      <DialogContent className="sm:max-w-md bg-white text-gray-900">
                        <DialogHeader>
                          <DialogTitle className="text-[#00529b]">Add {msAddOpen.replace('_', ' ')}</DialogTitle>
                          <DialogDescription>Add a new active name.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-2">
                          <Input value={msDraft} onChange={(e) => setMsDraft(e.target.value)} placeholder="Name" />
                        </div>
                        {msAddOpen === 'account_manager' || msAddOpen === 'recruitment_manager' ? (
                          <div className="pt-2">
                            <Input value={msEmailDraft} onChange={(e) => setMsEmailDraft(e.target.value)} placeholder="Email (optional)" />
                          </div>
                        ) : null}
                        {msAddOpen === 'account_manager' ? (
                          <label className="flex items-center gap-2 pt-2 text-[12px] text-gray-700">
                            <input
                              type="checkbox"
                              checked={msEmailEnabledDraft}
                              onChange={(e) => setMsEmailEnabledDraft(e.target.checked)}
                            />
                            Send reminder (ON/OFF)
                          </label>
                        ) : null}
                        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                          <Button variant="outline" onClick={() => setMsAddOpen(null)}>Cancel</Button>
                          <Button
                            className="bg-[#00529b] hover:bg-[#003d73] text-white"
                            disabled={!token || !msDraft.trim()}
                            onClick={async () => {
                              if (!token) return;
                              await trackerApi.createOption(
                                token,
                                msAddOpen,
                                msDraft.trim(),
                                apiTeam,
                                msAddOpen === 'account_manager' || msAddOpen === 'recruitment_manager'
                                  ? {
                                      email: msEmailDraft.trim() || null,
                                      email_enabled: msAddOpen === 'account_manager' ? msEmailEnabledDraft : true,
                                    }
                                  : undefined
                              );
                              setMsAddOpen(null);
                              await loadManagerSettings();
                              await loadOptions();
                            }}
                          >
                            Create
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : null}

                  {/* Edit dialog */}
                  {msEdit ? (
                    <Dialog open onOpenChange={(o) => { if (!o) setMsEdit(null); }}>
                      <DialogContent className="sm:max-w-md bg-white text-gray-900">
                        <DialogHeader>
                          <DialogTitle className="text-[#00529b]">Edit name</DialogTitle>
                          <DialogDescription>Rename this entry. Historical rows remain unchanged until you edit them.</DialogDescription>
                        </DialogHeader>
                        <div className="pt-2">
                          <Input value={msDraft} onChange={(e) => setMsDraft(e.target.value)} placeholder="Name" />
                        </div>
                        {msEdit.kind === 'account_manager' || msEdit.kind === 'recruitment_manager' ? (
                          <div className="pt-2">
                            <Input value={msEmailDraft} onChange={(e) => setMsEmailDraft(e.target.value)} placeholder="Email (optional)" />
                          </div>
                        ) : null}
                        {msEdit.kind === 'account_manager' ? (
                          <label className="flex items-center gap-2 pt-2 text-[12px] text-gray-700">
                            <input
                              type="checkbox"
                              checked={msEmailEnabledDraft}
                              onChange={(e) => setMsEmailEnabledDraft(e.target.checked)}
                            />
                            Send reminder (ON/OFF)
                          </label>
                        ) : null}
                        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                          <Button variant="outline" onClick={() => setMsEdit(null)}>Cancel</Button>
                          <Button
                            className="bg-[#00529b] hover:bg-[#003d73] text-white"
                            disabled={!token || !msDraft.trim()}
                            onClick={async () => {
                              if (!token) return;
                              await trackerApi.updateOption(token, msEdit.id, {
                                value: msDraft.trim(),
                                ...(msEdit.kind === 'account_manager' || msEdit.kind === 'recruitment_manager'
                                  ? { email: msEmailDraft.trim() || null }
                                  : {}),
                                ...(msEdit.kind === 'account_manager' ? { email_enabled: msEmailEnabledDraft } : {}),
                              });
                              setMsEdit(null);
                              await loadManagerSettings();
                              await loadOptions();
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <EditJobOpeningDialog
        job={editJob}
        onClose={() => setEditJob(null)}
        onSaved={refreshAll}
        team={apiTeam}
        jobStatusOptions={jobStatusOptions}
        recruiterOptions={recruiterOptions}
        accountManagerOptions={accountManagerOptions}
        recruitmentManagerOptions={recruitmentManagerOptions}
        locationOptions={locationOptions}
        canManageOptions={canManageJobOptions}
        onAddOption={createOption}
        onEditOption={editOption}
        onDeleteOption={deleteOption}
      />
      <EditApplicationDialog
        app={editApp?.app ?? null}
        cand={editApp?.cand ?? null}
        onClose={() => setEditApp(null)}
        onSaved={refreshAll}
        team={apiTeam}
        statusOptions={candidateStatusOptions}
        recruiterOptions={recruiterOptions}
        accountManagerOptions={accountManagerOptions}
        locationOptions={locationOptions}
        canManageOptions={canManageCandidateOptions}
        onAddOption={createOption}
        onEditOption={editOption}
        onDeleteOption={deleteOption}
      />
      {editFollowUp ? (
        <FollowUpDialog
          mode={editFollowUp.mode}
          initial={editFollowUp.mode === 'edit' ? editFollowUp.row : undefined}
          team={apiTeam}
          recruiterOptions={recruiterOptions}
          accountManagerOptions={accountManagerOptions}
          recruitmentManagerOptions={recruitmentManagerOptions}
          followUpStageOptions={followUpStageOptions}
          onClose={() => setEditFollowUp(null)}
          onSaved={refresh}
        />
      ) : null}

      {textPeek ? (
        <Dialog open onOpenChange={(o) => { if (!o) setTextPeek(null); }}>
          <DialogContent className="sm:max-w-lg bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle className="text-[#00529b]">{textPeek.title}</DialogTitle>
              <DialogDescription>Full text</DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-wrap text-[13px] text-gray-800 border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-[50vh] overflow-auto">
              {textPeek.text}
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setTextPeek(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Admin import dialog (Selections & Joinings) */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) { setImportOpen(false); setImportFile(null); } }}>
        <DialogContent className="sm:max-w-lg bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#0f766e]">Upload Selections & Joinings Excel</DialogTitle>
            <DialogDescription>
              Upload the exported <span className="font-semibold">candidates.xlsx</span> and choose which team table to import into.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-600">Team</div>
              <Select value={importTeam} onValueChange={(v) => setImportTeam(v as TrackerTeam)}>
                <SelectTrigger className="h-9 bg-white border-gray-200 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dubai">Dubai</SelectItem>
                  <SelectItem value="abudhabi">Abu Dhabi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-600">Excel file</div>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <div className="text-[12px] text-gray-500">
                Tip: Use the Tracker export for Selections & Joinings (it matches the required columns).
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setImportOpen(false); setImportFile(null); }}>
                Cancel
              </Button>
              <Button
                disabled={!token || !importFile || importBusy}
                onClick={async () => {
                  if (!token || !importFile) return;
                  setImportBusy(true);
                  try {
                    const fd = new FormData();
                    fd.append('file', importFile);
                    const res = await fetch(`/api/tracker/admin/import/selections-xlsx?team=${encodeURIComponent(importTeam)}`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                      body: fd,
                    });
                    if (!res.ok) {
                      const msg = await res.text();
                      throw new Error(msg || 'Import failed');
                    }
                    await refreshAll();
                    setImportOpen(false);
                    setImportFile(null);
                    window.alert('Import completed.');
                  } catch (e: any) {
                    window.alert(e?.message || 'Import failed');
                  } finally {
                    setImportBusy(false);
                  }
                }}
                className="bg-[#0f766e] hover:bg-[#115e59] text-white"
              >
                {importBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <p className="font-semibold text-gray-900">
                  Delete {confirmDeleteType === 'job' ? 'Requirement' : confirmDeleteType === 'candidate' ? 'Candidate' : 'Follow-up'}?
                </p>
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
                      await trackerApi.deleteJobOpening(token, confirmDeleteId, apiTeam);
                    } else if (confirmDeleteType === 'candidate') {
                      await trackerApi.deleteCandidate(token, confirmDeleteId, apiTeam);
                    } else {
                      await trackerApi.deleteFollowUp(token, confirmDeleteId, apiTeam);
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
