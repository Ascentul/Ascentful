'use client';

/**
 * Student Advisor Settings - Sharing & Notification Preferences Page
 *
 * Allows students to configure what information they share with their advisor
 * and how they receive notifications.
 */

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Settings,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { StudentUniversityGate } from '@/components/StudentUniversityGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

type NotificationPreference = 'instant' | 'daily' | 'off';

const SETTING_DEFAULTS = {
  shareCareerProfile: true,
  shareApplications: true,
  shareGoals: true,
  shareDocuments: true,
  notificationPreference: 'instant' as NotificationPreference,
};

export default function SettingsPage() {
  return (
    <StudentUniversityGate>
      <SettingsContent />
    </StudentUniversityGate>
  );
}

function SettingsContent() {
  const { user } = useUser();
  const clerkId = user?.id;

  // Query current settings
  const settings = useQuery(
    api.student_advisor_hub.getMyAdvisorSettings,
    clerkId ? { clerkId } : 'skip',
  );

  // Mutation
  const updateSettings = useMutation(api.student_advisor_hub_mutations.updateAdvisorSettings);

  // Local state
  const [shareCareerProfile, setShareCareerProfile] = useState(SETTING_DEFAULTS.shareCareerProfile);
  const [shareApplications, setShareApplications] = useState(SETTING_DEFAULTS.shareApplications);
  const [shareGoals, setShareGoals] = useState(SETTING_DEFAULTS.shareGoals);
  const [shareDocuments, setShareDocuments] = useState(SETTING_DEFAULTS.shareDocuments);
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference>(
    SETTING_DEFAULTS.notificationPreference,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isLoading = settings === undefined;

  // Initialize state from fetched settings
  useEffect(() => {
    if (settings) {
      setShareCareerProfile(settings.share_career_profile ?? SETTING_DEFAULTS.shareCareerProfile);
      setShareApplications(settings.share_applications ?? SETTING_DEFAULTS.shareApplications);
      setShareGoals(settings.share_goals ?? SETTING_DEFAULTS.shareGoals);
      setShareDocuments(settings.share_documents ?? SETTING_DEFAULTS.shareDocuments);
      setNotificationPreference(
        settings.notification_preference ?? SETTING_DEFAULTS.notificationPreference,
      );
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        shareCareerProfile !==
          (settings.share_career_profile ?? SETTING_DEFAULTS.shareCareerProfile) ||
        shareApplications !== (settings.share_applications ?? SETTING_DEFAULTS.shareApplications) ||
        shareGoals !== (settings.share_goals ?? SETTING_DEFAULTS.shareGoals) ||
        shareDocuments !== (settings.share_documents ?? SETTING_DEFAULTS.shareDocuments) ||
        notificationPreference !==
          (settings.notification_preference ?? SETTING_DEFAULTS.notificationPreference);
      setHasChanges(changed);
      if (changed) {
        setSaveSuccess(false);
      }
    }
  }, [
    settings,
    shareCareerProfile,
    shareApplications,
    shareGoals,
    shareDocuments,
    notificationPreference,
  ]);

  const handleSave = async () => {
    if (!clerkId || isSaving) return;

    setIsSaving(true);
    setSaveError(false);
    try {
      await updateSettings({
        clerkId,
        shareCareerProfile,
        shareApplications,
        shareGoals,
        shareDocuments,
        notificationPreference,
      });
      setSaveSuccess(true);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="w-full gradient-border-bottom p-5 shadow-sm">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full gradient-border-bottom p-5 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/student/advisor">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Back to advisor hub"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Advisor Settings</h1>
              <p className="text-muted-foreground">
                Control what you share and how you're notified
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Error Message */}
        {saveError && (
          <div className="max-w-2xl flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Failed to save settings. Please try again.</span>
          </div>
        )}

        <div className="max-w-2xl space-y-6">
          {/* Sharing Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Information Sharing
              </CardTitle>
              <CardDescription>
                Choose what information your advisor can see about your career journey
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ToggleSetting
                id="share-career-profile"
                label="Career Profile"
                description="Your skills, experience, and career interests"
                checked={shareCareerProfile}
                onCheckedChange={setShareCareerProfile}
              />

              <ToggleSetting
                id="share-applications"
                label="Job Applications"
                description="Your application status and company details"
                checked={shareApplications}
                onCheckedChange={setShareApplications}
              />

              <ToggleSetting
                id="share-goals"
                label="Career Goals"
                description="Your goals, milestones, and progress tracking"
                checked={shareGoals}
                onCheckedChange={setShareGoals}
              />

              <ToggleSetting
                id="share-documents"
                label="Documents"
                description="Your resumes and cover letters"
                checked={shareDocuments}
                onCheckedChange={setShareDocuments}
              />
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>How you want to be notified about advisor activity</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={notificationPreference}
                onValueChange={(v) => setNotificationPreference(v as NotificationPreference)}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value="instant" id="instant" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="instant" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary-600" />
                        <span className="font-medium">Instant</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Get notified immediately when your advisor sends a message or provides
                        feedback
                      </p>
                    </Label>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value="daily" id="daily" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="daily" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-primary-600" />
                        <span className="font-medium">Daily Digest</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Receive a daily summary of advisor activity
                      </p>
                    </Label>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value="off" id="off" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="off" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <BellOff className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">Off</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Don't send any notifications (you can still check the hub for updates)
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Your Privacy Matters</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    These settings control what your advisor can see. Disabling sharing for a
                    category means your advisor won't be able to view that information or provide
                    feedback on it. Session notes and messages are always visible to both you and
                    your advisor.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Toggle Setting Component
// ============================================================================

function ToggleSetting({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-base cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {checked ? (
          <Eye className="h-4 w-4 text-green-600" />
        ) : (
          <EyeOff className="h-4 w-4 text-slate-400" />
        )}
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
