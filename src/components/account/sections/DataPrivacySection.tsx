'use client';

import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';

export function DataPrivacySection() {
  const { signOut } = useAuth();
  const { toast } = useToast();

  const [isExportingData, setIsExportingData] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDataExport = async () => {
    setIsExportingData(true);
    try {
      const response = await fetch('/api/gdpr/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] || `personal-data-export-${new Date().toISOString().split('T')[0]}.json`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Data exported successfully',
        description: 'Your personal data has been downloaded as a JSON file.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Data export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingData(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE MY ACCOUNT') {
      toast({
        title: 'Confirmation required',
        description: "Please type 'DELETE MY ACCOUNT' to confirm.",
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingDeletion(true);
    try {
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'User requested deletion via account settings',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to request account deletion');
      }

      toast({
        title: 'Deletion requested',
        description: result.message,
        variant: 'success',
      });

      setShowDeleteConfirmation(false);
      setDeleteConfirmText('');

      if (result.deletionType === 'immediate') {
        try {
          await signOut();
        } catch (signOutError) {
          console.error('Sign out error after deletion:', signOutError);
          // User is deleted but sign-out failed - they'll be signed out on next page load
        }
      }
    } catch (error) {
      console.error('Account deletion error:', error);
      toast({
        title: 'Deletion failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to request account deletion. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Data Export */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Export Your Data</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Download all your personal data in JSON format (GDPR Article 20)
            </p>
          </div>
          <Button variant="outline" onClick={handleDataExport} disabled={isExportingData}>
            {isExportingData ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </div>

        {/* Account Deletion */}
        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <h3 className="font-medium text-red-700">Delete Account</h3>
            </div>
            <p className="text-sm text-red-600/80 mt-1">
              Permanently delete your account and all associated data (GDPR Article 17)
            </p>
          </div>
          <Button variant="destructive" onClick={() => setShowDeleteConfirmation(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Your rights under GDPR:</strong> You have the right to access, rectify, and
            delete your personal data. When you request deletion, your account will enter a 30-day
            grace period during which you can cancel the request. After 30 days, your data will be
            permanently deleted. Some data may be retained for legal compliance.
          </p>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="space-y-4">
              <p>
                This action will permanently delete your account and all associated data after a
                30-day grace period.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                <strong>Warning:</strong> This includes all your:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Applications and job tracking data</li>
                  <li>Resumes and cover letters</li>
                  <li>Goals and projects</li>
                  <li>Networking contacts</li>
                  <li>AI coaching conversations</li>
                  <li>All other personal data</li>
                </ul>
              </div>
              <p>You can cancel this request anytime during the 30-day grace period.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <strong>DELETE MY ACCOUNT</strong> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmation(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleAccountDeletion}
              disabled={isRequestingDeletion || deleteConfirmText !== 'DELETE MY ACCOUNT'}
            >
              {isRequestingDeletion ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
