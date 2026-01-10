/**
 * Converts optimized resume response from /api/resumes/optimize
 * back to ResumeData format for the resume builder canvas
 */

import type {
  Achievement,
  Certification,
  ContactInfo,
  Education,
  Experience,
  Project,
  ResumeData,
} from '@/components/resume/ResumeDocument';

// Types for the optimize API response
interface OptimizedPersonalInfo {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
}

interface OptimizedExperience {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  summary?: string;
  keyContributions?: string[];
}

interface OptimizedEducation {
  degree: string;
  school: string;
  graduationYear?: string;
}

interface OptimizedProject {
  title: string;
  role?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  technologies?: string[];
  url?: string;
  github_url?: string;
}

interface OptimizedAchievement {
  title: string;
  organization?: string;
  date?: string;
  description?: string;
}

export interface OptimizedResumeResponse {
  personalInfo?: OptimizedPersonalInfo;
  summary?: string;
  skills?: string[];
  experience?: OptimizedExperience[];
  education?: OptimizedEducation[];
  projects?: OptimizedProject[];
  achievements?: OptimizedAchievement[];
}

/**
 * Generate a unique ID for new items
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Convert optimized resume response to ResumeData format
 * Preserves existing IDs when merging with original data
 */
export function optimizedToResumeData(
  optimized: OptimizedResumeResponse,
  originalData?: ResumeData,
): ResumeData {
  // Contact Info
  const contactInfo: ContactInfo = {
    name: optimized.personalInfo?.name || originalData?.contactInfo?.name || '',
    email: optimized.personalInfo?.email || originalData?.contactInfo?.email || '',
    phone: optimized.personalInfo?.phone || originalData?.contactInfo?.phone || '',
    location: optimized.personalInfo?.location || originalData?.contactInfo?.location || '',
    linkedin: optimized.personalInfo?.linkedin || originalData?.contactInfo?.linkedin,
    github: optimized.personalInfo?.github || originalData?.contactInfo?.github,
    website: originalData?.contactInfo?.website, // Preserve website from original
    photoUrl: originalData?.contactInfo?.photoUrl, // Preserve photo
    country: originalData?.contactInfo?.country,
    postalCode: originalData?.contactInfo?.postalCode,
  };

  // Summary
  const summary = optimized.summary || originalData?.summary;

  // Skills
  const skills = optimized.skills || originalData?.skills;

  // Experience - try to match with original by title+company to preserve IDs
  const experience: Experience[] = (optimized.experience || []).map((exp, index) => {
    // Try to find matching original experience entry
    const originalExp = originalData?.experience?.find(
      (orig) =>
        orig.title.toLowerCase() === exp.title.toLowerCase() &&
        orig.company.toLowerCase() === exp.company.toLowerCase(),
    );

    // Build description from summary and keyContributions
    // Format: summary paragraph, blank line, then bulleted accomplishments
    const parts: string[] = [];
    if (exp.summary?.trim()) {
      parts.push(exp.summary.trim());
    }
    if (exp.keyContributions && exp.keyContributions.length > 0) {
      if (parts.length > 0) parts.push(''); // Blank line between summary and bullets
      exp.keyContributions.forEach((c) => {
        const cleaned = c.replace(/^[\s•\-\*]+/, '').trim();
        if (cleaned) {
          parts.push(`• ${cleaned}`);
        }
      });
    }
    const description = parts.join('\n');

    return {
      id: originalExp?.id || generateId(),
      title: exp.title,
      company: exp.company,
      location: originalExp?.location || '',
      startDate: exp.startDate,
      endDate: exp.endDate?.toLowerCase() === 'present' ? '' : exp.endDate || '',
      current: exp.endDate?.toLowerCase() === 'present',
      description,
      summary: exp.summary,
      keyContributions: exp.keyContributions?.map((c) => c.replace(/^[\s•\-\*]+/, '').trim()),
    };
  });

  // Education - try to match by degree+school
  const education: Education[] = (optimized.education || []).map((edu) => {
    const originalEdu = originalData?.education?.find(
      (orig) =>
        orig.degree.toLowerCase() === edu.degree.toLowerCase() &&
        orig.school.toLowerCase() === edu.school.toLowerCase(),
    );

    return {
      id: originalEdu?.id || generateId(),
      school: edu.school,
      degree: edu.degree,
      field: originalEdu?.field || '',
      location: originalEdu?.location || '',
      startYear: originalEdu?.startYear || '',
      endYear: edu.graduationYear || originalEdu?.endYear || '',
      gpa: originalEdu?.gpa,
      honors: originalEdu?.honors,
    };
  });

  // Projects - try to match by title
  const projects: Project[] | undefined = optimized.projects
    ? optimized.projects.map((proj) => {
        const originalProj = originalData?.projects?.find(
          (orig) => orig.name.toLowerCase() === proj.title.toLowerCase(),
        );

        return {
          id: originalProj?.id || generateId(),
          name: proj.title,
          role: proj.role || originalProj?.role || '',
          description: proj.description || originalProj?.description || '',
          technologies: Array.isArray(proj.technologies)
            ? proj.technologies.join(', ')
            : originalProj?.technologies || '',
          url: proj.url || proj.github_url || originalProj?.url,
        };
      })
    : originalData?.projects;

  // Achievements
  const achievements: Achievement[] | undefined = optimized.achievements
    ? optimized.achievements.map((ach) => {
        const originalAch = originalData?.achievements?.find(
          (orig) => orig.title.toLowerCase() === ach.title.toLowerCase(),
        );

        return {
          id: originalAch?.id || generateId(),
          title: ach.title,
          description: ach.description || originalAch?.description || '',
          date: ach.date || originalAch?.date || '',
        };
      })
    : originalData?.achievements;

  // Preserve certifications from original (optimize API doesn't return them)
  const certifications: Certification[] | undefined = originalData?.certifications;

  return {
    contactInfo,
    summary,
    skills,
    experience,
    education,
    projects,
    achievements,
    certifications,
  };
}

