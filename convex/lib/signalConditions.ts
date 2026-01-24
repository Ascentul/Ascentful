/**
 * Signal Condition Evaluation Utilities
 *
 * Pure functions for evaluating signal trigger conditions.
 * These are extracted from the main signals.ts to enable unit testing
 * without requiring Convex database context.
 */

/**
 * Check if inactivity threshold has been exceeded.
 *
 * @param daysSinceActivity - Days since last activity (null if never active)
 * @param thresholdDays - The threshold in days
 * @returns true if inactivity exceeds threshold
 */
export function checkInactivityCondition(
  daysSinceActivity: number | null,
  thresholdDays: number,
): boolean {
  if (daysSinceActivity === null) return true; // No activity ever = triggered
  return daysSinceActivity > thresholdDays;
}

/**
 * Check if high intent but low conversion condition is met.
 *
 * @param applicationCount - Number of applications submitted
 * @param applicationsThreshold - Minimum applications to consider "high intent"
 * @param hasAppointment - Whether user has scheduled an appointment
 * @returns true if high intent but no conversion action taken
 */
export function checkHighIntentLowConversionCondition(
  applicationCount: number,
  applicationsThreshold: number,
  hasAppointment: boolean,
): boolean {
  return applicationCount >= applicationsThreshold && !hasAppointment;
}

/**
 * Check if an application is stuck in a stage.
 *
 * @param currentStage - The application's current stage
 * @param targetStage - The stage to check ('any' matches all stages)
 * @param daysInStage - Days the application has been in current stage
 * @param thresholdDays - Maximum days before considered stuck
 * @returns true if application is stuck
 */
export function checkStageStuckCondition(
  currentStage: string,
  targetStage: string,
  daysInStage: number,
  thresholdDays: number,
): boolean {
  const stageMatches = targetStage === 'any' || currentStage === targetStage;
  return stageMatches && daysInStage > thresholdDays;
}

/**
 * Check if engagement has dropped from one level to another.
 *
 * @param currentLevel - Current engagement level
 * @param targetFromLevel - The level to drop FROM (e.g., 'engaged')
 * @param targetToLevel - The level to drop TO (e.g., 'at_risk')
 * @param previousLevel - Previous engagement level (required to detect a drop)
 * @returns true if engagement has dropped as specified, false if previousLevel is unknown
 */
export function checkEngagementDropCondition(
  currentLevel: string,
  targetFromLevel: string,
  targetToLevel: string,
  previousLevel?: string,
): boolean {
  // A drop requires knowing both the before and after states
  // Without previousLevel, we cannot confirm a transition occurred
  if (!previousLevel) {
    return false;
  }
  return previousLevel === targetFromLevel && currentLevel === targetToLevel;
}

/**
 * Check if no progress condition is met (high rejections, no offers).
 *
 * @param rejectionCount - Number of rejections
 * @param offerCount - Number of offers
 * @param totalApplications - Total applications
 * @param rejectionThreshold - Minimum rejections to trigger
 * @returns true if no progress pattern detected
 */
export function checkNoProgressCondition(
  rejectionCount: number,
  offerCount: number,
  totalApplications: number,
  rejectionThreshold: number,
): boolean {
  return (
    rejectionCount >= rejectionThreshold && offerCount === 0 && totalApplications > rejectionCount
  );
}
