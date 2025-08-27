'use client';

import { AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorBannerProps {
  error: string;
  operation: string;
}

export default function ErrorBanner({ error, operation }: ErrorBannerProps) {
  const { clearError } = useAppStore();

  const handleDismiss = () => {
    clearError(operation as any);
  };

  const getOperationLabel = (op: string) => {
    switch (op) {
      case 'cvs':
        return 'CV Loading';
      case 'jds':
        return 'JD Loading';
      case 'upload':
        return 'File Upload';
      case 'matching':
        return 'Candidate Matching';
      case 'health':
        return 'System Health';
      default:
        return 'Operation';
    }
  };

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong>{getOperationLabel(operation)} Error:</strong> {error}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-4 w-4 p-0 hover:bg-transparent"
        >
          <X className="h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
