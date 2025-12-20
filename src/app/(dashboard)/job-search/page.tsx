'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Clock, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  DEFAULT_FILTERS,
  type ExperienceLevel,
  type JobResult,
  JobResultsList,
  JobSearchBar,
  JobSearchFilters,
  type JobSearchFiltersState,
  JobSearchHistoryCard,
  type JobSearchHistoryItem,
  type JobType,
  MobileFiltersSheet,
  type SortOption,
} from '@/components/job-search';
import { Button } from '@/components/ui/button';

export default function JobSearchPage() {
  const router = useRouter();
  const { user } = useUser();
  const clerkId = user?.id;

  // Tab state
  const [activeTab, setActiveTab] = useState<'applications' | 'job-search'>('job-search');
  const [searchTab, setSearchTab] = useState<'search' | 'history'>('search');

  // Search state
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [filters, setFilters] = useState<JobSearchFiltersState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  // Results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);

  // Mobile filters state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Derived state
  const hasSearched = total !== null;
  const hasActiveFilters =
    filters.remoteOnly !== DEFAULT_FILTERS.remoteOnly ||
    filters.jobType !== DEFAULT_FILTERS.jobType ||
    filters.experience !== DEFAULT_FILTERS.experience;
  const activeFilterCount = [
    filters.remoteOnly !== DEFAULT_FILTERS.remoteOnly,
    filters.jobType !== DEFAULT_FILTERS.jobType,
    filters.experience !== DEFAULT_FILTERS.experience,
  ].filter(Boolean).length;

  // Convex mutations and queries
  const createSearch = useMutation((api as any).jobs.createJobSearch);
  const createApplication = useMutation(api.applications.createApplication);
  const recent = useQuery(
    (api as any).jobs.getRecentJobSearches,
    clerkId ? { clerkId, limit: 10 } : 'skip',
  );

  // Handle tab change
  const handleTabChange = (tab: 'applications' | 'job-search') => {
    if (tab === 'applications') {
      router.push('/applications');
    } else {
      setActiveTab(tab);
    }
  };

  // Build mock data for fallback
  const buildMock = (q: string, loc: string): JobResult[] => {
    const title = q || 'Software Engineer';
    const place = loc || 'Remote';
    return [
      {
        id: 'mock-1',
        title,
        company: 'Tech Corp',
        location: place,
        type: filters.jobType,
        experience: filters.experience,
        description: 'Exciting opportunity to work with cutting-edge technology...',
        salary: '$80,000 - $120,000',
        url: 'https://example.com/jobs/1',
        posted: new Date().toISOString(),
        category: 'Software Development',
        contract_type: filters.jobType,
        company_logo: null,
      },
      {
        id: 'mock-2',
        title: `Senior ${title}`,
        company: 'Innovation Labs',
        location: place === 'Remote' ? 'Remote' : place,
        type: filters.jobType,
        experience: 'Senior',
        description: 'Join our team of passionate developers...',
        salary: '$120,000 - $160,000',
        url: 'https://example.com/jobs/2',
        posted: new Date(Date.now() - 86400000).toISOString(),
        category: 'Engineering',
        contract_type: filters.jobType,
        company_logo: null,
      },
    ];
  };

  // Main search function
  const doSearchWithParams = async (opts?: {
    page?: number;
    query?: string;
    location?: string;
    jobType?: string;
    experience?: string;
    remoteOnly?: boolean;
    sortBy?: SortOption;
  }) => {
    const queryValue = opts?.query ?? query;

    // Don't search without a query
    if (!queryValue.trim()) {
      return;
    }

    setLoading(true);
    try {
      const nextPage = opts?.page ?? page;
      const locationValue = opts?.location ?? location;
      const jobTypeValue = opts?.jobType ?? filters.jobType;
      const experienceValue = opts?.experience ?? filters.experience;
      const isRemoteOnly = opts?.remoteOnly ?? filters.remoteOnly;
      const sortByValue = opts?.sortBy ?? sortBy;
      const searchLocation = isRemoteOnly ? 'Remote' : locationValue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryValue,
          location: searchLocation,
          jobType: jobTypeValue === 'all' ? undefined : jobTypeValue,
          experienceLevel: experienceValue,
          page: nextPage,
          perPage,
          sortBy: sortByValue,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error('Invalid response from server');
      }

      if (!res.ok) {
        const details =
          typeof json?.details === 'string' ? json.details : JSON.stringify(json?.details || {});
        const meta = json?.meta ? ` | meta: ${JSON.stringify(json.meta)}` : '';
        setErrorText(`${json?.error || 'Search failed'}${details ? ' — ' + details : ''}${meta}`);
        const mock = buildMock(queryValue, locationValue);
        setResults(mock);
        setTotal(mock.length);
        setTotalPages(1);
        setPage(1);
        setUsingFallback(true);
        return;
      }

      setErrorText(null);
      setUsingFallback(false);
      setResults(json.jobs as JobResult[]);
      setPage(json.page || nextPage);
      setTotal(typeof json.total === 'number' ? json.total : null);
      setTotalPages(typeof json.totalPages === 'number' ? json.totalPages : null);

      // Save recent search in Convex (best-effort)
      if (clerkId) {
        try {
          await createSearch({
            clerkId,
            keywords: queryValue,
            location: locationValue,
            results_count:
              typeof json.total === 'number'
                ? json.total
                : Array.isArray(json.jobs)
                  ? json.jobs.length
                  : 0,
            search_data: {
              jobType: jobTypeValue === 'all' ? undefined : jobTypeValue,
              experience: experienceValue,
              remoteOnly: isRemoteOnly,
            },
          });
        } catch {
          // Ignore history errors
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Search handlers
  const handleSearch = () => {
    doSearchWithParams({ page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    doSearchWithParams({ page: newPage });
  };

  // Filter change handler (auto-search)
  const handleFiltersChange = (newFilters: JobSearchFiltersState) => {
    setFilters(newFilters);
    // Auto-trigger search if we have a query
    if (query.trim()) {
      doSearchWithParams({
        ...newFilters,
        query,
        location,
        page: 1,
      });
    }
  };

  // Sort change handler (auto-search)
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    if (query.trim()) {
      doSearchWithParams({ sortBy: newSort, page: 1 });
    }
  };

  // Reset handlers
  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    // Auto-search with reset filters if we have a query
    if (query.trim()) {
      doSearchWithParams({
        ...DEFAULT_FILTERS,
        page: 1,
      });
    }
  };

  const handleResetSearch = () => {
    setQuery('');
    setLocation('');
    setFilters(DEFAULT_FILTERS);
    setSortBy('relevance');
    setResults([]);
    setTotal(null);
    setTotalPages(null);
    setErrorText(null);
    setUsingFallback(false);
  };

  // Quick add handler (creates application immediately)
  const handleQuickAdd = async (job: JobResult) => {
    if (!clerkId) {
      toast.error('Please sign in to add jobs to your tracker');
      return;
    }
    try {
      await createApplication({
        clerkId,
        company: job.company,
        job_title: job.title,
        status: 'saved',
        url: job.url || undefined,
      });
      toast.success(`Added "${job.title}" at ${job.company} to your tracker`);
    } catch {
      toast.error('Failed to add job to tracker');
      throw new Error('Failed to add job');
    }
  };

  // Example search handler (for empty state chips)
  const handleExampleSearch = (searchQuery: string, searchLocation?: string) => {
    setQuery(searchQuery);
    if (searchLocation) setLocation(searchLocation);
    setSearchTab('search');
    doSearchWithParams({ query: searchQuery, location: searchLocation || '', page: 1 });
  };

  // History rerun handler
  const handleRerunSearch = (item: JobSearchHistoryItem) => {
    const keywords = item.keywords || '';
    const loc = item.location || '';
    const type = (item.search_data?.jobType || 'all') as JobType;
    const exp = (item.search_data?.experience || filters.experience) as ExperienceLevel;
    const isRemote = item.search_data?.remoteOnly ?? false;

    setQuery(keywords);
    setLocation(loc);
    setFilters({
      jobType: type,
      experience: exp,
      remoteOnly: isRemote,
    });
    setSearchTab('search');

    doSearchWithParams({
      page: 1,
      query: keywords,
      location: loc,
      jobType: type,
      experience: exp,
      remoteOnly: isRemote,
    });
  };

  return (
    <div className="w-full">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Application Tracker</h1>
          <p className="text-muted-foreground">
            Track every job from first save to final offer: applications, interviews, follow-ups,
            and more.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-gray-200">
          <Button
            variant="ghost"
            onClick={() => handleTabChange('applications')}
            className={`rounded-none px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'applications'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            All Applications
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleTabChange('job-search')}
            className={`rounded-none px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'job-search'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            <Search className="h-4 w-4 mr-2" />
            Find Jobs
          </Button>
        </div>

        {/* Search/History Toggle */}
        <div className="flex gap-2 border-b border-slate-200">
          <Button
            variant="ghost"
            className={`rounded-none ${
              searchTab === 'search'
                ? 'border-b-2 border-primary-500 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setSearchTab('search')}
          >
            <Search className="h-4 w-4 mr-2" />
            Job Search
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none ${
              searchTab === 'history'
                ? 'border-b-2 border-primary-500 text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setSearchTab('history')}
          >
            <Clock className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>

        {/* Content */}
        {searchTab === 'search' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Left Panel - Desktop Filters */}
            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <JobSearchFilters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onReset={handleResetFilters}
                  hasActiveFilters={hasActiveFilters}
                  disabled={loading}
                />
              </div>
            </aside>

            {/* Right Panel - Search & Results */}
            <div className="space-y-4">
              {/* Mobile Filters Button */}
              <div className="lg:hidden">
                <MobileFiltersSheet
                  open={mobileFiltersOpen}
                  onOpenChange={setMobileFiltersOpen}
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onReset={handleResetFilters}
                  hasActiveFilters={hasActiveFilters}
                  activeFilterCount={activeFilterCount}
                />
              </div>

              {/* Search Bar */}
              <JobSearchBar
                query={query}
                location={location}
                onQueryChange={setQuery}
                onLocationChange={setLocation}
                onSearch={handleSearch}
                onReset={handleResetSearch}
                loading={loading}
                hasSearched={hasSearched}
                disabled={loading}
              />

              {/* Error/Warning Messages */}
              {errorText && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap break-words">
                  {errorText}
                </div>
              )}

              {usingFallback && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Showing fallback results due to provider error. Try adjusting filters or retrying.
                </div>
              )}

              {/* Results */}
              <JobResultsList
                results={results}
                total={total}
                loading={loading}
                hasSearched={hasSearched}
                onQuickAdd={handleQuickAdd}
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onExampleSearch={handleExampleSearch}
                onResetFilters={handleResetFilters}
                sortBy={sortBy}
                onSortChange={handleSortChange}
              />
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Your recent job searches. Click to run the search again.
            </p>
            {recent === undefined ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : !recent || recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-slate-100 p-4 mb-4">
                  <Clock className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No search history yet</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-md">
                  Your recent searches will appear here after you search for jobs.
                </p>
                <Button variant="outline" onClick={() => setSearchTab('search')} className="mt-6">
                  Start Searching
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((item: JobSearchHistoryItem) => (
                  <JobSearchHistoryCard key={item._id} item={item} onRerun={handleRerunSearch} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
