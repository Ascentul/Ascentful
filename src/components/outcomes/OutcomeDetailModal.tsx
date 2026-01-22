'use client';

import { Briefcase, Building2, GraduationCap, Mail, MapPin, User, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { EvidenceFile, EvidenceViewer } from './EvidenceViewer';

export interface OutcomeRecord {
  _id: string;
  student_name?: string;
  student_email?: string;
  external_student_id?: string;
  cohort_name?: string;
  outcome_status: 'unknown' | 'known' | 'partial';
  outcome_type?:
    | 'employed_fulltime'
    | 'employed_parttime'
    | 'continuing_education'
    | 'military'
    | 'volunteer'
    | 'seeking'
    | 'not_seeking';
  employer_name?: string;
  job_title?: string;
  job_function?: string;
  industry?: string;
  salary?: number;
  city?: string;
  state?: string;
  country?: string;
  is_remote?: boolean;
  grad_school_name?: string;
  grad_school_program?: string;
  grad_school_degree?: string;
  is_verified?: boolean;
  confidence_score?: number;
  verified_by_name?: string;
  verified_at?: number;
  evidence_files?: EvidenceFile[];
  data_source?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

interface OutcomeDetailModalProps {
  outcome: OutcomeRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFile?: (file: EvidenceFile) => void;
  onDownloadFile?: (file: EvidenceFile) => void;
}

const OUTCOME_STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  known: { label: 'Known', variant: 'default' },
  partial: { label: 'Partial', variant: 'secondary' },
  unknown: { label: 'Unknown', variant: 'outline' },
};

const OUTCOME_TYPE_LABELS: Record<string, string> = {
  employed_fulltime: 'Employed Full-time',
  employed_parttime: 'Employed Part-time',
  continuing_education: 'Continuing Education',
  military: 'Military Service',
  volunteer: 'Volunteer/Service',
  seeking: 'Seeking Employment',
  not_seeking: 'Not Seeking Employment',
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  survey: 'Survey Response',
  linkedin: 'LinkedIn',
  advisor_input: 'Advisor Input',
  student_self_report: 'Student Self-Report',
  employer_report: 'Employer Report',
  platform_inference: 'Platform Inference',
};

export function OutcomeDetailModal({
  outcome,
  isOpen,
  onClose,
  onViewFile,
  onDownloadFile,
}: OutcomeDetailModalProps) {
  if (!outcome) return null;

  const statusConfig =
    OUTCOME_STATUS_LABELS[outcome.outcome_status] || OUTCOME_STATUS_LABELS.unknown;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">
                {outcome.student_name || 'Unknown Student'}
              </DialogTitle>
              <p className="mt-1 text-sm text-neutral-500">{outcome.cohort_name}</p>
            </div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Student Info */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Student Information</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {outcome.student_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-neutral-400" />
                  <span>{outcome.student_email}</span>
                </div>
              )}
              {outcome.external_student_id && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-neutral-400" />
                  <span>ID: {outcome.external_student_id}</span>
                </div>
              )}
            </div>
          </section>

          {/* Outcome Type */}
          {outcome.outcome_type && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Outcome Type</h3>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5">
                {outcome.outcome_type === 'continuing_education' ? (
                  <GraduationCap className="h-4 w-4 text-primary-600" />
                ) : (
                  <Briefcase className="h-4 w-4 text-primary-600" />
                )}
                <span className="text-sm font-medium text-primary-700">
                  {OUTCOME_TYPE_LABELS[outcome.outcome_type] || outcome.outcome_type}
                </span>
              </div>
            </section>
          )}

          {/* Employment Details */}
          {(outcome.outcome_type === 'employed_fulltime' ||
            outcome.outcome_type === 'employed_parttime') && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Employment Details</h3>
              <div className="rounded-card border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                {outcome.employer_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-neutral-500" />
                    <span className="font-medium">{outcome.employer_name}</span>
                  </div>
                )}
                {outcome.job_title && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-neutral-500" />
                    <span>{outcome.job_title}</span>
                  </div>
                )}
                {(outcome.city || outcome.state || outcome.country) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-neutral-500" />
                    <span>
                      {[outcome.city, outcome.state, outcome.country].filter(Boolean).join(', ')}
                      {outcome.is_remote && ' (Remote)'}
                    </span>
                  </div>
                )}
                {outcome.salary && (
                  <div className="text-sm text-neutral-600">
                    Salary: ${outcome.salary.toLocaleString()}/year
                  </div>
                )}
                {outcome.job_function && (
                  <div className="text-sm text-neutral-600">Function: {outcome.job_function}</div>
                )}
                {outcome.industry && (
                  <div className="text-sm text-neutral-600">Industry: {outcome.industry}</div>
                )}
              </div>
            </section>
          )}

          {/* Continuing Education Details */}
          {outcome.outcome_type === 'continuing_education' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Education Details</h3>
              <div className="rounded-card border border-neutral-200 bg-neutral-50 p-4 space-y-2">
                {outcome.grad_school_name && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-neutral-500" />
                    <span className="font-medium">{outcome.grad_school_name}</span>
                  </div>
                )}
                {outcome.grad_school_program && (
                  <div className="text-sm text-neutral-600">
                    Program: {outcome.grad_school_program}
                  </div>
                )}
                {outcome.grad_school_degree && (
                  <div className="text-sm text-neutral-600">
                    Degree: {outcome.grad_school_degree}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Evidence & Verification */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Evidence & Verification</h3>
            <EvidenceViewer
              evidenceFiles={outcome.evidence_files}
              verification={{
                is_verified: outcome.is_verified,
                confidence_score: outcome.confidence_score,
                verified_by_name: outcome.verified_by_name,
                verified_at: outcome.verified_at,
              }}
              onViewFile={onViewFile}
              onDownloadFile={onDownloadFile}
            />
          </section>

          {/* Data Source & Metadata */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700">Data Source</h3>
            <div className="flex flex-wrap gap-2">
              {outcome.data_source && (
                <Badge variant="outline">
                  {DATA_SOURCE_LABELS[outcome.data_source] || outcome.data_source}
                </Badge>
              )}
              <Badge variant="outline">
                Updated: {new Date(outcome.updated_at).toLocaleDateString()}
              </Badge>
            </div>
          </section>

          {/* Notes */}
          {outcome.notes && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700">Notes</h3>
              <p className="text-sm text-neutral-600">{outcome.notes}</p>
            </section>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
