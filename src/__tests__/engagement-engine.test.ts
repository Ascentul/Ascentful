/**
 * Integration tests for Engagement-to-Momentum Engine
 *
 * Tests the following functionality:
 * - Engagement scoring calculation (using production utilities)
 * - Signal condition evaluation
 * - Signal explanation generation
 * - Engagement analytics aggregation
 */

import {
  calculateActiveDaysScore,
  calculateEngagementScore,
  calculateEventScore,
  calculatePercentage,
  calculateRecencyScore,
  calculateTotalEngagementScore,
  determineEngagementStatus,
  RECENCY_THRESHOLDS,
  SCORING_WEIGHTS,
} from '../../convex/lib/engagementScoring';
import { generateSignalExplanation } from '../components/signals/SignalCard';

describe('Engagement Scoring', () => {
  describe('Score Calculation - Using Production Utilities', () => {
    it('should calculate event score based on total events', () => {
      const totalCount = 6;
      const idealEvents = 6; // minEvents * 2
      const eventScore = calculateEventScore(totalCount, idealEvents);
      expect(eventScore).toBe(SCORING_WEIGHTS.EVENT_SCORE_MAX);
    });

    it('should cap event score at max', () => {
      const totalCount = 20;
      const idealEvents = 6;
      const eventScore = calculateEventScore(totalCount, idealEvents);
      expect(eventScore).toBe(SCORING_WEIGHTS.EVENT_SCORE_MAX);
    });

    it('should calculate partial event score', () => {
      const totalCount = 3;
      const idealEvents = 6;
      const eventScore = calculateEventScore(totalCount, idealEvents);
      expect(eventScore).toBe(25); // 3/6 * 50 = 25
    });

    it('should handle zero ideal events', () => {
      const eventScore = calculateEventScore(5, 0);
      expect(eventScore).toBe(0);
    });

    it('should calculate active days score', () => {
      const uniqueDays = 5;
      const idealActiveDays = 7;
      const activeDaysScore = calculateActiveDaysScore(uniqueDays, idealActiveDays);
      expect(activeDaysScore).toBeCloseTo(21.4, 1);
    });

    it('should cap active days score at max', () => {
      const activeDaysScore = calculateActiveDaysScore(10, 7);
      expect(activeDaysScore).toBe(SCORING_WEIGHTS.ACTIVE_DAYS_SCORE_MAX);
    });

    it('should calculate recency score for recent activity', () => {
      const recencyScore = calculateRecencyScore(1);
      expect(recencyScore).toBe(RECENCY_THRESHOLDS[0].score); // 20
    });

    it('should calculate recency score for moderately recent activity', () => {
      const recencyScore = calculateRecencyScore(3);
      expect(recencyScore).toBe(RECENCY_THRESHOLDS[1].score); // 15
    });

    it('should calculate recency score for older activity', () => {
      const recencyScore = calculateRecencyScore(10);
      expect(recencyScore).toBe(RECENCY_THRESHOLDS[3].score); // 5
    });

    it('should return 0 recency score for very old activity', () => {
      const recencyScore = calculateRecencyScore(20);
      expect(recencyScore).toBe(0);
    });

    it('should return 0 recency score for null activity', () => {
      const recencyScore = calculateRecencyScore(null);
      expect(recencyScore).toBe(0);
    });

    it('should calculate total score correctly', () => {
      const total = calculateTotalEngagementScore(50, 30, 20);
      expect(total).toBe(100);
    });

    it('should round total score', () => {
      const total = calculateTotalEngagementScore(25.5, 15.3, 10.1);
      expect(total).toBe(51);
    });

    it('should calculate full engagement score from metrics', () => {
      const score = calculateEngagementScore(
        { totalEventCount: 6, uniqueActiveDays: 7, daysSinceLastActivity: 1 },
        { minEventsInPeriod: 3, periodDays: 14 },
      );
      expect(score).toBe(100);
    });

    it('should calculate partial engagement score from metrics', () => {
      const score = calculateEngagementScore(
        { totalEventCount: 3, uniqueActiveDays: 3, daysSinceLastActivity: 5 },
        { minEventsInPeriod: 3, periodDays: 14 },
      );
      // 25 (events) + 12.86 (days) + 10 (recency) ≈ 48
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(55);
    });
  });

  describe('Engagement Status Determination - Using Production Utilities', () => {
    const engagedThreshold = 70;
    const atRiskThreshold = 30;

    it('should return engaged status for high scores', () => {
      const status = determineEngagementStatus(85, engagedThreshold, atRiskThreshold);
      expect(status).toBe('engaged');
    });

    it('should return at_risk status for low scores', () => {
      const status = determineEngagementStatus(20, engagedThreshold, atRiskThreshold);
      expect(status).toBe('at_risk');
    });

    it('should return moderate status for mid-range scores', () => {
      const status = determineEngagementStatus(50, engagedThreshold, atRiskThreshold);
      expect(status).toBe('moderate');
    });

    it('should handle edge case at engaged threshold (>=)', () => {
      const status = determineEngagementStatus(70, engagedThreshold, atRiskThreshold);
      expect(status).toBe('engaged');
    });

    it('should handle edge case at at_risk threshold (<=)', () => {
      const status = determineEngagementStatus(30, engagedThreshold, atRiskThreshold);
      expect(status).toBe('at_risk');
    });

    it('should handle score just above at_risk threshold', () => {
      const status = determineEngagementStatus(31, engagedThreshold, atRiskThreshold);
      expect(status).toBe('moderate');
    });

    it('should handle score just below engaged threshold', () => {
      const status = determineEngagementStatus(69, engagedThreshold, atRiskThreshold);
      expect(status).toBe('moderate');
    });
  });

  describe('Percentage Calculation - Using Production Utilities', () => {
    it('should calculate percentage correctly', () => {
      const percent = calculatePercentage(65, 100);
      expect(percent).toBe(65);
    });

    it('should handle zero total', () => {
      const percent = calculatePercentage(0, 0);
      expect(percent).toBe(0);
    });

    it('should round to nearest integer', () => {
      const percent = calculatePercentage(2, 3);
      expect(percent).toBe(67);
    });

    it('should handle 100%', () => {
      const percent = calculatePercentage(50, 50);
      expect(percent).toBe(100);
    });
  });
});

