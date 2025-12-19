'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Compass, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CareerWizardHandle } from '@/components/career-explorer';
import {
  CareerWizard,
  CareerWizardSkeleton,
  MainPathEditor,
  PathGalaxyView,
  PathSummaryScreen,
  PathwaysStep,
  QuizResults,
  QuizWizard,
} from '@/components/career-explorer';
import {
  ExplorerControls,
  FilterMode,
  RoleCategory,
} from '@/components/career-explorer/ExplorerControls';
import { PlanRail } from '@/components/career-explorer/PlanRail';
import { RoleDetailPanel } from '@/components/career-explorer/RoleDetail/RoleDetailPanel';
import { RolePreviewCard, RoleSalaryData } from '@/components/career-explorer/RolePreviewCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSidebar } from '@/contexts/SidebarContext';
import { useToast } from '@/hooks/use-toast';
import type {
  AnchorNode,
  BundleType,
  CareerExplorerState,
  ExplorerView,
  MainPath,
  MainPathStep,
  MajorContext,
  PathGraph,
  PathNode,
  PlacedStep,
  QuizAnswers,
  QuizResult,
  RoleDetail,
} from '@/lib/career-explorer/types';

// Type for galaxy role from API
interface GalaxyRole {
  id: string;
  title: string;
  category: string;
  fit_score: number;
  reason: string;
  skills: string[];
  growth_outlook?: string;
  is_saved?: boolean;
}

// Default major context
const DEFAULT_MAJOR_CONTEXT: MajorContext = {
  enabled: true,
  closeness: 50,
  open_to_unrelated: true,
  grad_school_interest: 'none',
};

