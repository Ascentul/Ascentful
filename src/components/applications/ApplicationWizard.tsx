'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type WizardJob = {
  title: string;
  company: string;
  url?: string;
};

export function ApplicationWizard({
  open,
  onOpenChange,
  job,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: WizardJob | null;
  onCreated?: (id: string) => void;
}) {
  const { user } = useUser();
  const router = useRouter();
  const clerkId = user?.id;

  const resumes = useQuery(api.resumes.getUserResumes, clerkId ? { clerkId } : 'skip');
  const coverLetters = useQuery(
    api.cover_letters.getUserCoverLetters,
    clerkId ? { clerkId } : 'skip',
  );

  const createApp = useMutation(api.applications.createApplication);
  const updateApp = useMutation(api.applications.updateApplication);

  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState('');
  const [resumeId, setResumeId] = useState<string>('none');
  const [coverId, setCoverId] = useState<string>('none');
  const [markApplied, setMarkApplied] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setNotes('');
      setResumeId('none');
      setCoverId('none');
      setMarkApplied(true);
    }
  }, [open]);

  if (!job) return null;

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    if (!clerkId) return;
    setSubmitting(true);
    try {
      const createdId = await createApp({
        company: job.company,
        job_title: job.title,
        status: markApplied ? ('applied' as const) : ('saved' as const),
        url: job.url,
        notes: notes || undefined,
        applied_at: markApplied ? Date.now() : undefined,
        resume_id: resumeId !== 'none' ? (resumeId as any) : undefined,
        cover_letter_id: coverId !== 'none' ? (coverId as any) : undefined,
      });

      onCreated?.(String(createdId));
      onOpenChange(false);
      router.push('/applications');
    } catch (error) {
      console.error('Failed to create application:', error);
      alert('Failed to create application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Application</DialogTitle>
          <DialogDescription>
            {job.title} at {job.company}
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs mb-3">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`px-2 py-1 rounded ${s === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
            >
              Step {s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label>Job Title</Label>
              <Input value={job.title} readOnly />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={job.company} readOnly />
            </div>
            {job.url && (
              <div>
                <Label>Posting URL</Label>
                <Input value={job.url} readOnly />
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for this application"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Select Resume</Label>
            <Select value={resumeId} onValueChange={(v) => setResumeId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a resume" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(resumes || []).map((r: any) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Select Cover Letter</Label>
            <Select value={coverId} onValueChange={(v) => setCoverId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a cover letter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(coverLetters || []).map((c: any) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="text-sm break-words overflow-hidden">
              <div>
                <strong>Job:</strong> {job.title}
              </div>
              <div>
                <strong>Company:</strong> {job.company}
              </div>
              {job.url ? (
                <div>
                  <strong>URL:</strong> <span className="break-all">{job.url}</span>
                </div>
              ) : null}
              {resumeId ? (
                <div>
                  <strong>Resume:</strong> Selected
                </div>
              ) : (
                <div>
                  <strong>Resume:</strong> None
                </div>
              )}
              {coverId ? (
                <div>
                  <strong>Cover Letter:</strong> Selected
                </div>
              ) : (
                <div>
                  <strong>Cover Letter:</strong> None
                </div>
              )}
              {notes ? (
                <div>
                  <strong>Notes:</strong> {notes}
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={markApplied}
                onChange={(e) => setMarkApplied(e.target.checked)}
              />
              Mark as applied now
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={prev}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step < 4 ? (
              <Button onClick={next}>Next</Button>
            ) : (
              <Button onClick={finish} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Application'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
