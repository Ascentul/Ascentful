'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';

export interface CustomFieldsSectionRef {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

export const CustomFieldsSection = forwardRef<CustomFieldsSectionRef, {}>((_, ref) => {
  const { user: clerkUser } = useUser();
  const [isSaving] = useState(false);

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : 'skip',
  );

  // No-op save since this section is display-only for now
  const handleSave = useCallback(async () => {
    // Custom fields would be managed by the organization
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      handleSave,
      isSaving,
    }),
    [handleSave, isSaving],
  );

  if (!convexUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user is affiliated with an organization (student role or has university_id)
  const isOrganizationUser =
    convexUser.role === 'student' ||
    convexUser.role === 'university_admin' ||
    convexUser.role === 'advisor' ||
    !!convexUser.university_id;

  if (!isOrganizationUser) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground text-center text-sm">
          This space is only for candidates working with an organization...
        </p>
      </div>
    );
  }

  // For organization users, show custom fields (placeholder for now)
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Custom Fields</h3>
        <p className="text-sm text-muted-foreground">
          Custom fields defined by your organization will appear here
        </p>
      </div>

      <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
        <p className="text-muted-foreground">
          No custom fields have been configured by your organization yet.
        </p>
      </div>
    </div>
  );
});

CustomFieldsSection.displayName = 'CustomFieldsSection';
