'use client';

import type { ContactInfo } from '@/components/resume/ResumeDocument';
import { Input } from '@/components/ui/input';

interface ContactSectionProps {
  contactInfo: ContactInfo;
  onChange: (field: keyof ContactInfo, value: string) => void;
}

export function ContactSection({ contactInfo, onChange }: ContactSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Your contact information helps employers reach you.</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Full Name</label>
          <Input
            value={contactInfo.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="John Doe"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <Input
            type="email"
            value={contactInfo.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="john@example.com"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Phone</label>
          <Input
            value={contactInfo.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Location</label>
          <Input
            value={contactInfo.location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="San Francisco, CA"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">LinkedIn (optional)</label>
          <Input
            value={contactInfo.linkedin || ''}
            onChange={(e) => onChange('linkedin', e.target.value)}
            placeholder="linkedin.com/in/johndoe"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">GitHub (optional)</label>
          <Input
            value={contactInfo.github || ''}
            onChange={(e) => onChange('github', e.target.value)}
            placeholder="github.com/johndoe"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Website (optional)</label>
        <Input
          value={contactInfo.website || ''}
          onChange={(e) => onChange('website', e.target.value)}
          placeholder="johndoe.com"
          className="mt-1"
        />
      </div>
    </div>
  );
}
