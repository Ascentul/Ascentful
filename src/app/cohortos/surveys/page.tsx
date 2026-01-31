'use client';

import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Mail,
  MessageSquare,
  Send,
  Settings,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { mockSurveys } from '@/lib/cohortos/mock-data';
import { cn } from '@/lib/utils';

// Historical survey data for comparison
const historicalSurveys = [
  { name: 'Internship Check-in', date: 'Jan 2026', before: null, after: 77 },
  { name: 'Fall Outcomes Survey', date: 'Dec 2025', before: 52, after: 79 },
  { name: 'Mid-Semester Check', date: 'Oct 2025', before: 48, after: 74 },
];

// SMS template
const smsTemplate = `Hi {{first_name}}, we haven't heard from you on our Internship Status Check-in survey. Your input helps us support you better! Please take 2 min to complete it: [link]`;

// Email template
const emailSubject = 'Quick check-in on your internship survey';
const emailBody = `Hi {{first_name}},

We noticed you haven't had a chance to complete our Internship Status Check-in survey yet. Your response helps our career services team better understand where you are in your internship search and how we can support you.

The survey takes less than 2 minutes to complete.

[Complete Survey]

If you have any questions or need assistance with your internship search, please don't hesitate to reach out.

Best,
Pepperdine Graziadio Career Services`;

