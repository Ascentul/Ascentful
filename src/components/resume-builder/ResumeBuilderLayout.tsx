'use client';

import React from 'react';

import { calculateResumeScore } from '@/lib/resume-score';

import { EditCustomizeToggle } from './EditCustomizeToggle';
import type { ResumeBuilderActions, ResumeBuilderState, STEPS } from './hooks/useResumeBuilder';
import { LivePreview } from './preview/LivePreview';
import { ResumeScoreIndicator } from './ResumeScoreIndicator';
import { StepNavigation } from './StepNavigation';

interface ResumeBuilderLayoutProps {
  state: ResumeBuilderState;
  actions: ResumeBuilderActions;
  editContent: React.ReactNode;
  customizeContent: React.ReactNode;
  onFinish?: () => void;
}

export function ResumeBuilderLayout({
  state,
  actions,
  editContent,
  customizeContent,
  onFinish,
}: ResumeBuilderLayoutProps) {
  const score = calculateResumeScore(state.resumeData);

  return (
    <div className="flex h-screen bg-neutral-100">
      {/* Left Panel - Form/Customization */}
      <div className="w-1/2 flex flex-col bg-white border-r border-slate-200">
        {/* Top bar with toggle */}
        <div className="px-6 py-4 border-b border-slate-200">
          <EditCustomizeToggle mode={state.mode} onModeChange={actions.setMode} />
        </div>

        {/* Score indicator (only in edit mode) */}
        {state.mode === 'edit' && (
          <div className="px-6 py-3 border-b border-slate-100">
            <ResumeScoreIndicator score={score} />
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {state.mode === 'edit' ? editContent : customizeContent}
        </div>

        {/* Bottom navigation (only in edit mode) */}
        {state.mode === 'edit' && (
          <StepNavigation
            currentStep={state.currentStep}
            onStepChange={actions.setCurrentStep}
            onNext={actions.nextStep}
            onPrev={actions.prevStep}
            onFinish={onFinish}
          />
        )}
      </div>

      {/* Right Panel - Live Preview */}
      <div className="w-1/2">
        <LivePreview data={state.resumeData} templateId={state.templateId} theme={state.theme} />
      </div>
    </div>
  );
}
