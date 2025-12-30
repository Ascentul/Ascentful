/**
 * ATS Handler Registry
 *
 * Central registry for all ATS platform handlers.
 * Provides detection and handler selection.
 */

import type { ATSDetectionResult, ATSPlatform } from '~/types';
import { BaseATSHandler } from './BaseATSHandler';
import { GreenhouseHandler } from './GreenhouseHandler';
import { LeverHandler } from './LeverHandler';
import { WorkdayHandler } from './WorkdayHandler';
import { LinkedInHandler } from './LinkedInHandler';
import { IndeedHandler } from './IndeedHandler';
import { TaleoHandler } from './TaleoHandler';
import { ICIMSHandler } from './ICIMSHandler';
import { SmartRecruitersHandler } from './SmartRecruitersHandler';

/**
 * All registered ATS handlers
 */
const handlers: BaseATSHandler[] = [
  new GreenhouseHandler(),
  new LeverHandler(),
  new WorkdayHandler(),
  new LinkedInHandler(),
  new IndeedHandler(),
  new TaleoHandler(),
  new ICIMSHandler(),
  new SmartRecruitersHandler(),
];

/**
 * Detect which ATS platform is being used on the current page
 */
export function detectATS(): ATSDetectionResult {
  for (const handler of handlers) {
    const result = handler.detect();
    if (result.detected) {
      console.log(`[Ascentful] Detected ATS: ${handler.displayName}`);
      return result;
    }
  }

  console.log('[Ascentful] No ATS detected on this page');
  return {
    detected: false,
    platform: 'unknown',
    confidence: 0,
  };
}

/**
 * Get the handler for a specific platform
 */
export function getHandler(platform: ATSPlatform): BaseATSHandler | null {
  return handlers.find((h) => h.platformName === platform) || null;
}

/**
 * Get the handler for the current page (auto-detect)
 */
export function getHandlerForCurrentPage(): BaseATSHandler | null {
  for (const handler of handlers) {
    const result = handler.detect();
    if (result.detected) {
      return handler;
    }
  }
  return null;
}

/**
 * Get all registered handlers
 */
export function getAllHandlers(): BaseATSHandler[] {
  return handlers;
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): { platform: ATSPlatform; displayName: string }[] {
  return handlers.map((h) => ({
    platform: h.platformName,
    displayName: h.displayName,
  }));
}

export { BaseATSHandler };
export { GreenhouseHandler };
export { LeverHandler };
export { WorkdayHandler };
export { LinkedInHandler };
export { IndeedHandler };
export { TaleoHandler };
export { ICIMSHandler };
export { SmartRecruitersHandler };