export default function CohortosSurveysPage() {
  const router = useRouter();
  const survey = mockSurveys[0];

  // Auto-reminder toggle state
  const [reminderSettings, setReminderSettings] = useState({
    sms48hr: true,
    email72hr: true,
    final5day: false,
  });

  // Email preview expanded state
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Toggle a reminder setting
  const toggleReminder = (key: keyof typeof reminderSettings) => {
    setReminderSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Navigate to non-responders
  const handleViewNonResponders = () => {
    router.push('/cohortos/students?filter=non-responders');
  };

  // Handle send follow-up
  const handleSendFollowUp = () => {
    console.log('Send follow-up to non-responders clicked');
  };

  // Handle import survey
  const handleImportSurvey = () => {
    console.log('Import survey clicked');
  };

  // Funnel stage data
  const funnelStages = [
    {
      label: 'Survey Sent',
      date: 'Jan 20',
      count: survey.totalSent,
      percentage: 100,
      color: 'bg-slate-400',
      textColor: 'text-slate-600',
    },
    {
      label: 'Initial Responses',
      date: 'Jan 20-22',
      count: survey.responses.initial.count,
      percentage: survey.responses.initial.percentage,
      color: 'bg-blue-400',
      textColor: 'text-blue-600',
    },
    {
      label: 'After SMS Reminder',
      date: 'Jan 22 (48 hrs)',
      count: survey.responses.afterSmsReminder.count,
      percentage: survey.responses.afterSmsReminder.percentage,
      increment: survey.responses.afterSmsReminder.count - survey.responses.initial.count,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    {
      label: 'After Email Reminder',
      date: 'Jan 23 (72 hrs)',
      count: survey.responses.afterEmailReminder.count,
      percentage: survey.responses.afterEmailReminder.percentage,
      increment:
        survey.responses.afterEmailReminder.count - survey.responses.afterSmsReminder.count,
      color: 'bg-green-500',
      textColor: 'text-green-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Surveys</h1>
          <p className="text-slate-500 mt-1">Track and boost survey response rates</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleImportSurvey}>
          <Upload className="h-4 w-4 mr-2" />
          Import Survey
        </Button>
      </div>

      {/* Survey Detail Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{survey.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
              <span>Sent: January 20, 2026</span>
              <span>•</span>
              <span>Audience: {survey.totalSent} students (FT MBA, Internship Track)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Response Funnel - Hero Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-medium text-slate-900">Response Funnel</h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-3xl font-bold text-green-600">
              {survey.responses.final.percentage}%
            </span>
            <span className="text-sm text-slate-500">final response rate</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Funnel Stages */}
          {funnelStages.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-4">
              {/* Label + Date */}
              <div className="w-44 flex-shrink-0">
                <p className="text-sm font-medium text-slate-900">{stage.label}</p>
                <p className="text-xs text-slate-500">{stage.date}</p>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                <div
                  className={cn('h-full transition-all rounded-lg', stage.color)}
                  style={{ width: `${(stage.count / survey.totalSent) * 100}%` }}
                />
              </div>

              {/* Count + Percentage */}
              <div className="w-32 flex-shrink-0 text-right">
                <span className="text-sm font-semibold text-slate-900">{stage.count}</span>
                {index > 0 && (
                  <span className="text-sm text-slate-500 ml-1">({stage.percentage}%)</span>
                )}
                {stage.increment && stage.increment > 0 && (
                  <span className="text-xs text-green-600 font-medium ml-2">
                    +{stage.increment} responses
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Non-Responders Row */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <div className="w-44 flex-shrink-0">
              <p className="text-sm font-medium text-amber-700">Non-Responders</p>
              <p className="text-xs text-slate-500">Final count</p>
            </div>

            <div className="flex-1 h-8 bg-amber-50 rounded-lg overflow-hidden border border-amber-200">
              <div
                className="h-full bg-amber-200 rounded-lg"
                style={{ width: `${(survey.nonResponders / survey.totalSent) * 100}%` }}
              />
            </div>

            <div className="w-32 flex-shrink-0 text-right">
              <span className="text-sm font-semibold text-amber-700">{survey.nonResponders}</span>
              <span className="text-sm text-slate-500 ml-1">
                ({Math.round((survey.nonResponders / survey.totalSent) * 100)}%)
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleViewNonResponders}>
                <Users className="h-4 w-4 mr-1" />
                View List
              </Button>
              <Button variant="default" size="sm" onClick={handleSendFollowUp}>
                <Send className="h-4 w-4 mr-1" />
                Send Follow-up
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Section: Settings + Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto-Reminder Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Auto-Reminder Settings</h2>
          </div>

          <div className="space-y-4">
            {/* SMS Reminder */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">SMS Reminder</p>
                  <p className="text-xs text-slate-500">Sent after 48 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleReminder('sms48hr')}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    reminderSettings.sms48hr ? 'bg-green-500' : 'bg-slate-200',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      reminderSettings.sms48hr ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
                <button className="text-sm text-primary-600 hover:underline">Edit</button>
              </div>
            </div>

            {/* Email Reminder */}
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Reminder</p>
                  <p className="text-xs text-slate-500">Sent after 72 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleReminder('email72hr')}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    reminderSettings.email72hr ? 'bg-green-500' : 'bg-slate-200',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      reminderSettings.email72hr ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
                <button className="text-sm text-primary-600 hover:underline">Edit</button>
              </div>
            </div>

            {/* Final Reminder */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Final Reminder</p>
                  <p className="text-xs text-slate-500">Sent after 5 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleReminder('final5day')}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    reminderSettings.final5day ? 'bg-green-500' : 'bg-slate-200',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      reminderSettings.final5day ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
                <button className="text-sm text-primary-600 hover:underline">Edit</button>
              </div>
            </div>
          </div>
        </div>

        {/* Reminder Messages Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-900">Reminder Messages</h2>
          </div>

          <div className="space-y-4">
            {/* SMS Template */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">SMS Template:</p>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-200">
                {smsTemplate}
              </div>
            </div>

            {/* Email Subject */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Email Subject:</p>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-200">
                {emailSubject}
              </div>
            </div>

            {/* Preview Full Email */}
            <div>
              <button
                onClick={() => setShowEmailPreview(!showEmailPreview)}
                className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
              >
                {showEmailPreview ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Full Email
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Preview Full Email
                  </>
                )}
              </button>

              {showEmailPreview && (
                <div className="mt-3 bg-slate-50 rounded-lg p-4 text-sm text-slate-600 border border-slate-200 whitespace-pre-line">
                  {emailBody}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-medium text-slate-900">Historical Performance</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Survey
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Without CohortOS
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  With CohortOS
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Improvement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historicalSurveys.map((survey, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{survey.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{survey.date}</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-500">
                    {survey.before ? `${survey.before}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">
                    {survey.after}%
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {survey.before ? (
                      <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                        <TrendingUp className="h-4 w-4" />+{survey.after - survey.before}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Row */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <span className="text-sm font-semibold text-slate-900">
            Average improvement: +26 percentage points
          </span>
          <span className="text-sm text-slate-500">with auto-reminders</span>
        </div>
      </div>
    </div>
  );
}
