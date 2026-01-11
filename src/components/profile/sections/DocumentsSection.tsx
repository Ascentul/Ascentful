'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { FileText, Link as LinkIcon, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

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
import { useToast } from '@/hooks/use-toast';

export interface DocumentsSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface ProfileDocument {
  id: string;
  type: 'upload' | 'link';
  title: string;
  url?: string;
  storage_id?: Id<'_storage'>;
  file_name?: string;
  uploaded_at?: number;
}

interface ProfileResume {
  id: string;
  type: 'upload' | 'link';
  title?: string;
  url?: string;
  storage_id?: Id<'_storage'>;
  file_name?: string;
  uploaded_at?: number;
}

export const DocumentsSection = forwardRef<DocumentsSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // State
  const [profileResume, setProfileResume] = useState<ProfileResume | null>(null);
  const [profileDocuments, setProfileDocuments] = useState<ProfileDocument[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkDialogType, setLinkDialogType] = useState<'resume' | 'document'>('resume');
  const [formLinkTitle, setFormLinkTitle] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');

  // File input refs
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const documentFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      setProfileResume(convexUser.profile_resume || null);
      setProfileDocuments(convexUser.profile_documents || []);
    }
  }, [convexUser]);

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          profile_resume: profileResume || undefined,
          profile_documents: profileDocuments.length > 0 ? profileDocuments : undefined,
        },
      });

      toast({
        title: 'Documents updated',
        description: 'Your documents have been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update documents:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update documents. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [clerkUser?.id, profileResume, profileDocuments, updateUserMutation, toast]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  // Open link dialog
  const openLinkDialog = (type: 'resume' | 'document') => {
    setLinkDialogType(type);
    setFormLinkTitle('');
    setFormLinkUrl('');
    setIsLinkDialogOpen(true);
  };

  // Handle adding a linked document
  const handleAddLink = async () => {
    if (!formLinkUrl.trim()) return;

    const url = formLinkUrl.trim().startsWith('http')
      ? formLinkUrl.trim()
      : `https://${formLinkUrl.trim()}`;
    const title = formLinkTitle.trim();
    const type = linkDialogType;
    const timestamp = Date.now();

    // Generate IDs once to ensure consistency between local state and server
    const newResumeData: ProfileResume | null =
      type === 'resume'
        ? {
            id: `resume_${crypto.randomUUID()}`,
            type: 'link',
            title: title || 'Resume',
            url,
            uploaded_at: timestamp,
          }
        : null;

    const newDocData: ProfileDocument | null =
      type === 'document'
        ? {
            id: `doc_${crypto.randomUUID()}`,
            type: 'link',
            title: title || 'Document',
            url,
            uploaded_at: timestamp,
          }
        : null;

    if (newResumeData) {
      setProfileResume(newResumeData);
    } else if (newDocData) {
      setProfileDocuments([...profileDocuments, newDocData]);
    }

    setIsLinkDialogOpen(false);
    setFormLinkTitle('');
    setFormLinkUrl('');

    // Auto-save
    if (clerkUser?.id) {
      try {
        const updatedResume = newResumeData || profileResume;
        const updatedDocs = newDocData ? [...profileDocuments, newDocData] : profileDocuments;

        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            profile_resume: updatedResume || undefined,
            profile_documents: updatedDocs.length > 0 ? updatedDocs : undefined,
          },
        });

        toast({
          title: type === 'resume' ? 'Resume linked' : 'Document linked',
          description: 'Your link has been saved',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to save link:', error);
        toast({
          title: 'Save failed',
          description: 'Failed to save. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle file upload click
  const handleUploadClick = (type: 'resume' | 'document') => {
    if (type === 'resume') {
      resumeFileInputRef.current?.click();
    } else {
      documentFileInputRef.current?.click();
    }
  };

  // Handle file selection (placeholder - would need storage upload implementation)
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'resume' | 'document',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For now, show a toast that file upload is coming soon
    // In a full implementation, this would upload to Convex storage
    toast({
      title: 'File upload coming soon',
      description: 'For now, please use the "Link Document" option to add a URL to your document.',
      variant: 'default',
    });

    // Reset the input
    event.target.value = '';
  };

  // Remove resume
  const handleRemoveResume = async () => {
    setProfileResume(null);

    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            profile_resume: undefined,
            profile_documents: profileDocuments.length > 0 ? profileDocuments : undefined,
          },
        });
        toast({
          title: 'Resume removed',
          description: 'Your resume has been removed',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to remove resume:', error);
      }
    }
  };

  // Remove document
  const handleRemoveDocument = async (id: string) => {
    const updatedDocs = profileDocuments.filter((doc) => doc.id !== id);
    setProfileDocuments(updatedDocs);

    if (clerkUser?.id) {
      try {
        await updateUserMutation({
          clerkId: clerkUser.id,
          updates: {
            profile_resume: profileResume || undefined,
            profile_documents: updatedDocs.length > 0 ? updatedDocs : undefined,
          },
        });
        toast({
          title: 'Document removed',
          description: 'The document has been removed',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to remove document:', error);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Resume Column */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Resume</h3>

          {profileResume ? (
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {profileResume.type === 'link' ? (
                      <LinkIcon className="h-5 w-5 text-slate-400" />
                    ) : (
                      <FileText className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {profileResume.title || profileResume.file_name || 'Resume'}
                    </p>
                    {profileResume.url && (
                      <a
                        href={profileResume.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {profileResume.url}
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleRemoveResume}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Button */}
              <button
                onClick={() => handleUploadClick('resume')}
                className="w-full border-2 border-dashed border-[#5371FF] rounded-xl p-4 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-5 w-5 text-[#5371FF]" />
              </button>

              <p className="text-center text-sm text-slate-500">or</p>

              {/* Link Document Button */}
              <button
                onClick={() => openLinkDialog('resume')}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Link Document
              </button>
            </>
          )}

          {/* Hidden file input */}
          <input
            ref={resumeFileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'resume')}
          />
        </div>

        {/* All Documents Column */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">All Documents</h3>

          {/* Upload Button */}
          <button
            onClick={() => handleUploadClick('document')}
            className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-5 w-5 text-slate-400" />
          </button>

          <p className="text-center text-sm text-slate-500">or</p>

          {/* Link Document Button */}
          <button
            onClick={() => openLinkDialog('document')}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Link Document
          </button>

          {/* Documents List */}
          {profileDocuments.length > 0 && (
            <div className="space-y-3 mt-4">
              {profileDocuments.map((doc) => (
                <div key={doc.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {doc.type === 'link' ? (
                          <LinkIcon className="h-5 w-5 text-slate-400" />
                        ) : (
                          <FileText className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {doc.title || doc.file_name}
                        </p>
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline truncate block"
                          >
                            {doc.url}
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={documentFileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'document')}
          />
        </div>
      </div>

      {/* Link Document Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link {linkDialogType === 'resume' ? 'Resume' : 'Document'}</DialogTitle>
            <DialogDescription>
              Add a link to your {linkDialogType === 'resume' ? 'resume' : 'document'} (Google
              Drive, Dropbox, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc_title">Title</Label>
              <Input
                id="doc_title"
                value={formLinkTitle}
                onChange={(e) => setFormLinkTitle(e.target.value)}
                placeholder={
                  linkDialogType === 'resume'
                    ? 'My Resume'
                    : 'e.g., Portfolio, Cover Letter Template'
                }
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc_url">Document URL *</Label>
              <Input
                id="doc_url"
                value={formLinkUrl}
                onChange={(e) => setFormLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="rounded-control"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLinkDialogOpen(false)}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLink}
              disabled={!formLinkUrl.trim()}
              className="rounded-control bg-[#5371FF] hover:bg-[#4361EE] text-white"
            >
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

DocumentsSection.displayName = 'DocumentsSection';
