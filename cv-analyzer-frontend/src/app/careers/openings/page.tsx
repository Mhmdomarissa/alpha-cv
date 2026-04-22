'use client';

import { Suspense } from 'react';
import PublicJobOpeningsPage from '@/components/careers/PublicJobOpeningsPage';
import { LoadingPage } from '@/components/ui/loading';

export default function PublicJobOpeningsRoute() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Openings..." subtitle="Fetching recent job postings" />}>
      <PublicJobOpeningsPage />
    </Suspense>
  );
}

