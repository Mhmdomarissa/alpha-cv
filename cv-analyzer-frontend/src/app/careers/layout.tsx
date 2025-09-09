'use client';
import React from 'react';
import { Briefcase } from 'lucide-react';
export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* ================= Header ================= */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-600/10 text-primary-700 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                Alpha Data Recruitment<span className="text-gray-400">/</span> Careers
              </h1>
            </div>
            <div className="text-xs sm:text-sm">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-600">
                Powered by <span className="mx-1 font-semibold text-gray-800">AI-driven recruitment</span>
              </span>
            </div>
          </div>
        </div>
      </header>
      {/* ================= Main ================= */}
      <main className="flex-1">{children}</main>
      {/* ================= Footer ================= */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} CV Analyzer. All rights reserved.</p>
            <p className="mt-1">AI-powered recruitment and talent matching platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}