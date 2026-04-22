'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button-enhanced';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type ManagedOption = { id: string; value: string };

// Each row is ~32px, show 4.5 rows so scroll is obvious
const ITEM_H = 32;
const VISIBLE_ITEMS = 4;
const LIST_MAX_H = ITEM_H * VISIBLE_ITEMS + 8; // 8px padding

export function ManagedSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  canManage,
  onChange,
  onAdd,
  onEdit,
  onDelete,
}: {
  label: string;
  placeholder?: string;
  value: string;
  options: ManagedOption[];
  disabled?: boolean;
  canManage?: boolean;
  onChange: (value: string) => void | Promise<void>;
  onAdd: (value: string) => void | Promise<void>;
  onEdit: (id: string, value: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // Optimistic local delete — items removed immediately in UI, restored on error
  const [localDeleted, setLocalDeleted] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editOriginalValue, setEditOriginalValue] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const mergedOptions = useMemo(() => {
    const filtered = options.filter((o) => !localDeleted.has(o.id));
    const v = (value || '').trim();
    if (!v || filtered.some((o) => o.value === v)) return filtered;
    return [{ id: '__current__', value: v }, ...filtered];
  }, [options, value, localDeleted]);

  const computeStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const r = triggerRef.current.getBoundingClientRect();
    const panelH = LIST_MAX_H + (canManage ? 40 : 0) + 2; // list + add button + border
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const openUpward = spaceBelow < panelH && spaceAbove > spaceBelow;
    return {
      position: 'fixed' as const,
      left: r.left,
      width: Math.max(r.width, 220),
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    };
  };

  const openMenu = () => {
    setPanelStyle(computeStyle());
    setMenuOpen(true);
  };

  const closeMenu = () => setMenuOpen(false);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [menuOpen]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!menuOpen) return;
    const update = () => setPanelStyle(computeStyle());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const handleDelete = async (id: string) => {
    closeMenu();
    const deletedValue = options.find((o) => o.id === id)?.value ?? '';
    const current = (value || '').trim();
    const remaining = options.filter((o) => o.id !== id && !localDeleted.has(o.id));
    const nextValue = remaining[0]?.value ?? '';
    // If the deleted option is currently selected, immediately switch the field
    // so the UI feels responsive and the row no longer shows a removed name.
    if (deletedValue && current === deletedValue) {
      try {
        await onChange(nextValue);
      } catch {
        // ignore — deletion will still proceed, and parent refresh will reconcile
      }
    }
    // Optimistically remove from UI immediately
    setLocalDeleted((prev) => new Set(prev).add(id));
    try {
      await onDelete(id);
    } catch {
      // Restore on failure
      setLocalDeleted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const saveEdit = async () => {
    const id = editId;
    const v = draft.trim();
    if (!id || !v || saving) return;
    setSaving(true);
    try {
      await onEdit(id, v);
      // If the edited option is currently selected, update the field value too.
      const current = (value || '').trim();
      if (editOriginalValue && current === editOriginalValue) {
        await onChange(v);
      }
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const panel = menuOpen
    ? createPortal(
        <div
          ref={panelRef}
          data-managed-select-panel
          style={panelStyle}
          className="pointer-events-auto rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Scrollable list — capped to VISIBLE_ITEMS height */}
          <div style={{ maxHeight: LIST_MAX_H, overflowY: 'auto' }} className="py-1">
            {mergedOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 italic">No options yet</div>
            ) : mergedOptions.map((o) => {
              const isSelected = value === o.value;
              return (
                <div
                  key={o.id}
                  style={{ height: ITEM_H }}
                  className="flex items-center gap-1 px-2 text-sm hover:bg-blue-50/60 group/row"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 min-w-0 text-left h-full"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={async () => {
                      closeMenu();
                      await onChange(o.value);
                    }}
                  >
                    <span className="w-4 shrink-0 inline-flex items-center justify-center">
                      {isSelected ? <Check className="w-3.5 h-3.5 text-[#00529b]" /> : null}
                    </span>
                    <span className="truncate text-gray-800 font-[13px]">{o.value}</span>
                  </button>

                  {canManage && o.id !== '__current__' ? (
                    <span className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        title="Edit"
                        className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          closeMenu();
                          setEditId(o.id);
                          setEditOriginalValue(o.value);
                          setDraft(o.value);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => handleDelete(o.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="w-14 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {canManage && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#00529b] hover:bg-blue-50 font-semibold transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  closeMenu();
                  setDraft('');
                  setAddOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add new {label}…
              </button>
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!!disabled}
        onClick={menuOpen ? closeMenu : openMenu}
        className={[
          'flex h-8 w-full items-center justify-between rounded-lg border bg-white px-2.5 py-1 text-[13px] outline-none transition-all',
          disabled
            ? 'opacity-40 cursor-not-allowed border-gray-200'
            : menuOpen
            ? 'border-[#00529b] ring-2 ring-[#00529b]/15 shadow-sm'
            : 'border-gray-200 hover:border-gray-400 shadow-sm',
        ].join(' ')}
      >
        <span className={value ? 'text-gray-800 truncate flex-1 text-left' : 'text-gray-400 truncate flex-1 text-left'}>
          {value || placeholder || `Select…`}
        </span>
        <ChevronDown
          className={['h-3.5 w-3.5 shrink-0 text-gray-400 ml-1 transition-transform duration-150', menuOpen ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {panel}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#00529b]">Add {label}</DialogTitle>
            <DialogDescription>Type a new option and press Add.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`New ${label}`}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const v = draft.trim();
                  if (!v || saving) return;
                  setSaving(true);
                  try { await onAdd(v); setAddOpen(false); await onChange(v); } finally { setSaving(false); }
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!draft.trim() || saving}
                onClick={async () => {
                  const v = draft.trim();
                  if (!v || saving) return;
                  setSaving(true);
                  try { await onAdd(v); setAddOpen(false); await onChange(v); } finally { setSaving(false); }
                }}
                className="bg-[#00529b] hover:bg-[#003d73] text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-[#00529b]">Edit {label}</DialogTitle>
            <DialogDescription>Change the name, then click Save.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Rename ${label}`}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  await saveEdit();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!draft.trim() || saving}
                onClick={saveEdit}
                className="bg-[#00529b] hover:bg-[#003d73] text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
