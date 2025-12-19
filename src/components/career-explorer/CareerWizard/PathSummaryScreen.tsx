'use client';

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PlacedStep, StartingRole } from '@/lib/career-explorer/types';

interface RoleDetails {
  title: string;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  salaryRange: {
    min: number;
    max: number;
    median: number;
    currency: string;
  };
  dayInTheLife: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
  jobOpenings: number;
  companiesHiring: {
    name: string;
    logo?: string;
    jobCount: number;
  }[];
}

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  url: string;
  postedDate: string;
}

interface PathSummaryScreenProps {
  userName: string;
  userTitle?: string;
  startingRole: StartingRole;
  placedSteps: PlacedStep[];
  onBack: () => void;
  onUpdatePath: () => void;
}

// Generate instant placeholder content based on role title
function generatePlaceholderDetails(roleTitle: string): RoleDetails {
  const title = roleTitle;

  return {
    title,
    description: `As a ${title}, you will be responsible for driving key initiatives and contributing to organizational success. This role combines strategic thinking with hands-on execution to deliver meaningful results.`,
    responsibilities: [
      `Lead and execute ${title.toLowerCase()}-related projects and initiatives`,
      'Collaborate with cross-functional teams to achieve business objectives',
      'Analyze data and metrics to inform decision-making',
      'Develop and maintain best practices and documentation',
      'Mentor and support team members in professional growth',
    ],
    requiredSkills: [
      'Communication',
      'Problem Solving',
      'Project Management',
      'Analytical Thinking',
      'Collaboration',
    ],
    salaryRange: {
      min: 60000,
      max: 150000,
      median: 95000,
      currency: 'USD',
    },
    dayInTheLife: [
      '9:00 AM - Review priorities and respond to communications',
      '10:00 AM - Team standup and project coordination',
      '11:00 AM - Deep work on key deliverables',
      '1:00 PM - Lunch and networking',
      '2:00 PM - Meetings with stakeholders',
      '4:00 PM - Documentation and planning for next day',
    ],
    faqs: [
      {
        question: `What education is typically required for a ${title}?`,
        answer: `Most ${title} positions require a bachelor's degree in a relevant field, though experience and demonstrated skills can sometimes substitute for formal education.`,
      },
      {
        question: `What is the career progression for a ${title}?`,
        answer: `Career progression typically moves from entry-level to senior positions, with opportunities to specialize or move into management roles.`,
      },
      {
        question: `What industries hire ${title}s?`,
        answer: `${title}s are in demand across many industries including technology, finance, healthcare, consulting, and more.`,
      },
    ],
    jobOpenings: 0,
    companiesHiring: [
      { name: 'Google', jobCount: 50 },
      { name: 'Amazon', jobCount: 45 },
      { name: 'Microsoft', jobCount: 40 },
      { name: 'Apple', jobCount: 35 },
      { name: 'Meta', jobCount: 30 },
    ],
  };
}

// Cache types for preloaded data
interface RoleCache {
  details: RoleDetails | null;
  jobs: JobListing[];
  isLoadingDetails: boolean;
  isLoadingJobs: boolean;
}

