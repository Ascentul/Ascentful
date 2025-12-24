/**
 * Industry Taxonomy for Career Explorer
 *
 * Defines industries with their specific career progressions, entry paths,
 * and credential requirements. This enables industry-aware career recommendations
 * that reflect real-world career paths across different fields.
 */

// Industry identifiers
export type Industry =
  | 'technology'
  | 'healthcare'
  | 'finance'
  | 'legal'
  | 'academia'
  | 'science_research'
  | 'manufacturing'
  | 'trades'
  | 'government'
  | 'nonprofit'
  | 'creative'
  | 'consulting'
  | 'retail'
  | 'hospitality'
  | 'education'
  | 'media'
  | 'real_estate';

// Entry path types - how people typically enter the industry
export type EntryPathType =
  | 'internship'
  | 'apprenticeship'
  | 'residency'
  | 'clinical_rotation'
  | 'research_assistantship'
  | 'fellowship'
  | 'graduate_assistantship'
  | 'trainee_program'
  | 'associate_program'
  | 'entry_level';

// Career level within an industry
export interface CareerLevel {
  level: number;
  name: string;
  keywords: string[];
  typicalYearsExperience?: { min: number; max: number };
}

// Complete industry configuration
export interface IndustryConfig {
  id: Industry;
  name: string;
  description: string;
  hasInternships: boolean;
  entryPathType: EntryPathType;
  alternativeEntryLabel?: string; // Display name for non-internship entry (e.g., "Research Assistantship")
  careerLevels: CareerLevel[];
  typicalProgression: string[]; // Common role titles in order
  requiredCredentials?: string[]; // Professional credentials needed
  commonCertifications?: string[]; // Optional but helpful certifications
  functionalAreas: string[]; // Sub-specialties within the industry
}

