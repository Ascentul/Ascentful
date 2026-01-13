'use client';

import {
  Award,
  BookOpen,
  Briefcase,
  FileText,
  FolderOpen,
  FormInput,
  Heart,
  Link,
  Settings,
  User,
  Wand2,
} from 'lucide-react';

interface ProfileSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const sections = [
  { id: 'basic-info', label: 'Basic Info', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'volunteer', label: 'Volunteer Experience', icon: Heart },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'education', label: 'Education', icon: BookOpen },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'links', label: 'Links', icon: Link },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'custom-fields', label: 'Custom Fields', icon: Wand2 },
  { id: 'autofill-fields', label: 'Autofill Fields', icon: FormInput },
];

export function ProfileSidebar({ activeSection, onSectionChange }: ProfileSidebarProps) {
  return (
    <nav className="w-64 flex-shrink-0 p-4 space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-neutral-900 text-white shadow-sm'
                : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="text-left">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
