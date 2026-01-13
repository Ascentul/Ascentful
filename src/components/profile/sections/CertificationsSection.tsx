'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Award, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export interface CertificationsSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface Certification {
  id: string;
  name?: string;
  issuing_organization?: string;
  issue_date?: string;
  expiration_date?: string;
  credential_id?: string;
  credential_url?: string;
  does_not_expire?: boolean;
}

export const CertificationsSection = forwardRef<CertificationsSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // Form state
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCertification, setEditingCertification] = useState<Certification | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form fields for dialog
  const [formName, setFormName] = useState('');
  const [formIssuingOrg, setFormIssuingOrg] = useState('');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formCredentialId, setFormCredentialId] = useState('');
  const [formCredentialUrl, setFormCredentialUrl] = useState('');
  const [formDoesNotExpire, setFormDoesNotExpire] = useState(false);

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      setCertifications(convexUser.certifications || []);
    }
  }, [convexUser]);

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          certifications: certifications.length > 0 ? certifications : undefined,
        },
      });

      toast({
        title: 'Certifications updated',
        description: 'Your certifications have been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update certifications:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update certifications. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [clerkUser?.id, certifications, updateUserMutation, toast]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const resetForm = () => {
    setFormName('');
    setFormIssuingOrg('');
    setFormIssueDate('');
    setFormExpirationDate('');
    setFormCredentialId('');
    setFormCredentialUrl('');
    setFormDoesNotExpire(false);
    setEditingCertification(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (certification: Certification) => {
    setEditingCertification(certification);
    setFormName(certification.name || '');
    setFormIssuingOrg(certification.issuing_organization || '');
    setFormIssueDate(certification.issue_date || '');
    setFormExpirationDate(certification.expiration_date || '');
    setFormCredentialId(certification.credential_id || '');
    setFormCredentialUrl(certification.credential_url || '');
    setFormDoesNotExpire(certification.does_not_expire || false);
    setIsDialogOpen(true);
  };

  const handleSaveCertification = async () => {
    const previousCertifications = [...certifications];
    const newCertification: Certification = {
      id: editingCertification?.id || `cert_${crypto.randomUUID()}`,
      name: formName || undefined,
      issuing_organization: formIssuingOrg || undefined,
      issue_date: formIssueDate || undefined,
      expiration_date: formDoesNotExpire ? undefined : formExpirationDate || undefined,
      credential_id: formCredentialId || undefined,
      credential_url: formCredentialUrl || undefined,
      does_not_expire: formDoesNotExpire,
    };

    let updatedCertifications: Certification[];
    if (editingCertification) {
      // Update existing
      updatedCertifications = certifications.map((cert) =>
        cert.id === editingCertification.id ? newCertification : cert,
      );
    } else {
      // Add new
      updatedCertifications = [newCertification, ...certifications];
    }

    setCertifications(updatedCertifications);
    setIsDialogOpen(false);
    resetForm();

    // Auto-save after adding/editing
    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            certifications: updatedCertifications.length > 0 ? updatedCertifications : undefined,
          },
        });
        toast({
          title: 'Certification saved',
          description: editingCertification
            ? 'Your changes have been saved'
            : 'New certification added',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to save certification:', error);
        setCertifications(previousCertifications);
        toast({
          title: 'Save failed',
          description: 'Failed to save. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDeleteCertification = async (id: string) => {
    const previousCertifications = [...certifications];
    const updatedCertifications = certifications.filter((cert) => cert.id !== id);
    setCertifications(updatedCertifications);
    setDeleteConfirmId(null);

    // Auto-save after deleting
    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            certifications: updatedCertifications.length > 0 ? updatedCertifications : undefined,
          },
        });
        toast({
          title: 'Certification deleted',
          description: 'The certification has been removed',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to delete certification:', error);
        setCertifications(previousCertifications);
        toast({
          title: 'Delete failed',
          description: 'Failed to delete. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  if (!convexUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Certifications List */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Certifications</h3>
          <p className="text-sm text-muted-foreground">Add your certifications below</p>
        </div>

        {certifications.length > 0 && (
          <div className="space-y-3">
            {certifications.map((certification) => (
              <div
                key={certification.id}
                className="border border-slate-200 rounded-xl p-4 bg-white flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Award className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">
                      {certification.name || 'Certification Name'}
                    </h4>
                    {certification.issuing_organization && (
                      <p className="text-sm text-slate-500">{certification.issuing_organization}</p>
                    )}
                  </div>
                </div>

                {/* Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(certification)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmId(certification.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={openAddDialog}
          className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          aria-label="Add certification"
        >
          <Plus className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCertification ? 'Edit Certification' : 'Add Certification'}
            </DialogTitle>
            <DialogDescription>
              {editingCertification
                ? 'Update your certification details'
                : 'Add a new certification to your profile'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Certification Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., AWS Solutions Architect"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuing_org">Issuing Organization</Label>
              <Input
                id="issuing_org"
                value={formIssuingOrg}
                onChange={(e) => setFormIssuingOrg(e.target.value)}
                placeholder="e.g., Amazon Web Services"
                className="rounded-control"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  value={formIssueDate}
                  onChange={(e) => setFormIssueDate(e.target.value)}
                  placeholder="e.g., Jan, 2023"
                  className="rounded-control"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration_date">Expiration Date</Label>
                <Input
                  id="expiration_date"
                  value={formExpirationDate}
                  onChange={(e) => setFormExpirationDate(e.target.value)}
                  placeholder="e.g., Jan, 2026"
                  disabled={formDoesNotExpire}
                  className="rounded-control"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="does_not_expire"
                checked={formDoesNotExpire}
                onCheckedChange={setFormDoesNotExpire}
              />
              <Label htmlFor="does_not_expire">This certification does not expire</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential_id">Credential ID (Optional)</Label>
              <Input
                id="credential_id"
                value={formCredentialId}
                onChange={(e) => setFormCredentialId(e.target.value)}
                placeholder="e.g., ABC123XYZ"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credential_url">Credential URL (Optional)</Label>
              <Input
                id="credential_url"
                value={formCredentialUrl}
                onChange={(e) => setFormCredentialUrl(e.target.value)}
                placeholder="e.g., https://www.credly.com/badges/..."
                className="rounded-control"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCertification}
              disabled={!formName}
              className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white"
            >
              {editingCertification ? 'Save Changes' : 'Add Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Certification</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this certification? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteCertification(deleteConfirmId)}
              className="rounded-control"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

CertificationsSection.displayName = 'CertificationsSection';
