'use client';

import React, { Suspense } from 'react';
import { PublicJobPage } from '@/components/careers';
import { LoadingPage } from '@/components/ui/loading';

function CareersPageContent() {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const token = searchParams.get('token') || '';

  return <PublicJobPage token={token} />;
}

export default function PublicCareersPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Job..." subtitle="Fetching job details" />}>
      <CareersPageContent />
    </Suspense>
  );
}