// Industry configurations
export const INDUSTRIES: Record<Industry, IndustryConfig> = {
  technology: {
    id: 'technology',
    name: 'Technology',
    description: 'Software development, IT, and tech product companies',
    hasInternships: true,
    entryPathType: 'internship',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'internship'] },
      {
        level: 1,
        name: 'Entry Level',
        keywords: ['junior', 'associate', 'entry', 'jr.', 'jr ', 'i ', ' i'],
        typicalYearsExperience: { min: 0, max: 2 },
      },
      {
        level: 2,
        name: 'Mid-Level',
        keywords: ['ii', ' 2', 'mid'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Senior',
        keywords: ['senior', 'sr.', 'sr ', 'iii', ' 3'],
        typicalYearsExperience: { min: 5, max: 8 },
      },
      {
        level: 4,
        name: 'Staff',
        keywords: ['staff', 'tech lead', 'team lead'],
        typicalYearsExperience: { min: 8, max: 12 },
      },
      {
        level: 5,
        name: 'Principal',
        keywords: ['principal', 'distinguished', 'fellow'],
        typicalYearsExperience: { min: 12, max: 20 },
      },
      {
        level: 6,
        name: 'Manager',
        keywords: ['manager', 'mgr'],
        typicalYearsExperience: { min: 5, max: 10 },
      },
      {
        level: 7,
        name: 'Senior Manager',
        keywords: ['senior manager', 'sr. manager'],
        typicalYearsExperience: { min: 8, max: 12 },
      },
      {
        level: 8,
        name: 'Director',
        keywords: ['director', 'head of'],
        typicalYearsExperience: { min: 10, max: 15 },
      },
      {
        level: 9,
        name: 'Senior Director',
        keywords: ['senior director', 'sr. director'],
        typicalYearsExperience: { min: 12, max: 18 },
      },
      {
        level: 10,
        name: 'VP',
        keywords: ['vp', 'vice president', 'v.p.'],
        typicalYearsExperience: { min: 15, max: 25 },
      },
      {
        level: 11,
        name: 'SVP/EVP',
        keywords: ['svp', 'senior vice president', 'evp', 'executive vice president'],
        typicalYearsExperience: { min: 18, max: 30 },
      },
      {
        level: 12,
        name: 'C-Suite',
        keywords: ['ceo', 'cto', 'cfo', 'cmo', 'coo', 'cio', 'chief'],
        typicalYearsExperience: { min: 20, max: 40 },
      },
    ],
    typicalProgression: [
      'Intern',
      'Junior Engineer',
      'Software Engineer',
      'Senior Engineer',
      'Staff Engineer',
      'Principal Engineer',
      'Engineering Manager',
      'Director of Engineering',
      'VP of Engineering',
      'CTO',
    ],
    commonCertifications: [
      'AWS Certified',
      'Google Cloud Certified',
      'Kubernetes',
      'PMP',
      'Scrum Master',
    ],
    functionalAreas: [
      'software',
      'data',
      'infrastructure',
      'security',
      'product',
      'design',
      'devops',
      'mobile',
      'frontend',
      'backend',
      'fullstack',
      'ml',
      'ai',
    ],
  },

  healthcare: {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Medical, nursing, and clinical care professions',
    hasInternships: false,
    entryPathType: 'clinical_rotation',
    alternativeEntryLabel: 'Clinical Rotation',
    careerLevels: [
      { level: 0, name: 'Student/Volunteer', keywords: ['student', 'volunteer', 'aide'] },
      {
        level: 1,
        name: 'Clinical Entry',
        keywords: ['cna', 'lpn', 'medical assistant', 'phlebotomist'],
        typicalYearsExperience: { min: 0, max: 2 },
      },
      {
        level: 2,
        name: 'Resident/Fellow',
        keywords: ['resident', 'fellow', 'intern'],
        typicalYearsExperience: { min: 0, max: 7 },
      },
      {
        level: 3,
        name: 'Staff Clinician',
        keywords: ['rn', 'nurse', 'staff', 'attending'],
        typicalYearsExperience: { min: 2, max: 8 },
      },
      {
        level: 4,
        name: 'Senior Clinician',
        keywords: ['senior', 'specialist', 'np', 'pa'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 5,
        name: 'Clinical Lead',
        keywords: ['lead', 'charge', 'supervisor'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 6,
        name: 'Manager',
        keywords: ['nurse manager', 'department manager', 'unit manager'],
        typicalYearsExperience: { min: 10, max: 18 },
      },
      {
        level: 7,
        name: 'Director',
        keywords: ['director', 'department head', 'chief'],
        typicalYearsExperience: { min: 12, max: 22 },
      },
      {
        level: 8,
        name: 'Executive',
        keywords: ['cno', 'cmo', 'vp', 'administrator'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Clinical Rotation',
      'Staff Nurse',
      'Senior Nurse',
      'Charge Nurse',
      'Nurse Manager',
      'Director of Nursing',
      'VP of Nursing',
      'Chief Nursing Officer',
    ],
    requiredCredentials: ['RN License', 'MD', 'DO', 'NP', 'PA', 'APRN'],
    commonCertifications: ['BLS', 'ACLS', 'CCRN', 'CNOR', 'Board Certification'],
    functionalAreas: [
      'nursing',
      'medicine',
      'surgery',
      'pediatrics',
      'oncology',
      'cardiology',
      'emergency',
      'icu',
      'mental health',
      'pharmacy',
      'radiology',
    ],
  },

  science_research: {
    id: 'science_research',
    name: 'Science & Research',
    description: 'Scientific research in academia, pharma, and industry',
    hasInternships: false,
    entryPathType: 'research_assistantship',
    alternativeEntryLabel: 'Research Assistantship',
    careerLevels: [
      {
        level: 0,
        name: 'Undergraduate Research',
        keywords: ['undergraduate', 'lab assistant', 'research assistant'],
      },
      {
        level: 1,
        name: 'Graduate Student',
        keywords: ['phd student', 'graduate student', 'masters student', 'phd candidate'],
        typicalYearsExperience: { min: 0, max: 6 },
      },
      {
        level: 2,
        name: 'Research Associate',
        keywords: ['research associate', 'scientist i', 'associate scientist'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'PostDoc',
        keywords: ['postdoc', 'postdoctoral', 'post-doctoral'],
        typicalYearsExperience: { min: 4, max: 8 },
      },
      {
        level: 4,
        name: 'Research Scientist',
        keywords: ['scientist ii', 'research scientist', 'scientist'],
        typicalYearsExperience: { min: 5, max: 10 },
      },
      {
        level: 5,
        name: 'Senior Scientist',
        keywords: ['senior scientist', 'scientist iii', 'senior research scientist'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 6,
        name: 'Principal Scientist',
        keywords: ['principal scientist', 'staff scientist', 'distinguished scientist'],
        typicalYearsExperience: { min: 12, max: 20 },
      },
      {
        level: 7,
        name: 'Research Director',
        keywords: ['director', 'research director', 'head of research'],
        typicalYearsExperience: { min: 15, max: 25 },
      },
      {
        level: 8,
        name: 'VP/CSO',
        keywords: ['vp', 'cso', 'chief scientific officer', 'vp of research'],
        typicalYearsExperience: { min: 18, max: 35 },
      },
    ],
    typicalProgression: [
      'Lab Assistant',
      'Research Associate',
      'PhD Student',
      'PostDoc',
      'Research Scientist',
      'Senior Scientist',
      'Principal Scientist',
      'Research Director',
      'VP R&D',
      'CSO',
    ],
    requiredCredentials: ['PhD', 'MS'],
    commonCertifications: ['GLP', 'GMP', 'Biosafety'],
    functionalAreas: [
      'chemistry',
      'biology',
      'biochemistry',
      'pharmacology',
      'materials science',
      'physics',
      'neuroscience',
      'genetics',
      'immunology',
    ],
  },

  academia: {
    id: 'academia',
    name: 'Academia',
    description: 'University teaching and academic research careers',
    hasInternships: false,
    entryPathType: 'graduate_assistantship',
    alternativeEntryLabel: 'Graduate Assistantship',
    careerLevels: [
      {
        level: 0,
        name: 'Teaching Assistant',
        keywords: ['teaching assistant', 'ta', 'graduate assistant'],
      },
      {
        level: 1,
        name: 'PhD Candidate',
        keywords: ['phd candidate', 'phd student', 'doctoral candidate'],
        typicalYearsExperience: { min: 0, max: 6 },
      },
      {
        level: 2,
        name: 'PostDoc',
        keywords: ['postdoc', 'postdoctoral researcher', 'research fellow'],
        typicalYearsExperience: { min: 4, max: 8 },
      },
      {
        level: 3,
        name: 'Lecturer/Instructor',
        keywords: ['lecturer', 'instructor', 'adjunct', 'visiting'],
        typicalYearsExperience: { min: 2, max: 10 },
      },
      {
        level: 4,
        name: 'Assistant Professor',
        keywords: ['assistant professor', 'asst. professor', 'asst prof'],
        typicalYearsExperience: { min: 6, max: 12 },
      },
      {
        level: 5,
        name: 'Associate Professor',
        keywords: ['associate professor', 'assoc. professor', 'assoc prof'],
        typicalYearsExperience: { min: 12, max: 20 },
      },
      {
        level: 6,
        name: 'Full Professor',
        keywords: ['professor', 'full professor', 'tenured'],
        typicalYearsExperience: { min: 18, max: 35 },
      },
      {
        level: 7,
        name: 'Named/Endowed Chair',
        keywords: ['chair', 'endowed', 'distinguished professor'],
        typicalYearsExperience: { min: 20, max: 40 },
      },
      {
        level: 8,
        name: 'Department Chair',
        keywords: ['department chair', 'department head', 'chair of'],
        typicalYearsExperience: { min: 18, max: 35 },
      },
      {
        level: 9,
        name: 'Dean',
        keywords: ['dean', 'associate dean', 'assistant dean'],
        typicalYearsExperience: { min: 20, max: 40 },
      },
      {
        level: 10,
        name: 'Provost/President',
        keywords: ['provost', 'president', 'chancellor'],
        typicalYearsExperience: { min: 25, max: 50 },
      },
    ],
    typicalProgression: [
      'Graduate Student',
      'PhD Candidate',
      'PostDoc',
      'Assistant Professor',
      'Associate Professor',
      'Full Professor',
      'Department Chair',
      'Dean',
    ],
    requiredCredentials: ['PhD', 'EdD'],
    functionalAreas: ['teaching', 'research', 'administration', 'curriculum', 'student affairs'],
  },

  legal: {
    id: 'legal',
    name: 'Legal',
    description: 'Law firms, corporate legal, and legal services',
    hasInternships: true,
    entryPathType: 'associate_program',
    careerLevels: [
      { level: 0, name: 'Summer Associate', keywords: ['summer associate', 'summer intern'] },
      { level: 1, name: 'Paralegal', keywords: ['paralegal', 'legal assistant'] },
      {
        level: 2,
        name: 'Associate (1-3 years)',
        keywords: ['junior associate', 'first year', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 3,
        name: 'Mid-Level Associate',
        keywords: ['associate'],
        typicalYearsExperience: { min: 3, max: 6 },
      },
      {
        level: 4,
        name: 'Senior Associate',
        keywords: ['senior associate', 'sr. associate'],
        typicalYearsExperience: { min: 6, max: 9 },
      },
      {
        level: 5,
        name: 'Counsel',
        keywords: ['counsel', 'of counsel', 'special counsel'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 6,
        name: 'Junior Partner',
        keywords: ['junior partner', 'income partner', 'non-equity partner'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 7,
        name: 'Partner',
        keywords: ['partner', 'equity partner'],
        typicalYearsExperience: { min: 10, max: 25 },
      },
      {
        level: 8,
        name: 'Senior Partner',
        keywords: ['senior partner', 'managing partner'],
        typicalYearsExperience: { min: 15, max: 35 },
      },
      {
        level: 9,
        name: 'General Counsel',
        keywords: ['general counsel', 'gc', 'clo', 'chief legal officer'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Summer Associate',
      'Associate',
      'Senior Associate',
      'Counsel',
      'Junior Partner',
      'Partner',
      'Senior Partner',
      'Managing Partner',
    ],
    requiredCredentials: ['JD', 'Bar Admission'],
    functionalAreas: [
      'litigation',
      'corporate',
      'intellectual property',
      'tax',
      'real estate',
      'employment',
      'criminal',
      'regulatory',
    ],
  },

  finance: {
    id: 'finance',
    name: 'Finance',
    description: 'Banking, investment, and financial services',
    hasInternships: true,
    entryPathType: 'internship',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'summer analyst'] },
      {
        level: 1,
        name: 'Analyst',
        keywords: ['analyst', 'financial analyst', 'junior analyst'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Senior Analyst',
        keywords: ['senior analyst', 'analyst ii'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Associate',
        keywords: ['associate', 'investment associate'],
        typicalYearsExperience: { min: 3, max: 6 },
      },
      {
        level: 4,
        name: 'Vice President',
        keywords: ['vp', 'vice president'],
        typicalYearsExperience: { min: 5, max: 10 },
      },
      {
        level: 5,
        name: 'Senior Vice President',
        keywords: ['svp', 'senior vice president'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 6,
        name: 'Director',
        keywords: ['director', 'executive director'],
        typicalYearsExperience: { min: 10, max: 18 },
      },
      {
        level: 7,
        name: 'Managing Director',
        keywords: ['md', 'managing director'],
        typicalYearsExperience: { min: 12, max: 25 },
      },
      {
        level: 8,
        name: 'Partner/C-Suite',
        keywords: ['partner', 'cfo', 'cio', 'chief'],
        typicalYearsExperience: { min: 15, max: 35 },
      },
    ],
    typicalProgression: [
      'Analyst',
      'Senior Analyst',
      'Associate',
      'Vice President',
      'Director',
      'Managing Director',
      'Partner',
    ],
    requiredCredentials: ['CPA', 'CFA', 'Series 7', 'Series 63'],
    commonCertifications: ['CFA', 'CPA', 'FRM', 'CAIA'],
    functionalAreas: [
      'investment banking',
      'private equity',
      'venture capital',
      'asset management',
      'wealth management',
      'corporate finance',
      'risk management',
      'trading',
      'research',
    ],
  },

  trades: {
    id: 'trades',
    name: 'Skilled Trades',
    description: 'Electricians, plumbers, carpenters, and skilled labor',
    hasInternships: false,
    entryPathType: 'apprenticeship',
    alternativeEntryLabel: 'Apprenticeship',
    careerLevels: [
      {
        level: 0,
        name: 'Pre-Apprentice',
        keywords: ['pre-apprentice', 'helper', 'laborer'],
      },
      {
        level: 1,
        name: 'Apprentice (Year 1-2)',
        keywords: ['apprentice', 'first year', 'second year'],
        typicalYearsExperience: { min: 0, max: 2 },
      },
      {
        level: 2,
        name: 'Apprentice (Year 3-4)',
        keywords: ['apprentice', 'third year', 'fourth year'],
        typicalYearsExperience: { min: 2, max: 4 },
      },
      {
        level: 3,
        name: 'Journeyman',
        keywords: ['journeyman', 'journeyworker', 'tradesman'],
        typicalYearsExperience: { min: 4, max: 10 },
      },
      {
        level: 4,
        name: 'Master',
        keywords: ['master', 'master electrician', 'master plumber'],
        typicalYearsExperience: { min: 8, max: 20 },
      },
      {
        level: 5,
        name: 'Foreman',
        keywords: ['foreman', 'crew leader', 'lead'],
        typicalYearsExperience: { min: 6, max: 15 },
      },
      {
        level: 6,
        name: 'Superintendent',
        keywords: ['superintendent', 'site manager', 'project superintendent'],
        typicalYearsExperience: { min: 10, max: 20 },
      },
      {
        level: 7,
        name: 'Project Manager',
        keywords: ['project manager', 'pm'],
        typicalYearsExperience: { min: 10, max: 25 },
      },
      {
        level: 8,
        name: 'Business Owner/Executive',
        keywords: ['owner', 'president', 'general manager'],
        typicalYearsExperience: { min: 15, max: 40 },
      },
    ],
    typicalProgression: [
      'Apprentice',
      'Journeyman',
      'Master',
      'Foreman',
      'Superintendent',
      'Project Manager',
      'Business Owner',
    ],
    requiredCredentials: ['Journeyman License', 'Master License', 'Contractor License'],
    functionalAreas: [
      'electrical',
      'plumbing',
      'hvac',
      'carpentry',
      'welding',
      'masonry',
      'roofing',
      'painting',
    ],
  },

  consulting: {
    id: 'consulting',
    name: 'Consulting',
    description: 'Management, strategy, and business consulting',
    hasInternships: true,
    entryPathType: 'internship',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'summer consultant'] },
      {
        level: 1,
        name: 'Analyst/Associate',
        keywords: ['analyst', 'business analyst', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Consultant',
        keywords: ['consultant', 'senior analyst'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Senior Consultant',
        keywords: ['senior consultant', 'sr. consultant'],
        typicalYearsExperience: { min: 4, max: 8 },
      },
      {
        level: 4,
        name: 'Manager',
        keywords: ['manager', 'engagement manager', 'project leader'],
        typicalYearsExperience: { min: 5, max: 10 },
      },
      {
        level: 5,
        name: 'Senior Manager',
        keywords: ['senior manager', 'associate principal'],
        typicalYearsExperience: { min: 8, max: 12 },
      },
      {
        level: 6,
        name: 'Principal/Director',
        keywords: ['principal', 'director', 'associate partner'],
        typicalYearsExperience: { min: 10, max: 18 },
      },
      {
        level: 7,
        name: 'Partner',
        keywords: ['partner', 'senior partner'],
        typicalYearsExperience: { min: 12, max: 30 },
      },
    ],
    typicalProgression: [
      'Analyst',
      'Consultant',
      'Senior Consultant',
      'Manager',
      'Senior Manager',
      'Principal',
      'Partner',
    ],
    commonCertifications: ['PMP', 'Six Sigma', 'Lean'],
    functionalAreas: [
      'strategy',
      'operations',
      'digital',
      'technology',
      'organization',
      'finance',
      'marketing',
    ],
  },

  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Production, operations, and manufacturing management',
    hasInternships: true,
    entryPathType: 'trainee_program',
    careerLevels: [
      { level: 0, name: 'Intern/Trainee', keywords: ['intern', 'trainee', 'co-op'] },
      {
        level: 1,
        name: 'Operator/Technician',
        keywords: ['operator', 'technician', 'production worker'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Senior Technician',
        keywords: ['senior technician', 'lead operator', 'specialist'],
        typicalYearsExperience: { min: 2, max: 6 },
      },
      {
        level: 3,
        name: 'Engineer',
        keywords: ['engineer', 'process engineer', 'manufacturing engineer'],
        typicalYearsExperience: { min: 0, max: 5 },
      },
      {
        level: 4,
        name: 'Senior Engineer',
        keywords: ['senior engineer', 'sr. engineer'],
        typicalYearsExperience: { min: 5, max: 10 },
      },
      {
        level: 5,
        name: 'Supervisor',
        keywords: ['supervisor', 'shift supervisor', 'production supervisor'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 6,
        name: 'Manager',
        keywords: ['manager', 'production manager', 'plant manager'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 7,
        name: 'Director',
        keywords: ['director', 'operations director'],
        typicalYearsExperience: { min: 12, max: 22 },
      },
      {
        level: 8,
        name: 'VP/COO',
        keywords: ['vp', 'vice president', 'coo'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Technician',
      'Engineer',
      'Senior Engineer',
      'Supervisor',
      'Manager',
      'Plant Manager',
      'Director',
      'VP Operations',
    ],
    commonCertifications: ['Six Sigma', 'Lean', 'PMP', 'ASQ'],
    functionalAreas: [
      'production',
      'quality',
      'process',
      'maintenance',
      'supply chain',
      'safety',
      'lean',
    ],
  },

  government: {
    id: 'government',
    name: 'Government',
    description: 'Federal, state, and local government positions',
    hasInternships: true,
    entryPathType: 'entry_level',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'fellow', 'page'] },
      {
        level: 1,
        name: 'Entry Level (GS 5-7)',
        keywords: ['gs-5', 'gs-6', 'gs-7', 'entry', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Mid-Level (GS 9-11)',
        keywords: ['gs-9', 'gs-10', 'gs-11', 'specialist'],
        typicalYearsExperience: { min: 2, max: 7 },
      },
      {
        level: 3,
        name: 'Senior (GS 12-13)',
        keywords: ['gs-12', 'gs-13', 'senior', 'lead'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 4,
        name: 'Supervisor (GS 14)',
        keywords: ['gs-14', 'supervisor', 'team lead'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 5,
        name: 'Manager (GS 15)',
        keywords: ['gs-15', 'branch chief', 'division director'],
        typicalYearsExperience: { min: 10, max: 20 },
      },
      {
        level: 6,
        name: 'Senior Executive (SES)',
        keywords: ['ses', 'senior executive', 'deputy director', 'director'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
      {
        level: 7,
        name: 'Political Appointee',
        keywords: ['commissioner', 'administrator', 'secretary', 'appointee'],
      },
    ],
    typicalProgression: [
      'GS-7 Analyst',
      'GS-9 Specialist',
      'GS-11 Senior Specialist',
      'GS-12 Team Lead',
      'GS-13 Supervisor',
      'GS-14 Branch Chief',
      'GS-15 Director',
      'SES',
    ],
    commonCertifications: ['Security Clearance', 'PMP', 'CISSP'],
    functionalAreas: [
      'policy',
      'analysis',
      'administration',
      'regulatory',
      'enforcement',
      'research',
    ],
  },

  nonprofit: {
    id: 'nonprofit',
    name: 'Nonprofit',
    description: 'Charitable organizations and social enterprises',
    hasInternships: true,
    entryPathType: 'entry_level',
    careerLevels: [
      { level: 0, name: 'Volunteer/Intern', keywords: ['volunteer', 'intern', 'fellow'] },
      {
        level: 1,
        name: 'Coordinator',
        keywords: ['coordinator', 'assistant', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Specialist',
        keywords: ['specialist', 'officer', 'analyst'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Manager',
        keywords: ['manager', 'program manager'],
        typicalYearsExperience: { min: 4, max: 10 },
      },
      {
        level: 4,
        name: 'Senior Manager',
        keywords: ['senior manager', 'sr. manager'],
        typicalYearsExperience: { min: 6, max: 12 },
      },
      {
        level: 5,
        name: 'Director',
        keywords: ['director', 'program director'],
        typicalYearsExperience: { min: 8, max: 18 },
      },
      {
        level: 6,
        name: 'VP',
        keywords: ['vp', 'vice president'],
        typicalYearsExperience: { min: 12, max: 22 },
      },
      {
        level: 7,
        name: 'Executive Director/CEO',
        keywords: ['executive director', 'ed', 'ceo', 'president'],
        typicalYearsExperience: { min: 15, max: 35 },
      },
    ],
    typicalProgression: [
      'Coordinator',
      'Specialist',
      'Manager',
      'Senior Manager',
      'Director',
      'VP',
      'Executive Director',
    ],
    functionalAreas: [
      'programs',
      'development',
      'fundraising',
      'communications',
      'advocacy',
      'operations',
      'grants',
    ],
  },

  creative: {
    id: 'creative',
    name: 'Creative & Arts',
    description: 'Design, arts, entertainment, and creative industries',
    hasInternships: true,
    entryPathType: 'internship',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'apprentice'] },
      {
        level: 1,
        name: 'Junior',
        keywords: ['junior', 'assistant', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Mid-Level',
        keywords: ['designer', 'artist', 'writer', 'producer'],
        typicalYearsExperience: { min: 2, max: 6 },
      },
      {
        level: 3,
        name: 'Senior',
        keywords: ['senior', 'sr.'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 4,
        name: 'Lead/Principal',
        keywords: ['lead', 'principal', 'staff'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 5,
        name: 'Manager/Art Director',
        keywords: ['manager', 'art director', 'creative manager'],
        typicalYearsExperience: { min: 8, max: 18 },
      },
      {
        level: 6,
        name: 'Director',
        keywords: ['director', 'design director', 'creative director'],
        typicalYearsExperience: { min: 12, max: 25 },
      },
      {
        level: 7,
        name: 'VP/Chief Creative',
        keywords: ['vp', 'cco', 'chief creative', 'head of design'],
        typicalYearsExperience: { min: 15, max: 35 },
      },
    ],
    typicalProgression: [
      'Junior Designer',
      'Designer',
      'Senior Designer',
      'Lead Designer',
      'Art Director',
      'Creative Director',
      'VP Creative',
    ],
    functionalAreas: [
      'graphic design',
      'ux/ui',
      'brand',
      'motion',
      'illustration',
      'photography',
      'video',
      'copywriting',
    ],
  },

  retail: {
    id: 'retail',
    name: 'Retail',
    description: 'Retail operations and store management',
    hasInternships: true,
    entryPathType: 'entry_level',
    careerLevels: [
      {
        level: 0,
        name: 'Associate',
        keywords: ['associate', 'clerk', 'cashier', 'team member'],
      },
      {
        level: 1,
        name: 'Senior Associate',
        keywords: ['senior associate', 'key holder', 'lead'],
        typicalYearsExperience: { min: 1, max: 3 },
      },
      {
        level: 2,
        name: 'Supervisor',
        keywords: ['supervisor', 'shift lead', 'department lead'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Assistant Manager',
        keywords: ['assistant manager', 'asst. manager'],
        typicalYearsExperience: { min: 3, max: 7 },
      },
      {
        level: 4,
        name: 'Store Manager',
        keywords: ['store manager', 'general manager'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 5,
        name: 'District Manager',
        keywords: ['district manager', 'area manager', 'multi-unit manager'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 6,
        name: 'Regional Manager',
        keywords: ['regional manager', 'regional director'],
        typicalYearsExperience: { min: 10, max: 20 },
      },
      {
        level: 7,
        name: 'VP/Executive',
        keywords: ['vp', 'vice president', 'director of stores'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Sales Associate',
      'Key Holder',
      'Assistant Manager',
      'Store Manager',
      'District Manager',
      'Regional Manager',
      'VP Retail',
    ],
    functionalAreas: [
      'sales',
      'operations',
      'visual merchandising',
      'inventory',
      'customer service',
      'loss prevention',
    ],
  },

  hospitality: {
    id: 'hospitality',
    name: 'Hospitality',
    description: 'Hotels, restaurants, and hospitality management',
    hasInternships: true,
    entryPathType: 'entry_level',
    careerLevels: [
      {
        level: 0,
        name: 'Entry Level',
        keywords: ['host', 'server', 'front desk', 'busser', 'runner'],
      },
      {
        level: 1,
        name: 'Senior Staff',
        keywords: ['lead', 'captain', 'senior'],
        typicalYearsExperience: { min: 1, max: 3 },
      },
      {
        level: 2,
        name: 'Supervisor',
        keywords: ['supervisor', 'shift supervisor'],
        typicalYearsExperience: { min: 2, max: 5 },
      },
      {
        level: 3,
        name: 'Assistant Manager',
        keywords: ['assistant manager', 'asst. manager'],
        typicalYearsExperience: { min: 3, max: 7 },
      },
      {
        level: 4,
        name: 'Department Manager',
        keywords: ['f&b manager', 'front office manager', 'chef de cuisine'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 5,
        name: 'General Manager',
        keywords: ['general manager', 'gm', 'hotel manager', 'restaurant manager'],
        typicalYearsExperience: { min: 8, max: 18 },
      },
      {
        level: 6,
        name: 'Area/Regional Manager',
        keywords: ['area manager', 'regional manager', 'multi-property'],
        typicalYearsExperience: { min: 12, max: 22 },
      },
      {
        level: 7,
        name: 'VP/Executive',
        keywords: ['vp', 'vice president', 'coo', 'director of operations'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Server',
      'Lead Server',
      'Supervisor',
      'Assistant Manager',
      'F&B Manager',
      'General Manager',
      'Regional Manager',
      'VP Operations',
    ],
    commonCertifications: ['ServSafe', 'Hospitality Management Certificate'],
    functionalAreas: [
      'food & beverage',
      'front office',
      'housekeeping',
      'events',
      'revenue management',
      'culinary',
    ],
  },

  education: {
    id: 'education',
    name: 'K-12 Education',
    description: 'K-12 teaching and school administration',
    hasInternships: false,
    entryPathType: 'trainee_program',
    alternativeEntryLabel: 'Student Teaching',
    careerLevels: [
      {
        level: 0,
        name: 'Student Teacher',
        keywords: ['student teacher', 'teaching intern', 'practicum'],
      },
      {
        level: 1,
        name: 'Teacher',
        keywords: ['teacher', 'instructor'],
        typicalYearsExperience: { min: 0, max: 5 },
      },
      {
        level: 2,
        name: 'Senior Teacher',
        keywords: ['senior teacher', 'mentor teacher', 'lead teacher'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 3,
        name: 'Department Head',
        keywords: ['department head', 'department chair', 'team lead'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 4,
        name: 'Specialist',
        keywords: ['curriculum specialist', 'instructional coach', 'coordinator'],
        typicalYearsExperience: { min: 8, max: 18 },
      },
      {
        level: 5,
        name: 'Assistant Principal',
        keywords: ['assistant principal', 'ap', 'vice principal'],
        typicalYearsExperience: { min: 10, max: 18 },
      },
      {
        level: 6,
        name: 'Principal',
        keywords: ['principal', 'head of school', 'headmaster'],
        typicalYearsExperience: { min: 12, max: 25 },
      },
      {
        level: 7,
        name: 'District Administrator',
        keywords: ['director', 'superintendent', 'district administrator'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Student Teacher',
      'Teacher',
      'Senior Teacher',
      'Department Head',
      'Assistant Principal',
      'Principal',
      'Superintendent',
    ],
    requiredCredentials: ['Teaching License', 'Teaching Certification'],
    commonCertifications: ['NBCT', 'Admin Credential'],
    functionalAreas: [
      'elementary',
      'secondary',
      'special education',
      'curriculum',
      'counseling',
      'administration',
    ],
  },

  media: {
    id: 'media',
    name: 'Media & Communications',
    description: 'Journalism, broadcasting, and media production',
    hasInternships: true,
    entryPathType: 'internship',
    careerLevels: [
      { level: 0, name: 'Intern', keywords: ['intern', 'fellow'] },
      {
        level: 1,
        name: 'Assistant',
        keywords: ['assistant', 'coordinator', 'associate'],
        typicalYearsExperience: { min: 0, max: 3 },
      },
      {
        level: 2,
        name: 'Staff',
        keywords: ['reporter', 'writer', 'producer', 'editor'],
        typicalYearsExperience: { min: 2, max: 6 },
      },
      {
        level: 3,
        name: 'Senior Staff',
        keywords: ['senior', 'sr.'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 4,
        name: 'Manager/Supervisor',
        keywords: ['manager', 'supervisor', 'assignment editor'],
        typicalYearsExperience: { min: 8, max: 15 },
      },
      {
        level: 5,
        name: 'Director',
        keywords: ['director', 'bureau chief', 'section editor'],
        typicalYearsExperience: { min: 10, max: 20 },
      },
      {
        level: 6,
        name: 'VP/Executive',
        keywords: ['vp', 'editor-in-chief', 'executive producer'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Assistant',
      'Reporter',
      'Senior Reporter',
      'Assignment Editor',
      'Bureau Chief',
      'Editor-in-Chief',
    ],
    functionalAreas: [
      'news',
      'entertainment',
      'production',
      'digital',
      'broadcast',
      'print',
      'social media',
    ],
  },

  real_estate: {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Real estate sales, development, and property management',
    hasInternships: true,
    entryPathType: 'trainee_program',
    careerLevels: [
      {
        level: 0,
        name: 'Trainee',
        keywords: ['trainee', 'assistant', 'intern'],
      },
      {
        level: 1,
        name: 'Agent',
        keywords: ['agent', 'sales associate', 'realtor'],
        typicalYearsExperience: { min: 0, max: 5 },
      },
      {
        level: 2,
        name: 'Senior Agent',
        keywords: ['senior agent', 'top producer'],
        typicalYearsExperience: { min: 3, max: 10 },
      },
      {
        level: 3,
        name: 'Team Lead/Manager',
        keywords: ['team lead', 'sales manager', 'property manager'],
        typicalYearsExperience: { min: 5, max: 12 },
      },
      {
        level: 4,
        name: 'Broker/Director',
        keywords: ['broker', 'associate broker', 'director'],
        typicalYearsExperience: { min: 8, max: 18 },
      },
      {
        level: 5,
        name: 'Managing Broker',
        keywords: ['managing broker', 'branch manager'],
        typicalYearsExperience: { min: 10, max: 22 },
      },
      {
        level: 6,
        name: 'VP/Executive',
        keywords: ['vp', 'regional director', 'president'],
        typicalYearsExperience: { min: 15, max: 30 },
      },
    ],
    typicalProgression: [
      'Agent',
      'Senior Agent',
      'Team Lead',
      'Broker',
      'Managing Broker',
      'Regional Director',
    ],
    requiredCredentials: ['Real Estate License', 'Broker License'],
    commonCertifications: ['CRS', 'ABR', 'CCIM', 'CPM'],
    functionalAreas: [
      'residential sales',
      'commercial sales',
      'property management',
      'development',
      'investment',
      'leasing',
    ],
  },
};

/**
 * Detect industry from role title
 */
export function detectIndustryFromRole(role: string): Industry {
  const roleLower = role.toLowerCase();

  // Technology role keywords organized by category for maintainability
  const engineeringKeywords =
    'software|developer|engineer|programmer|devops|sre|frontend|backend|fullstack|full.stack';
  const dataKeywords =
    'data engineer|data scientist|data analyst|machine learning|ml engineer|ai engineer';
  const productDesignKeywords = 'product manager|ux|ui|web developer|mobile developer';
  const infrastructureKeywords =
    'cloud|infrastructure|platform|api|site reliability|security engineer|qa engineer|test engineer';

  const techRoleRegex = new RegExp(
    `${engineeringKeywords}|${dataKeywords}|${productDesignKeywords}|${infrastructureKeywords}`,
    'i',
  );

  // Technology keywords - CHECK FIRST as these are most common and specific
  if (techRoleRegex.test(roleLower)) {
    return 'technology';
  }

  // Healthcare keywords - exclude "clinical" if it's clearly tech (e.g., "clinical data")
  if (
    /nurse|rn|md|physician|doctor|patient|medical|healthcare|hospital|pharma|dental|therapist|radiolog|patholog/i.test(
      roleLower,
    )
  ) {
    return 'healthcare';
  }

  // Science/Research keywords
  if (
    /scientist|research|lab|phd|postdoc|chemistry|biology|physics|biochem|genetics|neuroscience/i.test(
      roleLower,
    )
  ) {
    return 'science_research';
  }

  // Academia keywords
  if (/professor|lecturer|academic|faculty|dean|tenure|university|postdoc/i.test(roleLower)) {
    return 'academia';
  }

  // Legal keywords
  if (/attorney|lawyer|counsel|paralegal|legal|law firm|litigation|partner/i.test(roleLower)) {
    return 'legal';
  }

  // Finance keywords
  if (
    /investment|banking|trader|analyst.*finance|portfolio|private equity|hedge fund|wealth|asset management|cfa|cpa/i.test(
      roleLower,
    )
  ) {
    return 'finance';
  }

  // Trades keywords
  if (
    /electrician|plumber|carpenter|hvac|welder|mechanic|technician|apprentice|journeyman|master.*trade/i.test(
      roleLower,
    )
  ) {
    return 'trades';
  }

  // Consulting keywords
  if (/consultant|consulting|mckinsey|bain|bcg|deloitte|advisory/i.test(roleLower)) {
    return 'consulting';
  }

  // Manufacturing keywords
  if (
    /manufacturing|production|plant|assembly|quality|process engineer|operations|lean|six sigma/i.test(
      roleLower,
    )
  ) {
    return 'manufacturing';
  }

  // Government keywords
  if (
    /government|federal|state.*agency|gs-\d|civil service|public sector|policy/i.test(roleLower)
  ) {
    return 'government';
  }

  // Nonprofit keywords
  if (
    /nonprofit|non-profit|foundation|ngo|charity|development.*officer|grant|philanthropy/i.test(
      roleLower,
    )
  ) {
    return 'nonprofit';
  }

  // Education (K-12)
  if (
    /teacher|principal|superintendent|k-12|elementary|high school|middle school/i.test(roleLower)
  ) {
    return 'education';
  }

  // Hospitality keywords
  if (/hotel|restaurant|chef|hospitality|f&b|front desk|concierge|housekeeping/i.test(roleLower)) {
    return 'hospitality';
  }

  // Retail keywords
  if (/retail|store manager|sales associate|merchandising|district manager/i.test(roleLower)) {
    return 'retail';
  }

  // Creative keywords
  if (
    /designer|artist|creative.*director|art.*director|photographer|filmmaker|animator/i.test(
      roleLower,
    )
  ) {
    return 'creative';
  }

  // Media keywords
  if (/journalist|reporter|editor|producer|broadcast|media|news/i.test(roleLower)) {
    return 'media';
  }

  // Real estate keywords
  if (/real estate|realtor|broker|property manager|leasing/i.test(roleLower)) {
    return 'real_estate';
  }

  // Default fallback - technology is a safe default for general business/office roles
  return 'technology';
}

/**
 * Get career level for a role in a specific industry
 */
export function getCareerLevel(
  role: string,
  industry: Industry,
): { level: number; name: string } | null {
  const roleLower = role.toLowerCase();
  const industryConfig = INDUSTRIES[industry];

  // Check levels from highest to lowest for more specific matches first
  for (let i = industryConfig.careerLevels.length - 1; i >= 0; i--) {
    const levelInfo = industryConfig.careerLevels[i];
    for (const keyword of levelInfo.keywords) {
      if (roleLower.includes(keyword.toLowerCase())) {
        return { level: levelInfo.level, name: levelInfo.name };
      }
    }
  }

  // Default to mid-level (around level 2-3) if no match
  const midLevel = Math.floor(industryConfig.careerLevels.length / 3);
  return {
    level: midLevel,
    name: industryConfig.careerLevels[midLevel]?.name || 'Mid-Level',
  };
}

/**
 * Generic career level detection (industry-agnostic)
 * Use as fallback when industry-specific detection returns no match
 */
const GENERIC_CAREER_LEVELS: { keywords: string[]; level: number; name: string }[] = [
  { keywords: ['intern', 'internship'], level: 0, name: 'Intern' },
  {
    keywords: ['junior', 'associate', 'entry', 'assistant', 'trainee', 'apprentice'],
    level: 1,
    name: 'Entry Level',
  },
  {
    keywords: ['specialist', 'analyst', 'coordinator', 'representative'],
    level: 2,
    name: 'Individual Contributor',
  },
  { keywords: ['senior', 'sr.', 'sr '], level: 3, name: 'Senior' },
  { keywords: ['lead', 'team lead', 'tech lead', 'principal'], level: 4, name: 'Lead' },
  { keywords: ['manager', 'mgr'], level: 5, name: 'Manager' },
  { keywords: ['senior manager', 'sr. manager', 'sr manager'], level: 6, name: 'Senior Manager' },
  { keywords: ['director', 'head of', 'head '], level: 7, name: 'Director' },
  {
    keywords: ['senior director', 'sr. director', 'sr director'],
    level: 8,
    name: 'Senior Director',
  },
  { keywords: ['vp', 'vice president', 'v.p.'], level: 9, name: 'VP' },
  { keywords: ['svp', 'senior vice president', 'senior vp'], level: 10, name: 'SVP' },
  { keywords: ['evp', 'executive vice president'], level: 11, name: 'EVP' },
  { keywords: ['ceo', 'cto', 'cfo', 'cmo', 'coo', 'cio', 'chief'], level: 12, name: 'C-Suite' },
];

/**
 * Detect the career level of a role title using generic keywords
 * Returns level 2 (IC) as default if no specific level markers found
 */
export function detectCareerLevelGeneric(title: string): { level: number; name: string } {
  const titleLower = title.toLowerCase();

  // Check from highest to lowest level (more specific matches first)
  // This ensures "Senior Director" is matched before "Director"
  for (let i = GENERIC_CAREER_LEVELS.length - 1; i >= 0; i--) {
    const levelInfo = GENERIC_CAREER_LEVELS[i];
    for (const keyword of levelInfo.keywords) {
      if (titleLower.includes(keyword)) {
        return { level: levelInfo.level, name: levelInfo.name };
      }
    }
  }

  // Default to IC level (2) for unrecognized roles
  return { level: 2, name: 'Individual Contributor' };
}

/**
 * Get the max reasonable level jump for promotions in an industry
 */
export function getMaxReasonableLevelJump(industry: Industry): number {
  // Most industries: 2 levels is ambitious but achievable
  // Some industries have slower progression (academia, trades)
  const slowProgressionIndustries: Industry[] = ['academia', 'trades', 'legal', 'healthcare'];

  if (slowProgressionIndustries.includes(industry)) {
    return 1; // These industries typically require step-by-step progression
  }

  return 2; // Default: up to 2 levels is realistic
}

/**
 * Check if a credential is required for a role in an industry
 */
export function requiresCredential(role: string, industry: Industry): boolean {
  const industryConfig = INDUSTRIES[industry];

  if (!industryConfig.requiredCredentials || industryConfig.requiredCredentials.length === 0) {
    return false;
  }

  // Check role-specific credential requirements
  const roleLower = role.toLowerCase();

  // Healthcare credentials
  if (industry === 'healthcare') {
    if (/nurse|rn|lpn|cna/i.test(roleLower)) return true;
    if (/physician|doctor|md|do/i.test(roleLower)) return true;
    if (/nurse practitioner|np/i.test(roleLower)) return true;
    if (/physician assistant|pa-c/i.test(roleLower)) return true;
  }

  // Legal credentials
  if (industry === 'legal') {
    if (/attorney|lawyer|counsel/i.test(roleLower)) return true;
  }

  // Academia credentials
  if (industry === 'academia') {
    if (/professor|lecturer/i.test(roleLower)) return true;
  }

  // Trades credentials
  if (industry === 'trades') {
    if (/master|journeyman/i.test(roleLower)) return true;
  }

  // Education credentials
  if (industry === 'education') {
    if (/teacher|principal/i.test(roleLower)) return true;
  }

  return false;
}

/**
 * Get required credential for a role
 */
export function getRequiredCredential(role: string, industry: Industry): string | null {
  const roleLower = role.toLowerCase();

  // Healthcare
  if (industry === 'healthcare') {
    if (/physician|doctor|md/i.test(roleLower)) return 'MD/DO';
    if (/nurse practitioner|np/i.test(roleLower)) return 'NP Certification';
    if (/registered nurse|rn/i.test(roleLower)) return 'RN License';
    if (/lpn/i.test(roleLower)) return 'LPN License';
  }

  // Legal
  if (industry === 'legal') {
    if (/attorney|lawyer|counsel/i.test(roleLower)) return 'JD + Bar Admission';
  }

  // Academia
  if (industry === 'academia') {
    if (/professor/i.test(roleLower)) return 'PhD';
  }

  // Trades
  if (industry === 'trades') {
    if (/master electrician/i.test(roleLower)) return 'Master Electrician License';
    if (/master plumber/i.test(roleLower)) return 'Master Plumber License';
    if (/journeyman/i.test(roleLower)) return 'Journeyman License';
  }

  // Education
  if (industry === 'education') {
    if (/teacher/i.test(roleLower)) return 'Teaching Certification';
    if (/principal/i.test(roleLower)) return 'Admin Credential';
  }

  return null;
}
