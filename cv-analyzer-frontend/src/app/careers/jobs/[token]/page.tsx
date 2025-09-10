'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProfessionalJobPage } from '@/components/careers';
import { LoadingPage } from '@/components/ui/loading';

export default function PublicJobPageRoute() {
  const params = useParams();
  const token = params.token as string;

  return (
    <Suspense fallback={<LoadingPage title="Loading Job..." subtitle="Fetching job details" />}>
      <ProfessionalJobPage token={token} />
    </Suspense>
  );
}