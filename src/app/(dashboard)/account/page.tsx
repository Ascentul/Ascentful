'use client';

import { Loader2 } from 'lucide-react';
import { ComponentType, Suspense, useState } from 'react';

import { AccountSettingsSidebar } from '@/components/account/AccountSettingsSidebar';
import { AutoUpdatesSection } from '@/components/account/sections/AutoUpdatesSection';
import { DataPrivacySection } from '@/components/account/sections/DataPrivacySection';
import { ProfileSettingsSection } from '@/components/account/sections/ProfileSettingsSection';
import { SecuritySettingsSection } from '@/components/account/sections/SecuritySettingsSection';
import { Card, CardContent } from '@/components/ui/card';

const SECTIONS: Record<string, { title: string; component: ComponentType }> = {
  profile: { title: 'Profile Settings', component: ProfileSettingsSection },
  security: { title: 'Security Settings', component: SecuritySettingsSection },
  'auto-updates': { title: 'Auto Updates', component: AutoUpdatesSection },
  'data-privacy': { title: 'Data Privacy Rights', component: DataPrivacySection },
};

const DEFAULT_SECTION = 'profile';

function AccountPageContent() {
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTION);

  const config = SECTIONS[activeSection] ?? SECTIONS[DEFAULT_SECTION];
  const SectionComponent = config.component;

  return (
    <div className="w-full max-w-full lg:max-w-[75%] mx-auto px-4 lg:px-0">
      <div className="w-full rounded-3xl bg-white p-5 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{config.title}</h1>
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
            <CardContent className="p-8">
              <SectionComponent />
            </CardContent>
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
