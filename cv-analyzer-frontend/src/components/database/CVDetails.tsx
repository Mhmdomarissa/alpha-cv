'use client';
import React, { useState, useEffect } from 'react';
import {
    User, Briefcase, TrendingUp, Calendar, FileCheck,
    Mail, Phone, Zap, Star, AlertCircle, FileText,
    Brain, Settings, Award
} from 'lucide-react';
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

const getCVBasics = (cv: any) => {
    const structured = cv.structured_info || {};
    const cand = cv.candidate || {};
    return {
        name: structured.full_name || structured.name || cand.name || 'Unknown Candidate',
        title: structured.job_title || cand.title || 'Not specified',
        years: structured.years_of_experience || cand.years_of_experience || '0',
        skillsCount: (structured.skills || cand.skills || []).length,
        respCount: (structured.responsibilities || cand.responsibilities || []).length,
    };
};

/* ---------------------------- CV Details --------------------------- */
export function CVDetails({ cvId }: { cvId: string }) {
    const [cv, setCV] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadCV = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await api.getCVDetails(cvId);
                setCV(response);
            } catch (err: any) {
                setError(err.message || 'Failed to load CV details');
            } finally {
                setLoading(false);
            }
        };
        loadCV();
    }, [cvId]);



    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Loading CV details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="bg-red-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading CV</h3>
                <p className="text-red-600 mb-4">{error}</p>
            </div>
        );
    }

    if (!cv) {
        return (
            <div className="text-center py-12">
                <div className="bg-gray-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">CV Not Found</h3>
                <p className="text-gray-600">The requested CV could not be found.</p>
            </div>
        );
    }

    const b = getCVBasics(cv);

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white rounded-full p-3 shadow-sm">
                            <User className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{b.name}</h2>
                            <div className="flex items-center space-x-2 mb-2">
                                <Briefcase className="w-4 h-4 text-gray-500" />
                                <span className="text-lg font-semibold text-gray-700">{b.title}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1">
                                    <TrendingUp className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-gray-600">{b.years} years experience</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center space-x-1 text-sm text-gray-500 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span>Uploaded {formatDate(cv?.upload_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                            <FileCheck className="w-4 h-4" />
                            <span>CV #{cvId.slice(-8)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="bg-green-100 rounded-full p-2">
                        <Mail className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-500">Email</p>
                            <p className="font-semibold text-blue-600 break-all">{cv.structured_info?.contact_info?.email || cv.structured_info?.email || cv.candidate?.contact_info?.email || 'Not available'}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                        <Phone className="w-5 h-5 text-green-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-500">Phone</p>
                            <p className="font-semibold text-green-600">{cv.structured_info?.contact_info?.phone || cv.structured_info?.phone || cv.candidate?.contact_info?.phone || 'Not available'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                        <div className="bg-purple-100 rounded-full p-2">
                            <Zap className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Technical Skills</h3>
                    </div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                        {b.skillsCount} skills
                    </Badge>
                </div>
                {(() => {
                    const skills = cv?.candidate?.skills || cv?.skills || [];
                    return skills.length ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {skills.map((skill: string, i: number) => (
                                <div key={i} className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 text-center hover:shadow-md transition-shadow">
                                    <span className="text-sm font-medium text-gray-800">{skill}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No skills information available</p>
                        </div>
                    );
                })()}
            </div>

            {/* Experience */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                        <div className="bg-orange-100 rounded-full p-2">
                            <Briefcase className="w-5 h-5 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Experience & Responsibilities</h3>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                        {b.respCount} items
                    </Badge>
                </div>
                {(() => {
                    const responsibilities = cv?.candidate?.responsibilities || cv?.responsibilities || [];
                    return responsibilities.length ? (
                        <div className="space-y-4">
                            {responsibilities.map((resp: string, i: number) => (
                                <div key={i} className="flex items-start space-x-3 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg hover:shadow-sm transition-shadow">
                                    <div className="bg-orange-500 rounded-full p-1 mt-1">
                                        <Star className="w-3 h-3 text-white" />
                                    </div>
                                    <p className="text-gray-700 leading-relaxed">{resp}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No responsibilities information available</p>
                        </div>
                    );
                })()}
            </div>

            {/* Tech Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-indigo-100 rounded-full p-2">
                            <Brain className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">AI Processing</h3>
                    </div>
                    <div className="space-y-3">
                        <Row label="Skills Embeddings" value={cv?.embeddings_info?.skills_embeddings || 0} />
                        <Row label="Responsibilities Embeddings" value={cv?.embeddings_info?.responsibilities_embeddings || 0} />
                        <Row label="Model Used" value={cv?.processing_metadata?.model_used || 'N/A'} />
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-green-100 rounded-full p-2">
                            <Settings className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">System Info</h3>
                    </div>
                    <div className="space-y-3">
                        <Row label="Title Embedding" value={cv?.embeddings_info?.has_title_embedding ? 'Yes' : 'No'} />
                        <Row label="Experience Embedding" value={cv?.embeddings_info?.has_experience_embedding ? 'Yes' : 'No'} />
                        <Row label="Embedding Dimension" value={cv?.embeddings_info?.embedding_dimension || 'N/A'} />
                    </div>
                </div>
            </div>

        </div>
    );
}

function Row({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">{label}</span>
            <span className="text-sm font-semibold text-gray-800">{value}</span>
        </div>
    );
}
