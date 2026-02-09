/**
 * Enhanced Matching Results Page
 * 
 * Displays results from two-stage matching:
 * 1. AI-Enhanced cards for top candidates (with LLM analysis)
 * 2. Semantic-only cards for remaining candidates
 */

import React, { useState, useMemo } from 'react';
import { Filter, Search, Download, ChevronDown } from 'lucide-react';
import AIEnhancedCard from './AIEnhancedCard';
import SemanticCard from './SemanticCard';

export const EnhancedMatchingResults = ({ results, jobTitle }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'ai-enhanced', 'semantic'
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('score'); // 'score', 'name', 'experience'

    // Separate AI-enhanced and semantic-only candidates
    const { aiEnhanced, semanticOnly } = useMemo(() => {
        const ai = results.filter(c => c.has_llm_analysis);
        const semantic = results.filter(c => !c.has_llm_analysis);
        return { aiEnhanced: ai, semanticOnly: semantic };
    }, [results]);

    // Filter candidates based on selection
    const filteredCandidates = useMemo(() => {
        let candidates = results;

        if (filter === 'ai-enhanced') {
            candidates = aiEnhanced;
        } else if (filter === 'semantic') {
            candidates = semanticOnly;
        }

        // Apply search
        if (searchTerm) {
            candidates = candidates.filter(c =>
                c.cv_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.cv_job_title.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply sort
        if (sortBy === 'score') {
            candidates = [...candidates].sort((a, b) => b.overall_score - a.overall_score);
        } else if (sortBy === 'name') {
            candidates = [...candidates].sort((a, b) => a.cv_name.localeCompare(b.cv_name));
        } else if (sortBy === 'experience') {
            candidates = [...candidates].sort((a, b) => b.cv_years - a.cv_years);
        }

        return candidates;
    }, [results, filter, searchTerm, sortBy, aiEnhanced, semanticOnly]);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-600">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Matching Results for: {jobTitle}
                    </h1>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{results.length}</div>
                            <div className="text-sm text-gray-600">Total Candidates</div>
                        </div>
                        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                            <div className="text-2xl font-bold text-green-700 flex items-center gap-2">
                                {aiEnhanced.length}
                                <span className="text-xs">⭐</span>
                            </div>
                            <div className="text-sm text-green-600">AI-Enhanced (GPT-4.1 analyzed)</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-2xl font-bold text-blue-700">{semanticOnly.length}</div>
                            <div className="text-sm text-blue-600">Semantic-Only (Vector similarity)</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
                    {/* Filter Buttons */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All ({results.length})
                        </button>
                        <button
                            onClick={() => setFilter('ai-enhanced')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'ai-enhanced'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            ⭐ AI-Enhanced ({aiEnhanced.length})
                        </button>
                        <button
                            onClick={() => setFilter('semantic')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'semantic'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Semantic ({semanticOnly.length})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                        >
                            <option value="score">Sort: Best Match</option>
                            <option value="name">Sort: Name (A-Z)</option>
                            <option value="experience">Sort: Experience</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Export Button */}
                    <button className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Results Grid */}
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredCandidates.map((candidate) => (
                        candidate.has_llm_analysis ? (
                            <AIEnhancedCard key={candidate.cv_id} candidate={candidate} />
                        ) : (
                            <SemanticCard key={candidate.cv_id} candidate={candidate} />
                        )
                    ))}
                </div>

                {/* Empty State */}
                {filteredCandidates.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔍</div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No candidates found</h3>
                        <p className="text-gray-500">Try adjusting your filters or search term</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedMatchingResults;
