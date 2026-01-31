'use client';

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Plus,
  Send,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  getAlertCounts,
  getPipelineStats,
  mockStudents,
  mockSurveys,
} from '@/lib/cohortos/mock-data';
import { type Program, PROGRAM_CONFIG } from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

// Report template definitions
const reportTemplates = [
  {
    id: 'dean' as const,
    title: 'Dean Summary',
    description: 'Pipeline snapshot for leadership meetings',
    icon: BarChart3,
  },
  {
    id: 'csea' as const,
    title: 'CSEA Outcomes',
    description: 'Formatted for CSEA reporting standards',
    icon: ClipboardList,
  },
  {
    id: 'weekly' as const,
    title: 'Weekly Progress',
    description: 'Week-over-week pipeline changes',
    icon: TrendingUp,
  },
];

// Recent reports mock data
const recentReports = [
  { id: 1, name: 'Dean Summary', date: 'Jan 15, 2026', sentTo: 'Dean Williams', canEmail: true },
  { id: 2, name: 'CSEA Quarterly', date: 'Jan 5, 2026', sentTo: 'CSEA Portal', canEmail: false },
  { id: 3, name: 'Dean Summary', date: 'Dec 15, 2025', sentTo: 'Dean Williams', canEmail: true },
];

type ReportType = 'dean' | 'csea' | 'weekly';

