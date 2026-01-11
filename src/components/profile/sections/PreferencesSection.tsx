'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Plus, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export interface PreferencesSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

type ExperienceLevel = 'entry' | 'mid' | 'senior' | '';
type SalaryType = 'exact' | 'range';

const ROLE_OPTIONS = [
  'Software Engineer',
  'Product Manager',
  'Data Scientist',
  'Designer',
  'Marketing Manager',
  'Sales Representative',
  'Business Analyst',
  'Project Manager',
  'Accountant',
  'HR Manager',
  'Operations Manager',
  'Customer Success Manager',
  'Other',
];

const EXPERIENCE_OPTIONS = [
  '0-1 years',
  '1-3 years',
  '3-5 years',
  '5-7 years',
  '7-10 years',
  '10+ years',
];

const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Retail',
  'Manufacturing',
  'Media & Entertainment',
  'Real Estate',
  'Consulting',
  'Non-profit',
  'Government',
  'Other',
];

const JOB_TYPE_OPTIONS = [
  { id: 'full_time', label: 'Full Time' },
  { id: 'part_time', label: 'Part Time' },
  { id: 'contractor', label: 'Contractor' },
  { id: 'internship', label: 'Internship' },
];

const ENVIRONMENT_OPTIONS = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On Site' },
];

