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
          <label htmlFor="contact-name" className="text-sm font-medium text-slate-700">
            Full Name
          </label>
          <Input
            id="contact-name"
            value={contactInfo.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="John Doe"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <Input
            id="contact-email"
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
          <label htmlFor="contact-phone" className="text-sm font-medium text-slate-700">
            Phone
          </label>
          <Input
            id="contact-phone"
            value={contactInfo.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="contact-location" className="text-sm font-medium text-slate-700">
            Location
          </label>
          <Input
            id="contact-location"
            value={contactInfo.location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="San Francisco, CA"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-linkedin" className="text-sm font-medium text-slate-700">
            LinkedIn (optional)
          </label>
          <Input
            id="contact-linkedin"
            value={contactInfo.linkedin || ''}
            onChange={(e) => onChange('linkedin', e.target.value)}
            placeholder="linkedin.com/in/johndoe"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="contact-github" className="text-sm font-medium text-slate-700">
            GitHub (optional)
          </label>
          <Input
            id="contact-github"
            value={contactInfo.github || ''}
            onChange={(e) => onChange('github', e.target.value)}
            placeholder="github.com/johndoe"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-website" className="text-sm font-medium text-slate-700">
          Website (optional)
        </label>
        <Input
          id="contact-website"
          value={contactInfo.website || ''}
          onChange={(e) => onChange('website', e.target.value)}
          placeholder="johndoe.com"
          className="mt-1"
        />
      </div>
    </div>
  );
}
