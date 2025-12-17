import { NextResponse } from 'next/server';
import OpenAI from 'openai';

interface RoleDetailsResponse {
  title: string;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  salaryRange: {
    min: number;
    max: number;
    median: number;
    currency: string;
  };
  dayInTheLife: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
  jobOpenings: number;
  companiesHiring: {
    name: string;
    logo?: string;
    jobCount: number;
  }[];
}

// Common companies by industry
const TECH_COMPANIES = [
  'Google',
  'Meta',
  'Amazon',
  'Microsoft',
  'Apple',
  'Netflix',
  'Salesforce',
  'Adobe',
];
const FINANCE_COMPANIES = [
  'Goldman Sachs',
  'JPMorgan Chase',
  'Morgan Stanley',
  'Bank of America',
  'Citigroup',
  'BlackRock',
];
const CONSULTING_COMPANIES = [
  'McKinsey',
  'Bain',
  'BCG',
  'Deloitte',
  'Accenture',
  'PwC',
  'EY',
  'KPMG',
];
const HEALTHCARE_COMPANIES = [
  'Johnson & Johnson',
  'Pfizer',
  'UnitedHealth',
  'CVS Health',
  'Anthem',
  'Cigna',
];
const GENERAL_COMPANIES = [
  'Walmart',
  'Target',
  'Costco',
  'Home Depot',
  'Nike',
  'Starbucks',
  'Disney',
  'Coca-Cola',
];

// Role category detection
function getRoleCategory(title: string): string {
  const titleLower = title.toLowerCase();
  if (
    titleLower.includes('engineer') ||
    titleLower.includes('developer') ||
    titleLower.includes('software') ||
    titleLower.includes('data') ||
    titleLower.includes('product')
  ) {
    return 'tech';
  }
  if (
    titleLower.includes('analyst') ||
    titleLower.includes('finance') ||
    titleLower.includes('investment') ||
    titleLower.includes('banking')
  ) {
    return 'finance';
  }
  if (titleLower.includes('consultant') || titleLower.includes('strategy')) {
    return 'consulting';
  }
  if (
    titleLower.includes('nurse') ||
    titleLower.includes('doctor') ||
    titleLower.includes('medical') ||
    titleLower.includes('health')
  ) {
    return 'healthcare';
  }
  if (titleLower.includes('design') || titleLower.includes('ux') || titleLower.includes('ui')) {
    return 'design';
  }
  return 'general';
}

// Get companies based on role category
function getCompaniesForRole(title: string): { name: string; jobCount: number }[] {
  const category = getRoleCategory(title);
  let companies: string[];

  switch (category) {
    case 'tech':
      companies = TECH_COMPANIES;
      break;
    case 'finance':
      companies = FINANCE_COMPANIES;
      break;
    case 'consulting':
      companies = CONSULTING_COMPANIES;
      break;
    case 'healthcare':
      companies = HEALTHCARE_COMPANIES;
      break;
    default:
      companies = GENERAL_COMPANIES;
  }

  return companies
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map((name) => ({
      name,
      jobCount: Math.floor(Math.random() * 400) + 50,
    }));
}

// Estimate salary based on role title
function estimateSalary(title: string): { min: number; max: number; median: number } {
  const titleLower = title.toLowerCase();

  if (
    titleLower.includes('director') ||
    titleLower.includes('vp') ||
    titleLower.includes('vice president')
  ) {
    return { min: 180000, max: 350000, median: 250000 };
  }
  if (
    titleLower.includes('chief') ||
    titleLower.includes('cto') ||
    titleLower.includes('cfo') ||
    titleLower.includes('ceo')
  ) {
    return { min: 250000, max: 500000, median: 350000 };
  }
  if (
    titleLower.includes('senior') ||
    titleLower.includes('staff') ||
    titleLower.includes('principal')
  ) {
    return { min: 140000, max: 250000, median: 180000 };
  }
  if (titleLower.includes('manager') || titleLower.includes('lead')) {
    return { min: 120000, max: 200000, median: 150000 };
  }
  if (
    titleLower.includes('intern') ||
    titleLower.includes('junior') ||
    titleLower.includes('entry')
  ) {
    return { min: 50000, max: 80000, median: 65000 };
  }
  if (titleLower.includes('associate') || titleLower.includes('analyst')) {
    return { min: 70000, max: 120000, median: 90000 };
  }

  return { min: 90000, max: 160000, median: 120000 };
}

