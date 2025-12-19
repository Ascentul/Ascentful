'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ApplicationDetails } from '@/components/applications/ApplicationDetails';
import {
  ApplicationKanbanBoard,
  type ApplicationStatus,
  type KanbanApplication,
  KanbanToolbar,
} from '@/components/applications/kanban';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useKanbanUndo } from '@/hooks/useKanbanUndo';
import { KanbanAnalytics } from '@/lib/kanban/analytics';

// Legacy Application type for ApplicationDetails compatibility
interface LegacyApplication {
  id: string | number;
  company: string;
  job_title: string;
  status: ApplicationStatus;
  url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  resume_id?: string | null;
  cover_letter_id?: string | null;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { hasPremium } = useAuth();

  // UI State
  const [creating, setCreating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'applications' | 'job-search'>('applications');
  const [searchQuery, setSearchQuery] = useState('');

  // Application detail modal state
  const [showDetails, setShowDetails] = useState(false);
  const [selectedApp, setSelectedApp] = useState<KanbanApplication | null>(null);

  // Form state for new application dialog
  const [form, setForm] = useState({
    company: '',
    job_title: '',
    status: 'saved' as ApplicationStatus,
    url: '',
    notes: '',
  });

  // Check if user is on free plan
  const isFreeUser = !hasPremium;

  // Convex queries and mutations
  const kanbanData = useQuery(
    api.applications.getApplicationsForKanban,
    user?.id ? { clerkId: user.id } : 'skip',
  );

  const createMutation = useMutation(api.applications.createApplication);
  const updateMutation = useMutation(api.applications.updateApplication);
  const moveMutation = useMutation(api.applications.moveApplication);

  // Count total applications for free plan limit check
  const totalApps = useMemo(() => {
    if (!kanbanData) return 0;
    return Object.values(kanbanData).flat().length;
  }, [kanbanData]);

  // Filter applications by search query
  const filteredKanbanData = useMemo(() => {
    if (!kanbanData) return null;
    if (!searchQuery.trim()) return kanbanData;

    const query = searchQuery.toLowerCase();
    const filtered: Record<ApplicationStatus, KanbanApplication[]> = {
      saved: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: [],
    };

    for (const [status, apps] of Object.entries(kanbanData)) {
      filtered[status as ApplicationStatus] = (apps as KanbanApplication[]).filter(
        (app) =>
          app.company.toLowerCase().includes(query) || app.job_title.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [kanbanData, searchQuery]);

  // Handle tab change
  const handleTabChange = (tab: 'applications' | 'job-search') => {
    if (tab === 'job-search') {
      router.push('/job-search');
    } else {
      setActiveTab(tab);
    }
  };

  // Handle "New Application" button click
  const handleNewApplicationClick = (prefilledStatus?: ApplicationStatus) => {
    // Check free user limit before opening dialog
    if (isFreeUser && totalApps >= 1) {
      setShowUpgradeModal(true);
      return;
    }
    // Set prefilled status if provided (from quick add button)
    if (prefilledStatus) {
      setForm((prev) => ({ ...prev, status: prefilledStatus }));
    }
    setShowAddDialog(true);
  };

  // Create new application
  const createApp = async () => {
    if (!form.company.trim() || !form.job_title.trim()) return;

    // Check free user limit
    if (isFreeUser && totalApps >= 1) {
      setShowUpgradeModal(true);
      return;
    }

    setCreating(true);
    try {
      if (!user?.id) return;
      await createMutation({
        clerkId: user.id,
        company: form.company,
        job_title: form.job_title,
        status: form.status,
        url: form.url || undefined,
        notes: form.notes || undefined,
      });
      // Reset form and close dialog
      setForm({
        company: '',
        job_title: '',
        status: 'saved',
        url: '',
        notes: '',
      });
      setShowAddDialog(false);
    } catch (error) {
      console.error('Failed to create application:', error);
      toast.error('Failed to create application. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Handle card click to open details
  const handleCardClick = useCallback((application: KanbanApplication) => {
    setSelectedApp(application);
    setShowDetails(true);
  }, []);

  // Handle undo for Kanban moves
  const handleUndoMove = useCallback(
    async (applicationId: string, targetStatus: ApplicationStatus) => {
      if (!user?.id || !kanbanData) return;

      // Find current status to track for analytics (use unfiltered data for reliability)
      let currentStatus: ApplicationStatus | undefined;
      for (const [status, apps] of Object.entries(kanbanData)) {
        if (apps.find((a) => a._id === applicationId)) {
          currentStatus = status as ApplicationStatus;
          break;
        }
      }

      // Move to end of target column (use unfiltered data for correct positioning)
      const targetApps = kanbanData[targetStatus] || [];
      const lastApp = targetApps[targetApps.length - 1];

      try {
        await moveMutation({
          clerkId: user.id,
          applicationId: applicationId as Id<'applications'>,
          newStatus: targetStatus,
          beforeId: lastApp?._id as Id<'applications'> | undefined,
          afterId: undefined,
        });

        // Track undo analytics
        if (currentStatus) {
          KanbanAnalytics.trackMoveUndone({
            applicationId,
            fromStatus: currentStatus,
            toStatus: targetStatus,
          });
        }
      } catch (error) {
        console.error('Failed to undo move:', error);
        toast.error('Failed to undo move. Please try again.');
      }
    },
    [user?.id, kanbanData, moveMutation],
  );

  // Initialize undo hook
  const { recordMove } = useKanbanUndo({ onUndo: handleUndoMove });

  // Handle drag-and-drop move
  const handleMove = useCallback(
    async (
      applicationId: string,
      newStatus: ApplicationStatus,
      beforeId?: string,
      afterId?: string,
    ) => {
      if (!user?.id || !kanbanData) return;

      // Find current status and company name for undo (use unfiltered data for reliability)
      let currentStatus: ApplicationStatus | undefined;
      let company: string | undefined;
      for (const [status, apps] of Object.entries(kanbanData)) {
        const app = apps.find((a) => a._id === applicationId);
        if (app) {
          currentStatus = status as ApplicationStatus;
          company = app.company;
          break;
        }
      }

      try {
        await moveMutation({
          clerkId: user.id,
          applicationId: applicationId as Id<'applications'>,
          newStatus,
          beforeId: beforeId as Id<'applications'> | undefined,
          afterId: afterId as Id<'applications'> | undefined,
        });

        // Record move for undo (only if status actually changed)
        if (currentStatus && currentStatus !== newStatus && company) {
          recordMove({
            applicationId,
            company,
            fromStatus: currentStatus,
            toStatus: newStatus,
          });

          // Track analytics
          KanbanAnalytics.trackCardDropped({
            applicationId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            success: true,
            method: 'drag',
          });
        }
      } catch (error) {
        console.error('Failed to move application:', error);
        toast.error('Failed to move application. Please try again.');

        // Track failure analytics
        if (currentStatus) {
          KanbanAnalytics.trackCardDropped({
            applicationId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            success: false,
            method: 'drag',
          });
        }
      }
    },
    [user?.id, kanbanData, moveMutation, recordMove],
  );

  // Convert KanbanApplication to LegacyApplication for ApplicationDetails
  const selectedLegacyApp: LegacyApplication | null = selectedApp
    ? {
        id: selectedApp._id,
        company: selectedApp.company,
        job_title: selectedApp.job_title,
        status: selectedApp.status,
        url: selectedApp.url,
        notes: selectedApp.notes,
        created_at: new Date(selectedApp.created_at).toISOString(),
        updated_at: new Date(selectedApp.updated_at).toISOString(),
      }
    : null;

  return (
    <div className="w-full">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Application Tracker
            </h1>
            <p className="text-muted-foreground">
              Drag applications between columns to update their status
            </p>
          </div>
          <Button
            onClick={() => handleNewApplicationClick()}
            className="bg-primary-500 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" /> New Application
          </Button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('applications')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'applications'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            All Applications
          </button>
          <button
            onClick={() => handleTabChange('job-search')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'job-search'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            Find Jobs
          </button>
        </div>

        {/* Search Toolbar */}
        <KanbanToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        {/* Loading State */}
        {!clerkLoaded || kanbanData === undefined ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          /* Kanban Board */
          <ApplicationKanbanBoard
            applications={filteredKanbanData || kanbanData}
            onMove={handleMove}
            onCardClick={handleCardClick}
            onQuickAdd={handleNewApplicationClick}
          />
        )}

        {/* Application Details Modal */}
        {selectedLegacyApp && (
          <ApplicationDetails
            open={showDetails}
            onOpenChange={setShowDetails}
            application={selectedLegacyApp}
            onChanged={(updated) => {
              // Update selected state for immediate UI feedback
              if (updated && selectedApp) {
                setSelectedApp({
                  ...selectedApp,
                  company: updated.company,
                  job_title: updated.job_title,
                  status: updated.status,
                  url: updated.url,
                  notes: updated.notes,
                });
              }
            }}
            saveFn={async (id, values) => {
              if (!user?.id) throw new Error('Not signed in');
              await updateMutation({
                clerkId: user.id,
                applicationId: id as Id<'applications'>,
                updates: {
                  company: values.company,
                  job_title: values.job_title,
                  status: values.status,
                  url: values.url,
                  notes: values.notes,
                },
              });
              return { ...(selectedLegacyApp as LegacyApplication), ...values };
            }}
          />
        )}

        {/* Add Application Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Application</DialogTitle>
              <DialogDescription>
                Manually enter details for a job application you want to track.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input
                  placeholder="Company name"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Job Title</label>
                <Input
                  placeholder="Role title"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as ApplicationStatus })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saved">In Progress</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="interview">Interviewing</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Job URL (optional)</label>
                <Input
                  placeholder="https://..."
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  placeholder="Additional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={createApp}
                disabled={creating || !form.company.trim() || !form.job_title.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Application'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upgrade Modal for Free User Limits */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="application"
      />
    </div>
  );
}
