'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useQuery } from 'convex/react';
import { Calendar, Loader2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  ApplicationDetails,
  type DBApplication,
} from '@/components/applications/ApplicationDetails';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function InterviewsPage() {
  const { user, isLoaded } = useUser();
  const clerkId = user?.id;

  const apps = useQuery(
    api.applications.getApplicationsByStatus,
    clerkId ? { clerkId, status: 'interview' } : 'skip',
  ) as any[] | undefined;

  const mapped = useMemo<DBApplication[] | undefined>(() => {
    if (!apps) return undefined;
    return apps.map((d: any) => ({
      id: d._id,
      company: d.company ?? '',
      job_title: d.job_title ?? '',
      status: d.status ?? 'interview',
      url: d.url ?? null,
      notes: d.notes ?? null,
      created_at:
        typeof d.created_at === 'number' ? new Date(d.created_at).toISOString() : d.created_at,
      updated_at:
        typeof d.updated_at === 'number' ? new Date(d.updated_at).toISOString() : d.updated_at,
      resume_id: d.resume_id ?? null,
      cover_letter_id: d.cover_letter_id ?? null,
    }));
  }, [apps]);

  const [selected, setSelected] = useState<DBApplication | null>(null);
  const [open, setOpen] = useState(false);

  if (!isLoaded || mapped === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#0C29AB]">Interview Tracker</h1>
        <p className="text-muted-foreground">
          View and manage interviews across your applications.
        </p>
      </div>

      {mapped.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No applications are currently in the interviewing stage.
        </div>
      ) : (
        <div className="space-y-3">
          {mapped.map((a) => (
            <Card key={a.id} className="border">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {a.company || 'Company'} — {a.job_title || 'Untitled Role'}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      Updated{' '}
                      {a.updated_at
                        ? new Date(a.updated_at).toLocaleString()
                        : a.created_at
                          ? new Date(a.created_at).toLocaleString()
                          : '—'}
                    </span>
                  </div>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-block mt-1"
                    >
                      View posting
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelected(a);
                      setOpen(true);
                    }}
                  >
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <ApplicationDetails
          open={open}
          onOpenChange={setOpen}
          application={selected}
          onChanged={(updated) => {
            // Handle deletion case
            if (updated === null) {
              setSelected(null);
              setOpen(false);
              return;
            }
            // Update selected state for immediate UI feedback in the modal
            // The list will update via Convex query invalidation after mutation
            setSelected((prev) =>
              prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
            );
          }}
        />
      )}
    </div>
  );
}
