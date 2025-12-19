import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface RoleSearchResult {
  id: string;
  title: string;
  category: string;
  skills: string[];
}

// Comprehensive list of common career roles, majors, and internships
const ROLE_DATABASE: RoleSearchResult[] = [
  // ========== UNIVERSITY STUDENT OPTIONS ==========
  // Internships
  {
    id: 'intern-swe',
    title: 'Software Engineering Intern',
    category: 'Internship',
    skills: ['Programming', 'Problem Solving', 'Git', 'Teamwork'],
  },
  {
    id: 'intern-data',
    title: 'Data Science Intern',
    category: 'Internship',
    skills: ['Python', 'Statistics', 'SQL', 'Data Analysis'],
  },
  {
    id: 'intern-pm',
    title: 'Product Management Intern',
    category: 'Internship',
    skills: ['Communication', 'Analysis', 'User Research', 'Documentation'],
  },
  {
    id: 'intern-design',
    title: 'UX/UI Design Intern',
    category: 'Internship',
    skills: ['Figma', 'Design Thinking', 'Prototyping', 'User Research'],
  },
  {
    id: 'intern-marketing',
    title: 'Marketing Intern',
    category: 'Internship',
    skills: ['Social Media', 'Content Creation', 'Analytics', 'Communication'],
  },
  {
    id: 'intern-finance',
    title: 'Finance Intern',
    category: 'Internship',
    skills: ['Excel', 'Financial Analysis', 'Research', 'Attention to Detail'],
  },
  {
    id: 'intern-consulting',
    title: 'Consulting Intern',
    category: 'Internship',
    skills: ['Problem Solving', 'PowerPoint', 'Research', 'Communication'],
  },
  {
    id: 'intern-hr',
    title: 'HR Intern',
    category: 'Internship',
    skills: ['Communication', 'Organization', 'Recruiting', 'People Skills'],
  },
  {
    id: 'intern-research',
    title: 'Research Intern',
    category: 'Internship',
    skills: ['Research Methods', 'Data Analysis', 'Writing', 'Critical Thinking'],
  },
  {
    id: 'intern-business',
    title: 'Business Development Intern',
    category: 'Internship',
    skills: ['Communication', 'Research', 'Sales', 'Networking'],
  },

  // University Majors - STEM
  {
    id: 'major-cs',
    title: 'Computer Science Major',
    category: 'Major - STEM',
    skills: ['Programming', 'Algorithms', 'Data Structures', 'Problem Solving'],
  },
  {
    id: 'major-ee',
    title: 'Electrical Engineering Major',
    category: 'Major - STEM',
    skills: ['Circuit Design', 'Electronics', 'Programming', 'Mathematics'],
  },
  {
    id: 'major-me',
    title: 'Mechanical Engineering Major',
    category: 'Major - STEM',
    skills: ['CAD', 'Thermodynamics', 'Materials Science', 'Design'],
  },
  {
    id: 'major-ce',
    title: 'Civil Engineering Major',
    category: 'Major - STEM',
    skills: ['Structural Analysis', 'CAD', 'Project Management', 'Mathematics'],
  },
  {
    id: 'major-che',
    title: 'Chemical Engineering Major',
    category: 'Major - STEM',
    skills: ['Chemistry', 'Process Design', 'Mathematics', 'Lab Skills'],
  },
  {
    id: 'major-bio',
    title: 'Biology Major',
    category: 'Major - STEM',
    skills: ['Lab Skills', 'Research', 'Data Analysis', 'Scientific Writing'],
  },
  {
    id: 'major-chem',
    title: 'Chemistry Major',
    category: 'Major - STEM',
    skills: ['Lab Skills', 'Research', 'Analysis', 'Scientific Method'],
  },
  {
    id: 'major-physics',
    title: 'Physics Major',
    category: 'Major - STEM',
    skills: ['Mathematics', 'Problem Solving', 'Research', 'Data Analysis'],
  },
  {
    id: 'major-math',
    title: 'Mathematics Major',
    category: 'Major - STEM',
    skills: ['Quantitative Analysis', 'Logic', 'Problem Solving', 'Statistics'],
  },
  {
    id: 'major-stats',
    title: 'Statistics Major',
    category: 'Major - STEM',
    skills: ['Statistical Analysis', 'R', 'Python', 'Data Visualization'],
  },
  {
    id: 'major-ds',
    title: 'Data Science Major',
    category: 'Major - STEM',
    skills: ['Python', 'Machine Learning', 'Statistics', 'SQL'],
  },
  {
    id: 'major-info',
    title: 'Information Systems Major',
    category: 'Major - STEM',
    skills: ['Databases', 'Business Analysis', 'Programming', 'IT Management'],
  },
  {
    id: 'major-biomed',
    title: 'Biomedical Engineering Major',
    category: 'Major - STEM',
    skills: ['Biology', 'Engineering', 'Medical Devices', 'Research'],
  },
  {
    id: 'major-env',
    title: 'Environmental Science Major',
    category: 'Major - STEM',
    skills: ['Research', 'Data Analysis', 'Sustainability', 'Field Work'],
  },

  // University Majors - Business
  {
    id: 'major-business',
    title: 'Business Administration Major',
    category: 'Major - Business',
    skills: ['Management', 'Finance', 'Marketing', 'Strategy'],
  },
  {
    id: 'major-finance',
    title: 'Finance Major',
    category: 'Major - Business',
    skills: ['Financial Analysis', 'Excel', 'Valuation', 'Accounting'],
  },
  {
    id: 'major-accounting',
    title: 'Accounting Major',
    category: 'Major - Business',
    skills: ['Financial Reporting', 'Auditing', 'Tax', 'Excel'],
  },
  {
    id: 'major-marketing',
    title: 'Marketing Major',
    category: 'Major - Business',
    skills: ['Market Research', 'Branding', 'Digital Marketing', 'Communication'],
  },
  {
    id: 'major-econ',
    title: 'Economics Major',
    category: 'Major - Business',
    skills: ['Economic Analysis', 'Statistics', 'Research', 'Quantitative Methods'],
  },
  {
    id: 'major-mgmt',
    title: 'Management Major',
    category: 'Major - Business',
    skills: ['Leadership', 'Organization', 'Strategy', 'Communication'],
  },
  {
    id: 'major-intl-business',
    title: 'International Business Major',
    category: 'Major - Business',
    skills: ['Global Markets', 'Cross-cultural Communication', 'Trade', 'Languages'],
  },
  {
    id: 'major-entrepreneurship',
    title: 'Entrepreneurship Major',
    category: 'Major - Business',
    skills: ['Business Planning', 'Innovation', 'Finance', 'Leadership'],
  },
  {
    id: 'major-supply-chain',
    title: 'Supply Chain Management Major',
    category: 'Major - Business',
    skills: ['Logistics', 'Operations', 'Analytics', 'Procurement'],
  },

  // University Majors - Arts & Humanities
  {
    id: 'major-english',
    title: 'English Major',
    category: 'Major - Arts & Humanities',
    skills: ['Writing', 'Critical Analysis', 'Communication', 'Research'],
  },
  {
    id: 'major-comms',
    title: 'Communications Major',
    category: 'Major - Arts & Humanities',
    skills: ['Public Speaking', 'Writing', 'Media', 'Interpersonal Skills'],
  },
  {
    id: 'major-journalism',
    title: 'Journalism Major',
    category: 'Major - Arts & Humanities',
    skills: ['Writing', 'Research', 'Interviewing', 'Media Production'],
  },
  {
    id: 'major-psych',
    title: 'Psychology Major',
    category: 'Major - Social Sciences',
    skills: ['Research', 'Data Analysis', 'Human Behavior', 'Communication'],
  },
  {
    id: 'major-sociology',
    title: 'Sociology Major',
    category: 'Major - Social Sciences',
    skills: ['Research', 'Critical Thinking', 'Data Analysis', 'Writing'],
  },
  {
    id: 'major-polisci',
    title: 'Political Science Major',
    category: 'Major - Social Sciences',
    skills: ['Research', 'Writing', 'Analysis', 'Public Policy'],
  },
  {
    id: 'major-history',
    title: 'History Major',
    category: 'Major - Arts & Humanities',
    skills: ['Research', 'Writing', 'Analysis', 'Critical Thinking'],
  },
  {
    id: 'major-philosophy',
    title: 'Philosophy Major',
    category: 'Major - Arts & Humanities',
    skills: ['Critical Thinking', 'Logic', 'Writing', 'Ethics'],
  },
  {
    id: 'major-art',
    title: 'Fine Arts Major',
    category: 'Major - Arts & Humanities',
    skills: ['Creativity', 'Visual Design', 'Art History', 'Portfolio Development'],
  },
  {
    id: 'major-graphic-design',
    title: 'Graphic Design Major',
    category: 'Major - Arts & Humanities',
    skills: ['Adobe Creative Suite', 'Typography', 'Visual Communication', 'Branding'],
  },
  {
    id: 'major-film',
    title: 'Film & Media Studies Major',
    category: 'Major - Arts & Humanities',
    skills: ['Video Production', 'Storytelling', 'Editing', 'Media Analysis'],
  },
  {
    id: 'major-music',
    title: 'Music Major',
    category: 'Major - Arts & Humanities',
    skills: ['Performance', 'Theory', 'Composition', 'Collaboration'],
  },

  // University Majors - Health & Sciences
  {
    id: 'major-nursing',
    title: 'Nursing Major',
    category: 'Major - Health',
    skills: ['Patient Care', 'Medical Knowledge', 'Communication', 'Critical Thinking'],
  },
  {
    id: 'major-premed',
    title: 'Pre-Med Track',
    category: 'Major - Health',
    skills: ['Biology', 'Chemistry', 'Research', 'Patient Interaction'],
  },
  {
    id: 'major-public-health',
    title: 'Public Health Major',
    category: 'Major - Health',
    skills: ['Epidemiology', 'Health Policy', 'Statistics', 'Community Outreach'],
  },
  {
    id: 'major-kinesiology',
    title: 'Kinesiology Major',
    category: 'Major - Health',
    skills: ['Exercise Science', 'Anatomy', 'Research', 'Coaching'],
  },

  // University Majors - Other
  {
    id: 'major-education',
    title: 'Education Major',
    category: 'Major - Education',
    skills: ['Teaching', 'Curriculum Design', 'Communication', 'Classroom Management'],
  },
  {
    id: 'major-law',
    title: 'Pre-Law Track',
    category: 'Major - Other',
    skills: ['Critical Thinking', 'Writing', 'Research', 'Argumentation'],
  },
  {
    id: 'major-architecture',
    title: 'Architecture Major',
    category: 'Major - Other',
    skills: ['Design', 'CAD', '3D Modeling', 'Project Management'],
  },
  {
    id: 'major-urban-planning',
    title: 'Urban Planning Major',
    category: 'Major - Other',
    skills: ['GIS', 'Policy', 'Community Engagement', 'Design'],
  },

  // ========== PROFESSIONAL ROLES ==========
  // Technology
  {
    id: 'swe',
    title: 'Software Engineer',
    category: 'Technology',
    skills: ['JavaScript', 'Python', 'Git', 'Data Structures', 'Algorithms'],
  },
  {
    id: 'frontend',
    title: 'Frontend Developer',
    category: 'Technology',
    skills: ['React', 'TypeScript', 'CSS', 'HTML', 'JavaScript'],
  },
  {
    id: 'backend',
    title: 'Backend Developer',
    category: 'Technology',
    skills: ['Node.js', 'Python', 'SQL', 'APIs', 'System Design'],
  },
  {
    id: 'fullstack',
    title: 'Full Stack Developer',
    category: 'Technology',
    skills: ['React', 'Node.js', 'Databases', 'APIs', 'DevOps'],
  },
  {
    id: 'mobile',
    title: 'Mobile Developer',
    category: 'Technology',
    skills: ['React Native', 'Swift', 'Kotlin', 'Flutter', 'Mobile UX'],
  },
  {
    id: 'devops',
    title: 'DevOps Engineer',
    category: 'Technology',
    skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Linux'],
  },
  {
    id: 'sre',
    title: 'Site Reliability Engineer',
    category: 'Technology',
    skills: ['Monitoring', 'Automation', 'Cloud', 'Scripting', 'Incident Response'],
  },
  {
    id: 'security',
    title: 'Security Engineer',
    category: 'Technology',
    skills: ['Cybersecurity', 'Penetration Testing', 'Security Audits', 'Network Security'],
  },
  {
    id: 'ml-eng',
    title: 'Machine Learning Engineer',
    category: 'Technology',
    skills: ['Python', 'TensorFlow', 'PyTorch', 'ML Algorithms', 'Data Processing'],
  },
  {
    id: 'data-eng',
    title: 'Data Engineer',
    category: 'Technology',
    skills: ['SQL', 'Python', 'Spark', 'ETL', 'Data Warehousing'],
  },
  {
    id: 'qa',
    title: 'QA Engineer',
    category: 'Technology',
    skills: ['Test Automation', 'Selenium', 'Testing Strategies', 'Bug Tracking'],
  },
  {
    id: 'tech-lead',
    title: 'Technical Lead',
    category: 'Technology',
    skills: ['Architecture', 'Leadership', 'Code Review', 'Mentoring', 'Planning'],
  },
  {
    id: 'engineering-manager',
    title: 'Engineering Manager',
    category: 'Technology',
    skills: ['People Management', 'Project Management', 'Technical Strategy', 'Hiring'],
  },

  // Data & Analytics
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    category: 'Data & Analytics',
    skills: ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualization'],
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    category: 'Data & Analytics',
    skills: ['SQL', 'Excel', 'Tableau', 'Python', 'Statistics'],
  },
  {
    id: 'bi-analyst',
    title: 'Business Intelligence Analyst',
    category: 'Data & Analytics',
    skills: ['SQL', 'Power BI', 'Tableau', 'Data Modeling', 'Reporting'],
  },
  {
    id: 'analytics-eng',
    title: 'Analytics Engineer',
    category: 'Data & Analytics',
    skills: ['dbt', 'SQL', 'Python', 'Data Modeling', 'Looker'],
  },

  // Product & Design
  {
    id: 'pm',
    title: 'Product Manager',
    category: 'Product & Design',
    skills: ['Product Strategy', 'User Research', 'Roadmapping', 'Analytics', 'Communication'],
  },
  {
    id: 'tpm',
    title: 'Technical Product Manager',
    category: 'Product & Design',
    skills: ['Technical Knowledge', 'Product Strategy', 'API Design', 'Stakeholder Management'],
  },
  {
    id: 'ux-designer',
    title: 'UX Designer',
    category: 'Product & Design',
    skills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
  },
  {
    id: 'ui-designer',
    title: 'UI Designer',
    category: 'Product & Design',
    skills: ['Visual Design', 'Figma', 'Design Systems', 'Typography', 'Color Theory'],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    category: 'Product & Design',
    skills: ['UX Design', 'UI Design', 'Prototyping', 'User Research', 'Design Systems'],
  },
  {
    id: 'ux-researcher',
    title: 'UX Researcher',
    category: 'Product & Design',
    skills: [
      'User Interviews',
      'Surveys',
      'Usability Testing',
      'Data Analysis',
      'Research Methods',
    ],
  },

  // Business & Operations
  {
    id: 'business-analyst',
    title: 'Business Analyst',
    category: 'Business',
    skills: [
      'Requirements Gathering',
      'Process Mapping',
      'SQL',
      'Documentation',
      'Stakeholder Management',
    ],
  },
  {
    id: 'strategy',
    title: 'Strategy Analyst',
    category: 'Business',
    skills: [
      'Market Research',
      'Financial Modeling',
      'PowerPoint',
      'Data Analysis',
      'Problem Solving',
    ],
  },
  {
    id: 'consultant',
    title: 'Management Consultant',
    category: 'Business',
    skills: [
      'Problem Solving',
      'Presentations',
      'Data Analysis',
      'Client Management',
      'Project Management',
    ],
  },
  {
    id: 'ops-manager',
    title: 'Operations Manager',
    category: 'Business',
    skills: ['Process Optimization', 'Team Management', 'Budgeting', 'Vendor Management'],
  },
  {
    id: 'project-manager',
    title: 'Project Manager',
    category: 'Business',
    skills: [
      'Project Planning',
      'Risk Management',
      'Agile',
      'Communication',
      'Stakeholder Management',
    ],
  },
  {
    id: 'program-manager',
    title: 'Program Manager',
    category: 'Business',
    skills: [
      'Cross-functional Leadership',
      'Strategic Planning',
      'Execution',
      'Stakeholder Management',
    ],
  },

  // Marketing & Sales
  {
    id: 'marketing-manager',
    title: 'Marketing Manager',
    category: 'Marketing & Sales',
    skills: ['Marketing Strategy', 'Campaign Management', 'Analytics', 'Brand Management'],
  },
  {
    id: 'growth-marketer',
    title: 'Growth Marketer',
    category: 'Marketing & Sales',
    skills: ['SEO', 'Paid Ads', 'A/B Testing', 'Analytics', 'Email Marketing'],
  },
  {
    id: 'content-marketer',
    title: 'Content Marketer',
    category: 'Marketing & Sales',
    skills: ['Content Strategy', 'Writing', 'SEO', 'Social Media', 'Analytics'],
  },
  {
    id: 'sales-rep',
    title: 'Sales Representative',
    category: 'Marketing & Sales',
    skills: ['Prospecting', 'Negotiation', 'CRM', 'Communication', 'Product Knowledge'],
  },
  {
    id: 'account-exec',
    title: 'Account Executive',
    category: 'Marketing & Sales',
    skills: ['Enterprise Sales', 'Relationship Building', 'Contract Negotiation', 'Presentations'],
  },
  {
    id: 'csm',
    title: 'Customer Success Manager',
    category: 'Marketing & Sales',
    skills: ['Client Management', 'Retention', 'Onboarding', 'Communication', 'Product Knowledge'],
  },

  // Finance
  {
    id: 'financial-analyst',
    title: 'Financial Analyst',
    category: 'Finance',
    skills: ['Financial Modeling', 'Excel', 'Valuation', 'Forecasting', 'Reporting'],
  },
  {
    id: 'accountant',
    title: 'Accountant',
    category: 'Finance',
    skills: ['Accounting', 'Excel', 'Financial Reporting', 'Tax', 'Compliance'],
  },
  {
    id: 'investment-analyst',
    title: 'Investment Analyst',
    category: 'Finance',
    skills: ['Financial Analysis', 'Market Research', 'Valuation', 'Due Diligence'],
  },
  {
    id: 'fp-analyst',
    title: 'FP&A Analyst',
    category: 'Finance',
    skills: ['Budgeting', 'Forecasting', 'Financial Modeling', 'Variance Analysis', 'Excel'],
  },

  // Healthcare
  {
    id: 'healthcare-admin',
    title: 'Healthcare Administrator',
    category: 'Healthcare',
    skills: ['Healthcare Management', 'Regulatory Compliance', 'Budgeting', 'Staff Management'],
  },
  {
    id: 'clinical-analyst',
    title: 'Clinical Data Analyst',
    category: 'Healthcare',
    skills: ['Healthcare Data', 'SQL', 'Statistical Analysis', 'EHR Systems'],
  },
  {
    id: 'health-it',
    title: 'Health IT Specialist',
    category: 'Healthcare',
    skills: ['EHR Systems', 'Healthcare IT', 'Data Privacy', 'System Integration'],
  },

  // Education
  {
    id: 'teacher',
    title: 'Teacher',
    category: 'Education',
    skills: ['Curriculum Development', 'Classroom Management', 'Assessment', 'Communication'],
  },
  {
    id: 'instructional-designer',
    title: 'Instructional Designer',
    category: 'Education',
    skills: ['Curriculum Design', 'E-learning', 'LMS', 'Content Development'],
  },
  {
    id: 'academic-advisor',
    title: 'Academic Advisor',
    category: 'Education',
    skills: ['Advising', 'Student Success', 'Career Counseling', 'Program Knowledge'],
  },

  // Creative
  {
    id: 'graphic-designer',
    title: 'Graphic Designer',
    category: 'Creative',
    skills: ['Adobe Creative Suite', 'Typography', 'Branding', 'Visual Design'],
  },
  {
    id: 'video-editor',
    title: 'Video Editor',
    category: 'Creative',
    skills: ['Premiere Pro', 'After Effects', 'Storytelling', 'Color Grading'],
  },
  {
    id: 'copywriter',
    title: 'Copywriter',
    category: 'Creative',
    skills: ['Writing', 'Brand Voice', 'SEO', 'Marketing Copy', 'Editing'],
  },
  {
    id: 'content-creator',
    title: 'Content Creator',
    category: 'Creative',
    skills: ['Social Media', 'Video Production', 'Writing', 'Photography', 'Engagement'],
  },

  // Human Resources
  {
    id: 'hr-manager',
    title: 'HR Manager',
    category: 'Human Resources',
    skills: ['Recruitment', 'Employee Relations', 'HR Policy', 'Benefits', 'Compliance'],
  },
  {
    id: 'recruiter',
    title: 'Recruiter',
    category: 'Human Resources',
    skills: ['Sourcing', 'Interviewing', 'ATS', 'Candidate Experience', 'Negotiation'],
  },
  {
    id: 'hr-bp',
    title: 'HR Business Partner',
    category: 'Human Resources',
    skills: ['Strategic HR', 'Employee Development', 'Organizational Design', 'Change Management'],
  },

  // Legal
  {
    id: 'lawyer',
    title: 'Lawyer',
    category: 'Legal',
    skills: ['Legal Research', 'Contract Law', 'Litigation', 'Legal Writing', 'Negotiation'],
  },
  {
    id: 'paralegal',
    title: 'Paralegal',
    category: 'Legal',
    skills: ['Legal Research', 'Document Preparation', 'Case Management', 'Legal Writing'],
  },
  {
    id: 'compliance-officer',
    title: 'Compliance Officer',
    category: 'Legal',
    skills: ['Regulatory Compliance', 'Risk Assessment', 'Policy Development', 'Auditing'],
  },
];

