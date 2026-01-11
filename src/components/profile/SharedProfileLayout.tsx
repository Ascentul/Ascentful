'use client';

import { Download, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import {
  BasicInfoSection,
  BasicInfoSectionRef,
} from '@/components/profile/sections/BasicInfoSection';
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
  const basicInfoRef = useRef<BasicInfoSectionRef>(null);

  const handleUpdate = async () => {
    if (activeSection === 'basic-info' && basicInfoRef.current) {
      setIsSaving(true);
      try {
        await basicInfoRef.current.handleSave();
      } finally {
        setIsSaving(false);
      }
    }
    // Add handlers for other sections as they're implemented
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'basic-info':
        return <BasicInfoSection ref={basicInfoRef} />;
      case 'preferences':
        return <div className="text-muted-foreground">Preferences section coming soon...</div>;
      case 'experience':
        return <div className="text-muted-foreground">Experience section coming soon...</div>;
      case 'volunteer':
        return (
          <div className="text-muted-foreground">Volunteer experience section coming soon...</div>
        );
      case 'certifications':
        return <div className="text-muted-foreground">Certifications section coming soon...</div>;
      case 'education':
        return <div className="text-muted-foreground">Education section coming soon...</div>;
      case 'projects':
        return <div className="text-muted-foreground">Projects section coming soon...</div>;
      case 'links':
        return <div className="text-muted-foreground">Links section coming soon...</div>;
      case 'documents':
        return <div className="text-muted-foreground">Documents section coming soon...</div>;
      case 'custom-fields':
        return <div className="text-muted-foreground">Custom fields section coming soon...</div>;
      case 'autofill-fields':
        return <div className="text-muted-foreground">Autofill fields section coming soon...</div>;
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
          <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">
            {activeSection
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
          <Button
            onClick={handleUpdate}
            disabled={isSaving}
            className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white px-6"
          >
            {isSaving ? 'Updating...' : 'Update'}
          </Button>
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
