'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

export function CohortosHeader() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <span className="text-base">🚧</span>
          <span className="font-medium">CohortOS Demo</span>
          <span className="text-amber-600">- Prototype Mode</span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-amber-100 rounded-md transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4 text-amber-600" />
        </button>
      </div>
    </div>
  );
}
