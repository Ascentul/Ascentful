'use client';

import type {
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';

import { ContactSection } from './ContactSection';
import { EducationSection } from './EducationSection';
import { ExperienceSection } from './ExperienceSection';
import { ProjectsSection } from './ProjectsSection';
import { SectionCard } from './SectionCard';
import { SkillsSection } from './SkillsSection';
import { SummarySection } from './SummarySection';

interface ContentTabProps {
  resumeData: ResumeData;
  sectionOrder: string[];
  enabledSections: string[];
  onUpdateContactInfo: (field: keyof ContactInfo, value: string) => void;
  onUpdateSummary: (summary: string) => void;
  onUpdateExperience: (experiences: Experience[]) => void;
  onUpdateEducation: (education: Education[]) => void;
  onUpdateSkills: (skills: string[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onReorderSection?: (fromIndex: number, toIndex: number) => void;
  onToggleSection?: (sectionId: string, enabled: boolean) => void;
  onGenerateSummary?: () => void;
  onGenerateBullets?: (experienceIndex: number) => void;
  onSuggestSkills?: () => void;
  isGenerating?: boolean;
}

export function ContentTab({
  resumeData,
  sectionOrder,
  enabledSections,
  onUpdateContactInfo,
  onUpdateSummary,
  onUpdateExperience,
  onUpdateEducation,
  onUpdateSkills,
  onUpdateProjects,
  onReorderSection,
  onToggleSection,
  onGenerateSummary,
  onGenerateBullets,
  onSuggestSkills,
  isGenerating,
}: ContentTabProps) {
  const handleMoveUp = (index: number) => {
    if (onReorderSection && index > 0) {
      onReorderSection(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (onReorderSection && index < sectionOrder.length - 1) {
      onReorderSection(index, index + 1);
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    if (onToggleSection) {
      onToggleSection(sectionId, false);
    }
  };

  const renderSection = (sectionId: string, index: number) => {
    const canMoveUp = index > 0;
    const canMoveDown = index < sectionOrder.length - 1;

    switch (sectionId) {
      case 'contact':
        return (
          <SectionCard
            key={sectionId}
            title="Contact Information"
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
          >
            <ContactSection contactInfo={resumeData.contactInfo} onChange={onUpdateContactInfo} />
          </SectionCard>
        );

      case 'summary':
        return (
          <SectionCard
            key={sectionId}
            title="Professional Summary"
            onDelete={() => handleDeleteSection(sectionId)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            isEmpty={!resumeData.summary}
          >
            <SummarySection
              value={resumeData.summary || ''}
              onChange={onUpdateSummary}
              onGenerateAI={onGenerateSummary}
              isGenerating={isGenerating}
            />
          </SectionCard>
        );

      case 'experience':
        return (
          <SectionCard
            key={sectionId}
            title="Work Experience"
            onDelete={() => handleDeleteSection(sectionId)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            isEmpty={!resumeData.experience?.length}
          >
            <ExperienceSection
              experiences={resumeData.experience || []}
              onChange={onUpdateExperience}
              onGenerateBullets={onGenerateBullets}
              isGenerating={isGenerating}
            />
          </SectionCard>
        );

      case 'education':
        return (
          <SectionCard
            key={sectionId}
            title="Education"
            onDelete={() => handleDeleteSection(sectionId)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            isEmpty={!resumeData.education?.length}
          >
            <EducationSection education={resumeData.education || []} onChange={onUpdateEducation} />
          </SectionCard>
        );

      case 'skills':
        return (
          <SectionCard
            key={sectionId}
            title="Skills"
            onDelete={() => handleDeleteSection(sectionId)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            isEmpty={!resumeData.skills?.length}
          >
            <SkillsSection
              skills={resumeData.skills || []}
              onChange={onUpdateSkills}
              onSuggestAI={onSuggestSkills}
              isSuggesting={isGenerating}
            />
          </SectionCard>
        );

      case 'projects':
        return (
          <SectionCard
            key={sectionId}
            title="Projects"
            onDelete={() => handleDeleteSection(sectionId)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            isEmpty={!resumeData.projects?.length}
          >
            <ProjectsSection projects={resumeData.projects || []} onChange={onUpdateProjects} />
          </SectionCard>
        );

      default:
        return null;
    }
  };

  // Always show contact first, then the rest in order
  const sectionsToRender = ['contact', ...sectionOrder.filter((s) => enabledSections.includes(s))];

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {sectionsToRender.map((sectionId, index) => renderSection(sectionId, index))}
    </div>
  );
}