// Get skills based on role category
function getSkillsForRole(title: string): string[] {
  const category = getRoleCategory(title);
  const titleLower = title.toLowerCase();

  const baseSkills: Record<string, string[]> = {
    tech: [
      'Problem Solving',
      'Communication',
      'Teamwork',
      'Analytical Thinking',
      'Attention to Detail',
    ],
    finance: [
      'Excel',
      'Financial Modeling',
      'Data Analysis',
      'Attention to Detail',
      'Communication',
    ],
    consulting: [
      'Problem Solving',
      'PowerPoint',
      'Communication',
      'Analytical Thinking',
      'Client Management',
    ],
    healthcare: [
      'Patient Care',
      'Communication',
      'Attention to Detail',
      'Empathy',
      'Critical Thinking',
    ],
    design: ['Figma', 'User Research', 'Prototyping', 'Visual Design', 'Communication'],
    general: ['Communication', 'Problem Solving', 'Teamwork', 'Time Management', 'Adaptability'],
  };

  const specificSkills: Record<string, string[]> = {
    software: ['JavaScript', 'Python', 'Git', 'System Design', 'Algorithms'],
    frontend: ['React', 'TypeScript', 'CSS', 'HTML', 'Responsive Design'],
    backend: ['Node.js', 'SQL', 'APIs', 'Database Design', 'Cloud Services'],
    data: ['Python', 'SQL', 'Machine Learning', 'Statistics', 'Data Visualization'],
    'product manager': [
      'Roadmapping',
      'User Stories',
      'Prioritization',
      'Stakeholder Management',
      'Analytics',
    ],
    'product designer': ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems'],
    ux: ['User Research', 'Usability Testing', 'Information Architecture', 'Wireframing', 'Figma'],
    analyst: ['SQL', 'Excel', 'Data Visualization', 'Statistical Analysis', 'Reporting'],
  };

  let skills = [...(baseSkills[category] || baseSkills.general)];

  for (const [key, roleSkills] of Object.entries(specificSkills)) {
    if (titleLower.includes(key)) {
      skills = [...roleSkills, ...skills.slice(0, 3)];
      break;
    }
  }

  return [...new Set(skills)].slice(0, 8);
}

// Pre-built role details database
interface RoleData {
  title: string;
  description: string;
  responsibilities: string[];
  dayInTheLife: string[];
  faqs: { question: string; answer: string }[];
}

