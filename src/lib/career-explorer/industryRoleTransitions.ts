/**
 * Industry-Specific Role Transitions for Career Explorer
 *
 * Provides realistic role transitions organized by industry.
 * Each role has entry-level, lateral, and promotion paths that
 * reflect real-world career progressions in each industry.
 */

import { Industry } from './industryTaxonomy';

// Role transition data structure
export interface RoleTransition {
  title: string;
  category: string;
  fit_score: number;
  reason: string;
  skills: string[];
  /**
   * The type of career transition:
   * - 'entry_level': First role in career path
   * - 'lateral': Same level, similar function
   * - 'promotion': Higher level role
   * - 'pivot': Same level, different function (stored in lateral array)
   * - 'specialization': Same level, narrower focus (stored in lateral array)
   */
  relationship: 'entry_level' | 'lateral' | 'promotion' | 'pivot' | 'specialization';
}

/**
 * Organizes role transitions by movement type.
 * Note: 'pivot' and 'specialization' relationships are stored in the lateral array
 * since they represent same-level moves with different functions.
 */
export interface RoleTransitionSet {
  entry_level: RoleTransition[];
  lateral: RoleTransition[];
  promotion: RoleTransition[];
}

// Type for the complete transitions database
export type IndustryRoleTransitions = Record<string, RoleTransitionSet>;

// ============================================
// HEALTHCARE INDUSTRY TRANSITIONS
// ============================================

