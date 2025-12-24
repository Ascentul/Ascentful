import { detectIndustryFromRole } from '@/lib/career-explorer/industryTaxonomy';

describe('industry taxonomy', () => {
  describe('detectIndustryFromRole', () => {
    // Data keyword edge cases
    it('classifies data analyst roles as technology', () => {
      expect(detectIndustryFromRole('Senior Data Analyst')).toBe('technology');
    });

    it('keeps healthcare roles with data wording in healthcare', () => {
      expect(detectIndustryFromRole('Patient Data Coordinator')).toBe('healthcare');
    });

    it('treats clinical data scientist as technology due to tech keywords', () => {
      expect(detectIndustryFromRole('Clinical Data Scientist')).toBe('technology');
    });

    it('classifies software engineer roles as technology', () => {
      expect(detectIndustryFromRole('Software Engineer')).toBe('technology');
    });

    it('classifies registered nurse roles as healthcare', () => {
      expect(detectIndustryFromRole('Registered Nurse')).toBe('healthcare');
    });

    it('classifies research scientist roles as science_research', () => {
      expect(detectIndustryFromRole('Research Scientist')).toBe('science_research');
    });

    // Legal industry
    it('classifies lawyer roles as legal', () => {
      expect(detectIndustryFromRole('Senior Lawyer')).toBe('legal');
    });

    it('classifies paralegal roles as legal', () => {
      expect(detectIndustryFromRole('Paralegal')).toBe('legal');
    });

    it('classifies general counsel as legal', () => {
      expect(detectIndustryFromRole('General Counsel')).toBe('legal');
    });

    it('classifies litigation roles as legal', () => {
      expect(detectIndustryFromRole('Litigation Associate')).toBe('legal');
    });

    // Finance industry
    it('classifies investment banker as finance', () => {
      expect(detectIndustryFromRole('Investment Banking Analyst')).toBe('finance');
    });

    it('classifies portfolio manager as finance', () => {
      expect(detectIndustryFromRole('Portfolio Manager')).toBe('finance');
    });

    // Trades industry
    it('classifies electrician as trades', () => {
      expect(detectIndustryFromRole('Master Electrician')).toBe('trades');
    });

    it('classifies plumber as trades', () => {
      expect(detectIndustryFromRole('Master Plumber')).toBe('trades');
    });

    it('classifies HVAC technician as trades', () => {
      expect(detectIndustryFromRole('HVAC Technician')).toBe('trades');
    });

    // Default fallback behavior
    it('defaults to technology for unrecognized roles', () => {
      expect(detectIndustryFromRole('Chief Happiness Officer')).toBe('technology');
    });

    it('defaults to technology for generic business roles', () => {
      expect(detectIndustryFromRole('Business Development Representative')).toBe('technology');
    });

    // Case sensitivity handling
    it('handles uppercase role titles', () => {
      expect(detectIndustryFromRole('SOFTWARE ENGINEER')).toBe('technology');
    });

    it('handles mixed case role titles', () => {
      expect(detectIndustryFromRole('ReGiStErEd NuRsE')).toBe('healthcare');
    });

    it('handles lowercase role titles', () => {
      expect(detectIndustryFromRole('senior lawyer')).toBe('legal');
    });
  });
});
