import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { requireConvexToken } from '@/lib/convex-auth';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface NextRolesRequest {
  currentRole: string;
  category?: string;
  skills_have?: string[];
  skills_want?: string[];
  count?: number;
  column?: 'entry_level' | 'lateral' | 'promotion' | 'internship';
}

interface NextRole {
  id: string;
  title: string;
  category: string;
  fit_score: number;
  reason: string;
  skills: string[];
  relationship: 'entry_level' | 'promotion' | 'lateral' | 'pivot' | 'specialization';
}

// Pre-built role transition database for instant results
const ROLE_TRANSITIONS: Record<
  string,
  {
    entry_level: Omit<NextRole, 'id'>[];
    lateral: Omit<NextRole, 'id'>[];
    promotion: Omit<NextRole, 'id'>[];
  }
> = {
  // Data Engineer paths
  'data engineer': {
    entry_level: [
      {
        title: 'Junior Data Engineer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Direct entry point',
        skills: ['Python', 'SQL', 'ETL'],
        relationship: 'entry_level',
      },
      {
        title: 'Data Analyst',
        category: 'Data',
        fit_score: 88,
        reason: 'Analysis focus',
        skills: ['SQL', 'Visualization', 'Statistics'],
        relationship: 'entry_level',
      },
      {
        title: 'Database Administrator',
        category: 'Technology',
        fit_score: 82,
        reason: 'Data management',
        skills: ['SQL', 'Database design', 'Performance'],
        relationship: 'entry_level',
      },
      {
        title: 'ETL Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'Data pipeline focus',
        skills: ['ETL', 'SQL', 'Data warehousing'],
        relationship: 'entry_level',
      },
      {
        title: 'Analytics Engineer',
        category: 'Data',
        fit_score: 85,
        reason: 'Analytics infrastructure',
        skills: ['SQL', 'dbt', 'Data modeling'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Machine Learning Engineer',
        category: 'Technology',
        fit_score: 85,
        reason: 'ML infrastructure',
        skills: ['Python', 'MLOps', 'Data pipelines'],
        relationship: 'lateral',
      },
      {
        title: 'Platform Engineer',
        category: 'Technology',
        fit_score: 80,
        reason: 'Infrastructure focus',
        skills: ['Cloud', 'Kubernetes', 'Automation'],
        relationship: 'lateral',
      },
      {
        title: 'Backend Developer',
        category: 'Technology',
        fit_score: 78,
        reason: 'Application development',
        skills: ['APIs', 'Databases', 'Python'],
        relationship: 'lateral',
      },
      {
        title: 'Data Scientist',
        category: 'Data',
        fit_score: 82,
        reason: 'Analytics focus',
        skills: ['Python', 'Statistics', 'Machine Learning'],
        relationship: 'lateral',
      },
      {
        title: 'Solutions Architect',
        category: 'Technology',
        fit_score: 75,
        reason: 'Architecture focus',
        skills: ['System design', 'Cloud', 'Data architecture'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior Data Engineer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Architecture', 'Mentoring', 'Complex pipelines'],
        relationship: 'promotion',
      },
      {
        title: 'Staff Data Engineer',
        category: 'Technology',
        fit_score: 88,
        reason: 'Technical leadership',
        skills: ['Data strategy', 'Cross-team influence', 'Architecture'],
        relationship: 'promotion',
      },
      {
        title: 'Data Engineering Manager',
        category: 'Technology',
        fit_score: 85,
        reason: 'Team leadership',
        skills: ['Team management', 'Hiring', 'Project planning'],
        relationship: 'promotion',
      },
      {
        title: 'Principal Data Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Senior IC track',
        skills: ['Technical vision', 'Innovation', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Head of Data Engineering',
        category: 'Technology',
        fit_score: 78,
        reason: 'Department leadership',
        skills: ['Strategy', 'Executive communication', 'Org building'],
        relationship: 'promotion',
      },
    ],
  },
  // Senior Software Engineer paths
  'senior software engineer': {
    entry_level: [],
    lateral: [
      {
        title: 'Tech Lead',
        category: 'Technology',
        fit_score: 92,
        reason: 'Technical leadership',
        skills: ['Leadership', 'Architecture', 'Mentoring'],
        relationship: 'lateral',
      },
      {
        title: 'Solutions Architect',
        category: 'Technology',
        fit_score: 88,
        reason: 'System design focus',
        skills: ['Architecture', 'Cloud', 'Communication'],
        relationship: 'lateral',
      },
      {
        title: 'Machine Learning Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'ML specialization',
        skills: ['Python', 'ML', 'Data pipelines'],
        relationship: 'lateral',
      },
      {
        title: 'Site Reliability Engineer',
        category: 'Technology',
        fit_score: 78,
        reason: 'Operations focus',
        skills: ['Infrastructure', 'Monitoring', 'Automation'],
        relationship: 'lateral',
      },
      {
        title: 'Security Engineer',
        category: 'Technology',
        fit_score: 75,
        reason: 'Security specialization',
        skills: ['Security', 'Compliance', 'Architecture'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Staff Engineer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural IC progression',
        skills: ['Technical strategy', 'Cross-team influence', 'Architecture'],
        relationship: 'promotion',
      },
      {
        title: 'Engineering Manager',
        category: 'Technology',
        fit_score: 90,
        reason: 'People management path',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
      {
        title: 'Principal Engineer',
        category: 'Technology',
        fit_score: 88,
        reason: 'Senior IC track',
        skills: ['Technical vision', 'Mentoring', 'Innovation'],
        relationship: 'promotion',
      },
      {
        title: 'Director of Engineering',
        category: 'Technology',
        fit_score: 82,
        reason: 'Engineering leadership',
        skills: ['Org leadership', 'Strategy', 'Executive communication'],
        relationship: 'promotion',
      },
      {
        title: 'VP of Engineering',
        category: 'Technology',
        fit_score: 75,
        reason: 'Executive leadership',
        skills: ['Strategy', 'Organization building', 'Executive communication'],
        relationship: 'promotion',
      },
    ],
  },
  // Frontend Developer paths
  'frontend developer': {
    entry_level: [
      {
        title: 'Junior Frontend Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Direct entry',
        skills: ['JavaScript', 'React', 'CSS'],
        relationship: 'entry_level',
      },
      {
        title: 'Web Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'General web development',
        skills: ['HTML', 'CSS', 'JavaScript'],
        relationship: 'entry_level',
      },
      {
        title: 'UI Developer',
        category: 'Technology',
        fit_score: 88,
        reason: 'UI implementation',
        skills: ['CSS', 'JavaScript', 'Design systems'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Full Stack Developer',
        category: 'Technology',
        fit_score: 88,
        reason: 'End-to-end development',
        skills: ['Node.js', 'React', 'Databases'],
        relationship: 'lateral',
      },
      {
        title: 'Mobile Developer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Mobile platforms',
        skills: ['React Native', 'iOS', 'Android'],
        relationship: 'lateral',
      },
      {
        title: 'UX Engineer',
        category: 'Technology',
        fit_score: 85,
        reason: 'UX implementation',
        skills: ['CSS', 'Animation', 'User experience'],
        relationship: 'lateral',
      },
      {
        title: 'Design Technologist',
        category: 'Design',
        fit_score: 78,
        reason: 'Design-dev bridge',
        skills: ['Prototyping', 'CSS', 'Design tools'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior Frontend Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Architecture', 'Performance', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Lead Frontend Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'Technical leadership',
        skills: ['Team leadership', 'Architecture', 'Code review'],
        relationship: 'promotion',
      },
      {
        title: 'Frontend Architect',
        category: 'Technology',
        fit_score: 85,
        reason: 'Architecture focus',
        skills: ['System design', 'Performance', 'Standards'],
        relationship: 'promotion',
      },
      {
        title: 'Engineering Manager',
        category: 'Technology',
        fit_score: 82,
        reason: 'People management',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
    ],
  },
  // Backend Developer paths
  'backend developer': {
    entry_level: [
      {
        title: 'Junior Backend Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Direct entry',
        skills: ['Python', 'Node.js', 'SQL'],
        relationship: 'entry_level',
      },
      {
        title: 'API Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'API focus',
        skills: ['REST', 'GraphQL', 'APIs'],
        relationship: 'entry_level',
      },
      {
        title: 'Server Developer',
        category: 'Technology',
        fit_score: 88,
        reason: 'Server-side focus',
        skills: ['Node.js', 'Java', 'Databases'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Full Stack Developer',
        category: 'Technology',
        fit_score: 88,
        reason: 'End-to-end development',
        skills: ['React', 'Node.js', 'Databases'],
        relationship: 'lateral',
      },
      {
        title: 'DevOps Engineer',
        category: 'Technology',
        fit_score: 85,
        reason: 'Infrastructure focus',
        skills: ['CI/CD', 'Docker', 'Cloud'],
        relationship: 'lateral',
      },
      {
        title: 'Data Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Data pipeline focus',
        skills: ['ETL', 'SQL', 'Python'],
        relationship: 'lateral',
      },
      {
        title: 'Cloud Engineer',
        category: 'Technology',
        fit_score: 80,
        reason: 'Cloud infrastructure',
        skills: ['AWS', 'Azure', 'Infrastructure'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Backend Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Architecture', 'Performance', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Lead Backend Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'Technical leadership',
        skills: ['Team leadership', 'Architecture', 'Code review'],
        relationship: 'promotion',
      },
      {
        title: 'Backend Architect',
        category: 'Technology',
        fit_score: 85,
        reason: 'Architecture focus',
        skills: ['System design', 'Scalability', 'Standards'],
        relationship: 'promotion',
      },
      {
        title: 'Engineering Manager',
        category: 'Technology',
        fit_score: 82,
        reason: 'People management',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
    ],
  },
  // Full Stack Developer paths
  'full stack developer': {
    entry_level: [
      {
        title: 'Junior Full Stack Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Direct entry',
        skills: ['JavaScript', 'React', 'Node.js'],
        relationship: 'entry_level',
      },
      {
        title: 'Web Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'General web development',
        skills: ['HTML', 'CSS', 'JavaScript'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Frontend Developer',
        category: 'Technology',
        fit_score: 85,
        reason: 'Frontend specialization',
        skills: ['React', 'CSS', 'TypeScript'],
        relationship: 'lateral',
      },
      {
        title: 'Backend Developer',
        category: 'Technology',
        fit_score: 85,
        reason: 'Backend specialization',
        skills: ['Node.js', 'Python', 'Databases'],
        relationship: 'lateral',
      },
      {
        title: 'DevOps Engineer',
        category: 'Technology',
        fit_score: 78,
        reason: 'Infrastructure focus',
        skills: ['CI/CD', 'Docker', 'Cloud'],
        relationship: 'lateral',
      },
      {
        title: 'Mobile Developer',
        category: 'Technology',
        fit_score: 80,
        reason: 'Mobile platforms',
        skills: ['React Native', 'iOS', 'Android'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Full Stack Developer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Architecture', 'Performance', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Tech Lead',
        category: 'Technology',
        fit_score: 90,
        reason: 'Technical leadership',
        skills: ['Team leadership', 'Architecture', 'Code review'],
        relationship: 'promotion',
      },
      {
        title: 'Engineering Manager',
        category: 'Technology',
        fit_score: 85,
        reason: 'People management',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
      {
        title: 'Staff Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Senior IC track',
        skills: ['Technical strategy', 'Cross-team influence', 'Architecture'],
        relationship: 'promotion',
      },
    ],
  },
  // UX Designer paths
  'ux designer': {
    entry_level: [
      {
        title: 'Junior UX Designer',
        category: 'Design',
        fit_score: 95,
        reason: 'Direct entry',
        skills: ['Figma', 'User research', 'Prototyping'],
        relationship: 'entry_level',
      },
      {
        title: 'UI Designer',
        category: 'Design',
        fit_score: 90,
        reason: 'Visual design focus',
        skills: ['Visual design', 'Figma', 'Design systems'],
        relationship: 'entry_level',
      },
      {
        title: 'UX Researcher',
        category: 'Design',
        fit_score: 85,
        reason: 'Research focus',
        skills: ['User research', 'Interviews', 'Analysis'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Product Designer',
        category: 'Design',
        fit_score: 90,
        reason: 'End-to-end design',
        skills: ['UX', 'UI', 'Product thinking'],
        relationship: 'lateral',
      },
      {
        title: 'Interaction Designer',
        category: 'Design',
        fit_score: 85,
        reason: 'Interaction focus',
        skills: ['Prototyping', 'Animation', 'User flows'],
        relationship: 'lateral',
      },
      {
        title: 'Service Designer',
        category: 'Design',
        fit_score: 78,
        reason: 'Service design',
        skills: ['Journey mapping', 'Research', 'Strategy'],
        relationship: 'lateral',
      },
      {
        title: 'UX Writer',
        category: 'Design',
        fit_score: 75,
        reason: 'Content focus',
        skills: ['Writing', 'UX', 'Content strategy'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior UX Designer',
        category: 'Design',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Design leadership', 'Strategy', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Lead UX Designer',
        category: 'Design',
        fit_score: 90,
        reason: 'Team leadership',
        skills: ['Team leadership', 'Design systems', 'Strategy'],
        relationship: 'promotion',
      },
      {
        title: 'Design Manager',
        category: 'Design',
        fit_score: 85,
        reason: 'People management',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
      {
        title: 'Director of UX',
        category: 'Design',
        fit_score: 80,
        reason: 'Department leadership',
        skills: ['Design strategy', 'Executive communication', 'Org building'],
        relationship: 'promotion',
      },
      {
        title: 'VP of Design',
        category: 'Design',
        fit_score: 75,
        reason: 'Executive leadership',
        skills: ['Strategy', 'Organization building', 'Executive communication'],
        relationship: 'promotion',
      },
    ],
  },
  // Product Designer paths
  'product designer': {
    entry_level: [
      {
        title: 'Junior Product Designer',
        category: 'Design',
        fit_score: 95,
        reason: 'Direct entry',
        skills: ['Figma', 'User research', 'UI design'],
        relationship: 'entry_level',
      },
      {
        title: 'UX Designer',
        category: 'Design',
        fit_score: 90,
        reason: 'UX focus',
        skills: ['User research', 'Prototyping', 'Usability'],
        relationship: 'entry_level',
      },
      {
        title: 'UI Designer',
        category: 'Design',
        fit_score: 88,
        reason: 'Visual design',
        skills: ['Visual design', 'Figma', 'Design systems'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'UX Researcher',
        category: 'Design',
        fit_score: 82,
        reason: 'Research specialization',
        skills: ['User research', 'Interviews', 'Analysis'],
        relationship: 'lateral',
      },
      {
        title: 'Design Technologist',
        category: 'Design',
        fit_score: 78,
        reason: 'Design-dev bridge',
        skills: ['Prototyping', 'Code', 'Design tools'],
        relationship: 'lateral',
      },
      {
        title: 'Content Designer',
        category: 'Design',
        fit_score: 75,
        reason: 'Content focus',
        skills: ['Writing', 'UX', 'Content strategy'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Product Designer',
        category: 'Design',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Design leadership', 'Strategy', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Staff Product Designer',
        category: 'Design',
        fit_score: 90,
        reason: 'Senior IC track',
        skills: ['Design strategy', 'Cross-team influence', 'Innovation'],
        relationship: 'promotion',
      },
      {
        title: 'Design Manager',
        category: 'Design',
        fit_score: 85,
        reason: 'People management',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
      {
        title: 'Head of Product Design',
        category: 'Design',
        fit_score: 80,
        reason: 'Department leadership',
        skills: ['Design strategy', 'Executive communication', 'Org building'],
        relationship: 'promotion',
      },
    ],
  },
  // Software Engineering paths
  'software engineer': {
    entry_level: [
      {
        title: 'Junior Software Engineer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Direct entry point',
        skills: ['JavaScript', 'Python', 'Git'],
        relationship: 'entry_level',
      },
      {
        title: 'Frontend Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'Specialization in UI',
        skills: ['React', 'CSS', 'TypeScript'],
        relationship: 'entry_level',
      },
      {
        title: 'Backend Developer',
        category: 'Technology',
        fit_score: 90,
        reason: 'Server-side focus',
        skills: ['Node.js', 'SQL', 'APIs'],
        relationship: 'entry_level',
      },
      {
        title: 'QA Engineer',
        category: 'Technology',
        fit_score: 80,
        reason: 'Quality-focused path',
        skills: ['Testing', 'Automation', 'Bug tracking'],
        relationship: 'entry_level',
      },
      {
        title: 'DevOps Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Infrastructure focus',
        skills: ['Docker', 'CI/CD', 'Cloud'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Data Engineer',
        category: 'Technology',
        fit_score: 85,
        reason: 'Data pipeline focus',
        skills: ['SQL', 'Python', 'ETL'],
        relationship: 'lateral',
      },
      {
        title: 'Mobile Developer',
        category: 'Technology',
        fit_score: 88,
        reason: 'Platform specialization',
        skills: ['React Native', 'Swift', 'Kotlin'],
        relationship: 'lateral',
      },
      {
        title: 'Security Engineer',
        category: 'Technology',
        fit_score: 78,
        reason: 'Security specialization',
        skills: ['Security', 'Penetration testing', 'Compliance'],
        relationship: 'lateral',
      },
      {
        title: 'Solutions Architect',
        category: 'Technology',
        fit_score: 75,
        reason: 'System design focus',
        skills: ['Architecture', 'Cloud', 'Communication'],
        relationship: 'pivot',
      },
      {
        title: 'Technical Writer',
        category: 'Technology',
        fit_score: 70,
        reason: 'Documentation focus',
        skills: ['Writing', 'Technical knowledge', 'Communication'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior Software Engineer',
        category: 'Technology',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['System design', 'Mentoring', 'Architecture'],
        relationship: 'promotion',
      },
      {
        title: 'Staff Engineer',
        category: 'Technology',
        fit_score: 88,
        reason: 'Technical leadership',
        skills: ['Technical strategy', 'Cross-team collaboration', 'Architecture'],
        relationship: 'promotion',
      },
      {
        title: 'Engineering Manager',
        category: 'Technology',
        fit_score: 85,
        reason: 'People management path',
        skills: ['Leadership', 'Hiring', 'Team building'],
        relationship: 'promotion',
      },
      {
        title: 'Principal Engineer',
        category: 'Technology',
        fit_score: 82,
        reason: 'Senior IC track',
        skills: ['Technical vision', 'Mentoring', 'Innovation'],
        relationship: 'promotion',
      },
      {
        title: 'VP of Engineering',
        category: 'Technology',
        fit_score: 75,
        reason: 'Executive leadership',
        skills: ['Strategy', 'Organization building', 'Executive communication'],
        relationship: 'promotion',
      },
    ],
  },
  // Product Management paths
  'product manager': {
    entry_level: [
      {
        title: 'Associate Product Manager',
        category: 'Product',
        fit_score: 95,
        reason: 'Entry-level PM role',
        skills: ['User research', 'Roadmapping', 'Communication'],
        relationship: 'entry_level',
      },
      {
        title: 'Product Analyst',
        category: 'Product',
        fit_score: 88,
        reason: 'Data-driven PM path',
        skills: ['Analytics', 'SQL', 'Product metrics'],
        relationship: 'entry_level',
      },
      {
        title: 'Technical Product Manager',
        category: 'Product',
        fit_score: 85,
        reason: 'Tech-focused PM',
        skills: ['Technical knowledge', 'APIs', 'Engineering collaboration'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Product Marketing Manager',
        category: 'Marketing',
        fit_score: 82,
        reason: 'Go-to-market focus',
        skills: ['Marketing', 'Positioning', 'Launch planning'],
        relationship: 'lateral',
      },
      {
        title: 'UX Designer',
        category: 'Design',
        fit_score: 75,
        reason: 'User experience focus',
        skills: ['Design thinking', 'Prototyping', 'User research'],
        relationship: 'pivot',
      },
      {
        title: 'Business Analyst',
        category: 'Business',
        fit_score: 80,
        reason: 'Requirements focus',
        skills: ['Analysis', 'Documentation', 'Stakeholder management'],
        relationship: 'lateral',
      },
      {
        title: 'Program Manager',
        category: 'Operations',
        fit_score: 78,
        reason: 'Execution focus',
        skills: ['Project management', 'Cross-functional coordination', 'Process'],
        relationship: 'lateral',
      },
    ],
    promotion: [
      {
        title: 'Senior Product Manager',
        category: 'Product',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Strategy', 'Stakeholder management', 'Product vision'],
        relationship: 'promotion',
      },
      {
        title: 'Group Product Manager',
        category: 'Product',
        fit_score: 88,
        reason: 'Multi-product leadership',
        skills: ['Portfolio management', 'Team leadership', 'Strategy'],
        relationship: 'promotion',
      },
      {
        title: 'Director of Product',
        category: 'Product',
        fit_score: 82,
        reason: 'Product organization leadership',
        skills: ['Org leadership', 'Executive communication', 'Vision'],
        relationship: 'promotion',
      },
      {
        title: 'VP of Product',
        category: 'Product',
        fit_score: 78,
        reason: 'Executive product leadership',
        skills: ['Business strategy', 'Board communication', 'Company vision'],
        relationship: 'promotion',
      },
      {
        title: 'Chief Product Officer',
        category: 'Product',
        fit_score: 72,
        reason: 'C-suite product leadership',
        skills: ['Executive leadership', 'Company strategy', 'Innovation'],
        relationship: 'promotion',
      },
    ],
  },
  // Data Science paths
  'data scientist': {
    entry_level: [
      {
        title: 'Junior Data Scientist',
        category: 'Data',
        fit_score: 95,
        reason: 'Entry-level DS role',
        skills: ['Python', 'Statistics', 'Machine Learning'],
        relationship: 'entry_level',
      },
      {
        title: 'Data Analyst',
        category: 'Data',
        fit_score: 90,
        reason: 'Analysis focus',
        skills: ['SQL', 'Visualization', 'Statistics'],
        relationship: 'entry_level',
      },
      {
        title: 'Business Intelligence Analyst',
        category: 'Data',
        fit_score: 85,
        reason: 'Business insights focus',
        skills: ['SQL', 'Dashboards', 'Reporting'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Machine Learning Engineer',
        category: 'Technology',
        fit_score: 88,
        reason: 'ML production focus',
        skills: ['Python', 'MLOps', 'Deep Learning'],
        relationship: 'lateral',
      },
      {
        title: 'Data Engineer',
        category: 'Technology',
        fit_score: 85,
        reason: 'Infrastructure focus',
        skills: ['ETL', 'Data pipelines', 'Cloud'],
        relationship: 'lateral',
      },
      {
        title: 'Research Scientist',
        category: 'Research',
        fit_score: 80,
        reason: 'Research focus',
        skills: ['Research', 'Publications', 'Novel algorithms'],
        relationship: 'specialization',
      },
      {
        title: 'Quantitative Analyst',
        category: 'Finance',
        fit_score: 78,
        reason: 'Finance application',
        skills: ['Statistics', 'Financial modeling', 'Python'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Senior Data Scientist',
        category: 'Data',
        fit_score: 95,
        reason: 'Natural progression',
        skills: ['Advanced ML', 'Project leadership', 'Mentoring'],
        relationship: 'promotion',
      },
      {
        title: 'Staff Data Scientist',
        category: 'Data',
        fit_score: 88,
        reason: 'Technical leadership',
        skills: ['ML strategy', 'Cross-team influence', 'Research'],
        relationship: 'promotion',
      },
      {
        title: 'Data Science Manager',
        category: 'Data',
        fit_score: 85,
        reason: 'Team leadership',
        skills: ['Team management', 'Hiring', 'Project planning'],
        relationship: 'promotion',
      },
      {
        title: 'Head of Data Science',
        category: 'Data',
        fit_score: 78,
        reason: 'Department leadership',
        skills: ['Strategy', 'Executive communication', 'Org building'],
        relationship: 'promotion',
      },
    ],
  },
  // Marketing paths
  marketing: {
    entry_level: [
      {
        title: 'Marketing Coordinator',
        category: 'Marketing',
        fit_score: 92,
        reason: 'Entry-level marketing',
        skills: ['Communication', 'Social media', 'Content creation'],
        relationship: 'entry_level',
      },
      {
        title: 'Social Media Specialist',
        category: 'Marketing',
        fit_score: 88,
        reason: 'Social focus',
        skills: ['Social media', 'Content', 'Analytics'],
        relationship: 'entry_level',
      },
      {
        title: 'Content Marketing Specialist',
        category: 'Marketing',
        fit_score: 85,
        reason: 'Content focus',
        skills: ['Writing', 'SEO', 'Content strategy'],
        relationship: 'entry_level',
      },
      {
        title: 'Digital Marketing Specialist',
        category: 'Marketing',
        fit_score: 90,
        reason: 'Digital channels focus',
        skills: ['PPC', 'Analytics', 'Email marketing'],
        relationship: 'entry_level',
      },
      {
        title: 'Marketing Analyst',
        category: 'Marketing',
        fit_score: 82,
        reason: 'Data-driven marketing',
        skills: ['Analytics', 'Excel', 'Reporting'],
        relationship: 'entry_level',
      },
    ],
    lateral: [
      {
        title: 'Brand Manager',
        category: 'Marketing',
        fit_score: 85,
        reason: 'Brand focus',
        skills: ['Branding', 'Strategy', 'Creative direction'],
        relationship: 'lateral',
      },
      {
        title: 'Public Relations Specialist',
        category: 'Communications',
        fit_score: 78,
        reason: 'PR focus',
        skills: ['Media relations', 'Writing', 'Crisis management'],
        relationship: 'lateral',
      },
      {
        title: 'Event Coordinator',
        category: 'Marketing',
        fit_score: 75,
        reason: 'Events focus',
        skills: ['Event planning', 'Vendor management', 'Logistics'],
        relationship: 'pivot',
      },
    ],
    promotion: [
      {
        title: 'Marketing Manager',
        category: 'Marketing',
        fit_score: 92,
        reason: 'Team leadership',
        skills: ['Strategy', 'Team management', 'Budget'],
        relationship: 'promotion',
      },
      {
        title: 'Director of Marketing',
        category: 'Marketing',
        fit_score: 85,
        reason: 'Department leadership',
        skills: ['Marketing strategy', 'Executive communication', 'P&L'],
        relationship: 'promotion',
      },
      {
        title: 'VP of Marketing',
        category: 'Marketing',
        fit_score: 78,
        reason: 'Executive marketing',
        skills: ['Business strategy', 'Board communication', 'Brand vision'],
        relationship: 'promotion',
      },
      {
        title: 'Chief Marketing Officer',
        category: 'Marketing',
        fit_score: 72,
        reason: 'C-suite marketing',
        skills: ['Executive leadership', 'Company strategy', 'Growth'],
        relationship: 'promotion',
      },
    ],
  },
};

// Major-specific entry-level mappings for instant results
const MAJOR_ENTRY_LEVEL: Record<string, Omit<NextRole, 'id'>[]> = {
  'computer science': [
    {
      title: 'Software Engineer',
      category: 'Technology',
      fit_score: 95,
      reason: 'Core CS application',
      skills: ['Programming', 'Algorithms', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Analyst',
      category: 'Data',
      fit_score: 88,
      reason: 'Data skills transfer',
      skills: ['SQL', 'Python', 'Statistics'],
      relationship: 'entry_level',
    },
    {
      title: 'IT Support Specialist',
      category: 'Technology',
      fit_score: 78,
      reason: 'Tech fundamentals',
      skills: ['Troubleshooting', 'Systems', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'QA Engineer',
      category: 'Technology',
      fit_score: 82,
      reason: 'Quality focus',
      skills: ['Testing', 'Automation', 'Attention to detail'],
      relationship: 'entry_level',
    },
    {
      title: 'Technical Support Engineer',
      category: 'Technology',
      fit_score: 80,
      reason: 'Customer-facing tech',
      skills: ['Problem solving', 'Communication', 'Technical knowledge'],
      relationship: 'entry_level',
    },
    {
      title: 'Web Developer',
      category: 'Technology',
      fit_score: 90,
      reason: 'Web development focus',
      skills: ['HTML/CSS', 'JavaScript', 'Frameworks'],
      relationship: 'entry_level',
    },
    {
      title: 'Systems Administrator',
      category: 'Technology',
      fit_score: 75,
      reason: 'Infrastructure focus',
      skills: ['Linux', 'Networking', 'Security'],
      relationship: 'entry_level',
    },
    {
      title: 'Database Administrator',
      category: 'Technology',
      fit_score: 78,
      reason: 'Data management',
      skills: ['SQL', 'Database design', 'Performance tuning'],
      relationship: 'entry_level',
    },
  ],
  'business administration': [
    {
      title: 'Business Analyst',
      category: 'Business',
      fit_score: 92,
      reason: 'Core business skills',
      skills: ['Analysis', 'Communication', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Operations Coordinator',
      category: 'Operations',
      fit_score: 88,
      reason: 'Operations focus',
      skills: ['Organization', 'Process improvement', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Account Manager',
      category: 'Sales',
      fit_score: 85,
      reason: 'Client relationship focus',
      skills: ['Communication', 'Relationship building', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Project Coordinator',
      category: 'Operations',
      fit_score: 85,
      reason: 'Project management path',
      skills: ['Organization', 'Communication', 'Planning'],
      relationship: 'entry_level',
    },
    {
      title: 'Human Resources Coordinator',
      category: 'HR',
      fit_score: 80,
      reason: 'People operations',
      skills: ['Communication', 'Organization', 'Empathy'],
      relationship: 'entry_level',
    },
    {
      title: 'Management Trainee',
      category: 'Management',
      fit_score: 90,
      reason: 'Leadership track',
      skills: ['Leadership', 'Communication', 'Problem solving'],
      relationship: 'entry_level',
    },
  ],
  marketing: [
    {
      title: 'Marketing Coordinator',
      category: 'Marketing',
      fit_score: 95,
      reason: 'Direct application',
      skills: ['Communication', 'Creativity', 'Analytics'],
      relationship: 'entry_level',
    },
    {
      title: 'Social Media Specialist',
      category: 'Marketing',
      fit_score: 90,
      reason: 'Digital marketing',
      skills: ['Social media', 'Content creation', 'Analytics'],
      relationship: 'entry_level',
    },
    {
      title: 'Content Writer',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Content focus',
      skills: ['Writing', 'SEO', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Brand Ambassador',
      category: 'Marketing',
      fit_score: 82,
      reason: 'Brand representation',
      skills: ['Communication', 'Enthusiasm', 'Public speaking'],
      relationship: 'entry_level',
    },
    {
      title: 'Digital Marketing Specialist',
      category: 'Marketing',
      fit_score: 92,
      reason: 'Online marketing',
      skills: ['PPC', 'SEO', 'Analytics'],
      relationship: 'entry_level',
    },
    {
      title: 'Market Research Analyst',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Research focus',
      skills: ['Analysis', 'Research', 'Presentation'],
      relationship: 'entry_level',
    },
  ],
  finance: [
    {
      title: 'Financial Analyst',
      category: 'Finance',
      fit_score: 95,
      reason: 'Core finance role',
      skills: ['Financial modeling', 'Excel', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Accountant',
      category: 'Finance',
      fit_score: 90,
      reason: 'Accounting focus',
      skills: ['Accounting', 'Excel', 'Attention to detail'],
      relationship: 'entry_level',
    },
    {
      title: 'Investment Banking Analyst',
      category: 'Finance',
      fit_score: 88,
      reason: 'High finance path',
      skills: ['Financial modeling', 'Valuation', 'Presentation'],
      relationship: 'entry_level',
    },
    {
      title: 'Risk Analyst',
      category: 'Finance',
      fit_score: 82,
      reason: 'Risk management',
      skills: ['Analysis', 'Statistics', 'Risk assessment'],
      relationship: 'entry_level',
    },
    {
      title: 'Credit Analyst',
      category: 'Finance',
      fit_score: 80,
      reason: 'Credit assessment',
      skills: ['Financial analysis', 'Risk assessment', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Tax Associate',
      category: 'Finance',
      fit_score: 78,
      reason: 'Tax specialization',
      skills: ['Tax law', 'Accounting', 'Attention to detail'],
      relationship: 'entry_level',
    },
  ],
  psychology: [
    {
      title: 'Human Resources Coordinator',
      category: 'HR',
      fit_score: 88,
      reason: 'People-focused',
      skills: ['Communication', 'Empathy', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Recruiter',
      category: 'HR',
      fit_score: 85,
      reason: 'Talent assessment',
      skills: ['Communication', 'Assessment', 'Networking'],
      relationship: 'entry_level',
    },
    {
      title: 'Research Assistant',
      category: 'Research',
      fit_score: 82,
      reason: 'Research application',
      skills: ['Research methods', 'Data analysis', 'Writing'],
      relationship: 'entry_level',
    },
    {
      title: 'Case Manager',
      category: 'Social Services',
      fit_score: 80,
      reason: 'Client support',
      skills: ['Empathy', 'Communication', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'UX Researcher',
      category: 'Design',
      fit_score: 78,
      reason: 'User behavior focus',
      skills: ['Research', 'User interviews', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Training Coordinator',
      category: 'HR',
      fit_score: 75,
      reason: 'Learning & development',
      skills: ['Communication', 'Presentation', 'Organization'],
      relationship: 'entry_level',
    },
  ],
};

// Major to internship mappings - when starting from a major, show relevant internships
const MAJOR_INTERNSHIPS: Record<string, Omit<NextRole, 'id'>[]> = {
  'computer science': [
    {
      title: 'Software Engineering Intern',
      category: 'Technology',
      fit_score: 95,
      reason: 'Core CS application',
      skills: ['Programming', 'Problem solving', 'Git'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Science Intern',
      category: 'Data',
      fit_score: 88,
      reason: 'Data skills application',
      skills: ['Python', 'Statistics', 'Data analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Web Development Intern',
      category: 'Technology',
      fit_score: 90,
      reason: 'Frontend/backend experience',
      skills: ['JavaScript', 'HTML/CSS', 'React'],
      relationship: 'entry_level',
    },
    {
      title: 'QA/Testing Intern',
      category: 'Technology',
      fit_score: 82,
      reason: 'Quality assurance focus',
      skills: ['Testing', 'Bug tracking', 'Attention to detail'],
      relationship: 'entry_level',
    },
    {
      title: 'IT Support Intern',
      category: 'Technology',
      fit_score: 78,
      reason: 'Technical support experience',
      skills: ['Troubleshooting', 'Communication', 'Systems'],
      relationship: 'entry_level',
    },
    {
      title: 'DevOps Intern',
      category: 'Technology',
      fit_score: 80,
      reason: 'Infrastructure focus',
      skills: ['Linux', 'CI/CD', 'Cloud basics'],
      relationship: 'entry_level',
    },
    {
      title: 'Mobile Development Intern',
      category: 'Technology',
      fit_score: 85,
      reason: 'Mobile app development',
      skills: ['iOS/Android', 'React Native', 'Mobile UI'],
      relationship: 'entry_level',
    },
    {
      title: 'Machine Learning Intern',
      category: 'Technology',
      fit_score: 82,
      reason: 'AI/ML experience',
      skills: ['Python', 'Machine Learning', 'Math'],
      relationship: 'entry_level',
    },
  ],
  'business administration': [
    {
      title: 'Business Analyst Intern',
      category: 'Business',
      fit_score: 92,
      reason: 'Core business skills',
      skills: ['Analysis', 'Excel', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Operations Intern',
      category: 'Operations',
      fit_score: 88,
      reason: 'Operations experience',
      skills: ['Organization', 'Process improvement', 'Coordination'],
      relationship: 'entry_level',
    },
    {
      title: 'Project Management Intern',
      category: 'Operations',
      fit_score: 85,
      reason: 'Project coordination',
      skills: ['Planning', 'Communication', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Human Resources Intern',
      category: 'HR',
      fit_score: 80,
      reason: 'People operations',
      skills: ['Communication', 'Organization', 'Empathy'],
      relationship: 'entry_level',
    },
    {
      title: 'Management Consulting Intern',
      category: 'Consulting',
      fit_score: 88,
      reason: 'Consulting exposure',
      skills: ['Problem solving', 'Analysis', 'Presentation'],
      relationship: 'entry_level',
    },
    {
      title: 'Account Management Intern',
      category: 'Sales',
      fit_score: 82,
      reason: 'Client relations',
      skills: ['Communication', 'Relationship building', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Supply Chain Intern',
      category: 'Operations',
      fit_score: 78,
      reason: 'Supply chain operations',
      skills: ['Logistics', 'Analysis', 'Coordination'],
      relationship: 'entry_level',
    },
    {
      title: 'Strategy Intern',
      category: 'Strategy',
      fit_score: 85,
      reason: 'Strategic planning',
      skills: ['Research', 'Analysis', 'Presentation'],
      relationship: 'entry_level',
    },
  ],
  marketing: [
    {
      title: 'Marketing Intern',
      category: 'Marketing',
      fit_score: 95,
      reason: 'Direct marketing experience',
      skills: ['Communication', 'Creativity', 'Social media'],
      relationship: 'entry_level',
    },
    {
      title: 'Social Media Intern',
      category: 'Marketing',
      fit_score: 92,
      reason: 'Social media focus',
      skills: ['Social platforms', 'Content creation', 'Analytics'],
      relationship: 'entry_level',
    },
    {
      title: 'Content Marketing Intern',
      category: 'Marketing',
      fit_score: 88,
      reason: 'Content creation',
      skills: ['Writing', 'SEO basics', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Digital Marketing Intern',
      category: 'Marketing',
      fit_score: 90,
      reason: 'Digital channels',
      skills: ['Google Analytics', 'Ads', 'Email marketing'],
      relationship: 'entry_level',
    },
    {
      title: 'Brand Marketing Intern',
      category: 'Marketing',
      fit_score: 82,
      reason: 'Brand management',
      skills: ['Branding', 'Creative direction', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Market Research Intern',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Research focus',
      skills: ['Research', 'Analysis', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'PR/Communications Intern',
      category: 'Communications',
      fit_score: 80,
      reason: 'Public relations',
      skills: ['Writing', 'Media relations', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Event Marketing Intern',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Event coordination',
      skills: ['Event planning', 'Coordination', 'Communication'],
      relationship: 'entry_level',
    },
  ],
  finance: [
    {
      title: 'Finance Intern',
      category: 'Finance',
      fit_score: 95,
      reason: 'Core finance experience',
      skills: ['Excel', 'Financial analysis', 'Modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'Investment Banking Intern',
      category: 'Finance',
      fit_score: 90,
      reason: 'Banking exposure',
      skills: ['Valuation', 'Financial modeling', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Accounting Intern',
      category: 'Finance',
      fit_score: 88,
      reason: 'Accounting fundamentals',
      skills: ['Accounting', 'Excel', 'Attention to detail'],
      relationship: 'entry_level',
    },
    {
      title: 'Corporate Finance Intern',
      category: 'Finance',
      fit_score: 92,
      reason: 'Corporate finance',
      skills: ['FP&A', 'Budgeting', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Wealth Management Intern',
      category: 'Finance',
      fit_score: 82,
      reason: 'Client-facing finance',
      skills: ['Communication', 'Financial planning', 'Client service'],
      relationship: 'entry_level',
    },
    {
      title: 'Private Equity Intern',
      category: 'Finance',
      fit_score: 85,
      reason: 'PE exposure',
      skills: ['Valuation', 'Due diligence', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Risk Management Intern',
      category: 'Finance',
      fit_score: 78,
      reason: 'Risk focus',
      skills: ['Risk analysis', 'Excel', 'Compliance'],
      relationship: 'entry_level',
    },
    {
      title: 'Tax Intern',
      category: 'Finance',
      fit_score: 75,
      reason: 'Tax specialization',
      skills: ['Tax law', 'Accounting', 'Research'],
      relationship: 'entry_level',
    },
  ],
  psychology: [
    {
      title: 'Human Resources Intern',
      category: 'HR',
      fit_score: 90,
      reason: 'People-focused role',
      skills: ['Communication', 'Empathy', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Recruiting Intern',
      category: 'HR',
      fit_score: 85,
      reason: 'Talent acquisition',
      skills: ['Communication', 'Assessment', 'Sourcing'],
      relationship: 'entry_level',
    },
    {
      title: 'Research Assistant',
      category: 'Research',
      fit_score: 88,
      reason: 'Research application',
      skills: ['Research methods', 'Data collection', 'Writing'],
      relationship: 'entry_level',
    },
    {
      title: 'UX Research Intern',
      category: 'Design',
      fit_score: 82,
      reason: 'User behavior research',
      skills: ['User research', 'Interviews', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Training & Development Intern',
      category: 'HR',
      fit_score: 78,
      reason: 'Learning focus',
      skills: ['Communication', 'Presentation', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Social Services Intern',
      category: 'Social Services',
      fit_score: 80,
      reason: 'Community support',
      skills: ['Empathy', 'Communication', 'Case management'],
      relationship: 'entry_level',
    },
    {
      title: 'Marketing Research Intern',
      category: 'Marketing',
      fit_score: 75,
      reason: 'Consumer behavior',
      skills: ['Research', 'Analysis', 'Psychology'],
      relationship: 'entry_level',
    },
    {
      title: 'Employee Experience Intern',
      category: 'HR',
      fit_score: 82,
      reason: 'Employee engagement',
      skills: ['Communication', 'Analysis', 'Empathy'],
      relationship: 'entry_level',
    },
  ],
  engineering: [
    {
      title: 'Engineering Intern',
      category: 'Engineering',
      fit_score: 95,
      reason: 'Direct engineering experience',
      skills: ['CAD', 'Problem solving', 'Technical skills'],
      relationship: 'entry_level',
    },
    {
      title: 'Manufacturing Intern',
      category: 'Engineering',
      fit_score: 88,
      reason: 'Manufacturing processes',
      skills: ['Production', 'Quality control', 'Process improvement'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Development Intern',
      category: 'Engineering',
      fit_score: 90,
      reason: 'Product engineering',
      skills: ['Design', 'Prototyping', 'Testing'],
      relationship: 'entry_level',
    },
    {
      title: 'Quality Engineering Intern',
      category: 'Engineering',
      fit_score: 82,
      reason: 'Quality focus',
      skills: ['Quality assurance', 'Testing', 'Documentation'],
      relationship: 'entry_level',
    },
    {
      title: 'Project Engineering Intern',
      category: 'Engineering',
      fit_score: 85,
      reason: 'Project coordination',
      skills: ['Planning', 'Technical documentation', 'Coordination'],
      relationship: 'entry_level',
    },
    {
      title: 'R&D Intern',
      category: 'Research',
      fit_score: 88,
      reason: 'Research & development',
      skills: ['Research', 'Innovation', 'Technical skills'],
      relationship: 'entry_level',
    },
    {
      title: 'Process Engineering Intern',
      category: 'Engineering',
      fit_score: 80,
      reason: 'Process optimization',
      skills: ['Process improvement', 'Analysis', 'Technical skills'],
      relationship: 'entry_level',
    },
    {
      title: 'Technical Sales Intern',
      category: 'Sales',
      fit_score: 75,
      reason: 'Technical sales support',
      skills: ['Communication', 'Technical knowledge', 'Presentation'],
      relationship: 'entry_level',
    },
  ],
  communications: [
    {
      title: 'Communications Intern',
      category: 'Communications',
      fit_score: 95,
      reason: 'Direct experience',
      skills: ['Writing', 'Communication', 'Media'],
      relationship: 'entry_level',
    },
    {
      title: 'Public Relations Intern',
      category: 'Communications',
      fit_score: 92,
      reason: 'PR experience',
      skills: ['Writing', 'Media relations', 'Press releases'],
      relationship: 'entry_level',
    },
    {
      title: 'Social Media Intern',
      category: 'Marketing',
      fit_score: 88,
      reason: 'Social platforms',
      skills: ['Social media', 'Content creation', 'Engagement'],
      relationship: 'entry_level',
    },
    {
      title: 'Content Writing Intern',
      category: 'Marketing',
      fit_score: 90,
      reason: 'Content creation',
      skills: ['Writing', 'Editing', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Corporate Communications Intern',
      category: 'Communications',
      fit_score: 85,
      reason: 'Internal comms',
      skills: ['Writing', 'Communication', 'Organization'],
      relationship: 'entry_level',
    },
    {
      title: 'Media Relations Intern',
      category: 'Communications',
      fit_score: 82,
      reason: 'Media focus',
      skills: ['Media outreach', 'Writing', 'Relationship building'],
      relationship: 'entry_level',
    },
    {
      title: 'Event Coordination Intern',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Event support',
      skills: ['Event planning', 'Coordination', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Journalism Intern',
      category: 'Media',
      fit_score: 80,
      reason: 'News & reporting',
      skills: ['Writing', 'Research', 'Interviewing'],
      relationship: 'entry_level',
    },
  ],
  'graphic design': [
    {
      title: 'Graphic Design Intern',
      category: 'Design',
      fit_score: 95,
      reason: 'Direct design experience',
      skills: ['Adobe Creative Suite', 'Visual design', 'Typography'],
      relationship: 'entry_level',
    },
    {
      title: 'UI/UX Design Intern',
      category: 'Design',
      fit_score: 88,
      reason: 'Digital product design',
      skills: ['Figma', 'User experience', 'Prototyping'],
      relationship: 'entry_level',
    },
    {
      title: 'Brand Design Intern',
      category: 'Design',
      fit_score: 90,
      reason: 'Brand identity',
      skills: ['Branding', 'Visual identity', 'Creative direction'],
      relationship: 'entry_level',
    },
    {
      title: 'Marketing Design Intern',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Marketing materials',
      skills: ['Visual design', 'Marketing', 'Adobe Suite'],
      relationship: 'entry_level',
    },
    {
      title: 'Motion Graphics Intern',
      category: 'Design',
      fit_score: 82,
      reason: 'Animation focus',
      skills: ['After Effects', 'Animation', 'Video editing'],
      relationship: 'entry_level',
    },
    {
      title: 'Web Design Intern',
      category: 'Design',
      fit_score: 85,
      reason: 'Web visual design',
      skills: ['Web design', 'HTML/CSS basics', 'Figma'],
      relationship: 'entry_level',
    },
    {
      title: 'Production Design Intern',
      category: 'Design',
      fit_score: 78,
      reason: 'Production focus',
      skills: ['Production', 'Print design', 'File preparation'],
      relationship: 'entry_level',
    },
    {
      title: 'Packaging Design Intern',
      category: 'Design',
      fit_score: 75,
      reason: 'Package design',
      skills: ['3D design', 'Print production', 'Branding'],
      relationship: 'entry_level',
    },
  ],
  economics: [
    {
      title: 'Economic Research Intern',
      category: 'Research',
      fit_score: 92,
      reason: 'Research application',
      skills: ['Research', 'Data analysis', 'Economics'],
      relationship: 'entry_level',
    },
    {
      title: 'Finance Intern',
      category: 'Finance',
      fit_score: 90,
      reason: 'Financial analysis',
      skills: ['Excel', 'Financial analysis', 'Economics'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Analytics Intern',
      category: 'Data',
      fit_score: 88,
      reason: 'Quantitative analysis',
      skills: ['Data analysis', 'Statistics', 'Excel'],
      relationship: 'entry_level',
    },
    {
      title: 'Consulting Intern',
      category: 'Consulting',
      fit_score: 85,
      reason: 'Analytical consulting',
      skills: ['Analysis', 'Problem solving', 'Presentation'],
      relationship: 'entry_level',
    },
    {
      title: 'Investment Research Intern',
      category: 'Finance',
      fit_score: 85,
      reason: 'Investment analysis',
      skills: ['Research', 'Financial modeling', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Policy Research Intern',
      category: 'Research',
      fit_score: 80,
      reason: 'Policy analysis',
      skills: ['Research', 'Writing', 'Policy analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Market Research Intern',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Market analysis',
      skills: ['Research', 'Analysis', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'Business Development Intern',
      category: 'Business',
      fit_score: 75,
      reason: 'Business growth',
      skills: ['Research', 'Communication', 'Analysis'],
      relationship: 'entry_level',
    },
  ],
  'data science': [
    {
      title: 'Data Science Intern',
      category: 'Data',
      fit_score: 95,
      reason: 'Direct application',
      skills: ['Python', 'Machine Learning', 'Statistics'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Analytics Intern',
      category: 'Data',
      fit_score: 92,
      reason: 'Analytics focus',
      skills: ['SQL', 'Data visualization', 'Statistics'],
      relationship: 'entry_level',
    },
    {
      title: 'Machine Learning Intern',
      category: 'Technology',
      fit_score: 88,
      reason: 'ML focus',
      skills: ['Python', 'Machine Learning', 'Deep Learning'],
      relationship: 'entry_level',
    },
    {
      title: 'Business Intelligence Intern',
      category: 'Data',
      fit_score: 85,
      reason: 'BI tools',
      skills: ['SQL', 'Dashboards', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'Research Intern',
      category: 'Research',
      fit_score: 82,
      reason: 'Research application',
      skills: ['Research', 'Analysis', 'Writing'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Analytics Intern',
      category: 'Product',
      fit_score: 80,
      reason: 'Product metrics',
      skills: ['Analytics', 'SQL', 'A/B testing'],
      relationship: 'entry_level',
    },
    {
      title: 'Quantitative Research Intern',
      category: 'Finance',
      fit_score: 78,
      reason: 'Quant focus',
      skills: ['Statistics', 'Python', 'Financial modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'AI Research Intern',
      category: 'Research',
      fit_score: 85,
      reason: 'AI/ML research',
      skills: ['Python', 'Deep Learning', 'Research'],
      relationship: 'entry_level',
    },
  ],
};

// Internship-specific entry level mappings for instant results
const INTERNSHIP_ENTRY_LEVEL: Record<string, Omit<NextRole, 'id'>[]> = {
  'software engineering': [
    {
      title: 'Junior Software Engineer',
      category: 'Technology',
      fit_score: 95,
      reason: 'Direct transition from internship',
      skills: ['Programming', 'Git', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Frontend Developer',
      category: 'Technology',
      fit_score: 92,
      reason: 'UI/UX focus',
      skills: ['React', 'JavaScript', 'CSS'],
      relationship: 'entry_level',
    },
    {
      title: 'Backend Developer',
      category: 'Technology',
      fit_score: 92,
      reason: 'Server-side development',
      skills: ['Node.js', 'Python', 'APIs'],
      relationship: 'entry_level',
    },
    {
      title: 'Full Stack Developer',
      category: 'Technology',
      fit_score: 90,
      reason: 'End-to-end development',
      skills: ['React', 'Node.js', 'Databases'],
      relationship: 'entry_level',
    },
    {
      title: 'DevOps Engineer',
      category: 'Technology',
      fit_score: 85,
      reason: 'Infrastructure and deployment',
      skills: ['Docker', 'CI/CD', 'Cloud'],
      relationship: 'entry_level',
    },
    {
      title: 'QA Engineer',
      category: 'Technology',
      fit_score: 82,
      reason: 'Quality assurance focus',
      skills: ['Testing', 'Automation', 'Bug tracking'],
      relationship: 'entry_level',
    },
    {
      title: 'Mobile Developer',
      category: 'Technology',
      fit_score: 88,
      reason: 'Mobile app development',
      skills: ['React Native', 'iOS', 'Android'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Engineer',
      category: 'Technology',
      fit_score: 80,
      reason: 'Data pipeline focus',
      skills: ['Python', 'SQL', 'ETL'],
      relationship: 'entry_level',
    },
    {
      title: 'Cloud Engineer',
      category: 'Technology',
      fit_score: 78,
      reason: 'Cloud infrastructure',
      skills: ['AWS', 'Azure', 'Infrastructure'],
      relationship: 'entry_level',
    },
    {
      title: 'Site Reliability Engineer',
      category: 'Technology',
      fit_score: 75,
      reason: 'Systems reliability',
      skills: ['Linux', 'Monitoring', 'Automation'],
      relationship: 'entry_level',
    },
    {
      title: 'Security Engineer',
      category: 'Technology',
      fit_score: 72,
      reason: 'Security focus',
      skills: ['Security', 'Networking', 'Compliance'],
      relationship: 'entry_level',
    },
    {
      title: 'Solutions Engineer',
      category: 'Technology',
      fit_score: 78,
      reason: 'Technical sales support',
      skills: ['Communication', 'Technical demos', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Technical Support Engineer',
      category: 'Technology',
      fit_score: 75,
      reason: 'Customer-facing technical role',
      skills: ['Troubleshooting', 'Communication', 'Technical knowledge'],
      relationship: 'entry_level',
    },
    {
      title: 'Platform Engineer',
      category: 'Technology',
      fit_score: 80,
      reason: 'Platform development',
      skills: ['Infrastructure', 'APIs', 'Automation'],
      relationship: 'entry_level',
    },
    {
      title: 'Integration Engineer',
      category: 'Technology',
      fit_score: 76,
      reason: 'System integration',
      skills: ['APIs', 'Data mapping', 'Problem solving'],
      relationship: 'entry_level',
    },
  ],
  'data science': [
    {
      title: 'Junior Data Scientist',
      category: 'Data',
      fit_score: 95,
      reason: 'Direct transition',
      skills: ['Python', 'Machine Learning', 'Statistics'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Analyst',
      category: 'Data',
      fit_score: 92,
      reason: 'Analysis focus',
      skills: ['SQL', 'Visualization', 'Statistics'],
      relationship: 'entry_level',
    },
    {
      title: 'Business Intelligence Analyst',
      category: 'Data',
      fit_score: 88,
      reason: 'Business insights',
      skills: ['SQL', 'Dashboards', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'Machine Learning Engineer',
      category: 'Technology',
      fit_score: 85,
      reason: 'ML production',
      skills: ['Python', 'MLOps', 'Deep Learning'],
      relationship: 'entry_level',
    },
    {
      title: 'Data Engineer',
      category: 'Technology',
      fit_score: 85,
      reason: 'Data infrastructure',
      skills: ['ETL', 'SQL', 'Python'],
      relationship: 'entry_level',
    },
    {
      title: 'Analytics Engineer',
      category: 'Data',
      fit_score: 82,
      reason: 'Analytics infrastructure',
      skills: ['SQL', 'dbt', 'Data modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'Quantitative Analyst',
      category: 'Finance',
      fit_score: 78,
      reason: 'Financial analytics',
      skills: ['Statistics', 'Python', 'Financial modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'Research Analyst',
      category: 'Research',
      fit_score: 80,
      reason: 'Research application',
      skills: ['Research', 'Analysis', 'Writing'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Analyst',
      category: 'Product',
      fit_score: 85,
      reason: 'Product metrics',
      skills: ['SQL', 'A/B testing', 'Product sense'],
      relationship: 'entry_level',
    },
    {
      title: 'Marketing Analyst',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Marketing analytics',
      skills: ['Analytics', 'SQL', 'Marketing'],
      relationship: 'entry_level',
    },
  ],
  'product management': [
    {
      title: 'Associate Product Manager',
      category: 'Product',
      fit_score: 95,
      reason: 'Entry-level PM',
      skills: ['User research', 'Communication', 'Roadmapping'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Analyst',
      category: 'Product',
      fit_score: 90,
      reason: 'Data-driven PM path',
      skills: ['Analytics', 'SQL', 'Product metrics'],
      relationship: 'entry_level',
    },
    {
      title: 'Technical Product Manager',
      category: 'Product',
      fit_score: 85,
      reason: 'Tech-focused PM',
      skills: ['Technical knowledge', 'APIs', 'Engineering collaboration'],
      relationship: 'entry_level',
    },
    {
      title: 'Program Manager',
      category: 'Operations',
      fit_score: 82,
      reason: 'Execution focus',
      skills: ['Project management', 'Coordination', 'Process'],
      relationship: 'entry_level',
    },
    {
      title: 'Business Analyst',
      category: 'Business',
      fit_score: 85,
      reason: 'Requirements focus',
      skills: ['Analysis', 'Documentation', 'Stakeholders'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Marketing Manager',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Go-to-market focus',
      skills: ['Marketing', 'Positioning', 'Launch'],
      relationship: 'entry_level',
    },
    {
      title: 'Customer Success Manager',
      category: 'Customer Success',
      fit_score: 75,
      reason: 'Customer focus',
      skills: ['Communication', 'Problem solving', 'Relationship building'],
      relationship: 'entry_level',
    },
    {
      title: 'Project Coordinator',
      category: 'Operations',
      fit_score: 80,
      reason: 'Project support',
      skills: ['Organization', 'Communication', 'Planning'],
      relationship: 'entry_level',
    },
    {
      title: 'Operations Analyst',
      category: 'Operations',
      fit_score: 78,
      reason: 'Operations improvement',
      skills: ['Analysis', 'Process improvement', 'Data'],
      relationship: 'entry_level',
    },
    {
      title: 'Strategy Analyst',
      category: 'Strategy',
      fit_score: 75,
      reason: 'Strategic planning',
      skills: ['Analysis', 'Research', 'Presentation'],
      relationship: 'entry_level',
    },
  ],
  'ux design': [
    {
      title: 'UX Designer',
      category: 'Design',
      fit_score: 95,
      reason: 'Direct transition',
      skills: ['Figma', 'User research', 'Prototyping'],
      relationship: 'entry_level',
    },
    {
      title: 'UI Designer',
      category: 'Design',
      fit_score: 92,
      reason: 'Visual design focus',
      skills: ['Visual design', 'Figma', 'Design systems'],
      relationship: 'entry_level',
    },
    {
      title: 'Product Designer',
      category: 'Design',
      fit_score: 90,
      reason: 'End-to-end design',
      skills: ['UX', 'UI', 'Product thinking'],
      relationship: 'entry_level',
    },
    {
      title: 'UX Researcher',
      category: 'Design',
      fit_score: 88,
      reason: 'Research focus',
      skills: ['User research', 'Interviews', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Interaction Designer',
      category: 'Design',
      fit_score: 85,
      reason: 'Interaction patterns',
      skills: ['Prototyping', 'Animation', 'User flows'],
      relationship: 'entry_level',
    },
    {
      title: 'Visual Designer',
      category: 'Design',
      fit_score: 82,
      reason: 'Visual assets',
      skills: ['Graphic design', 'Branding', 'Adobe Creative Suite'],
      relationship: 'entry_level',
    },
    {
      title: 'Design Systems Designer',
      category: 'Design',
      fit_score: 78,
      reason: 'System thinking',
      skills: ['Design systems', 'Documentation', 'Components'],
      relationship: 'entry_level',
    },
    {
      title: 'Content Designer',
      category: 'Design',
      fit_score: 75,
      reason: 'UX writing',
      skills: ['Writing', 'UX', 'Content strategy'],
      relationship: 'entry_level',
    },
    {
      title: 'Service Designer',
      category: 'Design',
      fit_score: 72,
      reason: 'Service design',
      skills: ['Journey mapping', 'Research', 'Strategy'],
      relationship: 'entry_level',
    },
    {
      title: 'Brand Designer',
      category: 'Design',
      fit_score: 70,
      reason: 'Brand focus',
      skills: ['Branding', 'Visual identity', 'Creative direction'],
      relationship: 'entry_level',
    },
  ],
  marketing: [
    {
      title: 'Marketing Coordinator',
      category: 'Marketing',
      fit_score: 95,
      reason: 'Direct transition',
      skills: ['Communication', 'Social media', 'Content'],
      relationship: 'entry_level',
    },
    {
      title: 'Social Media Specialist',
      category: 'Marketing',
      fit_score: 92,
      reason: 'Social focus',
      skills: ['Social media', 'Content creation', 'Analytics'],
      relationship: 'entry_level',
    },
    {
      title: 'Content Marketing Specialist',
      category: 'Marketing',
      fit_score: 90,
      reason: 'Content focus',
      skills: ['Writing', 'SEO', 'Content strategy'],
      relationship: 'entry_level',
    },
    {
      title: 'Digital Marketing Specialist',
      category: 'Marketing',
      fit_score: 88,
      reason: 'Digital channels',
      skills: ['PPC', 'Analytics', 'Email marketing'],
      relationship: 'entry_level',
    },
    {
      title: 'Marketing Analyst',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Data-driven marketing',
      skills: ['Analytics', 'Excel', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'Email Marketing Specialist',
      category: 'Marketing',
      fit_score: 82,
      reason: 'Email focus',
      skills: ['Email marketing', 'Automation', 'A/B testing'],
      relationship: 'entry_level',
    },
    {
      title: 'SEO Specialist',
      category: 'Marketing',
      fit_score: 80,
      reason: 'Search optimization',
      skills: ['SEO', 'Analytics', 'Content'],
      relationship: 'entry_level',
    },
    {
      title: 'Brand Coordinator',
      category: 'Marketing',
      fit_score: 78,
      reason: 'Brand management',
      skills: ['Branding', 'Coordination', 'Creative'],
      relationship: 'entry_level',
    },
    {
      title: 'Public Relations Coordinator',
      category: 'Communications',
      fit_score: 75,
      reason: 'PR focus',
      skills: ['Writing', 'Media relations', 'Communication'],
      relationship: 'entry_level',
    },
    {
      title: 'Growth Marketing Specialist',
      category: 'Marketing',
      fit_score: 85,
      reason: 'Growth focus',
      skills: ['Analytics', 'Experimentation', 'Acquisition'],
      relationship: 'entry_level',
    },
  ],
  finance: [
    {
      title: 'Financial Analyst',
      category: 'Finance',
      fit_score: 95,
      reason: 'Direct transition',
      skills: ['Financial analysis', 'Excel', 'Modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'Investment Banking Analyst',
      category: 'Finance',
      fit_score: 90,
      reason: 'Banking path',
      skills: ['Valuation', 'Financial modeling', 'Pitchbooks'],
      relationship: 'entry_level',
    },
    {
      title: 'Equity Research Analyst',
      category: 'Finance',
      fit_score: 88,
      reason: 'Research focus',
      skills: ['Analysis', 'Research', 'Financial modeling'],
      relationship: 'entry_level',
    },
    {
      title: 'Corporate Finance Analyst',
      category: 'Finance',
      fit_score: 92,
      reason: 'Corporate finance',
      skills: ['FP&A', 'Budgeting', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Risk Analyst',
      category: 'Finance',
      fit_score: 82,
      reason: 'Risk management',
      skills: ['Risk analysis', 'Modeling', 'Compliance'],
      relationship: 'entry_level',
    },
    {
      title: 'Credit Analyst',
      category: 'Finance',
      fit_score: 80,
      reason: 'Credit evaluation',
      skills: ['Credit analysis', 'Financial statements', 'Risk'],
      relationship: 'entry_level',
    },
    {
      title: 'Portfolio Analyst',
      category: 'Finance',
      fit_score: 78,
      reason: 'Portfolio management',
      skills: ['Investment analysis', 'Performance', 'Reporting'],
      relationship: 'entry_level',
    },
    {
      title: 'Treasury Analyst',
      category: 'Finance',
      fit_score: 75,
      reason: 'Cash management',
      skills: ['Cash flow', 'Banking', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Compliance Analyst',
      category: 'Finance',
      fit_score: 72,
      reason: 'Regulatory focus',
      skills: ['Compliance', 'Regulations', 'Risk'],
      relationship: 'entry_level',
    },
    {
      title: 'Accounting Associate',
      category: 'Finance',
      fit_score: 85,
      reason: 'Accounting focus',
      skills: ['Accounting', 'Reconciliation', 'Reporting'],
      relationship: 'entry_level',
    },
  ],
  consulting: [
    {
      title: 'Business Analyst',
      category: 'Consulting',
      fit_score: 95,
      reason: 'Entry-level consulting',
      skills: ['Analysis', 'PowerPoint', 'Problem solving'],
      relationship: 'entry_level',
    },
    {
      title: 'Associate Consultant',
      category: 'Consulting',
      fit_score: 92,
      reason: 'Consulting track',
      skills: ['Problem solving', 'Communication', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Strategy Analyst',
      category: 'Strategy',
      fit_score: 88,
      reason: 'Strategy focus',
      skills: ['Strategy', 'Analysis', 'Research'],
      relationship: 'entry_level',
    },
    {
      title: 'Management Consultant',
      category: 'Consulting',
      fit_score: 85,
      reason: 'Management consulting',
      skills: ['Problem solving', 'Client management', 'Analysis'],
      relationship: 'entry_level',
    },
    {
      title: 'Operations Consultant',
      category: 'Consulting',
      fit_score: 82,
      reason: 'Operations focus',
      skills: ['Process improvement', 'Analysis', 'Implementation'],
      relationship: 'entry_level',
    },
    {
      title: 'Technology Consultant',
      category: 'Consulting',
      fit_score: 80,
      reason: 'Tech consulting',
      skills: ['Technology', 'Problem solving', 'Implementation'],
      relationship: 'entry_level',
    },
    {
      title: 'Implementation Consultant',
      category: 'Consulting',
      fit_score: 78,
      reason: 'Implementation focus',
      skills: ['Implementation', 'Client management', 'Technical'],
      relationship: 'entry_level',
    },
    {
      title: 'Research Analyst',
      category: 'Research',
      fit_score: 80,
      reason: 'Research path',
      skills: ['Research', 'Analysis', 'Writing'],
      relationship: 'entry_level',
    },
    {
      title: 'Project Manager',
      category: 'Operations',
      fit_score: 78,
      reason: 'Project leadership',
      skills: ['Project management', 'Communication', 'Planning'],
      relationship: 'entry_level',
    },
    {
      title: 'Corporate Development Analyst',
      category: 'Finance',
      fit_score: 75,
      reason: 'M&A focus',
      skills: ['Valuation', 'Analysis', 'Due diligence'],
      relationship: 'entry_level',
    },
  ],
};

// Simple in-memory cache with TTL
const cache = new Map<string, { data: NextRole[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(
  role: string,
  column: string | undefined,
  category: string | undefined,
  skills_have: string[] | undefined,
  skills_want: string[] | undefined,
): string {
  // Include category and skills in cache key to avoid cross-contamination
  // between different user contexts (e.g., major vs internship, different skill sets)
  const skillsKey = [...(skills_have || []), ...(skills_want || [])]
    .slice(0, 5)
    .sort()
    .join(',')
    .toLowerCase();
  return `${role.toLowerCase().trim()}-${column || 'default'}-${category?.toLowerCase() || 'none'}-${skillsKey || 'noskills'}`;
}

function getFromCache(key: string): NextRole[] | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: NextRole[]): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Normalize role title for matching (strip prefixes like "Senior", "Junior", "Lead", etc.)
function normalizeRoleTitle(title: string): string {
  const prefixesToStrip = [
    'junior',
    'senior',
    'lead',
    'principal',
    'staff',
    'associate',
    'head of',
    'director of',
    'vp of',
    'chief',
    'entry-level',
    'entry level',
    'sr.',
    'sr',
    'jr.',
    'jr',
    'i',
    'ii',
    'iii',
    'iv',
    'v',
  ];

  let normalized = title.toLowerCase().trim();

  // Strip common prefixes
  for (const prefix of prefixesToStrip) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length + 1).trim();
    }
  }

  // Also strip trailing levels like "I", "II", etc.
  normalized = normalized.replace(/\s+(i|ii|iii|iv|v)$/i, '').trim();

  return normalized;
}

// Calculate similarity between two role titles
function roleSimilarity(role1: string, role2: string): number {
  const norm1 = normalizeRoleTitle(role1);
  const norm2 = normalizeRoleTitle(role2);

  // Exact match after normalization
  if (norm1 === norm2) return 1;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  // Check for word overlap
  const words1 = norm1.split(/\s+/).filter((w) => w.length > 2);
  const words2 = norm2.split(/\s+/).filter((w) => w.length > 2);

  const commonWords = words1.filter((w) => words2.some((w2) => w.includes(w2) || w2.includes(w)));
  const overlapRatio = commonWords.length / Math.max(words1.length, words2.length);

  return overlapRatio;
}

// Try to get instant results from pre-built database
function getInstantResults(
  currentRole: string,
  category: string | undefined,
  column: 'entry_level' | 'lateral' | 'promotion' | 'internship' | undefined,
  count: number,
): Omit<NextRole, 'id'>[] | null {
  const roleLower = currentRole.toLowerCase().trim();
  const roleNormalized = normalizeRoleTitle(currentRole);
  const isMajor = category?.toLowerCase().includes('major');
  const isInternship = category?.toLowerCase().includes('intern');

  // For majors requesting internships (column 1 when starting from major)
  if (isMajor && column === 'internship') {
    for (const [majorKey, roles] of Object.entries(MAJOR_INTERNSHIPS)) {
      if (roleLower.includes(majorKey) || majorKey.includes(roleLower)) {
        return roles.slice(0, count);
      }
    }
  }

  // For majors requesting entry-level jobs (column 2 when starting from major)
  if (isMajor && column === 'entry_level') {
    for (const [majorKey, roles] of Object.entries(MAJOR_ENTRY_LEVEL)) {
      if (roleLower.includes(majorKey) || majorKey.includes(roleLower)) {
        return roles.slice(0, count);
      }
    }
  }

  // For internships transitioning to entry-level jobs
  if (isInternship && column === 'entry_level') {
    for (const [internKey, roles] of Object.entries(INTERNSHIP_ENTRY_LEVEL)) {
      if (roleLower.includes(internKey) || internKey.includes(roleLower)) {
        return roles.slice(0, count);
      }
    }
  }

  // For professional roles, try the transitions database with improved matching
  // Note: ROLE_TRANSITIONS only has entry_level, lateral, promotion - not internship
  if (column && column !== 'internship') {
    // First, try exact/contains match
    for (const [roleKey, transitions] of Object.entries(ROLE_TRANSITIONS)) {
      if (roleLower.includes(roleKey) || roleKey.includes(roleLower)) {
        return transitions[column]?.slice(0, count) || null;
      }
    }

    // Second, try normalized matching (strips "Senior", "Junior", etc.)
    for (const [roleKey, transitions] of Object.entries(ROLE_TRANSITIONS)) {
      const keyNormalized = normalizeRoleTitle(roleKey);
      if (
        roleNormalized === keyNormalized ||
        roleNormalized.includes(keyNormalized) ||
        keyNormalized.includes(roleNormalized)
      ) {
        return transitions[column]?.slice(0, count) || null;
      }
    }

    // Third, try fuzzy word matching
    let bestMatch: { key: string; score: number } | null = null;
    for (const roleKey of Object.keys(ROLE_TRANSITIONS)) {
      const score = roleSimilarity(currentRole, roleKey);
      if (score >= 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { key: roleKey, score };
      }
    }

    if (bestMatch) {
      return ROLE_TRANSITIONS[bestMatch.key][column]?.slice(0, count) || null;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'career-path',
    httpMethod: 'POST',
    httpPath: '/api/career-explorer/next-roles',
  });

  const startTime = Date.now();
  log.info('Next roles request started', { event: 'request.start' });

  try {
    await requireConvexToken();

    const body = (await request.json()) as NextRolesRequest;
    const { currentRole, category, skills_have, skills_want, count: rawCount = 8, column } = body;

    // Clamp count to prevent abuse (excessive API costs, slow responses)
    const MAX_COUNT = 20;
    const count = Math.min(Math.max(1, rawCount), MAX_COUNT);

    if (!currentRole || typeof currentRole !== 'string') {
      return NextResponse.json(
        { error: 'currentRole is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(currentRole, column, category, skills_have, skills_want);
    const cachedRoles = getFromCache(cacheKey);
    if (cachedRoles) {
      log.info('Cache hit', { event: 'cache.hit', durationMs: Date.now() - startTime });
      return NextResponse.json(
        { roles: cachedRoles.slice(0, count) },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Try instant results from pre-built database
    const instantResults = getInstantResults(currentRole, category, column, count);
    if (instantResults && instantResults.length >= Math.min(count, 5)) {
      const roles: NextRole[] = instantResults.map((role, index) => ({
        ...role,
        id: `instant-${currentRole.toLowerCase().replace(/\s+/g, '-')}-${index}-${Date.now()}`,
      }));
      setCache(cacheKey, roles);
      log.info('Instant results', {
        event: 'instant.hit',
        durationMs: Date.now() - startTime,
        extra: { roleCount: roles.length },
      });
      return NextResponse.json(
        { roles },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Fall back to AI generation with optimized prompts
    if (!openai) {
      log.warn('OpenAI client not configured, returning empty roles');
      return NextResponse.json(
        { roles: [] },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const isMajor = category?.toLowerCase().includes('major');
    const isInternship = category?.toLowerCase().includes('intern');

    // Concise skills context
    const skillsContext =
      skills_have?.length || skills_want?.length
        ? ` Skills: ${[...(skills_have || []), ...(skills_want || [])].slice(0, 5).join(', ')}.`
        : '';

    // Optimized concise prompts
    let prompt: string;

    if (column === 'internship') {
      // Major students looking for internships
      prompt = `${currentRole} major student seeking internships.${skillsContext} List ${count} internship positions relevant to this major as JSON: [{"title":"","category":"","fit_score":70-95,"reason":"","skills":["","",""],"relationship":"entry_level"}]. Title should include "Intern" suffix.`;
    } else if (column === 'entry_level') {
      const context = isMajor
        ? `${currentRole} major graduate`
        : isInternship
          ? `${currentRole} intern seeking full-time`
          : `${currentRole} professional`;
      prompt = `${context}.${skillsContext} List ${count} entry-level jobs as JSON: [{"title":"","category":"","fit_score":70-95,"reason":"","skills":["","",""],"relationship":"entry_level"}]`;
    } else if (column === 'lateral') {
      prompt = `${currentRole} wants related same-level roles.${skillsContext} List ${count} lateral/pivot roles as JSON: [{"title":"","category":"","fit_score":70-95,"reason":"","skills":["","",""],"relationship":"lateral"}]`;
    } else if (column === 'promotion') {
      prompt = `${currentRole} seeking promotions.${skillsContext} List ${count} senior/leadership roles as JSON: [{"title":"","category":"","fit_score":70-95,"reason":"","skills":["","",""],"relationship":"promotion"}]`;
    } else {
      prompt = `${currentRole} career paths.${skillsContext} List ${count} mixed roles (entry/lateral/promotion) as JSON: [{"title":"","category":"","fit_score":70-95,"reason":"","skills":["","",""],"relationship":"entry_level|lateral|promotion"}]`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Career advisor. Return only valid JSON array with job recommendations. Be concise.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5, // Lower for faster, more consistent results
      max_tokens: 1000, // Reduced since we need less output
    });

    const responseText = completion.choices[0]?.message?.content || '[]';

    let parsedRoles: Omit<NextRole, 'id'>[] = [];
    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsedRoles = JSON.parse(cleanedResponse);
    } catch {
      log.error('Failed to parse AI response');
      return NextResponse.json(
        { roles: [] },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const roles: NextRole[] = parsedRoles.map((role, index) => ({
      ...role,
      id: `ai-${currentRole.toLowerCase().replace(/\s+/g, '-')}-${index}-${Date.now()}`,
    }));

    // Evaluate AI output for safety and quality (fire-and-forget, don't fail on eval errors)
    evaluate({
      tool_id: 'career-explorer-next-roles',
      input: { currentRole, category, column, skills_have, skills_want },
      output: { roles } as unknown as Record<string, unknown>,
    }).catch((evalError) => {
      log.warn('AI evaluation failed', {
        event: 'eval.error',
        errorCode: toErrorCode(evalError),
      });
    });

    // Cache results
    setCache(cacheKey, roles);

    const durationMs = Date.now() - startTime;
    log.info('AI generation completed', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { currentRole, roleCount: roles.length },
    });

    return NextResponse.json(
      { roles },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error(
      'Next roles request failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
    );

    return NextResponse.json(
      { error: 'Failed to fetch next career roles' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
