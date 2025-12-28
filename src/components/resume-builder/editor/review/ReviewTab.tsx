'use client';

import { AlertCircle, CheckCircle, Download, FileText, XCircle } from 'lucide-react';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { Button } from '@/components/ui/button';
import { calculateResumeScore } from '@/lib/resume-score';

interface ReviewTabProps {
  resumeData: ResumeData;
  onExportPDF: () => void;
  onExportDOCX?: () => void;
  isExporting?: boolean;
}

interface CheckItem {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

function getATSChecks(data: ResumeData): CheckItem[] {
  const checks: CheckItem[] = [];

  // Contact info checks
  if (!data.contactInfo?.email) {
    checks.push({
      id: 'email',
      label: 'Email address',
      status: 'fail',
      message: 'Missing email address',
    });
  } else {
    checks.push({
      id: 'email',
      label: 'Email address',
      status: 'pass',
      message: 'Email address provided',
    });
  }

  if (!data.contactInfo?.phone) {
    checks.push({
      id: 'phone',
      label: 'Phone number',
      status: 'warning',
      message: 'Consider adding a phone number',
    });
  } else {
    checks.push({
      id: 'phone',
      label: 'Phone number',
      status: 'pass',
      message: 'Phone number provided',
    });
  }

  if (!data.contactInfo?.linkedin) {
    checks.push({
      id: 'linkedin',
      label: 'LinkedIn URL',
      status: 'warning',
      message: 'Adding LinkedIn improves credibility',
    });
  } else {
    checks.push({
      id: 'linkedin',
      label: 'LinkedIn URL',
      status: 'pass',
      message: 'LinkedIn profile linked',
    });
  }

  // Content checks
  if (!data.summary || data.summary.length < 50) {
    checks.push({
      id: 'summary',
      label: 'Professional summary',
      status: 'warning',
      message: 'Add a summary of at least 50 characters',
    });
  } else {
    checks.push({
      id: 'summary',
      label: 'Professional summary',
      status: 'pass',
      message: 'Summary is well-written',
    });
  }

  if (!data.experience || data.experience.length === 0) {
    checks.push({
      id: 'experience',
      label: 'Work experience',
      status: 'fail',
      message: 'Add at least one work experience',
    });
  } else {
    checks.push({
      id: 'experience',
      label: 'Work experience',
      status: 'pass',
      message: `${data.experience.length} experience entries`,
    });
  }

  if (!data.education || data.education.length === 0) {
    checks.push({
      id: 'education',
      label: 'Education',
      status: 'warning',
      message: 'Consider adding education',
    });
  } else {
    checks.push({
      id: 'education',
      label: 'Education',
      status: 'pass',
      message: `${data.education.length} education entries`,
    });
  }

  if (!data.skills || data.skills.length < 5) {
    checks.push({
      id: 'skills',
      label: 'Skills',
      status: 'warning',
      message: 'Add at least 5 relevant skills',
    });
  } else {
    checks.push({
      id: 'skills',
      label: 'Skills',
      status: 'pass',
      message: `${data.skills.length} skills listed`,
    });
  }

  return checks;
}

function CheckIcon({ status }: { status: 'pass' | 'warning' | 'fail' }) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

export function ReviewTab({ resumeData, onExportPDF, onExportDOCX, isExporting }: ReviewTabProps) {
  const score = calculateResumeScore(resumeData);
  const checks = getATSChecks(resumeData);

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const totalCount = checks.length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Score Card */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Resume Score</h3>
            {/* Note: Score includes content quality factors beyond the listed ATS checks */}
            <p className="text-sm text-slate-600 mt-1">
              Based on content quality and {passCount} of {totalCount} checks
            </p>
          </div>
          <div className="text-4xl font-bold text-primary-600">{score}%</div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-primary-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* ATS Checks */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700">ATS Compatibility Checks</h3>
        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200"
            >
              <CheckIcon status={check.status} />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">{check.label}</div>
                <div className="text-xs text-slate-500">{check.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Section */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-medium text-slate-700">Export</h3>
        <div className="flex gap-3">
          <Button
            onClick={onExportPDF}
            disabled={isExporting}
            className="flex-1 gap-2 bg-primary-500 hover:bg-primary-700"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {onExportDOCX && (
            <Button
              variant="outline"
              onClick={onExportDOCX}
              disabled={isExporting}
              className="flex-1 gap-2"
            >
              <FileText className="h-4 w-4" />
              Download DOCX
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
