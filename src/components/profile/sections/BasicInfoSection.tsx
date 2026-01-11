'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Camera, Loader2 } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import { EmailEntry, MultiEmailInput } from '../shared/MultiEmailInput';
import { MultiPhoneInput, PhoneEntry } from '../shared/MultiPhoneInput';
import { SkillsInput } from '../shared/SkillsInput';

export interface BasicInfoSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

export const BasicInfoSection = forwardRef<BasicInfoSectionRef, {}>((props, ref) => {
  const { user: clerkUser } = useUser();
  const { toast } = useToast();

  // Fetch user data from Convex
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  const updateUserMutation = useMutation(api.users.updateUser);
  const generateAvatarUploadUrl = useMutation(api.avatar.generateAvatarUploadUrl);
  const updateUserAvatar = useMutation(api.avatar.updateUserAvatar);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [username, setUsername] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [bio, setBio] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Initialize form from Convex data
  useEffect(() => {
    if (convexUser) {
      // Parse name into first and last
      const nameParts = (convexUser.name || '').split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');

      setHeadline(convexUser.headline || '');
      setCurrentLocation(convexUser.location || '');
      setUsername(convexUser.username || '');
      setBio(convexUser.bio || '');

      // Parse skills from comma-separated string
      const skillsArray = convexUser.skills
        ? convexUser.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      setSkills(skillsArray);

      // Initialize emails array
      if (convexUser.emails && convexUser.emails.length > 0) {
        setEmails(convexUser.emails);
      } else {
        // Default to primary email from Clerk
        setEmails([
          {
            email: convexUser.email || '',
            type: 'personal',
            isPrimary: true,
          },
        ]);
      }

      // Initialize phones array
      if (convexUser.phones && convexUser.phones.length > 0) {
        setPhones(convexUser.phones);
      } else if (convexUser.phone_number) {
        // Migrate legacy phone_number field
        setPhones([
          {
            phone: convexUser.phone_number,
            type: 'mobile',
            isPrimary: true,
          },
        ]);
      } else {
        setPhones([]);
      }
    }
  }, [convexUser]);

  const handleSave = async () => {
    if (!clerkUser?.id) return;

    setIsSaving(true);
    try {
      // Combine first and last name
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Convert skills array back to comma-separated string
      const skillsString = skills.join(', ');

      await updateUserMutation({
        clerkId: clerkUser.id,
        updates: {
          name: fullName,
          headline,
          location: currentLocation,
          username,
          skills: skillsString,
          emails,
          phones,
          bio,
        },
      });

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Expose save handler to parent via ref
  useImperativeHandle(ref, () => ({
    handleSave,
    isSaving,
  }));

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResult.ok) throw new Error('Failed to upload image');

      const { storageId } = await uploadResult.json();

      if (clerkUser?.id) {
        await updateUserAvatar({
          clerkId: clerkUser.id,
          storageId,
        });
        toast({
          title: 'Profile picture updated',
          description: 'Your profile picture has been updated successfully',
          variant: 'success',
        });
      }
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
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
      {/* Gradient Header with Profile Picture */}
      <div className="relative -mt-8 -mx-8 mb-8">
        {/* Gradient Background */}
        <div className="h-32 bg-gradient-to-r from-[#5371FF] via-[#7C3AED] to-[#EC4899] rounded-t-shell" />

        {/* Profile Picture overlapping gradient */}
        <div className="absolute left-8 -bottom-16 flex items-end gap-4">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
              <AvatarImage
                src={
                  convexUser.profile_image ||
                  clerkUser?.imageUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName || 'User')}&background=5371FF&color=fff`
                }
              />
              <AvatarFallback className="text-2xl">
                {firstName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Camera icon overlay on hover */}
            <input
              type="file"
              id="avatar-upload"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            <button
              onClick={() => document.getElementById('avatar-upload')?.click()}
              disabled={isUploadingImage}
              className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              {isUploadingImage ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Spacing for overlapping profile picture */}
      <div className="h-16" />

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Vincent"
            className="rounded-control"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="holm-drumgole"
            className="rounded-control"
          />
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Salesforce-certified consultant and experienced Account Engagement Administrator"
          className="rounded-control"
        />
      </div>

      {/* Current Location & Username */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentLocation">Current Location</Label>
          <Input
            id="currentLocation"
            value={currentLocation}
            onChange={(e) => setCurrentLocation(e.target.value)}
            placeholder="Chicago, IL"
            className="rounded-control"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vincent-holm-drumgole"
            className="rounded-control"
          />
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <Label>Skills</Label>
        <SkillsInput value={skills} onChange={setSkills} />
      </div>

      {/* Emails */}
      <div className="space-y-2">
        <Label>Emails</Label>
        <MultiEmailInput value={emails} onChange={setEmails} />
      </div>

      {/* Phones */}
      <div className="space-y-2">
        <Label>Phones</Label>
        <MultiPhoneInput value={phones} onChange={setPhones} />
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          rows={6}
          className="rounded-lg resize-none"
        />
        <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
      </div>
    </div>
  );
});

BasicInfoSection.displayName = 'BasicInfoSection';
