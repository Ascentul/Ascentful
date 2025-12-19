// Shared types for job search components

export interface JobResult {
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

// Constants (defined first so types can derive from them)
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'date', label: 'Most Recent' },
  { value: 'salary', label: 'Highest Salary' },
] as const;

export const JOB_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
] as const;

export const EXPERIENCE_OPTIONS = [
  { value: 'Entry-level', label: 'Entry-level' },
  { value: 'Mid-level', label: 'Mid-level' },
  { value: 'Senior', label: 'Senior' },
] as const;

// Derived types from constants
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];
export type JobType = (typeof JOB_TYPE_OPTIONS)[number]['value'];
export type ExperienceLevel = (typeof EXPERIENCE_OPTIONS)[number]['value'];

export interface JobSearchFiltersState {
  remoteOnly: boolean;
  jobType: JobType;
  experience: ExperienceLevel;
}

export interface SearchParams {
  query: string;
  location: string;
  filters: JobSearchFiltersState;
  sortBy?: SortOption;
}

export interface JobSearchHistoryItem {
  _id: string;
  keywords?: string;
  location?: string;
  results_count?: number;
  search_data?: {
    jobType?: string;
    experience?: string;
    remoteOnly?: boolean;
  };
  created_at?: number;
}

export type EmptyStateVariant = 'initial' | 'no-results';

export const DEFAULT_FILTERS: JobSearchFiltersState = {
  remoteOnly: false,
  jobType: 'all',
  experience: 'Mid-level',
};

export const EXAMPLE_SEARCHES = [
  { query: 'Software Engineer', location: '' },
  { query: 'Product Manager', location: '' },
  { query: 'Data Analyst', location: '' },
  { query: 'UX Designer', location: '' },
];