/**
 * Compute a diff between original and optimized resume data
 * Returns sections that have changed
 */
export interface ResumeDiff {
  summaryChanged: boolean;
  skillsChanged: boolean;
  experienceChanged: number[]; // Indices of changed experience entries
  educationChanged: number[]; // Indices of changed education entries
  projectsChanged: number[];
  achievementsChanged: number[];
}

export function computeResumeDiff(original: ResumeData, optimized: ResumeData): ResumeDiff {
  const diff: ResumeDiff = {
    summaryChanged: false,
    skillsChanged: false,
    experienceChanged: [],
    educationChanged: [],
    projectsChanged: [],
    achievementsChanged: [],
  };

  // Check summary
  diff.summaryChanged = (original.summary || '') !== (optimized.summary || '');

  // Check skills
  const origSkills = (original.skills || []).join(',');
  const optSkills = (optimized.skills || []).join(',');
  diff.skillsChanged = origSkills !== optSkills;

  // Check experience
  const origExp = original.experience || [];
  const optExp = optimized.experience || [];
  for (let i = 0; i < Math.max(origExp.length, optExp.length); i++) {
    const orig = origExp[i];
    const opt = optExp[i];
    if (!orig || !opt) {
      diff.experienceChanged.push(i);
    } else if (
      orig.title !== opt.title ||
      orig.company !== opt.company ||
      orig.location !== opt.location ||
      orig.startDate !== opt.startDate ||
      orig.endDate !== opt.endDate ||
      orig.current !== opt.current ||
      orig.description !== opt.description ||
      orig.summary !== opt.summary ||
      JSON.stringify(orig.keyContributions) !== JSON.stringify(opt.keyContributions)
    ) {
      diff.experienceChanged.push(i);
    }
  }

  // Check education
  const origEdu = original.education || [];
  const optEdu = optimized.education || [];
  for (let i = 0; i < Math.max(origEdu.length, optEdu.length); i++) {
    const orig = origEdu[i];
    const opt = optEdu[i];
    if (!orig || !opt) {
      diff.educationChanged.push(i);
    } else if (
      orig.school !== opt.school ||
      orig.degree !== opt.degree ||
      orig.field !== opt.field ||
      orig.location !== opt.location ||
      orig.startYear !== opt.startYear ||
      orig.endYear !== opt.endYear ||
      orig.gpa !== opt.gpa ||
      orig.honors !== opt.honors
    ) {
      diff.educationChanged.push(i);
    }
  }

  // Check projects
  const origProj = original.projects || [];
  const optProj = optimized.projects || [];
  for (let i = 0; i < Math.max(origProj.length, optProj.length); i++) {
    const orig = origProj[i];
    const opt = optProj[i];
    if (
      !orig ||
      !opt ||
      orig.name !== opt.name ||
      orig.role !== opt.role ||
      orig.description !== opt.description ||
      orig.technologies !== opt.technologies ||
      orig.url !== opt.url
    ) {
      diff.projectsChanged.push(i);
    }
  }

  // Check achievements
  const origAch = original.achievements || [];
  const optAch = optimized.achievements || [];
  for (let i = 0; i < Math.max(origAch.length, optAch.length); i++) {
    const orig = origAch[i];
    const opt = optAch[i];
    if (
      !orig ||
      !opt ||
      orig.title !== opt.title ||
      orig.description !== opt.description ||
      orig.date !== opt.date
    ) {
      diff.achievementsChanged.push(i);
    }
  }

  return diff;
}
