import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface SkillsSuggestion {
  required: string[];
  recommended: string[];
  transferable: string[];
}

// Skills database organized by role
const ROLE_SKILLS_DATABASE: Record<string, SkillsSuggestion> = {
  // Technology roles
  'Software Engineer': {
    required: ['JavaScript', 'Python', 'Git', 'Data Structures', 'Algorithms', 'SQL'],
    recommended: ['TypeScript', 'React', 'Node.js', 'System Design', 'Cloud (AWS/GCP)', 'Docker'],
    transferable: ['Problem Solving', 'Communication', 'Teamwork', 'Time Management'],
  },
  'Frontend Developer': {
    required: ['JavaScript', 'React', 'HTML', 'CSS', 'TypeScript'],
    recommended: [
      'Next.js',
      'Vue.js',
      'Tailwind CSS',
      'Accessibility',
      'Testing',
      'Performance Optimization',
    ],
    transferable: ['Attention to Detail', 'UX Thinking', 'Communication', 'Collaboration'],
  },
  'Backend Developer': {
    required: ['Python', 'Node.js', 'SQL', 'APIs', 'Databases'],
    recommended: ['Docker', 'AWS', 'Microservices', 'Redis', 'Message Queues', 'Security'],
    transferable: ['Problem Solving', 'System Thinking', 'Documentation', 'Communication'],
  },
  'Full Stack Developer': {
    required: ['JavaScript', 'React', 'Node.js', 'SQL', 'Git'],
    recommended: ['TypeScript', 'Docker', 'AWS', 'MongoDB', 'GraphQL', 'CI/CD'],
    transferable: ['Adaptability', 'Problem Solving', 'Communication', 'Project Management'],
  },
  'DevOps Engineer': {
    required: ['Linux', 'Docker', 'Kubernetes', 'CI/CD', 'AWS/GCP'],
    recommended: ['Terraform', 'Ansible', 'Monitoring', 'Security', 'Scripting', 'Networking'],
    transferable: ['Automation Mindset', 'Problem Solving', 'Communication', 'Documentation'],
  },
  'Data Scientist': {
    required: ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualization'],
    recommended: ['TensorFlow', 'PyTorch', 'Spark', 'Deep Learning', 'A/B Testing', 'NLP'],
    transferable: ['Critical Thinking', 'Communication', 'Business Acumen', 'Storytelling'],
  },
  'Data Analyst': {
    required: ['SQL', 'Excel', 'Python', 'Statistics', 'Data Visualization'],
    recommended: ['Tableau', 'Power BI', 'R', 'Looker', 'A/B Testing', 'ETL'],
    transferable: [
      'Analytical Thinking',
      'Communication',
      'Attention to Detail',
      'Business Understanding',
    ],
  },
  'Machine Learning Engineer': {
    required: ['Python', 'TensorFlow/PyTorch', 'ML Algorithms', 'Statistics', 'SQL'],
    recommended: [
      'MLOps',
      'AWS SageMaker',
      'Kubernetes',
      'Feature Engineering',
      'Model Optimization',
    ],
    transferable: ['Research Skills', 'Problem Solving', 'Communication', 'Continuous Learning'],
  },
  'Product Manager': {
    required: ['Product Strategy', 'User Research', 'Roadmapping', 'Analytics', 'Prioritization'],
    recommended: [
      'SQL',
      'A/B Testing',
      'Wireframing',
      'Agile',
      'Data Analysis',
      'Stakeholder Management',
    ],
    transferable: ['Communication', 'Leadership', 'Empathy', 'Decision Making', 'Negotiation'],
  },
  'UX Designer': {
    required: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Usability Testing'],
    recommended: ['Design Systems', 'Accessibility', 'Motion Design', 'HTML/CSS', 'User Flows'],
    transferable: ['Empathy', 'Communication', 'Critical Thinking', 'Collaboration'],
  },
  'Product Designer': {
    required: ['Figma', 'UX Design', 'UI Design', 'Prototyping', 'User Research'],
    recommended: ['Design Systems', 'Motion Design', 'Frontend Basics', 'Data-Driven Design'],
    transferable: ['Creativity', 'Communication', 'Problem Solving', 'Collaboration'],
  },
  'Project Manager': {
    required: [
      'Project Planning',
      'Risk Management',
      'Stakeholder Management',
      'Agile/Scrum',
      'Budgeting',
    ],
    recommended: ['Jira', 'MS Project', 'Confluence', 'Resource Management', 'Vendor Management'],
    transferable: ['Communication', 'Leadership', 'Organization', 'Problem Solving', 'Negotiation'],
  },
  'Business Analyst': {
    required: [
      'Requirements Gathering',
      'Process Mapping',
      'Documentation',
      'SQL',
      'Data Analysis',
    ],
    recommended: ['Jira', 'Confluence', 'Wireframing', 'Agile', 'User Stories'],
    transferable: [
      'Communication',
      'Analytical Thinking',
      'Problem Solving',
      'Stakeholder Management',
    ],
  },
  'Financial Analyst': {
    required: ['Financial Modeling', 'Excel', 'Valuation', 'Forecasting', 'Financial Reporting'],
    recommended: ['SQL', 'Python', 'Power BI', 'Bloomberg Terminal', 'VBA'],
    transferable: [
      'Analytical Thinking',
      'Attention to Detail',
      'Communication',
      'Problem Solving',
    ],
  },
  'Marketing Manager': {
    required: ['Marketing Strategy', 'Campaign Management', 'Analytics', 'Budget Management'],
    recommended: ['Google Analytics', 'SEO', 'Paid Advertising', 'Content Strategy', 'CRM'],
    transferable: ['Creativity', 'Communication', 'Leadership', 'Data-Driven Decision Making'],
  },
  'Sales Representative': {
    required: ['Prospecting', 'Negotiation', 'CRM', 'Product Knowledge', 'Closing'],
    recommended: ['Salesforce', 'Cold Calling', 'Email Outreach', 'Social Selling', 'Demo Skills'],
    transferable: ['Communication', 'Resilience', 'Relationship Building', 'Time Management'],
  },
  'Customer Success Manager': {
    required: ['Client Management', 'Retention Strategies', 'Onboarding', 'Product Knowledge'],
    recommended: ['CRM', 'Data Analysis', 'Upselling', 'Health Scoring', 'QBR Management'],
    transferable: ['Empathy', 'Communication', 'Problem Solving', 'Relationship Building'],
  },
  'HR Manager': {
    required: [
      'Recruitment',
      'Employee Relations',
      'HR Policy',
      'Benefits Administration',
      'Compliance',
    ],
    recommended: [
      'HRIS Systems',
      'Performance Management',
      'Training & Development',
      'Compensation',
    ],
    transferable: ['Communication', 'Empathy', 'Conflict Resolution', 'Confidentiality'],
  },
  Recruiter: {
    required: ['Sourcing', 'Interviewing', 'ATS', 'Candidate Experience', 'Negotiation'],
    recommended: ['LinkedIn Recruiter', 'Boolean Search', 'Employer Branding', 'Data Analysis'],
    transferable: ['Communication', 'Relationship Building', 'Organization', 'Sales Skills'],
  },
};

