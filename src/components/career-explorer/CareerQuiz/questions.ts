import type { QuizQuestion } from '@/lib/career-explorer/types';

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Work Style (4 questions)
  {
    id: 'work_style_team',
    category: 'work_style',
    question: 'How do you prefer to work?',
    type: 'single_choice',
    options: [
      { value: 'solo', label: 'Independently - I do my best work alone' },
      { value: 'small_team', label: 'Small team - Close collaboration with a few people' },
      { value: 'large_team', label: 'Large team - Part of a bigger organization' },
      { value: 'varies', label: 'It depends on the project' },
    ],
  },
  {
    id: 'work_style_structure',
    category: 'work_style',
    question: 'What type of work environment do you thrive in?',
    type: 'single_choice',
    options: [
      { value: 'structured', label: 'Structured - Clear processes and expectations' },
      { value: 'flexible', label: 'Flexible - Autonomy to approach things my way' },
      { value: 'fast_paced', label: 'Fast-paced - Constantly changing priorities' },
      { value: 'methodical', label: 'Methodical - Deep focus on fewer things' },
    ],
  },
  {
    id: 'work_style_ambiguity',
    category: 'work_style',
    question: 'How comfortable are you with ambiguity?',
    type: 'scale',
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: {
      min: 'Need clear direction',
      max: 'Thrive in ambiguity',
    },
  },
  {
    id: 'work_style_leadership',
    category: 'work_style',
    question: 'What role do you naturally take in group settings?',
    type: 'single_choice',
    options: [
      { value: 'leader', label: 'Leader - I take charge and direct others' },
      { value: 'contributor', label: 'Contributor - I focus on my expertise' },
      { value: 'connector', label: 'Connector - I bring people together' },
      { value: 'supporter', label: 'Supporter - I help others succeed' },
    ],
  },

  // Interests (5 questions)
  {
    id: 'interests_domains',
    category: 'interests',
    question: 'Which domains interest you most? (Select up to 3)',
    type: 'multiple_choice',
    options: [
      { value: 'technology', label: 'Technology & Software' },
      { value: 'business', label: 'Business & Strategy' },
      { value: 'creative', label: 'Creative & Design' },
      { value: 'science', label: 'Science & Research' },
      { value: 'healthcare', label: 'Healthcare & Medicine' },
      { value: 'education', label: 'Education & Training' },
      { value: 'finance', label: 'Finance & Economics' },
      { value: 'social', label: 'Social Impact & Nonprofit' },
    ],
  },
  {
    id: 'interests_problems',
    category: 'interests',
    question: 'What types of problems do you enjoy solving?',
    type: 'multiple_choice',
    options: [
      { value: 'analytical', label: 'Analytical - Data, logic, optimization' },
      { value: 'creative', label: 'Creative - Design, innovation, storytelling' },
      { value: 'interpersonal', label: 'Interpersonal - Communication, relationships' },
      { value: 'technical', label: 'Technical - Building, engineering, systems' },
      { value: 'strategic', label: 'Strategic - Planning, decision-making' },
    ],
  },
  {
    id: 'interests_activities',
    category: 'interests',
    question: 'Which activities energize you?',
    type: 'multiple_choice',
    options: [
      { value: 'building', label: 'Building things from scratch' },
      { value: 'analyzing', label: 'Analyzing data and finding insights' },
      { value: 'presenting', label: 'Presenting and influencing others' },
      { value: 'writing', label: 'Writing and communicating ideas' },
      { value: 'helping', label: 'Helping and mentoring people' },
      { value: 'organizing', label: 'Organizing and managing projects' },
    ],
  },
  {
    id: 'interests_learning',
    category: 'interests',
    question: 'What do you enjoy learning about in your free time?',
    type: 'multiple_choice',
    options: [
      { value: 'tech_trends', label: 'New technologies and tools' },
      { value: 'business_news', label: 'Business and market trends' },
      { value: 'psychology', label: 'Psychology and human behavior' },
      { value: 'arts_culture', label: 'Arts, culture, and media' },
      { value: 'science_nature', label: 'Science and nature' },
      { value: 'current_events', label: 'Current events and politics' },
    ],
  },
  {
    id: 'interests_impact_area',
    category: 'interests',
    question: 'Where would you most like to make an impact?',
    type: 'single_choice',
    options: [
      { value: 'innovation', label: 'Creating innovative products or services' },
      { value: 'growth', label: 'Helping organizations grow and succeed' },
      { value: 'people', label: "Improving people's lives directly" },
      { value: 'knowledge', label: 'Advancing knowledge and research' },
      { value: 'community', label: 'Strengthening communities' },
    ],
  },

  // Values (4 questions)
  {
    id: 'values_priority',
    category: 'values',
    question: 'Rank what matters most to you in a career:',
    type: 'ranking',
    options: [
      { value: 'compensation', label: 'High compensation' },
      { value: 'impact', label: 'Meaningful impact' },
      { value: 'growth', label: 'Learning & growth' },
      { value: 'balance', label: 'Work-life balance' },
      { value: 'prestige', label: 'Recognition & prestige' },
    ],
  },
  {
    id: 'values_risk',
    category: 'values',
    question: 'How do you feel about career risk?',
    type: 'scale',
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: {
      min: 'Prefer stability',
      max: 'Embrace high risk/reward',
    },
  },
  {
    id: 'values_company_size',
    category: 'values',
    question: 'What type of organization appeals to you?',
    type: 'single_choice',
    options: [
      { value: 'startup', label: 'Startup - Fast-paced, high impact, less stability' },
      { value: 'mid_size', label: 'Mid-size company - Balance of growth and stability' },
      { value: 'enterprise', label: 'Large enterprise - Stability, resources, defined paths' },
      { value: 'nonprofit', label: 'Nonprofit - Mission-driven, community focused' },
      { value: 'government', label: 'Government/Public sector - Stability, public service' },
      { value: 'self_employed', label: 'Self-employed - Full autonomy, build my own thing' },
    ],
  },
  {
    id: 'values_remote',
    category: 'values',
    question: "What's your ideal work location setup?",
    type: 'single_choice',
    options: [
      { value: 'remote', label: 'Fully remote - Work from anywhere' },
      { value: 'hybrid', label: 'Hybrid - Mix of office and remote' },
      { value: 'office', label: 'In-office - Prefer being with the team' },
      { value: 'flexible', label: 'Flexible - Whatever works for the role' },
    ],
  },

  // Constraints (3 questions)
  {
    id: 'constraints_timeline',
    category: 'constraints',
    question: 'When do you want to land your first career role?',
    type: 'single_choice',
    options: [
      { value: 'asap', label: 'As soon as possible' },
      { value: '6_months', label: 'Within 6 months' },
      { value: '1_year', label: 'Within a year' },
      { value: '2_plus', label: '2+ years (still exploring)' },
    ],
  },
  {
    id: 'constraints_location',
    category: 'constraints',
    question: 'How flexible are you on location?',
    type: 'single_choice',
    options: [
      { value: 'anywhere', label: 'Will go anywhere for the right opportunity' },
      { value: 'major_cities', label: 'Prefer major cities/tech hubs' },
      { value: 'region_locked', label: 'Need to stay in my current region' },
      { value: 'remote_only', label: 'Remote only' },
    ],
  },
  {
    id: 'constraints_education',
    category: 'constraints',
    question: 'How do you feel about additional education or training?',
    type: 'single_choice',
    options: [
      { value: 'none', label: 'Prefer to start working right away' },
      { value: 'short_term', label: 'Open to bootcamps or certifications' },
      { value: 'masters', label: "Considering a master's degree" },
      { value: 'phd', label: 'Interested in doctoral studies' },
    ],
  },
];

export const QUIZ_CATEGORIES = [
  { id: 'work_style', name: 'Work Style', description: 'How you like to work' },
  { id: 'interests', name: 'Interests', description: 'What excites you' },
  { id: 'values', name: 'Values', description: 'What matters to you' },
  { id: 'constraints', name: 'Constraints', description: 'Your practical considerations' },
] as const;

export function getQuestionsByCategory(category: string): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => q.category === category);
}

export function getQuestionById(id: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === id);
}

export function getCategoryProgress(
  category: string,
  answers: Record<string, unknown>,
): { answered: number; total: number } {
  const categoryQuestions = getQuestionsByCategory(category);
  const answered = categoryQuestions.filter((q) => answers[q.id] !== undefined).length;
  return { answered, total: categoryQuestions.length };
}
