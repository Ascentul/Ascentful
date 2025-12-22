import type { ResumeData } from '@/components/resume/ResumeDocument';

// ============================================================================
// Sample Resume Data for Template Thumbnails
// Minimal but realistic data that shows all sections
// ============================================================================

export const SAMPLE_RESUME_DATA: ResumeData = {
  contactInfo: {
    name: 'Alex Johnson',
    email: 'alex@email.com',
    phone: '(555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexj',
  },
  summary:
    'Senior software engineer with 8+ years of experience building scalable web applications. Led teams of 5-10 engineers and delivered products used by millions.',
  skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'GraphQL', 'PostgreSQL', 'Docker'],
  experience: [
    {
      id: '1',
      title: 'Senior Software Engineer',
      company: 'TechCorp Inc.',
      location: 'San Francisco, CA',
      startDate: '2020-01',
      endDate: '',
      current: true,
      description:
        '• Led development of microservices architecture serving 2M+ daily users\n• Reduced API latency by 40% through caching optimizations\n• Mentored 5 junior engineers and established code review practices',
    },
    {
      id: '2',
      title: 'Software Engineer',
      company: 'StartupXYZ',
      location: 'Mountain View, CA',
      startDate: '2017-06',
      endDate: '2019-12',
      current: false,
      description:
        '• Built real-time collaboration features used by 500K+ users\n• Implemented CI/CD pipeline reducing deployment time by 60%',
    },
  ],
  education: [
    {
      id: '1',
      school: 'Stanford University',
      degree: 'B.S.',
      field: 'Computer Science',
      location: 'Stanford, CA',
      startYear: '2013',
      endYear: '2017',
      gpa: '3.8',
    },
  ],
  projects: [
    {
      id: '1',
      name: 'Open Source CLI Tool',
      role: 'Creator',
      description:
        '• Built a CLI tool with 5K+ GitHub stars\n• Used by developers at 100+ companies',
      technologies: 'Go, Docker',
      url: 'github.com/alexj/cli-tool',
    },
  ],
  achievements: [],
};

// Shorter version for smaller thumbnails
export const SAMPLE_RESUME_DATA_SHORT: ResumeData = {
  contactInfo: {
    name: 'Alex Johnson',
    email: 'alex@email.com',
    phone: '(555) 123-4567',
    location: 'San Francisco, CA',
  },
  summary:
    'Senior software engineer with 8+ years of experience building scalable web applications.',
  skills: ['React', 'TypeScript', 'Node.js', 'Python'],
  experience: [
    {
      id: '1',
      title: 'Senior Software Engineer',
      company: 'TechCorp Inc.',
      location: 'San Francisco, CA',
      startDate: '2020-01',
      endDate: '',
      current: true,
      description: '• Led development of microservices\n• Reduced API latency by 40%',
    },
  ],
  education: [
    {
      id: '1',
      school: 'Stanford University',
      degree: 'B.S.',
      field: 'Computer Science',
      location: 'Stanford, CA',
      startYear: '2013',
      endYear: '2017',
    },
  ],
  projects: [],
  achievements: [],
};
