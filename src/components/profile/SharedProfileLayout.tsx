'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation } from 'convex/react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import {
  AutofillFieldsSection,
  AutofillFieldsSectionRef,
} from '@/components/profile/sections/AutofillFieldsSection';
import {
  BasicInfoSection,
  BasicInfoSectionRef,
} from '@/components/profile/sections/BasicInfoSection';
import {
  CertificationsSection,
  CertificationsSectionRef,
} from '@/components/profile/sections/CertificationsSection';
import {
  CustomFieldsSection,
  CustomFieldsSectionRef,
} from '@/components/profile/sections/CustomFieldsSection';
import {
  DocumentsSection,
  DocumentsSectionRef,
} from '@/components/profile/sections/DocumentsSection';
import {
  EducationSection,
  EducationSectionRef,
} from '@/components/profile/sections/EducationSection';
import {
  ExperienceSection,
  ExperienceSectionRef,
} from '@/components/profile/sections/ExperienceSection';
import { LinksSection, LinksSectionRef } from '@/components/profile/sections/LinksSection';
import {
  PreferencesSection,
  PreferencesSectionRef,
} from '@/components/profile/sections/PreferencesSection';
import { ProjectsSection, ProjectsSectionRef } from '@/components/profile/sections/ProjectsSection';
import {
  VolunteerExperienceSection,
  VolunteerExperienceSectionRef,
} from '@/components/profile/sections/VolunteerExperienceSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface SharedProfileLayoutProps {
  pageDescription?: string;
  showLoadingState?: boolean;
}

