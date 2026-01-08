import { extractJobBlocks, parseExperienceFromJobBlocks } from '@/lib/resume/jobBlockParser';

describe('resume job block parsing', () => {
  it('keeps job content ordered and keeps bullets with their job', () => {
    const resumeText = `Experience

UL Research Institutes    Dec 2023 - Present
Account Engagement (Pardot) Admin

Served as Marketing Cloud Account Engagement Administrator, leading operations across eight research institutes.
Accomplishments:
• Leading the Salesforce implementation for NERIS...
• Implemented a new Pardot business unit...
• Redesigned the enterprise-wide campaign hierarchy...
• Led multiple training workshops...

APTIM    May 2022 - Dec 2023
Account Engagement (Pardot) Admin

Served as the Marketing Cloud Account Engagement Administrator, managing automation.
Accomplishments:
- Collaborated with the Salesforce admin to resolve sync issues...
- Led the APTIM Xchange newsletter...

Education
Example University
`;

    const jobBlocks = extractJobBlocks(resumeText);
    expect(jobBlocks).toHaveLength(2);

    const experiences = parseExperienceFromJobBlocks(jobBlocks);
    expect(experiences).toHaveLength(2);

    expect(experiences[0].company).toBe('UL Research Institutes');
    expect(experiences[0].title).toBe('Account Engagement (Pardot) Admin');
    expect(experiences[0].startDate).toBe('12/2023');
    expect(experiences[0].endDate).toBe('Present');
    expect(experiences[0].current).toBe(true);
    expect(experiences[0].summary).toContain(
      'Served as Marketing Cloud Account Engagement Administrator, leading operations across eight research institutes.',
    );
    expect(experiences[0].keyContributions).toEqual([
      'Leading the Salesforce implementation for NERIS...',
      'Implemented a new Pardot business unit...',
      'Redesigned the enterprise-wide campaign hierarchy...',
      'Led multiple training workshops...',
    ]);

    expect(experiences[1].company).toBe('APTIM');
    expect(experiences[1].title).toBe('Account Engagement (Pardot) Admin');
    expect(experiences[1].startDate).toBe('05/2022');
    expect(experiences[1].endDate).toBe('12/2023');
    expect(experiences[1].current).toBe(false);
    expect(experiences[1].summary).toContain(
      'Served as the Marketing Cloud Account Engagement Administrator, managing automation.',
    );
    expect(experiences[1].keyContributions).toEqual([
      'Collaborated with the Salesforce admin to resolve sync issues...',
      'Led the APTIM Xchange newsletter...',
    ]);

    expect(experiences[0].summary).not.toBe(experiences[0].keyContributions?.[0]);
  });
});
