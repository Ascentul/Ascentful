'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CoverLetterPreviewModal } from '@/components/cover-letter-preview-modal';
import type { ResumeData } from '@/components/resume/ResumeDocument';
import { ResumeDocument } from '@/components/resume/ResumeDocument';
import { ResumePreviewModal } from '@/components/resume-preview-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { generateResumePDF } from '@/lib/resume-pdf-generator';
import { exportCoverLetterPDF } from '@/utils/exportCoverLetter';

// Types
type ResumeDoc = {
  _id: string;
  title: string;
  content: any;
  visibility: 'private' | 'public';
  source?: 'manual' | 'ai_generated' | 'ai_optimized' | 'pdf_upload';
  analysis_result?: any;
  created_at: number;
  updated_at: number;
};

export type CoverLetterDoc = {
  _id: string;
  name: string;
  job_title: string;
  company_name?: string;
  template: string;
  content?: string;
  closing: string;
  created_at: number;
  updated_at: number;
  source?: 'manual' | 'ai_generated' | 'ai_optimized' | 'pdf_upload';
};

type CoverLetterAnalysis = {
  summary: string;
  alignmentScore: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  optimizedLetter?: string;
};

type MainTab = 'resumes' | 'cover-letters';
type ResumeSubTab = 'my-resumes' | 'generate-ai' | 'upload-analyze';
type CoverLetterSubTab = 'my-letters' | 'generate-ai' | 'upload-analyze';