const ROLE_DETAILS_DB: Record<string, RoleData> = {
  'product designer': {
    title: 'Product Designer',
    description:
      'A Product Designer is responsible for conceptualizing, designing, and refining user experiences for digital products and services. Key responsibilities include understanding user needs, conducting research, creating wireframes and prototypes, collaborating with cross-functional teams, and iterating based on user feedback and testing. They must balance aesthetics and functionality, ensuring an intuitive, engaging, and visually appealing product.',
    responsibilities: [
      'Conceptualizing and developing innovative product designs that align with business objectives and customer needs.',
      'Creating sketches, wireframes, prototypes, and high-fidelity mockups for new product features.',
      'Conducting user research to understand the latest trends and customer preferences.',
      'Collaborating with product managers and engineers to integrate technical and aesthetic aspects.',
      'Presenting design concepts and prototypes to stakeholders and leadership.',
      'Iterating on designs based on user feedback and usability testing results.',
    ],
    dayInTheLife: [
      '9:00 AM - Review design feedback and Slack messages, prioritize daily tasks',
      '10:00 AM - Design sprint standup with product and engineering team',
      '10:30 AM - Deep work on wireframes and prototypes in Figma',
      '12:00 PM - Lunch break, often with design team for casual brainstorming',
      '1:00 PM - User research session or usability testing',
      '2:30 PM - Cross-functional meeting with engineers to discuss implementation',
      '3:30 PM - Iterate on designs based on feedback, create design specs',
      '5:00 PM - Design critique session with other designers',
      '5:30 PM - Wrap up, document decisions, and plan for tomorrow',
    ],
    faqs: [
      {
        question: 'What tools do Product Designers use?',
        answer:
          'Most Product Designers use Figma as their primary design tool. Other common tools include Sketch, Adobe XD, Framer, and prototyping tools like InVision or Principle. For user research, tools like Maze, UserTesting, and Hotjar are popular.',
      },
      {
        question: 'Do I need a degree to become a Product Designer?',
        answer:
          'No, a degree is not required. Many successful Product Designers come from bootcamps, self-taught backgrounds, or transitioned from related fields like graphic design or development. A strong portfolio demonstrating your design process and problem-solving skills is more important.',
      },
      {
        question: "What's the difference between UX and Product Design?",
        answer:
          'Product Design is a broader role that encompasses UX design, UI design, and sometimes research and strategy. UX Design focuses specifically on the user experience and usability, while Product Design takes a more holistic view of the entire product.',
      },
      {
        question: 'How long does it take to become a Product Designer?',
        answer:
          'With dedicated study and practice, you can develop foundational skills in 6-12 months. However, becoming proficient typically takes 2-3 years of hands-on experience working on real projects and building your portfolio.',
      },
    ],
  },
  'software engineer': {
    title: 'Software Engineer',
    description:
      'A Software Engineer designs, develops, tests, and maintains software applications and systems. They work with programming languages, frameworks, and tools to build scalable, efficient, and reliable solutions. Key responsibilities include writing clean code, debugging issues, participating in code reviews, and collaborating with cross-functional teams.',
    responsibilities: [
      'Designing and implementing software solutions to meet business requirements.',
      'Writing clean, maintainable, and efficient code following best practices.',
      'Debugging and resolving software defects and performance issues.',
      'Participating in code reviews and providing constructive feedback to peers.',
      'Collaborating with product managers, designers, and other engineers.',
      'Staying current with emerging technologies and industry trends.',
    ],
    dayInTheLife: [
      '9:00 AM - Check Slack, review PRs, and respond to any urgent issues',
      '9:30 AM - Daily standup meeting with the engineering team',
      '10:00 AM - Deep coding work on current sprint tickets',
      '12:00 PM - Lunch break',
      '1:00 PM - Code review sessions with team members',
      '2:00 PM - Technical design discussion or architecture review',
      '3:00 PM - Continue development work, pair programming if needed',
      '4:30 PM - Team sync or 1:1 with manager',
      '5:00 PM - Document code, update tickets, and prepare for next day',
    ],
    faqs: [
      {
        question: 'What programming languages should I learn?',
        answer:
          'Start with one language and master it. Python and JavaScript are excellent choices for beginners due to their versatility. Once comfortable, expand to languages relevant to your target role (Java for enterprise, Swift for iOS, etc.).',
      },
      {
        question: 'Do I need a CS degree to become a Software Engineer?',
        answer:
          'No, many successful engineers are self-taught or come from bootcamps. What matters is your ability to solve problems, write clean code, and demonstrate your skills through projects and contributions.',
      },
      {
        question: 'How do I prepare for technical interviews?',
        answer:
          'Practice data structures and algorithms on LeetCode or HackerRank. Study system design concepts. Build projects to discuss. Practice explaining your thought process out loud. Many companies also focus on behavioral questions.',
      },
      {
        question: "What's the difference between junior and senior engineers?",
        answer:
          'Senior engineers have broader system knowledge, can work independently, mentor others, make architectural decisions, and have experience with the full software development lifecycle. It typically takes 5-8 years to reach senior level.',
      },
    ],
  },
  'product manager': {
    title: 'Product Manager',
    description:
      'A Product Manager is responsible for the strategy, roadmap, and feature definition for a product or product line. They bridge the gap between business, technology, and user experience teams. Key responsibilities include conducting market research, defining product requirements, prioritizing features, and working closely with engineering and design teams.',
    responsibilities: [
      'Defining product vision, strategy, and roadmap based on market research and customer insights.',
      'Writing detailed product requirements and user stories.',
      'Prioritizing features and managing the product backlog.',
      'Collaborating with engineering, design, and marketing teams.',
      'Analyzing product metrics and making data-driven decisions.',
      'Communicating product plans and progress to stakeholders.',
    ],
    dayInTheLife: [
      '8:30 AM - Review metrics dashboard, check overnight customer feedback',
      '9:00 AM - Respond to Slack messages and prioritize daily tasks',
      '9:30 AM - Daily standup with engineering and design teams',
      '10:00 AM - Customer interview or user research session',
      '11:00 AM - Work on PRD (Product Requirements Document) for upcoming feature',
      '12:00 PM - Lunch, often with stakeholders to gather insights',
      '1:00 PM - Sprint planning or backlog grooming session',
      '2:30 PM - Cross-functional meeting with marketing or sales',
      '3:30 PM - Data analysis and metrics review',
      '4:30 PM - 1:1s with team members or stakeholders',
      '5:30 PM - Wrap up, update roadmap, and prepare for tomorrow',
    ],
    faqs: [
      {
        question: 'What skills do Product Managers need?',
        answer:
          "Key skills include strategic thinking, communication, data analysis, empathy, technical understanding (you don't need to code, but should understand how software is built), and the ability to prioritize ruthlessly.",
      },
      {
        question: 'How do I transition into Product Management?',
        answer:
          'Many PMs come from engineering, design, consulting, or business roles. Build PM skills in your current role by taking ownership of features, conducting user research, or managing a project. Consider PM bootcamps or certifications.',
      },
      {
        question: "What's the difference between a PM and a Product Owner?",
        answer:
          'Product Managers focus on strategy, vision, and the "what" and "why." Product Owners (in Scrum) focus more on execution, managing the backlog, and working directly with the dev team. Many companies use these titles interchangeably.',
      },
      {
        question: 'Do Product Managers need to know how to code?',
        answer:
          "You don't need to code, but technical literacy is important. Understanding APIs, databases, and basic software architecture helps you communicate effectively with engineers and make informed decisions.",
      },
    ],
  },
  'data scientist': {
    title: 'Data Scientist',
    description:
      'A Data Scientist uses statistical analysis, machine learning, and data visualization to extract insights from complex datasets. They help organizations make data-driven decisions by building predictive models and analyzing trends. Key skills include proficiency in Python/R, SQL, machine learning frameworks, and strong communication abilities.',
    responsibilities: [
      'Collecting, cleaning, and preprocessing large datasets for analysis.',
      'Building and deploying machine learning models to solve business problems.',
      'Conducting statistical analysis to identify patterns and trends.',
      'Creating data visualizations and dashboards to communicate insights.',
      'Collaborating with stakeholders to understand business requirements.',
      'Staying current with the latest developments in data science and AI.',
    ],
    dayInTheLife: [
      '9:00 AM - Review model performance metrics and any overnight alerts',
      '9:30 AM - Team standup and sync on current projects',
      '10:00 AM - Deep work: data cleaning, feature engineering, or model training',
      '12:00 PM - Lunch break',
      '1:00 PM - Meeting with stakeholders to understand business requirements',
      '2:00 PM - Continue analysis or model development',
      '3:30 PM - Present findings to cross-functional team',
      '4:30 PM - Document methodology and update experiment logs',
      '5:00 PM - Review latest research papers or take online courses',
    ],
    faqs: [
      {
        question: "What's the difference between Data Science and Data Analytics?",
        answer:
          'Data Analytics focuses on describing what happened using SQL, Excel, and visualization. Data Science involves predictive modeling, machine learning, and more advanced statistical techniques to answer "what will happen" questions.',
      },
      {
        question: 'Do I need a PhD to be a Data Scientist?',
        answer:
          "No, while PhDs are common in research-heavy roles, many Data Scientists have Master's degrees or even Bachelor's degrees with relevant experience. Bootcamps and self-study can also lead to DS roles.",
      },
      {
        question: 'What programming languages should I learn?',
        answer:
          'Python is the most important language for data science, followed by SQL for data manipulation. R is useful in certain industries (healthcare, finance). Also learn pandas, scikit-learn, and either TensorFlow or PyTorch.',
      },
      {
        question: 'How do I build a Data Science portfolio?',
        answer:
          'Work on end-to-end projects that demonstrate your skills. Use public datasets from Kaggle, create Jupyter notebooks explaining your process, and deploy models as web applications. Focus on business impact, not just accuracy.',
      },
    ],
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roleTitle } = body;

    if (!roleTitle) {
      return NextResponse.json({ error: 'Role title is required' }, { status: 400 });
    }

    const titleLower = roleTitle.toLowerCase();

    // Check if we have pre-built details for this role
    let baseDetails = ROLE_DETAILS_DB[titleLower];

    if (!baseDetails) {
      // Try to find a partial match
      const matchingKey = Object.keys(ROLE_DETAILS_DB).find(
        (key) => titleLower.includes(key) || key.includes(titleLower),
      );

      if (matchingKey) {
        baseDetails = {
          ...ROLE_DETAILS_DB[matchingKey],
          title: roleTitle,
        };
      }
    }

    // If no pre-built data, use AI to generate details
    if (!baseDetails) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Generate comprehensive job information for the role of "${roleTitle}". Return a JSON object with:
- title: the job title
- description: a 3-4 sentence description of the role
- responsibilities: an array of 6 bullet points describing key responsibilities
- dayInTheLife: an array of 8-9 time-stamped activities showing a typical workday (format: "9:00 AM - Activity description")
- faqs: an array of 4 objects, each with "question" and "answer" fields about this career

Return only valid JSON, no markdown code blocks.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content || '';

      try {
        const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedContent);
        baseDetails = {
          title: parsed.title || roleTitle,
          description:
            parsed.description ||
            `A ${roleTitle} is responsible for key functions in their domain.`,
          responsibilities: parsed.responsibilities || getDefaultResponsibilities(roleTitle),
          dayInTheLife: parsed.dayInTheLife || getDefaultDayInTheLife(roleTitle),
          faqs: parsed.faqs || getDefaultFAQs(roleTitle),
        };
      } catch {
        baseDetails = {
          title: roleTitle,
          description: `A ${roleTitle} is responsible for leading key initiatives in their domain. This role involves strategic thinking, cross-functional collaboration, and delivering measurable results. Strong analytical, communication, and problem-solving skills are essential for success.`,
          responsibilities: getDefaultResponsibilities(roleTitle),
          dayInTheLife: getDefaultDayInTheLife(roleTitle),
          faqs: getDefaultFAQs(roleTitle),
        };
      }
    }

    // Build complete response with computed fields
    const salaryEstimate = estimateSalary(roleTitle);
    const companies = getCompaniesForRole(roleTitle);
    const skills = getSkillsForRole(roleTitle);

    const response: RoleDetailsResponse = {
      ...baseDetails,
      requiredSkills: skills,
      jobOpenings: Math.floor(Math.random() * 8000) + 2000,
      companiesHiring: companies,
      salaryRange: {
        ...salaryEstimate,
        currency: 'USD',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Role details API error:', error);
    return NextResponse.json({ error: 'Failed to fetch role details' }, { status: 500 });
  }
}

