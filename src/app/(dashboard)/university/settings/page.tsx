'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Building, Globe, Mail, Settings, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

export default function UniversitySettingsPage() {
  const { user: clerkUser } = useUser();
  const { user, isAdmin, subscription } = useAuth();
  const { toast } = useToast();
  const effectiveClerkId = clerkUser?.id || user?.clerkId;

  // Convex mutations and queries - api is generated code, no optional chaining needed
  const updateUniversitySettingsMutation = useMutation(api.universities.updateUniversitySettings);
  const universitySettings = useQuery(
    api.universities.getUniversitySettings,
    effectiveClerkId ? { clerkId: effectiveClerkId } : 'skip',
  );

  const canAccess = !!user && (isAdmin || (subscription?.isUniversity ?? false));

  const [settings, setSettings] = useState({
    name: '',
    description: '',
    website: '',
    contactEmail: '',
    maxStudents: 0,
    licenseSeats: 0,
  });

  const [loading, setLoading] = useState(false);

  // Load university settings when data is available
  useEffect(() => {
    if (universitySettings) {
      setSettings({
        name: universitySettings.name || '',
        description: universitySettings.description || '',
        website: universitySettings.website || '',
        contactEmail: universitySettings.contact_email || '',
        maxStudents: universitySettings.max_students || 0,
        licenseSeats: universitySettings.license_seats || 0,
      });
    }
  }, [universitySettings]);

  const handleSaveSettings = async () => {
    if (!effectiveClerkId || !universitySettings?._id) {
      toast({
        title: 'Error',
        description: 'Unable to save settings. Please try refreshing the page.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await updateUniversitySettingsMutation({
        universityId: universitySettings._id,
        settings: {
          name: settings.name,
          description: settings.description,
          website: settings.website,
          contact_email: settings.contactEmail,
          // NOTE: max_students and license_seats are managed by super_admin only
          // via the admin panel, not editable by university admins
        },
      });

      toast({
        title: 'Settings saved',
        description: 'University settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Settings save error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureNotifications = () => {
    toast({
      title: 'Email Notifications',
      description:
        'This feature allows you to configure email alerts for student activity. Contact support to enable custom notifications.',
    });
  };

  const handleExportData = async () => {
    if (!effectiveClerkId) return;

    try {
      toast({
        title: 'Preparing Export',
        description: 'Generating your data export...',
      });

      // Call the export API
      const response = await fetch('/api/university/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: effectiveClerkId,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `university-data-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({
        title: 'Export Complete',
        description: 'Your data has been downloaded successfully.',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Unable to export data. Please try again or contact support.',
        variant: 'destructive',
      });
    }
  };

  const handleConfigureSecurity = () => {
    toast({
      title: 'Security Settings',
      description:
        'Advanced security options including SSO, IP restrictions, and 2FA are available. Contact support to configure enterprise security features.',
    });
  };

  if (!canAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You do not have access to University Settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">University Settings</h1>
          <p className="text-muted-foreground">
            Manage your institution's configuration and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Institution Information
            </CardTitle>
            <CardDescription>Update your university's basic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">University Name</Label>
              <Input
                id="name"
                placeholder="Enter university name"
                value={settings.name}
                onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of your institution"
                rows={3}
                value={settings.description}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://university.edu"
                value={settings.website}
                onChange={(e) => setSettings((prev) => ({ ...prev, website: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="admin@university.edu"
                value={settings.contactEmail}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    contactEmail: e.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              License Management
            </CardTitle>
            <CardDescription>View your institution's license information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxStudents">Maximum Students</Label>
              <Input
                id="maxStudents"
                type="number"
                value={settings.maxStudents}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Managed by system administrator</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseSeats">License Seats</Label>
              <Input
                id="licenseSeats"
                type="number"
                value={settings.licenseSeats}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Total number of licenses available for students (managed by system administrator)
              </p>
            </div>

            <div className="space-y-2">
              <Label>License Usage</Label>
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                <span className="text-sm font-medium">
                  {universitySettings?.license_used || 0} / {universitySettings?.license_seats || 0}{' '}
                  seats used
                </span>
                <span className="text-xs text-muted-foreground">
                  {(universitySettings?.license_seats || 0) -
                    (universitySettings?.license_used || 0)}{' '}
                  available
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>License Plan</Label>
              <Input
                value={universitySettings?.license_plan || 'N/A'}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Current subscription plan (read-only)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced Settings
          </CardTitle>
          <CardDescription>Additional configuration options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Email Notifications</h4>
                  <p className="text-xs text-muted-foreground">
                    Receive updates about student activity
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleConfigureNotifications}>
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Data Export</h4>
                  <p className="text-xs text-muted-foreground">Download student and usage data</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  Export
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Security</h4>
                  <p className="text-xs text-muted-foreground">Configure security settings</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleConfigureSecurity}>
                  Configure
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button onClick={handleSaveSettings} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
