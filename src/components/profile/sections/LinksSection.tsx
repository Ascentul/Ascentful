'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Dribbble, Github, Linkedin, Loader2, Plus, Trash2, Twitter } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export interface LinksSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

interface CustomLink {
  id: string;
  title: string;
  url: string;
}

export const LinksSection = forwardRef<LinksSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);

  // Social media handles (just the username/handle part)
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [dribbbleHandle, setDribbbleHandle] = useState('');

  // Custom links
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state for adding custom links
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formLinkTitle, setFormLinkTitle] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');

  // Helper to extract handle from full URL
  const extractHandle = (url: string | undefined): string => {
    if (!url) return '';
    // If it's already just a handle (no /)
    if (!url.includes('/')) return url;
    // Extract everything after the last /
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      setLinkedinHandle(extractHandle(convexUser.linkedin_url));
      setGithubHandle(extractHandle(convexUser.github_url));
      setTwitterHandle(extractHandle(convexUser.twitter_url));
      setDribbbleHandle(extractHandle(convexUser.dribbble_url));
      setCustomLinks(convexUser.custom_links || []);
    }
  }, [convexUser]);

  // Build full URLs from handles
  const buildUrl = (handle: string, baseUrl: string): string | undefined => {
    if (!handle.trim()) return undefined;
    // Remove any existing URL prefix if user pasted full URL (handles www. prefix)
    const cleanHandle = handle.replace(/^https?:\/\/(www\.)?/, '').replace(baseUrl, '');
    return `https://${baseUrl}${cleanHandle}`;
  };

  const handleSave = useCallback(async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          linkedin_url: buildUrl(linkedinHandle, 'linkedin.com/in/'),
          github_url: buildUrl(githubHandle, 'github.com/'),
          twitter_url: buildUrl(twitterHandle, 'twitter.com/'),
          dribbble_url: buildUrl(dribbbleHandle, 'dribbble.com/'),
          custom_links: customLinks.length > 0 ? customLinks : undefined,
        },
      });

      toast({
        title: 'Links updated',
        description: 'Your links have been saved successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update links:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update links. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    clerkUser?.id,
    linkedinHandle,
    githubHandle,
    twitterHandle,
    dribbbleHandle,
    customLinks,
    updateUserMutation,
    toast,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  const openAddLinkDialog = () => {
    setFormLinkTitle('');
    setFormLinkUrl('');
    setIsDialogOpen(true);
  };

  const handleAddCustomLink = () => {
    if (!formLinkTitle.trim() || !formLinkUrl.trim()) return;

    const newLink: CustomLink = {
      id: `link_${crypto.randomUUID()}`,
      title: formLinkTitle.trim(),
      url: formLinkUrl.trim().startsWith('http')
        ? formLinkUrl.trim()
        : `https://${formLinkUrl.trim()}`,
    };

    setCustomLinks([...customLinks, newLink]);
    setIsDialogOpen(false);
    setFormLinkTitle('');
    setFormLinkUrl('');
  };

  const handleRemoveCustomLink = (id: string) => {
    setCustomLinks(customLinks.filter((link) => link.id !== id));
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
        {/* Social Media Handles */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Social Media Handles</h3>

          {/* LinkedIn */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-[#0A66C2] rounded flex items-center justify-center">
                <Linkedin className="h-4 w-4 text-white" />
              </div>
              <Label htmlFor="linkedin-handle" className="font-medium text-[#0A66C2]">
                LinkedIn
              </Label>
            </div>
            <div className="flex items-center">
              <span className="text-slate-500 text-sm" aria-hidden="true">
                linkedin.com/in/
              </span>
              <input
                id="linkedin-handle"
                type="text"
                value={linkedinHandle}
                onChange={(e) => setLinkedinHandle(e.target.value)}
                placeholder="enter-handle"
                className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* GitHub */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                <Github className="h-4 w-4 text-white" />
              </div>
              <Label htmlFor="github-handle" className="font-medium text-slate-900">
                GitHub
              </Label>
            </div>
            <div className="flex items-center">
              <span className="text-slate-500 text-sm" aria-hidden="true">
                github.com/
              </span>
              <input
                id="github-handle"
                type="text"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                placeholder="enter-handle"
                className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Twitter */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-[#1DA1F2] rounded flex items-center justify-center">
                <Twitter className="h-4 w-4 text-white" />
              </div>
              <Label htmlFor="twitter-handle" className="font-medium text-[#1DA1F2]">
                Twitter
              </Label>
            </div>
            <div className="flex items-center">
              <span className="text-slate-500 text-sm" aria-hidden="true">
                twitter.com/
              </span>
              <input
                id="twitter-handle"
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="enter-handle"
                className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Dribbble */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-[#EA4C89] rounded flex items-center justify-center">
                <Dribbble className="h-4 w-4 text-white" />
              </div>
              <Label htmlFor="dribbble-handle" className="font-medium text-[#EA4C89]">
                Dribbble
              </Label>
            </div>
            <div className="flex items-center">
              <span className="text-slate-500 text-sm" aria-hidden="true">
                dribbble.com/
              </span>
              <input
                id="dribbble-handle"
                type="text"
                value={dribbbleHandle}
                onChange={(e) => setDribbbleHandle(e.target.value)}
                placeholder="enter-handle"
                className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Other Links */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Other Links</h3>

          {/* Add Link Button */}
          <button
            onClick={openAddLinkDialog}
            aria-label="Add custom link"
            className="w-full border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-5 w-5 text-slate-400" />
          </button>

          {/* Custom Links List */}
          {customLinks.length > 0 && (
            <div className="space-y-3">
              {customLinks.map((link) => (
                <div
                  key={link.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{link.title}</p>
                    <p className="text-sm text-slate-500 truncate">{link.url}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveCustomLink(link.id)}
                    aria-label={`Remove ${link.title}`}
                    className="ml-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Link</DialogTitle>
            <DialogDescription>
              Add a custom link to your profile (portfolio, personal website, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link_title">Link Title</Label>
              <Input
                id="link_title"
                value={formLinkTitle}
                onChange={(e) => setFormLinkTitle(e.target.value)}
                placeholder="e.g., Portfolio, Personal Blog"
                className="rounded-control"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_url">URL</Label>
              <Input
                id="link_url"
                value={formLinkUrl}
                onChange={(e) => setFormLinkUrl(e.target.value)}
                placeholder="e.g., https://myportfolio.com"
                className="rounded-control"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-control"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomLink}
              disabled={!formLinkTitle.trim() || !formLinkUrl.trim()}
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

LinksSection.displayName = 'LinksSection';