export default function CohortosReportsPage() {
  const reportRef = useRef<HTMLDivElement>(null);

  // State
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<ReportType | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // Get stats
  const stats = getPipelineStats();
  const alerts = getAlertCounts();
  const survey = mockSurveys[0];

  // Calculate stats by program
  const getStatsByProgram = () => {
    const programs: Program[] = ['ft-mba', 'pt-mba', 'emba'];
    return programs.map((program) => {
      const students = mockStudents.filter((s) => s.program === program);
      const placed = students.filter((s) => s.status === 'placed' || s.status === 'offered').length;
      return {
        program,
        label: PROGRAM_CONFIG[program].label,
        total: students.length,
        placed,
        interviewing: students.filter((s) => s.status === 'interviewing').length,
        applying: students.filter((s) => s.status === 'applying').length,
        searching: students.filter((s) => s.status === 'searching').length,
        rate: students.length > 0 ? Math.round((placed / students.length) * 100) : 0,
      };
    });
  };

  const programStats = getStatsByProgram();

  // Generate report handler
  const handleGenerate = async (type: ReportType) => {
    setGenerating(true);
    setGeneratingType(type);

    // Fake loading delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    setActiveReport(type);
    setGenerating(false);
    setGeneratingType(null);

    // Scroll to report
    setTimeout(() => {
      reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Export PDF handler
  const handleExportPDF = async () => {
    setExporting(true);
    console.log('Exporting PDF...');

    // Fake export delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setExporting(false);
    setExportSuccess(true);

    // Reset success after 3 seconds
    setTimeout(() => setExportSuccess(false), 3000);
  };

  // Email handlers
  const handleSendEmail = async () => {
    setEmailSending(true);
    console.log('Sending email to dean.williams@pepperdine.edu');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setEmailSending(false);
    setShowEmailModal(false);
  };

  // Progress bar component
  const ProgressBar = ({
    value,
    total,
    color,
  }: {
    value: number;
    total: number;
    color: string;
  }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="w-32 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Generate reports for leadership and compliance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => console.log('Custom report clicked')}>
          <Plus className="h-4 w-4 mr-2" />
          Custom Report
        </Button>
      </div>

      {/* Report Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportTemplates.map((template) => {
          const Icon = template.icon;
          const isGenerating = generating && generatingType === template.id;

          return (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{template.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={() => handleGenerate(template.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Generated Report Section */}
      {activeReport && (
        <div ref={reportRef} className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Report Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary-600" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">DEAN SUMMARY REPORT</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>Generated: January 29, 2026</span>
                    <span>•</span>
                    <span>Spring 2026 Cohort</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : exportSuccess ? (
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {exportSuccess ? 'Downloaded!' : 'Export PDF'}
                </Button>
                <Button variant="default" size="sm" onClick={() => setShowEmailModal(true)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Dean
                </Button>
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-6 space-y-6">
            {/* Executive Summary */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                EXECUTIVE SUMMARY
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total Students Tracked:</span>
                  <span className="text-xl font-bold text-slate-900">{stats.total}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-40 text-slate-600">Placed / Offered:</span>
                  <span className="w-20 font-semibold text-slate-900">
                    {stats.placed + stats.offered}
                  </span>
                  <span className="w-16 text-slate-500">
                    ({Math.round(((stats.placed + stats.offered) / stats.total) * 100)}%)
                  </span>
                  <ProgressBar
                    value={stats.placed + stats.offered}
                    total={stats.total}
                    color="bg-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-40 text-slate-600">Interviewing:</span>
                  <span className="w-20 font-semibold text-slate-900">{stats.interviewing}</span>
                  <span className="w-16 text-slate-500">
                    ({Math.round((stats.interviewing / stats.total) * 100)}%)
                  </span>
                  <ProgressBar
                    value={stats.interviewing}
                    total={stats.total}
                    color="bg-purple-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-40 text-slate-600">Actively Applying:</span>
                  <span className="w-20 font-semibold text-slate-900">{stats.applying}</span>
                  <span className="w-16 text-slate-500">
                    ({Math.round((stats.applying / stats.total) * 100)}%)
                  </span>
                  <ProgressBar value={stats.applying} total={stats.total} color="bg-blue-500" />
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-40 text-slate-600">Still Searching:</span>
                  <span className="w-20 font-semibold text-slate-900">{stats.searching}</span>
                  <span className="w-16 text-slate-500">
                    ({Math.round((stats.searching / stats.total) * 100)}%)
                  </span>
                  <ProgressBar value={stats.searching} total={stats.total} color="bg-amber-500" />
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-slate-600">On Track for 90% Placement:</span>
                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                    <CheckCircle className="h-5 w-5" />
                    Yes
                  </span>
                </div>
              </div>
            </section>

            {/* Progress vs Last Month */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                PROGRESS VS. LAST MONTH
              </h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">New Placements:</span>
                  <span className="text-green-600 font-semibold">+5</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Moved to Interviewing:</span>
                  <span className="text-green-600 font-semibold">+8</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Still Searching:</span>
                  <span className="text-green-600 font-semibold">-6</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-slate-600">Pipeline Velocity:</span>
                <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                  HEALTHY
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
            </section>

            {/* Attention Items */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                ATTENTION ITEMS
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>
                    {alerts.internationalSearchingCount} international students still searching (CPT
                    timeline risk)
                  </span>
                </div>
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>{alerts.blockerCount} students with active blockers</span>
                </div>
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>{alerts.cptDeadlineSoonCount} CPT deadlines in next 60 days</span>
                </div>
              </div>
            </section>

            {/* Data Quality */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                DATA QUALITY
              </h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Latest Survey Response Rate:</span>
                  <span className="font-semibold text-slate-900">
                    {survey.responses.final.percentage}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Data Confidence:</span>
                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                    HIGH
                    <CheckCircle className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </section>

            {/* By Program */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                BY PROGRAM
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                        Program
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Placed
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Interview
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Applying
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Searching
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {programStats.map((prog) => (
                      <tr key={prog.program} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {prog.label}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-slate-600">
                          {prog.total}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-emerald-600 font-medium">
                          {prog.placed}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-slate-600">
                          {prog.interviewing}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-slate-600">
                          {prog.applying}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-slate-600">
                          {prog.searching}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">
                          {prog.rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-medium text-slate-900">Recent Reports</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Report
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Sent To
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{report.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{report.date}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{report.sentTo}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => console.log('View report:', report.name)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {report.canEmail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => console.log('Email report:', report.name)}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Email Report</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To:</label>
                <input
                  type="email"
                  defaultValue="dean.williams@pepperdine.edu"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject:</label>
                <input
                  type="text"
                  defaultValue="MBA Internship Pipeline Update - January 2026"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message:</label>
                <textarea
                  rows={5}
                  defaultValue={`Dear Dean Williams,

Please find attached the latest MBA Internship Pipeline Report for the Spring 2026 cohort.

Key highlights:
• ${stats.placed + stats.offered} students placed/offered (${Math.round(((stats.placed + stats.offered) / stats.total) * 100)}%)
• ${stats.interviewing} students currently interviewing
• On track for 90% placement goal

Best regards,
Kazah Mims
Director of Career Advancement`}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <Button variant="ghost" size="sm" onClick={() => setShowEmailModal(false)}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSendEmail} disabled={emailSending}>
                {emailSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
