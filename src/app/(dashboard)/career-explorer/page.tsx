'use client';

import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Bookmark, Compass, FileText, Map as MapIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import {
  CareerExplorerLanding,
  ContextBubble,
  MainPathEditor,
  PathGalaxyView,
  QuizResults,
  QuizWizard,
} from '@/components/career-explorer';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  BundleType,
  ExplorerView,
  MainPath,
  MainPathStep,
  MajorContext,
  PathGraph,
  QuizAnswers,
  QuizResult,
} from '@/lib/career-explorer/types';

// Default major context
const DEFAULT_MAJOR_CONTEXT: MajorContext = {
  enabled: true,
  closeness: 50,
  open_to_unrelated: true,
  grad_school_interest: 'none',
};

// Sample path graph for demo purposes
const SAMPLE_PATH_GRAPH: PathGraph = {
  nodes: [
    {
      id: 'current',
      type: 'current',
      title: 'Your Current Position',
      subtitle: 'Starting point',
      x: 60,
      y: 300,
      is_main_path: true,
    },
    {
      id: 'role-1',
      type: 'role',
      title: 'Junior Developer',
      subtitle: 'Entry level position',
      x: 380,
      y: 200,
      fit_score: 85,
      skills: ['JavaScript', 'React', 'Git'],
      is_main_path: true,
    },
    {
      id: 'role-2',
      type: 'role',
      title: 'Software Engineer',
      subtitle: 'Mid-level position',
      x: 380,
      y: 350,
      fit_score: 78,
      skills: ['TypeScript', 'Node.js', 'SQL'],
    },
    {
      id: 'role-3',
      type: 'role',
      title: 'Data Analyst',
      subtitle: 'Alternative path',
      x: 380,
      y: 500,
      fit_score: 65,
      skills: ['Python', 'SQL', 'Tableau'],
    },
    {
      id: 'bridge-1',
      type: 'bridge',
      title: 'Bootcamp',
      x: 220,
      y: 400,
    },
    {
      id: 'target',
      type: 'target',
      title: 'Senior Engineer',
      subtitle: 'Target role',
      x: 700,
      y: 300,
      fit_score: 92,
      is_main_path: true,
    },
  ],
  edges: [
    { id: 'e1', source: 'current', target: 'role-1', is_main_path: true },
    { id: 'e2', source: 'current', target: 'bridge-1' },
    { id: 'e3', source: 'bridge-1', target: 'role-2' },
    { id: 'e4', source: 'bridge-1', target: 'role-3' },
    { id: 'e5', source: 'role-1', target: 'target', label: '2-3 years', is_main_path: true },
    { id: 'e6', source: 'role-2', target: 'target', label: '3-4 years' },
  ],
};

