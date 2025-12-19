'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Briefcase, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

import { ApplicationWizard } from '@/components/applications/ApplicationWizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  experience: string;
  description: string;
  salary?: string;
  url?: string;
  posted?: string | null;
  category?: string | null;
  contract_type?: string | null;
  company_logo?: string | null;
}

export default function JobSearchPage() {
  const router = useRouter();
  const { user } = useUser();
  const clerkId = user?.id;
  const [activeTab, setActiveTab] = useState<'applications' | 'job-search'>('job-search');
  const [searchTab, setSearchTab] = useState<'search' | 'history'>('search');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobType, setJobType] = useState('all');
  const [experience, setExperience] = useState('Mid-level');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardJob, setWizardJob] = useState<{
    title: string;
    company: string;
    url?: string;
  } | null>(null);

  // Handle tab change to redirect to applications page
  const handleTabChange = (tab: 'applications' | 'job-search') => {
    if (tab === 'applications') {
      router.push('/applications');
    } else {
      setActiveTab(tab);
    }
  };

  // Convex: save history and load recent searches
  const createSearch = useMutation((api as any).jobs.createJobSearch);
  const recent = useQuery(
    (api as any).jobs.getRecentJobSearches,
    clerkId ? { clerkId, limit: 5 } : 'skip',
  );

  const buildMock = (q: string, loc: string): JobResult[] => {
    const title = q || 'Software Engineer';
    const place = loc || 'Remote';
    return [
      {
        id: 'mock-1',
        title,
        company: 'Tech Corp',
        location: place,
        type: jobType,
        experience,
        description: 'Exciting opportunity to work with cutting-edge technology...',
        salary: '$80,000 - $120,000',
        url: 'https://example.com/jobs/1',
        posted: new Date().toISOString(),
        category: 'Software Development',
        contract_type: jobType,
        company_logo: null,
      },
      {
        id: 'mock-2',
        title: `Senior ${title}`,
        company: 'Innovation Labs',
        location: place === 'Remote' ? 'Remote' : `${place}`,
        type: jobType,
        experience: 'Senior',
        description: 'Join our team of passionate developers...',
        salary: '$120,000 - $160,000',
        url: 'https://example.com/jobs/2',
        posted: new Date(Date.now() - 86400000).toISOString(),
        category: 'Engineering',
        contract_type: jobType,
        company_logo: null,
      },
    ];
  };

  const doSearchWithParams = async (opts?: {
    page?: number;
    query?: string;
    location?: string;
    jobType?: string;
    experience?: string;
    remoteOnly?: boolean;
  }) => {
    setLoading(true);
    try {
      const nextPage = opts?.page ?? page;
      const queryValue = opts?.query ?? query;
      const locationValue = opts?.location ?? location;
      const jobTypeValue = opts?.jobType ?? jobType;
      const experienceValue = opts?.experience ?? experience;
      const isRemoteOnly = opts?.remoteOnly ?? remoteOnly;
      const searchLocation = isRemoteOnly ? 'Remote' : locationValue;
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
        }),
      });
      const json = await res.json();
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
        } catch (e) {
          // ignore history errors
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const doSearch = (opts?: { page?: number }) => doSearchWithParams(opts);

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : false;

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

        {/* Toggle between All Applications and Find Jobs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'applications' ? 'default' : 'outline'}
            onClick={() => handleTabChange('applications')}
            className="flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4" />
            All Applications
          </Button>
          <Button
            variant={activeTab === 'job-search' ? 'default' : 'outline'}
            onClick={() => handleTabChange('job-search')}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Find Jobs
          </Button>
        </div>

        {/* Find Jobs Section */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Find Jobs</h2>
          <p className="text-sm text-muted-foreground mb-4">Search for jobs and start applying</p>

          {/* Search/History Toggle */}
          <div className="mb-4 flex gap-2 border-b">
            <Button
              variant="ghost"
              className={
                searchTab === 'search' ? 'border-b-2 border-primary rounded-none' : 'rounded-none'
              }
              onClick={() => setSearchTab('search')}
            >
              <Search className="h-4 w-4 mr-2" />
              Job Search
            </Button>
            <Button
              variant="ghost"
              className={
                searchTab === 'history' ? 'border-b-2 border-primary rounded-none' : 'rounded-none'
              }
              onClick={() => setSearchTab('history')}
            >
              History
            </Button>
          </div>

          {searchTab === 'search' ? (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Search for jobs on Adzuna directly within the application
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Keywords</label>
                  <Input
                    placeholder="Software Engineer, Product Manager, etc."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Location (Optional)</label>
                  <Input
                    placeholder="Chicago, Boston, etc."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={remoteOnly}
                      onChange={(e) => setRemoteOnly(e.target.checked)}
                      className="rounded"
                    />
                    Remote jobs only
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Job Type (Optional)</label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Experience Level (Optional)
                  </label>
                  <Select value={experience} onValueChange={setExperience}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mid-level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entry-level">Entry-level</SelectItem>
                      <SelectItem value="Mid-level">Mid-level</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => doSearch({ page: 1 })}
                  disabled={loading || !query.trim()}
                  className="w-full bg-primary-500 hover:bg-primary-700"
                >
                  {loading ? 'Searching...' : 'Search Jobs'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium mb-2">Recent Searches</p>
              {!recent || recent.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent searches yet.</div>
              ) : (
                <div className="space-y-2">
                  {recent.map((s: any) => {
                    const handleRerunSearch = () => {
                      const keywords = s.keywords || '';
                      const loc = s.location || '';
                      const type = s.search_data?.jobType || 'all';
                      const exp = s.search_data?.experience ?? experience;
                      const isRemote = s.search_data?.remoteOnly ?? false;
                      setQuery(keywords);
                      setLocation(loc);
                      setJobType(type);
                      setRemoteOnly(isRemote);
                      if (s.search_data?.experience) {
                        setExperience(exp);
                      }
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
                      <button
                        key={s._id}
                        type="button"
                        className="w-full flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left"
                        onClick={handleRerunSearch}
                      >
                        <div className="text-sm">
                          <div className="font-medium">{s.keywords || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.location ? `${s.location} • ` : ''}
                            {s.results_count || 0} results
                          </div>
                        </div>
                        <span className="text-sm text-primary-500">Search →</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {errorText && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 whitespace-pre-wrap break-words">
            {errorText}
          </div>
        )}

        {usingFallback && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Showing fallback results due to provider error. Try adjusting filters or retrying.
          </div>
        )}

        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="text-sm text-muted-foreground">No results yet. Try a search.</div>
          ) : (
            results.map((job) => (
              <Card key={job.id} className="border">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-base">
                        {job.title} — {job.company}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.location} • {job.type} • {job.experience}
                      </div>
                      <div className="text-xs mt-1">{job.description}</div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {job.salary && <span>{job.salary}</span>}
                        {job.category && <span>• {job.category}</span>}
                        {job.contract_type && <span>• {job.contract_type}</span>}
                        {job.posted &&
                          (() => {
                            try {
                              const d = new Date(job.posted);
                              return <span>• Posted {d.toLocaleDateString()}</span>;
                            } catch {
                              return null;
                            }
                          })()}
                      </div>
                      {job.url && (
                        <a
                          href={job.url}
                          className="inline-block text-xs text-blue-600 hover:underline mt-1"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View posting
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {job.company_logo && (
                        <img
                          src={job.company_logo}
                          alt={`${job.company} logo`}
                          className="h-8 w-8 object-contain rounded"
                        />
                      )}
                      <Button
                        onClick={() => {
                          // Open job posting in new tab
                          if (job.url) {
                            window.open(job.url, '_blank', 'noopener,noreferrer');
                          }
                          // Open wizard modal
                          setWizardJob({
                            title: job.title,
                            company: job.company,
                            url: job.url,
                          });
                          setWizardOpen(true);
                        }}
                      >
                        Start Application
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {totalPages && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => doSearch({ page: page - 1 })}
            >
              Prev
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => doSearch({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        )}

        <ApplicationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          job={wizardJob}
          onCreated={() => {
            // No-op; wizard redirects to /applications on success
          }}
        />
      </div>
    </div>
  );
}
