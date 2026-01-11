'use client';

import { Loader2 } from 'lucide-react';
import { Suspense, useState } from 'react';

import { AccountSettingsSidebar } from '@/components/account/AccountSettingsSidebar';
import { AutoUpdatesSection } from '@/components/account/sections/AutoUpdatesSection';
import { DataPrivacySection } from '@/components/account/sections/DataPrivacySection';
import { ProfileSettingsSection } from '@/components/account/sections/ProfileSettingsSection';
import { SecuritySettingsSection } from '@/components/account/sections/SecuritySettingsSection';
import { Card, CardContent } from '@/components/ui/card';

function AccountPageContent() {
  const [activeSection, setActiveSection] = useState('profile');

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSettingsSection />;
      case 'security':
        return <SecuritySettingsSection />;
      case 'auto-updates':
        return <AutoUpdatesSection />;
      case 'data-privacy':
        return <DataPrivacySection />;
      default:
        return <ProfileSettingsSection />;
    }
  };

  // Get section title for header
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'profile':
        return 'Profile Settings';
      case 'security':
        return 'Security Settings';
      case 'auto-updates':
        return 'Auto Updates';
      case 'data-privacy':
        return 'Data Privacy Rights';
      default:
        return 'Account Settings';
    }
  };

  return (
    <div className="w-full max-w-[75%] mx-auto">
      <div className="w-full rounded-3xl bg-white p-5 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{getSectionTitle()}</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <AccountSettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          {/* Content Area */}
          <Card className="flex-1 rounded-shell shadow-card">
            <CardContent className="p-8">{renderSection()}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}
