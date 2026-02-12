/**
 * Semantic-Only Candidate Card Component
 * 
 * Simple, clean card for candidates with only semantic similarity scoring.
 * More condensed design for quick scanning of remaining candidates.
 */

import React from 'react';
import { Briefcase, Calendar } from 'lucide-react';

export const SemanticCard = ({ candidate }) => {
    const {
        cv_id,
        cv_name,
        cv_job_title,
        cv_years,
        overall_score,
        skills_score,
        responsibilities_score,
        job_title_score,
        years_score
    } = candidate;

    // Convert to percentages
    const overallPercent = overall_score * 100;
    const skillsPercent = skills_score * 100;
    const respPercent = responsibilities_score * 100;
    const titlePercent = job_title_score * 100;
    const yearsPercent = years_score * 100;

    return (
        <div className="
      p-5 rounded-lg bg-white
      border border-gray-200
      shadow-sm hover:shadow-md
      transition-all duration-200
      hover:border-gray-300
    ">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                    {cv_name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cv_name}</h3>
                    <p className="text-gray-600 text-sm flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {cv_job_title}
                    </p>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {cv_years} years
                    </p>
                </div>
            </div>

            {/* Score Section */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Match Score</span>
                    <span className="text-xl font-bold text-blue-600">{overallPercent.toFixed(1)}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${overallPercent}%` }}
                    />
                </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Skills:</span>
                    <span className="font-medium text-gray-900">{skillsPercent.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Experience:</span>
                    <span className="font-medium text-gray-900">{yearsPercent.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Responsibilities:</span>
                    <span className="font-medium text-gray-900">{respPercent.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Title:</span>
                    <span className="font-medium text-gray-900">{titlePercent.toFixed(0)}%</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition">
                    📄 View Details
                </button>
                <button className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition">
                    📧 Contact
                </button>
            </div>
        </div>
    );
};

export default SemanticCard;
