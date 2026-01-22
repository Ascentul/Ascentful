'use client';

import { Bell, Download, Mail, ShieldCheck, User } from 'lucide-react';

interface AccountSettingsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const sections = [
  { id: 'profile', label: 'Profile Settings', icon: User },
  { id: 'security', label: 'Security Settings', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'auto-updates', label: 'Auto Updates', icon: Mail },
  { id: 'data-privacy', label: 'Data Privacy Rights', icon: Download },
];

export function AccountSettingsSidebar({
  activeSection,
  onSectionChange,
}: AccountSettingsSidebarProps) {
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
