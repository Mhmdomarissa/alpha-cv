'use client';
import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, FileText, Briefcase, Zap, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

/* ----------------------------- Small utilities ---------------------------- */
const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString();
    } catch {
        return 'N/A';
    }
};

const getJDBasics = (jd: any) => {
    const structured = jd.structured_info || {};
    const reqs = jd.job_requirements || {};
    return {
        title: reqs.job_title || structured.job_title || 'Untitled JD',
        years: reqs.years_of_experience || structured.years_of_experience || 'Not specified',
        skills: reqs.skills || structured.skills || [],
        responsibilities: reqs.responsibilities || structured.responsibilities || [],
        skillsCount: reqs.skills_count || (reqs.skills || []).length || 0,
        responsibilitiesCount: reqs.responsibilities_count || (reqs.responsibilities || []).length || 0,
    };
};

/* ---------------------------- JD Details --------------------------- */
export function JDDetails({ jdId }: { jdId: string }) {
    const [jd, setJD] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadJD = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await api.getJDDetails(jdId);
                setJD(response);
            } catch (err: any) {
                setError(err.message || 'Failed to load JD details');
            } finally {
                setLoading(false);
            }
        };
        loadJD();
    }, [jdId]);

    if (loading) return <div className="flex items-center justify-center py-8">Loading JD details...</div>;
    if (error)
        return (
            <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Job Description</h3>
                <p className="text-red-500 mb-4">{error}</p>
            </div>
        );
    if (!jd) return <div className="text-center py-8">Job Description not found</div>;

    const b = getJDBasics(jd);

    return (
        <div className="space-y-4">
            {/* Job Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Row label="Job Title" value={b.title} />
                    <Row label="Experience Required" value={`${b.years} years`} />
                    <Row label="Upload Date" value={formatDate(jd.upload_date)} />
                    <Row label="Document Type" value={jd.document_type || 'jd'} />
                </div>
            </div>

            {/* Required Skills */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Required Skills</h3>
                    <Badge className="ml-2">{b.skillsCount}</Badge>
                </div>
                {b.skillsCount > 0 ? (
                    <ul className="space-y-2">
                        {b.skills.map((s: string, i: number) => (
                            <li key={i} className="text-gray-700 flex items-start gap-2">
                                <Zap className="w-4 h-4 text-purple-500 mt-1 shrink-0" />
                                {s}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No skills information available</p>
                )}
            </div>

            {/* Responsibilities */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Responsibilities</h3>
                    <Badge className="ml-2">{b.responsibilitiesCount}</Badge>
                </div>
                {b.responsibilitiesCount > 0 ? (
                    <ul className="space-y-2">
                        {b.responsibilities.map((r: string, i: number) => (
                            <li key={i} className="text-gray-700 flex items-start gap-2">
                                <Star className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                                {r}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No responsibilities information available</p>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-lg font-semibold mb-3">Processing Info</h3>
                    <div className="space-y-2">
                        <Row label="Model Used" value={jd?.processing_metadata?.model_used || 'N/A'} />
                        <Row label="Skills Count" value={b.skillsCount} />
                        <Row label="Resp Count" value={b.responsibilitiesCount} />
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-lg font-semibold mb-3">Embeddings</h3>
                    <div className="space-y-2">
                        <Row label="Dimension" value={jd?.embeddings_info?.embedding_dimension || 'N/A'} />
                        <Row label="Title Vector" value={jd?.embeddings_info?.has_title_embedding ? 'Yes' : 'No'} />
                        <Row label="Exp Vector" value={jd?.embeddings_info?.has_experience_embedding ? 'Yes' : 'No'} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="text-sm font-medium text-gray-600">{label}</span>
            <span className="text-sm font-semibold text-gray-800">{value}</span>
        </div>
    );
}
