'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { ExternalLink, History, Linkedin, Loader2, Save } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { constructLinkedInSearchUrl } from '@/utils/linkedin';

export default function LinkedInIntegrationPage() {
  const { user: clerkUser } = useUser();
  const clerkId = clerkUser?.id;
  const { toast } = useToast();

  // Load Convex user profile (to get existing linkedin_url)
  const profile = useQuery(api.users.getUserByClerkId, clerkId ? { clerkId } : 'skip') as any;
  const updateUser = useMutation(api.users.updateUser);

  // Load recent LinkedIn searches from Convex (we reuse job searches table)
  const recent = useQuery(
    (api as any).jobs.getRecentJobSearches,
    clerkId ? { clerkId, limit: 10 } : 'skip',
  ) as any[] | 'skip';
  const createSearch = useMutation((api as any).jobs.createJobSearch);
  const createApplication = useMutation((api as any).applications.createApplication);

  // Profile URL form state
  const [profileUrl, setProfileUrl] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);

  React.useEffect(() => {
    if (profile && typeof profile === 'object' && profile.linkedin_url) {
      setProfileUrl(profile.linkedin_url);
    }
  }, [profile]);

  const saveProfileUrl = async () => {
    if (!clerkId) return;
    if (!profileUrl || !/^https?:\/\//i.test(profileUrl) || !profileUrl.includes('linkedin.com')) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid LinkedIn profile URL.',
        variant: 'destructive',
      });
      return;
    }
    setSavingProfile(true);
    try {
      await updateUser({ clerkId, updates: { linkedin_url: profileUrl } });
      toast({
        title: 'Saved',
        description: 'Your LinkedIn profile URL was updated.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description: e?.message || 'Could not save LinkedIn URL',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // LinkedIn job search builder
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [company, setCompany] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const searchUrl = useMemo(
    () => constructLinkedInSearchUrl({ jobTitle, location, remote: remoteOnly }),
    [jobTitle, location, remoteOnly],
  );

  const openSearch = async () => {
    if (!jobTitle.trim()) {
      toast({
        title: 'Job title required',
        description: 'Enter a job title to search LinkedIn.',
        variant: 'destructive',
      });
      return;
    }
    setIsSearching(true);
    try {
      // Record search in Convex history (best-effort)
      if (clerkId) {
        try {
          await createSearch({
            clerkId,
            keywords: jobTitle,
            location,
            remote_only: remoteOnly,
            results_count: 0,
            search_data: { source: 'linkedin' },
          });
        } catch {}
      }
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsSearching(false);
    }
  };

  const saveQuickApplication = async () => {
    if (!clerkId) return;
    if (!jobTitle.trim()) {
      toast({
        title: 'Job title required',
        description: 'Enter a job title to save an application.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await createApplication({
        company: company.trim() || 'LinkedIn',
        job_title: jobTitle.trim(),
        status: 'saved',
        source: 'LinkedIn',
        url: searchUrl,
      });
      toast({
        title: 'Saved',
        description: 'Application saved to your tracker.',
        variant: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description: e?.message || 'Could not save application',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB] mb-6 flex items-center gap-2">
        <Linkedin className="h-7 w-7 text-[#0A66C2]" />
        LinkedIn Integration
      </h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile URL</CardTitle>
          <CardDescription>
            Add your LinkedIn profile to enhance your professional presence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="https://www.linkedin.com/in/yourprofile"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
            />
            <Button onClick={saveProfileUrl} disabled={savingProfile || !clerkId}>
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Search on LinkedIn</CardTitle>
          <CardDescription>
            Quickly jump to LinkedIn job results. Due to LinkedIn restrictions, jobs open in a new
            tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div>
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                placeholder="Software Engineer, Product Manager, etc."
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="company">Company (optional)</Label>
              <Input
                id="company"
                placeholder="Company name"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="San Francisco, Remote, etc."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id="remoteOnly"
              checked={remoteOnly}
              onCheckedChange={(v) => setRemoteOnly(!!v)}
            />
            <Label htmlFor="remoteOnly">Remote jobs only</Label>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={openSearch} disabled={isSearching || !jobTitle.trim()}>
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening
                </>
              ) : (
                'Search on LinkedIn'
              )}
            </Button>
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:underline"
            >
              Preview URL <ExternalLink className="h-3 w-3 ml-1" />
            </a>
            <Button
              variant="outline"
              onClick={saveQuickApplication}
              disabled={!clerkId || !jobTitle.trim()}
            >
              <Save className="h-4 w-4 mr-2" /> Save to Applications
            </Button>
          </div>

          <div className="my-6 h-px bg-muted" />

          <div>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <History className="h-4 w-4" /> Recent searches
            </div>
            {!recent || (Array.isArray(recent) && recent.length === 0) ? (
              <div className="text-xs text-muted-foreground">No recent searches yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(recent as any[]).map((s) => (
                  <Button
                    key={s._id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setJobTitle(s.keywords || '');
                      setLocation(s.location || '');
                      setRemoteOnly(!!s.remote_only);
                      window.open(
                        constructLinkedInSearchUrl({
                          jobTitle: s.keywords || '',
                          location: s.location || '',
                          remote: !!s.remote_only,
                        }),
                        '_blank',
                        'noopener,noreferrer',
                      );
                    }}
                  >
                    {s.keywords || '—'}
                    {s.location ? ` · ${s.location}` : ''}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