export const PreferencesSection = forwardRef<PreferencesSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // Form state
  const [primaryRole, setPrimaryRole] = useState('');
  const [primaryRoleExperience, setPrimaryRoleExperience] = useState('');
  const [otherRoles, setOtherRoles] = useState<string[]>([]);
  const [otherRoleInput, setOtherRoleInput] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('exact');
  const [salaryExact, setSalaryExact] = useState<number>(0);
  const [salaryMin, setSalaryMin] = useState<number>(0);
  const [salaryMax, setSalaryMax] = useState<number>(0);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('');
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [openToEnvironments, setOpenToEnvironments] = useState<string[]>([]);
  const [preferredEnvironment, setPreferredEnvironment] = useState('');
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [willingToRelocate, setWillingToRelocate] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      setPrimaryRole(convexUser.primary_role || '');
      setPrimaryRoleExperience(convexUser.primary_role_experience || '');
      setOtherRoles(convexUser.other_roles || []);
      setIndustries(convexUser.industries || []);
      setSalaryType(convexUser.salary_type || 'exact');
      setSalaryExact(convexUser.salary_min || 0);
      setSalaryMin(convexUser.salary_min || 0);
      setSalaryMax(convexUser.salary_max || 0);
      setExperienceLevel((convexUser.preferred_experience_level as ExperienceLevel) || '');
      setJobTypes(convexUser.job_types || []);
      setOpenToEnvironments(convexUser.open_to_environments || []);
      setPreferredEnvironment(convexUser.preferred_environment || '');
      setPreferredLocations(convexUser.preferred_locations || []);
      setWillingToRelocate(convexUser.willing_to_relocate ?? false);
    }
  }, [convexUser]);

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    // Validate salary range
    if (salaryType === 'range' && salaryMin > 0 && salaryMax > 0 && salaryMin > salaryMax) {
      toast({
        title: 'Invalid salary range',
        description: 'Minimum salary must be less than maximum salary',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          primary_role: primaryRole || undefined,
          primary_role_experience: primaryRoleExperience || undefined,
          other_roles: otherRoles.length > 0 ? otherRoles : undefined,
          industries: industries.length > 0 ? industries : undefined,
          salary_type: salaryType,
          salary_min: salaryType === 'exact' ? salaryExact : salaryMin,
          salary_max: salaryType === 'exact' ? salaryExact : salaryMax,
          preferred_experience_level: experienceLevel || undefined,
          job_types: jobTypes.length > 0 ? jobTypes : undefined,
          open_to_environments: openToEnvironments.length > 0 ? openToEnvironments : undefined,
          preferred_environment: preferredEnvironment || undefined,
          preferred_locations: preferredLocations.length > 0 ? preferredLocations : undefined,
          willing_to_relocate: willingToRelocate,
        },
      });

      toast({
        title: 'Preferences updated',
        description: 'Your job preferences have been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    clerkUser?.id,
    primaryRole,
    primaryRoleExperience,
    otherRoles,
    industries,
    salaryType,
    salaryExact,
    salaryMin,
    salaryMax,
    experienceLevel,
    jobTypes,
    openToEnvironments,
    preferredEnvironment,
    preferredLocations,
    willingToRelocate,
    updateUserMutation,
    toast,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  // Handlers for adding/removing items
  const addOtherRole = () => {
    if (otherRoleInput.trim() && !otherRoles.includes(otherRoleInput.trim())) {
      setOtherRoles([...otherRoles, otherRoleInput.trim()]);
      setOtherRoleInput('');
    }
  };

  const removeOtherRole = (role: string) => {
    setOtherRoles(otherRoles.filter((r) => r !== role));
  };

  const addIndustry = () => {
    if (industryInput.trim() && !industries.includes(industryInput.trim())) {
      setIndustries([...industries, industryInput.trim()]);
      setIndustryInput('');
    }
  };

  const removeIndustry = (industry: string) => {
    setIndustries(industries.filter((i) => i !== industry));
  };

  const addLocation = () => {
    if (locationInput.trim() && !preferredLocations.includes(locationInput.trim())) {
      setPreferredLocations([...preferredLocations, locationInput.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (location: string) => {
    setPreferredLocations(preferredLocations.filter((l) => l !== location));
  };

  const toggleJobType = (type: string) => {
    if (jobTypes.includes(type)) {
      setJobTypes(jobTypes.filter((t) => t !== type));
    } else {
      setJobTypes([...jobTypes, type]);
    }
  };

  const toggleEnvironment = (env: string) => {
    if (openToEnvironments.includes(env)) {
      setOpenToEnvironments(openToEnvironments.filter((e) => e !== env));
    } else {
      setOpenToEnvironments([...openToEnvironments, env]);
    }
  };

  if (!convexUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Job Preferences Section */}
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-medium text-slate-500">Job Preferences</h3>
        </div>

        {/* Primary Role & Experience */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="font-semibold text-slate-900">Primary Role Preference</Label>
            <p className="text-sm text-slate-500">
              What is the primary role you are interested in?
            </p>
            <Select value={primaryRole} onValueChange={setPrimaryRole}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-slate-900">Primary Role Experience</Label>
            <p className="text-sm text-slate-500">
              How many years of experience in your primary role of preference?
            </p>
            <Select value={primaryRoleExperience} onValueChange={setPrimaryRoleExperience}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Years of Experience" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_OPTIONS.map((exp) => (
                  <SelectItem key={exp} value={exp}>
                    {exp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Other Roles */}
        <div className="space-y-2">
          <Label className="font-semibold text-slate-900">Other Roles</Label>
          <p className="text-sm text-slate-500">Any other roles you are interested in?</p>
          <div className="flex gap-2">
            <Input
              value={otherRoleInput}
              onChange={(e) => setOtherRoleInput(e.target.value)}
              placeholder="Roles"
              className="rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOtherRole())}
            />
            <button
              type="button"
              onClick={addOtherRole}
              className="px-3 py-2 text-sm text-primary-500 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {otherRoles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {otherRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                >
                  {role}
                  <button type="button" onClick={() => removeOtherRole(role)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Industries */}
        <div className="space-y-2">
          <Label className="font-semibold text-slate-900">Industries</Label>
          <p className="text-sm text-slate-500">What industries would you like to work in?</p>
          <div className="flex gap-2">
            <Select
              value={industryInput}
              onValueChange={(val) => {
                if (!industries.includes(val)) {
                  setIndustries([...industries, val]);
                }
              }}
            >
              <SelectTrigger className="rounded-lg w-64">
                <SelectValue placeholder="Industries" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.filter((ind) => !industries.includes(ind)).map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {industries.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {industries.map((industry) => (
                <span
                  key={industry}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                >
                  {industry}
                  <button type="button" onClick={() => removeIndustry(industry)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Salary */}
        <div className="space-y-2">
          <Label className="font-semibold text-slate-900">Salary</Label>
          <p className="text-sm text-slate-500">What is your annual salary expectation?</p>
          <div className="border border-slate-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              {salaryType === 'exact' ? (
                <Input
                  type="number"
                  value={salaryExact || ''}
                  onChange={(e) => setSalaryExact(Number(e.target.value))}
                  className="flex-1 border-0 focus-visible:ring-0 text-lg"
                  placeholder="0"
                />
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    value={salaryMin || ''}
                    onChange={(e) => setSalaryMin(Number(e.target.value))}
                    className="flex-1 border-0 focus-visible:ring-0"
                    placeholder="Min"
                  />
                  <span className="text-slate-400">-</span>
                  <Input
                    type="number"
                    value={salaryMax || ''}
                    onChange={(e) => setSalaryMax(Number(e.target.value))}
                    className="flex-1 border-0 focus-visible:ring-0"
                    placeholder="Max"
                  />
                </div>
              )}
              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-sm rounded">USD</span>
            </div>
            {salaryType === 'range' && salaryMin > 0 && salaryMax > 0 && salaryMin > salaryMax && (
              <p className="text-xs text-red-600">Minimum salary should be less than maximum</p>
            )}
            <div className="flex justify-center gap-4 text-sm border-t pt-3">
              <button
                type="button"
                onClick={() => setSalaryType('exact')}
                className={`${salaryType === 'exact' ? 'text-primary-500 underline' : 'text-slate-500'}`}
              >
                exact salary
              </button>
              <button
                type="button"
                onClick={() => setSalaryType('range')}
                className={`${salaryType === 'range' ? 'text-primary-500 underline' : 'text-slate-500'}`}
              >
                salary range
              </button>
            </div>
          </div>
        </div>

        {/* Experience Level & Job Types */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Label className="font-semibold text-slate-900">Experience Level</Label>
            <p className="text-sm text-slate-500">
              Select which level of experience you are looking for in your next job:
            </p>
            <RadioGroup
              value={experienceLevel}
              onValueChange={(val) => setExperienceLevel(val as ExperienceLevel)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="entry" id="entry" />
                <Label htmlFor="entry" className="font-normal">
                  Entry
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mid" id="mid" />
                <Label htmlFor="mid" className="font-normal">
                  Mid Level
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="senior" id="senior" />
                <Label htmlFor="senior" className="font-normal">
                  Senior
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="font-semibold text-slate-900">Job Types</Label>
            <p className="text-sm text-slate-500">
              Which types of jobs are you open to working in:
            </p>
            <div className="space-y-2">
              {JOB_TYPE_OPTIONS.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.id}
                    checked={jobTypes.includes(type.id)}
                    onCheckedChange={() => toggleJobType(type.id)}
                  />
                  <Label htmlFor={type.id} className="font-semibold">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Location & Environment Section */}
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-medium text-slate-500">Location & Environment</h3>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Open to work environments */}
          <div className="space-y-3">
            <Label className="font-semibold text-slate-900">Open to work environments</Label>
            <p className="text-sm text-slate-500">
              Which types of work environments are you open to working in:
            </p>
            <div className="space-y-2">
              {ENVIRONMENT_OPTIONS.map((env) => (
                <div key={env.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`open-${env.id}`}
                    checked={openToEnvironments.includes(env.id)}
                    onCheckedChange={() => toggleEnvironment(env.id)}
                  />
                  <Label htmlFor={`open-${env.id}`} className="font-semibold">
                    {env.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Preferred work environment */}
          <div className="space-y-3">
            <Label className="font-semibold text-slate-900">Preferred work environment</Label>
            <p className="text-sm text-slate-500">
              Which work environment do you prefer to work in (optional):
            </p>
            <RadioGroup value={preferredEnvironment} onValueChange={setPreferredEnvironment}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <div key={env.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={env.id} id={`pref-${env.id}`} />
                  <Label htmlFor={`pref-${env.id}`} className="font-normal">
                    {env.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Locations */}
          <div className="space-y-2">
            <Label className="font-semibold text-slate-900">Locations</Label>
            <p className="text-sm text-slate-500">
              For on-site or hybrid positions, enter all cities in which you are open to working at.
            </p>
            <div className="flex gap-2">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="+ add location"
                className="rounded-lg"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
              />
            </div>
            {preferredLocations.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {preferredLocations.map((loc) => (
                  <span
                    key={loc}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                  >
                    {loc}
                    <button type="button" onClick={() => removeLocation(loc)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Other - Willing to relocate */}
          <div className="space-y-3">
            <Label className="font-semibold text-slate-900">Other</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="willing-relocate"
                checked={willingToRelocate}
                onCheckedChange={(checked) => setWillingToRelocate(checked as boolean)}
              />
              <Label htmlFor="willing-relocate" className="font-semibold">
                Willing to relocate?
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

PreferencesSection.displayName = 'PreferencesSection';
