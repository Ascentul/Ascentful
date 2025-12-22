import { detectIndustryFromRole } from '@/lib/career-explorer/industryTaxonomy';

describe('industry taxonomy', () => {
  describe('detectIndustryFromRole', () => {
    it('classifies data analyst roles as technology', () => {
      expect(detectIndustryFromRole('Senior Data Analyst')).toBe('technology');
    });

    it('keeps healthcare roles with data wording in healthcare', () => {
      expect(detectIndustryFromRole('Patient Data Coordinator')).toBe('healthcare');
    });

    it('treats clinical data scientist as technology due to tech keywords', () => {
      expect(detectIndustryFromRole('Clinical Data Scientist')).toBe('technology');
    });
  });
});
