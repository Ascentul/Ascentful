'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  GraduationCap,
  Mail,
  MessageSquare,
  Plus,
  Send,
  StickyNote,
  Target,
  User,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AdvisorGate } from '@/components/advisor/AdvisorGate';
import {
  AddActionModal,
  AssetSlideOver,
  EngagementPanel,
  NextActionsPanel,
  type SelectedAsset,
  StudentTagsPopover,
  StudentTimeline,
  UpcomingSessionCard,
} from '@/components/advisor/student-profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

function StudentProfileContent() {
  const { user } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.studentId as Id<'users'>;
  const clerkId = user?.id;

  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalPrefill, setActionModalPrefill] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);

  // Read tab from URL search params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (
      tabParam &&
      ['timeline', 'notes', 'applications', 'goals', 'documents', 'sessions'].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Fetch enhanced student profile data with engagement metrics
  const profileData = useQuery(
    api.advisor_students.getStudentProfileEnhanced,
    clerkId && studentId ? { clerkId, studentId } : 'skip',
  );

  // Mutation for adding notes
  const addNote = useMutation(api.advisor_students.addAdvisorNote);

  const handleAddNote = async () => {
    if (!newNote.trim() || !clerkId) return;

    setIsSubmittingNote(true);
    try {
      await addNote({
        clerkId,
        studentId,
        note: newNote.trim(),
      });
      setNewNote('');
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  if (!profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading student profile...</p>
        </div>
      </div>
    );
  }

  const {
    student,
    goals,
    applications,
    resumes,
    coverLetters,
    projects,
    sessions,
    engagement,
    upcomingSession,
    assignedAdvisor,
    lastNoteAt,
  } = profileData;

  // Calculate stats
  const activeApps = applications.filter(
    (app) =>
      app.stage &&
      ['Saved', 'Applied', 'Phone Screen', 'Interviewing', 'Final Round'].includes(app.stage),
  ).length;
  const hasOffer = applications.some((app) => app.stage === 'Offer' || app.stage === 'Accepted');

  // Parse advisor notes (stored as timestamped entries)
  // Format: "[2026-01-03T04:30:52.258Z] username: note content"
  const advisorNotes = student.university_admin_notes
    ? student.university_admin_notes
        .split('\n\n')
        .filter(Boolean)
        .map((note) => {
          const match = note.match(/^\[(.+?)\]\s*([^:]+):\s*([\s\S]*)$/);
          if (match) {
            return {
              timestamp: new Date(match[1]).getTime(),
              author: match[2].trim(),
              content: match[3].trim(),
            };
          }
          // Fallback for notes without the expected format
          return {
            timestamp: Date.now(),
            author: 'Unknown',
            content: note,
          };
        })
        .reverse() // Show newest first
    : [];

  // Helper to format relative time for context strip
  const formatRelativeDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return null;
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper to open action modal with prefill
  const openActionModal = (prefillTitle?: string) => {
    setActionModalPrefill(prefillTitle);
    setIsActionModalOpen(true);
  };

  const handleActionModalClose = (open: boolean) => {
    setIsActionModalOpen(open);
    if (!open) {
      setActionModalPrefill(undefined);
    }
  };

  // Navigate to notes tab and focus
  const goToNotesTab = () => {
    setActiveTab('notes');
    // Focus would require a ref, just switching tab for now
  };

  // Get last session date
  const lastSessionDate = sessions.length > 0 ? sessions[0].start_at : null;

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Back button */}
        <Link
          href="/advisor/students"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>

        {/* Student Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{student.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{student.email}</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                {student.major && (
                  <div className="flex items-center gap-1 text-sm">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    {student.major}
                  </div>
                )}
                {student.graduation_year && (
                  <div className="text-sm text-muted-foreground">
                    Class of {student.graduation_year}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {hasOffer && <Badge className="bg-emerald-600">Has Offer</Badge>}
            {activeApps > 0 ? (
              <Badge variant="secondary">{activeApps} Active Apps</Badge>
            ) : (
              <Badge variant="outline">No Active Apps</Badge>
            )}
          </div>
        </div>

        {/* Advisor Context Strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-2">
          <div className="flex items-center gap-1.5">
            <UserCircle className="h-4 w-4" />
            <span>Assigned to:</span>
            <span className="font-medium text-foreground">
              {assignedAdvisor?.name || 'Unassigned'}
            </span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>Last session:</span>
            <span className="font-medium text-foreground">
              {formatRelativeDate(lastSessionDate) || 'No sessions yet'}
            </span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1.5">
            <StickyNote className="h-4 w-4" />
            <span>Last note:</span>
            <span className="font-medium text-foreground">
              {formatRelativeDate(lastNoteAt) || 'No notes yet'}
            </span>
          </div>
          <div className="flex-1" />
          <StudentTagsPopover studentId={studentId} tags={student.advisor_tags || []} />
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToNotesTab}>
            <Plus className="h-3 w-3 mr-1" />
            Add Note
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-semibold">{applications.length}</p>
                <p className="text-xs text-muted-foreground">Applications</p>
              </div>
            </div>
          </Card>
          <Card className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-semibold">{goals.length}</p>
                <p className="text-xs text-muted-foreground">Goals</p>
              </div>
            </div>
          </Card>
          <Card className="py-3 px-4">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-semibold">{resumes.length}</p>
                <p className="text-xs text-muted-foreground">Resumes</p>
              </div>
            </div>
          </Card>
          <Card className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-semibold">{sessions.length}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Two-column layout: Panels + Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Panels */}
          <div className="space-y-4 order-2 lg:order-1">
            <UpcomingSessionCard
              session={upcomingSession}
              studentId={studentId}
              onAddAction={openActionModal}
            />
            <EngagementPanel
              studentId={studentId}
              lastActiveAt={engagement.lastActiveAt}
              needsOutreach={engagement.needsOutreach}
              outreachSnoozedUntil={engagement.outreachSnoozedUntil}
              inactivityDays={engagement.inactivityDays}
            />
            <NextActionsPanel studentId={studentId} />
          </div>

          {/* Right column: Tabs */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="timeline" className="text-xs sm:text-sm">
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="applications" className="text-xs sm:text-sm">
                  Apps
                  <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">
                    {applications.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="goals" className="text-xs sm:text-sm">
                  Goals
                  <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">
                    {goals.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs sm:text-sm">
                  Docs
                  <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">
                    {resumes.length + coverLetters.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="sessions" className="text-xs sm:text-sm">
                  Sessions
                  <span className="ml-1 text-[10px] bg-muted px-1.5 rounded-full">
                    {sessions.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* Timeline Tab (New Default) */}
              <TabsContent value="timeline">
                <StudentTimeline studentId={studentId} onAssetSelect={setSelectedAsset} />
              </TabsContent>

              {/* Advisor Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Advisor Notes
                    </CardTitle>
                    <CardDescription>
                      Private notes visible only to advisors. These are not shared with the student.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add new note */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Add a private note about this student..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        rows={3}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAddNote}
                          disabled={!newNote.trim() || isSubmittingNote}
                          size="sm"
                        >
                          {isSubmittingNote ? (
                            'Adding...'
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Note
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Notes list */}
                    {advisorNotes.length > 0 ? (
                      <div className="space-y-3 border-t pt-4">
                        {advisorNotes.map((note, index) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-medium">
                              {note.author.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{note.author}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeDate(note.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No advisor notes yet</p>
                        <p className="text-xs mt-1">Add your first note above</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Applications Tab */}
              <TabsContent value="applications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Applications ({applications.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {applications.length > 0 ? (
                      <div className="space-y-2">
                        {applications.slice(0, 10).map((app) => (
                          <div
                            key={app._id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedAsset({ type: 'application', id: app._id })}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedAsset({ type: 'application', id: app._id });
                              }
                            }}
                          >
                            <div>
                              <p className="font-medium">{app.company}</p>
                              <p className="text-sm text-muted-foreground">{app.job_title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {app.stage || app.status || 'Unknown'}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                        {applications.length > 10 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            And {applications.length - 10} more applications...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No applications yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Goals Tab */}
              <TabsContent value="goals" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Career Goals ({goals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {goals.length > 0 ? (
                      <div className="space-y-2">
                        {goals.map((goal) => (
                          <div
                            key={goal._id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedAsset({ type: 'goal', id: goal._id })}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedAsset({ type: 'goal', id: goal._id });
                              }
                            }}
                          >
                            <div>
                              <p className="font-medium">{goal.title}</p>
                              {goal.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {goal.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={goal.status === 'completed' ? 'default' : 'outline'}>
                                {goal.status}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No goals set yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Resumes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5" />
                        Resumes ({resumes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {resumes.length > 0 ? (
                        <div className="space-y-2">
                          {resumes.map((resume) => (
                            <div
                              key={resume._id}
                              className="flex items-center justify-between p-2 border rounded-lg text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setSelectedAsset({ type: 'resume', id: resume._id })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedAsset({ type: 'resume', id: resume._id });
                                }
                              }}
                            >
                              <span className="truncate flex-1">
                                {resume.title || 'Untitled Resume'}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {new Date(
                                    resume.updated_at || resume.created_at,
                                  ).toLocaleDateString()}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No resumes</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Cover Letters */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Send className="h-5 w-5" />
                        Cover Letters ({coverLetters.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {coverLetters.length > 0 ? (
                        <div className="space-y-2">
                          {coverLetters.map((letter) => (
                            <div
                              key={letter._id}
                              className="flex items-center justify-between p-2 border rounded-lg text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() =>
                                setSelectedAsset({ type: 'cover_letter', id: letter._id })
                              }
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedAsset({ type: 'cover_letter', id: letter._id });
                                }
                              }}
                            >
                              <span className="truncate flex-1">
                                {letter.name || letter.company_name || 'Untitled'}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {new Date(
                                    letter.updated_at || letter.created_at,
                                  ).toLocaleDateString()}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No cover letters
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Projects */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FolderKanban className="h-5 w-5" />
                        Projects ({projects.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {projects.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-2">
                          {projects.map((project) => (
                            <div
                              key={project._id}
                              className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setSelectedAsset({ type: 'project', id: project._id })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedAsset({ type: 'project', id: project._id });
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{project.title}</p>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {project.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No projects
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Sessions ({sessions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessions.length > 0 ? (
                      <div className="space-y-2">
                        {sessions.slice(0, 10).map((session) => (
                          <div
                            key={session._id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                          >
                            <div>
                              <p className="font-medium">
                                {session.title || session.session_type || 'Advising Session'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(session.start_at).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={session.status === 'completed' ? 'default' : 'outline'}
                              >
                                {session.status || 'scheduled'}
                              </Badge>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/advisor/advising/sessions/${session._id}`}>
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {sessions.length > 10 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            And {sessions.length - 10} more sessions...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No sessions yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Action Modal (triggered from UpcomingSessionCard) */}
        <AddActionModal
          open={isActionModalOpen}
          onOpenChange={handleActionModalClose}
          studentId={studentId}
          prefillTitle={actionModalPrefill}
        />

        {/* Asset Detail Slide-over */}
        <AssetSlideOver
          selectedAsset={selectedAsset}
          studentId={studentId}
          onClose={() => setSelectedAsset(null)}
        />
      </div>
    </div>
  );
}

export default function AdvisorStudentProfilePage() {
  return (
    <AdvisorGate requiredFlag="advisor.students">
      <StudentProfileContent />
    </AdvisorGate>
  );
}
