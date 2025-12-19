'use client';

import { api } from 'convex/_generated/api';
import { useMutation } from 'convex/react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useToast } from '@/hooks/use-toast';
import type { CareerExplorerState, PlacedStep, StartingRole } from '@/lib/career-explorer/types';

import { PathwaysStep } from './PathwaysStep';
import { RoleSearchStep } from './RoleSearchStep';
import { SkillsStep } from './SkillsStep';

export interface CareerWizardHandle {
  save: () => Promise<void>;
}

interface CareerWizardProps {
  initialState?: CareerExplorerState | null;
  onComplete: (state: CareerExplorerState, placedSteps: PlacedStep[]) => void;
  onStepChange?: (step: number, canSave: boolean) => void;
}

export const CareerWizard = forwardRef<CareerWizardHandle, CareerWizardProps>(function CareerWizard(
  { initialState, onComplete, onStepChange },
  ref,
) {
  const { toast } = useToast();
  const saveExplorerState = useMutation(api.career_explorer.saveExplorerState);

  // Wizard state
  // If wizard was previously completed (step 4), go back to step 3 for editing
  const getInitialStep = () => {
    if (!initialState?.current_step) return 1;
    // If completed (step 4), go to step 3 to edit the path
    if (initialState.current_step >= 4) return 3;
    return initialState.current_step;
  };
  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    initialState?.completed_steps || [],
  );

  // Step 1: Starting Role
  const [startingRole, setStartingRole] = useState<StartingRole | null>(
    initialState?.starting_role || null,
  );

  // Step 2: Skills
  const [skillsHave, setSkillsHave] = useState<string[]>(initialState?.skills_have || []);
  const [skillsWant, setSkillsWant] = useState<string[]>(initialState?.skills_want || []);

  // Step 3: Pathways - restore from saved state if available
  const [placedSteps, setPlacedSteps] = useState<PlacedStep[]>(initialState?.placed_steps || []);

  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save state to Convex
  const saveState = useCallback(async () => {
    try {
      await saveExplorerState({
        starting_role: startingRole || undefined,
        skills_have: skillsHave.length > 0 ? skillsHave : undefined,
        skills_want: skillsWant.length > 0 ? skillsWant : undefined,
        placed_steps: placedSteps.length > 0 ? placedSteps : undefined,
        current_step: currentStep,
        completed_steps: completedSteps,
      });
    } catch (error) {
      console.error('Failed to save explorer state:', error);
    }
  }, [
    saveExplorerState,
    startingRole,
    skillsHave,
    skillsWant,
    placedSteps,
    currentStep,
    completedSteps,
  ]);

  // Debounced auto-save
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveState();
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [startingRole, skillsHave, skillsWant, placedSteps, currentStep, completedSteps, saveState]);

  // Step navigation
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleStep1Continue = () => {
    if (startingRole) {
      setCompletedSteps((prev) => (prev.includes(1) ? prev : [...prev, 1]));
      goToStep(2);
    }
  };

  const handleStep2Continue = () => {
    setCompletedSteps((prev) => (prev.includes(2) ? prev : [...prev, 2]));
    goToStep(3);
  };

  const handleStep2Back = () => {
    goToStep(1);
  };

  const handleStep3Back = () => {
    goToStep(2);
  };

  const handlePlaceStep = (step: PlacedStep) => {
    setPlacedSteps((prev) => [...prev, step]);
  };

  const handleRemoveStep = (stepId: string) => {
    setPlacedSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const handleFinish = useCallback(
    async (completePath: PlacedStep[]) => {
      // Validate: require at least one career path step
      if (completePath.length === 0) {
        toast({
          title: 'No career path selected',
          description: 'Please select at least one role to build your career path.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state with the complete path from PathwaysStep
      setPlacedSteps(completePath);

      // Mark all steps as complete (wizard is done, Plan tab will show summary)
      const finalCompletedSteps = [1, 2, 3, 4];
      setCompletedSteps(finalCompletedSteps);

      // Save final state (including placed steps)
      try {
        await saveExplorerState({
          starting_role: startingRole || undefined,
          skills_have: skillsHave.length > 0 ? skillsHave : undefined,
          skills_want: skillsWant.length > 0 ? skillsWant : undefined,
          placed_steps: completePath,
          current_step: 4,
          completed_steps: finalCompletedSteps,
        });

        toast({
          title: 'Career path saved!',
          description: 'View your career plan in the Plan tab.',
        });

        // Call completion handler - this will switch to Plan tab
        onComplete(
          {
            user_id: '',
            starting_role: startingRole || undefined,
            skills_have: skillsHave,
            skills_want: skillsWant,
            placed_steps: completePath,
            current_step: 4,
            completed_steps: finalCompletedSteps,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          completePath,
        );
      } catch (error) {
        console.error('Failed to save state:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast({
          title: 'Save failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [startingRole, skillsHave, skillsWant, saveExplorerState, toast, onComplete],
  );

  // Expose save method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      save: async () => {
        if (currentStep === 3 && placedSteps.length > 0) {
          await handleFinish(placedSteps);
        }
      },
    }),
    [currentStep, placedSteps, handleFinish],
  );

  // Notify parent when step changes
  useEffect(() => {
    const canSave = currentStep === 3 && placedSteps.length > 0;
    onStepChange?.(currentStep, canSave);
  }, [currentStep, placedSteps.length, onStepChange]);

  return (
    <div className="w-full">
      {currentStep === 1 && (
        <RoleSearchStep
          selectedRole={startingRole}
          onRoleSelect={setStartingRole}
          onContinue={handleStep1Continue}
        />
      )}

      {currentStep === 2 && startingRole && (
        <SkillsStep
          startingRole={startingRole}
          skillsHave={skillsHave}
          skillsWant={skillsWant}
          onSkillsHaveChange={setSkillsHave}
          onSkillsWantChange={setSkillsWant}
          onContinue={handleStep2Continue}
          onBack={handleStep2Back}
        />
      )}

      {currentStep === 3 && startingRole && (
        <PathwaysStep
          startingRole={startingRole}
          skillsHave={skillsHave}
          skillsWant={skillsWant}
          placedSteps={placedSteps}
          showSaveButton={false}
          onPlaceStep={handlePlaceStep}
          onRemoveStep={handleRemoveStep}
          onFinish={handleFinish}
          onBack={handleStep3Back}
        />
      )}
    </div>
  );
});