export function SharedProfileLayout({
  pageDescription = 'Manage your profile information',
  showLoadingState = false,
}: SharedProfileLayoutProps) {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('basic-info');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<
    'idle' | 'extracting' | 'parsing' | 'saving' | 'done' | 'error'
  >('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateUser = useMutation(api.users.updateUser);

  // Section refs - used by sectionsWithSave for top-level Update button.
  // Other sections (experience, education, etc.) use inline auto-save instead.
  const basicInfoRef = useRef<BasicInfoSectionRef>(null);
  const preferencesRef = useRef<PreferencesSectionRef>(null);
  const linksRef = useRef<LinksSectionRef>(null);

  // Refs for auto-save sections - passed to components for consistency
  const experienceRef = useRef<ExperienceSectionRef>(null);
  const volunteerRef = useRef<VolunteerExperienceSectionRef>(null);
  const certificationsRef = useRef<CertificationsSectionRef>(null);
  const educationRef = useRef<EducationSectionRef>(null);
  const projectsRef = useRef<ProjectsSectionRef>(null);
  const documentsRef = useRef<DocumentsSectionRef>(null);
  const customFieldsRef = useRef<CustomFieldsSectionRef>(null);
  const autofillFieldsRef = useRef<AutofillFieldsSectionRef>(null);

  // Sections that have save functionality implemented (with top-level Update button)
  // Note: experience requires manual save, other sections (education, certifications, etc.) auto-save
  const sectionsWithSave = ['basic-info', 'preferences', 'experience', 'links'];
  const showUpdateButton = sectionsWithSave.includes(activeSection);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      if (activeSection === 'basic-info' && basicInfoRef.current) {
        await basicInfoRef.current.handleSave();
      } else if (activeSection === 'preferences' && preferencesRef.current) {
        await preferencesRef.current.handleSave();
      } else if (activeSection === 'experience' && experienceRef.current) {
        await experienceRef.current.handleSave();
      } else if (activeSection === 'links' && linksRef.current) {
        await linksRef.current.handleSave();
      }
    } catch (error) {
      // Error already handled by section with toast - log for debugging
      console.error('Update failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clerkUser?.id) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const isValidType =
      validTypes.includes(file.type) || file.name.endsWith('.pdf') || file.name.endsWith('.docx');

    if (!isValidType) {
      setImportError('Please upload a PDF or DOCX file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setImportError('File size must be under 10MB');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      // Step 1: Extract text from file
      setImportStatus('extracting');
      const formData = new FormData();
      formData.append('file', file);

      const extractResponse = await fetch('/api/resumes/extract', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract text from file');
      }

      const extractData = await extractResponse.json();
      const resumeText = extractData.text;

      if (!resumeText || resumeText.length < 50) {
        throw new Error('Could not extract enough text from the file. It may be image-based.');
      }

      // Step 2: Parse resume text with AI
      setImportStatus('parsing');
      const parseResponse = await fetch('/api/resumes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText }),
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse resume data');
      }

      const parseData = await parseResponse.json();
      const parsed = parseData.data;

      // Step 3: Save to user profile
      setImportStatus('saving');

      // Map parsed data to profile fields (matching convex/users.ts updateUser schema)
      const updates: Record<string, unknown> = {};

      if (parsed.personalInfo) {
        if (parsed.personalInfo.name) updates.name = parsed.personalInfo.name;
        if (parsed.personalInfo.email) updates.email = parsed.personalInfo.email;
        if (parsed.personalInfo.phone) updates.phone_number = parsed.personalInfo.phone;
        if (parsed.personalInfo.location) updates.location = parsed.personalInfo.location;
        if (parsed.personalInfo.linkedin) updates.linkedin_url = parsed.personalInfo.linkedin;
        if (parsed.personalInfo.github) updates.github_url = parsed.personalInfo.github;
      }

      if (parsed.summary) updates.bio = parsed.summary;
      // Skills are stored as comma-separated string in Convex
      if (parsed.skills?.length) updates.skills = parsed.skills.join(', ');

      // Map work history (matching workHistoryValidator schema)
      if (parsed.experience?.length) {
        updates.work_history = parsed.experience.map(
          (exp: Record<string, unknown>, index: number) => ({
            id: `imported-${Date.now()}-${index}`,
            role: (exp.title as string) || '',
            company: (exp.company as string) || '',
            location: (exp.location as string) || '',
            start_date: (exp.startDate as string) || '',
            end_date: exp.current ? 'Present' : (exp.endDate as string) || '',
            is_current: Boolean(exp.current),
            summary: (exp.summary as string) || '',
          }),
        );
      }

      // Map education (matching educationHistoryValidator schema)
      if (parsed.education?.length) {
        updates.education_history = parsed.education.map(
          (edu: Record<string, unknown>, index: number) => ({
            id: `imported-${Date.now()}-${index}`,
            degree: (edu.degree as string) || '',
            field_of_study: (edu.field as string) || '',
            school: (edu.school as string) || '',
            start_year: (edu.startYear as string) || '',
            end_year: (edu.endYear as string) || (edu.graduationYear as string) || '',
            gpa: (edu.gpa as string) || '',
          }),
        );
      }

      await updateUser({
        clerkId: clerkUser.id,
        updates,
      });

      setImportStatus('done');
      toast({
        title: 'Profile imported successfully',
        description: 'Your profile has been updated with data from your resume.',
      });

      // Close dialog after short delay
      setTimeout(() => {
        setShowImportDialog(false);
        setImportStatus('idle');
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus('error');
      setImportError(error instanceof Error ? error.message : 'Failed to import profile data');
    } finally {
      setIsImporting(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'basic-info':
        return <BasicInfoSection ref={basicInfoRef} />;
      case 'preferences':
        return <PreferencesSection ref={preferencesRef} />;
      case 'experience':
        return <ExperienceSection ref={experienceRef} />;
      case 'volunteer':
        return <VolunteerExperienceSection ref={volunteerRef} />;
      case 'certifications':
        return <CertificationsSection ref={certificationsRef} />;
      case 'education':
        return <EducationSection ref={educationRef} />;
      case 'projects':
        return <ProjectsSection ref={projectsRef} />;
      case 'links':
        return <LinksSection ref={linksRef} />;
      case 'documents':
        return <DocumentsSection ref={documentsRef} />;
      case 'custom-fields':
        return <CustomFieldsSection ref={customFieldsRef} />;
      case 'autofill-fields':
        return <AutofillFieldsSection ref={autofillFieldsRef} />;
      default:
        return <BasicInfoSection ref={basicInfoRef} />;
    }
  };

  if (showLoadingState) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {activeSection === 'autofill-fields'
              ? 'Application Autofill Fields'
              : activeSection
                  .split('-')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
          </h1>
          <p className="text-muted-foreground">{pageDescription}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="rounded-control flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          {showUpdateButton && (
            <Button
              onClick={handleUpdate}
              disabled={isSaving}
              className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white px-6"
            >
              {isSaving ? 'Updating...' : 'Update'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <ProfileSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Content Area */}
        <Card className="flex-1 rounded-shell shadow-card">
          <CardContent className="p-8">{renderSection()}</CardContent>
        </Card>
      </div>

      {/* Import Dialog */}
      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => {
          if (!isImporting) {
            setShowImportDialog(open);
            if (!open) {
              setImportStatus('idle');
              setImportError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Profile Data</DialogTitle>
            <DialogDescription>
              Upload your resume (PDF or DOCX) to automatically populate your profile with your
              experience, education, and skills.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {importStatus === 'idle' && (
              <>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Click to upload your resume</p>
                  <p className="text-xs text-muted-foreground">PDF or DOCX, max 10MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}

            {(importStatus === 'extracting' ||
              importStatus === 'parsing' ||
              importStatus === 'saving') && (
              <div className="text-center py-8">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                <p className="text-sm font-medium">
                  {importStatus === 'extracting' && 'Extracting text from document...'}
                  {importStatus === 'parsing' && 'Analyzing resume content...'}
                  {importStatus === 'saving' && 'Updating your profile...'}
                </p>
              </div>
            )}

            {importStatus === 'done' && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
                <p className="text-sm font-medium text-green-600">Profile imported successfully!</p>
              </div>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {importStatus === 'error' && (
              <Button
                onClick={() => {
                  setImportStatus('idle');
                  setImportError(null);
                }}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            )}
          </div>

          {importStatus === 'idle' && (
            <Button
              onClick={() => setShowImportDialog(false)}
              variant="outline"
              className="w-full rounded-control"
            >
              Cancel
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
