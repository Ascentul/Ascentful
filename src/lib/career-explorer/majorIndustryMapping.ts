/**
 * Major to Industry Mapping for Career Explorer
 *
 * Maps academic majors to their natural industries and career paths.
 * This enables industry-aware recommendations that match the user's
 * educational background with realistic career trajectories.
 */

import { EntryPathType, Industry } from './industryTaxonomy';

// Career path within an industry
export interface CareerPath {
  name: string;
  description: string;
  roles: string[]; // Progression of role titles
}

// Complete major configuration
export interface MajorConfig {
  name: string;
  aliases: string[]; // Alternative names/spellings
  primaryIndustry: Industry;
  secondaryIndustries?: Industry[];
  entryPath: EntryPathType;
  entryPathLabel: string; // Display label (e.g., "Research Assistantship")
  typicalFirstRole: string;
  requiredCredential?: string;
  commonCertifications?: string[];
  careerPaths: CareerPath[];
}

// Major to industry mappings (50+ majors)
export const MAJOR_INDUSTRY_MAPPING: Record<string, MajorConfig> = {
  // ============================================
  // STEM - Science
  // ============================================

  chemistry: {
    name: 'Chemistry',
    aliases: ['chem', 'chemical sciences'],
    primaryIndustry: 'science_research',
    secondaryIndustries: ['healthcare', 'manufacturing'],
    entryPath: 'research_assistantship',
    entryPathLabel: 'Research Assistantship',
    typicalFirstRole: 'Research Associate',
    commonCertifications: ['GLP', 'GMP'],
    careerPaths: [
      {
        name: 'Industry Research',
        description: 'R&D at pharmaceutical, chemical, or biotech companies',
        roles: [
          'Research Associate',
          'Research Scientist I',
          'Research Scientist II',
          'Senior Scientist',
          'Principal Scientist',
          'Research Director',
          'VP R&D',
          'Chief Scientific Officer',
        ],
      },
      {
        name: 'Academia',
        description: 'University teaching and research',
        roles: [
          'PhD Student',
          'PostDoc',
          'Assistant Professor',
          'Associate Professor',
          'Full Professor',
          'Department Chair',
        ],
      },
      {
        name: 'Pharmaceutical',
        description: 'Drug development and formulation',
        roles: [
          'Formulation Scientist',
          'Senior Formulation Scientist',
          'Formulation Lead',
          'Associate Director Formulation',
          'Director CMC',
        ],
      },
      {
        name: 'Quality/Regulatory',
        description: 'Quality control and regulatory affairs',
        roles: [
          'QC Analyst',
          'Senior QC Analyst',
          'QC Supervisor',
          'QC Manager',
          'Director Quality',
        ],
      },
    ],
  },

  biology: {
    name: 'Biology',
    aliases: ['bio', 'biological sciences', 'life sciences'],
    primaryIndustry: 'science_research',
    secondaryIndustries: ['healthcare'],
    entryPath: 'research_assistantship',
    entryPathLabel: 'Research Assistantship',
    typicalFirstRole: 'Research Associate',
    careerPaths: [
      {
        name: 'Biotech/Pharma Research',
        description: 'Research at biotech or pharmaceutical companies',
        roles: [
          'Research Associate',
          'Scientist I',
          'Scientist II',
          'Senior Scientist',
          'Principal Scientist',
          'Director',
          'VP Research',
        ],
      },
      {
        name: 'Academia',
        description: 'University research and teaching',
        roles: [
          'PhD Student',
          'PostDoc',
          'Research Associate',
          'Assistant Professor',
          'Associate Professor',
          'Professor',
        ],
      },
      {
        name: 'Healthcare Adjacent',
        description: 'Clinical research and medical science',
        roles: [
          'Clinical Research Associate',
          'Clinical Research Manager',
          'Clinical Operations Director',
        ],
      },
    ],
  },

  biochemistry: {
    name: 'Biochemistry',
    aliases: ['biochem', 'molecular biology'],
    primaryIndustry: 'science_research',
    secondaryIndustries: ['healthcare'],
    entryPath: 'research_assistantship',
    entryPathLabel: 'Research Assistantship',
    typicalFirstRole: 'Research Associate',
    careerPaths: [
      {
        name: 'Biotech Research',
        description: 'Drug discovery and development',
        roles: [
          'Research Associate',
          'Scientist',
          'Senior Scientist',
          'Principal Scientist',
          'Associate Director',
          'Director',
        ],
      },
      {
        name: 'Academia',
        description: 'Academic research career',
        roles: [
          'PhD Student',
          'PostDoc',
          'Assistant Professor',
          'Associate Professor',
          'Professor',
        ],
      },
    ],
  },

  physics: {
    name: 'Physics',
    aliases: ['phys', 'applied physics'],
    primaryIndustry: 'science_research',
    secondaryIndustries: ['technology', 'manufacturing'],
    entryPath: 'research_assistantship',
    entryPathLabel: 'Research Assistantship',
    typicalFirstRole: 'Research Scientist',
    careerPaths: [
      {
        name: 'Research Physics',
        description: 'Applied physics research in industry',
        roles: [
          'Research Scientist',
          'Senior Research Scientist',
          'Principal Scientist',
          'Research Director',
        ],
      },
      {
        name: 'Academia',
        description: 'Academic physics research',
        roles: [
          'PhD Student',
          'PostDoc',
          'Assistant Professor',
          'Associate Professor',
          'Professor',
        ],
      },
      {
        name: 'Data Science',
        description: 'Quantitative analysis and data science',
        roles: [
          'Data Scientist',
          'Senior Data Scientist',
          'Staff Data Scientist',
          'Director Data Science',
        ],
      },
      {
        name: 'Quantitative Finance',
        description: 'Quantitative analysis in finance',
        roles: ['Quant Analyst', 'Senior Quant', 'VP Quantitative Research', 'Head of Quant'],
      },
    ],
  },

  neuroscience: {
    name: 'Neuroscience',
    aliases: ['neuro', 'cognitive neuroscience', 'brain science'],
    primaryIndustry: 'science_research',
    secondaryIndustries: ['healthcare', 'technology'],
    entryPath: 'research_assistantship',
    entryPathLabel: 'Research Assistantship',
    typicalFirstRole: 'Research Associate',
    careerPaths: [
      {
        name: 'Neuro Research',
        description: 'Neuroscience research at pharma/biotech',
        roles: [
          'Research Associate',
          'Scientist',
          'Senior Scientist',
          'Principal Scientist',
          'Director',
        ],
      },
      {
        name: 'Academia',
        description: 'Academic neuroscience research',
        roles: [
          'PhD Student',
          'PostDoc',
          'Assistant Professor',
          'Associate Professor',
          'Professor',
        ],
      },
      {
        name: 'Neurotech',
        description: 'Brain-computer interfaces and neurotech',
        roles: [
          'Research Engineer',
          'Senior Research Engineer',
          'Staff Engineer',
          'Engineering Manager',
        ],
      },
    ],
  },

  // ============================================
  // STEM - Engineering
  // ============================================

  'mechanical engineering': {
    name: 'Mechanical Engineering',
    aliases: ['mech eng', 'mech e', 'me'],
    primaryIndustry: 'manufacturing',
    secondaryIndustries: ['technology', 'consulting'],
    entryPath: 'internship',
    entryPathLabel: 'Engineering Internship',
    typicalFirstRole: 'Mechanical Engineer',
    commonCertifications: ['PE', 'Six Sigma', 'PMP'],
    careerPaths: [
      {
        name: 'Design Engineering',
        description: 'Product design and development',
        roles: [
          'Mechanical Engineer',
          'Senior Mechanical Engineer',
          'Lead Engineer',
          'Principal Engineer',
          'Engineering Manager',
          'Director of Engineering',
        ],
      },
      {
        name: 'Manufacturing',
        description: 'Manufacturing engineering and operations',
        roles: [
          'Manufacturing Engineer',
          'Senior Manufacturing Engineer',
          'Manufacturing Manager',
          'Plant Manager',
          'VP Operations',
        ],
      },
      {
        name: 'Product Management',
        description: 'Technical product management',
        roles: [
          'Associate Product Manager',
          'Product Manager',
          'Senior Product Manager',
          'Director of Product',
          'VP Product',
        ],
      },
    ],
  },

  'electrical engineering': {
    name: 'Electrical Engineering',
    aliases: ['ee', 'elec eng', 'electrical eng'],
    primaryIndustry: 'technology',
    secondaryIndustries: ['manufacturing'],
    entryPath: 'internship',
    entryPathLabel: 'Engineering Internship',
    typicalFirstRole: 'Electrical Engineer',
    commonCertifications: ['PE'],
    careerPaths: [
      {
        name: 'Hardware Engineering',
        description: 'Hardware design and development',
        roles: [
          'Electrical Engineer',
          'Senior Electrical Engineer',
          'Staff Engineer',
          'Principal Engineer',
          'Engineering Manager',
        ],
      },
      {
        name: 'Embedded Systems',
        description: 'Embedded software and firmware',
        roles: [
          'Embedded Engineer',
          'Senior Embedded Engineer',
          'Staff Embedded Engineer',
          'Engineering Manager',
        ],
      },
    ],
  },

  'chemical engineering': {
    name: 'Chemical Engineering',
    aliases: ['chem eng', 'che'],
    primaryIndustry: 'manufacturing',
    secondaryIndustries: ['science_research'],
    entryPath: 'internship',
    entryPathLabel: 'Engineering Internship',
    typicalFirstRole: 'Process Engineer',
    commonCertifications: ['PE', 'Six Sigma'],
    careerPaths: [
      {
        name: 'Process Engineering',
        description: 'Chemical process development',
        roles: [
          'Process Engineer',
          'Senior Process Engineer',
          'Principal Engineer',
          'Engineering Manager',
          'Director Process Engineering',
        ],
      },
      {
        name: 'Pharma/Biotech',
        description: 'Pharmaceutical manufacturing',
        roles: [
          'Process Development Engineer',
          'Senior Process Engineer',
          'Associate Director',
          'Director CMC',
        ],
      },
    ],
  },

  'biomedical engineering': {
    name: 'Biomedical Engineering',
    aliases: ['bme', 'biomed eng', 'bioengineering'],
    primaryIndustry: 'healthcare',
    secondaryIndustries: ['technology', 'science_research'],
    entryPath: 'internship',
    entryPathLabel: 'Engineering Internship',
    typicalFirstRole: 'Biomedical Engineer',
    careerPaths: [
      {
        name: 'Medical Devices',
        description: 'Medical device development',
        roles: [
          'Biomedical Engineer',
          'Senior Biomedical Engineer',
          'Principal Engineer',
          'Engineering Manager',
          'Director R&D',
        ],
      },
      {
        name: 'Clinical Engineering',
        description: 'Hospital clinical engineering',
        roles: [
          'Clinical Engineer',
          'Senior Clinical Engineer',
          'Clinical Engineering Manager',
          'Director Clinical Engineering',
        ],
      },
    ],
  },

  'civil engineering': {
    name: 'Civil Engineering',
    aliases: ['civil eng', 'ce'],
    primaryIndustry: 'manufacturing',
    secondaryIndustries: ['government', 'consulting'],
    entryPath: 'internship',
    entryPathLabel: 'Engineering Internship',
    typicalFirstRole: 'Civil Engineer',
    requiredCredential: 'PE License (for stamping drawings)',
    commonCertifications: ['PE', 'PMP'],
    careerPaths: [
      {
        name: 'Structural Engineering',
        description: 'Structural design and analysis',
        roles: [
          'Civil Engineer',
          'Senior Engineer',
          'Project Engineer',
          'Principal Engineer',
          'Department Head',
        ],
      },
      {
        name: 'Project Management',
        description: 'Construction project management',
        roles: [
          'Assistant Project Manager',
          'Project Manager',
          'Senior Project Manager',
          'Project Director',
        ],
      },
    ],
  },

  // ============================================
  // STEM - Computer Science & IT
  // ============================================

  'computer science': {
    name: 'Computer Science',
    aliases: ['cs', 'comp sci', 'computer sci'],
    primaryIndustry: 'technology',
    entryPath: 'internship',
    entryPathLabel: 'Software Engineering Internship',
    typicalFirstRole: 'Software Engineer',
    careerPaths: [
      {
        name: 'Software Engineering',
        description: 'Software development IC track',
        roles: [
          'Software Engineer',
          'Senior Software Engineer',
          'Staff Engineer',
          'Principal Engineer',
          'Distinguished Engineer',
        ],
      },
      {
        name: 'Engineering Management',
        description: 'Engineering leadership',
        roles: [
          'Software Engineer',
          'Senior Software Engineer',
          'Engineering Manager',
          'Senior Engineering Manager',
          'Director of Engineering',
          'VP Engineering',
          'CTO',
        ],
      },
      {
        name: 'Data Science',
        description: 'Data science and machine learning',
        roles: [
          'Data Scientist',
          'Senior Data Scientist',
          'Staff Data Scientist',
          'Principal Data Scientist',
          'Director Data Science',
        ],
      },
      {
        name: 'Product Management',
        description: 'Technical product management',
        roles: [
          'Associate Product Manager',
          'Product Manager',
          'Senior Product Manager',
          'Group Product Manager',
          'Director of Product',
          'VP Product',
        ],
      },
    ],
  },

  'data science': {
    name: 'Data Science',
    aliases: ['ds', 'data analytics'],
    primaryIndustry: 'technology',
    secondaryIndustries: ['finance', 'consulting'],
    entryPath: 'internship',
    entryPathLabel: 'Data Science Internship',
    typicalFirstRole: 'Data Scientist',
    careerPaths: [
      {
        name: 'Data Science',
        description: 'Data science IC track',
        roles: [
          'Data Scientist',
          'Senior Data Scientist',
          'Staff Data Scientist',
          'Principal Data Scientist',
          'Director Data Science',
        ],
      },
      {
        name: 'Machine Learning',
        description: 'ML engineering and research',
        roles: [
          'ML Engineer',
          'Senior ML Engineer',
          'Staff ML Engineer',
          'Principal ML Engineer',
          'ML Research Scientist',
        ],
      },
    ],
  },

  'information technology': {
    name: 'Information Technology',
    aliases: ['it', 'information systems', 'mis'],
    primaryIndustry: 'technology',
    entryPath: 'internship',
    entryPathLabel: 'IT Internship',
    typicalFirstRole: 'IT Analyst',
    careerPaths: [
      {
        name: 'IT Management',
        description: 'IT operations and management',
        roles: [
          'IT Analyst',
          'Systems Administrator',
          'Senior Systems Admin',
          'IT Manager',
          'IT Director',
          'CIO',
        ],
      },
      {
        name: 'Security',
        description: 'Information security',
        roles: [
          'Security Analyst',
          'Senior Security Engineer',
          'Security Architect',
          'Security Manager',
          'CISO',
        ],
      },
    ],
  },

  // ============================================
  // Healthcare
  // ============================================

  nursing: {
    name: 'Nursing',
    aliases: ['bsn', 'rn'],
    primaryIndustry: 'healthcare',
    entryPath: 'clinical_rotation',
    entryPathLabel: 'Clinical Rotation',
    typicalFirstRole: 'Staff Nurse',
    requiredCredential: 'RN License',
    commonCertifications: ['BLS', 'ACLS', 'CCRN'],
    careerPaths: [
      {
        name: 'Clinical Nursing',
        description: 'Bedside nursing career',
        roles: ['Staff Nurse', 'Senior Nurse', 'Charge Nurse', 'Clinical Nurse Specialist'],
      },
      {
        name: 'Advanced Practice',
        description: 'Nurse practitioner path',
        roles: ['Staff Nurse', 'NP Student', 'Nurse Practitioner', 'Senior NP', 'NP Lead'],
      },
      {
        name: 'Nursing Leadership',
        description: 'Nursing administration',
        roles: [
          'Staff Nurse',
          'Charge Nurse',
          'Nurse Manager',
          'Director of Nursing',
          'VP Nursing',
          'Chief Nursing Officer',
        ],
      },
    ],
  },

  'pre-med': {
    name: 'Pre-Medicine',
    aliases: ['pre-medicine', 'premed'],
    primaryIndustry: 'healthcare',
    entryPath: 'residency',
    entryPathLabel: 'Medical Residency',
    typicalFirstRole: 'Resident Physician',
    requiredCredential: 'MD/DO',
    careerPaths: [
      {
        name: 'Clinical Practice',
        description: 'Practicing physician',
        roles: [
          'Medical Student',
          'Resident',
          'Fellow',
          'Attending Physician',
          'Senior Physician',
          'Department Chief',
        ],
      },
      {
        name: 'Academic Medicine',
        description: 'Academic physician-scientist',
        roles: [
          'Resident',
          'Fellow',
          'Assistant Professor',
          'Associate Professor',
          'Professor',
          'Department Chair',
        ],
      },
    ],
  },

  'public health': {
    name: 'Public Health',
    aliases: ['mph', 'epidemiology'],
    primaryIndustry: 'healthcare',
    secondaryIndustries: ['government', 'nonprofit'],
    entryPath: 'internship',
    entryPathLabel: 'Public Health Internship',
    typicalFirstRole: 'Public Health Analyst',
    careerPaths: [
      {
        name: 'Epidemiology',
        description: 'Disease surveillance and research',
        roles: [
          'Epidemiologist',
          'Senior Epidemiologist',
          'Lead Epidemiologist',
          'Director Epidemiology',
        ],
      },
      {
        name: 'Health Policy',
        description: 'Health policy and administration',
        roles: [
          'Health Policy Analyst',
          'Senior Policy Analyst',
          'Policy Director',
          'Chief Policy Officer',
        ],
      },
    ],
  },

  pharmacy: {
    name: 'Pharmacy',
    aliases: ['pharmd', 'pharmaceutical sciences'],
    primaryIndustry: 'healthcare',
    entryPath: 'residency',
    entryPathLabel: 'Pharmacy Residency',
    typicalFirstRole: 'Staff Pharmacist',
    requiredCredential: 'PharmD + State License',
    careerPaths: [
      {
        name: 'Clinical Pharmacy',
        description: 'Hospital clinical pharmacy',
        roles: [
          'Pharmacy Resident',
          'Clinical Pharmacist',
          'Clinical Pharmacy Specialist',
          'Pharmacy Manager',
          'Director of Pharmacy',
        ],
      },
      {
        name: 'Industry',
        description: 'Pharmaceutical industry',
        roles: [
          'Medical Science Liaison',
          'Senior MSL',
          'Regional MSL Director',
          'Medical Affairs Director',
        ],
      },
    ],
  },

  // ============================================
  // Business
  // ============================================

  'business administration': {
    name: 'Business Administration',
    aliases: ['bba', 'business', 'management'],
    primaryIndustry: 'consulting',
    secondaryIndustries: ['finance', 'technology', 'retail'],
    entryPath: 'internship',
    entryPathLabel: 'Business Internship',
    typicalFirstRole: 'Business Analyst',
    careerPaths: [
      {
        name: 'Management Consulting',
        description: 'Strategy and management consulting',
        roles: [
          'Analyst',
          'Consultant',
          'Senior Consultant',
          'Manager',
          'Senior Manager',
          'Principal',
          'Partner',
        ],
      },
      {
        name: 'Corporate Management',
        description: 'Corporate leadership track',
        roles: [
          'Business Analyst',
          'Senior Analyst',
          'Manager',
          'Senior Manager',
          'Director',
          'VP',
          'C-Suite',
        ],
      },
      {
        name: 'Operations',
        description: 'Operations management',
        roles: [
          'Operations Analyst',
          'Operations Manager',
          'Senior Operations Manager',
          'Director of Operations',
          'VP Operations',
          'COO',
        ],
      },
    ],
  },

  finance: {
    name: 'Finance',
    aliases: ['financial', 'business finance'],
    primaryIndustry: 'finance',
    entryPath: 'internship',
    entryPathLabel: 'Finance Internship',
    typicalFirstRole: 'Financial Analyst',
    commonCertifications: ['CFA', 'CPA', 'FRM'],
    careerPaths: [
      {
        name: 'Investment Banking',
        description: 'Investment banking career',
        roles: ['Analyst', 'Associate', 'Vice President', 'Director', 'Managing Director'],
      },
      {
        name: 'Corporate Finance',
        description: 'Corporate finance and FP&A',
        roles: [
          'Financial Analyst',
          'Senior Financial Analyst',
          'Finance Manager',
          'Director of Finance',
          'VP Finance',
          'CFO',
        ],
      },
      {
        name: 'Asset Management',
        description: 'Investment management',
        roles: [
          'Research Analyst',
          'Portfolio Analyst',
          'Portfolio Manager',
          'Senior Portfolio Manager',
          'CIO',
        ],
      },
    ],
  },

  accounting: {
    name: 'Accounting',
    aliases: ['acct', 'accountancy'],
    primaryIndustry: 'finance',
    entryPath: 'internship',
    entryPathLabel: 'Accounting Internship',
    typicalFirstRole: 'Staff Accountant',
    requiredCredential: 'CPA (for signing audits)',
    careerPaths: [
      {
        name: 'Public Accounting',
        description: 'Audit and tax at Big 4/firms',
        roles: ['Staff Accountant', 'Senior Accountant', 'Manager', 'Senior Manager', 'Partner'],
      },
      {
        name: 'Corporate Accounting',
        description: 'Industry accounting',
        roles: [
          'Staff Accountant',
          'Senior Accountant',
          'Accounting Manager',
          'Controller',
          'VP Finance',
          'CFO',
        ],
      },
    ],
  },

  marketing: {
    name: 'Marketing',
    aliases: ['mktg', 'digital marketing'],
    primaryIndustry: 'creative',
    secondaryIndustries: ['technology', 'consulting'],
    entryPath: 'internship',
    entryPathLabel: 'Marketing Internship',
    typicalFirstRole: 'Marketing Coordinator',
    careerPaths: [
      {
        name: 'Brand Marketing',
        description: 'Brand management',
        roles: [
          'Marketing Coordinator',
          'Brand Manager',
          'Senior Brand Manager',
          'Director of Brand',
          'VP Marketing',
          'CMO',
        ],
      },
      {
        name: 'Digital Marketing',
        description: 'Digital and growth marketing',
        roles: [
          'Digital Marketing Specialist',
          'Digital Marketing Manager',
          'Senior Manager',
          'Director Digital',
          'VP Growth',
        ],
      },
      {
        name: 'Product Marketing',
        description: 'Tech product marketing',
        roles: [
          'Product Marketing Manager',
          'Senior PMM',
          'Director Product Marketing',
          'VP Product Marketing',
        ],
      },
    ],
  },

  economics: {
    name: 'Economics',
    aliases: ['econ', 'economic'],
    primaryIndustry: 'finance',
    secondaryIndustries: ['consulting', 'government'],
    entryPath: 'internship',
    entryPathLabel: 'Economics Internship',
    typicalFirstRole: 'Economic Analyst',
    careerPaths: [
      {
        name: 'Financial Services',
        description: 'Economics in finance',
        roles: ['Economic Analyst', 'Senior Economist', 'Chief Economist'],
      },
      {
        name: 'Consulting',
        description: 'Economic consulting',
        roles: ['Analyst', 'Consultant', 'Senior Consultant', 'Manager', 'Principal', 'Partner'],
      },
      {
        name: 'Policy',
        description: 'Economic policy',
        roles: ['Policy Analyst', 'Senior Policy Analyst', 'Policy Director', 'Chief Economist'],
      },
    ],
  },

  // ============================================
  // Social Sciences & Humanities
  // ============================================

  psychology: {
    name: 'Psychology',
    aliases: ['psych', 'behavioral science'],
    primaryIndustry: 'healthcare',
    secondaryIndustries: ['technology', 'nonprofit'],
    entryPath: 'internship',
    entryPathLabel: 'Research or Clinical Internship',
    typicalFirstRole: 'Research Assistant',
    careerPaths: [
      {
        name: 'Clinical Psychology',
        description: 'Clinical practice (requires PhD/PsyD)',
        roles: [
          'Graduate Student',
          'Intern',
          'Postdoc',
          'Licensed Psychologist',
          'Clinical Director',
        ],
      },
      {
        name: 'UX Research',
        description: 'User experience research in tech',
        roles: [
          'UX Research Assistant',
          'UX Researcher',
          'Senior UX Researcher',
          'Staff UX Researcher',
          'Head of UX Research',
        ],
      },
      {
        name: 'HR/People',
        description: 'Human resources and people ops',
        roles: [
          'HR Coordinator',
          'HR Generalist',
          'HR Manager',
          'HR Director',
          'VP People',
          'CHRO',
        ],
      },
    ],
  },

  'political science': {
    name: 'Political Science',
    aliases: ['poli sci', 'politics', 'government'],
    primaryIndustry: 'government',
    secondaryIndustries: ['nonprofit', 'consulting'],
    entryPath: 'internship',
    entryPathLabel: 'Government or Policy Internship',
    typicalFirstRole: 'Policy Analyst',
    careerPaths: [
      {
        name: 'Government',
        description: 'Federal/state government',
        roles: ['Policy Analyst', 'Senior Policy Analyst', 'Policy Director', 'Chief of Staff'],
      },
      {
        name: 'Think Tank',
        description: 'Policy research',
        roles: ['Research Associate', 'Research Fellow', 'Senior Fellow', 'Director'],
      },
      {
        name: 'Law',
        description: 'Law school path',
        roles: ['Law Student', 'Summer Associate', 'Associate', 'Partner'],
      },
    ],
  },

  communications: {
    name: 'Communications',
    aliases: ['comm', 'mass comm', 'journalism'],
    primaryIndustry: 'media',
    secondaryIndustries: ['creative', 'nonprofit'],
    entryPath: 'internship',
    entryPathLabel: 'Media Internship',
    typicalFirstRole: 'Communications Coordinator',
    careerPaths: [
      {
        name: 'PR/Communications',
        description: 'Public relations',
        roles: [
          'PR Coordinator',
          'PR Specialist',
          'PR Manager',
          'Director of PR',
          'VP Communications',
        ],
      },
      {
        name: 'Journalism',
        description: 'News and media',
        roles: ['Reporter', 'Senior Reporter', 'Editor', 'Managing Editor', 'Editor-in-Chief'],
      },
      {
        name: 'Content Marketing',
        description: 'Content strategy',
        roles: ['Content Coordinator', 'Content Manager', 'Content Director', 'VP Content'],
      },
    ],
  },

  english: {
    name: 'English',
    aliases: ['english lit', 'literature', 'creative writing'],
    primaryIndustry: 'media',
    secondaryIndustries: ['creative', 'education'],
    entryPath: 'internship',
    entryPathLabel: 'Editorial or Writing Internship',
    typicalFirstRole: 'Content Writer',
    careerPaths: [
      {
        name: 'Publishing/Editorial',
        description: 'Publishing industry',
        roles: [
          'Editorial Assistant',
          'Associate Editor',
          'Editor',
          'Senior Editor',
          'Executive Editor',
        ],
      },
      {
        name: 'Content/Copywriting',
        description: 'Marketing content',
        roles: ['Copywriter', 'Senior Copywriter', 'Copy Director', 'Creative Director'],
      },
      {
        name: 'Teaching',
        description: 'Education path',
        roles: ['Student Teacher', 'Teacher', 'Senior Teacher', 'Department Head', 'Principal'],
      },
    ],
  },

  // ============================================
  // Legal
  // ============================================

  'pre-law': {
    name: 'Pre-Law',
    aliases: ['legal studies', 'paralegal'],
    primaryIndustry: 'legal',
    entryPath: 'associate_program',
    entryPathLabel: 'Summer Associate Program',
    typicalFirstRole: 'Associate Attorney',
    requiredCredential: 'JD + Bar Admission',
    careerPaths: [
      {
        name: 'Law Firm',
        description: 'Private practice',
        roles: ['Summer Associate', 'Associate', 'Senior Associate', 'Counsel', 'Partner'],
      },
      {
        name: 'Corporate Counsel',
        description: 'In-house legal',
        roles: [
          'Associate Counsel',
          'Counsel',
          'Senior Counsel',
          'Associate GC',
          'General Counsel',
        ],
      },
      {
        name: 'Public Interest',
        description: 'Public interest law',
        roles: ['Staff Attorney', 'Senior Attorney', 'Supervising Attorney', 'Legal Director'],
      },
    ],
  },

  // ============================================
  // Arts & Design
  // ============================================

  'graphic design': {
    name: 'Graphic Design',
    aliases: ['design', 'visual design', 'communication design'],
    primaryIndustry: 'creative',
    secondaryIndustries: ['technology'],
    entryPath: 'internship',
    entryPathLabel: 'Design Internship',
    typicalFirstRole: 'Junior Designer',
    careerPaths: [
      {
        name: 'Design',
        description: 'Visual design career',
        roles: [
          'Junior Designer',
          'Designer',
          'Senior Designer',
          'Lead Designer',
          'Art Director',
          'Creative Director',
        ],
      },
      {
        name: 'UX/UI Design',
        description: 'Digital product design',
        roles: [
          'UI Designer',
          'Product Designer',
          'Senior Product Designer',
          'Staff Designer',
          'Head of Design',
        ],
      },
    ],
  },

  'fine arts': {
    name: 'Fine Arts',
    aliases: ['art', 'bfa', 'studio art'],
    primaryIndustry: 'creative',
    entryPath: 'entry_level',
    entryPathLabel: 'Gallery or Studio Position',
    typicalFirstRole: 'Artist/Gallery Assistant',
    careerPaths: [
      {
        name: 'Gallery/Museum',
        description: 'Art institutions',
        roles: ['Gallery Assistant', 'Curator', 'Senior Curator', 'Director'],
      },
      {
        name: 'Commercial Art',
        description: 'Commercial applications',
        roles: ['Production Artist', 'Senior Artist', 'Art Director', 'Creative Director'],
      },
    ],
  },

  architecture: {
    name: 'Architecture',
    aliases: ['arch', 'architectural studies'],
    primaryIndustry: 'creative',
    secondaryIndustries: ['manufacturing'],
    entryPath: 'internship',
    entryPathLabel: 'Architecture Internship',
    typicalFirstRole: 'Architectural Designer',
    requiredCredential: 'Architecture License (to stamp drawings)',
    careerPaths: [
      {
        name: 'Architecture',
        description: 'Traditional architecture',
        roles: [
          'Intern Architect',
          'Architect',
          'Senior Architect',
          'Project Architect',
          'Principal',
          'Partner',
        ],
      },
      {
        name: 'Real Estate Development',
        description: 'Development side',
        roles: [
          'Development Associate',
          'Project Manager',
          'Development Director',
          'VP Development',
        ],
      },
    ],
  },

  // ============================================
  // Trades
  // ============================================

  'electrical technology': {
    name: 'Electrical Technology',
    aliases: ['electrician training', 'electrical trade'],
    primaryIndustry: 'trades',
    entryPath: 'apprenticeship',
    entryPathLabel: 'Electrical Apprenticeship',
    typicalFirstRole: 'Electrical Apprentice',
    requiredCredential: 'Journeyman/Master Electrician License',
    careerPaths: [
      {
        name: 'Electrician',
        description: 'Electrical trade career',
        roles: [
          'Apprentice (Year 1-2)',
          'Apprentice (Year 3-4)',
          'Journeyman Electrician',
          'Master Electrician',
          'Foreman',
          'Superintendent',
          'Business Owner',
        ],
      },
    ],
  },

  'hvac technology': {
    name: 'HVAC Technology',
    aliases: ['hvac', 'heating and cooling'],
    primaryIndustry: 'trades',
    entryPath: 'apprenticeship',
    entryPathLabel: 'HVAC Apprenticeship',
    typicalFirstRole: 'HVAC Apprentice',
    requiredCredential: 'EPA Certification',
    careerPaths: [
      {
        name: 'HVAC Technician',
        description: 'HVAC trade career',
        roles: [
          'Apprentice',
          'HVAC Technician',
          'Senior Technician',
          'Lead Technician',
          'Service Manager',
          'Operations Manager',
        ],
      },
    ],
  },

  // ============================================
  // Education
  // ============================================

  education: {
    name: 'Education',
    aliases: ['teaching', 'elementary education', 'secondary education'],
    primaryIndustry: 'education',
    entryPath: 'trainee_program',
    entryPathLabel: 'Student Teaching',
    typicalFirstRole: 'Teacher',
    requiredCredential: 'Teaching Certification',
    careerPaths: [
      {
        name: 'Classroom Teaching',
        description: 'K-12 teaching',
        roles: ['Student Teacher', 'Teacher', 'Senior Teacher', 'Department Head'],
      },
      {
        name: 'Administration',
        description: 'School administration',
        roles: [
          'Teacher',
          'Instructional Coach',
          'Assistant Principal',
          'Principal',
          'Superintendent',
        ],
      },
    ],
  },

  'special education': {
    name: 'Special Education',
    aliases: ['sped', 'special ed'],
    primaryIndustry: 'education',
    entryPath: 'trainee_program',
    entryPathLabel: 'Student Teaching',
    typicalFirstRole: 'Special Education Teacher',
    requiredCredential: 'Special Education Certification',
    careerPaths: [
      {
        name: 'Special Education',
        description: 'Special education teaching',
        roles: [
          'Student Teacher',
          'Special Education Teacher',
          'Lead Teacher',
          'SPED Coordinator',
          'Director of Special Services',
        ],
      },
    ],
  },
};

