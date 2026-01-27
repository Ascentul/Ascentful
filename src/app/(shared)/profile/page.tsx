'use client';

import { SharedProfileLayout } from '@/components/profile/SharedProfileLayout';

export default function ProfilePage() {
  return (
    <div className="w-full max-w-full lg:max-w-[75%] mx-auto px-4 lg:px-0">
      <div className="w-full rounded-3xl bg-white p-5 space-y-6">
        <SharedProfileLayout pageDescription="Manage your profile information" />
      </div>
    </div>
  );
}