export default function ResumeStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: clerkUser } = useUser();
  const { user: profile } = useAuth();
  const clerkId = clerkUser?.id;
  const { toast } = useToast();

  // Main tab state (resumes vs cover letters)
  const tabParam = searchParams.get('tab') as MainTab | null;
  const [mainTab, setMainTab] = useState<MainTab>(
    tabParam === 'cover-letters' ? 'cover-letters' : 'resumes',
  );

  // Resume sub-tab state
  const resumeSubTabParam = searchParams.get('subtab') as ResumeSubTab | null;
  const [resumeSubTab, setResumeSubTab] = useState<ResumeSubTab>(
    resumeSubTabParam && ['my-resumes', 'generate-ai', 'upload-analyze'].includes(resumeSubTabParam)
      ? resumeSubTabParam
      : 'my-resumes',
  );

  // Cover letter sub-tab state
  const [coverLetterSubTab, setCoverLetterSubTab] = useState<CoverLetterSubTab>('my-letters');

  // ============================================================================
  // RESUME STATE
  // ============================================================================
  const [creatingResume, setCreatingResume] = useState(false);
  const [previewResume, setPreviewResume] = useState<ResumeDoc | null>(null);

  // AI Generation state (resumes)
  const [resumeJobDescription, setResumeJobDescription] = useState('');
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<any>(null);

  // Upload & Analyze state (resumes)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analyzeJobDescription, setAnalyzeJobDescription] = useState('');
  const [analyzingResume, setAnalyzingResume] = useState(false);
  const [resumeAnalysisResult, setResumeAnalysisResult] = useState<any>(null);
  const [extractedText, setExtractedText] = useState('');

  // Import resume state
  const [importingResume, setImportingResume] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // COVER LETTER STATE
  // ============================================================================
  const [creatingCoverLetter, setCreatingCoverLetter] = useState(false);
  const [previewLetter, setPreviewLetter] = useState<CoverLetterDoc | null>(null);

  // AI Generation state (cover letters)
  const [clJobDescription, setClJobDescription] = useState('');
  const [clJobRole, setClJobRole] = useState('');
  const [clJobCompany, setClJobCompany] = useState('');
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);

  // Upload & Analyze state (cover letters)
  const [coverLetterDraft, setCoverLetterDraft] = useState('');
  const [clAnalyzeJobDescription, setClAnalyzeJobDescription] = useState('');
  const [clAnalyzeRole, setClAnalyzeRole] = useState('');
  const [clAnalyzeCompany, setClAnalyzeCompany] = useState('');
  const [analyzingCoverLetter, setAnalyzingCoverLetter] = useState(false);
  const [clAnalysisResult, setClAnalysisResult] = useState<CoverLetterAnalysis | null>(null);
  const [showOptimized, setShowOptimized] = useState(false);
  const [savingOptimized, setSavingOptimized] = useState(false);

  // ============================================================================
  // DATA QUERIES
  // ============================================================================
  const resumes = useQuery(api.resumes.getUserResumes, clerkId ? { clerkId } : 'skip') as
    | ResumeDoc[]
    | undefined;
  const userProfile = useQuery(api.users.getUserByClerkId, clerkId ? { clerkId } : 'skip');
  const coverLetters = useQuery(
    api.cover_letters.getUserCoverLetters,
    clerkId ? { clerkId } : 'skip',
  ) as CoverLetterDoc[] | undefined;

  // Mutations
  const createResumeMutation = useMutation(api.resumes.createResume);
  const deleteResumeMutation = useMutation(api.resumes.deleteResume);
  const createCoverLetterMutation = useMutation(api.cover_letters.createCoverLetter);
  const deleteCoverLetterMutation = useMutation(api.cover_letters.deleteCoverLetter);

  // Loading states
  const loadingResumes = !resumes && !!clerkId;
  const loadingCoverLetters = !coverLetters && !!clerkId;

  // Sorted data
  const sortedResumes = useMemo(() => {
    return (resumes ?? []).slice().sort((a, b) => b.updated_at - a.updated_at);
  }, [resumes]);

  const sortedCoverLetters = useMemo(() => {
    return (coverLetters ?? []).slice().sort((a, b) => b.updated_at - a.updated_at);
  }, [coverLetters]);

  // Auto-trigger import when action=import parameter is present
  const actionParam = searchParams.get('action');
  useEffect(() => {
    if (actionParam === 'import' && mainTab === 'resumes' && resumeSubTab === 'my-resumes') {
      const timer = setTimeout(() => {
        importFileInputRef.current?.click();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [actionParam, mainTab, resumeSubTab]);

  // ============================================================================
  // RESUME FUNCTIONS
  // ============================================================================
  const createResume = () => {
    if (!clerkId) return;
    router.push('/resumes/new');
  };

  const getUserProfile = () => {
    if (!userProfile) return null;
    return {
      name: userProfile.name || clerkUser?.fullName || '',
      email: userProfile.email || clerkUser?.primaryEmailAddress?.emailAddress || '',
      phone: clerkUser?.phoneNumbers?.[0]?.phoneNumber || '',
      current_position: userProfile.current_position || '',
      current_company: userProfile.current_company || '',
      skills: userProfile.skills || [],
      bio: userProfile.bio || '',
      industry: userProfile.industry || '',
      experience_level: userProfile.experience_level || '',
      education_history: userProfile.education_history || [],
      work_history: userProfile.work_history || [],
      location: userProfile.location || '',
      linkedin_url: userProfile.linkedin_url || '',
      github_url: userProfile.github_url || '',
      university_name: userProfile.university_name || '',
      major: userProfile.major || '',
      graduation_year: userProfile.graduation_year || '',
    };
  };

  const duplicateResume = async (resumeId: string, title: string) => {
    if (!clerkId) return;
    try {
      const original = resumes?.find((r) => r._id === resumeId);
      if (!original) return;

      const id = await createResumeMutation({
        clerkId,
        title: `${title} (Copy)`,
        content: original.content,
        visibility: 'private',
      });

      toast({
        title: 'Resume Copied',
        description: 'Your resume has been duplicated successfully',
        variant: 'success',
      });

      router.push(`/resumes/${id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy resume',
        variant: 'destructive',
      });
    }
  };

  const deleteResume = async (resumeId: string) => {
    if (!clerkId) return;
    if (!confirm('Are you sure you want to delete this resume?')) return;

    try {
      await deleteResumeMutation({ clerkId, resumeId: resumeId as any });
      toast({
        title: 'Resume Deleted',
        description: 'Your resume has been deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete resume',
        variant: 'destructive',
      });
    }
  };

  const generateResumeWithAI = async () => {
    if (!resumeJobDescription.trim() || !clerkId) return;
    setGeneratingResume(true);
    try {
      toast({
        title: 'Generating Resume',
        description: 'AI is creating your optimized resume...',
      });

      const profile = getUserProfile();

      const response = await fetch('/api/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: resumeJobDescription,
          userProfile: profile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate resume');
      }

      const data = await response.json();
      setGeneratedResume(data.resume);

      toast({
        title: 'Resume Generated!',
        description:
          'Review your AI-generated resume below. You can save it or optimize your profile.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate resume',
        variant: 'destructive',
      });
    } finally {
      setGeneratingResume(false);
    }
  };

  const saveGeneratedResume = async () => {
    if (!generatedResume || !clerkId) return;
    setCreatingResume(true);
    try {
      await createResumeMutation({
        clerkId,
        title: 'AI-Generated Resume',
        content: generatedResume,
        visibility: 'private',
        source: 'ai_generated',
        job_description: resumeJobDescription,
      });

      toast({
        title: 'Resume Saved',
        description: 'Your AI-generated resume has been saved successfully',
        variant: 'success',
      });

      setGeneratedResume(null);
      setResumeJobDescription('');
      setResumeSubTab('my-resumes');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save resume',
        variant: 'destructive',
      });
    } finally {
      setCreatingResume(false);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a PDF file to import',
        variant: 'destructive',
      });
      return;
    }

    if (!clerkId) {
      toast({
        title: 'Not Ready',
        description: 'Please wait for the page to finish loading before importing',
        variant: 'destructive',
      });
      return;
    }

    setImportingResume(true);

    try {
      toast({
        title: 'Importing Resume',
        description: 'Extracting text from your resume...',
      });

      const formData = new FormData();
      formData.append('file', file);

      const extractResponse = await fetch('/api/resumes/extract', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract text from resume');
      }

      const { text } = await extractResponse.json();

      if (!text || text.trim().length === 0) {
        toast({
          title: 'Warning',
          description: 'Could not extract text from PDF. The file may be image-based or corrupted.',
          variant: 'destructive',
        });
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
        return;
      }

      toast({
        title: 'Parsing Resume',
        description: 'Analyzing resume content...',
      });

      const parseResponse = await fetch('/api/resumes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text }),
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse resume');
      }

      const { data: parsedData, warning } = await parseResponse.json();

      const resumeTitle = parsedData.personalInfo?.name
        ? `${parsedData.personalInfo.name}'s Resume`
        : `Imported Resume - ${file.name.replace('.pdf', '')}`;

      await createResumeMutation({
        clerkId,
        title: resumeTitle,
        content: {
          contactInfo: parsedData.personalInfo,
          summary: parsedData.summary || '',
          skills: parsedData.skills || [],
          experiences: parsedData.experience || [],
          education: parsedData.education || [],
          projects: parsedData.projects || [],
          achievements: parsedData.achievements || [],
        },
        visibility: 'private',
        source: 'pdf_upload',
        extracted_text: text,
      });

      toast({
        title: 'Resume Imported!',
        description: warning
          ? `${warning}. Your resume has been imported.`
          : 'Your resume has been imported and parsed successfully',
        variant: 'success',
      });

      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import resume',
        variant: 'destructive',
      });
    } finally {
      setImportingResume(false);
    }
  };

  const analyzeResume = async () => {
    if (!uploadedFile || !analyzeJobDescription.trim()) return;
    setAnalyzingResume(true);
    setResumeAnalysisResult(null);
    setExtractedText('');

    try {
      toast({
        title: 'Analyzing Resume',
        description: 'Extracting text and analyzing your resume...',
      });

      const formData = new FormData();
      formData.append('file', uploadedFile);

      const extractResponse = await fetch('/api/resumes/extract', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract text from resume');
      }

      const { text } = await extractResponse.json();
      setExtractedText(text);

      if (!text || text.trim().length === 0) {
        toast({
          title: 'Warning',
          description: 'Could not extract text from PDF. The file may be image-based or corrupted.',
          variant: 'destructive',
        });
        return;
      }

      const analyzeResponse = await fetch('/api/resumes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: text,
          jobDescription: analyzeJobDescription,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error('Failed to analyze resume');
      }

      const analysis = await analyzeResponse.json();
      setResumeAnalysisResult(analysis);

      toast({
        title: 'Analysis Complete!',
        description: `Match score: ${analysis.score}%. Review the suggestions below.`,
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze resume',
        variant: 'destructive',
      });
    } finally {
      setAnalyzingResume(false);
    }
  };

  const optimizeAnalyzedResume = async () => {
    if (!clerkId || !extractedText || !resumeAnalysisResult || !analyzeJobDescription) return;
    setCreatingResume(true);
    try {
      toast({
        title: 'Optimizing Resume',
        description: 'Creating an optimized version based on analysis...',
      });

      const profile = getUserProfile();
      const response = await fetch('/api/resumes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalResumeText: extractedText,
          analysisRecommendations: resumeAnalysisResult,
          jobDescription: analyzeJobDescription,
          userProfile: profile,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to optimize resume');
      }

      const data = await response.json();

      await createResumeMutation({
        clerkId,
        title: 'AI-Optimized Resume',
        content: data.resume,
        visibility: 'private',
        source: 'ai_optimized',
        job_description: analyzeJobDescription,
        analysis_result: resumeAnalysisResult,
        extracted_text: extractedText,
      });

      toast({
        title: 'Resume Optimized!',
        description: 'An optimized version has been created and saved',
        variant: 'success',
      });

      setResumeAnalysisResult(null);
      setExtractedText('');
      setAnalyzeJobDescription('');
      setUploadedFile(null);
      setResumeSubTab('my-resumes');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to optimize resume',
        variant: 'destructive',
      });
    } finally {
      setCreatingResume(false);
    }
  };

  const exportResumePDF = async (resume: ResumeDoc) => {
    try {
      const content = (resume.content || {}) as any;
      const personalInfo = content.contactInfo || content.personalInfo || {};
      const fullName =
        personalInfo.name ||
        clerkUser?.fullName ||
        [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
        '';
      const email = personalInfo.email || clerkUser?.primaryEmailAddress?.emailAddress || '';
      const phone = personalInfo.phone || clerkUser?.phoneNumbers?.[0]?.phoneNumber || '';
      const location = personalInfo.location || '';

      const resumeData: ResumeData = {
        contactInfo: {
          name: fullName || resume.title || 'Resume',
          email: email,
          phone: phone,
          location: location,
          linkedin: personalInfo.linkedin || '',
          github: personalInfo.github || '',
          website: personalInfo.website || '',
        },
        summary: content?.summary || '',
        skills: Array.isArray(content?.skills) ? content.skills : [],
        experience: Array.isArray(content?.experiences)
          ? content.experiences
          : Array.isArray(content?.experience)
            ? content.experience
            : [],
        education: Array.isArray(content?.education) ? content.education : [],
        projects: Array.isArray(content?.projects) ? content.projects : [],
        achievements: Array.isArray(content?.achievements) ? content.achievements : [],
      };

      const fileName = `${(resume.title || fullName || 'resume').replace(/\s+/g, '_')}.pdf`;
      await generateResumePDF(resumeData, fileName);

      toast({ title: 'Exported', description: 'PDF downloaded successfully.', variant: 'success' });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export PDF.',
        variant: 'destructive',
      });
    }
  };

  // ============================================================================
  // COVER LETTER FUNCTIONS
  // ============================================================================
  const handleCreateCoverLetter = async () => {
    if (!clerkId) return;
    setCreatingCoverLetter(true);
    try {
      const doc = await createCoverLetterMutation({
        clerkId,
        name: 'Untitled Cover Letter',
        job_title: 'Position',
        company_name: undefined,
        template: 'standard',
        content: '',
        closing: 'Sincerely,',
        source: 'manual',
      });
      if (doc && (doc as any)._id) {
        router.push(`/cover-letters/${(doc as any)._id}`);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create cover letter',
        variant: 'destructive',
      });
    } finally {
      setCreatingCoverLetter(false);
    }
  };

  const duplicateCoverLetter = async (letterId: string, name: string) => {
    if (!clerkId) return;
    try {
      const original = coverLetters?.find((c) => c._id === letterId);
      if (!original) return;

      const doc = await createCoverLetterMutation({
        clerkId,
        name: `${name} (Copy)`,
        job_title: original.job_title,
        company_name: original.company_name,
        template: original.template,
        content: original.content || '',
        closing: original.closing,
        source: original.source || 'manual',
      });

      toast({
        title: 'Cover Letter Copied',
        description: 'Your cover letter has been duplicated successfully',
        variant: 'success',
      });

      if (doc && (doc as any)._id) {
        router.push(`/cover-letters/${(doc as any)._id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy cover letter',
        variant: 'destructive',
      });
    }
  };

  const deleteCoverLetter = async (letterId: string) => {
    if (!clerkId) return;
    if (!confirm('Are you sure you want to delete this cover letter?')) return;

    try {
      await deleteCoverLetterMutation({ clerkId, coverLetterId: letterId as any });
      toast({
        title: 'Cover Letter Deleted',
        description: 'Your cover letter has been deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete cover letter',
        variant: 'destructive',
      });
    }
  };

  const generateCoverLetterWithAI = async () => {
    if (!clerkId) return;
    if (!clJobDescription.trim() || !clJobRole.trim() || !clJobCompany.trim()) {
      toast({
        title: 'Missing details',
        description:
          'Please provide the company, role, and job description so we can generate a truthful cover letter.',
        variant: 'destructive',
      });
      return;
    }
    setGeneratingCoverLetter(true);
    try {
      const response = await fetch('/api/cover-letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: clJobDescription,
          companyName: clJobCompany,
          position: clJobRole,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate');
      }
      const data = await response.json();

      if (data.warning) {
        toast({ title: 'Heads up', description: data.warning });
      }

      toast({
        title: 'Cover letter ready',
        description: 'We used your career profile to generate a tailored draft.',
        variant: 'success',
      });
      const created = data.coverLetter;
      if (created && created._id) {
        router.push(`/cover-letters/${created._id}`);
      } else {
        const doc = await createCoverLetterMutation({
          clerkId,
          name: `AI Cover Letter - ${clJobCompany}`,
          job_title: clJobRole,
          company_name: clJobCompany || undefined,
          template: 'standard',
          content:
            data.generatedContent ||
            `Generated from job description: ${clJobDescription.substring(0, 100)}...`,
          closing: 'Sincerely,',
          source: 'ai_generated',
        });
        if (doc && (doc as any)._id) router.push(`/cover-letters/${(doc as any)._id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate cover letter',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCoverLetter(false);
    }
  };

  const analyzeCoverLetter = async () => {
    if (!coverLetterDraft.trim() || !clAnalyzeJobDescription.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please paste both the cover letter and the job description for analysis.',
        variant: 'destructive',
      });
      return;
    }

    setAnalyzingCoverLetter(true);
    setClAnalysisResult(null);
    setShowOptimized(false);
    try {
      const response = await fetch('/api/cover-letters/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: clAnalyzeJobDescription,
          coverLetter: coverLetterDraft,
          optimize: true,
          roleTitle: clAnalyzeRole || undefined,
          companyName: clAnalyzeCompany || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to analyze cover letter');
      }

      const analysis = data.analysis as CoverLetterAnalysis | undefined;
      if (!analysis) {
        throw new Error('Analysis was not returned. Please try again.');
      }

      setClAnalysisResult(analysis);
      toast({
        title: 'Analysis complete',
        description: 'Review the insights below to refine your cover letter.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to analyze cover letter',
        variant: 'destructive',
      });
    } finally {
      setAnalyzingCoverLetter(false);
    }
  };

  const saveOptimizedCoverLetter = async () => {
    if (!clerkId || !clAnalysisResult?.optimizedLetter) return;
    setSavingOptimized(true);
    try {
      const doc = await createCoverLetterMutation({
        clerkId,
        name: `Optimized Cover Letter - ${clAnalyzeCompany || 'Saved'}`,
        job_title: clAnalyzeRole || 'Target Role',
        company_name: clAnalyzeCompany || undefined,
        template: 'standard',
        content: clAnalysisResult.optimizedLetter,
        closing: 'Sincerely,',
        source: 'ai_optimized',
      });
      toast({
        title: 'Optimized letter saved',
        description: 'Your improved cover letter is now in My Cover Letters.',
        variant: 'success',
      });
      if (doc && (doc as any)._id) {
        router.push(`/cover-letters/${(doc as any)._id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save optimized letter',
        variant: 'destructive',
      });
    } finally {
      setSavingOptimized(false);
    }
  };

  const exportCoverLetter = (letter: CoverLetterDoc) => {
    try {
      const exportUserName = clerkUser?.fullName || (profile as any)?.name || '';
      const exportUserEmail =
        clerkUser?.primaryEmailAddress?.emailAddress || (profile as any)?.email || '';
      exportCoverLetterPDF({
        letter,
        userName: exportUserName,
        userEmail: exportUserEmail,
      });
      toast({
        title: 'Exported',
        description: 'PDF downloaded successfully.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Unable to export this cover letter.',
        variant: 'destructive',
      });
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const getResumeSourceBadge = (source?: string) => {
    switch (source) {
      case 'ai_generated':
        return (
          <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
            AI Generated
          </span>
        );
      case 'ai_optimized':
        return (
          <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            AI Optimized
          </span>
        );
      case 'pdf_upload':
        return (
          <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-full">
            PDF Upload
          </span>
        );
      case 'manual':
        return (
          <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            Manual
          </span>
        );
      default:
        return null;
    }
  };

  const getCoverLetterSourceBadge = (source?: string) => {
    switch (source) {
      case 'ai_generated':
        return (
          <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full whitespace-nowrap">
            AI Generated
          </span>
        );
      case 'ai_optimized':
        return (
          <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap">
            AI Optimized
          </span>
        );
      case 'pdf_upload':
        return (
          <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
            PDF Upload
          </span>
        );
      case 'manual':
        return (
          <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-1 rounded-full whitespace-nowrap">
            Manual
          </span>
        );
      default:
        return null;
    }
  };

  // ============================================================================
  // HELPER: Convert resume content to ResumeData format for thumbnail preview
  // ============================================================================
  const getResumeDataForThumbnail = (resume: ResumeDoc): ResumeData => {
    const content = resume.content || {};
    const rawPersonalInfo = content.contactInfo || content.personalInfo || {};
    return {
      contactInfo: {
        name: rawPersonalInfo.name || clerkUser?.fullName || 'Your Name',
        email: rawPersonalInfo.email || clerkUser?.primaryEmailAddress?.emailAddress || '',
        phone: rawPersonalInfo.phone || '',
        location: rawPersonalInfo.location || '',
        linkedin: rawPersonalInfo.linkedin || '',
        github: rawPersonalInfo.github || '',
        website: rawPersonalInfo.website || '',
      },
      summary: content.summary || '',
      skills: Array.isArray(content.skills) ? content.skills : [],
      experience: Array.isArray(content.experiences)
        ? content.experiences
        : Array.isArray(content.experience)
          ? content.experience
          : [],
      education: Array.isArray(content.education) ? content.education : [],
      projects: Array.isArray(content.projects) ? content.projects : [],
      achievements: Array.isArray(content.achievements) ? content.achievements : [],
    };
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="w-full">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm space-y-6">
        {/* Header with title and Create New button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Resumes & Cover Letters
            </h1>
            <p className="text-muted-foreground">
              Create, manage, and optimize your resumes and cover letters
            </p>
          </div>
          <Button
            onClick={() => {
              if (mainTab === 'resumes') {
                createResume();
              } else {
                handleCreateCoverLetter();
              }
            }}
            disabled={mainTab === 'cover-letters' ? creatingCoverLetter : !clerkId}
            className="bg-primary-500 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>

        {/* Simple underlined tabs */}
        <div className="flex gap-6 border-b border-slate-200">
          <button
            onClick={() => setMainTab('resumes')}
            className={`pb-3 text-sm font-medium transition-colors ${
              mainTab === 'resumes'
                ? 'text-slate-900 border-b-2 border-primary-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Resumes
          </button>
          <button
            onClick={() => setMainTab('cover-letters')}
            className={`pb-3 text-sm font-medium transition-colors ${
              mainTab === 'cover-letters'
                ? 'text-slate-900 border-b-2 border-primary-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Cover Letters
          </button>
        </div>

        {/* ================================================================== */}
        {/* RESUMES SECTION */}
        {/* ================================================================== */}
        {mainTab === 'resumes' && (
          <>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleImportFileChange}
              className="hidden"
            />

            {loadingResumes ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                {/* Existing Resumes - Horizontal Cards */}
                {sortedResumes.map((r) => (
                  <div
                    key={r._id}
                    className="flex bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow w-full md:w-[calc(50%-12px)]"
                  >
                    {/* Thumbnail - Mini Resume Preview */}
                    <div
                      className="w-32 min-h-[180px] bg-white flex-shrink-0 cursor-pointer relative group overflow-hidden border-r border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewResume(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreviewResume(r);
                        }
                      }}
                      aria-label={`Preview ${r.title || 'Untitled'} resume`}
                    >
                      {/* Scaled down resume preview - fills thumbnail width */}
                      <div
                        className="absolute origin-top-left"
                        style={{
                          transform: 'scale(0.19)',
                          width: '680px',
                          top: '-8px',
                          left: '-8px',
                          pointerEvents: 'none',
                        }}
                      >
                        <ResumeDocument
                          data={getResumeDataForThumbnail(r)}
                          className="shadow-none"
                        />
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 flex flex-col min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <button
                          type="button"
                          className="font-medium text-slate-900 truncate cursor-pointer hover:text-primary-500 text-left"
                          onClick={() => router.push(`/resumes/${r._id}`)}
                        >
                          {r.title || 'Untitled'}
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600"
                          onClick={() => router.push(`/resumes/${r._id}`)}
                          title="Edit title"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Updated{' '}
                        {new Date(r.updated_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {/* Resume Score Badge */}
                      {r.analysis_result?.score && (
                        <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium mb-3 w-fit">
                          <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {r.analysis_result.score}%
                          </span>
                          Your resume score
                        </div>
                      )}

                      {/* Action Links */}
                      <div className="space-y-1.5 mt-auto">
                        <button
                          className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600"
                          onClick={() => {
                            setAnalyzeJobDescription('');
                            setUploadedFile(null);
                            setResumeSubTab('upload-analyze');
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Tailor to job listing
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => exportResumePDF(r)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => duplicateResume(r._id, r.title)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => deleteResume(r._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* New Resume Card */}
                <div
                  className="flex bg-white border-2 border-dashed border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer w-full md:w-[calc(50%-12px)]"
                  onClick={createResume}
                >
                  {/* Placeholder Thumbnail */}
                  <div className="w-32 min-h-[180px] bg-slate-100 flex-shrink-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-slate-400" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col justify-center">
                    <h3 className="font-medium text-primary-500 mb-1">New Resume</h3>
                    <p className="text-sm text-slate-500">
                      Create a tailored resume for each job application. Double your chances of
                      getting hired!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs for AI features - shown below the cards */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex gap-2 mb-6">
                <Button
                  variant={resumeSubTab === 'my-resumes' ? 'default' : 'outline'}
                  onClick={() => setResumeSubTab('my-resumes')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <FileText className="h-4 w-4" />
                  My Resumes
                </Button>
                <Button
                  variant={resumeSubTab === 'generate-ai' ? 'default' : 'outline'}
                  onClick={() => setResumeSubTab('generate-ai')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
                <Button
                  variant={resumeSubTab === 'upload-analyze' ? 'default' : 'outline'}
                  onClick={() => setResumeSubTab('upload-analyze')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload & Analyze
                </Button>
              </div>
            </div>

            {/* Generate with AI (Resumes) */}
            {resumeSubTab === 'generate-ai' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Resume with AI</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Paste a job description and AI will create an optimized resume tailored to the
                      role
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Job Description</label>
                      <Textarea
                        placeholder="Paste the job description here..."
                        value={resumeJobDescription}
                        onChange={(e) => setResumeJobDescription(e.target.value)}
                        rows={12}
                        className="resize-none"
                      />
                    </div>
                    <Button
                      onClick={generateResumeWithAI}
                      disabled={!resumeJobDescription.trim() || generatingResume}
                      className="w-full"
                    >
                      {generatingResume ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Resume
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {generatedResume && (
                  <Card className="border-2 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        AI-Generated Resume Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        <div className="space-y-4">
                          {generatedResume.personalInfo && (
                            <div>
                              <h3 className="text-lg font-bold">
                                {generatedResume.personalInfo.name}
                              </h3>
                              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                {generatedResume.personalInfo.email && (
                                  <div>{generatedResume.personalInfo.email}</div>
                                )}
                                {generatedResume.personalInfo.phone && (
                                  <div>{generatedResume.personalInfo.phone}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {generatedResume.summary && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Professional Summary</h4>
                              <p className="text-sm text-gray-700">{generatedResume.summary}</p>
                            </div>
                          )}

                          {Array.isArray(generatedResume.skills) &&
                            generatedResume.skills.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Skills</h4>
                                <div className="flex flex-wrap gap-2">
                                  {generatedResume.skills.map((skill: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                          {Array.isArray(generatedResume.experience) &&
                            generatedResume.experience.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Experience</h4>
                                <div className="space-y-3">
                                  {generatedResume.experience.map((exp: any, idx: number) => (
                                    <div key={idx} className="border-l-2 border-blue-500 pl-3">
                                      <h5 className="font-semibold text-sm">{exp.title}</h5>
                                      <div className="text-xs text-muted-foreground">
                                        {exp.company}
                                        {(exp.startDate || exp.endDate) && (
                                          <span>
                                            {' '}
                                            | {exp.startDate}
                                            {exp.startDate && exp.endDate && ' - '}
                                            {exp.endDate}
                                          </span>
                                        )}
                                      </div>
                                      {exp.summary && (
                                        <p className="text-xs mt-2 text-gray-700">{exp.summary}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={saveGeneratedResume}
                          disabled={creatingResume}
                          className="flex-1"
                        >
                          {creatingResume ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            'Save Resume'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => router.push('/account')}
                          disabled={creatingResume}
                          className="flex-1"
                        >
                          Optimize My Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Upload & Analyze (Resumes) */}
            {resumeSubTab === 'upload-analyze' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload & Analyze Resume</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Upload a PDF and paste a job description to analyze your fit for the role
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Upload Resume (PDF)</label>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                      />
                      {uploadedFile && (
                        <p className="text-sm text-muted-foreground mt-2 truncate">
                          Selected: {uploadedFile.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Job Description</label>
                      <Textarea
                        placeholder="Paste the job description here..."
                        value={analyzeJobDescription}
                        onChange={(e) => setAnalyzeJobDescription(e.target.value)}
                        rows={10}
                        className="resize-none"
                      />
                    </div>
                    <Button
                      onClick={analyzeResume}
                      disabled={!uploadedFile || !analyzeJobDescription.trim() || analyzingResume}
                      className="w-full"
                    >
                      {analyzingResume ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Analyze Resume
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 min-h-[420px]" style={{ borderColor: '#5270ff' }}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" style={{ color: '#5270ff' }} />
                      AI Analysis Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analyzingResume && (
                      <div className="flex items-center justify-center h-40 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        Analyzing your resume...
                      </div>
                    )}

                    {!analyzingResume && !resumeAnalysisResult && (
                      <div className="text-sm text-muted-foreground">
                        Submit your resume and job description to see a score and suggestions here.
                      </div>
                    )}

                    {!analyzingResume && resumeAnalysisResult && (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                          <div className="text-center">
                            <div className="text-4xl font-bold text-blue-600">
                              {resumeAnalysisResult.score}%
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Match Score</div>
                          </div>
                          {resumeAnalysisResult.summary && (
                            <p className="text-sm text-gray-700 mt-3 text-center">
                              {resumeAnalysisResult.summary}
                            </p>
                          )}
                        </div>

                        {Array.isArray(resumeAnalysisResult.strengths) &&
                          resumeAnalysisResult.strengths.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                <span className="text-blue-600">#</span> Matching Keywords
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {resumeAnalysisResult.strengths.map((s: string, i: number) => (
                                  <span
                                    key={i}
                                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        {Array.isArray(resumeAnalysisResult.gaps) &&
                          resumeAnalysisResult.gaps.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                <span className="text-orange-600">!</span> Missing Keywords
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {resumeAnalysisResult.gaps.map((g: string, i: number) => (
                                  <span
                                    key={i}
                                    className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Create an AI-optimized resume that addresses the gaps identified in the
                            analysis.
                          </AlertDescription>
                        </Alert>

                        <Button
                          onClick={optimizeAnalyzedResume}
                          disabled={creatingResume}
                          className="w-full"
                        >
                          {creatingResume ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Optimizing...
                            </>
                          ) : (
                            'Optimize Resume'
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ================================================================== */}
        {/* COVER LETTERS SECTION */}
        {/* ================================================================== */}
        {mainTab === 'cover-letters' && (
          <>
            {loadingCoverLetters ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                {/* Existing Cover Letters - Horizontal Cards */}
                {sortedCoverLetters.map((c) => (
                  <div
                    key={c._id}
                    className="flex bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow w-full md:w-[calc(50%-12px)]"
                  >
                    {/* Thumbnail */}
                    <div
                      className="w-32 min-h-[180px] bg-gradient-to-br from-purple-700 to-purple-900 flex-shrink-0 cursor-pointer relative group"
                      onClick={() => setPreviewLetter(c)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Mail className="h-8 w-8 text-white/30" />
                      </div>
                      <div className="absolute top-2 left-2 right-2">
                        <div className="text-[6px] text-white/60 font-medium truncate">
                          {c.name || 'Untitled'}
                        </div>
                        <div className="h-0.5 bg-white/20 mt-1 w-3/4" />
                        <div className="h-0.5 bg-white/20 mt-0.5 w-1/2" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 flex flex-col min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <button
                          type="button"
                          className="font-medium text-slate-900 truncate cursor-pointer hover:text-primary-500 text-left"
                          onClick={() => router.push(`/cover-letters/${c._id}`)}
                        >
                          {c.name || 'Untitled'}
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600"
                          onClick={() => router.push(`/cover-letters/${c._id}`)}
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        {c.company_name ? `${c.job_title} @ ${c.company_name}` : c.job_title}
                      </p>
                      <p className="text-xs text-slate-400 mb-3">
                        Updated{' '}
                        {new Date(c.updated_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {/* Action Links */}
                      <div className="space-y-1.5 mt-auto">
                        <button
                          className="flex items-center gap-2 text-sm text-primary-500 hover:text-primary-600"
                          onClick={() => setCoverLetterSubTab('upload-analyze')}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Improve with AI
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => exportCoverLetter(c)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => duplicateCoverLetter(c._id, c.name)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                        <button
                          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                          onClick={() => deleteCoverLetter(c._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* New Cover Letter Card */}
                <div
                  className="flex bg-white border-2 border-dashed border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer w-full md:w-[calc(50%-12px)]"
                  onClick={handleCreateCoverLetter}
                >
                  {/* Placeholder Thumbnail */}
                  <div className="w-32 min-h-[180px] bg-slate-100 flex-shrink-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-slate-400" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 flex flex-col justify-center">
                    <h3 className="font-medium text-primary-500 mb-1">New Cover Letter</h3>
                    <p className="text-sm text-slate-500">
                      Create a personalized cover letter for each job application. Stand out from
                      other applicants!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs for AI features - shown below the cards */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex gap-2 mb-6">
                <Button
                  variant={coverLetterSubTab === 'my-letters' ? 'default' : 'outline'}
                  onClick={() => setCoverLetterSubTab('my-letters')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <FileText className="h-4 w-4" />
                  My Cover Letters
                </Button>
                <Button
                  variant={coverLetterSubTab === 'generate-ai' ? 'default' : 'outline'}
                  onClick={() => setCoverLetterSubTab('generate-ai')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
                <Button
                  variant={coverLetterSubTab === 'upload-analyze' ? 'default' : 'outline'}
                  onClick={() => setCoverLetterSubTab('upload-analyze')}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload & Analyze
                </Button>
              </div>
            </div>

            {/* Generate with AI (Cover Letters) */}
            {coverLetterSubTab === 'generate-ai' && (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Cover Letter with AI</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Paste a job description and AI will create a tailored cover letter for the
                      role
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Company Name</label>
                        <Input
                          placeholder="e.g. Acme Corporation"
                          value={clJobCompany}
                          onChange={(e) => setClJobCompany(e.target.value)}
                          disabled={generatingCoverLetter}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Role / Position</label>
                        <Input
                          placeholder="e.g. Senior Product Manager"
                          value={clJobRole}
                          onChange={(e) => setClJobRole(e.target.value)}
                          disabled={generatingCoverLetter}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Job Description</label>
                      <Textarea
                        placeholder="Paste the job description here..."
                        value={clJobDescription}
                        onChange={(e) => setClJobDescription(e.target.value)}
                        rows={12}
                        className="resize-none"
                        disabled={generatingCoverLetter}
                      />
                    </div>
                    <Button
                      onClick={generateCoverLetterWithAI}
                      disabled={
                        !clJobDescription.trim() ||
                        !clJobRole.trim() ||
                        !clJobCompany.trim() ||
                        generatingCoverLetter
                      }
                      className="w-full"
                    >
                      {generatingCoverLetter ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Cover Letter
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Upload & Analyze (Cover Letters) */}
            {coverLetterSubTab === 'upload-analyze' && (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Upload & Analyze Cover Letter</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Paste your cover letter and the target job description to understand fit and
                      next steps
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Target Role (optional)
                        </label>
                        <Input
                          placeholder="e.g. Product Marketing Manager"
                          value={clAnalyzeRole}
                          onChange={(e) => setClAnalyzeRole(e.target.value)}
                          disabled={analyzingCoverLetter}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Company (optional)</label>
                        <Input
                          placeholder="e.g. Northwind Labs"
                          value={clAnalyzeCompany}
                          onChange={(e) => setClAnalyzeCompany(e.target.value)}
                          disabled={analyzingCoverLetter}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Cover Letter</label>
                      <Textarea
                        placeholder="Paste the cover letter you want to analyze..."
                        value={coverLetterDraft}
                        onChange={(e) => setCoverLetterDraft(e.target.value)}
                        rows={10}
                        className="resize-none"
                        disabled={analyzingCoverLetter}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        We analyze exactly what you paste here—no files required.
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Job Description</label>
                      <Textarea
                        placeholder="Paste the target job description..."
                        value={clAnalyzeJobDescription}
                        onChange={(e) => setClAnalyzeJobDescription(e.target.value)}
                        rows={8}
                        className="resize-none"
                        disabled={analyzingCoverLetter}
                      />
                    </div>
                    <Button
                      onClick={analyzeCoverLetter}
                      disabled={
                        !coverLetterDraft.trim() ||
                        !clAnalyzeJobDescription.trim() ||
                        analyzingCoverLetter
                      }
                      className="w-full"
                    >
                      {analyzingCoverLetter ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Analyze Cover Letter
                        </>
                      )}
                    </Button>

                    {clAnalysisResult && (
                      <div className="space-y-4">
                        <div className="rounded-lg bg-blue-50 border border-blue-100 p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-blue-900">Strengths</h3>
                          </div>
                          <ul className="space-y-2 text-sm text-gray-700">
                            {clAnalysisResult.strengths.length ? (
                              clAnalysisResult.strengths.map((item, idx) => (
                                <li key={`strength-${idx}`} className="flex items-start gap-2">
                                  <span className="text-blue-600 mt-0.5">•</span>
                                  <span>{item}</span>
                                </li>
                              ))
                            ) : (
                              <li className="flex items-start gap-2">
                                <span className="text-blue-600 mt-0.5">•</span>
                                <span>Nothing highlighted yet.</span>
                              </li>
                            )}
                          </ul>

                          <div className="flex items-center gap-2 mt-6 mb-4">
                            <div className="h-6 w-1 bg-yellow-600 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-yellow-900">
                              Areas to Improve
                            </h3>
                          </div>
                          <ul className="space-y-2 text-sm text-gray-700">
                            {clAnalysisResult.gaps.length ? (
                              clAnalysisResult.gaps.map((item, idx) => (
                                <li key={`gap-${idx}`} className="flex items-start gap-2">
                                  <span className="text-yellow-600 mt-0.5">•</span>
                                  <span>{item}</span>
                                </li>
                              ))
                            ) : (
                              <li className="flex items-start gap-2">
                                <span className="text-yellow-600 mt-0.5">•</span>
                                <span>No major gaps detected.</span>
                              </li>
                            )}
                          </ul>

                          <div className="flex items-center gap-2 mt-6 mb-4">
                            <div className="h-6 w-1 bg-purple-600 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-purple-900">Suggestions</h3>
                          </div>
                          <ul className="space-y-2 text-sm text-gray-700">
                            {clAnalysisResult.recommendations.length ? (
                              clAnalysisResult.recommendations.map((item, idx) => (
                                <li key={`rec-${idx}`} className="flex items-start gap-2">
                                  <span className="text-purple-600 mt-0.5">•</span>
                                  <span>{item}</span>
                                </li>
                              ))
                            ) : (
                              <li className="flex items-start gap-2">
                                <span className="text-purple-600 mt-0.5">•</span>
                                <span>Nothing to update right now.</span>
                              </li>
                            )}
                          </ul>
                        </div>

                        {clAnalysisResult.optimizedLetter && (
                          <div className="rounded-lg bg-gray-50 border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-green-600 rounded-full"></div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  Optimized Cover Letter
                                </h3>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowOptimized((prev) => !prev)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                {showOptimized ? 'Hide' : 'Show'}
                              </Button>
                            </div>

                            {showOptimized && (
                              <>
                                <div className="rounded-md bg-white border border-gray-200 p-6 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
                                  {clAnalysisResult.optimizedLetter}
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard
                                        .writeText(clAnalysisResult.optimizedLetter || '')
                                        .then(() => {
                                          toast({
                                            title: 'Copied!',
                                            description: 'Optimized letter copied to clipboard',
                                            variant: 'success',
                                          });
                                        })
                                        .catch(() => {
                                          toast({
                                            title: 'Copy Failed',
                                            description: 'Unable to copy to clipboard',
                                            variant: 'destructive',
                                          });
                                        });
                                    }}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={saveOptimizedCoverLetter}
                                    disabled={savingOptimized}
                                    className="bg-primary-500 hover:bg-primary-700"
                                  >
                                    {savingOptimized ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Save Optimized Version
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals - outside the white wrapper */}
      {previewResume && (
        <ResumePreviewModal
          open={!!previewResume}
          onClose={() => setPreviewResume(null)}
          resume={previewResume}
          userName={clerkUser?.fullName || ''}
          userEmail={clerkUser?.primaryEmailAddress?.emailAddress || ''}
        />
      )}

      {previewLetter && (
        <CoverLetterPreviewModal
          open={!!previewLetter}
          onClose={() => setPreviewLetter(null)}
          letter={previewLetter}
          userName={clerkUser?.fullName || ''}
          userEmail={clerkUser?.primaryEmailAddress?.emailAddress || ''}
        />
      )}
    </div>
  );
}