// Default skills for roles not in database
const DEFAULT_SKILLS: SkillsSuggestion = {
  required: ['Communication', 'Problem Solving', 'Teamwork', 'Time Management'],
  recommended: ['Project Management', 'Data Analysis', 'Presentation Skills', 'Technical Writing'],
  transferable: ['Leadership', 'Critical Thinking', 'Adaptability', 'Emotional Intelligence'],
};

// Common transferable skills that apply broadly
const COMMON_TRANSFERABLE_SKILLS = [
  'Communication',
  'Problem Solving',
  'Teamwork',
  'Time Management',
  'Leadership',
  'Critical Thinking',
  'Adaptability',
  'Emotional Intelligence',
  'Creativity',
  'Organization',
  'Attention to Detail',
  'Decision Making',
  'Conflict Resolution',
  'Negotiation',
  'Presentation Skills',
];

/**
 * Get skills suggestions for a given role title
 */
function getSkillsSuggestions(roleTitle: string): SkillsSuggestion {
  // Try exact match first
  if (ROLE_SKILLS_DATABASE[roleTitle]) {
    return ROLE_SKILLS_DATABASE[roleTitle];
  }

  // Try partial match
  const normalizedTitle = roleTitle.toLowerCase();
  for (const [key, skills] of Object.entries(ROLE_SKILLS_DATABASE)) {
    if (
      key.toLowerCase().includes(normalizedTitle) ||
      normalizedTitle.includes(key.toLowerCase())
    ) {
      return skills;
    }
  }

  // Return default skills with role-specific adjustments
  return {
    ...DEFAULT_SKILLS,
    transferable: COMMON_TRANSFERABLE_SKILLS.slice(0, 8),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role_title } = body;

    if (!role_title) {
      return NextResponse.json({ error: 'role_title is required' }, { status: 400 });
    }

    const suggestions = getSkillsSuggestions(role_title);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Skills suggestion failed:', error);

    return NextResponse.json({ error: 'Failed to get skills suggestions' }, { status: 500 });
  }
}
