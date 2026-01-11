'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation } from 'convex/react';
import { Camera, Loader2 } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/ClerkAuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';

export function ProfileSettingsSection() {
  const { user: clerkUser } = useUser();
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadAvatar, isUploading: isUploadingImage } = useAvatarUpload();

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    company: '',
    location: '',
    website: '',
    bio: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  const updateUserMutation = useMutation(api.users.updateUser);

  useEffect(() => {
    if (user && clerkUser && !isEditingProfile) {
      setProfileForm({
        name: user.name || clerkUser.fullName || '',
        email: user.email || clerkUser.emailAddresses?.[0]?.emailAddress || '',
        jobTitle: user.job_title || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        bio: user.bio || '',
      });
    }
  }, [user, clerkUser, isEditingProfile]);

  const handleImageUpload = async (file: File) => {
    if (!clerkUser?.id) return;
    await uploadAvatar(file, clerkUser.id);
  };

  const effectiveClerkId = clerkUser?.id || user?.clerkId;

  const handleSaveProfile = async () => {
    const urlPattern = /^https?:\/\/.+/i;
    if (profileForm.website && !urlPattern.test(profileForm.website)) {
      setProfileError('Please enter a valid URL');
      return;
    }
    if (profileForm.bio.length > 500) {
      setProfileError('Bio must be 500 characters or less');
      return;
    }
    setProfileError(null);
    if (effectiveClerkId) {
      setIsSavingProfile(true);
      try {
        await updateUserMutation({
          clerkId: effectiveClerkId,
          updates: {
            name: profileForm.name,
            bio: profileForm.bio,
            job_title: profileForm.jobTitle,
            company: profileForm.company,
            location: profileForm.location,
            website: profileForm.website,
          },
        });
        toast({
          title: 'Profile updated',
          description: 'Your profile has been updated successfully.',
          variant: 'success',
        });
        setIsEditingProfile(false);
      } catch (error) {
        console.error('Profile update error:', error);
        toast({
          title: 'Error',
          description: 'Failed to update profile. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSavingProfile(false);
      }
    } else {
      toast({
        title: 'Error',
        description: 'Unable to save profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileError(null);
    if (user && clerkUser) {
      setProfileForm({
        name: user.name || clerkUser.fullName || '',
        email: user.email || clerkUser.emailAddresses?.[0]?.emailAddress || '',
        jobTitle: user.job_title || '',
        company: user.company || '',
        location: user.location || '',
        website: user.website || '',
        bio: user.bio || '',
      });
    }
  };

  if (!clerkUser && !effectiveClerkId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditingProfile(true)}
          aria-label="Edit Profile"
        >
          Edit Profile
        </Button>
      </div>

      {/* Profile Picture */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-gray-200">
            <AvatarImage
              src={
                user?.profile_image ||
                clerkUser?.imageUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || clerkUser?.firstName || 'User')}&background=0C29AB&color=fff`
              }
            />
            <AvatarFallback>
              {(user?.name || clerkUser?.firstName || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Profile Picture</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Update your profile picture across the app
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            id="profile-upload"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('profile-upload')?.click()}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Change Picture
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="space-y-3 border rounded-lg p-4">
        <div>
          <h4 className="font-medium">Profile Details</h4>
          <p className="text-sm text-muted-foreground">Update website and bio</p>
        </div>

        {isEditingProfile && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profileForm.email}
                readOnly
                aria-readonly="true"
              />
              <p className="text-xs text-muted-foreground">
                Sign-in email is managed by Clerk.{' '}
                <Button asChild variant="link" className="px-0 h-auto font-normal">
                  <Link href="/user">Change sign-in email in Clerk</Link>
                </Button>
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                placeholder="Your role"
                value={profileForm.jobTitle}
                onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Full name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                name="company"
                placeholder="Current company"
                value={profileForm.company}
                onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="City, Country"
                value={profileForm.location}
                onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                placeholder="https://example.com"
                value={profileForm.website}
                onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                placeholder="Tell us about yourself (max 500 characters)"
                value={profileForm.bio}
                maxLength={500}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setProfileForm({ ...profileForm, bio: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">{profileForm.bio.length}/500</p>
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button disabled={isSavingProfile} onClick={handleSaveProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}

        {!isEditingProfile && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium text-muted-foreground">Email:</span>{' '}
              {profileForm.email || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Name:</span>{' '}
              {profileForm.name || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Job Title:</span>{' '}
              {profileForm.jobTitle || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Company:</span>{' '}
              {profileForm.company || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Location:</span>{' '}
              {profileForm.location || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Website:</span>{' '}
              {profileForm.website || '-'}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Bio:</span>{' '}
              {profileForm.bio || '-'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
