'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { BarChart3, Download, Eye, Loader2, Search } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EvidenceBadge } from '@/components/outcomes/EvidenceViewer';
import { KPICard, KPICardGroup } from '@/components/outcomes/KPICard';
import { OutcomeDetailModal, OutcomeRecord } from '@/components/outcomes/OutcomeDetailModal';
import { OutcomesFilterBar, OutcomesFilters } from '@/components/outcomes/OutcomesFilterBar';
import { Snapshot, SnapshotBanner, SnapshotSelector } from '@/components/outcomes/SnapshotSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

const OUTCOME_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  known: { label: 'Known', variant: 'default' },
  partial: { label: 'Partial', variant: 'secondary' },
  unknown: { label: 'Unknown', variant: 'outline' },
};

const OUTCOME_TYPE_LABELS: Record<string, string> = {
  employed_fulltime: 'Full-time',
  employed_parttime: 'Part-time',
  continuing_education: 'Cont. Ed.',
  military: 'Military',
  volunteer: 'Volunteer',
  seeking: 'Seeking',
  not_seeking: 'Not Seeking',
};

const CHART_COLORS = ['#5371FF', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function OutcomesDashboardPage() {
  const { user: clerkUser } = useUser();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // State
  const [filters, setFilters] = useState<OutcomesFilters>({});
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'cohort' | 'program' | 'degree_level'>('program');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeRecord | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Access control
  const canAccess =
    !!user && (isAdmin || user.role === 'university_admin' || user.role === 'advisor');
  const universityId = user?.university_id as Id<'universities'> | undefined;

  // Queries
  const cohorts = useQuery(
    api.graduation_outcomes.getCohortsByInstitution,
    universityId ? { institutionId: universityId } : 'skip',
  );

  const majors = useQuery(
    api.majors.getMajorsByUniversity,
    universityId ? { universityId } : 'skip',
  );

  const analytics = useQuery(
    api.graduation_outcomes.getOutcomesAnalytics,
    universityId && !selectedSnapshotId
      ? {
          institutionId: universityId,
          cohortIds: filters.cohortIds as Id<'graduation_cohorts'>[] | undefined,
          degreeLevels: filters.degreeLevels,
          programs: filters.programs,
          graduationYear: filters.graduationYear,
          groupBy,
        }
      : 'skip',
  );

  const snapshots = useQuery(
    api.graduation_outcomes.listSnapshots,
    universityId ? { institutionId: universityId } : 'skip',
  );

  const selectedSnapshot = useQuery(
    api.graduation_outcomes.getSnapshot,
    selectedSnapshotId ? { snapshotId: selectedSnapshotId as Id<'outcome_snapshots'> } : 'skip',
  );

  // Mutations
  const createSnapshotMutation = useMutation(api.graduation_outcomes.createSnapshot);
  const deleteSnapshotMutation = useMutation(api.graduation_outcomes.deleteSnapshot);

  // Derived data
  const cohortOptions = useMemo(() => {
    if (!cohorts) return [];
    return cohorts.map((c) => ({
      id: c._id,
      label: `${c.graduation_term} ${c.graduation_year}`,
    }));
  }, [cohorts]);

  const programOptions = useMemo(() => {
    if (!majors) return [];
    return majors.map((m) => ({
      id: m._id,
      name: m.name,
    }));
  }, [majors]);

  const yearOptions = useMemo(() => {
    if (!cohorts) return [];
    const years = [...new Set(cohorts.map((c) => c.graduation_year))];
    return years.sort((a, b) => b - a);
  }, [cohorts]);

  // Get the data to display (either live or from snapshot)
  const displayData = useMemo(() => {
    if (selectedSnapshot) {
      return {
        summary: selectedSnapshot.metrics,
        breakdown: selectedSnapshot.breakdown_by_program || {},
        outcomes: [],
      };
    }
    return analytics || { summary: null, breakdown: {}, outcomes: [] };
  }, [analytics, selectedSnapshot]);

  // Filter outcomes by search query
  const filteredOutcomes = useMemo(() => {
    if (!displayData.outcomes) return [];
    if (!searchQuery.trim()) return displayData.outcomes;

    const query = searchQuery.toLowerCase();
    return displayData.outcomes.filter(
      (o: OutcomeRecord) =>
        o.student_name?.toLowerCase().includes(query) ||
        o.student_email?.toLowerCase().includes(query) ||
        o.employer_name?.toLowerCase().includes(query),
    );
  }, [displayData.outcomes, searchQuery]);

  // Chart data for breakdown
  const breakdownChartData = useMemo(() => {
    if (!displayData.breakdown) return [];
    return Object.entries(displayData.breakdown).map(
      ([key, metrics]: [
        string,
        { knowledge_rate?: number; employment_rate?: number; total_students?: number },
      ]) => ({
        name: key,
        knowledgeRate: metrics.knowledge_rate || 0,
        employmentRate: metrics.employment_rate || 0,
        total: metrics.total_students || 0,
      }),
    );
  }, [displayData.breakdown]);

  // Handlers
  const handleCreateSnapshot = useCallback(
    async (name: string, description?: string) => {
      if (!universityId || !displayData.summary) {
        toast({
          title: 'Cannot create snapshot',
          description: 'Analytics data is not yet loaded.',
          variant: 'destructive',
        });
        return;
      }

      setIsCreatingSnapshot(true);
      try {
        await createSnapshotMutation({
          institutionId: universityId,
          name,
          description,
          filters: {
            cohortIds: filters.cohortIds as Id<'graduation_cohorts'>[] | undefined,
            degreeLevels: filters.degreeLevels,
            programs: filters.programs,
            graduationYear: filters.graduationYear,
          },
          metrics: displayData.summary,
          breakdownByProgram: displayData.breakdown,
        });
        toast({
          title: 'Snapshot saved',
          description: `"${name}" has been saved successfully.`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to save snapshot. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsCreatingSnapshot(false);
      }
    },
    [universityId, displayData, filters, createSnapshotMutation, toast],
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        await deleteSnapshotMutation({
          snapshotId: snapshotId as Id<'outcome_snapshots'>,
        });
        if (selectedSnapshotId === snapshotId) {
          setSelectedSnapshotId(null);
        }
        toast({
          title: 'Snapshot deleted',
          description: 'The snapshot has been deleted.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete snapshot.',
          variant: 'destructive',
        });
      }
    },
    [deleteSnapshotMutation, selectedSnapshotId, toast],
  );

  const handleExport = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsExporting(true);
    try {
      const response = await fetch('/api/university/export-outcomes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: clerkUser.id,
          filters,
          snapshotId: selectedSnapshotId,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `outcomes-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: 'Export complete',
        description: 'The CSV file has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Unable to export data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [clerkUser?.id, filters, selectedSnapshotId, toast]);

  // Loading state
  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have access to Outcomes Intelligence.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!universityId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>No University Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You are not assigned to a university. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = !cohorts || !majors || (!analytics && !selectedSnapshot);

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-700">
            Outcomes Intelligence
          </h1>
          <p className="text-muted-foreground">
            Track graduate outcomes and generate defensible reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SnapshotSelector
            snapshots={(snapshots || []) as Snapshot[]}
            selectedSnapshotId={selectedSnapshotId}
            onSelectSnapshot={setSelectedSnapshotId}
            onCreateSnapshot={handleCreateSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            isCreating={isCreatingSnapshot}
          />
          <Button onClick={handleExport} disabled={isExporting || isLoading}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Snapshot Banner */}
      {selectedSnapshot && (
        <SnapshotBanner
          snapshot={selectedSnapshot as Snapshot}
          onViewLive={() => setSelectedSnapshotId(null)}
        />
      )}

      {/* Filters */}
      {!selectedSnapshotId && (
        <OutcomesFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          cohortOptions={cohortOptions}
          programOptions={programOptions}
          yearOptions={yearOptions}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <KPICardGroup>
            <KPICard
              title="Knowledge Rate"
              value={displayData.summary?.knowledge_rate || 0}
              subtitle={`${displayData.summary?.known_outcomes || 0} of ${displayData.summary?.total_students || 0} known`}
              colorScheme="primary"
            />
            <KPICard
              title="Employment Rate"
              value={displayData.summary?.employment_rate || 0}
              subtitle={`${(displayData.summary?.employed_fulltime || 0) + (displayData.summary?.employed_parttime || 0)} employed`}
              colorScheme="success"
            />
            <KPICard
              title="Continuing Education"
              value={displayData.summary?.continuing_ed_rate || 0}
              subtitle={`${displayData.summary?.continuing_education || 0} pursuing further education`}
              colorScheme="neutral"
            />
            <KPICard
              title="Total Students"
              value={displayData.summary?.total_students || 0}
              format="number"
              colorScheme="neutral"
            />
          </KPICardGroup>

          {/* Breakdown Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base font-medium">Breakdown by Segment</CardTitle>
                <CardDescription>
                  Compare knowledge and employment rates across groups
                </CardDescription>
              </div>
              {!selectedSnapshotId && (
                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy(v as 'cohort' | 'program' | 'degree_level')}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">By Program</SelectItem>
                    <SelectItem value="cohort">By Cohort</SelectItem>
                    <SelectItem value="degree_level">By Degree</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              {breakdownChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdownChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={120} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="knowledgeRate" name="Knowledge Rate" fill="#5371FF" />
                      <Bar dataKey="employmentRate" name="Employment Rate" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-80 text-neutral-500">
                  <div className="text-center">
                    <BarChart3 className="mx-auto h-12 w-12 text-neutral-300" />
                    <p className="mt-2">No data available for breakdown</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outcomes Table */}
          {!selectedSnapshotId && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">Individual Outcomes</CardTitle>
                    <CardDescription>
                      {filteredOutcomes.length} records
                      {searchQuery && ` matching "${searchQuery}"`}
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      placeholder="Search students..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-card border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Cohort</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Outcome Type</TableHead>
                        <TableHead>Evidence</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutcomes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                            {searchQuery
                              ? 'No outcomes match your search'
                              : 'No outcome records found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOutcomes.slice(0, 50).map((outcome: OutcomeRecord) => {
                          const statusConfig =
                            OUTCOME_STATUS_CONFIG[outcome.outcome_status] ||
                            OUTCOME_STATUS_CONFIG.unknown;

                          return (
                            <TableRow key={outcome._id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{outcome.student_name || 'Unknown'}</p>
                                  <p className="text-xs text-neutral-500">
                                    {outcome.student_email || outcome.external_student_id || '—'}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-neutral-600">
                                {outcome.cohort_name || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {outcome.outcome_type
                                  ? OUTCOME_TYPE_LABELS[outcome.outcome_type] ||
                                    outcome.outcome_type
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <EvidenceBadge
                                  evidenceCount={outcome.evidence_files?.length || 0}
                                  isVerified={outcome.is_verified}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedOutcome(outcome)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredOutcomes.length > 50 && (
                  <p className="mt-2 text-center text-sm text-neutral-500">
                    Showing first 50 of {filteredOutcomes.length} records. Use filters to narrow
                    results.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Outcome Detail Modal */}
      <OutcomeDetailModal
        outcome={selectedOutcome}
        isOpen={!!selectedOutcome}
        onClose={() => setSelectedOutcome(null)}
      />
    </div>
  );
}
