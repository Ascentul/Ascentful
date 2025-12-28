'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import type { FontCategory, FontPairingId } from '../../templates/types';
import {
  FONT_CATEGORIES,
  FONT_PAIRINGS,
  getFontPairingsByCategory,
  getGoogleFontsUrl,
} from '../../templates/types';

interface FontPairingPickerProps {
  value: FontPairingId;
  onChange: (fontPairing: FontPairingId) => void;
}

// Hook to dynamically load Google Fonts
function useGoogleFont(fontPairingId: FontPairingId) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const url = getGoogleFontsUrl(fontPairingId);
    if (!url) {
      setLoaded(true);
      return;
    }

    // Check if already loaded
    const existingLink = document.querySelector(`link[href="${url}"]`);
    if (existingLink) {
      setLoaded(true);
      return;
    }

    // Create and append link element
    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    link.onload = () => setLoaded(true);
    link.onerror = () => setLoaded(true); // Fall back gracefully on error
    document.head.appendChild(link);

    return () => {
      // Don't remove - keep fonts cached for performance
    };
  }, [fontPairingId]);

  return loaded;
}

// Font preview component
function FontPreview({
  pairingId,
  pairing,
  isSelected,
  onSelect,
}: {
  pairingId: FontPairingId;
  pairing: (typeof FONT_PAIRINGS)[FontPairingId];
  isSelected: boolean;
  onSelect: () => void;
}) {
  // Load the font when this option becomes visible
  useGoogleFont(pairingId);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left group',
        'hover:border-primary-300 hover:shadow-sm',
        isSelected
          ? 'border-primary-500 bg-primary-50/50 shadow-sm'
          : 'border-slate-200 bg-white hover:bg-slate-50/50',
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors flex-shrink-0',
          isSelected
            ? 'bg-primary-500 border-primary-500'
            : 'bg-white border-slate-300 group-hover:border-slate-400',
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>

      {/* Font preview */}
      <div className="flex-1 min-w-0">
        <div
          className="text-base font-semibold text-slate-900 truncate"
          style={{ fontFamily: pairing.heading }}
        >
          {pairing.label}
        </div>
        <div className="text-xs text-slate-500 truncate" style={{ fontFamily: pairing.body }}>
          {pairing.description}
        </div>
      </div>

      {/* Live preview text */}
      <div className="hidden sm:block text-right flex-shrink-0">
        <div
          className="text-sm font-semibold text-slate-700"
          style={{ fontFamily: pairing.heading }}
        >
          Aa
        </div>
        <div className="text-xs text-slate-400" style={{ fontFamily: pairing.body }}>
          Bb
        </div>
      </div>
    </button>
  );
}

// Category section component
function CategorySection({
  category,
  fonts,
  selectedValue,
  onSelect,
  isExpanded,
  onToggle,
}: {
  category: FontCategory;
  fonts: { id: FontPairingId; pairing: (typeof FONT_PAIRINGS)[FontPairingId] }[];
  selectedValue: FontPairingId;
  onSelect: (id: FontPairingId) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryMeta = FONT_CATEGORIES[category];
  const hasSelectedFont = fonts.some((f) => f.id === selectedValue);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Category header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          'hover:bg-slate-50',
          isExpanded && 'bg-slate-50/50',
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{categoryMeta.label}</span>
            {hasSelectedFont && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                Selected
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">{categoryMeta.description}</div>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-slate-400 transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          <div className="pt-3">
            {fonts.map(({ id, pairing }) => (
              <div key={id} className="mb-2 last:mb-0">
                <FontPreview
                  pairingId={id}
                  pairing={pairing}
                  isSelected={selectedValue === id}
                  onSelect={() => onSelect(id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FontPairingPicker({ value, onChange }: FontPairingPickerProps) {
  const groupedFonts = getFontPairingsByCategory();
  const categoryOrder: FontCategory[] = ['professional', 'modern', 'creative', 'classic'];

  // Find which category contains the selected font
  const selectedCategory = FONT_PAIRINGS[value]?.category || 'professional';

  // Track expanded categories - default to showing the one with selected font
  const [expandedCategories, setExpandedCategories] = useState<Set<FontCategory>>(
    new Set([selectedCategory]),
  );

  // Load the currently selected font
  useGoogleFont(value);

  const toggleCategory = (category: FontCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSelect = (id: FontPairingId) => {
    onChange(id);
    // Expand the category of the newly selected font
    const newCategory = FONT_PAIRINGS[id]?.category;
    if (newCategory && !expandedCategories.has(newCategory)) {
      setExpandedCategories((prev) => new Set([...prev, newCategory]));
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Typography</h3>
        <p className="text-xs text-slate-500 mt-0.5">Choose a font pairing for your resume</p>
      </div>

      {/* Current selection preview */}
      {FONT_PAIRINGS[value] && (
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Current font</div>
          <div
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: FONT_PAIRINGS[value].heading }}
          >
            {FONT_PAIRINGS[value].label}
          </div>
          <div
            className="text-sm text-slate-600 mt-1"
            style={{ fontFamily: FONT_PAIRINGS[value].body }}
          >
            The quick brown fox jumps over the lazy dog
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-2">
        {categoryOrder.map((category) => (
          <CategorySection
            key={category}
            category={category}
            fonts={groupedFonts[category]}
            selectedValue={value}
            onSelect={handleSelect}
            isExpanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
          />
        ))}
      </div>
    </div>
  );
}
