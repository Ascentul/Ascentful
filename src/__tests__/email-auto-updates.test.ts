import {
  classifyEmail,
  mapEmailEventTypeToStage,
  mapStageToLegacyStatus,
  normalizeCompanyName,
  rankApplicationsForEmail,
  subjectGate,
} from '../../convex/lib/emailAutoUpdates';

describe('email auto updates', () => {
  describe('subjectGate', () => {
    it('passes common application subjects', () => {
      const res = subjectGate({ subject: 'Thanks for applying to Acme', from: 'jobs@acme.com' });
      expect(res.passed).toBe(true);
    });

    it('rejects unrelated mail', () => {
      const res = subjectGate({ subject: 'Your receipt is ready', from: 'billing@store.com' });
      expect(res.passed).toBe(false);
    });
  });

  describe('classifyEmail', () => {
    it('classifies rejection', () => {
      const res = classifyEmail({
        subject: 'Update on your application',
        from: 'hr@acme.com',
        snippet: 'Unfortunately, we are not moving forward.',
      });
      expect(res.eventType).toBe('rejection');
      expect(res.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies interview request', () => {
      const res = classifyEmail({
        subject: 'Interview invitation - Acme',
        from: 'recruiter@acme.com',
      });
      expect(res.eventType).toBe('interview_request');
      expect(res.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('stage mapping', () => {
    it('maps events to stages and legacy status', () => {
      expect(mapEmailEventTypeToStage('applied_confirmation')).toBe('Applied');
      expect(mapStageToLegacyStatus('Applied')).toBe('applied');
      expect(mapEmailEventTypeToStage('rejection')).toBe('Rejected');
      expect(mapStageToLegacyStatus('Rejected')).toBe('rejected');
    });
  });

  describe('matching', () => {
    it('prefers company match', () => {
      const applications = [
        { _id: 'app1', company: 'Acme', job_title: 'Software Engineer' },
        { _id: 'app2', company: 'Globex', job_title: 'Software Engineer' },
      ];

      const res = rankApplicationsForEmail({
        applications,
        extracted: { companyName: 'Acme' },
        subject: 'Interview invitation',
        from: 'recruiter@acme.com',
      });

      expect(res.best?.applicationId).toBe('app1');
      expect(res.best?.score).toBeGreaterThanOrEqual(0.75);
    });

    it('normalizes company names', () => {
      expect(normalizeCompanyName('Acme, Inc.')).toBe('acme');
      expect(normalizeCompanyName('Acme LLC')).toBe('acme');
    });
  });
});