export default function CareerExplorerPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const [currentView, setCurrentView] = useState<ExplorerView>('landing');
  const [activeTab, setActiveTab] = useState('explore');
  const [majorContext, setMajorContext] = useState<MajorContext>(DEFAULT_MAJOR_CONTEXT);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [pathGraph, setPathGraph] = useState<PathGraph>(SAMPLE_PATH_GRAPH);

  // Mock quiz result for demo
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Mock main path data for demo
  const [mainPath] = useState<MainPath | null>(null);
  const [mainPathSteps, setMainPathSteps] = useState<MainPathStep[]>([]);

  // TODO: Replace with actual Convex queries when backend is ready
  // const convexUser = useQuery(api.users.getCurrentUser, userLoaded && user ? { clerkId: user.id } : 'skip');
  // const quizResult = useQuery(api.career_explorer.getLatestQuizResult, convexUser?._id ? { userId: convexUser._id } : 'skip');
  // const mainPath = useQuery(api.career_explorer.getUserMainPath, convexUser?._id ? { userId: convexUser._id } : 'skip');

  const handleStartQuiz = () => {
    setCurrentView('quiz');
  };

  const handleQuickStart = (action: string, data?: string) => {
    switch (action) {
      case 'search-role':
        console.log('Searching for role:', data);
        setCurrentView('explore');
        break;
      case 'from-major':
        console.log('Generating paths from major');
        setCurrentView('explore');
        break;
      case 'from-dream-job':
        console.log('Generating paths from dream job');
        setCurrentView('explore');
        break;
      case 'trending':
        console.log('Showing trending paths');
        setCurrentView('explore');
        break;
      case 'browse-industry':
        console.log('Browsing industry:', data);
        setCurrentView('explore');
        break;
      case 'view-results':
        setActiveTab('results');
        setCurrentView('results');
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const handleQuizComplete = async (answers: QuizAnswers) => {
    setIsSubmittingQuiz(true);

    // TODO: Replace with actual API call
    // const response = await fetch('/api/career-explorer/quiz/submit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ answers, majorContext }),
    // });
    // const result = await response.json();

    // For now, create a mock result
    const mockResult: QuizResult = {
      _id: 'mock-id' as Id<'career_quiz_results'>,
      user_id: 'mock-user-id' as Id<'users'>,
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
        { role_id: 'ds-1', title: 'Data Scientist', reason: 'Analytical strengths', fit_score: 72 },
        {
          role_id: 'fe-1',
          title: 'Frontend Developer',
          reason: 'Technical and creative',
          fit_score: 70,
        },
        { role_id: 'ux-1', title: 'UX Engineer', reason: 'Technical + user focus', fit_score: 68 },
        {
          role_id: 'devrel-1',
          title: 'Developer Relations',
          reason: 'Technical + communication',
          fit_score: 65,
        },
      ],
      suggested_bundles: [
        {
          bundle_type: 'safe',
          name: 'Traditional Tech Path',
          path_graph: { nodes: [], edges: [] },
          starter_checklist: [
            'Build a portfolio project',
            'Practice coding interviews',
            'Apply to entry-level positions',
          ],
        },
        {
          bundle_type: 'ambitious',
          name: 'Startup Track',
          path_graph: { nodes: [], edges: [] },
          starter_checklist: ['Join a hackathon', 'Network with founders', 'Build a side project'],
        },
        {
          bundle_type: 'alternative',
          name: 'Product-Technical Hybrid',
          path_graph: { nodes: [], edges: [] },
          starter_checklist: [
            'Take a PM course',
            'Shadow a product team',
            'Lead a feature project',
          ],
        },
      ],
      confidence_level: 'leaning',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    setTimeout(() => {
      setQuizResult(mockResult);
      setIsSubmittingQuiz(false);
      setCurrentView('results');
      setActiveTab('results');
    }, 1500);
  };

  const handleQuizCancel = () => {
    setCurrentView('landing');
  };

  const handleExploreBundle = (bundleType: BundleType) => {
    console.log('Exploring bundle:', bundleType);
    setCurrentView('explore');
    setActiveTab('explore');
  };

  const handleContextApply = () => {
    console.log('Applying context:', majorContext);
    // TODO: Re-generate paths with new context
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const handleNodeSave = (nodeId: string) => {
    setPathGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, is_saved: !n.is_saved } : n)),
    }));
  };

  // Render content based on current view
  const renderExploreContent = () => {
    if (currentView === 'landing') {
      return (
        <CareerExplorerLanding
          onStartQuiz={handleStartQuiz}
          onQuickStart={handleQuickStart}
          hasQuizResults={!!quizResult}
          userName={user?.firstName || undefined}
        />
      );
    }

    if (currentView === 'quiz') {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={handleQuizCancel} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <QuizWizard
            majorContext={majorContext}
            onComplete={handleQuizComplete}
            onCancel={handleQuizCancel}
            isSubmitting={isSubmittingQuiz}
          />
        </div>
      );
    }

    // Default explore view with path galaxy
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCurrentView('landing')} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Start
          </Button>
        </div>

        <ContextBubble
          majorContext={majorContext}
          onContextChange={setMajorContext}
          onApply={handleContextApply}
        />

        <PathGalaxyView
          graph={pathGraph}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          onNodeSave={handleNodeSave}
        />
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
    <div className="space-y-6 p-6">
      <PageHeader title="Career Explorer" description="Discover and plan your ideal career path" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="explore" className="gap-2">
            <Compass className="w-4 h-4" />
            Explore
          </TabsTrigger>
          <TabsTrigger value="main-path" className="gap-2">
            <MapIcon className="w-4 h-4" />
            My Path
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-2">
            <Bookmark className="w-4 h-4" />
            Saved
          </TabsTrigger>
          {quizResult && (
            <TabsTrigger value="results" className="gap-2">
              <FileText className="w-4 h-4" />
              Quiz Results
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="explore" className="space-y-6">
          {renderExploreContent()}
        </TabsContent>

        <TabsContent value="main-path">
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
                prev.map((s) => (s._id === stepId ? { ...s, ...data, updated_at: Date.now() } : s)),
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
        </TabsContent>

        <TabsContent value="saved">
          <div className="text-center py-12 text-neutral-500">
            <Bookmark className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <h3 className="font-medium mb-1">No saved roles yet</h3>
            <p className="text-sm">Save roles from the Path Galaxy to compare them here</p>
          </div>
        </TabsContent>

        {quizResult && (
          <TabsContent value="results">
            <QuizResults
              result={quizResult}
              onExploreBundle={handleExploreBundle}
              onRetakeQuiz={handleStartQuiz}
              onViewPath={() => {
                setCurrentView('explore');
                setActiveTab('explore');
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
