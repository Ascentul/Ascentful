/**
 * Profile Store
 *
 * Manages user profile data for autofill using Zustand.
 * Handles caching, syncing, and profile selection.
 */

import { create } from 'zustand';
import type { ExtensionProfile, ResumeListItem, ResumeData } from '~/types';
import { storage, PROFILE_CACHE_DURATION } from '~/lib/storage';
import { api } from '~/lib/api';

interface ProfileStore {
  // State
  profile: ExtensionProfile | null;
  selectedResumeId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  syncProfile: () => Promise<void>;
  updateProfile: (updates: Partial<ExtensionProfile>) => Promise<void>;
  selectResume: (resumeId: string) => Promise<void>;
  setSelectedResume: (resumeId: string) => Promise<void>; // Alias for selectResume
  clearProfile: () => Promise<void>;
  getAutofillData: () => AutofillData | null;
}

/**
 * Flattened data structure for easy autofill field mapping
 */
export interface AutofillData {
  // Index signature for getNestedValue compatibility
  [key: string]: string | string[] | boolean | ExtensionProfile['workHistory'] | ExtensionProfile['educationHistory'];

  // Contact Info
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  streetAddress: string;

  // Links
  linkedin: string;
  github: string;
  website: string;

  // Current Role
  currentTitle: string;
  currentCompany: string;

  // Skills & Experience
  skills: string;
  skillsArray: string[];
  yearsOfExperience: string;

  // Most Recent Education
  school: string;
  degree: string;
  major: string;
  graduationYear: string;
  gpa: string;

  // Most Recent Work Experience
  previousCompany: string;
  previousTitle: string;
  previousStartDate: string;
  previousEndDate: string;

  // Summary (from resume if available)
  summary: string;

  // Work Authorization
  workAuthorization: string;
  requiresSponsorship: boolean;
  sponsorshipRequired: string; // String version for form fields ("Yes"/"No")

  // Job Preferences
  desiredSalary: string;
  availableStartDate: string;

  // Full arrays for complex forms
  workHistory: ExtensionProfile['workHistory'];
  educationHistory: ExtensionProfile['educationHistory'];
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  // Initial state
  profile: null,
  selectedResumeId: null,
  isLoading: false,
  isSyncing: false,
  lastSyncedAt: null,
  error: null,

  /**
   * Initialize profile from storage
   */
  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load from storage first (immediate display)
      const profile = await storage.getProfile();
      const selectedResumeId = await storage.getSelectedResumeId();
      const isStale = await storage.isProfileStale(PROFILE_CACHE_DURATION);

      if (profile) {
        set({
          profile,
          selectedResumeId: selectedResumeId || profile.resumes[0]?.id || null,
          isLoading: isStale, // Still loading if stale
        });
      }