export const HEALTHCARE_TRANSITIONS: IndustryRoleTransitions = {
  // Nursing paths
  'registered nurse': {
    entry_level: [
      {
        title: 'Certified Nursing Assistant',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Foundation for nursing career',
        skills: ['Patient Care', 'Vital Signs', 'Medical Terminology'],
        relationship: 'entry_level',
      },
      {
        title: 'Licensed Practical Nurse',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Stepping stone to RN',
        skills: ['Basic Nursing', 'Medication Admin', 'Patient Monitoring'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'ICU Nurse',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Critical care specialization',
        skills: ['Critical Care', 'Ventilators', 'Hemodynamic Monitoring'],
        relationship: 'lateral',
      },
      {
        title: 'OR Nurse',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Surgical specialization',
        skills: ['Surgical Procedures', 'Sterile Technique', 'Instrumentation'],
        relationship: 'lateral',
      },
      {
        title: 'Pediatric Nurse',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Pediatric specialization',
        skills: ['Pediatric Care', 'Family Education', 'Growth & Development'],
        relationship: 'lateral',
      },
      {
        title: 'Emergency Room Nurse',
        category: 'Healthcare',
        fit_score: 86,
        reason: 'Emergency care specialization',
        skills: ['Triage', 'Emergency Protocols', 'Rapid Assessment'],
        relationship: 'lateral',
      },
      {
        title: 'Case Manager',
        category: 'Healthcare',
        fit_score: 78,
        reason: 'Care coordination',
        skills: ['Care Coordination', 'Discharge Planning', 'Insurance Navigation'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Charge Nurse',
        category: 'Healthcare',
        fit_score: 92,
        reason: 'First leadership step',
        skills: ['Shift Leadership', 'Staff Coordination', 'Patient Assignments'],
        relationship: 'promotion',
      },
      {
        title: 'Clinical Nurse Specialist',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Advanced clinical role',
        skills: ['Advanced Practice', 'Evidence-Based Practice', 'Staff Education'],
        relationship: 'promotion',
      },
      {
        title: 'Nurse Manager',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Unit management',
        skills: ['Staff Management', 'Budgeting', 'Quality Improvement'],
        relationship: 'promotion',
      },
      {
        title: 'Nurse Practitioner',
        category: 'Healthcare',
        fit_score: 82,
        reason: 'Advanced practice (requires MSN/DNP)',
        skills: ['Diagnosis', 'Prescribing', 'Patient Management'],
        relationship: 'promotion',
      },
    ],
  },

  'nurse practitioner': {
    entry_level: [],
    lateral: [
      {
        title: 'Specialty NP',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Different specialty focus',
        skills: ['Specialty Knowledge', 'Advanced Assessment', 'Treatment Planning'],
        relationship: 'lateral',
      },
      {
        title: 'Clinical Nurse Specialist',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Education/research focus',
        skills: ['Staff Education', 'Research', 'Quality Improvement'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Lead Nurse Practitioner',
        category: 'Healthcare',
        fit_score: 90,
        reason: 'NP team leadership',
        skills: ['Clinical Leadership', 'Protocol Development', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Director of Advanced Practice',
        category: 'Healthcare',
        fit_score: 82,
        reason: 'APP department leadership',
        skills: ['Program Management', 'Hiring', 'Strategic Planning'],
        relationship: 'promotion',
      },
    ],
  },

  physician: {
    entry_level: [
      {
        title: 'Medical Resident',
        category: 'Healthcare',
        fit_score: 95,
        reason: 'Required training path',
        skills: ['Clinical Skills', 'Patient Care', 'Medical Knowledge'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Specialty Fellow',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Subspecialty training',
        skills: ['Specialized Procedures', 'Advanced Diagnosis', 'Research'],
        relationship: 'lateral',
      },
      {
        title: 'Hospitalist',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Hospital-based practice',
        skills: ['Inpatient Care', 'Care Coordination', 'Acute Medicine'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Attending Physician',
        category: 'Healthcare',
        fit_score: 95,
        reason: 'Independent practice',
        skills: ['Independent Practice', 'Teaching', 'Clinical Decision-Making'],
        relationship: 'promotion',
      },
      {
        title: 'Chief Resident',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Residency leadership',
        skills: ['Leadership', 'Teaching', 'Administration'],
        relationship: 'promotion',
      },
      {
        title: 'Department Chief',
        category: 'Healthcare',
        fit_score: 78,
        reason: 'Department leadership',
        skills: ['Medical Leadership', 'Administration', 'Quality Improvement'],
        relationship: 'promotion',
      },
      {
        title: 'Chief Medical Officer',
        category: 'Healthcare',
        fit_score: 72,
        reason: 'Executive medical leadership',
        skills: ['Healthcare Administration', 'Strategy', 'Executive Leadership'],
        relationship: 'promotion',
      },
    ],
  },

  pharmacist: {
    entry_level: [
      {
        title: 'Pharmacy Intern',
        category: 'Healthcare',
        fit_score: 90,
        reason: 'Training position',
        skills: ['Dispensing', 'Drug Interactions', 'Patient Counseling'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Clinical Pharmacist',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Clinical specialization',
        skills: ['Clinical Pharmacy', 'Drug Therapy Management', 'Rounds'],
        relationship: 'lateral',
      },
      {
        title: 'Specialty Pharmacist',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Specialty focus (oncology, ID, etc.)',
        skills: ['Specialty Drugs', 'Complex Therapies', 'Patient Education'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Pharmacy Supervisor',
        category: 'Healthcare',
        fit_score: 88,
        reason: 'Shift supervision',
        skills: ['Staff Supervision', 'Workflow Management', 'Quality Assurance'],
        relationship: 'promotion',
      },
      {
        title: 'Pharmacy Manager',
        category: 'Healthcare',
        fit_score: 85,
        reason: 'Pharmacy department management',
        skills: ['Department Management', 'Budgeting', 'Staff Development'],
        relationship: 'promotion',
      },
      {
        title: 'Director of Pharmacy',
        category: 'Healthcare',
        fit_score: 78,
        reason: 'Pharmacy services leadership',
        skills: ['Strategic Planning', 'Regulatory Compliance', 'Executive Communication'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// SCIENCE & RESEARCH INDUSTRY TRANSITIONS
// ============================================

export const SCIENCE_RESEARCH_TRANSITIONS: IndustryRoleTransitions = {
  'research scientist': {
    entry_level: [
      {
        title: 'Lab Assistant',
        category: 'Research',
        fit_score: 88,
        reason: 'Entry into lab work',
        skills: ['Lab Techniques', 'Data Recording', 'Equipment Operation'],
        relationship: 'entry_level',
      },
      {
        title: 'Research Associate',
        category: 'Research',
        fit_score: 92,
        reason: 'Direct entry for BS/MS',
        skills: ['Research Methods', 'Data Analysis', 'Documentation'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Applications Scientist',
        category: 'Research',
        fit_score: 85,
        reason: 'Customer-facing science',
        skills: ['Technical Support', 'Customer Training', 'Method Development'],
        relationship: 'lateral',
      },
      {
        title: 'Medical Science Liaison',
        category: 'Research',
        fit_score: 82,
        reason: 'Clinical/commercial bridge',
        skills: ['Scientific Communication', 'KOL Relationships', 'Medical Affairs'],
        relationship: 'pivot',
      },
      {
        title: 'Technical Writer',
        category: 'Research',
        fit_score: 75,
        reason: 'Scientific documentation',
        skills: ['Scientific Writing', 'Regulatory Documents', 'Technical Communication'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior Research Scientist',
        category: 'Research',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Project Leadership', 'Advanced Research', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Principal Scientist',
        category: 'Research',
        fit_score: 88,
        reason: 'Technical leadership',
        skills: ['Research Strategy', 'Cross-Functional Leadership', 'Innovation'],
        relationship: 'promotion',
      },
      {
        title: 'Research Manager',
        category: 'Research',
        fit_score: 82,
        reason: 'Team management',
        skills: ['Team Management', 'Budget Management', 'Resource Planning'],
        relationship: 'promotion',
      },
      {
        title: 'Research Director',
        category: 'Research',
        fit_score: 78,
        reason: 'Department leadership',
        skills: ['Strategic Vision', 'Portfolio Management', 'Executive Communication'],
        relationship: 'promotion',
      },
    ],
  },

  'postdoctoral researcher': {
    entry_level: [],
    lateral: [
      {
        title: 'Research Scientist (Industry)',
        category: 'Research',
        fit_score: 90,
        reason: 'Transition to industry',
        skills: ['Industry Research', 'Applied Science', 'Cross-Functional Work'],
        relationship: 'lateral',
      },
      {
        title: 'Medical Writer',
        category: 'Research',
        fit_score: 78,
        reason: 'Science communication',
        skills: ['Scientific Writing', 'Regulatory Documents', 'Publications'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Assistant Professor',
        category: 'Academia',
        fit_score: 92,
        reason: 'Academic faculty track',
        skills: ['Teaching', 'Grant Writing', 'Lab Management'],
        relationship: 'promotion',
      },
      {
        title: 'Senior Scientist (Industry)',
        category: 'Research',
        fit_score: 85,
        reason: 'Industry senior role',
        skills: ['Project Leadership', 'Strategy', 'Team Guidance'],
        relationship: 'promotion',
      },
    ],
  },

  'lab technician': {
    entry_level: [],
    lateral: [
      {
        title: 'Quality Control Technician',
        category: 'Research',
        fit_score: 85,
        reason: 'QC focus',
        skills: ['Testing Procedures', 'Documentation', 'Quality Standards'],
        relationship: 'lateral',
      },
      {
        title: 'Manufacturing Technician',
        category: 'Manufacturing',
        fit_score: 80,
        reason: 'Production focus',
        skills: ['GMP', 'Batch Records', 'Process Execution'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Lab Technician',
        category: 'Research',
        fit_score: 92,
        reason: 'Technical advancement',
        skills: ['Advanced Techniques', 'Method Development', 'Training'],
        relationship: 'promotion',
      },
      {
        title: 'Lab Supervisor',
        category: 'Research',
        fit_score: 85,
        reason: 'Lab operations management',
        skills: ['Team Supervision', 'Schedule Management', 'Quality Oversight'],
        relationship: 'promotion',
      },
      {
        title: 'Research Associate',
        category: 'Research',
        fit_score: 88,
        reason: 'With additional education',
        skills: ['Research Methods', 'Data Analysis', 'Project Contribution'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// ACADEMIA INDUSTRY TRANSITIONS
// ============================================

export const ACADEMIA_TRANSITIONS: IndustryRoleTransitions = {
  'assistant professor': {
    entry_level: [
      {
        title: 'Postdoctoral Researcher',
        category: 'Academia',
        fit_score: 95,
        reason: 'Required step for tenure-track',
        skills: ['Research', 'Publications', 'Grant Writing'],
        relationship: 'entry_level',
      },
      {
        title: 'Adjunct Professor',
        category: 'Academia',
        fit_score: 78,
        reason: 'Part-time teaching experience',
        skills: ['Teaching', 'Course Development', 'Subject Expertise'],
        relationship: 'entry_level',
      },
      {
        title: 'Lecturer',
        category: 'Academia',
        fit_score: 82,
        reason: 'Teaching-focused entry',
        skills: ['Teaching', 'Curriculum', 'Student Mentoring'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Research Faculty',
        category: 'Academia',
        fit_score: 85,
        reason: 'Research-focused position',
        skills: ['Research', 'Grant Management', 'Lab Leadership'],
        relationship: 'lateral',
      },
      {
        title: 'Teaching Professor',
        category: 'Academia',
        fit_score: 82,
        reason: 'Teaching-focused track',
        skills: ['Pedagogy', 'Curriculum Development', 'Student Success'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Associate Professor',
        category: 'Academia',
        fit_score: 95,
        reason: 'Tenure-track promotion',
        skills: ['Research Leadership', 'Grant Success', 'Mentoring'],
        relationship: 'promotion',
      },
    ],
  },

  'associate professor': {
    entry_level: [],
    lateral: [
      {
        title: 'Program Director',
        category: 'Academia',
        fit_score: 82,
        reason: 'Academic program leadership',
        skills: ['Program Management', 'Accreditation', 'Faculty Coordination'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Full Professor',
        category: 'Academia',
        fit_score: 95,
        reason: 'Senior faculty status',
        skills: ['National Recognition', 'Major Grants', 'Field Leadership'],
        relationship: 'promotion',
      },
      {
        title: 'Department Chair',
        category: 'Academia',
        fit_score: 85,
        reason: 'Academic administration',
        skills: ['Faculty Leadership', 'Budget Management', 'Strategic Planning'],
        relationship: 'promotion',
      },
    ],
  },

  professor: {
    entry_level: [],
    lateral: [
      {
        title: 'Endowed Chair',
        category: 'Academia',
        fit_score: 88,
        reason: 'Distinguished position',
        skills: ['Field Leadership', 'Major Research', 'Visibility'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Department Chair',
        category: 'Academia',
        fit_score: 88,
        reason: 'Department leadership',
        skills: ['Academic Administration', 'Faculty Development', 'Resource Management'],
        relationship: 'promotion',
      },
      {
        title: 'Associate Dean',
        category: 'Academia',
        fit_score: 82,
        reason: 'College-level administration',
        skills: ['College Administration', 'Policy Development', 'Faculty Relations'],
        relationship: 'promotion',
      },
      {
        title: 'Dean',
        category: 'Academia',
        fit_score: 75,
        reason: 'College/school leadership',
        skills: ['College Leadership', 'Fundraising', 'Strategic Vision'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// LEGAL INDUSTRY TRANSITIONS
// ============================================

export const LEGAL_TRANSITIONS: IndustryRoleTransitions = {
  associate: {
    entry_level: [
      {
        title: 'Summer Associate',
        category: 'Legal',
        fit_score: 95,
        reason: 'Law firm entry program',
        skills: ['Legal Research', 'Writing', 'Client Interaction'],
        relationship: 'entry_level',
      },
      {
        title: 'Paralegal',
        category: 'Legal',
        fit_score: 75,
        reason: 'Legal support experience',
        skills: ['Legal Research', 'Document Preparation', 'Case Management'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'In-House Counsel',
        category: 'Legal',
        fit_score: 85,
        reason: 'Corporate legal department',
        skills: ['Business Acumen', 'Contract Review', 'Risk Assessment'],
        relationship: 'lateral',
      },
      {
        title: 'Government Attorney',
        category: 'Legal',
        fit_score: 80,
        reason: 'Public sector practice',
        skills: ['Regulatory Knowledge', 'Public Interest', 'Litigation'],
        relationship: 'lateral',
      },
      {
        title: 'Different Practice Area',
        category: 'Legal',
        fit_score: 82,
        reason: 'Practice area change',
        skills: ['Adaptability', 'New Subject Matter', 'Transferable Skills'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Associate',
        category: 'Legal',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Complex Matters', 'Client Development', 'Junior Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Counsel',
        category: 'Legal',
        fit_score: 88,
        reason: 'Senior non-partner role',
        skills: ['Specialized Expertise', 'Client Relations', 'Practice Development'],
        relationship: 'promotion',
      },
    ],
  },

  'senior associate': {
    entry_level: [],
    lateral: [
      {
        title: 'Senior Counsel (In-House)',
        category: 'Legal',
        fit_score: 88,
        reason: 'Corporate transition',
        skills: ['Business Integration', 'Strategic Advice', 'Cross-Functional'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Counsel',
        category: 'Legal',
        fit_score: 90,
        reason: 'Senior role before partnership',
        skills: ['Practice Leadership', 'Client Development', 'Thought Leadership'],
        relationship: 'promotion',
      },
      {
        title: 'Junior Partner',
        category: 'Legal',
        fit_score: 88,
        reason: 'Partnership track',
        skills: ['Business Development', 'Client Management', 'Firm Leadership'],
        relationship: 'promotion',
      },
    ],
  },

  partner: {
    entry_level: [],
    lateral: [
      {
        title: 'General Counsel',
        category: 'Legal',
        fit_score: 85,
        reason: 'In-house leadership',
        skills: ['Legal Strategy', 'Business Partnership', 'Risk Management'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Partner',
        category: 'Legal',
        fit_score: 92,
        reason: 'Firm leadership',
        skills: ['Major Client Relationships', 'Firm Strategy', 'Mentorship'],
        relationship: 'promotion',
      },
      {
        title: 'Managing Partner',
        category: 'Legal',
        fit_score: 85,
        reason: 'Firm management',
        skills: ['Firm Operations', 'Strategy', 'Partner Relations'],
        relationship: 'promotion',
      },
      {
        title: 'Practice Group Leader',
        category: 'Legal',
        fit_score: 88,
        reason: 'Practice area leadership',
        skills: ['Practice Development', 'Attorney Development', 'Strategic Planning'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// TRADES INDUSTRY TRANSITIONS
// ============================================

export const TRADES_TRANSITIONS: IndustryRoleTransitions = {
  electrician: {
    entry_level: [
      {
        title: 'Electrical Apprentice',
        category: 'Trades',
        fit_score: 95,
        reason: 'Required entry path',
        skills: ['Basic Electrical', 'Safety', 'Tools'],
        relationship: 'entry_level',
      },
      {
        title: 'Electrical Helper',
        category: 'Trades',
        fit_score: 85,
        reason: 'Pre-apprentice experience',
        skills: ['Tool Handling', 'Material Prep', 'Site Support'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Industrial Electrician',
        category: 'Trades',
        fit_score: 88,
        reason: 'Industrial specialization',
        skills: ['PLCs', 'Motor Controls', 'Industrial Systems'],
        relationship: 'lateral',
      },
      {
        title: 'Residential Electrician',
        category: 'Trades',
        fit_score: 85,
        reason: 'Residential focus',
        skills: ['Home Wiring', 'Code Compliance', 'Customer Service'],
        relationship: 'lateral',
      },
      {
        title: 'Low Voltage Technician',
        category: 'Trades',
        fit_score: 80,
        reason: 'Low voltage systems',
        skills: ['Security Systems', 'Fire Alarm', 'Data Cabling'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Master Electrician',
        category: 'Trades',
        fit_score: 95,
        reason: 'Highest technical certification',
        skills: ['Complex Systems', 'Code Expertise', 'Permit Pulling'],
        relationship: 'promotion',
      },
      {
        title: 'Electrical Foreman',
        category: 'Trades',
        fit_score: 88,
        reason: 'Crew leadership',
        skills: ['Crew Management', 'Job Scheduling', 'Quality Control'],
        relationship: 'promotion',
      },
      {
        title: 'Electrical Superintendent',
        category: 'Trades',
        fit_score: 82,
        reason: 'Multi-project oversight',
        skills: ['Project Oversight', 'Resource Planning', 'Client Relations'],
        relationship: 'promotion',
      },
      {
        title: 'Electrical Contractor/Owner',
        category: 'Trades',
        fit_score: 78,
        reason: 'Business ownership',
        skills: ['Business Management', 'Estimating', 'Client Development'],
        relationship: 'promotion',
      },
    ],
  },

  plumber: {
    entry_level: [
      {
        title: 'Plumbing Apprentice',
        category: 'Trades',
        fit_score: 95,
        reason: 'Required entry path',
        skills: ['Basic Plumbing', 'Pipe Fitting', 'Tools'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'HVAC Technician',
        category: 'Trades',
        fit_score: 80,
        reason: 'Related mechanical trade',
        skills: ['HVAC Systems', 'Refrigeration', 'Troubleshooting'],
        relationship: 'lateral',
      },
      {
        title: 'Pipefitter',
        category: 'Trades',
        fit_score: 85,
        reason: 'Industrial piping',
        skills: ['Industrial Piping', 'Welding', 'Blueprint Reading'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Journeyman Plumber',
        category: 'Trades',
        fit_score: 95,
        reason: 'Licensed journeyman',
        skills: ['Independent Work', 'Code Compliance', 'Troubleshooting'],
        relationship: 'promotion',
      },
      {
        title: 'Master Plumber',
        category: 'Trades',
        fit_score: 90,
        reason: 'Highest certification',
        skills: ['System Design', 'Code Expertise', 'Permit Pulling'],
        relationship: 'promotion',
      },
      {
        title: 'Plumbing Foreman',
        category: 'Trades',
        fit_score: 85,
        reason: 'Crew leadership',
        skills: ['Crew Management', 'Job Planning', 'Quality Control'],
        relationship: 'promotion',
      },
    ],
  },

  'hvac technician': {
    entry_level: [
      {
        title: 'HVAC Apprentice',
        category: 'Trades',
        fit_score: 95,
        reason: 'Required entry path',
        skills: ['Basic HVAC', 'Refrigerant Handling', 'Tools'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Commercial HVAC Tech',
        category: 'Trades',
        fit_score: 88,
        reason: 'Commercial specialization',
        skills: ['Commercial Systems', 'Rooftop Units', 'Building Automation'],
        relationship: 'lateral',
      },
      {
        title: 'Refrigeration Tech',
        category: 'Trades',
        fit_score: 85,
        reason: 'Refrigeration focus',
        skills: ['Refrigeration Systems', 'Walk-In Coolers', 'Troubleshooting'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior HVAC Technician',
        category: 'Trades',
        fit_score: 92,
        reason: 'Technical advancement',
        skills: ['Complex Diagnostics', 'System Design', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'HVAC Service Manager',
        category: 'Trades',
        fit_score: 85,
        reason: 'Service department management',
        skills: ['Team Management', 'Customer Service', 'Scheduling'],
        relationship: 'promotion',
      },
      {
        title: 'HVAC Contractor/Owner',
        category: 'Trades',
        fit_score: 78,
        reason: 'Business ownership',
        skills: ['Business Management', 'Estimating', 'Client Development'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// FINANCE INDUSTRY TRANSITIONS
// ============================================

export const FINANCE_TRANSITIONS: IndustryRoleTransitions = {
  'financial analyst': {
    entry_level: [
      {
        title: 'Finance Intern',
        category: 'Finance',
        fit_score: 92,
        reason: 'Standard entry path',
        skills: ['Excel', 'Financial Analysis', 'Research'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Investment Banking Analyst',
        category: 'Finance',
        fit_score: 85,
        reason: 'IB transition',
        skills: ['Financial Modeling', 'Valuation', 'Client Presentations'],
        relationship: 'lateral',
      },
      {
        title: 'FP&A Analyst',
        category: 'Finance',
        fit_score: 88,
        reason: 'Corporate finance focus',
        skills: ['Budgeting', 'Forecasting', 'Variance Analysis'],
        relationship: 'lateral',
      },
      {
        title: 'Equity Research Analyst',
        category: 'Finance',
        fit_score: 82,
        reason: 'Research focus',
        skills: ['Equity Analysis', 'Report Writing', 'Industry Research'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Financial Analyst',
        category: 'Finance',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Complex Analysis', 'Presentation', 'Project Leadership'],
        relationship: 'promotion',
      },
      {
        title: 'Finance Manager',
        category: 'Finance',
        fit_score: 88,
        reason: 'Team leadership',
        skills: ['Team Management', 'Strategic Analysis', 'Executive Reporting'],
        relationship: 'promotion',
      },
    ],
  },

  'investment banking analyst': {
    entry_level: [
      {
        title: 'Summer Analyst',
        category: 'Finance',
        fit_score: 95,
        reason: 'IB entry program',
        skills: ['Financial Modeling', 'PowerPoint', 'Research'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Private Equity Associate',
        category: 'Finance',
        fit_score: 88,
        reason: 'PE exit opportunity',
        skills: ['Deal Evaluation', 'Due Diligence', 'Portfolio Management'],
        relationship: 'lateral',
      },
      {
        title: 'Hedge Fund Analyst',
        category: 'Finance',
        fit_score: 85,
        reason: 'Hedge fund exit',
        skills: ['Investment Analysis', 'Trading', 'Risk Assessment'],
        relationship: 'lateral',
      },
      {
        title: 'Corporate Development',
        category: 'Finance',
        fit_score: 82,
        reason: 'Corporate M&A',
        skills: ['M&A Analysis', 'Strategic Planning', 'Integration'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Investment Banking Associate',
        category: 'Finance',
        fit_score: 95,
        reason: 'Standard progression',
        skills: ['Deal Execution', 'Client Management', 'Team Leadership'],
        relationship: 'promotion',
      },
    ],
  },

  'investment banking associate': {
    entry_level: [],
    lateral: [
      {
        title: 'PE Vice President',
        category: 'Finance',
        fit_score: 85,
        reason: 'PE lateral move',
        skills: ['Deal Sourcing', 'Portfolio Value', 'LP Relations'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Vice President (IB)',
        category: 'Finance',
        fit_score: 95,
        reason: 'Standard progression',
        skills: ['Client Relationships', 'Deal Origination', 'Team Management'],
        relationship: 'promotion',
      },
      {
        title: 'Director (IB)',
        category: 'Finance',
        fit_score: 88,
        reason: 'Senior banker path',
        skills: ['Major Client Coverage', 'Revenue Generation', 'Strategy'],
        relationship: 'promotion',
      },
      {
        title: 'Managing Director',
        category: 'Finance',
        fit_score: 82,
        reason: 'Senior leadership',
        skills: ['Rainmaking', 'Firm Leadership', 'Industry Expertise'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// MANUFACTURING INDUSTRY TRANSITIONS
// ============================================

export const MANUFACTURING_TRANSITIONS: IndustryRoleTransitions = {
  'manufacturing engineer': {
    entry_level: [
      {
        title: 'Manufacturing Technician',
        category: 'Manufacturing',
        fit_score: 85,
        reason: 'Hands-on experience',
        skills: ['Equipment Operation', 'Troubleshooting', 'Safety'],
        relationship: 'entry_level',
      },
      {
        title: 'Engineering Intern',
        category: 'Manufacturing',
        fit_score: 92,
        reason: 'Engineering entry',
        skills: ['CAD', 'Process Analysis', 'Documentation'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Process Engineer',
        category: 'Manufacturing',
        fit_score: 90,
        reason: 'Process focus',
        skills: ['Process Optimization', 'SPC', 'Lean Manufacturing'],
        relationship: 'lateral',
      },
      {
        title: 'Quality Engineer',
        category: 'Manufacturing',
        fit_score: 85,
        reason: 'Quality focus',
        skills: ['Quality Systems', 'Root Cause Analysis', 'Auditing'],
        relationship: 'lateral',
      },
      {
        title: 'Industrial Engineer',
        category: 'Manufacturing',
        fit_score: 88,
        reason: 'Efficiency focus',
        skills: ['Time Studies', 'Layout Optimization', 'Cost Analysis'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Manufacturing Engineer',
        category: 'Manufacturing',
        fit_score: 95,
        reason: 'Technical advancement',
        skills: ['Complex Projects', 'Technical Leadership', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Manufacturing Engineering Manager',
        category: 'Manufacturing',
        fit_score: 85,
        reason: 'Team leadership',
        skills: ['Team Management', 'Project Portfolio', 'Resource Planning'],
        relationship: 'promotion',
      },
      {
        title: 'Plant Manager',
        category: 'Manufacturing',
        fit_score: 78,
        reason: 'Plant operations leadership',
        skills: ['Operations Leadership', 'P&L Management', 'Strategy'],
        relationship: 'promotion',
      },
    ],
  },

  'production supervisor': {
    entry_level: [
      {
        title: 'Production Operator',
        category: 'Manufacturing',
        fit_score: 88,
        reason: 'Floor experience',
        skills: ['Equipment Operation', 'Quality Checks', 'Safety'],
        relationship: 'entry_level',
      },
      {
        title: 'Team Lead',
        category: 'Manufacturing',
        fit_score: 92,
        reason: 'Initial leadership',
        skills: ['Team Coordination', 'Problem Solving', 'Training'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Quality Supervisor',
        category: 'Manufacturing',
        fit_score: 85,
        reason: 'Quality focus',
        skills: ['Quality Systems', 'Inspection', 'Documentation'],
        relationship: 'lateral',
      },
      {
        title: 'Warehouse Supervisor',
        category: 'Manufacturing',
        fit_score: 82,
        reason: 'Logistics focus',
        skills: ['Inventory Management', 'Shipping', 'Team Management'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Production Manager',
        category: 'Manufacturing',
        fit_score: 92,
        reason: 'Multi-shift/area responsibility',
        skills: ['Multi-Team Management', 'KPI Management', 'Continuous Improvement'],
        relationship: 'promotion',
      },
      {
        title: 'Operations Manager',
        category: 'Manufacturing',
        fit_score: 85,
        reason: 'Broader operations scope',
        skills: ['Cross-Functional Leadership', 'Budget Management', 'Strategy'],
        relationship: 'promotion',
      },
      {
        title: 'Plant Manager',
        category: 'Manufacturing',
        fit_score: 80,
        reason: 'Plant leadership',
        skills: ['P&L Responsibility', 'Strategic Planning', 'Executive Communication'],
        relationship: 'promotion',
      },
    ],
  },
};

// ============================================
// MAIN EXPORT - ALL INDUSTRY TRANSITIONS
// ============================================

export const INDUSTRY_ROLE_TRANSITIONS: Record<Industry, IndustryRoleTransitions> = {
  technology: {}, // Use existing ROLE_TRANSITIONS from next-roles/route.ts
  healthcare: HEALTHCARE_TRANSITIONS,
  science_research: SCIENCE_RESEARCH_TRANSITIONS,
  academia: ACADEMIA_TRANSITIONS,
  legal: LEGAL_TRANSITIONS,
  finance: FINANCE_TRANSITIONS,
  trades: TRADES_TRANSITIONS,
  manufacturing: MANUFACTURING_TRANSITIONS,
  consulting: {}, // Can extend later
  government: {}, // Can extend later
  nonprofit: {}, // Can extend later
  creative: {}, // Can extend later
  retail: {}, // Can extend later
  hospitality: {}, // Can extend later
  education: {}, // Can extend later
  media: {}, // Can extend later
  real_estate: {}, // Can extend later
};

/**
 * Get role transitions for a specific industry and role.
 * Uses exact matching first, then partial matching with specificity scoring.
 */
export function getIndustryRoleTransitions(
  industry: Industry,
  role: string,
): RoleTransitionSet | null {
  const industryTransitions = INDUSTRY_ROLE_TRANSITIONS[industry];

  if (!industryTransitions || Object.keys(industryTransitions).length === 0) {
    return null;
  }

  const roleLower = role.toLowerCase().trim();

  // Exact match (highest priority)
  if (industryTransitions[roleLower]) {
    return industryTransitions[roleLower];
  }

  // Partial match with specificity scoring
  // Prioritize matches where the search term is more specific (longer overlap)
  let bestMatch: { key: string; transitions: RoleTransitionSet; score: number } | null = null;

  for (const [roleKey, transitions] of Object.entries(industryTransitions)) {
    // Search term contains the role key (e.g., "senior nurse manager" contains "nurse manager")
    if (roleLower.includes(roleKey)) {
      const score = roleKey.length; // Longer key = more specific match
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key: roleKey, transitions, score };
      }
    }
    // Role key contains the search term - only if search term is specific enough
    // Require at least 6 chars to avoid "manager" matching "nurse manager"
    else if (roleLower.length >= 6 && roleKey.includes(roleLower)) {
      const score = roleLower.length * 0.8; // Slight penalty for reverse matching
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key: roleKey, transitions, score };
      }
    }
  }

  return bestMatch?.transitions ?? null;
}

/**
 * Get alternative entry path roles for industries without traditional internships
 */
export function getAlternativeEntryRoles(industry: Industry, major: string): RoleTransition[] {
  switch (industry) {
    case 'healthcare':
      return [
        {
          title: 'Clinical Rotation Student',
          category: 'Healthcare',
          fit_score: 90,
          reason: 'Required clinical experience',
          skills: ['Patient Care', 'Clinical Skills', 'Observation'],
          relationship: 'entry_level',
        },
        {
          title: 'Medical Scribe',
          category: 'Healthcare',
          fit_score: 85,
          reason: 'Clinical exposure',
          skills: ['Documentation', 'Medical Terminology', 'EMR'],
          relationship: 'entry_level',
        },
        {
          title: 'Patient Care Technician',
          category: 'Healthcare',
          fit_score: 82,
          reason: 'Hands-on patient care',
          skills: ['Patient Care', 'Vital Signs', 'Empathy'],
          relationship: 'entry_level',
        },
      ];

    case 'science_research':
      return [
        {
          title: 'Research Assistant',
          category: 'Research',
          fit_score: 92,
          reason: 'Lab research experience',
          skills: ['Lab Techniques', 'Data Collection', 'Analysis'],
          relationship: 'entry_level',
        },
        {
          title: 'Lab Technician',
          category: 'Research',
          fit_score: 88,
          reason: 'Technical lab work',
          skills: ['Equipment Operation', 'Protocols', 'Documentation'],
          relationship: 'entry_level',
        },
        {
          title: 'Graduate Research Assistant',
          category: 'Research',
          fit_score: 85,
          reason: 'Advanced research for grad students',
          skills: ['Research Methods', 'Literature Review', 'Experimentation'],
          relationship: 'entry_level',
        },
      ];

    case 'academia':
      return [
        {
          title: 'Teaching Assistant',
          category: 'Academia',
          fit_score: 90,
          reason: 'Teaching experience',
          skills: ['Teaching', 'Grading', 'Student Support'],
          relationship: 'entry_level',
        },
        {
          title: 'Graduate Research Assistant',
          category: 'Academia',
          fit_score: 88,
          reason: 'Research assistantship',
          skills: ['Research', 'Data Analysis', 'Writing'],
          relationship: 'entry_level',
        },
        {
          title: 'Graduate Fellow',
          category: 'Academia',
          fit_score: 85,
          reason: 'Fellowship position',
          skills: ['Independent Research', 'Writing', 'Presentation'],
          relationship: 'entry_level',
        },
      ];

    case 'trades':
      return [
        {
          title: `${major} Apprentice (Year 1)`,
          category: 'Trades',
          fit_score: 95,
          reason: 'Required apprenticeship',
          skills: ['Basic Skills', 'Safety', 'Tool Handling'],
          relationship: 'entry_level',
        },
        {
          title: 'Pre-Apprentice/Helper',
          category: 'Trades',
          fit_score: 88,
          reason: 'Pre-apprentice experience',
          skills: ['Site Support', 'Material Handling', 'Observation'],
          relationship: 'entry_level',
        },
      ];

    case 'education':
      return [
        {
          title: 'Student Teacher',
          category: 'Education',
          fit_score: 95,
          reason: 'Required student teaching',
          skills: ['Classroom Management', 'Lesson Planning', 'Assessment'],
          relationship: 'entry_level',
        },
        {
          title: 'Teaching Aide',
          category: 'Education',
          fit_score: 85,
          reason: 'Classroom experience',
          skills: ['Student Support', 'Classroom Assistance', 'Organization'],
          relationship: 'entry_level',
        },
      ];

    default:
      return [];
  }
}
