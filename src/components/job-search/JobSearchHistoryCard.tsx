'use client';

import { ArrowRight, Clock, MapPin, Search } from 'lucide-react';

import { formatRelativeDate } from '@/lib/date-utils';

import type { JobSearchHistoryItem } from './types';

interface JobSearchHistoryCardProps {
  item: JobSearchHistoryItem;
  onRerun: (item: JobSearchHistoryItem) => void;
}

export function JobSearchHistoryCard({ item, onRerun }: JobSearchHistoryCardProps) {
  const dateText = formatRelativeDate(item.created_at);

  return (
    <button
      type="button"
      onClick={() => onRerun(item)}
      className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-150 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-slate-100 p-2 mt-0.5">
          <Search className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <div className="font-medium text-slate-900">{item.keywords || 'All jobs'}</div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.location}
              </span>
            )}
            <span>{item.results_count?.toLocaleString() ?? 0} results</span>
            {dateText && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dateText}
              </span>
            )}
          </div>
          {/* Show filters if any */}
          {item.search_data && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.search_data.remoteOnly && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Remote
                </span>
              )}
              {item.search_data.jobType && item.search_data.jobType !== 'all' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {item.search_data.jobType}
                </span>
              )}
              {item.search_data.experience && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  {item.search_data.experience}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm text-primary-500 group-hover:text-primary-700 transition-colors">
        Search
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}
