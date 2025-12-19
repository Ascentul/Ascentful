'use client';

import { CheckCircle2, Compass, Search, Sparkles } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { QuickStartActions } from './QuickStartActions';

interface CareerExplorerLandingProps {
  onStartQuiz: () => void;
  onQuickStart: (action: string) => void;
  hasQuizResults?: boolean;
  userName?: string;
}

export function CareerExplorerLanding({
  onStartQuiz,
  onQuickStart,
  hasQuizResults,
  userName,
}: CareerExplorerLandingProps) {
  // If user has quiz results, show a simplified layout focused on exploration
  if (hasQuizResults) {
    return (
      <div className="max-w-xl mx-auto">
        {/* Quick Start */}
        <Card className="relative overflow-hidden border-2 border-primary-200 hover:border-primary-400 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Search className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Quick Explore</CardTitle>
                <CardDescription>Search & browse</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuickStartActions onAction={onQuickStart} compact />
          </CardContent>
        </Card>
      </div>
    );
  }

  // First-time user layout with prominent quiz card
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
          <Compass className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900">
          {userName ? `Welcome, ${userName}!` : 'Career Path Explorer'}
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          Discover your ideal career path through our guided exploration. Take our comprehensive
          quiz or jump right in and start exploring roles.
        </p>
      </div>

      {/* Two Entry Points */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Quiz Path */}
        <Card className="relative overflow-hidden border-2 border-primary-200 hover:border-primary-400 transition-colors cursor-pointer group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-bl-full -mr-8 -mt-8" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Take the Career Quiz</CardTitle>
                <CardDescription>~5 minutes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-neutral-600">
              Answer questions about your interests, values, and goals to get personalized career
              path recommendations tailored just for you.
            </p>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                Get matched with career directions
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                Discover roles you may not have considered
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                Receive 3 path bundles: Safe, Ambitious, Alternative
              </li>
            </ul>
            <Button onClick={onStartQuiz} className="w-full group-hover:bg-primary-600">
              Start Quiz
            </Button>
          </CardContent>
        </Card>

        {/* Quick Explore Path */}
        <Card className="relative overflow-hidden border-2 border-neutral-200 hover:border-neutral-400 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neutral-50 rounded-bl-full -mr-8 -mt-8" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <Search className="w-6 h-6 text-neutral-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Quick Start</CardTitle>
                <CardDescription>Jump right in</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-neutral-600">
              Already know what you&apos;re looking for? Start exploring career paths immediately
              based on a specific role or your major.
            </p>
            <QuickStartActions onAction={onQuickStart} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
