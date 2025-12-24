'use client';

import { ChevronDown, User } from 'lucide-react';
import Image from 'next/image';
import React, { useRef, useState } from 'react';

import type { ContactInfo } from '@/components/resume/ResumeDocument';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PersonalDetailsStepProps {
  contactInfo: ContactInfo;
  jobTarget?: string;
  onContactInfoChange: (field: keyof ContactInfo, value: string) => void;
  onJobTargetChange?: (value: string) => void;
}

export function PersonalDetailsStep({
  contactInfo,
  jobTarget = '',
  onContactInfoChange,
  onJobTargetChange,
}: PersonalDetailsStepProps) {
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Split name into first and last for display
  const nameParts = contactInfo.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const handleNameChange = (first: string, last: string) => {
    const fullName = `${first} ${last}`.trim();
    onContactInfoChange('name', fullName);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const maxSize = 5 * 1024 * 1024;
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }
    if (file.size > maxSize) {
      toast({
        title: 'Image too large',
        description: 'Image must be less than 5MB.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onContactInfoChange('photoUrl', reader.result);
      }
    };
    reader.onerror = () => {
      toast({
        title: 'Upload failed',
        description: 'Failed to read the image file.',
        variant: 'destructive',
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Personal details</h2>
        <p className="text-sm text-slate-500 mt-1">
          Users who added phone number and email received 64% more positive feedback from
          recruiters.
        </p>
      </div>

      {/* Job Target */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="jobTarget">Job Target</Label>
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
            +10%
          </span>
        </div>
        <Input
          id="jobTarget"
          placeholder="The role you want"
          value={jobTarget}
          onChange={(e) => onJobTargetChange?.(e.target.value)}
          className="bg-slate-50"
        />
      </div>

      {/* Photo upload placeholder */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
          {contactInfo.photoUrl ? (
            <Image
              src={contactInfo.photoUrl}
              alt="Profile"
              width={64}
              height={64}
              className="object-cover rounded-lg"
              unoptimized
            />
          ) : (
            <User className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="text-sm text-primary-500 hover:text-primary-600 font-medium"
        >
          Upload photo
        </button>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            placeholder="John"
            value={firstName}
            onChange={(e) => handleNameChange(e.target.value, lastName)}
            className="bg-slate-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => handleNameChange(firstName, e.target.value)}
            className="bg-slate-50"
          />
        </div>
      </div>

      {/* Email and Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={contactInfo.email}
            onChange={(e) => onContactInfoChange('email', e.target.value)}
            className="bg-slate-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={contactInfo.phone}
            onChange={(e) => onContactInfoChange('phone', e.target.value)}
            className="bg-slate-50"
          />
        </div>
      </div>

      {/* LinkedIn and Postal Code */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="linkedin">LinkedIn URL</Label>
          <Input
            id="linkedin"
            placeholder="linkedin.com/in/yourprofile"
            value={contactInfo.linkedin || ''}
            onChange={(e) => onContactInfoChange('linkedin', e.target.value)}
            className="bg-slate-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input
            id="postalCode"
            placeholder="12345"
            value={contactInfo.postalCode || ''}
            onChange={(e) => onContactInfoChange('postalCode', e.target.value)}
            className="bg-slate-50"
          />
        </div>
      </div>

      {/* City/State and Country */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">City, State</Label>
          <Input
            id="location"
            placeholder="New York, NY"
            value={contactInfo.location}
            onChange={(e) => onContactInfoChange('location', e.target.value)}
            className="bg-slate-50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            placeholder="United States"
            value={contactInfo.country || ''}
            onChange={(e) => onContactInfoChange('country', e.target.value)}
            className="bg-slate-50"
          />
          <p className="text-xs text-slate-400">Enter your country of residence</p>
        </div>
      </div>

      {/* Add more details toggle */}
      <button
        type="button"
        onClick={() => setShowMoreDetails(!showMoreDetails)}
        className="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium"
      >
        Add more details
        <ChevronDown
          className={`w-4 h-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Additional fields (collapsible) */}
      {showMoreDetails && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="github">GitHub URL</Label>
              <Input
                id="github"
                placeholder="github.com/username"
                value={contactInfo.github || ''}
                onChange={(e) => onContactInfoChange('github', e.target.value)}
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="yourwebsite.com"
                value={contactInfo.website || ''}
                onChange={(e) => onContactInfoChange('website', e.target.value)}
                className="bg-slate-50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
