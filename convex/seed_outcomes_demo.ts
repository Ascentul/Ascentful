/**
 * Seed Demo Outcomes Data
 *
 * Creates sample graduation cohorts and outcomes for demo purposes.
 * Run via: npx convex run seed_outcomes_demo:seedOutcomesDemo
 *
 * Creates:
 * - 3 cohorts (2023, 2024, 2025)
 * - 400 outcomes distributed across cohorts/programs
 * - Mix of statuses: 60% known, 25% unknown, 15% partial
 * - Verification data for ~70% of known outcomes
 */

import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';
import { Id } from './_generated/dataModel';

// Sample data
const PROGRAMS = [
  'Computer Science',
  'Business Administration',
  'Mechanical Engineering',
  'Biology',
  'Psychology',
];

const EMPLOYERS = [
  {
    name: 'Google',
    industry: 'Technology',
    titles: ['Software Engineer', 'Product Manager', 'Data Analyst'],
  },
  {
    name: 'Microsoft',
    industry: 'Technology',
    titles: ['Software Developer', 'Cloud Engineer', 'UX Designer'],
  },
  {
    name: 'Amazon',
    industry: 'E-commerce',
    titles: ['Solutions Architect', 'Operations Manager', 'Data Scientist'],
  },
  {
    name: 'Goldman Sachs',
    industry: 'Finance',
    titles: ['Investment Analyst', 'Risk Manager', 'Quantitative Analyst'],
  },
  {
    name: 'JP Morgan',
    industry: 'Finance',
    titles: ['Financial Analyst', 'Associate', 'Technology Analyst'],
  },
  {
    name: 'McKinsey',
    industry: 'Consulting',
    titles: ['Business Analyst', 'Consultant', 'Associate'],
  },
  { name: 'Deloitte', industry: 'Consulting', titles: ['Consultant', 'Analyst', 'Associate'] },
  {
    name: 'Johnson & Johnson',
    industry: 'Healthcare',
    titles: ['Research Scientist', 'Clinical Specialist', 'Product Manager'],
  },
  {
    name: 'Pfizer',
    industry: 'Healthcare',
    titles: ['Research Associate', 'Data Scientist', 'Regulatory Affairs'],
  },
  {
    name: 'Tesla',
    industry: 'Automotive',
    titles: ['Mechanical Engineer', 'Software Engineer', 'Manufacturing Engineer'],
  },
];

const GRAD_SCHOOLS = [
  { name: 'MIT', program: 'Computer Science', degree: 'MS' },
  { name: 'Stanford', program: 'MBA', degree: 'MBA' },
  { name: 'Harvard', program: 'Business Administration', degree: 'MBA' },
  { name: 'Yale', program: 'Law', degree: 'JD' },
  { name: 'Johns Hopkins', program: 'Medicine', degree: 'MD' },
  { name: 'UC Berkeley', program: 'Engineering', degree: 'PhD' },
];

const FIRST_NAMES = [
  'James',
  'Mary',
  'John',
  'Patricia',
  'Robert',
  'Jennifer',
  'Michael',
  'Linda',
  'William',
  'Elizabeth',
  'David',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Nancy',
  'Daniel',
  'Lisa',
  'Matthew',
  'Betty',
  'Anthony',
  'Margaret',
  'Mark',
  'Sandra',
  'Donald',
  'Ashley',
  'Steven',
  'Emily',
  'Paul',
  'Donna',
  'Andrew',
  'Michelle',
  'Joshua',
  'Dorothy',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
];