export function PathSummaryScreen({
  userName,
  userTitle,
  startingRole,
  placedSteps,
  onBack,
  onUpdatePath,
}: PathSummaryScreenProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'salary'>('overview');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  // Cache for all role data - keyed by role title
  const [roleCache, setRoleCache] = useState<Record<string, RoleCache>>(() => {
    // Initialize cache with placeholder details for all roles
    const initialCache: Record<string, RoleCache> = {};
    placedSteps.forEach((step) => {
      initialCache[step.title] = {
        details: generatePlaceholderDetails(step.title),
        jobs: [],
        isLoadingDetails: true,
        isLoadingJobs: true,
      };
    });
    return initialCache;
  });

  const selectedRole = placedSteps[selectedStepIndex];

  // Get current role's cached data
  const currentCache = selectedRole ? roleCache[selectedRole.title] : null;
  const roleDetails =
    currentCache?.details || (selectedRole ? generatePlaceholderDetails(selectedRole.title) : null);
  const jobs = currentCache?.jobs || [];
  const isEnhancing = currentCache?.isLoadingDetails ?? false;
  const isLoadingJobs = currentCache?.isLoadingJobs ?? false;

  // Preload all role details and jobs on mount
  useEffect(() => {
    const preloadAllRoles = async () => {
      // Fetch details and jobs for all roles in parallel
      const fetchPromises = placedSteps.map(async (step) => {
        const roleTitle = step.title;

        // Fetch role details
        const detailsPromise = fetch('/api/career-explorer/role-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleTitle }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);

        // Fetch jobs
        const jobsPromise = fetch('/api/career-explorer/adzuna-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleTitle, limit: 6 }),
        })
          .then((res) => (res.ok ? res.json() : { jobs: [] }))
          .catch(() => ({ jobs: [] }));

        // Wait for both to complete
        const [detailsData, jobsData] = await Promise.all([detailsPromise, jobsPromise]);

        // Update cache for this role
        setRoleCache((prev) => ({
          ...prev,
          [roleTitle]: {
            details:
              detailsData || prev[roleTitle]?.details || generatePlaceholderDetails(roleTitle),
            jobs: jobsData?.jobs || [],
            isLoadingDetails: false,
            isLoadingJobs: false,
          },
        }));
      });

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);
    };

    preloadAllRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally run once on mount; placedSteps is stable on this summary screen
  }, []);

  const formatSalary = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Just posted';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button variant="outline" onClick={onBack} className="text-neutral-600">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onUpdatePath} className="min-w-[160px]">
          Update My Path
        </Button>
      </div>

      {/* User Name & Title */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">{userName}</h1>
        {userTitle && <p className="text-neutral-500 mt-1">{userTitle}</p>}
      </div>

      {/* Career Path Pills */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 justify-center">
        <span className="text-sm text-neutral-500 flex-shrink-0">Path:</span>
        <div className="flex items-center gap-2">
          {placedSteps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setSelectedStepIndex(index)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                  ${
                    selectedStepIndex === index
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                      : 'bg-white text-neutral-700 border border-neutral-300 hover:border-neutral-400'
                  }
                `}
              >
                {step.title}
              </button>
              {index < placedSteps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'overview' | 'salary')}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="salary">Salary</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {roleDetails ? (
            <div className="space-y-8">
              {/* Role Description */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold text-neutral-900">Role Description</h2>
                  {isEnhancing && (
                    <span className="flex items-center gap-1.5 text-xs text-primary-500">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      Enhancing...
                    </span>
                  )}
                </div>
                <p className="text-neutral-600 leading-relaxed">{roleDetails.description}</p>
              </section>

              {/* Responsibilities */}
              <section>
                <h2 className="text-xl font-semibold text-neutral-900 mb-4">Responsibilities</h2>
                <ul className="space-y-3">
                  {roleDetails.responsibilities.map((resp, index) => (
                    <li key={index} className="flex items-start gap-3 text-neutral-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Salary Range Summary */}
              <section>
                <h2 className="text-xl font-semibold text-neutral-900 mb-4">Salary Range</h2>
                <div className="bg-neutral-50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <span className="font-medium text-neutral-700">Annual Salary</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatSalary(roleDetails.salaryRange.median)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-gradient-to-r from-emerald-300 to-emerald-500 rounded-full"
                      style={{ left: '10%', right: '10%' }}
                    />
                    <div
                      className="absolute top-0 w-1 h-full bg-emerald-700"
                      style={{ left: '50%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-neutral-500">
                    <span>{formatSalary(roleDetails.salaryRange.min)}</span>
                    <span className="font-medium text-emerald-600">Median</span>
                    <span>{formatSalary(roleDetails.salaryRange.max)}</span>
                  </div>
                </div>
              </section>

              {/* Required Skills */}
              <section>
                <h2 className="text-xl font-semibold text-neutral-900 mb-4">Required Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {roleDetails.requiredSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              {/* Recommended Jobs */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-neutral-900">Recommended Jobs</h2>
                  <span className="text-sm text-neutral-500">Powered by Adzuna</span>
                </div>
                {isLoadingJobs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  </div>
                ) : jobs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {jobs.map((job) => (
                      <Card key={job.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-neutral-900 mb-1 line-clamp-1">
                            {job.title}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-neutral-600 mb-2">
                            <Building2 className="w-4 h-4" />
                            <span className="line-clamp-1">{job.company}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
                            <MapPin className="w-4 h-4" />
                            <span className="line-clamp-1">{job.location}</span>
                          </div>
                          {(job.salaryMin || job.salaryMax) && (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-2">
                              <DollarSign className="w-4 h-4" />
                              <span>
                                {job.salaryMin && job.salaryMax
                                  ? `${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)}`
                                  : job.salaryMin
                                    ? `From ${formatSalary(job.salaryMin)}`
                                    : `Up to ${formatSalary(job.salaryMax!)}`}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                            <span className="text-xs text-neutral-400">
                              {formatDate(job.postedDate)}
                            </span>
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    No job listings available at the moment
                  </div>
                )}
              </section>

              {/* Day in the Life */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-neutral-900">Day in the Life</h2>
                </div>
                <div className="bg-neutral-50 rounded-xl p-6">
                  <div className="space-y-4">
                    {roleDetails.dayInTheLife.map((activity, index) => {
                      const [time, ...descParts] = activity.split(' - ');
                      const description = descParts.join(' - ');
                      return (
                        <div key={index} className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-20 text-sm font-medium text-primary-600">
                            {time}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary-400" />
                              <span className="text-neutral-700">{description}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* FAQ */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-neutral-900">
                    Frequently Asked Questions
                  </h2>
                </div>
                <div className="space-y-3">
                  {roleDetails.faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="border border-neutral-200 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedFaqIndex(expandedFaqIndex === index ? null : index)
                        }
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors"
                      >
                        <span className="font-medium text-neutral-900">{faq.question}</span>
                        {expandedFaqIndex === index ? (
                          <ChevronUp className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        )}
                      </button>
                      {expandedFaqIndex === index && (
                        <div className="px-4 pb-4 text-neutral-600">{faq.answer}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="text-center py-16 text-neutral-500">
              Select a role from your path to see details
            </div>
          )}
        </TabsContent>

        <TabsContent value="salary">
          {roleDetails?.salaryRange ? (
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-neutral-900 mb-2">
                  Salary Range for {roleDetails.title}
                </h2>
                <p className="text-neutral-500">Based on industry data and market research</p>
              </div>

              {/* Large Salary Display */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-8 text-center">
                <p className="text-sm text-emerald-700 font-medium mb-2">Median Annual Salary</p>
                <p className="text-5xl font-bold text-emerald-700">
                  {formatSalary(roleDetails.salaryRange.median)}
                </p>
              </div>

              {/* Salary Range Bar */}
              <div className="space-y-4">
                <div className="relative h-6 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300 rounded-full"
                    style={{ left: '5%', right: '5%' }}
                  />
                  <div
                    className="absolute top-0 w-1.5 h-full bg-emerald-800 rounded-full"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between">
                  <div className="text-center">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Minimum</p>
                    <p className="text-lg font-semibold text-neutral-700">
                      {formatSalary(roleDetails.salaryRange.min)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-emerald-600 uppercase tracking-wide">Median</p>
                    <p className="text-lg font-semibold text-emerald-600">
                      {formatSalary(roleDetails.salaryRange.median)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Maximum</p>
                    <p className="text-lg font-semibold text-neutral-700">
                      {formatSalary(roleDetails.salaryRange.max)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Salary Factors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h3 className="font-medium text-neutral-900">Experience Impact</h3>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Senior-level professionals typically earn 40-60% more than entry-level
                      positions in this role.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-blue-500" />
                      <h3 className="font-medium text-neutral-900">Location Factor</h3>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Salaries in major tech hubs (SF, NYC, Seattle) are typically 20-30% higher
                      than the national average.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-5 h-5 text-purple-500" />
                      <h3 className="font-medium text-neutral-900">Company Size</h3>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Large tech companies and well-funded startups often pay premium salaries plus
                      equity compensation.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Briefcase className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-medium text-neutral-900">Total Compensation</h3>
                    </div>
                    <p className="text-sm text-neutral-600">
                      Total comp including bonuses, equity, and benefits can be 20-50% higher than
                      base salary.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Companies Hiring */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Top Companies Hiring
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {roleDetails.companiesHiring.map((company, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center p-3 bg-neutral-50 rounded-xl"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center mb-2">
                        <Building2 className="w-5 h-5 text-neutral-400" />
                      </div>
                      <span className="font-medium text-sm text-neutral-900 text-center">
                        {company.name}
                      </span>
                      <span className="text-xs text-neutral-500">{company.jobCount} jobs</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-neutral-50 rounded-xl p-4">
                <p className="text-sm text-neutral-500 text-center">
                  Salary data is based on industry averages and may vary by location, experience,
                  company size, and negotiation. Always research specific companies and roles for
                  the most accurate compensation information.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-neutral-500">
              Salary data not available for this role
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
