'use client';

import { useCallback, useState } from 'react';

import type {
  Achievement,
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';

import { DEFAULT_THEME, type TemplateId, type TemplateTheme } from '../templates/types';

export interface ResumeBuilderState {
  mode: 'edit' | 'customize';
  currentStep: number;
  resumeData: ResumeData;
  templateId: TemplateId;
  theme: TemplateTheme;
  isDirty: boolean;
  resumeId: string | null;
  title: string;
}

export const STEPS = [
  { id: 'personal', label: 'Personal Details', nextLabel: 'Employment History' },
  { id: 'employment', label: 'Employment History', nextLabel: 'Education' },
  { id: 'education', label: 'Education', nextLabel: 'Skills' },
  { id: 'skills', label: 'Skills', nextLabel: 'Summary' },
  { id: 'summary', label: 'Summary', nextLabel: 'Finish' },
] as const;

const createEmptyResumeData = (): ResumeData => ({
  contactInfo: {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
  },
  summary: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
  achievements: [],
});

const initialState: ResumeBuilderState = {
  mode: 'edit',
  currentStep: 0,
  resumeData: createEmptyResumeData(),
  templateId: 'modern', // Default to modern template
  theme: DEFAULT_THEME,
  isDirty: false,
  resumeId: null,
  title: 'My Resume',
};

export function useResumeBuilder(existingData?: Partial<ResumeBuilderState>) {
  const [state, setState] = useState<ResumeBuilderState>({
    ...initialState,
    ...existingData,
    resumeData: {
      ...createEmptyResumeData(),
      ...existingData?.resumeData,
    },
  });

  // Mode toggle
  const setMode = useCallback((mode: 'edit' | 'customize') => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  // Step navigation
  const setCurrentStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, STEPS.length - 1)),
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, STEPS.length - 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  // Contact info updates
  const updateContactInfo = useCallback((field: keyof ContactInfo, value: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        contactInfo: {
          ...prev.resumeData.contactInfo,
          [field]: value,
        },
      },
    }));
  }, []);

  // Summary update
  const updateSummary = useCallback((summary: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        summary,
      },
    }));
  }, []);

  // Skills updates
  const updateSkills = useCallback((skills: string[]) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        skills,
      },
    }));
  }, []);

  // Experience updates
  const addExperience = useCallback((experience: Experience) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        experience: [...(prev.resumeData.experience || []), experience],
      },
    }));
  }, []);

  const updateExperience = useCallback((index: number, experience: Experience) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        experience: prev.resumeData.experience?.map((exp, i) => (i === index ? experience : exp)),
      },
    }));
  }, []);

  const removeExperience = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        experience: prev.resumeData.experience?.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Education updates
  const addEducation = useCallback((education: Education) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        education: [...(prev.resumeData.education || []), education],
      },
    }));
  }, []);

  const updateEducation = useCallback((index: number, education: Education) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        education: prev.resumeData.education?.map((edu, i) => (i === index ? education : edu)),
      },
    }));
  }, []);

  const removeEducation = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        education: prev.resumeData.education?.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Projects updates
  const addProject = useCallback((project: Project) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        projects: [...(prev.resumeData.projects || []), project],
      },
    }));
  }, []);

  const updateProject = useCallback((index: number, project: Project) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        projects: prev.resumeData.projects?.map((p, i) => (i === index ? project : p)),
      },
    }));
  }, []);

  const removeProject = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        projects: prev.resumeData.projects?.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Achievements updates
  const addAchievement = useCallback((achievement: Achievement) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        achievements: [...(prev.resumeData.achievements || []), achievement],
      },
    }));
  }, []);

  const updateAchievement = useCallback((index: number, achievement: Achievement) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        achievements: prev.resumeData.achievements?.map((a, i) => (i === index ? achievement : a)),
      },
    }));
  }, []);

  const removeAchievement = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      resumeData: {
        ...prev.resumeData,
        achievements: prev.resumeData.achievements?.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Template and theme updates
  const setTemplateId = useCallback((templateId: TemplateId) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      templateId,
    }));
  }, []);

  const setTheme = useCallback((theme: Partial<TemplateTheme>) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      theme: {
        ...prev.theme,
        ...theme,
      },
    }));
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      theme: {
        ...prev.theme,
        primaryColor: color,
      },
    }));
  }, []);

  // Title update
  const setTitle = useCallback((title: string) => {
    setState((prev) => ({
      ...prev,
      isDirty: true,
      title,
    }));
  }, []);

  // Resume ID (set after creation)
  const setResumeId = useCallback((resumeId: string) => {
    setState((prev) => ({
      ...prev,
      resumeId,
    }));
  }, []);

  // Mark as saved
  const markSaved = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDirty: false,
    }));
  }, []);

  // Load existing resume data
  const loadResumeData = useCallback((data: Partial<ResumeBuilderState>) => {
    setState((prev) => ({
      ...prev,
      ...data,
      resumeData: {
        ...prev.resumeData,
        ...data.resumeData,
      },
      isDirty: false,
    }));
  }, []);

  return {
    state,
    // Mode
    setMode,
    // Steps
    setCurrentStep,
    nextStep,
    prevStep,
    // Contact
    updateContactInfo,
    // Summary
    updateSummary,
    // Skills
    updateSkills,
    // Experience
    addExperience,
    updateExperience,
    removeExperience,
    // Education
    addEducation,
    updateEducation,
    removeEducation,
    // Projects
    addProject,
    updateProject,
    removeProject,
    // Achievements
    addAchievement,
    updateAchievement,
    removeAchievement,
    // Template & Theme
    setTemplateId,
    setTheme,
    setPrimaryColor,
    // Title
    setTitle,
    // Resume ID
    setResumeId,
    // Saving
    markSaved,
    loadResumeData,
  };
}

export type ResumeBuilderActions = ReturnType<typeof useResumeBuilder>;
