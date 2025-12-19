'use client';

import {
  ArrowRight,
  CheckCircle2,
  Compass,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { BundleType, QuizResult } from '@/lib/career-explorer/types';

interface QuizResultsProps {
  result: QuizResult;
  onExploreBundle: (bundleType: BundleType) => void;
  onRetakeQuiz: () => void;
  onViewPath: () => void;
}

const BUNDLE_ICONS: Record<BundleType, React.ReactNode> = {
  safe: <Shield className="w-5 h-5" />,
  ambitious: <Rocket className="w-5 h-5" />,
  alternative: <Sparkles className="w-5 h-5" />,
};

const BUNDLE_COLORS: Record<BundleType, string> = {
  safe: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  ambitious: 'bg-violet-50 border-violet-200 text-violet-700',
  alternative: 'bg-amber-50 border-amber-200 text-amber-700',
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  exploration: { label: 'Exploring', color: 'bg-blue-100 text-blue-700' },
  leaning: { label: 'Leaning', color: 'bg-amber-100 text-amber-700' },
  locked_in: { label: 'Confident', color: 'bg-emerald-100 text-emerald-700' },
};

export function QuizResults({
  result,
  onExploreBundle,
  onRetakeQuiz,
  onViewPath,
}: QuizResultsProps) {
  const confidenceInfo =
    CONFIDENCE_LABELS[result.confidence_level] || CONFIDENCE_LABELS.exploration;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100">
          <Compass className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900">Your Career Profile</h1>
        <div className="flex items-center justify-center gap-2">
          <Badge className={confidenceInfo.color}>{confidenceInfo.label}</Badge>
          <span className="text-neutral-500">Based on your quiz responses</span>
        </div>
      </div>

      {/* Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-500" />
            Your Key Themes
          </CardTitle>
          <CardDescription>Patterns we identified from your responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.themes.map((theme, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{theme.name}</span>
                <span className="text-sm text-neutral-500">{theme.weight}%</span>
              </div>
              <Progress value={theme.weight} className="h-2" />
              <p className="text-sm text-neutral-600">{theme.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommended Directions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            Recommended Directions
          </CardTitle>
          <CardDescription>Career directions that align with your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {result.recommended_directions.map((direction, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-neutral-50 rounded-lg">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-600">{direction.fit_score}%</span>
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium">{direction.title}</h4>
                  <p className="text-sm text-neutral-600">{direction.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Path Bundles */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Suggested Path Bundles</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {result.suggested_bundles.map((bundle) => (
            <Card
              key={bundle.bundle_type}
              className={`cursor-pointer transition-all hover:shadow-md ${BUNDLE_COLORS[bundle.bundle_type]}`}
              onClick={() => onExploreBundle(bundle.bundle_type)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {BUNDLE_ICONS[bundle.bundle_type]}
                  <CardTitle className="text-base capitalize">{bundle.bundle_type} Path</CardTitle>
                </div>
                <CardDescription className="text-current opacity-80">{bundle.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">Getting Started:</p>
                <ul className="space-y-1.5">
                  {bundle.starter_checklist.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-center gap-1 text-sm font-medium mt-2 pt-2 border-t opacity-80">
                  Click to explore
                  <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Roles to Explore */}
      <Card>
        <CardHeader>
          <CardTitle>Roles to Explore</CardTitle>
          <CardDescription>Specific roles that match your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {result.roles_to_explore.map((role) => (
              <div
                key={role.role_id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">{role.title}</p>
                  <p className="text-xs text-neutral-500">{role.reason}</p>
                </div>
                <Badge variant="outline" className="ml-2">
                  {role.fit_score}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-4">
        <Button variant="outline" onClick={onRetakeQuiz}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retake Quiz
        </Button>
        <Button onClick={onViewPath}>
          View in Path Galaxy
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
