'use client';

import { Building2, Calendar, Globe, Loader2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/date-utils';

import type { JobResult } from './types';

interface JobResultCardProps {
  job: JobResult;
  onQuickAdd: (job: JobResult) => Promise<void>;
}

export function JobResultCard({ job, onQuickAdd }: JobResultCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const handleQuickAdd = async () => {
    if (isAdding || isAdded) return;
    setIsAdding(true);
    try {
      await onQuickAdd(job);
      setIsAdded(true);
    } catch {
      // Error handled by parent via toast
    } finally {
      setIsAdding(false);
    }
  };

  const isRemote = job.location?.toLowerCase().includes('remote');
  const postedText = formatRelativeDate(job.posted);

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-slate-300 hover:shadow-sm transition-all duration-150">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>

          {/* Company & Location */}
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1 truncate">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              {job.company}
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {job.location || 'Location not specified'}
            </span>
          </div>

          {/* Posted Date */}
          {postedText && (
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <Calendar className="h-3 w-3" />
              {postedText}
            </div>
          )}

          {/* Description */}
          {job.description && job.description !== '—' && (
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">{job.description}</p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {isRemote && (
              <Badge className="bg-blue-100 text-blue-700 border-transparent hover:bg-blue-100">
                <Globe className="h-3 w-3 mr-1" />
                Remote
              </Badge>
            )}
            {job.type && job.type !== '—' && (
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                {job.type}
              </Badge>
            )}
            {job.experience && job.experience !== '—' && (
              <Badge className="bg-purple-100 text-purple-700 border-transparent hover:bg-purple-100">
                {job.experience}
              </Badge>
            )}
            {job.salary && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {job.salary}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 sm:items-end">
          <Button
            size="sm"
            onClick={handleQuickAdd}
            disabled={isAdding || isAdded}
            className={
              isAdded
                ? 'bg-green-500 hover:bg-green-500 cursor-default'
                : 'bg-primary-500 hover:bg-primary-700'
            }
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Adding...
              </>
            ) : isAdded ? (
              'Added'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                Apply and Track
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