/**
 * Find major config by name or alias
 */
export function findMajorConfig(majorName: string): MajorConfig | null {
  const normalized = majorName.toLowerCase().trim();

  // Direct match
  if (MAJOR_INDUSTRY_MAPPING[normalized]) {
    return MAJOR_INDUSTRY_MAPPING[normalized];
  }

  // Search by aliases
  for (const [_key, config] of Object.entries(MAJOR_INDUSTRY_MAPPING)) {
    if (config.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return config;
    }
  }

  // Partial match
  for (const [key, config] of Object.entries(MAJOR_INDUSTRY_MAPPING)) {
    if (
      key.includes(normalized) ||
      normalized.includes(key) ||
      config.aliases.some((alias) => {
        const aliasLower = alias.toLowerCase();
        return aliasLower.includes(normalized) || normalized.includes(aliasLower);
      })
    ) {
      return config;
    }
  }

  return null;
}

/**
 * Get primary industry for a major
 */
export function getIndustryForMajor(majorName: string): Industry {
  const config = findMajorConfig(majorName);
  return config?.primaryIndustry || 'technology';
}

/**
 * Get entry path type for a major
 */
export function getEntryPathForMajor(majorName: string): {
  type: EntryPathType;
  label: string;
  hasTraditionalInternships: boolean;
} {
  const config = findMajorConfig(majorName);

  if (!config) {
    return {
      type: 'internship',
      label: 'Internship',
      hasTraditionalInternships: true,
    };
  }

  return {
    type: config.entryPath,
    label: config.entryPathLabel,
    hasTraditionalInternships: config.entryPath === 'internship',
  };
}

/**
 * Get career paths for a major
 */
export function getCareerPathsForMajor(majorName: string): CareerPath[] {
  const config = findMajorConfig(majorName);
  return config?.careerPaths || [];
}

/**
 * Get first roles for a major (entry positions across all paths)
 */
export function getFirstRolesForMajor(majorName: string): string[] {
  const config = findMajorConfig(majorName);

  if (!config) {
    return [];
  }

  const firstRoles: string[] = [config.typicalFirstRole];

  // Add first role from each career path
  for (const path of config.careerPaths) {
    if (path.roles.length > 0 && !firstRoles.includes(path.roles[0])) {
      firstRoles.push(path.roles[0]);
    }
  }

  return firstRoles;
}

/**
 * Check if major requires a credential
 */
export function majorRequiresCredential(majorName: string): boolean {
  const config = findMajorConfig(majorName);
  return !!config?.requiredCredential;
}

/**
 * Get required credential for major (if any)
 */
export function getRequiredCredentialForMajor(majorName: string): string | null {
  const config = findMajorConfig(majorName);
  return config?.requiredCredential || null;
}
