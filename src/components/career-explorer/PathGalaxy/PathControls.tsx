'use client';

import { Filter, Layers, Maximize2, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PathControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onResetView: () => void;
  onFitView: () => void;
  filterMode: 'all' | 'main_path' | 'saved';
  onFilterChange: (mode: 'all' | 'main_path' | 'saved') => void;
  layoutMode: 'horizontal' | 'radial';
  onLayoutChange: (mode: 'horizontal' | 'radial') => void;
}

export function PathControls({
  zoom,
  onZoomChange,
  onResetView,
  onFitView,
  filterMode,
  onFilterChange,
  layoutMode,
  onLayoutChange,
}: PathControlsProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 0.25, 2));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 0.25, 0.5));
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between bg-white border rounded-lg p-2 shadow-sm">
        {/* Left: Zoom Controls */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <Slider
            value={[zoom * 100]}
            onValueChange={([v]) => onZoomChange(v / 100)}
            min={50}
            max={200}
            step={5}
            className="w-24"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <span className="text-xs text-neutral-500 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Center: View Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onResetView}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onFitView}>
                <Maximize2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-neutral-200 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={layoutMode === 'horizontal' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => onLayoutChange('horizontal')}
              >
                <Move className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Horizontal Layout</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={layoutMode === 'radial' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => onLayoutChange('radial')}
              >
                <Layers className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Radial Layout</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <Select value={filterMode} onValueChange={(v) => onFilterChange(v as typeof filterMode)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Paths</SelectItem>
              <SelectItem value="main_path">Main Path Only</SelectItem>
              <SelectItem value="saved">Saved Roles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </TooltipProvider>
  );
}
