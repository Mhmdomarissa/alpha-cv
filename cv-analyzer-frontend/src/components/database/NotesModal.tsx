import React, { useState, useEffect } from 'react';
import {
    MessageSquare, Trash2, Send, Clock, User
} from 'lucide-react';
import { api } from '@/lib/api';

interface NotesModalProps {
    cvId: string;
    cvName?: string;
    onClose: () => void;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'Just now';
    try {
        return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'N/A';
    }
};

export function NotesModal({ cvId, cvName, onClose }: NotesModalProps) {
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadNotes = async () => {
            try {
                setLoading(true);
                const response = await api.getNotes(cvId);
                setNotes(response.notes || []);
            } catch (err) {
                console.error('Failed to load notes', err);
            } finally {
                setLoading(false);
            }
        };
        if (cvId) {
            loadNotes();
        }
    }, [cvId]);

    const handleSaveNote = async () => {
        if (!newNote.trim()) return;

        try {
            setIsSubmitting(true);
            const user = JSON.parse(localStorage.getItem('user_profile') || '{}');
            const hrUser = user.username || user.email || 'HR';

            await api.addNote(cvId, newNote, hrUser);

            // Refresh notes
            const response = await api.getNotes(cvId);
            setNotes(response.notes || []);
            setNewNote('');
        } catch (err) {
            console.error('Failed to save note', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteNote = async (hrUser: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            await api.deleteNote(cvId, hrUser);
            // Refresh notes
            const response = await api.getNotes(cvId);
            setNotes(response.notes || []);
        } catch (err) {
            console.error('Failed to delete note', err);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[600px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Clock className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No notes yet.</p>
                        <p className="text-sm">Add a note to start the discussion.</p>
                    </div>
                ) : (
                    notes.map((note: any, i: number) => (
                        <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-100 group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-2">
                                    <div className="bg-blue-100 p-1.5 rounded-full">
                                        <User className="w-3 h-3 text-blue-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-900">{note.hr_user}</span>
                                        <span className="text-xs text-gray-500 ml-2">{formatDate(note.updated_at || note.created_at)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteNote(note.hr_user)}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Note"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed pl-9">
                                {note.note}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t bg-white">
                <div className="relative">
                    <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={`Add a note for ${cvName || 'this candidate'}...`}
                        className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                        rows={3}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveNote();
                            }
                        }}
                    />
                    <button
                        onClick={handleSaveNote}
                        disabled={!newNote.trim() || isSubmitting}
                        className={`absolute right-3 bottom-3 p-2 rounded-full transition-colors ${!newNote.trim() || isSubmitting
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-xs text-gray-400 mt-2 text-right">
                    Press Enter to send, Shift+Enter for new line
                </div>
            </div>
        </div>
    );
}