/**
 * Search roles by query string
 * Matches against title, category, and skills
 */
function searchRoles(query: string, limit: number = 10): RoleSearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Return popular roles when no query
    return ROLE_DATABASE.slice(0, limit);
  }

  // Score each role based on match quality
  const scoredRoles = ROLE_DATABASE.map((role) => {
    let score = 0;

    // Exact title match gets highest score
    if (role.title.toLowerCase() === normalizedQuery) {
      score += 100;
    }
    // Title starts with query
    else if (role.title.toLowerCase().startsWith(normalizedQuery)) {
      score += 75;
    }
    // Title contains query
    else if (role.title.toLowerCase().includes(normalizedQuery)) {
      score += 50;
    }

    // Category match
    if (role.category.toLowerCase().includes(normalizedQuery)) {
      score += 25;
    }

    // Skills match
    const matchingSkills = role.skills.filter((skill) =>
      skill.toLowerCase().includes(normalizedQuery),
    );
    score += matchingSkills.length * 10;

    return { role, score };
  });

  // Filter to roles with any match, sort by score, take limit
  return scoredRoles
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.role);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query = '', limit = 10 } = body;

    const roles = searchRoles(query, Math.min(limit, 50));

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('Role search failed:', error);

    return NextResponse.json({ error: 'Failed to search roles' }, { status: 500 });
  }
}