      // Sync from backend if stale or no profile
      if (isStale || !profile) {
        await get().syncProfile();
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('[Ascentful] Profile initialization error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
      });
    }
  },

  /**
   * Sync profile from backend
   */
  syncProfile: async () => {
    set({ isLoading: true, error: null });

    try {
      const profile = await api.syncProfile();

      if (profile) {
        const { selectedResumeId } = get();
        const validResumeId =
          selectedResumeId && profile.resumes.some((r) => r.id === selectedResumeId)
            ? selectedResumeId
            : profile.resumes[0]?.id || null;

        set({
          profile,
          selectedResumeId: validResumeId,
          lastSyncedAt: Date.now(),
          isLoading: false,
          error: null,
        });

        if (validResumeId) {
          await storage.setSelectedResumeId(validResumeId);
        }
      } else {
        set({
          isLoading: false,
          error: 'Failed to sync profile',
        });
      }
    } catch (error) {
      console.error('[Ascentful] Profile sync error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to sync profile',
      });
    }
  },

  /**
   * Update profile with partial data
   */
  updateProfile: async (updates: Partial<ExtensionProfile>) => {
    const { profile } = get();
    if (!profile) return;

    set({ isSyncing: true });
    try {
      const updatedProfile = { ...profile, ...updates };
      await storage.setProfile(updatedProfile);
      set({ profile: updatedProfile, isSyncing: false });
    } catch (error) {
      console.error('[Ascentful] Profile update error:', error);
      set({ isSyncing: false, error: error instanceof Error ? error.message : 'Failed to update profile' });
    }
  },

  /**
   * Select a resume for autofill
   */
  selectResume: async (resumeId: string) => {
    const { profile } = get();
    if (!profile) return;

    const resume = profile.resumes.find((r) => r.id === resumeId);
    if (resume) {
      set({ selectedResumeId: resumeId });
      await storage.setSelectedResumeId(resumeId);
    }
  },

  /**
   * Alias for selectResume (used by DocumentsTab)
   */
  setSelectedResume: async (resumeId: string) => {
    await get().selectResume(resumeId);
  },

  /**
   * Clear profile data
   */
  clearProfile: async () => {
    await storage.clearProfile();
    set({
      profile: null,
      selectedResumeId: null,
      lastSyncedAt: null,
      error: null,
    });
  },

  /**
   * Get flattened autofill data for easy field mapping
   */
  getAutofillData: (): AutofillData | null => {
    const { profile, selectedResumeId } = get();
    if (!profile) return null;

    // Get selected resume content
    const resume = profile.resumes.find((r) => r.id === selectedResumeId);
    const resumeContent = resume?.content as ResumeData | undefined;

    // Parse name
    const nameParts = profile.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get most recent education
    const recentEducation = profile.educationHistory[0];
    const resumeEducation = resumeContent?.education?.[0];

    // Get most recent work experience
    const recentWork = profile.workHistory[0];
    const resumeExperience = resumeContent?.experience?.[0];

    // Parse skills
    const skillsString = profile.skills || '';
    const skillsArray = resumeContent?.skills ||
      skillsString.split(',').map((s) => s.trim()).filter(Boolean);

    return {
      // Contact Info
      firstName,
      lastName,
      fullName: profile.name,
      email: profile.email,
      phone: profile.phoneNumber || resumeContent?.contactInfo?.phone || '',
      location: profile.location || resumeContent?.contactInfo?.location || '',
      city: profile.city || '',
      state: profile.state || '',
      zipCode: profile.zipCode || resumeContent?.contactInfo?.postalCode || '',
      country: profile.country || resumeContent?.contactInfo?.country || '',
      streetAddress: profile.streetAddress || '',

      // Links
      linkedin: profile.linkedinUrl || resumeContent?.contactInfo?.linkedin || '',
      github: profile.githubUrl || resumeContent?.contactInfo?.github || '',
      website: profile.website || resumeContent?.contactInfo?.website || '',

      // Current Role
      currentTitle: profile.currentPosition || resumeExperience?.title || '',
      currentCompany: profile.currentCompany || resumeExperience?.company || '',

      // Skills & Experience
      skills: skillsString || skillsArray.join(', '),
      skillsArray,
      yearsOfExperience: profile.yearsOfExperience || '',

      // Most Recent Education
      school: recentEducation?.school || resumeEducation?.school || '',
      degree: recentEducation?.degree || resumeEducation?.degree || '',
      major: recentEducation?.fieldOfStudy || resumeEducation?.field || '',
      graduationYear: recentEducation?.endYear || resumeEducation?.endYear || '',
      gpa: resumeEducation?.gpa || '',

      // Most Recent Work Experience
      previousCompany: recentWork?.company || '',
      previousTitle: recentWork?.role || '',
      previousStartDate: recentWork?.startDate || '',
      previousEndDate: recentWork?.endDate || '',

      // Summary
      summary: resumeContent?.summary || '',

      // Work Authorization
      workAuthorization: profile.workAuthorization || '',
      requiresSponsorship: profile.requiresSponsorship ?? false,
      sponsorshipRequired: profile.requiresSponsorship ? 'Yes' : 'No',

      // Job Preferences
      desiredSalary: profile.desiredSalary || '',
      availableStartDate: profile.availableStartDate || '',

      // Full arrays for complex forms
      workHistory: profile.workHistory,
      educationHistory: profile.educationHistory,
    };
  },
}));

/**
 * Selector hook for getting the currently selected resume.
 * Use this instead of accessing selectedResume directly from the store.
 */
export const useSelectedResume = (): ResumeListItem | null => {
  return useProfileStore((state: ProfileStore) => {
    if (!state.profile || !state.selectedResumeId) return null;
    return state.profile.resumes.find((r: ResumeListItem) => r.id === state.selectedResumeId) || null;
  });
};

export default useProfileStore;
