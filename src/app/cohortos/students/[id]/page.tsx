'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  User,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { TimelineEntry } from '@/components/cohortos/ui/timeline-entry';
import { Button } from '@/components/ui/button';
import {
  formatRelativeTime,
  getTimelineForStudent,
  mockCoaches,
  mockStudents,
} from '@/lib/cohortos/mock-data';
import {
  type NoteType,
  PROGRAM_CONFIG,
  type Status,
  type TimelineEntry as TimelineEntryType,
} from '@/lib/cohortos/types';
import { cn } from '@/lib/utils';

// Status options for dropdown
const statusOptions: { value: Status; label: string }[] = [
  { value: 'searching', label: 'Searching' },
  { value: 'applying', label: 'Applying' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered', label: 'Offered' },
  { value: 'placed', label: 'Placed' },
];

// Note type options
const noteTypeOptions: { value: NoteType; label: string; icon: typeof Mail }[] = [
  { value: 'note', label: 'Note', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'call', label: 'Call', icon: Phone },
];

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  // Find student from mock data
  const student = useMemo(() => {
    return mockStudents.find((s) => s.id === studentId);
  }, [studentId]);

  // Editable state (local only, doesn't persist)
  const [status, setStatus] = useState<Status>(student?.status || 'searching');
  const [coachId, setCoachId] = useState<string>(student?.coachId || '');
  const [hasBlocker, setHasBlocker] = useState<boolean>(student?.hasBlocker || false);
  const [blockerNote, setBlockerNote] = useState<string>(student?.blockerNote || '');

  // Timeline state - fetch from mock data helper
  const initialTimeline = useMemo(() => {
    return student ? getTimelineForStudent(student.id) : [];
  }, [student]);
  const [timeline, setTimeline] = useState<TimelineEntryType[]>(initialTimeline);
  const [newNoteType, setNewNoteType] = useState<NoteType>('note');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Handle not found
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <User className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Student Not Found</h2>
        <p className="text-slate-500 mb-6">
          The student you're looking for doesn't exist or has been removed.
        </p>
        <Button variant="outline" onClick={() => router.push('/cohortos/students')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Students
        </Button>
      </div>
    );
  }

  const programConfig = PROGRAM_CONFIG[student.program];

  // Action handlers
  const handleEmail = () => {
    window.location.href = `mailto:${student.email}`;
  };

  const handleSMS = () => {
    window.location.href = `sms:${student.phone}`;
  };

  const handleCall = () => {
    window.location.href = `tel:${student.phone}`;
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim() || !student) return;

    const newEntry: TimelineEntryType = {
      id: `note-${Date.now()}`,
      studentId: student.id,
      coachId: 'coach-1',
      coachName: 'Kazah Mims', // Current user (demo)
      type: newNoteType,
      content: newNoteContent.trim(),
      createdAt: new Date().toISOString(),
    };

    setTimeline([newEntry, ...timeline]);
    setNewNoteContent('');
    setIsAddingNote(false);
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <button
        onClick={() => router.push('/cohortos/students')}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </button>

      {/* Student Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Avatar + Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
              {student.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>

            {/* Name + Contact */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{student.name}</h1>
                {student.isInternational && (
                  <span title="International Student">
                    <Globe className="h-5 w-5 text-slate-400" />
                  </span>
                )}
              </div>
              <p className="text-slate-500 mt-1">{student.email}</p>
              <p className="text-slate-500">{student.phone}</p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={handleSMS}>
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button variant="outline" size="sm" onClick={handleCall}>
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info + Status */}
        <div className="lg:col-span-1 space-y-6">
          {/* Editable Status Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Status</h2>
            <div className="space-y-4">
              {/* Status Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Coach Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assigned Coach
                </label>
                <select
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Unassigned</option>
                  {mockCoaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Blocker Checkbox */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBlocker}
                    onChange={(e) => setHasBlocker(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Has Blocker
                  </span>
                </label>
                {hasBlocker && (
                  <textarea
                    value={blockerNote}
                    onChange={(e) => setBlockerNote(e.target.value)}
                    placeholder="Describe the blocker..."
                    className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    rows={3}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Student Info Section (Read-only) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Student Info</h2>
            <div className="space-y-3">
              {/* Program */}
              <div className="flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{programConfig.label}</p>
                  <p className="text-xs text-slate-500">Program</p>
                </div>
              </div>

              {/* Target Role */}
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{student.targetRole}</p>
                  <p className="text-xs text-slate-500">Target Role</p>
                </div>
              </div>

              {/* Target Industry */}
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{student.targetIndustry}</p>
                  <p className="text-xs text-slate-500">Target Industry</p>
                </div>
              </div>

              {/* CPT Deadline */}
              {student.requiresCpt && student.cptDeadline && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(student.cptDeadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-500">CPT Deadline</p>
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {formatRelativeTime(student.lastUpdated)}
                  </p>
                  <p className="text-xs text-slate-500">Last Updated</p>
                </div>
              </div>
            </div>
          </div>

          {/* Survey Responses Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Survey Responses</h2>
            {/* Mock survey responses for demo */}
            {student.id === 'student-1' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-900">Internship Status Check-in</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Responded
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-900">Career Goals Survey</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Responded
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No survey responses yet</p>
            )}
          </div>
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-slate-900">Notes & Activity</h2>
              {!isAddingNote && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingNote(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              )}
            </div>

            {/* Add Note Form */}
            {isAddingNote && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-sm font-medium text-slate-700">Type:</label>
                  <div className="flex gap-2">
                    {noteTypeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setNewNoteType(opt.value)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1',
                          newNoteType === opt.value
                            ? 'bg-primary-500 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100',
                        )}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Enter your note..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNoteContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            )}

            {/* Timeline */}
            {timeline.length > 0 ? (
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No activity yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Add a note to start tracking this student's journey
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
