'use client';

import { AlertCircle, CheckCircle, Clock, Download, Eye, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EvidenceFile {
  id: string;
  name: string;
  storage_id: string;
  type: 'offer_letter' | 'start_confirmation' | 'other';
  uploaded_at: number;
}

interface VerificationInfo {
  is_verified?: boolean;
  confidence_score?: number;
  verified_by_name?: string;
  verified_at?: number;
}

interface EvidenceViewerProps {
  evidenceFiles?: EvidenceFile[];
  verification?: VerificationInfo;
  onViewFile?: (file: EvidenceFile) => void;
  onDownloadFile?: (file: EvidenceFile) => void;
  className?: string;
}

const FILE_TYPE_LABELS: Record<EvidenceFile['type'], string> = {
  offer_letter: 'Offer Letter',
  start_confirmation: 'Start Confirmation',
  other: 'Other Document',
};

export function EvidenceViewer({
  evidenceFiles = [],
  verification,
  onViewFile,
  onDownloadFile,
  className,
}: EvidenceViewerProps) {
  const hasEvidence = evidenceFiles.length > 0;
  const hasVerification = verification?.is_verified !== undefined;

  if (!hasEvidence && !hasVerification) {
    return (
      <div className={cn('rounded-card bg-neutral-50 p-4', className)}>
        <div className="flex items-center gap-2 text-neutral-500">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No evidence files or verification data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Evidence Files Section */}
      {hasEvidence && (
        <div className="rounded-card border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h4 className="text-sm font-medium text-neutral-700">Evidence Trail</h4>
          </div>
          <div className="divide-y divide-neutral-100">
            {evidenceFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary-50 p-2">
                    <FileText className="h-4 w-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-700">
                      {FILE_TYPE_LABELS[file.type]}
                    </p>
                    <p className="text-xs text-neutral-500">{file.name}</p>
                    <p className="text-xs text-neutral-400">
                      Uploaded: {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onViewFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewFile(file)}
                      className="text-neutral-500 hover:text-neutral-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onDownloadFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadFile(file)}
                      className="text-neutral-500 hover:text-neutral-700"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Section */}
      {hasVerification && (
        <div className="rounded-card border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h4 className="text-sm font-medium text-neutral-700">Verification Status</h4>
          </div>
          <div className="p-4 space-y-3">
            {/* Verification Status */}
            <div className="flex items-center gap-2">
              {verification.is_verified ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">Verified</span>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">Pending Verification</span>
                </>
              )}
            </div>

            {/* Confidence Score */}
            {verification.confidence_score !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Confidence:</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-neutral-200">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        verification.confidence_score >= 80
                          ? 'bg-green-500'
                          : verification.confidence_score >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500',
                      )}
                      style={{ width: `${verification.confidence_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-700">
                    {verification.confidence_score}%
                  </span>
                </div>
              </div>
            )}

            {/* Verified By */}
            {verification.verified_by_name && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Verified by:</span>
                <span className="text-sm text-neutral-700">{verification.verified_by_name}</span>
              </div>
            )}

            {/* Verified At */}
            {verification.verified_at && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Verified at:</span>
                <span className="text-sm text-neutral-700">
                  {new Date(verification.verified_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary component for showing evidence count in tables
interface EvidenceBadgeProps {
  evidenceCount: number;
  isVerified?: boolean;
  className?: string;
}

export function EvidenceBadge({ evidenceCount, isVerified, className }: EvidenceBadgeProps) {
  if (evidenceCount === 0 && !isVerified) {
    return <span className={cn('text-sm text-neutral-400', className)}>No evidence</span>;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {evidenceCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <FileText className="h-3 w-3" />
          {evidenceCount}
        </span>
      )}
      {isVerified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle className="h-3 w-3" />
          Verified
        </span>
      )}
    </div>
  );
}
