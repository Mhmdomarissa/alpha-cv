'use client';

import React, { Suspense } from 'react';
import { PublicJobPage } from '@/components/careers';
import { LoadingPage } from '@/components/ui/loading';

export default function PublicCareersPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Job..." subtitle="Fetching job details" />}>
      <PublicJobPage />
    </Suspense>
  );
}