// Default generators for when AI is not available
function getDefaultResponsibilities(title: string): string[] {
  return [
    `Executing key initiatives aligned with organizational goals as a ${title}.`,
    'Collaborating with cross-functional teams to deliver results.',
    'Analyzing data and metrics to inform decisions.',
    'Communicating progress and insights to stakeholders.',
    'Contributing to team development and mentorship.',
    'Staying current with industry trends and best practices.',
  ];
}

function getDefaultDayInTheLife(title: string): string[] {
  return [
    '9:00 AM - Check emails, Slack, and prioritize daily tasks',
    '9:30 AM - Team standup meeting',
    `10:00 AM - Core work activities as ${title}`,
    '12:00 PM - Lunch break',
    '1:00 PM - Stakeholder meeting or collaboration session',
    '2:30 PM - Continue project work',
    '4:00 PM - Team sync or 1:1 meetings',
    '5:00 PM - Document progress and plan for next day',
  ];
}

function getDefaultFAQs(title: string): { question: string; answer: string }[] {
  return [
    {
      question: `What education is needed to become a ${title}?`,
      answer: `While a relevant degree can be helpful, many ${title}s come from diverse educational backgrounds. What matters most is demonstrating relevant skills and experience through projects, certifications, or previous work.`,
    },
    {
      question: `What is the career progression for a ${title}?`,
      answer: `Typical progression includes moving from junior to mid-level to senior roles, then potentially into management or specialized expert tracks. Many also transition into related fields or start their own ventures.`,
    },
    {
      question: `What skills are most important for a ${title}?`,
      answer: `Key skills include strong communication, problem-solving, and domain expertise. Technical skills vary by role, but continuous learning and adaptability are universally important.`,
    },
    {
      question: `How do I get my first job as a ${title}?`,
      answer: `Build a portfolio of relevant projects, network with professionals in the field, apply to entry-level positions, and consider internships or bootcamps to gain experience.`,
    },
  ];
}
