/**
 * Converts ResumeData object to plain text format
 * Used for AI APIs that expect plain text input
 */

import type { ResumeData } from '@/components/resume/ResumeDocument';

export function resumeDataToText(data: ResumeData): string {
  const parts: string[] = [];

  // Contact Info
  if (data.contactInfo) {
    const { name, email, phone, location, linkedin, github, website } = data.contactInfo;
    if (name) parts.push(name);

    const contactDetails: string[] = [];
    if (email) contactDetails.push(email);
    if (phone) contactDetails.push(phone);
    if (location) contactDetails.push(location);
    if (contactDetails.length > 0) {
      parts.push(contactDetails.join(' | '));
    }

    const links: string[] = [];
    if (linkedin) links.push(`LinkedIn: ${linkedin}`);
    if (github) links.push(`GitHub: ${github}`);
    if (website) links.push(`Website: ${website}`);
    if (links.length > 0) {
      parts.push(links.join(' | '));
    }
  }

  // Summary
  if (data.summary) {
    parts.push('\nPROFESSIONAL SUMMARY');
    parts.push(data.summary);
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    parts.push('\nSKILLS');
    parts.push(data.skills.join(', '));
  }

  // Experience
  if (data.experience && data.experience.length > 0) {
    parts.push('\nEXPERIENCE');
    for (const exp of data.experience) {
      parts.push(`\n${exp.title} at ${exp.company}`);
      if (exp.location) parts.push(exp.location);

      const dateRange = exp.current
        ? `${exp.startDate} - Present`
        : `${exp.startDate} - ${exp.endDate}`;
      parts.push(dateRange);

      // Include summary if available (new format)
      if (exp.summary) {
        parts.push(exp.summary);
      }

      // Include key contributions if available (new format)
      if (exp.keyContributions && exp.keyContributions.length > 0) {
        for (const contribution of exp.keyContributions) {
          parts.push(`• ${contribution}`);
        }
      }

      // Include description (legacy format or additional info)
      if (exp.description) {
        // Split by newlines to handle bullet points
        const bullets = exp.description.split('\n').filter((line) => line.trim());
        for (const bullet of bullets) {
          // Add bullet if not already present
          const cleanBullet = bullet.replace(/^[\s•\-\*]+/, '').trim();
          if (cleanBullet) {
            parts.push(`• ${cleanBullet}`);
          }
        }
      }
    }
  }

  // Education
  if (data.education && data.education.length > 0) {
    parts.push('\nEDUCATION');
    for (const edu of data.education) {
      const degreeField = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
      parts.push(`\n${degreeField}`);
      parts.push(edu.school);
      if (edu.location) parts.push(edu.location);

      const year = edu.endYear || edu.startYear;
      if (year) parts.push(year);

      if (edu.gpa) parts.push(`GPA: ${edu.gpa}`);
      if (edu.honors) parts.push(edu.honors);
    }
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    parts.push('\nPROJECTS');
    for (const project of data.projects) {
      parts.push(`\n${project.name}`);
      if (project.role) parts.push(project.role);
      if (project.description) parts.push(project.description);
      if (project.technologies) parts.push(`Technologies: ${project.technologies}`);
      if (project.url) parts.push(`URL: ${project.url}`);
    }
  }

  // Achievements
  if (data.achievements && data.achievements.length > 0) {
    parts.push('\nACHIEVEMENTS');
    for (const achievement of data.achievements) {
      parts.push(`\n${achievement.title}`);
      if (achievement.date) parts.push(achievement.date);
      if (achievement.description) parts.push(achievement.description);
    }
  }

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    parts.push('\nCERTIFICATIONS');
    for (const cert of data.certifications) {
      parts.push(`\n${cert.name}`);
      if (cert.issuer) parts.push(`Issued by: ${cert.issuer}`);
      if (cert.date) parts.push(`Date: ${cert.date}`);
      if (cert.expirationDate) parts.push(`Expires: ${cert.expirationDate}`);
      if (cert.credentialId) parts.push(`Credential ID: ${cert.credentialId}`);
    }
  }

  return parts.join('\n');
}
