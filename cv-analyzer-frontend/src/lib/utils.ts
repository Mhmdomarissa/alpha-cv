import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getScoreColor(score: number): string {
  if (score >= 0.5) return 'text-green-600 bg-green-50';
  return 'text-amber-600 bg-amber-50';
}

export function getScoreBadgeVariant(score: number): 'success' | 'warning' | 'secondary' {
  if (score >= 0.7) return 'success';
  if (score >= 0.5) return 'warning';
  return 'secondary';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getMatchQualityColor(score: number): string {
  if (score >= 0.8) return 'text-green-700 bg-green-100 border-green-300';
  if (score >= 0.6) return 'text-blue-700 bg-blue-100 border-blue-300';
  if (score >= 0.4) return 'text-amber-700 bg-amber-100 border-amber-300';
  return 'text-red-700 bg-red-100 border-red-300';
}

export function getMatchQualityLabel(score: number): string {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  return 'Poor';
}

export function calculateWeightedContribution(score: number, weight: number): string {
  const contribution = score * weight;
  return `${formatPercentage(contribution)} (${formatPercentage(score)} × ${formatPercentage(weight)})`;
}