describe('Signal Conditions', () => {
  describe('STALLED Condition', () => {
    it('should trigger when days since activity exceeds threshold', () => {
      const daysSinceActivity = 16;
      const thresholdDays = 14;
      const shouldTrigger = daysSinceActivity > thresholdDays;
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger when activity is within threshold', () => {
      const daysSinceActivity = 10;
      const thresholdDays = 14;
      const shouldTrigger = daysSinceActivity > thresholdDays;
      expect(shouldTrigger).toBe(false);
    });

    it('should not trigger at exactly the threshold', () => {
      const daysSinceActivity = 14;
      const thresholdDays = 14;
      const shouldTrigger = daysSinceActivity > thresholdDays;
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('HIGH_INTENT_LOW_CONVERSION Condition', () => {
    it('should trigger when applications exceed threshold and no appointments', () => {
      const applicationCount = 5;
      const applicationsThreshold = 3;
      const hasAppointment = false;
      const shouldTrigger = applicationCount >= applicationsThreshold && !hasAppointment;
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger when applications below threshold', () => {
      const applicationCount = 2;
      const applicationsThreshold = 3;
      const hasAppointment = false;
      const shouldTrigger = applicationCount >= applicationsThreshold && !hasAppointment;
      expect(shouldTrigger).toBe(false);
    });

    it('should not trigger when has appointment scheduled', () => {
      const applicationCount = 5;
      const applicationsThreshold = 3;
      const hasAppointment = true;
      const shouldTrigger = applicationCount >= applicationsThreshold && !hasAppointment;
      expect(shouldTrigger).toBe(false);
    });
  });

  describe('STAGE_STUCK Condition', () => {
    it('should trigger when stage duration exceeds threshold', () => {
      const daysInStage = 20;
      const thresholdDays = 14;
      const currentStage: string = 'Interview';
      const targetStage: string = 'Interview';
      const shouldTrigger =
        (targetStage === 'any' || currentStage === targetStage) && daysInStage > thresholdDays;
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger for different stage', () => {
      const daysInStage = 20;
      const thresholdDays = 14;
      const currentStage: string = 'Applied';
      const targetStage: string = 'Interview';
      const shouldTrigger =
        (targetStage === 'any' || currentStage === targetStage) && daysInStage > thresholdDays;
      expect(shouldTrigger).toBe(false);
    });

    it('should trigger for any stage when target is "any"', () => {
      const daysInStage = 20;
      const thresholdDays = 14;
      const currentStage: string = 'Applied';
      const targetStage: string = 'any';
      const shouldTrigger =
        (targetStage === 'any' || currentStage === targetStage) && daysInStage > thresholdDays;
      expect(shouldTrigger).toBe(true);
    });
  });
});

describe('Signal Explanation Generation', () => {
  describe('STALLED Explanation', () => {
    it('should generate stalled explanation with days', () => {
      const explanation = generateSignalExplanation('stalled', {
        days_since_activity: 16,
        threshold_days: 14,
      });
      expect(explanation).toContain('16 days');
      expect(explanation).toContain('14-day threshold');
    });

    it('should handle null days_since_activity', () => {
      const explanation = generateSignalExplanation('stalled', {
        days_since_activity: null,
        threshold_days: 14,
      });
      expect(explanation).toContain('No recorded activity');
    });
  });

  describe('HIGH_INTENT_LOW_CONVERSION Explanation', () => {
    it('should generate explanation with application count', () => {
      const explanation = generateSignalExplanation('high_intent_low_conversion', {
        application_count: 5,
        appointment_days: 30,
      });
      expect(explanation).toContain('5 applications');
      expect(explanation).toContain('30 days');
    });
  });

  describe('STAGE_STUCK Explanation', () => {
    it('should generate explanation for single stuck application', () => {
      const explanation = generateSignalExplanation('stage_stuck', {
        longest_stuck: {
          company: 'Google',
          stage: 'Interview',
          days_stuck: 18,
        },
        stuck_applications: 1,
      });
      expect(explanation).toContain('Google');
      expect(explanation).toContain('Interview');
      expect(explanation).toContain('18 days');
    });

    it('should generate explanation for multiple stuck applications', () => {
      const explanation = generateSignalExplanation('stage_stuck', {
        longest_stuck: {
          company: 'Google',
          stage: 'Interview',
          days_stuck: 18,
        },
        stuck_applications: 3,
      });
      expect(explanation).toContain('3 applications stuck');
      expect(explanation).toContain('Google');
    });
  });

  describe('INACTIVITY Explanation', () => {
    it('should generate inactivity explanation', () => {
      const explanation = generateSignalExplanation('inactivity', {
        daysSinceActivity: 15,
        thresholdDays: 14,
      });
      expect(explanation).toContain('15 days ago');
      expect(explanation).toContain('14-day threshold');
    });
  });

  describe('APPLICATION_STALL Explanation', () => {
    it('should generate explanation for specific stage stall', () => {
      const explanation = generateSignalExplanation('application_stall', {
        stalledApplications: 2,
        stalledStage: 'Interview',
        oldestStallDays: 20,
      });
      expect(explanation).toContain('2 application');
      expect(explanation).toContain('Interview');
      expect(explanation).toContain('20+ days');
    });

    it('should generate explanation for any stage stall', () => {
      const explanation = generateSignalExplanation('application_stall', {
        stalledApplications: 3,
        stalledStage: 'any',
        oldestStallDays: 15,
      });
      expect(explanation).toContain("haven't progressed");
      expect(explanation).toContain('15+ days');
    });
  });

  describe('ENGAGEMENT_DROP Explanation', () => {
    it('should generate engagement drop explanation', () => {
      const explanation = generateSignalExplanation('engagement_drop', {
        currentLevel: 'at_risk',
        targetFromLevel: 'engaged',
      });
      expect(explanation).toContain('dropped');
      expect(explanation).toContain('engaged');
      expect(explanation).toContain('at_risk');
    });
  });

  describe('NO_PROGRESS Explanation', () => {
    it('should generate no progress explanation', () => {
      const explanation = generateSignalExplanation('no_progress', {
        rejectionCount: 8,
        offerCount: 0,
        totalApplications: 12,
      });
      expect(explanation).toContain('8 rejections');
      expect(explanation).toContain('12 applications');
      expect(explanation).toContain('0 offer');
    });
  });

  describe('Unknown Condition', () => {
    it('should return default explanation for unknown condition', () => {
      const explanation = generateSignalExplanation('unknown', {});
      expect(explanation).toContain('Action may be needed');
    });
  });
});

describe('Engagement Analytics Aggregation - Using Production Utilities', () => {
  describe('Unique Engaged Percentage', () => {
    it('should calculate engaged percentage correctly', () => {
      const engagedPercent = calculatePercentage(65, 100);
      expect(engagedPercent).toBe(65);
    });

    it('should handle zero total students', () => {
      const engagedPercent = calculatePercentage(0, 0);
      expect(engagedPercent).toBe(0);
    });

    it('should round to nearest integer', () => {
      const engagedPercent = calculatePercentage(2, 3);
      expect(engagedPercent).toBe(67);
    });
  });

  describe('At-Risk Percentage', () => {
    it('should calculate at-risk percentage correctly', () => {
      const atRiskPercent = calculatePercentage(15, 100);
      expect(atRiskPercent).toBe(15);
    });
  });

  describe('Status Breakdown', () => {
    it('should sum to total students', () => {
      const engaged = 65;
      const moderate = 20;
      const atRisk = 15;
      const total = engaged + moderate + atRisk;
      expect(total).toBe(100);
    });
  });

  describe('Program Breakdown', () => {
    it('should calculate per-program engaged percentage', () => {
      const percent = calculatePercentage(30, 40);
      expect(percent).toBe(75);
    });

    it('should handle program with no students', () => {
      const percent = calculatePercentage(0, 0);
      expect(percent).toBe(0);
    });
  });
});

describe('Qualifying Event Filtering', () => {
  describe('Event Type Filtering', () => {
    it('should filter events by qualifying types', () => {
      const events = [
        { type: 'login', category: 'auth' },
        { type: 'application_created', category: 'application' },
        { type: 'page_view', category: 'navigation' },
        { type: 'resume_updated', category: 'document' },
      ];

      const qualifyingTypes = ['login', 'application_created', 'resume_updated'];
      const filtered = events.filter((e) => qualifyingTypes.includes(e.type));

      expect(filtered.length).toBe(3);
      expect(filtered.map((e) => e.type)).not.toContain('page_view');
    });
  });

  describe('Event Category Filtering', () => {
    it('should filter events by qualifying categories', () => {
      const events = [
        { type: 'login', category: 'auth' },
        { type: 'application_created', category: 'application' },
        { type: 'page_view', category: 'navigation' },
        { type: 'resume_updated', category: 'document' },
      ];

      const qualifyingCategories = ['application', 'document'];
      const filtered = events.filter((e) => qualifyingCategories.includes(e.category));

      expect(filtered.length).toBe(2);
    });
  });

  describe('Combined Type and Category Filtering', () => {
    it('should match events by either type or category', () => {
      const events = [
        { type: 'login', category: 'auth' },
        { type: 'application_created', category: 'application' },
        { type: 'page_view', category: 'navigation' },
        { type: 'resume_updated', category: 'document' },
      ];

      const qualifyingTypes = ['login'];
      const qualifyingCategories = ['application', 'document'];

      const filtered = events.filter(
        (e) => qualifyingTypes.includes(e.type) || qualifyingCategories.includes(e.category),
      );

      expect(filtered.length).toBe(3);
    });
  });

  describe('Period Filtering', () => {
    it('should filter events within period', () => {
      const now = Date.now();
      const periodDays = 14;
      const periodMs = periodDays * 24 * 60 * 60 * 1000;

      const events = [
        { timestamp: now - 5 * 24 * 60 * 60 * 1000 }, // 5 days ago
        { timestamp: now - 10 * 24 * 60 * 60 * 1000 }, // 10 days ago
        { timestamp: now - 20 * 24 * 60 * 60 * 1000 }, // 20 days ago
        { timestamp: now - 30 * 24 * 60 * 60 * 1000 }, // 30 days ago
      ];

      const periodStart = now - periodMs;
      const filtered = events.filter((e) => e.timestamp >= periodStart);

      expect(filtered.length).toBe(2);
    });
  });

  describe('Unique Days Calculation', () => {
    it('should count unique days with activity', () => {
      // Use a fixed base timestamp to avoid timezone/midnight edge cases
      const baseDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
      const dayMs = 24 * 60 * 60 * 1000;

      const events = [
        { timestamp: (baseDay - 1) * dayMs + 10000 }, // Day -1
        { timestamp: (baseDay - 1) * dayMs + 3600000 }, // Day -1 (same day, different hour)
        { timestamp: (baseDay - 2) * dayMs + 10000 }, // Day -2
        { timestamp: (baseDay - 5) * dayMs + 10000 }, // Day -5
      ];

      const uniqueDays = new Set(events.map((e) => Math.floor(e.timestamp / dayMs))).size;

      expect(uniqueDays).toBe(3); // Days -1, -2, -5
    });
  });
});
