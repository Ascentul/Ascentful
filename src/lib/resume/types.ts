// Core types for Resume Studio AI

export interface Resume {
  id: string;
  name: string;
  type: 'master' | 'variant';
  parentId?: string;
  sections: Section[];
  template: string;
  theme: Theme;
  typography: Typography;
  targetRole?: string;
  targetIndustry?: string;
  experienceYears?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SectionType =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'volunteer'
  | 'languages'
  | 'interests'
  | 'custom';

export interface Section {
  id: string;
  type: SectionType;
  title: string;
  order: number;
  isVisible: boolean;
  content: SectionContent;
  aiStatus?: 'strong' | 'needs-work' | 'critical';
}

export type SectionContent =
  | HeaderContent
  | SummaryContent
  | ExperienceContent
  | EducationContent
  | SkillsContent
  | ProjectsContent
  | CustomContent;

export interface HeaderContent {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  github?: string;
}

export interface SummaryContent {
  text: string;
}

export interface ExperienceContent {
  roles: Role[];
}

export interface Role {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  bullets: Bullet[];
}

export interface Bullet {
  id: string;
  text: string;
}

export interface EducationContent {
  entries: EducationEntry[];
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  year: string;
  gpa?: string;
  honors?: string[];
}

export interface SkillsContent {
  categories?: SkillCategory[];
  skills?: string[];
}

export interface SkillCategory {
  name: string;
  skills: string[];
}

export interface ProjectsContent {
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  url?: string;
  bullets: Bullet[];
  technologies?: string[];
  date?: string;
}

export interface CustomContent {
  items: CustomItem[];
}

export interface CustomItem {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  description?: string;
}

// SCORING TYPES
export interface Score {
  overall: number;
  breakdown: ScoreBreakdown;
  topIssues: ScoreIssue[];
  quickWins: string[];
  calculatedAt: Date;
}

export interface ScoreBreakdown {
  impact: ScoreDimension;
  clarity: ScoreDimension;
  ats: ScoreDimension;
  brevity: ScoreDimension;
}

export interface ScoreDimension {
  score: number;
  weight: number;
  signals: ScoreSignal[];
  summary: string;
}

export interface ScoreSignal {
  name: string;
  found: number;
  expected: number;
  points: number;
}

export interface ScoreIssue {
  category: 'impact' | 'clarity' | 'ats' | 'brevity';
  issue: string;
  location: string;
  fix: string;
}

// SUGGESTION TYPES
export type SuggestionType =
  | 'missing-metrics'
  | 'weak-verb'
  | 'vague-achievement'
  | 'no-outcome'
  | 'too-long'
  | 'passive-voice'
  | 'missing-keyword'
  | 'redundant-content'
  | 'weak-scope'
  | 'filler-words'
  | 'formatting-consistency'
  | 'order-optimization'
  | 'enhancement-opportunity';

export type SuggestionSeverity = 'critical' | 'important' | 'polish';
export type SuggestionCategory = 'impact' | 'clarity' | 'ats' | 'brevity';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  severity: SuggestionSeverity;
  category: SuggestionCategory;
  targetType: 'bullet' | 'section' | 'resume' | 'header';
  targetId: string;
  targetPath: string;
  title: string;
  explanation: string;
  beforeText: string;
  afterText: string;
  estimatedScoreImpact: number;
}

// JOB DESCRIPTION TYPES
export interface JobDescription {
  id: string;
  title: string;
  company: string;
  description: string;
  url?: string;
  analysis?: JDAnalysis;
  createdAt: Date;
}

export interface JDAnalysis {
  basics: {
    company: string;
    title: string;
    standardizedTitle: string;
    location: string;
    locationType: 'onsite' | 'hybrid' | 'remote';
    seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    estimatedYearsExperience: { min: number; max: number | null };
  };
  requirements: {
    required: JDRequirement[];
    preferred: JDRequirement[];
    education: {
      required: string | null;
      preferred: string | null;
      fieldOfStudy: string[];
    };
  };
  keywords: {
    technical: JDKeyword[];
    soft: JDKeyword[];
    domain: JDKeyword[];
  };
  recommendations: JDRecommendation[];
}

export interface JDRequirement {
  item: string;
  type: 'skill' | 'experience' | 'education' | 'certification' | 'other';
  mentions: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface JDKeyword {
  keyword: string;
  frequency: number;
  synonyms: string[];
  mustIncludeInResume: boolean;
}

export interface JDRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
}

// MATCH SCORE TYPES
export interface MatchScore {
  matchScore: number;
  matchLevel: 'strong' | 'good' | 'moderate' | 'weak';
  skillsAnalysis: {
    matched: MatchedSkill[];
    gaps: SkillGap[];
    score: number;
  };
  experienceAnalysis: {
    yearsMatch: boolean;
    seniorityMatch: boolean;
    industryMatch: boolean;
    score: number;
    notes: string;
  };
  keywordAnalysis: {
    found: string[];
    missing: string[];
    score: number;
  };
  recommendations: JDRecommendation[];
}

export interface MatchedSkill {
  skill: string;
  importance: 'required' | 'preferred' | 'nice-to-have';
  evidenceInResume: string;
}

export interface SkillGap {
  skill: string;
  importance: 'required' | 'preferred' | 'nice-to-have';
  suggestion: string;
}

// DESIGN TYPES
export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    textLight: string;
    background: string;
    accent: string;
  };
}

export interface Typography {
  headingFont: string;
  bodyFont: string;
  sizes: {
    name: number;
    sectionTitle: number;
    company: number;
    role: number;
    body: number;
    date: number;
  };
  lineHeight: number;
}

// API RESPONSE TYPES
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// BULLET REWRITE TYPES
export interface BulletRewriteResult {
  rewrittenBullet: string;
  wordCount: number;
  changes: BulletChange[];
  metricsStatus: {
    hadMetrics: boolean;
    hasMetrics: boolean;
    metricsAdded: string[];
  };
  verbAnalysis: {
    originalVerb: string;
    newVerb: string;
    tierImprovement: number;
  };
  alternativeVersions: AlternativeVersion[];
  confidence: 'high' | 'medium' | 'low';
  followUpQuestions: string[];
}

export interface BulletChange {
  type: 'verb' | 'metric' | 'structure' | 'clarity' | 'keyword';
  before: string;
  after: string;
  reason: string;
}

export interface AlternativeVersion {
  bullet: string;
  emphasis: 'impact' | 'leadership' | 'technical' | 'efficiency';
  wordCount: number;
}
