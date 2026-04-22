'use client';

import Protected from '@/components/layout/Protected';
import RoleBasedAccess from '@/components/auth/RoleBasedAccess';
import { TrackerPage } from '@/components/tracker';

export default function TrackerRoutePage() {
  return (
    <Protected>
      <RoleBasedAccess allowedRoles={['admin', 'user', 'recruiter', 'manager', 'evp']} hideWhenUnauthorized={false} fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-lg">
            <div className="text-lg font-semibold text-gray-900">Access denied</div>
            <div className="text-sm text-gray-600 mt-1">You don’t have permission to open Candidate Tracker.</div>
          </div>
        </div>
      }>
        <TrackerPage />
      </RoleBasedAccess>
    </Protected>
  );
}

