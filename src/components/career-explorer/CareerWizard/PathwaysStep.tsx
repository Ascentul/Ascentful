'use client';

import {
  Briefcase,
  Check,
  GraduationCap,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { PlacedStep, StartingRole } from '@/lib/career-explorer/types';

import { RoleHoverCard } from './RoleHoverCard';

interface NextRole {
  id: string;
  title: string;
  category: string;
  fit_score: number;
  reason: string;
  skills: string[];
  relationship: string;
}

interface PathwaysStepProps {
  startingRole: StartingRole;
  skillsHave: string[];
  skillsWant: string[];
  placedSteps: PlacedStep[];
  onPlaceStep: (step: PlacedStep) => void;
  onRemoveStep: (stepId: string) => void;
  onFinish: (steps: PlacedStep[]) => void;
  onBack?: () => void;
  showSaveButton?: boolean;
}

// Column role type with selection state
interface ColumnRole {
  id: string;
  title: string;
  category: string;
  fit_score: number;
  selected: boolean;
  relationship?: string;
}

// Line position type for curved paths
interface LinePosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Generate path between two points - straight when aligned, curved when not
function getCurvedPath(line: LinePosition): string {
  const { x1, y1, x2, y2 } = line;
  const yDiff = Math.abs(y2 - y1);

  // If Y coordinates are close (within 10px), draw a straight line
  if (yDiff < 10) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // For larger Y differences, use a smooth curve
  const midX = (x1 + x2) / 2;
  // Control points for smooth S-curve
  const cp1x = midX;
  const cp1y = y1;
  const cp2x = midX;
  const cp2y = y2;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

export function PathwaysStep({
  startingRole,
  skillsHave,
  skillsWant,
  placedSteps,
  onPlaceStep,
  onRemoveStep,
  onFinish,
  showSaveButton = true,
}: PathwaysStepProps) {
  // Determine if starting point is a student (major or internship)
  const isMajor = startingRole.category?.toLowerCase().includes('major');
  const isInternship = startingRole.category?.toLowerCase().includes('intern');
  const isStudent = isMajor || isInternship;

  // Column 1: Entry-level jobs (long list from starting point)
  const [col1Roles, setCol1Roles] = useState<ColumnRole[]>([]);
  const [isLoadingCol1, setIsLoadingCol1] = useState(true);

  // Helper to create initial selection from placedSteps
  const getInitialRole = (index: number): ColumnRole | null => {
    if (placedSteps.length > index) {
      const step = placedSteps[index];
      return {
        id: step.id,
        title: step.title,
        category: '',
        fit_score: step.fit_score || 75,
        selected: true,
      };
    }
    return null;
  };

  // Column 2: Related/Alternative paths (based on col1 selection)
  const [col2Roles, setCol2Roles] = useState<ColumnRole[]>([]);
  const [isLoadingCol2, setIsLoadingCol2] = useState(false);
  const [selectedCol1Role, setSelectedCol1Role] = useState<ColumnRole | null>(() =>
    getInitialRole(0),
  );

  // Column 3: Growth opportunities (based on col2 selection)
  const [col3Roles, setCol3Roles] = useState<ColumnRole[]>([]);
  const [isLoadingCol3, setIsLoadingCol3] = useState(false);
  const [selectedCol2Role, setSelectedCol2Role] = useState<ColumnRole | null>(() =>
    getInitialRole(1),
  );
  const [selectedCol3Role, setSelectedCol3Role] = useState<ColumnRole | null>(() =>
    getInitialRole(2),
  );

  // Column 4: Extended path (based on col3 selection)
  const [col4Roles, setCol4Roles] = useState<ColumnRole[]>([]);
  const [isLoadingCol4, setIsLoadingCol4] = useState(false);
  const [showCol4, setShowCol4] = useState(() => placedSteps.length >= 4);
  const [selectedCol4Role, setSelectedCol4Role] = useState<ColumnRole | null>(() =>
    getInitialRole(3),
  );

  // Hover states for connector lines
  const [hoveredCol1Role, setHoveredCol1Role] = useState<string | null>(null);
  const [hoveredCol2Role, setHoveredCol2Role] = useState<string | null>(null);
  const [hoveredCol3Role, setHoveredCol3Role] = useState<string | null>(null);
  const [hoveredCol4Role, setHoveredCol4Role] = useState<string | null>(null);

  // Expanded state for editing columns (when clicking selected role to change it)
  const [expandedCol1, setExpandedCol1] = useState(false);
  const [expandedCol2, setExpandedCol2] = useState(false);
  const [expandedCol3, setExpandedCol3] = useState(false);
  const [expandedCol4, setExpandedCol4] = useState(false);

  // Line positions state
  const [line1, setLine1] = useState<LinePosition | null>(null);
  const [line2, setLine2] = useState<LinePosition | null>(null);
  const [line3, setLine3] = useState<LinePosition | null>(null);
  const [line4, setLine4] = useState<LinePosition | null>(null);

  // Refs for calculating connector positions
  const startingRef = useRef<HTMLDivElement>(null);
  const col1Refs = useRef<Map<string, HTMLElement>>(new Map());
  const col2Refs = useRef<Map<string, HTMLElement>>(new Map());
  const col3Refs = useRef<Map<string, HTMLElement>>(new Map());
  const col4Refs = useRef<Map<string, HTMLElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which roles are in the career path
  // Use a ref to avoid stale closure issues in fetch callbacks
  const selectedIds = new Set(placedSteps.map((s) => s.id));
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Track if we've done initial restoration from placedSteps
  const hasRestoredRef = useRef(false);

  // Track if user has manually edited (changed selection) - disables auto-restoration
  const userEditedRef = useRef(false);

  // Track the initial column count to maintain it during editing
  // If user started with 4 columns, we should keep 4 columns visible even when resetting
  const initialColumnCountRef = useRef(
    placedSteps.length >= 4 ? 4 : placedSteps.length >= 3 ? 3 : 0,
  );

  // Track if col4 was ever shown (to maintain column layout during editing)
  const hadCol4Ref = useRef(placedSteps.length >= 4);

  // Suggested role IDs per column (AI-recommended based on user data)
  const [suggestedCol1, setSuggestedCol1] = useState<string | null>(null);
  const [suggestedCol2, setSuggestedCol2] = useState<string | null>(null);
  const [suggestedCol3, setSuggestedCol3] = useState<string | null>(null);
  const [suggestedCol4, setSuggestedCol4] = useState<string | null>(null);

  // Fetch suggested role for a column based on user data
  const fetchSuggestedRole = useCallback(
    async (
      roles: ColumnRole[],
      column: 'entry_level' | 'lateral' | 'promotion' | 'internship',
      setSuggested: (id: string | null) => void,
    ) => {
      // Don't fetch if no roles or if a selection is already made
      if (roles.length === 0) return;

      // Build current path titles for context
      const currentPathTitles = [
        selectedCol1Role?.title,
        selectedCol2Role?.title,
        selectedCol3Role?.title,
        selectedCol4Role?.title,
      ].filter(Boolean) as string[];

      try {
        const response = await fetch('/api/career-explorer/suggested-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roles: roles.map((r) => ({
              id: r.id,
              title: r.title,
              category: r.category,
              fit_score: r.fit_score,
              relationship: r.relationship,
            })),
            column,
            currentPathTitles,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.suggestedRoleId && data.confidenceScore >= 40) {
            setSuggested(data.suggestedRoleId);
          } else {
            setSuggested(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch suggested role:', error);
        setSuggested(null);
      }
    },
    [selectedCol1Role, selectedCol2Role, selectedCol3Role, selectedCol4Role],
  );

  // Helper to get the vertical center of an element's content
  const getElementCenter = (rect: DOMRect, containerTop: number): number => {
    // Calculate the true center of the element
    // All nodes use p-3 padding (12px) and text-sm font, so height should be consistent
    return rect.top + rect.height / 2 - containerTop;
  };

  // Calculate line positions when hover/selection changes
  const updateLinePositions = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    // Get all selected element rects for alignment calculation
    const startRect = startingRef.current?.getBoundingClientRect() || null;
    const col1SelectedRect = selectedCol1Role
      ? col1Refs.current.get(selectedCol1Role.id)?.getBoundingClientRect() || null
      : null;
    const col2SelectedRect = selectedCol2Role
      ? col2Refs.current.get(selectedCol2Role.id)?.getBoundingClientRect() || null
      : null;
    const col3SelectedRect = selectedCol3Role
      ? col3Refs.current.get(selectedCol3Role.id)?.getBoundingClientRect() || null
      : null;
    const addButtonRect = addButtonRef.current?.getBoundingClientRect() || null;

    // When any selections are made, use the starting point's Y as the reference for straight lines
    // This ensures all selected nodes connect with straight horizontal lines
    const baseAlignedY = startRect ? getElementCenter(startRect, containerRect.top) : null;

    // Line 1: Starting point to Column 1 (hovered or selected)
    const activeCol1Id = selectedCol1Role?.id || hoveredCol1Role;
    if (activeCol1Id && startingRef.current && startRect) {
      const col1El = col1Refs.current.get(activeCol1Id);
      if (col1El) {
        const col1Rect = col1El.getBoundingClientRect();
        // For selected items, use the aligned Y; for hovered items, use actual positions
        const isSelected = selectedCol1Role?.id === activeCol1Id;
        const y1 = baseAlignedY!;
        const y2 = isSelected ? baseAlignedY! : getElementCenter(col1Rect, containerRect.top);
        setLine1({
          x1: startRect.right - containerRect.left,
          y1,
          x2: col1Rect.left - containerRect.left,
          y2,
        });
      }
    } else {
      setLine1(null);
    }

    // Line 2: Column 1 to Column 2 (hovered or selected)
    const activeCol2Id = selectedCol2Role?.id || hoveredCol2Role;
    if (selectedCol1Role && activeCol2Id && col1SelectedRect) {
      const col2El = col2Refs.current.get(activeCol2Id);
      if (col2El) {
        const col2Rect = col2El.getBoundingClientRect();
        // For selected items, use the aligned Y; for hovered items, use actual positions
        const isSelected = selectedCol2Role?.id === activeCol2Id;
        const y1 = baseAlignedY!;
        const y2 = isSelected ? baseAlignedY! : getElementCenter(col2Rect, containerRect.top);
        setLine2({
          x1: col1SelectedRect.right - containerRect.left,
          y1,
          x2: col2Rect.left - containerRect.left,
          y2,
        });
      }
    } else {
      setLine2(null);
    }

    // Line 3: Column 2 to Column 3 (hovered or selected)
    const activeCol3Id = selectedCol3Role?.id || hoveredCol3Role;
    if (selectedCol2Role && activeCol3Id && col2SelectedRect) {
      const col3El = col3Refs.current.get(activeCol3Id);
      if (col3El) {
        const col3Rect = col3El.getBoundingClientRect();
        // For selected items, use the aligned Y; for hovered items, use actual positions
        const isSelected = selectedCol3Role?.id === activeCol3Id;
        const y1 = baseAlignedY!;
        const y2 = isSelected ? baseAlignedY! : getElementCenter(col3Rect, containerRect.top);
        setLine3({
          x1: col2SelectedRect.right - containerRect.left,
          y1,
          x2: col3Rect.left - containerRect.left,
          y2,
        });
      }
    } else if (selectedCol2Role && col3Roles.length > 0 && !selectedCol3Role && col2SelectedRect) {
      // Show line to first item when no selection/hover
      const col3El = col3Refs.current.get(col3Roles[0]?.id);
      if (col3El) {
        const col3Rect = col3El.getBoundingClientRect();
        setLine3({
          x1: col2SelectedRect.right - containerRect.left,
          y1: baseAlignedY!,
          x2: col3Rect.left - containerRect.left,
          y2: getElementCenter(col3Rect, containerRect.top),
        });
      }
    } else {
      setLine3(null);
    }

    // Line 4: Column 3 to Column 4 (or Add button when path is complete)
    // Always use baseAlignedY for this line to ensure perfect horizontal alignment
    const activeCol4Id = selectedCol4Role?.id || hoveredCol4Role;

    if (selectedCol3Role && col3SelectedRect && baseAlignedY !== null) {
      // If showing col4 options and there's a hover or selection
      if (showCol4 && activeCol4Id) {
        const col4El = col4Refs.current.get(activeCol4Id);
        if (col4El) {
          const col4Rect = col4El.getBoundingClientRect();
          const isSelected = selectedCol4Role?.id === activeCol4Id;
          setLine4({
            x1: col3SelectedRect.right - containerRect.left,
            y1: baseAlignedY,
            x2: col4Rect.left - containerRect.left,
            y2: isSelected ? baseAlignedY : getElementCenter(col4Rect, containerRect.top),
          });
        }
      } else if (showCol4 && col4Roles.length > 0 && !selectedCol4Role) {
        // Show line to first col4 item when no selection/hover
        const col4El = col4Refs.current.get(col4Roles[0]?.id);
        if (col4El) {
          const col4Rect = col4El.getBoundingClientRect();
          setLine4({
            x1: col3SelectedRect.right - containerRect.left,
            y1: baseAlignedY,
            x2: col4Rect.left - containerRect.left,
            y2: getElementCenter(col4Rect, containerRect.top),
          });
        }
      } else if (!showCol4 && addButtonRef.current && addButtonRect) {
        // Show line to add button when col4 not expanded
        setLine4({
          x1: col3SelectedRect.right - containerRect.left,
          y1: baseAlignedY,
          x2: addButtonRect.left - containerRect.left,
          y2: baseAlignedY,
        });
      } else {
        setLine4(null);
      }
    } else {
      setLine4(null);
    }
  }, [
    selectedCol1Role,
    selectedCol2Role,
    selectedCol3Role,
    selectedCol4Role,
    hoveredCol1Role,
    hoveredCol2Role,
    hoveredCol3Role,
    hoveredCol4Role,
    col3Roles,
    col4Roles,
    showCol4,
  ]);

  // Update line positions after DOM updates
  useLayoutEffect(() => {
    updateLinePositions();
  }, [updateLinePositions, col1Roles, col2Roles, col3Roles, col4Roles]);

  // Also update on hover changes (with slight delay to ensure refs are set)
  useEffect(() => {
    const timer = setTimeout(updateLinePositions, 10);
    return () => clearTimeout(timer);
  }, [hoveredCol1Role, hoveredCol2Role, hoveredCol3Role, hoveredCol4Role, updateLinePositions]);

  // Fetch first column roles - internships for majors, entry-level for others
  const fetchCol1Roles = useCallback(async () => {
    setIsLoadingCol1(true);
    // For majors, first column is internships; for others, it's entry-level
    const columnType = isMajor ? 'internship' : 'entry_level';
    try {
      const response = await fetch('/api/career-explorer/next-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRole: startingRole.title,
          category: startingRole.category,
          skills_have: skillsHave,
          skills_want: skillsWant,
          count: 15,
          column: columnType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const roles: ColumnRole[] = (data.roles || []).map((role: NextRole) => ({
          id: role.id,
          title: role.title,
          category: role.category,
          fit_score: role.fit_score,
          selected: selectedIdsRef.current.has(role.id),
          relationship: role.relationship,
        }));

        setCol1Roles(roles.sort((a, b) => b.fit_score - a.fit_score));
      }
    } catch (error) {
      console.error('Column 1 fetch error:', error);
    } finally {
      setIsLoadingCol1(false);
    }
  }, [startingRole.title, startingRole.category, skillsHave, skillsWant, isMajor]);

  // Fetch second column roles - entry-level for majors (after internship), lateral for others
  // Note: We don't clear roles arrays to avoid loading spinners - just set loading state
  const fetchCol2Roles = useCallback(
    async (selectedRole: ColumnRole) => {
      setIsLoadingCol2(true);
      // For majors, second column is entry-level (after internship); for others, it's lateral moves
      const columnType = isMajor ? 'entry_level' : 'lateral';
      // Don't clear roles here - keep existing roles visible during fetch to avoid loading spinner
      // setCol2Roles([]);
      // setCol3Roles([]);
      // Selection clearing is handled in the cascade reset logic, not here

      try {
        const response = await fetch('/api/career-explorer/next-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentRole: selectedRole.title,
            category: selectedRole.category,
            skills_have: skillsHave,
            skills_want: skillsWant,
            count: 10,
            column: columnType,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const roles: ColumnRole[] = (data.roles || []).map((role: NextRole) => ({
            id: role.id,
            title: role.title,
            category: role.category,
            fit_score: role.fit_score,
            selected: selectedIdsRef.current.has(role.id),
            relationship: role.relationship,
          }));

          setCol2Roles(roles.sort((a, b) => b.fit_score - a.fit_score));
        }
      } catch (error) {
        console.error('Column 2 fetch error:', error);
      } finally {
        setIsLoadingCol2(false);
      }
    },
    [skillsHave, skillsWant, isMajor],
  );

  // Fetch growth/promotion roles (Column 3) - based on col2 selection
  // Note: We don't clear roles arrays to avoid loading spinners - just set loading state
  const fetchCol3Roles = useCallback(
    async (selectedRole: ColumnRole) => {
      setIsLoadingCol3(true);
      // Don't clear roles here - keep existing roles visible during fetch to avoid loading spinner
      // setCol3Roles([]);
      // Selection clearing is handled in the cascade reset logic, not here

      try {
        const response = await fetch('/api/career-explorer/next-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentRole: selectedRole.title,
            category: selectedRole.category,
            skills_have: skillsHave,
            skills_want: skillsWant,
            count: 10,
            column: 'promotion',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const roles: ColumnRole[] = (data.roles || []).map((role: NextRole) => ({
            id: role.id,
            title: role.title,
            category: role.category,
            fit_score: role.fit_score,
            selected: selectedIdsRef.current.has(role.id),
            relationship: role.relationship,
          }));

          setCol3Roles(roles.sort((a, b) => b.fit_score - a.fit_score));
        }
      } catch (error) {
        console.error('Column 3 fetch error:', error);
      } finally {
        setIsLoadingCol3(false);
      }
    },
    [skillsHave, skillsWant],
  );

  // Initial load - fetch column 1
  useEffect(() => {
    fetchCol1Roles();
  }, [fetchCol1Roles]);

  // Fetch suggested role for column 1 when roles are loaded (only if no selection)
  useEffect(() => {
    if (col1Roles.length > 0 && !selectedCol1Role && !isLoadingCol1) {
      const columnType = isMajor ? 'internship' : 'entry_level';
      fetchSuggestedRole(col1Roles, columnType, setSuggestedCol1);
    }
  }, [col1Roles, selectedCol1Role, isLoadingCol1, isMajor, fetchSuggestedRole]);

  // Fetch suggested role for column 2 when roles are loaded (only if no selection)
  useEffect(() => {
    if (col2Roles.length > 0 && !selectedCol2Role && !isLoadingCol2 && selectedCol1Role) {
      const columnType = isMajor ? 'entry_level' : 'lateral';
      fetchSuggestedRole(col2Roles, columnType, setSuggestedCol2);
    }
  }, [col2Roles, selectedCol2Role, isLoadingCol2, selectedCol1Role, isMajor, fetchSuggestedRole]);

  // Fetch suggested role for column 3 when roles are loaded (only if no selection)
  useEffect(() => {
    if (col3Roles.length > 0 && !selectedCol3Role && !isLoadingCol3 && selectedCol2Role) {
      fetchSuggestedRole(col3Roles, 'promotion', setSuggestedCol3);
    }
  }, [col3Roles, selectedCol3Role, isLoadingCol3, selectedCol2Role, fetchSuggestedRole]);

  // Fetch suggested role for column 4 when roles are loaded (only if no selection)
  useEffect(() => {
    if (
      col4Roles.length > 0 &&
      !selectedCol4Role &&
      !isLoadingCol4 &&
      selectedCol3Role &&
      showCol4
    ) {
      fetchSuggestedRole(col4Roles, 'promotion', setSuggestedCol4);
    }
  }, [col4Roles, selectedCol4Role, isLoadingCol4, selectedCol3Role, showCol4, fetchSuggestedRole]);

  // Trigger API fetches for subsequent columns on mount (for edit mode)
  // Selections are already set via useState initializers, this just fetches the role lists
  useEffect(() => {
    if (hasRestoredRef.current || placedSteps.length === 0) return;
    hasRestoredRef.current = true;

    // Create synthetic roles from saved placedSteps for API calls
    const syntheticRoles: ColumnRole[] = placedSteps.map((step) => ({
      id: step.id,
      title: step.title,
      category: '',
      fit_score: step.fit_score || 75,
      selected: true,
    }));

    // Trigger col2 fetch if we have a col1 selection
    if (syntheticRoles[0]) {
      fetchCol2Roles(syntheticRoles[0]);
    }

    // Trigger col3 fetch if we have a col2 selection
    if (syntheticRoles[1]) {
      fetchCol3Roles(syntheticRoles[1]);
    }

    // Remember that we started with 4 columns if applicable
    if (syntheticRoles[3]) {
      hadCol4Ref.current = true;
    }
  }, [placedSteps, fetchCol2Roles, fetchCol3Roles]);

  // Restore selections from placedSteps when col1Roles loads (for edit mode)
  // Skip if user has manually edited (changed a selection)
  useEffect(() => {
    if (userEditedRef.current) return; // User has edited, don't auto-restore
    if (placedSteps.length > 0 && col1Roles.length > 0 && !selectedCol1Role) {
      // Find the first placed step in col1Roles to restore selection
      const firstStep = placedSteps[0];
      // Match by id first, then by title (case-insensitive)
      const col1Match = col1Roles.find(
        (r) => r.id === firstStep.id || r.title.toLowerCase() === firstStep.title.toLowerCase(),
      );

      if (col1Match) {
        // Restore col1 selection and fetch col2
        setSelectedCol1Role({ ...col1Match, selected: true });
        fetchCol2Roles(col1Match);
      } else {
        // No match found - create a synthetic selection from saved data
        const syntheticCol1: ColumnRole = {
          id: firstStep.id,
          title: firstStep.title,
          category: '',
          fit_score: firstStep.fit_score || 75,
          selected: true,
        };
        setSelectedCol1Role(syntheticCol1);
        fetchCol2Roles(syntheticCol1);
      }
    }
  }, [col1Roles, placedSteps, selectedCol1Role, fetchCol2Roles]);

  // Restore col2 selection when col2Roles loads
  // Skip if user has manually edited (changed a selection)
  useEffect(() => {
    if (userEditedRef.current) return; // User has edited, don't auto-restore
    if (placedSteps.length > 1 && col2Roles.length > 0 && selectedCol1Role && !selectedCol2Role) {
      const secondStep = placedSteps[1];
      // Match by id first, then by title (case-insensitive)
      const col2Match = col2Roles.find(
        (r) => r.id === secondStep.id || r.title.toLowerCase() === secondStep.title.toLowerCase(),
      );

      if (col2Match) {
        setSelectedCol2Role({ ...col2Match, selected: true });
        fetchCol3Roles(col2Match);
      } else {
        // No match found - create a synthetic selection from saved data
        const syntheticCol2: ColumnRole = {
          id: secondStep.id,
          title: secondStep.title,
          category: '',
          fit_score: secondStep.fit_score || 75,
          selected: true,
        };
        setSelectedCol2Role(syntheticCol2);
        fetchCol3Roles(syntheticCol2);
      }
    }
  }, [col2Roles, placedSteps, selectedCol1Role, selectedCol2Role, fetchCol3Roles]);

  // Update selection state when placedSteps changes
  useEffect(() => {
    const ids = new Set(placedSteps.map((s) => s.id));
    setCol1Roles((prev) => prev.map((r) => ({ ...r, selected: ids.has(r.id) })));
    setCol2Roles((prev) => prev.map((r) => ({ ...r, selected: ids.has(r.id) })));
    setCol3Roles((prev) => prev.map((r) => ({ ...r, selected: ids.has(r.id) })));
    setCol4Roles((prev) => prev.map((r) => ({ ...r, selected: ids.has(r.id) })));
  }, [placedSteps]);

  // Handle selecting a role in column 1 (activates column 2)
  const handleCol1Select = (role: ColumnRole) => {
    // Check if this is a different selection (cascade reset needed)
    const isChangingSelection = selectedCol1Role && selectedCol1Role.id !== role.id;

    if (isChangingSelection) {
      // Mark that user has manually edited - disable auto-restoration
      userEditedRef.current = true;

      // Remove col2, col3, col4 selections from placedSteps
      const idsToRemove = new Set<string>();
      if (selectedCol2Role) idsToRemove.add(selectedCol2Role.id);
      if (selectedCol3Role) idsToRemove.add(selectedCol3Role.id);
      if (selectedCol4Role) idsToRemove.add(selectedCol4Role.id);

      // Also remove the old col1 selection
      idsToRemove.add(selectedCol1Role.id);

      // Remove all affected steps
      idsToRemove.forEach((id) => onRemoveStep(id));

      // Reset col2, col3, col4 SELECTIONS AND role arrays (cascade reset)
      setSelectedCol2Role(null);
      setSelectedCol3Role(null);
      setSelectedCol4Role(null);
      // Clear role arrays for cascade reset - these will be fetched fresh
      setCol2Roles([]);
      setCol3Roles([]);
      setCol4Roles([]);
      // Maintain col4 visibility if user started with 4 columns
      if (!hadCol4Ref.current) {
        setShowCol4(false);
      }

      // Collapse expanded states for reset columns
      setExpandedCol2(false);
      setExpandedCol3(false);
      setExpandedCol4(false);
    }

    setSelectedCol1Role(role);
    setHoveredCol1Role(null);
    // Fetch new col2 roles for the new selection
    fetchCol2Roles(role);

    if (!role.selected || isChangingSelection) {
      const newStep: PlacedStep = {
        id: role.id,
        title: role.title,
        fit_score: role.fit_score,
        index: 0, // First step after starting role
        role_id: role.id,
      };
      onPlaceStep(newStep);
    }
  };

  // Handle selecting a role in column 2 (activates column 3)
  const handleCol2Select = (role: ColumnRole) => {
    // Check if this is a different selection (cascade reset needed)
    const isChangingSelection = selectedCol2Role && selectedCol2Role.id !== role.id;

    if (isChangingSelection) {
      // Mark that user has manually edited - disable auto-restoration
      userEditedRef.current = true;

      // Remove col3, col4 selections from placedSteps
      const idsToRemove = new Set<string>();
      if (selectedCol3Role) idsToRemove.add(selectedCol3Role.id);
      if (selectedCol4Role) idsToRemove.add(selectedCol4Role.id);

      // Also remove the old col2 selection
      idsToRemove.add(selectedCol2Role.id);

      // Remove all affected steps
      idsToRemove.forEach((id) => onRemoveStep(id));

      // Reset col3, col4 SELECTIONS AND role arrays (cascade reset)
      setSelectedCol3Role(null);
      setSelectedCol4Role(null);
      // Clear role arrays for cascade reset - these will be fetched fresh
      setCol3Roles([]);
      setCol4Roles([]);
      // Maintain col4 visibility if user started with 4 columns
      if (!hadCol4Ref.current) {
        setShowCol4(false);
      }

      // Collapse expanded states for reset columns
      setExpandedCol3(false);
      setExpandedCol4(false);
    }

    setSelectedCol2Role(role);
    setHoveredCol2Role(null);
    fetchCol3Roles(role);

    if (!role.selected || isChangingSelection) {
      const newStep: PlacedStep = {
        id: role.id,
        title: role.title,
        fit_score: role.fit_score,
        index: 1, // Second step after starting role
        role_id: role.id,
      };
      onPlaceStep(newStep);
    }
  };

  // Handle selecting a role in column 3 (completes path, shows + button)
  const handleCol3Select = (role: ColumnRole) => {
    // Check if this is a different selection (cascade reset needed)
    const isChangingSelection = selectedCol3Role && selectedCol3Role.id !== role.id;

    if (isChangingSelection) {
      // Mark that user has manually edited - disable auto-restoration
      userEditedRef.current = true;

      // Remove col4 selection from placedSteps
      const idsToRemove = new Set<string>();
      if (selectedCol4Role) idsToRemove.add(selectedCol4Role.id);

      // Also remove the old col3 selection
      idsToRemove.add(selectedCol3Role.id);

      // Remove all affected steps
      idsToRemove.forEach((id) => onRemoveStep(id));

      // Reset col4 SELECTION AND role array (cascade reset)
      setSelectedCol4Role(null);
      // Clear role array for cascade reset - will be fetched fresh if needed
      setCol4Roles([]);
      // Maintain col4 visibility if user started with 4 columns
      if (!hadCol4Ref.current) {
        setShowCol4(false);
      }

      // Collapse expanded state for reset column
      setExpandedCol4(false);
    }

    setSelectedCol3Role(role);
    setHoveredCol3Role(null);

    if (!role.selected || isChangingSelection) {
      const newStep: PlacedStep = {
        id: role.id,
        title: role.title,
        fit_score: role.fit_score,
        index: 2, // Third step after starting role
        role_id: role.id,
      };
      onPlaceStep(newStep);
    }
  };

  // Fetch extended path roles (Column 4) - based on col3 selection
  // Note: We don't clear roles arrays to avoid loading spinners - just set loading state
  const fetchCol4Roles = useCallback(
    async (selectedRole: ColumnRole, isRestoring = false) => {
      setIsLoadingCol4(true);
      // Don't clear roles here - keep existing roles visible during fetch to avoid loading spinner
      // setCol4Roles([]);
      // Selection clearing is handled separately

      try {
        const response = await fetch('/api/career-explorer/next-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentRole: selectedRole.title,
            category: selectedRole.category,
            skills_have: skillsHave,
            skills_want: skillsWant,
            count: 10,
            column: 'promotion',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const roles: ColumnRole[] = (data.roles || []).map((role: NextRole) => ({
            id: role.id,
            title: role.title,
            category: role.category,
            fit_score: role.fit_score,
            selected: selectedIdsRef.current.has(role.id),
            relationship: role.relationship,
          }));

          setCol4Roles(roles.sort((a, b) => b.fit_score - a.fit_score));
        }
      } catch (error) {
        console.error('Column 4 fetch error:', error);
      } finally {
        setIsLoadingCol4(false);
      }
    },
    [skillsHave, skillsWant],
  );

  // Restore col3 selection when col3Roles loads (defined here after fetchCol4Roles)
  // Skip if user has manually edited (changed a selection)
  useEffect(() => {
    if (userEditedRef.current) return; // User has edited, don't auto-restore
    if (placedSteps.length > 2 && col3Roles.length > 0 && selectedCol2Role && !selectedCol3Role) {
      const thirdStep = placedSteps[2];
      // Match by id first, then by title (case-insensitive)
      const col3Match = col3Roles.find(
        (r) => r.id === thirdStep.id || r.title.toLowerCase() === thirdStep.title.toLowerCase(),
      );

      if (col3Match) {
        setSelectedCol3Role({ ...col3Match, selected: true });
        // If there's a 4th step, show col4 and fetch col4 roles (with isRestoring=true)
        if (placedSteps.length > 3) {
          setShowCol4(true);
          fetchCol4Roles(col3Match, true);
        }
      } else {
        // No match found in fetched roles - create a synthetic selection from saved data
        const syntheticCol3: ColumnRole = {
          id: thirdStep.id,
          title: thirdStep.title,
          category: '',
          fit_score: thirdStep.fit_score || 75,
          selected: true,
        };
        setSelectedCol3Role(syntheticCol3);
        if (placedSteps.length > 3) {
          setShowCol4(true);
          fetchCol4Roles(syntheticCol3, true);
        }
      }
    }
  }, [col3Roles, placedSteps, selectedCol2Role, selectedCol3Role, fetchCol4Roles]);

  // Automatically fetch col4 roles when col4 is visible and we have a col3 selection but no col4 roles yet
  useEffect(() => {
    if (showCol4 && selectedCol3Role && col4Roles.length === 0 && !isLoadingCol4) {
      fetchCol4Roles(selectedCol3Role);
    }
  }, [showCol4, selectedCol3Role, col4Roles.length, isLoadingCol4, fetchCol4Roles]);

  // Restore col4 selection when col4Roles loads
  // Skip if user has manually edited (changed a selection)
  useEffect(() => {
    if (userEditedRef.current) return; // User has edited, don't auto-restore
    if (placedSteps.length > 3 && col4Roles.length > 0 && selectedCol3Role && !selectedCol4Role) {
      const fourthStep = placedSteps[3];
      // Match by id first, then by title (case-insensitive)
      const col4Match = col4Roles.find(
        (r) => r.id === fourthStep.id || r.title.toLowerCase() === fourthStep.title.toLowerCase(),
      );

      if (col4Match) {
        setSelectedCol4Role({ ...col4Match, selected: true });
      } else {
        // No match found in fetched roles - create a synthetic selection from saved data
        const syntheticCol4: ColumnRole = {
          id: fourthStep.id,
          title: fourthStep.title,
          category: '',
          fit_score: fourthStep.fit_score || 75,
          selected: true,
        };
        setSelectedCol4Role(syntheticCol4);
      }
    }
  }, [col4Roles, placedSteps, selectedCol3Role, selectedCol4Role]);

  // Handle adding another path - show column 4 with more options
  const handleAddAnotherPath = () => {
    if (selectedCol3Role) {
      setShowCol4(true);
      hadCol4Ref.current = true; // Remember that col4 was added
      fetchCol4Roles(selectedCol3Role);
    }
  };

  // Handle selecting a role in column 4
  const handleCol4Select = (role: ColumnRole) => {
    // Check if this is a different selection
    const isChangingSelection = selectedCol4Role && selectedCol4Role.id !== role.id;

    if (isChangingSelection) {
      // Remove the old col4 selection
      onRemoveStep(selectedCol4Role.id);
    }

    setSelectedCol4Role(role);
    setHoveredCol4Role(null);

    if (!role.selected || isChangingSelection) {
      const newStep: PlacedStep = {
        id: role.id,
        title: role.title,
        fit_score: role.fit_score,
        index: 3, // Fourth step after starting role
        role_id: role.id,
      };
      onPlaceStep(newStep);
    }
  };

  // Handle expanding column 1 for editing - just expand, don't reset yet
  // Cascade reset happens when user actually selects a DIFFERENT role
  const handleExpandCol1 = () => {
    setExpandedCol1(true);
  };

  // Handle expanding column 2 for editing - just expand, don't reset yet
  // Cascade reset happens when user actually selects a DIFFERENT role
  const handleExpandCol2 = () => {
    setExpandedCol2(true);
  };

  // Handle expanding column 3 for editing - just expand, don't reset yet
  // Cascade reset happens when user actually selects a DIFFERENT role
  const handleExpandCol3 = () => {
    setExpandedCol3(true);
  };

  // Handle expanding column 4 for editing - just expand, don't reset yet
  const handleExpandCol4 = () => {
    setExpandedCol4(true);
  };

  // Get icon for starting point
  const getStartingIcon = () => {
    if (isMajor) return <GraduationCap className="w-4 h-4 text-amber-600" />;
    if (isInternship) return <Users className="w-4 h-4 text-emerald-600" />;
    return <Briefcase className="w-4 h-4 text-primary-600" />;
  };

  // Get label for starting point
  const getStartingLabel = () => {
    if (isMajor) return 'Your Major';
    if (isInternship) return 'Your Internship';
    return 'Current Role';
  };

  // Get column headers based on starting point type
  const getColumnConfig = () => {
    if (isMajor) {
      // Major → Internships → Entry-Level → Growth
      return {
        col1Title: 'Internships',
        col1Subtitle: 'Start with an internship',
        col1Icon: <Users className="w-4 h-4" />,
        col2Title: 'Entry-Level Jobs',
        col2Subtitle: 'After your internship',
        col2Icon: <Briefcase className="w-4 h-4" />,
        col3Title: 'Growth Opportunities',
        col3Subtitle: 'Future career growth',
        col3Icon: <TrendingUp className="w-4 h-4" />,
      };
    }
    if (isInternship) {
      // Internship → Entry-Level → Related Roles → Growth
      return {
        col1Title: 'Entry-Level Jobs',
        col1Subtitle: 'After your internship',
        col1Icon: <Briefcase className="w-4 h-4" />,
        col2Title: 'Related Roles',
        col2Subtitle: 'Based on your selection',
        col2Icon: <Users className="w-4 h-4" />,
        col3Title: 'Growth Opportunities',
        col3Subtitle: 'Future career growth',
        col3Icon: <TrendingUp className="w-4 h-4" />,
      };
    }
    // Professional role → Career Options → Related → Growth
    return {
      col1Title: 'Career Options',
      col1Subtitle: 'Select a role to explore paths',
      col1Icon: <Briefcase className="w-4 h-4" />,
      col2Title: 'Related Roles',
      col2Subtitle: 'Based on your selection',
      col2Icon: <Users className="w-4 h-4" />,
      col3Title: 'Growth Opportunities',
      col3Subtitle: 'Future career growth',
      col3Icon: <TrendingUp className="w-4 h-4" />,
    };
  };

  const columnConfig = getColumnConfig();

  // Check if full path is complete
  const isPathComplete = selectedCol1Role && selectedCol2Role && selectedCol3Role;

  // Determine grid columns: 4 base, 5 when path complete, 6 when showing col4 options
  const getGridCols = () => {
    if (showCol4) return 'md:grid-cols-5'; // 5 cols when showing col4 (col0-col3 + col4)
    if (isPathComplete) return 'md:grid-cols-5'; // 5 cols with add button
    return 'md:grid-cols-4'; // 4 cols initially
  };

  // Only show full-page loading if we're loading AND don't have any selections yet
  // (i.e., this is a fresh start, not returning to an existing path)
  const hasExistingSelections = selectedCol1Role !== null;
  if (isLoadingCol1 && !hasExistingSelections) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
        <p className="text-neutral-500">Loading career paths for {startingRole.title}...</p>
      </div>
    );
  }

  return (
    <div className="w-full px-4">
      {/* Header */}
      <div
        className={`mb-6 ${showSaveButton ? 'flex items-center justify-between' : 'text-center'}`}
      >
        {showSaveButton && <div className="flex-1" />}
        <div className={showSaveButton ? 'text-center flex-1' : ''}>
          <h1 className="text-2xl font-semibold text-neutral-900">Build your career path</h1>
          <p className="text-neutral-500 mt-1">
            Select a job from the first column to see related career paths
          </p>
        </div>
        {showSaveButton && (
          <div className="flex-1 flex justify-end">
            <Button
              onClick={() => {
                // Build the complete path from selected roles
                const completePath: PlacedStep[] = [];

                if (selectedCol1Role) {
                  completePath.push({
                    id: selectedCol1Role.id,
                    title: selectedCol1Role.title,
                    fit_score: selectedCol1Role.fit_score,
                    index: 0,
                    role_id: selectedCol1Role.id,
                  });
                }

                if (selectedCol2Role) {
                  completePath.push({
                    id: selectedCol2Role.id,
                    title: selectedCol2Role.title,
                    fit_score: selectedCol2Role.fit_score,
                    index: 1,
                    role_id: selectedCol2Role.id,
                  });
                }

                if (selectedCol3Role) {
                  completePath.push({
                    id: selectedCol3Role.id,
                    title: selectedCol3Role.title,
                    fit_score: selectedCol3Role.fit_score,
                    index: 2,
                    role_id: selectedCol3Role.id,
                  });
                }

                if (selectedCol4Role) {
                  completePath.push({
                    id: selectedCol4Role.id,
                    title: selectedCol4Role.title,
                    fit_score: selectedCol4Role.fit_score,
                    index: 3,
                    role_id: selectedCol4Role.id,
                  });
                }

                onFinish(completePath);
              }}
              className="min-w-[160px]"
            >
              Save Career Path
            </Button>
          </div>
        )}
      </div>

      {/* Column Layout with SVG Connectors */}
      <div ref={containerRef} className="relative">
        {/* SVG Connector Lines - Curved Paths */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ overflow: 'visible' }}
        >
          {/* Line from starting point to col1 */}
          {line1 && (
            <path
              d={getCurvedPath(line1)}
              fill="none"
              stroke={selectedCol1Role ? '#3b82f6' : '#93c5fd'}
              strokeWidth={selectedCol1Role ? 3 : 2}
              strokeDasharray={selectedCol1Role ? '0' : '6 4'}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Line from col1 to col2 */}
          {line2 && (
            <path
              d={getCurvedPath(line2)}
              fill="none"
              stroke={selectedCol2Role ? '#a855f7' : '#d8b4fe'}
              strokeWidth={selectedCol2Role ? 3 : 2}
              strokeDasharray={selectedCol2Role ? '0' : '6 4'}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Line from col2 to col3 */}
          {line3 && (
            <path
              d={getCurvedPath(line3)}
              fill="none"
              stroke={selectedCol3Role ? '#10b981' : '#6ee7b7'}
              strokeWidth={selectedCol3Role ? 3 : 2}
              strokeDasharray={selectedCol3Role ? '0' : '6 4'}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Line from col3 to add button */}
          {line4 && (
            <path
              d={getCurvedPath(line4)}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}
        </svg>

        <div className={`grid grid-cols-1 gap-3 relative z-10 ${getGridCols()}`}>
          {/* Column 0: Starting Point */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMajor ? 'bg-amber-100' : isInternship ? 'bg-emerald-100' : 'bg-primary-100'}`}
              >
                {getStartingIcon()}
              </div>
              <div>
                <p className="font-medium text-sm text-neutral-900">{getStartingLabel()}</p>
                <p className="text-xs text-neutral-500">Starting point</p>
              </div>
            </div>
            <div className="space-y-2">
              <div
                ref={startingRef}
                className="p-3 rounded-xl border-2 border-primary-300 bg-primary-50 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900 text-sm truncate pr-2">
                    {startingRole.title}
                  </span>
                  <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Column 1: Entry-level Jobs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                {columnConfig.col1Icon}
              </div>
              <div>
                <p className="font-medium text-sm text-neutral-900">{columnConfig.col1Title}</p>
                <p className="text-xs text-neutral-500">{columnConfig.col1Subtitle}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {/* Show only selected role if one is selected and not expanded, otherwise show all */}
              {selectedCol1Role && !expandedCol1 ? (
                <button
                  ref={(el) => {
                    if (el) col1Refs.current.set(selectedCol1Role.id, el);
                  }}
                  onClick={handleExpandCol1}
                  className="w-full p-3 rounded-xl border-2 border-blue-400 bg-blue-50 shadow-sm transition-all duration-500 ease-out animate-in slide-in-from-bottom-2 hover:border-blue-500 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-900 text-sm truncate pr-2">
                      {selectedCol1Role.title}
                    </span>
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  </div>
                </button>
              ) : col1Roles.length > 0 ? (
                col1Roles.map((role) => {
                  const isSuggested = suggestedCol1 === role.id && !selectedCol1Role;
                  return (
                    <HoverCard key={role.id} openDelay={400} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          ref={(el) => {
                            if (el) col1Refs.current.set(role.id, el);
                          }}
                          onClick={() => {
                            handleCol1Select(role);
                            setExpandedCol1(false);
                          }}
                          onMouseEnter={() => setHoveredCol1Role(role.id)}
                          onMouseLeave={() => setHoveredCol1Role(null)}
                          className={`
                            w-full text-left p-3 rounded-xl border-2 transition-all duration-200
                            ${
                              selectedCol1Role?.id === role.id
                                ? 'border-blue-400 bg-blue-50 shadow-sm'
                                : isSuggested
                                  ? 'border-purple-400 border-dashed bg-purple-50/50 shadow-sm'
                                  : hoveredCol1Role === role.id
                                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                                    : 'border-neutral-200 bg-white hover:border-blue-200'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-medium truncate text-sm ${isSuggested ? 'text-purple-900' : 'text-neutral-900'}`}
                            >
                              {role.title}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isSuggested && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-medium rounded-full">
                                  Suggested
                                </span>
                              )}
                              {selectedCol1Role?.id === role.id ? (
                                <Check className="w-4 h-4 text-blue-600" />
                              ) : isSuggested ? (
                                <Sparkles className="w-4 h-4 text-purple-500" />
                              ) : (
                                <Plus className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                          </div>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" align="start" sideOffset={8}>
                        <RoleHoverCard
                          title={role.title}
                          category={role.category}
                          fitScore={role.fit_score}
                          relationship={role.relationship}
                        />
                      </HoverCardContent>
                    </HoverCard>
                  );
                })
              ) : (
                <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-500 text-sm">
                  No roles found
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Related Roles */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCol1Role ? 'bg-purple-100 text-purple-600' : 'bg-neutral-100 text-neutral-400'}`}
              >
                {columnConfig.col2Icon}
              </div>
              <div>
                <p
                  className={`font-medium text-sm ${selectedCol1Role ? 'text-neutral-900' : 'text-neutral-400'}`}
                >
                  {columnConfig.col2Title}
                </p>
                <p className="text-xs text-neutral-500">{columnConfig.col2Subtitle}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {/* Show selected role if not expanded */}
              {selectedCol2Role && !expandedCol2 ? (
                <button
                  ref={(el) => {
                    if (el) col2Refs.current.set(selectedCol2Role.id, el);
                  }}
                  onClick={handleExpandCol2}
                  className="w-full p-3 rounded-xl border-2 border-purple-400 bg-purple-50 shadow-sm transition-all duration-500 ease-out animate-in slide-in-from-bottom-2 hover:border-purple-500 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-900 text-sm truncate pr-2">
                      {selectedCol2Role.title}
                    </span>
                    <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  </div>
                </button>
              ) : isLoadingCol2 && col2Roles.length === 0 && !userEditedRef.current ? (
                // Show shimmer text animation on initial load, not spinner
                <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                  <span className="inline-block bg-gradient-to-r from-purple-400 via-purple-600 to-purple-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                    Loading roles...
                  </span>
                </div>
              ) : selectedCol1Role ? (
                col2Roles.length > 0 ? (
                  col2Roles.map((role) => {
                    const isSuggested = suggestedCol2 === role.id && !selectedCol2Role;
                    return (
                      <HoverCard key={role.id} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button
                            ref={(el) => {
                              if (el) col2Refs.current.set(role.id, el);
                            }}
                            onClick={() => {
                              handleCol2Select(role);
                              setExpandedCol2(false);
                            }}
                            onMouseEnter={() => setHoveredCol2Role(role.id)}
                            onMouseLeave={() => setHoveredCol2Role(null)}
                            className={`
                            w-full text-left p-3 rounded-xl border-2 transition-all duration-200
                            ${
                              selectedCol2Role?.id === role.id
                                ? 'border-purple-400 bg-purple-50 shadow-sm'
                                : isSuggested
                                  ? 'border-purple-400 border-dashed bg-purple-50/50 shadow-sm'
                                  : hoveredCol2Role === role.id
                                    ? 'border-purple-300 bg-purple-50 shadow-sm'
                                    : 'border-neutral-200 bg-white hover:border-purple-200'
                            }
                          `}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-medium truncate text-sm ${isSuggested ? 'text-purple-900' : 'text-neutral-900'}`}
                              >
                                {role.title}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isSuggested && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-medium rounded-full">
                                    Suggested
                                  </span>
                                )}
                                {selectedCol2Role?.id === role.id ? (
                                  <Check className="w-4 h-4 text-purple-600" />
                                ) : isSuggested ? (
                                  <Sparkles className="w-4 h-4 text-purple-500" />
                                ) : (
                                  <Plus className="w-4 h-4 text-neutral-400" />
                                )}
                              </div>
                            </div>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" align="start" sideOffset={8}>
                          <RoleHoverCard
                            title={role.title}
                            category={role.category}
                            fitScore={role.fit_score}
                            relationship={role.relationship}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })
                ) : isLoadingCol2 ? (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                    <span className="inline-block bg-gradient-to-r from-purple-400 via-purple-600 to-purple-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                      Loading roles...
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-500 text-sm">
                    No related roles found
                  </div>
                )
              ) : (
                <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-400 text-sm">
                  Select a role from the first column
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Growth Opportunities */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCol2Role ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}
              >
                {columnConfig.col3Icon}
              </div>
              <div>
                <p
                  className={`font-medium text-sm ${selectedCol2Role ? 'text-neutral-900' : 'text-neutral-400'}`}
                >
                  {columnConfig.col3Title}
                </p>
                <p className="text-xs text-neutral-500">{columnConfig.col3Subtitle}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
              {/* Show selected role first (even while loading) unless expanded */}
              {selectedCol3Role && !expandedCol3 ? (
                <button
                  ref={(el) => {
                    if (el) col3Refs.current.set(selectedCol3Role.id, el);
                  }}
                  onClick={handleExpandCol3}
                  className="w-full p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 shadow-sm transition-all duration-500 ease-out animate-in slide-in-from-bottom-2 hover:border-emerald-500 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-900 text-sm truncate pr-2">
                      {selectedCol3Role.title}
                    </span>
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  </div>
                </button>
              ) : isLoadingCol3 && col3Roles.length === 0 && !userEditedRef.current ? (
                // Show shimmer text animation on initial load, not spinner
                <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                  <span className="inline-block bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                    Loading roles...
                  </span>
                </div>
              ) : selectedCol2Role ? (
                col3Roles.length > 0 ? (
                  col3Roles.map((role) => {
                    const isSuggested = suggestedCol3 === role.id && !selectedCol3Role;
                    return (
                      <HoverCard key={role.id} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button
                            ref={(el) => {
                              if (el) col3Refs.current.set(role.id, el);
                            }}
                            onClick={() => {
                              handleCol3Select(role);
                              setExpandedCol3(false);
                            }}
                            onMouseEnter={() => setHoveredCol3Role(role.id)}
                            onMouseLeave={() => setHoveredCol3Role(null)}
                            className={`
                            w-full text-left p-3 rounded-xl border-2 transition-all duration-200
                            ${
                              selectedCol3Role?.id === role.id
                                ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                : isSuggested
                                  ? 'border-purple-400 border-dashed bg-purple-50/50 shadow-sm'
                                  : hoveredCol3Role === role.id
                                    ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                                    : 'border-neutral-200 bg-white hover:border-emerald-200'
                            }
                          `}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-medium truncate text-sm ${isSuggested ? 'text-purple-900' : 'text-neutral-900'}`}
                              >
                                {role.title}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isSuggested && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-medium rounded-full">
                                    Suggested
                                  </span>
                                )}
                                {selectedCol3Role?.id === role.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : isSuggested ? (
                                  <Sparkles className="w-4 h-4 text-purple-500" />
                                ) : (
                                  <Plus className="w-4 h-4 text-neutral-400" />
                                )}
                              </div>
                            </div>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" align="start" sideOffset={8}>
                          <RoleHoverCard
                            title={role.title}
                            category={role.category}
                            fitScore={role.fit_score}
                            relationship={role.relationship}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })
                ) : isLoadingCol3 ? (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                    <span className="inline-block bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                      Loading roles...
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-500 text-sm">
                    No growth paths found
                  </div>
                )
              ) : (
                <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-400 text-sm">
                  Select a role from the second column
                </div>
              )}
            </div>
          </div>

          {/* Column 4: Next Steps or Add Another Path button */}
          {isPathComplete && !showCol4 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm text-neutral-900">Next Steps</p>
                  <p className="text-xs text-neutral-500">Continue your path</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  ref={addButtonRef}
                  onClick={handleAddAnotherPath}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-neutral-300 bg-white hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" />
                    <span className="font-medium text-neutral-500 group-hover:text-primary-600 text-sm transition-colors">
                      Add next step
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Column 4: Extended Path Options (shown after clicking Add or maintained during editing) */}
          {showCol4 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCol3Role ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-400'}`}
                >
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p
                    className={`font-medium text-sm ${selectedCol3Role ? 'text-neutral-900' : 'text-neutral-400'}`}
                  >
                    Next Steps
                  </p>
                  <p className="text-xs text-neutral-500">
                    {selectedCol3Role
                      ? `After ${selectedCol3Role.title}`
                      : 'Select a previous role first'}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                {/* Show selected role unless expanded */}
                {selectedCol4Role && !expandedCol4 ? (
                  <button
                    ref={(el) => {
                      if (el) col4Refs.current.set(selectedCol4Role.id, el);
                    }}
                    onClick={handleExpandCol4}
                    className="w-full p-3 rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm transition-all duration-500 ease-out animate-in slide-in-from-bottom-2 hover:border-amber-500 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900 text-sm truncate pr-2">
                        {selectedCol4Role.title}
                      </span>
                      <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    </div>
                  </button>
                ) : !selectedCol3Role ? (
                  // Show empty state when maintaining column but col3 not selected yet
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-400 text-sm">
                    Select a role from the third column
                  </div>
                ) : isLoadingCol4 && col4Roles.length === 0 && !userEditedRef.current ? (
                  // Show shimmer text animation on initial load, not spinner
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                    <span className="inline-block bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                      Loading roles...
                    </span>
                  </div>
                ) : col4Roles.length > 0 ? (
                  col4Roles.map((role) => {
                    const isSuggested = suggestedCol4 === role.id && !selectedCol4Role;
                    return (
                      <HoverCard key={role.id} openDelay={400} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <button
                            ref={(el) => {
                              if (el) col4Refs.current.set(role.id, el);
                            }}
                            onClick={() => {
                              handleCol4Select(role);
                              setExpandedCol4(false);
                            }}
                            onMouseEnter={() => setHoveredCol4Role(role.id)}
                            onMouseLeave={() => setHoveredCol4Role(null)}
                            className={`
                              w-full text-left p-3 rounded-xl border-2 transition-all duration-200
                              ${
                                selectedCol4Role?.id === role.id
                                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                                  : isSuggested
                                    ? 'border-purple-400 border-dashed bg-purple-50/50 shadow-sm'
                                    : hoveredCol4Role === role.id
                                      ? 'border-amber-300 bg-amber-50 shadow-sm'
                                      : 'border-neutral-200 bg-white hover:border-amber-200'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-medium truncate text-sm ${isSuggested ? 'text-purple-900' : 'text-neutral-900'}`}
                              >
                                {role.title}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isSuggested && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-medium rounded-full">
                                    Suggested
                                  </span>
                                )}
                                {selectedCol4Role?.id === role.id ? (
                                  <Check className="w-4 h-4 text-amber-600" />
                                ) : isSuggested ? (
                                  <Sparkles className="w-4 h-4 text-purple-500" />
                                ) : (
                                  <Plus className="w-4 h-4 text-neutral-400" />
                                )}
                              </div>
                            </div>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="left" align="start" sideOffset={8}>
                          <RoleHoverCard
                            title={role.title}
                            category={role.category}
                            fitScore={role.fit_score}
                            relationship={role.relationship}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })
                ) : isLoadingCol4 ? (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-sm">
                    <span className="inline-block bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400 bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                      Loading roles...
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border-2 border-dashed border-neutral-200 text-center text-neutral-500 text-sm">
                    No next steps found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