const CITIES = [
  { city: 'New York', state: 'NY' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Boston', state: 'MA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Austin', state: 'TX' },
  { city: 'Denver', state: 'CO' },
  { city: 'Los Angeles', state: 'CA' },
];

// Helper functions
function randomElement<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error('Cannot select random element from empty array');
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName: string, lastName: string): string {
  const domains = ['university.edu', 'student.university.edu'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomElement(domains)}`;
}

function generateStudentId(): string {
  return `STU${randomBetween(10000, 99999)}`;
}

function generateSalary(type: string): number | undefined {
  if (type === 'employed_fulltime') {
    return randomBetween(55000, 150000);
  }
  if (type === 'employed_parttime') {
    return randomBetween(25000, 45000);
  }
  return undefined;
}

export const seedOutcomesDemo = internalMutation({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    console.log('Starting outcomes demo seed...');

    // Create 3 cohorts
    const cohortConfigs = [
      { term: 'spring' as const, year: 2023, degreeLevel: 'bachelor' as const },
      { term: 'spring' as const, year: 2024, degreeLevel: 'bachelor' as const },
      { term: 'spring' as const, year: 2025, degreeLevel: 'bachelor' as const },
    ];

    const cohortIds: Id<'graduation_cohorts'>[] = [];
    let newCohortsCount = 0;

    for (const config of cohortConfigs) {
      // Check if cohort already exists (must match term AND year to avoid reusing wrong cohort)
      const existing = await ctx.db
        .query('graduation_cohorts')
        .withIndex('by_institution_year', (q) =>
          q.eq('institution_id', args.universityId).eq('graduation_year', config.year),
        )
        .filter((q) => q.eq(q.field('graduation_term'), config.term))
        .first();

      if (existing) {
        console.log(`Cohort ${config.term} ${config.year} already exists`);
        cohortIds.push(existing._id);
        continue;
      }

      const cohortId = await ctx.db.insert('graduation_cohorts', {
        institution_id: args.universityId,
        graduation_term: config.term,
        graduation_year: config.year,
        degree_level: config.degreeLevel,
        status: config.year < 2025 ? 'finalized' : 'collecting',
        created_at: now,
        updated_at: now,
      });

      console.log(`Created cohort: ${config.term} ${config.year}`);
      cohortIds.push(cohortId);
      newCohortsCount++;
    }

    // Get existing majors (don't create new ones - they require department_id)
    const majorMap = new Map<string, Id<'majors'>>();
    const existingMajors = await ctx.db
      .query('majors')
      .withIndex('by_university', (q) => q.eq('university_id', args.universityId))
      .collect();

    for (const major of existingMajors) {
      majorMap.set(major.name, major._id);
    }

    console.log(`Found ${existingMajors.length} existing majors`);
    if (existingMajors.length === 0) {
      console.log('Note: No majors found. Outcomes will be created without major links.');
    }

    // Generate outcomes
    // Distribution: 60% known, 25% unknown, 15% partial
    // Among known: 65% employed, 20% continuing ed, 15% other
    const totalOutcomes = 400;
    const baseOutcomesPerCohort = Math.floor(totalOutcomes / cohortIds.length);
    const remainder = totalOutcomes % cohortIds.length;

    let createdCount = 0;

    for (let c = 0; c < cohortIds.length; c++) {
      const cohortId = cohortIds[c];
      const cohortYear = cohortConfigs[c].year;
      // Distribute remainder across first cohorts to ensure exactly totalOutcomes
      const outcomesForThisCohort =
        c < remainder ? baseOutcomesPerCohort + 1 : baseOutcomesPerCohort;

      for (let i = 0; i < outcomesForThisCohort; i++) {
        const firstName = randomElement(FIRST_NAMES);
        const lastName = randomElement(LAST_NAMES);
        const email = generateEmail(firstName, lastName);
        const studentId = generateStudentId();
        const program = randomElement(PROGRAMS);
        const majorId = majorMap.get(program);

        // Determine outcome status (weighted)
        const statusRoll = Math.random();
        let outcomeStatus: 'known' | 'unknown' | 'partial';
        if (statusRoll < 0.6) {
          outcomeStatus = 'known';
        } else if (statusRoll < 0.85) {
          outcomeStatus = 'unknown';
        } else {
          outcomeStatus = 'partial';
        }

        // Determine outcome type for known outcomes
        let outcomeType:
          | 'employed_fulltime'
          | 'employed_parttime'
          | 'continuing_education'
          | 'military'
          | 'volunteer'
          | 'seeking'
          | 'not_seeking'
          | undefined;
        let employerData: {
          employer_name?: string;
          job_title?: string;
          industry?: string;
          salary?: number;
          city?: string;
          state?: string;
          country?: string;
          is_remote?: boolean;
        } = {};
        let eduData: {
          grad_school_name?: string;
          grad_school_program?: string;
          grad_school_degree?: string;
        } = {};

        if (outcomeStatus === 'known') {
          const typeRoll = Math.random();
          if (typeRoll < 0.55) {
            outcomeType = 'employed_fulltime';
          } else if (typeRoll < 0.65) {
            outcomeType = 'employed_parttime';
          } else if (typeRoll < 0.85) {
            outcomeType = 'continuing_education';
          } else if (typeRoll < 0.9) {
            outcomeType = 'military';
          } else if (typeRoll < 0.93) {
            outcomeType = 'volunteer';
          } else if (typeRoll < 0.97) {
            outcomeType = 'seeking';
          } else {
            outcomeType = 'not_seeking';
          }

          // Generate employment details
          if (outcomeType === 'employed_fulltime' || outcomeType === 'employed_parttime') {
            const employer = randomElement(EMPLOYERS);
            const location = randomElement(CITIES);
            employerData = {
              employer_name: employer.name,
              job_title: randomElement(employer.titles),
              industry: employer.industry,
              salary: generateSalary(outcomeType),
              city: location.city,
              state: location.state,
              country: 'USA',
              is_remote: Math.random() < 0.3,
            };
          }

          // Generate education details
          if (outcomeType === 'continuing_education') {
            const school = randomElement(GRAD_SCHOOLS);
            eduData = {
              grad_school_name: school.name,
              grad_school_program: school.program,
              grad_school_degree: school.degree,
            };
          }
        }

        // Verification data (70% of known outcomes)
        let verificationData: {
          is_verified?: boolean;
          confidence_score?: number;
          data_source?: 'survey' | 'linkedin' | 'advisor_input' | 'student_self_report';
        } = {};

        if (outcomeStatus === 'known' && Math.random() < 0.7) {
          verificationData = {
            is_verified: true,
            confidence_score: randomBetween(75, 100),
            data_source: randomElement([
              'survey',
              'linkedin',
              'advisor_input',
              'student_self_report',
            ] as const),
          };
        } else if (outcomeStatus === 'partial') {
          verificationData = {
            is_verified: false,
            confidence_score: randomBetween(30, 60),
            data_source: randomElement(['survey', 'linkedin'] as const),
          };
        }

        const externalOutcomeId = `${cohortId}_${studentId.toLowerCase()}`;

        // Check if outcome already exists
        const existingOutcome = await ctx.db
          .query('graduate_outcomes')
          .withIndex('by_external_outcome_id', (q) =>
            q.eq('institution_id', args.universityId).eq('external_outcome_id', externalOutcomeId),
          )
          .first();

        if (existingOutcome) {
          continue;
        }

        await ctx.db.insert('graduate_outcomes', {
          cohort_id: cohortId,
          institution_id: args.universityId,
          major_id: majorId,
          external_student_id: studentId,
          student_email: email,
          student_name: `${firstName} ${lastName}`,
          external_outcome_id: externalOutcomeId,
          outcome_status: outcomeStatus,
          outcome_type: outcomeType,
          ...employerData,
          ...eduData,
          ...verificationData,
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        createdCount++;
      }

      console.log(`Created ${outcomesForThisCohort} outcomes for cohort ${cohortYear}`);
    }

    console.log(`\nSeed completed! Created ${createdCount} outcomes.`);

    // Return summary
    return {
      success: true,
      cohortsCreated: newCohortsCount,
      outcomesCreated: createdCount,
    };
  },
});

// Helper mutation to list all outcomes (for verification)
export const listDemoOutcomes = internalQuery({
  args: {
    universityId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const outcomes = await ctx.db
      .query('graduate_outcomes')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.universityId))
      .take(10);

    return outcomes;
  },
});
