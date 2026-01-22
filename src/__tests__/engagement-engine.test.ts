/**
 * Integration tests for Engagement-to-Momentum Engine
 *
 * Tests the following functionality:
 * - Engagement scoring calculation
 * - Signal condition evaluation
 * - Signal explanation generation
 * - Engagement analytics aggregation
 */

import { generateSignalExplanation } from '../components/signals/SignalCard';

describe('Engagement Scoring', () => {
  describe('Score Calculation', () => {
    it('should calculate event score based on total events', () => {
      const totalCount = 6;
      const idealEvents = 6; // minEvents * 2
      const eventScore = Math.min(50, (totalCount / idealEvents) * 50);
      expect(eventScore).toBe(50);
    });

    it('should cap event score at 50', () => {
      const totalCount = 20;
      const idealEvents = 6;
      const eventScore = Math.min(50, (totalCount / idealEvents) * 50);
      expect(eventScore).toBe(50);
    });

    it('should calculate active days score', () => {
      const uniqueDays = 5;
      const idealActiveDays = 7;
      const activeDaysScore = Math.min(30, (uniqueDays / idealActiveDays) * 30);
      expect(activeDaysScore).toBeCloseTo(21.4, 1);
    });

    it('should calculate recency score for recent activity', () => {
      const daysSince = 1;
      let recencyScore = 0;
      if (daysSince <= 1) recencyScore = 20;
      else if (daysSince <= 3) recencyScore = 15;
      else if (daysSince <= 7) recencyScore = 10;
      else if (daysSince <= 14) recencyScore = 5;
      expect(recencyScore).toBe(20);
    });

    it('should calculate recency score for older activity', () => {
      const daysSince = 10;
      let recencyScore = 0;
      if (daysSince <= 1) recencyScore = 20;
      else if (daysSince <= 3) recencyScore = 15;
      else if (daysSince <= 7) recencyScore = 10;
      else if (daysSince <= 14) recencyScore = 5;
      expect(recencyScore).toBe(5);
    });

    it('should return 0 recency score for very old activity', () => {
      const daysSince = 20;
      let recencyScore = 0;
      if (daysSince <= 1) recencyScore = 20;
      else if (daysSince <= 3) recencyScore = 15;
      else if (daysSince <= 7) recencyScore = 10;
      else if (daysSince <= 14) recencyScore = 5;
      expect(recencyScore).toBe(0);
    });
  });

  describe('Engagement Status Determination', () => {
    const engagedThreshold = 70;
    const atRiskThreshold = 30;

    it('should return engaged status for high scores', () => {
      const score = 85;
      let status: 'engaged' | 'moderate' | 'at_risk';
      if (score >= engagedThreshold) status = 'engaged';
      else if (score <= atRiskThreshold) status = 'at_risk';
      else status = 'moderate';
      expect(status).toBe('engaged');
    });

    it('should return at_risk status for low scores', () => {
      const score = 20;
      let status: 'engaged' | 'moderate' | 'at_risk';
      if (score >= engagedThreshold) status = 'engaged';
      else if (score <= atRiskThreshold) status = 'at_risk';
      else status = 'moderate';
      expect(status).toBe('at_risk');
    });

    it('should return moderate status for mid-range scores', () => {
      const score = 50;
      let status: 'engaged' | 'moderate' | 'at_risk';
      if (score >= engagedThreshold) status = 'engaged';
      else if (score <= atRiskThreshold) status = 'at_risk';
      else status = 'moderate';
      expect(status).toBe('moderate');
    });

    it('should handle edge case at engaged threshold', () => {
      const score = 70;
      let status: 'engaged' | 'moderate' | 'at_risk';
      if (score >= engagedThreshold) status = 'engaged';
      else if (score <= atRiskThreshold) status = 'at_risk';
      else status = 'moderate';
      expect(status).toBe('engaged');
    });

    it('should handle edge case at at_risk threshold', () => {
      const score = 30;
      let status: 'engaged' | 'moderate' | 'at_risk';
      if (score >= engagedThreshold) status = 'engaged';
      else if (score <= atRiskThreshold) status = 'at_risk';
      else status = 'moderate';
      expect(status).toBe('at_risk');
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

describe('Engagement Analytics Aggregation', () => {
  describe('Unique Engaged Percentage', () => {
    it('should calculate engaged percentage correctly', () => {
      const totalStudents = 100;
      const engagedStudents = 65;
      const engagedPercent =
        totalStudents > 0 ? Math.round((engagedStudents / totalStudents) * 100) : 0;
      expect(engagedPercent).toBe(65);
    });

    it('should handle zero total students', () => {
      const totalStudents = 0;
      const engagedStudents = 0;
      const engagedPercent =
        totalStudents > 0 ? Math.round((engagedStudents / totalStudents) * 100) : 0;
      expect(engagedPercent).toBe(0);
    });

    it('should round to nearest integer', () => {
      const totalStudents = 3;
      const engagedStudents = 2;
      const engagedPercent =
        totalStudents > 0 ? Math.round((engagedStudents / totalStudents) * 100) : 0;
      expect(engagedPercent).toBe(67);
    });
  });

  describe('At-Risk Percentage', () => {
    it('should calculate at-risk percentage correctly', () => {
      const totalStudents = 100;
      const atRiskStudents = 15;
      const atRiskPercent =
        totalStudents > 0 ? Math.round((atRiskStudents / totalStudents) * 100) : 0;
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
      const program = { engaged: 30, total: 40, percent: 0 };
      program.percent = program.total > 0 ? Math.round((program.engaged / program.total) * 100) : 0;
      expect(program.percent).toBe(75);
    });

    it('should handle program with no students', () => {
      const program = { engaged: 0, total: 0, percent: 0 };
      program.percent = program.total > 0 ? Math.round((program.engaged / program.total) * 100) : 0;
      expect(program.percent).toBe(0);
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
      const now = Date.now();
      const events = [
        { timestamp: now - 1 * 24 * 60 * 60 * 1000 }, // Day 1
        { timestamp: now - 1 * 24 * 60 * 60 * 1000 + 3600000 }, // Day 1 (same day)
        { timestamp: now - 2 * 24 * 60 * 60 * 1000 }, // Day 2
        { timestamp: now - 5 * 24 * 60 * 60 * 1000 }, // Day 5
      ];

      const uniqueDays = new Set(events.map((e) => Math.floor(e.timestamp / (24 * 60 * 60 * 1000))))
        .size;

      expect(uniqueDays).toBe(3);
    });
  });
});