// Convert galaxy roles from API to PathGraph format for visualization
function convertRolesToPathGraph(roles: GalaxyRole[]): PathGraph {
  if (!roles || roles.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Create nodes from roles (positions will be calculated by PathGalaxyView)
  const nodes: PathNode[] = roles.map((role) => ({
    id: role.id,
    type: 'role' as const,
    title: role.title,
    subtitle: role.category,
    x: 0, // Will be calculated by radial layout
    y: 0, // Will be calculated by radial layout
    fit_score: role.fit_score,
    skills: role.skills,
    is_saved: role.is_saved,
  }));

  // No edges for now - the galaxy view shows roles without connections
  // Connections can be added when user creates a path
  return { nodes, edges: [] };
}

export default function CareerExplorerPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isExpanded, collapse, expand } = useSidebar();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<ExplorerView>('landing');
  const [activeTab, setActiveTab] = useState('explore');
  const [majorContext, setMajorContext] = useState<MajorContext>(DEFAULT_MAJOR_CONTEXT);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [pathGraph, setPathGraph] = useState<PathGraph>({ nodes: [], edges: [] });
  const [isLoadingGalaxy, setIsLoadingGalaxy] = useState(false);
  const [galaxyError, setGalaxyError] = useState<string | null>(null);
  const [galaxyRoles, setGalaxyRoles] = useState<GalaxyRole[]>([]);

  // V3 Timeline Explorer state
  const [focusMode, setFocusMode] = useState(false);
  const [anchorNode, setAnchorNode] = useState<AnchorNode | null>(null);
  const [placedPlanSteps, setPlacedPlanSteps] = useState<PlacedStep[]>([]);

  // Hover preview state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null); // Ref for async staleness check
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSalaryData, setHoveredSalaryData] = useState<RoleSalaryData | null>(null);
  const [isLoadingSalary, setIsLoadingSalary] = useState(false);
  const salaryCache = useRef<Map<string, RoleSalaryData>>(new Map());

  // Explorer controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('recommended');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Role detail panel state
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<RoleDetail | null>(null);
  const [isLoadingRoleDetail, setIsLoadingRoleDetail] = useState(false);
  const [nextCareerPaths, setNextCareerPaths] = useState<GalaxyRole[]>([]);

  // Track if we collapsed the sidebar so we can restore it
  const sidebarWasExpanded = useRef<boolean>(false);

  // Collapse sidebar when entering galaxy view, restore when leaving
  useEffect(() => {
    const isGalaxyView = currentView === 'explore' && activeTab === 'explore';

    if (isGalaxyView) {
      // Remember if sidebar was expanded before we collapse it
      if (isExpanded) {
        sidebarWasExpanded.current = true;
        collapse();
      }
    } else {
      // Restore sidebar if we had collapsed it
      if (sidebarWasExpanded.current) {
        sidebarWasExpanded.current = false;
        expand();
      }
    }
  }, [currentView, activeTab, isExpanded, collapse, expand]);

  // Get quiz result from Convex
  const convexQuizResult = useQuery(api.career_explorer.getLatestQuizResult, {});

  // Get explorer state from Convex (V4 wizard)
  const explorerState = useQuery(api.career_explorer.getExplorerState, {});
  const clearExplorerState = useMutation(api.career_explorer.clearExplorerState);
  const saveExplorerState = useMutation(api.career_explorer.saveExplorerState);

  // Mutation to save quiz results
  const createQuizResult = useMutation(api.career_explorer.createQuizResult);

  // Use convex result as the source of truth
  const quizResult = convexQuizResult;

  // Track if wizard was completed THIS session (not from saved state)
  const [wizardCompletedThisSession, setWizardCompletedThisSession] = useState(false);

  // Track if user is editing their path (returned from PathSummaryScreen)
  const [isEditingPath, setIsEditingPath] = useState(false);

  // Wizard ref and state for save button in header
  const wizardRef = useRef<CareerWizardHandle>(null);
  const [wizardCanSave, setWizardCanSave] = useState(false);

  // Track edited placed steps when user modifies PathwaysStep directly (not through wizard)
  const [editedPlacedSteps, setEditedPlacedSteps] = useState<PlacedStep[] | null>(null);

  // No auto-navigation - always start with wizard on Explorer tab

  // Main path data
  const [mainPath] = useState<MainPath | null>(null);
  const [mainPathSteps, setMainPathSteps] = useState<MainPathStep[]>([]);

  // Fetch galaxy roles when entering explore view
  const fetchGalaxyRoles = useCallback(async () => {
    if (isLoadingGalaxy) return;

    setIsLoadingGalaxy(true);
    setGalaxyError(null);

    try {
      const response = await fetch('/api/career-explorer/galaxy-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to load career suggestions (${response.status})`,
        );
      }

      const data = await response.json();

      if (data.roles && data.roles.length > 0) {
        setGalaxyRoles(data.roles);
        setPathGraph(convertRolesToPathGraph(data.roles));
      }
    } catch (error) {
      console.error('Error fetching galaxy roles:', error);
      setGalaxyError(error instanceof Error ? error.message : 'Failed to load career suggestions');
    } finally {
      setIsLoadingGalaxy(false);
    }
  }, [isLoadingGalaxy]);

  // Fetch roles when switching to explore view
  useEffect(() => {
    if (currentView === 'explore' && galaxyRoles.length === 0 && !isLoadingGalaxy) {
      fetchGalaxyRoles();
    }
  }, [currentView, galaxyRoles.length, isLoadingGalaxy, fetchGalaxyRoles]);

  const handleStartQuiz = () => {
    setCurrentView('quiz');
  };

  const handleQuizComplete = async (answers: QuizAnswers) => {
    setIsSubmittingQuiz(true);

    try {
      // Generate quiz result data (in production, this would be AI-generated)
      // For now, use reasonable defaults based on quiz answers
      const quizResultData = {
        major_context: majorContext,
        answers,
        themes: [
          {
            name: 'Technical Problem Solver',
            description: 'You enjoy analytical challenges and building solutions',
            weight: 85,
          },
          {
            name: 'Growth-Oriented',
            description: 'You value continuous learning and career advancement',
            weight: 75,
          },
          {
            name: 'Team Collaborator',
            description: 'You work well in collaborative environments',
            weight: 70,
          },
        ],
        recommended_directions: [
          {
            title: 'Software Engineering',
            fit_score: 88,
            reasoning:
              'Your technical interests and problem-solving approach align well with this path',
          },
          {
            title: 'Product Management',
            fit_score: 75,
            reasoning: 'Your balance of technical and interpersonal skills fits this role',
          },
          {
            title: 'Data Science',
            fit_score: 72,
            reasoning: 'Your analytical mindset could translate well to data-focused roles',
          },
        ],
        roles_to_explore: [
          {
            role_id: 'swe-1',
            title: 'Software Engineer',
            reason: 'Strong technical fit',
            fit_score: 88,
          },
          {
            role_id: 'pm-1',
            title: 'Product Manager',
            reason: 'Good blend of skills',
            fit_score: 75,
          },
          {
            role_id: 'ds-1',
            title: 'Data Scientist',
            reason: 'Analytical strengths',
            fit_score: 72,
          },
          {
            role_id: 'fe-1',
            title: 'Frontend Developer',
            reason: 'Technical and creative',
            fit_score: 70,
          },
          {
            role_id: 'ux-1',
            title: 'UX Engineer',
            reason: 'Technical + user focus',
            fit_score: 68,
          },
          {
            role_id: 'devrel-1',
            title: 'Developer Relations',
            reason: 'Technical + communication',
            fit_score: 65,
          },
        ],
        suggested_bundles: [
          {
            bundle_type: 'safe' as const,
            name: 'Traditional Tech Path',
            path_graph: { nodes: [], edges: [] },
            starter_checklist: [
              'Build a portfolio project',
              'Practice coding interviews',
              'Apply to entry-level positions',
            ],
          },
          {
            bundle_type: 'ambitious' as const,
            name: 'Startup Track',
            path_graph: { nodes: [], edges: [] },
            starter_checklist: [
              'Join a hackathon',
              'Network with founders',
              'Build a side project',
            ],
          },
          {
            bundle_type: 'alternative' as const,
            name: 'Product-Technical Hybrid',
            path_graph: { nodes: [], edges: [] },
            starter_checklist: [
              'Take a PM course',
              'Shadow a product team',
              'Lead a feature project',
            ],
          },
        ],
        confidence_level: 'leaning' as const,
      };

      // Save to Convex
      await createQuizResult(quizResultData);

      // Navigate to galaxy view (convexQuizResult will update automatically)
      setCurrentView('explore');
      setActiveTab('explore');
      // Clear galaxy roles so they get regenerated with new quiz data
      setGalaxyRoles([]);
    } catch (error) {
      console.error('Error saving quiz result:', error);
      toast({
        title: 'Warning',
        description: 'Quiz results could not be saved, but you can still explore careers.',
        variant: 'destructive',
      });
      // Still navigate to explore even if save fails
      setCurrentView('explore');
      setActiveTab('explore');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleQuizCancel = () => {
    setCurrentView('landing');
  };

  const handleExploreBundle = (bundleType: BundleType) => {
    console.log('Exploring bundle:', bundleType);
    setCurrentView('explore');
    setActiveTab('explore');
  };

  const handleNodeSelect = useCallback(
    async (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setFocusMode(true); // Enter focus mode on selection

      // Find the node in the graph
      const node = pathGraph.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Find the corresponding galaxy role for more details
      const galaxyRole = galaxyRoles.find((r) => r.id === nodeId);

      // IMMEDIATELY show what we have - don't wait for API calls
      const immediateRoleDetail: RoleDetail = {
        role_id: nodeId,
        title: node.title,
        description: galaxyRole?.reason || 'Explore this career path to learn more.',
        fit_score: {
          overall: node.fit_score || 70,
          drivers: [
            {
              factor: 'Skills Match',
              score: node.fit_score ? Math.min(100, node.fit_score + 5) : 75,
              contribution: 40,
              explanation: 'Based on your skills and experience',
            },
            {
              factor: 'Interest Alignment',
              score: node.fit_score || 70,
              contribution: 35,
              explanation: 'Matches your expressed interests',
            },
            {
              factor: 'Growth Potential',
              score: Math.min(100, (node.fit_score || 70) + 10),
              contribution: 25,
              explanation: 'Career trajectory opportunities',
            },
          ],
          confidence: 'medium',
        },
        skills: (node.skills || galaxyRole?.skills || []).map((skill) => ({
          name: skill,
          required: true,
          proficiency: 'intermediate' as const,
        })),
        certifications: [],
        growth_outlook: galaxyRole?.growth_outlook || 'Growing field with good opportunities',
        related_roles: [],
      };
      setSelectedRoleDetail(immediateRoleDetail);

      // Now fetch additional data in parallel (salary + next roles)
      // Don't set loading state since we already have content
      const salaryPromise = fetch('/api/career-explorer/role-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_titles: [node.title] }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const nextRolesPromise = fetch('/api/career-explorer/next-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentRole: node.title, count: 4 }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      // Wait for both to complete
      const [salaryResult, nextRolesResult] = await Promise.all([salaryPromise, nextRolesPromise]);

      // Update with salary data if available
      if (salaryResult?.salaries?.[0]) {
        const salaryData = salaryResult.salaries[0];
        setSelectedRoleDetail((prev) =>
          prev
            ? {
                ...prev,
                description:
                  prev.description === 'Explore this career path to learn more.'
                    ? salaryData.summary || prev.description
                    : prev.description,
                compensation: {
                  min: salaryData.salary_range.min,
                  max: salaryData.salary_range.max,
                  median: salaryData.salary_range.median,
                  currency: 'USD',
                  confidence: {
                    level: salaryData.source === 'BLS' ? 'high' : 'medium',
                    source: salaryData.source === 'BLS' ? 'verified' : 'estimated',
                    tooltip:
                      salaryData.source === 'BLS'
                        ? 'Data from Bureau of Labor Statistics'
                        : 'Estimated based on similar roles',
                  },
                },
                day_in_life: salaryData.summary,
              }
            : prev,
        );
      }

      // Update next career paths if available
      if (nextRolesResult?.roles) {
        const nextRoles: GalaxyRole[] = nextRolesResult.roles;
        setNextCareerPaths(nextRoles);

        // Add next roles to the path graph if not already there
        const newNodes: PathNode[] = nextRoles
          .filter((role) => !pathGraph.nodes.some((n) => n.id === role.id))
          .map((role) => ({
            id: role.id,
            type: 'role' as const,
            title: role.title,
            subtitle: role.category,
            x: 0,
            y: 0,
            fit_score: role.fit_score,
            skills: role.skills,
            is_saved: false,
          }));

        if (newNodes.length > 0) {
          const newEdges = newNodes.map((n) => ({
            id: `edge-${nodeId}-${n.id}`,
            source: nodeId,
            target: n.id,
            label: 'Next step',
            is_main_path: false,
          }));

          setPathGraph((prev) => ({
            nodes: [...prev.nodes, ...newNodes],
            edges: [...prev.edges, ...newEdges],
          }));
        }
      }
    },
    [pathGraph.nodes, galaxyRoles],
  );

  const handleCloseRoleDetail = useCallback(() => {
    setSelectedNodeId(undefined);
    setSelectedRoleDetail(null);
    setNextCareerPaths([]);
    setFocusMode(false); // Exit focus mode on close
  }, []);

  const handleSaveRole = useCallback((roleId: string) => {
    setPathGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === roleId ? { ...n, is_saved: true } : n)),
    }));
  }, []);

  const handleUnsaveRole = useCallback((roleId: string) => {
    setPathGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === roleId ? { ...n, is_saved: false } : n)),
    }));
  }, []);

  const handleAddToPath = useCallback(
    (roleId: string) => {
      // Find the role and add it to the main path
      const node = pathGraph.nodes.find((n) => n.id === roleId);
      if (!node) return;

      const newStep: MainPathStep = {
        _id: `step-${Date.now()}` as Id<'career_main_path_steps'>,
        path_id: 'mock-path' as Id<'career_main_paths'>,
        user_id: 'mock-user' as Id<'users'>,
        index: mainPathSteps.length,
        timeframe: '12m',
        step_type: 'role',
        title: node.title,
        role_id: roleId,
        details: {
          skills_to_build: node.skills || [],
        },
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      setMainPathSteps((prev) => [...prev, newStep]);

      // Also add to placed plan steps for the rail preview
      const newPlacedStep: PlacedStep = {
        id: roleId,
        title: node.title,
        fit_score: node.fit_score,
        index: placedPlanSteps.length,
        role_id: roleId,
      };
      setPlacedPlanSteps((prev) => [...prev, newPlacedStep]);

      // Mark as saved/in path
      handleSaveRole(roleId);

      // Show toast notification
      toast({
        title: `Added ${node.title} to your plan`,
        description: 'View and edit your plan in the Plan tab.',
      });
    },
    [pathGraph.nodes, mainPathSteps.length, placedPlanSteps.length, handleSaveRole, toast],
  );

  // Handler for removing from plan rail
  const handleRemoveFromPlan = useCallback(
    (stepId: string) => {
      setPlacedPlanSteps((prev) => prev.filter((s) => s.id !== stepId));
      setMainPathSteps((prev) => prev.filter((s) => s.role_id !== stepId));
      handleUnsaveRole(stepId);
    },
    [handleUnsaveRole],
  );

  // Handler for going to plan tab
  const handleGoToPlanTab = useCallback(() => {
    setActiveTab('plan');
  }, []);

  const handleSelectRelatedRole = useCallback(
    (roleId: string) => {
      handleNodeSelect(roleId);
    },
    [handleNodeSelect],
  );

  const handleNodeSave = (nodeId: string) => {
    setPathGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, is_saved: !n.is_saved } : n)),
    }));
  };

  // Handle node hover for preview card
  const handleNodeHover = useCallback(
    async (nodeId: string | null, position: { x: number; y: number } | null) => {
      // Update ref synchronously for staleness check after async operations
      hoveredNodeIdRef.current = nodeId;
      setHoveredNodeId(nodeId);
      setHoverPosition(position);

      if (!nodeId) {
        setHoveredSalaryData(null);
        return;
      }

      // Find the node to get its title
      const node = pathGraph.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Check cache first
      const cached = salaryCache.current.get(node.title);
      if (cached) {
        setHoveredSalaryData(cached);
        return;
      }

      // Fetch salary data
      setIsLoadingSalary(true);
      try {
        const response = await fetch('/api/career-explorer/role-salary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_titles: [node.title] }),
        });

        if (response.ok) {
          const data = await response.json();
          // API returns { salaries: [...] }, get the first one
          const salaryData = data.salaries?.[0];
          if (salaryData) {
            // Cache the result
            salaryCache.current.set(node.title, salaryData);
            // Only set if we're still hovering this node (check ref, not stale closure)
            if (hoveredNodeIdRef.current === nodeId) {
              setHoveredSalaryData(salaryData);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching salary data:', error);
      } finally {
        setIsLoadingSalary(false);
      }
    },
    [pathGraph.nodes],
  );

  const handleClosePreview = useCallback(() => {
    setHoveredNodeId(null);
    setHoverPosition(null);
    setHoveredSalaryData(null);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle filter mode change
  const handleFilterModeChange = useCallback((mode: FilterMode) => {
    setFilterMode(mode);
  }, []);

  // Handle category toggle
  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId],
    );
  }, []);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories([]);
  }, []);

  // Compute categories from galaxy roles
  const categories = useMemo((): RoleCategory[] => {
    const categoryMap = new Map<string, number>();
    galaxyRoles.forEach((role) => {
      const count = categoryMap.get(role.category) || 0;
      categoryMap.set(role.category, count + 1);
    });
    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [galaxyRoles]);

  // Filter path graph based on search and filters
  const filteredPathGraph = useMemo((): PathGraph => {
    if (!searchQuery && selectedCategories.length === 0 && filterMode === 'recommended') {
      return pathGraph;
    }

    const filteredNodes = pathGraph.nodes.filter((node) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = node.title.toLowerCase().includes(query);
        const matchesSubtitle = node.subtitle?.toLowerCase().includes(query);
        const matchesSkills = node.skills?.some((s) => s.toLowerCase().includes(query));
        if (!matchesTitle && !matchesSubtitle && !matchesSkills) {
          return false;
        }
      }

      // Category filter
      if (selectedCategories.length > 0) {
        const nodeCategory = node.subtitle?.toLowerCase().replace(/\s+/g, '-');
        if (!nodeCategory || !selectedCategories.includes(nodeCategory)) {
          return false;
        }
      }

      // Filter mode - only show recommended (high fit score) if in recommended mode
      if (filterMode === 'recommended' && node.fit_score !== undefined && node.fit_score < 50) {
        return false;
      }

      return true;
    });

    return {
      nodes: filteredNodes,
      edges: pathGraph.edges.filter(
        (edge) =>
          filteredNodes.some((n) => n.id === edge.source) &&
          filteredNodes.some((n) => n.id === edge.target),
      ),
    };
  }, [pathGraph, searchQuery, selectedCategories, filterMode]);

  // Restore state from saved explorer state when returning to page
  useEffect(() => {
    if (explorerState && explorerState.completed_steps?.includes(4)) {
      // Restore placed steps from saved state
      if (explorerState.placed_steps && explorerState.placed_steps.length > 0) {
        setPlacedPlanSteps(explorerState.placed_steps);

        // Convert to main path steps
        const restoredMainPathSteps: MainPathStep[] = explorerState.placed_steps.map(
          (step, index) => ({
            _id: `step-${step.id}` as Id<'career_main_path_steps'>,
            path_id: 'mock-path' as Id<'career_main_paths'>,
            user_id: 'mock-user' as Id<'users'>,
            index,
            timeframe: '12m' as const,
            step_type: 'role' as const,
            title: step.title,
            role_id: step.role_id,
            details: {},
            created_at: Date.now(),
            updated_at: Date.now(),
          }),
        );
        setMainPathSteps(restoredMainPathSteps);
      }

      // Restore anchor node from starting role
      if (explorerState.starting_role) {
        setAnchorNode({
          id: explorerState.starting_role.id,
          title: explorerState.starting_role.title,
          subtitle: explorerState.starting_role.category,
          source: 'profile',
        });
      }
    }
  }, [explorerState]);

  // Handle wizard completion
  const handleWizardComplete = useCallback((state: CareerExplorerState, steps: PlacedStep[]) => {
    // Mark wizard as completed this session and exit edit mode
    setWizardCompletedThisSession(true);
    setIsEditingPath(false);

    // Set placed steps from wizard
    setPlacedPlanSteps(steps);

    // Convert to main path steps
    const newMainPathSteps: MainPathStep[] = steps.map((step, index) => ({
      _id: `step-${step.id}` as Id<'career_main_path_steps'>,
      path_id: 'mock-path' as Id<'career_main_paths'>,
      user_id: 'mock-user' as Id<'users'>,
      index,
      timeframe: '12m' as const,
      step_type: 'role' as const,
      title: step.title,
      role_id: step.role_id,
      details: {},
      created_at: Date.now(),
      updated_at: Date.now(),
    }));
    setMainPathSteps(newMainPathSteps);

    // Set anchor node from starting role
    if (state.starting_role) {
      setAnchorNode({
        id: state.starting_role.id,
        title: state.starting_role.title,
        subtitle: state.starting_role.category,
        source: 'profile',
      });
    }

    // Switch to Plan tab to show the PathSummaryScreen
    setActiveTab('plan');
  }, []);

  // Render content based on current view
  const renderExploreContent = () => {
    // STATE A: Loading explorer state
    if (explorerState === undefined) {
      return <CareerWizardSkeleton />;
    }

    // Check if wizard was previously completed (step 4 in completed_steps)
    const wasWizardPreviouslyCompleted = explorerState?.completed_steps?.includes(4) ?? false;

    // STATE B: Show wizard if:
    // - Not completed this session AND not previously completed (new user)
    // - OR user is editing their path (returned from PathSummaryScreen)
    if ((!wizardCompletedThisSession && !wasWizardPreviouslyCompleted) || isEditingPath) {
      return (
        <CareerWizard
          ref={wizardRef}
          initialState={explorerState}
          onComplete={handleWizardComplete}
          onStepChange={(step, canSave) => setWizardCanSave(canSave)}
        />
      );
    }

    // STATE C: Wizard previously completed - show PathwaysStep with saved data
    // Need starting_role and placed_steps from explorerState
    if (!explorerState?.starting_role || !explorerState?.placed_steps) {
      // Fallback if data is missing - show simple card
      return (
        <div className="max-w-2xl mx-auto py-12">
          <Card className="text-center">
            <CardHeader>
              <CardTitle>Career Path Created!</CardTitle>
              <CardDescription>View your career plan in the Plan tab.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => setActiveTab('plan')}>View My Plan</Button>
              <div className="pt-4 border-t border-neutral-200 mt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-neutral-500"
                  onClick={async () => {
                    await clearExplorerState();
                    setWizardCompletedThisSession(false);
                    setIsEditingPath(false);
                    setPlacedPlanSteps([]);
                    setMainPathSteps([]);
                    setAnchorNode(null);
                    setEditedPlacedSteps(null);
                    toast({
                      title: 'Career Explorer reset',
                      description: 'You can start fresh with a new path.',
                    });
                  }}
                >
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show PathwaysStep with saved data in view/edit mode
    return (
      <div className="w-full">
        <PathwaysStep
          startingRole={explorerState.starting_role}
          skillsHave={explorerState.skills_have || []}
          skillsWant={explorerState.skills_want || []}
          placedSteps={editedPlacedSteps ?? explorerState.placed_steps}
          showSaveButton={false}
          onPlaceStep={(step) => {
            // Track changes in editedPlacedSteps for the header save button
            setEditedPlacedSteps((prev) => {
              const current = prev ?? explorerState.placed_steps ?? [];
              return [...current, step];
            });
            // Also update placedPlanSteps state
            setPlacedPlanSteps((prev) => [...prev, step]);
          }}
          onRemoveStep={(stepId) => {
            // Track changes in editedPlacedSteps
            setEditedPlacedSteps((prev) => {
              const current = prev ?? explorerState.placed_steps ?? [];
              return current.filter((s) => s.id !== stepId);
            });
            setPlacedPlanSteps((prev) => prev.filter((s) => s.id !== stepId));
          }}
          onFinish={async (completePath) => {
            // Save and go to Plan tab
            try {
              await saveExplorerState({
                starting_role: explorerState.starting_role,
                skills_have: explorerState.skills_have,
                skills_want: explorerState.skills_want,
                placed_steps: completePath,
                current_step: 4,
                completed_steps: [1, 2, 3, 4],
              });
              // Clear edited steps since we're saving
              setEditedPlacedSteps(null);
              setActiveTab('plan');
              toast({
                title: 'Career path saved!',
                description: 'View your career plan in the Plan tab.',
              });
            } catch (error) {
              console.error('Failed to save:', error);
              toast({
                title: 'Save failed',
                description: 'Please try again.',
                variant: 'destructive',
              });
            }
          }}
        />
        {/* Start Over button */}
        <div className="flex justify-center mt-8 pt-6 border-t border-neutral-200">
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-500"
            onClick={async () => {
              await clearExplorerState();
              setWizardCompletedThisSession(false);
              setIsEditingPath(false);
              setPlacedPlanSteps([]);
              setMainPathSteps([]);
              setAnchorNode(null);
              setEditedPlacedSteps(null);
              toast({
                title: 'Career Explorer reset',
                description: 'You can start fresh with a new path.',
              });
            }}
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  };

  if (!userLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full rounded-3xl bg-white p-5 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Career Explorer</h1>
            <p className="text-muted-foreground">Discover and plan your ideal career path</p>
          </div>
          {activeTab === 'explore' &&
            (explorerState?.completed_steps?.includes(4) || wizardCanSave) && (
              <Button
                onClick={async () => {
                  // If in wizard, use the wizard ref to save
                  if (wizardCanSave && wizardRef.current) {
                    await wizardRef.current.save();
                    return;
                  }
                  // Otherwise, save from explorer state (returning user editing)
                  // Use editedPlacedSteps if user made changes, otherwise use saved data
                  const stepsToSave = editedPlacedSteps ?? explorerState?.placed_steps;
                  if (!explorerState?.starting_role || !stepsToSave || stepsToSave.length === 0) {
                    toast({
                      title: 'No path to save',
                      description: 'Please select at least one role.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  try {
                    await saveExplorerState({
                      starting_role: explorerState.starting_role,
                      skills_have: explorerState.skills_have,
                      skills_want: explorerState.skills_want,
                      placed_steps: stepsToSave,
                      current_step: 4,
                      completed_steps: [1, 2, 3, 4],
                    });
                    // Clear edited steps since we saved
                    setEditedPlacedSteps(null);
                    setActiveTab('plan');
                    toast({
                      title: 'Career path saved!',
                      description: 'View your career plan in the Plan tab.',
                    });
                  } catch (error) {
                    console.error('Failed to save:', error);
                    toast({
                      title: 'Save failed',
                      description: 'Please try again.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="min-w-[160px]"
              >
                Save Career Path
              </Button>
            )}
        </div>

        {/* Tab Toggle - 3 tabs: Explorer, Plan, Career Profile */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'explore'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            Explorer
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plan'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            Plan
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-primary-500 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-gray-300'
            }`}
          >
            Career Profile
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'explore' && renderExploreContent()}

          {activeTab === 'plan' &&
            // Show PathSummaryScreen if wizard is completed with placed steps
            (explorerState?.completed_steps?.includes(4) &&
            explorerState?.placed_steps &&
            explorerState.placed_steps.length > 0 &&
            explorerState.starting_role ? (
              <PathSummaryScreen
                userName={user?.fullName || user?.firstName || 'User'}
                userTitle={explorerState.starting_role.title}
                startingRole={explorerState.starting_role}
                placedSteps={explorerState.placed_steps}
                onBack={() => {
                  // Go back to wizard step 3 to edit path
                  setActiveTab('explore');
                }}
                onUpdatePath={() => {
                  // Go back to Explore tab to edit path with saved selections
                  setIsEditingPath(true);
                  setActiveTab('explore');
                }}
              />
            ) : (
              <MainPathEditor
                path={mainPath || undefined}
                steps={mainPathSteps}
                onAddStep={(data) => {
                  const newStep: MainPathStep = {
                    _id: `step-${Date.now()}` as Id<'career_main_path_steps'>,
                    path_id: 'mock-path' as Id<'career_main_paths'>,
                    user_id: 'mock-user' as Id<'users'>,
                    index: mainPathSteps.length,
                    timeframe: data.timeframe,
                    step_type: data.step_type,
                    title: data.title,
                    details: data.details,
                    notes: data.notes,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                  };
                  setMainPathSteps((prev) => [...prev, newStep]);
                }}
                onDeleteStep={(stepId) => {
                  setMainPathSteps((prev) => prev.filter((s) => s._id !== stepId));
                }}
                onUpdateStep={(stepId, data) => {
                  setMainPathSteps((prev) =>
                    prev.map((s) =>
                      s._id === stepId ? { ...s, ...data, updated_at: Date.now() } : s,
                    ),
                  );
                }}
                onReorderSteps={(orderedIds) => {
                  setMainPathSteps((prev) => {
                    const stepMap = new Map(prev.map((s) => [s._id, s]));
                    return orderedIds
                      .map((id, index) => {
                        const step = stepMap.get(id);
                        return step ? { ...step, index } : null;
                      })
                      .filter((s): s is MainPathStep => s !== null);
                  });
                }}
              />
            ))}

          {activeTab === 'profile' &&
            (explorerState?.starting_role ? (
              <div className="space-y-6">
                {/* V4 Wizard Profile Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Career Profile</CardTitle>
                    <CardDescription>Based on your wizard selections</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Starting Role */}
                    {explorerState.starting_role && (
                      <div className="p-4 bg-primary-50 rounded-lg">
                        <p className="text-sm text-neutral-500 mb-1">Starting Role</p>
                        <p className="font-medium text-lg">{explorerState.starting_role.title}</p>
                        {explorerState.starting_role.category && (
                          <p className="text-sm text-neutral-600">
                            {explorerState.starting_role.category}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Skills */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {explorerState.skills_have && explorerState.skills_have.length > 0 && (
                        <div className="p-4 bg-emerald-50 rounded-lg">
                          <p className="text-sm text-emerald-600 font-medium mb-2">
                            Skills You Have
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {explorerState.skills_have.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {explorerState.skills_want && explorerState.skills_want.length > 0 && (
                        <div className="p-4 bg-primary-50 rounded-lg">
                          <p className="text-sm text-primary-600 font-medium mb-2">
                            Skills You Want
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {explorerState.skills_want.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Restart Option */}
                    <div className="pt-4 border-t border-neutral-200">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await clearExplorerState();
                          setWizardCompletedThisSession(false);
                          setPlacedPlanSteps([]);
                          setMainPathSteps([]);
                          setEditedPlacedSteps(null);
                          setActiveTab('explore');
                          toast({
                            title: 'Career Explorer reset',
                            description: 'You can start fresh with a new path.',
                          });
                        }}
                      >
                        Restart Career Explorer
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Legacy Quiz Results if available */}
                {quizResult && (
                  <QuizResults
                    result={quizResult}
                    onExploreBundle={handleExploreBundle}
                    onRetakeQuiz={handleStartQuiz}
                    onViewPath={() => {
                      setCurrentView('explore');
                      setActiveTab('explore');
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="max-w-xl mx-auto py-12">
                <Card className="text-center">
                  <CardHeader>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mx-auto mb-4">
                      <Compass className="w-8 h-8 text-neutral-400" />
                    </div>
                    <CardTitle>No Career Profile Yet</CardTitle>
                    <CardDescription>
                      Complete the career explorer wizard to build your personalized career profile.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => {
                        setActiveTab('explore');
                      }}
                    >
                      Start Career Explorer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
