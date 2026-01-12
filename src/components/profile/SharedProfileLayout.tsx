'use client';

import { Download, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SharedProfileLayoutProps {
  pageDescription?: string;
  showLoadingState?: boolean;
}

export function SharedProfileLayout({
  pageDescription = 'Manage your profile information',
  showLoadingState = false,
}: SharedProfileLayoutProps) {
  const [activeSection, setActiveSection] = useState('basic-info');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
            <Download className="h-4 w-4" />
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

      {/* Import Dialog - TODO: Implement */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Profile Data</DialogTitle>
            <DialogDescription>
              Import functionality coming soon. You'll be able to import data from your resume or
              LinkedIn profile PDF.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowImportDialog(false)} className="w-full rounded-control">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
