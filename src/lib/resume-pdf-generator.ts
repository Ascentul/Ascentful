/**
 * Resume PDF Generator
 *
 * Generates PDF exports that visually match the ResumeDocument component.
 *
 * IMPORTANT: This file mirrors the layout and styling from
 * src/components/resume/ResumeDocument.tsx
 *
 * When updating resume styling, make changes in BOTH files to ensure
 * preview and export remain identical.
 *
 * Design principles:
 * - Brand-aligned: Uses #5371FF as primary accent color
 * - Professional: Clean typography, comfortable spacing
 * - ATS-friendly: Simple structure, standard fonts
 */

import jsPDF from 'jspdf';

import type { ResumeData } from '@/components/resume/ResumeDocument';
import { formatDateRange, parseDescription } from '@/lib/resume-utils';

// Color constants (brand-aligned, matching ResumeDocument)
const COLORS = {
  PRIMARY_ACCENT: '#5371FF',
  BLACK: '#000000',
  DARK_GRAY: '#2D3748',
  GRAY: '#4A5568',
  LIGHT_GRAY: '#718096',
  SUBTLE_ACCENT: 'rgba(83, 113, 255, 0.3)',
};

// Convert hex to RGB for jsPDF
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

// Typography constants (matching ResumeDocument)
const FONT_SIZE = {
  NAME: 20,
  SECTION_HEADING: 13,
  COMPANY: 12,
  BODY: 11,
  SMALL: 10,
};

const LINE_HEIGHT = {
  HEADER: 1.2,
  BODY: 1.3,
};

// Layout constants (0.7in margins = ~18mm)
const MARGIN = {
  TOP: 18,
  RIGHT: 18,
  BOTTOM: 18,
  LEFT: 18,
};

const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.LEFT - MARGIN.RIGHT;

// Spacing scale (in mm, matching px scale from ResumeDocument)
const SPACING = {
  xs: 1.5, // ~4px
  sm: 3, // ~8px
  md: 4.5, // ~12px
  lg: 6, // ~16px
  xl: 9, // ~24px
};

/**
 * Add text with automatic word wrapping
 */
function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/**
 * Add a section heading with brand accent color and subtle underline
 */
function addSectionHeading(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE.SECTION_HEADING);

  // Set color to primary accent
  const [r, g, b] = hexToRgb(COLORS.PRIMARY_ACCENT);
  doc.setTextColor(r, g, b);
  doc.text(title.toUpperCase(), MARGIN.LEFT, y);

  // Add subtle underline
  const [ur, ug, ub] = [83, 113, 255]; // #5371FF with 30% opacity approximation
  doc.setDrawColor(ur, ug, ub);
  doc.setLineWidth(0.3);
  doc.line(MARGIN.LEFT, y + 1.5, PAGE_WIDTH - MARGIN.RIGHT, y + 1.5);

  return y + SPACING.sm + SPACING.xs; // 8mm spacing after heading
}

/**
 * Check if we need a new page and add one if necessary
 */
function checkPageBreak(doc: jsPDF, currentY: number, spaceNeeded: number): number {
  if (currentY + spaceNeeded > PAGE_HEIGHT - MARGIN.BOTTOM) {
    doc.addPage();
    return MARGIN.TOP;
  }
  return currentY;
}

/**
 * Generate PDF from resume data
 */
export async function generateResumePDF(
  data: ResumeData,
  filename: string = 'resume.pdf',
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let yPos = MARGIN.TOP;

  // ==================== HEADER STRIP ====================
  // Add padding top
  yPos += SPACING.sm; // 3mm padding top

  // Name (centered, bold, 20pt)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZE.NAME);
  const [nameR, nameG, nameB] = hexToRgb(COLORS.BLACK);
  doc.setTextColor(nameR, nameG, nameB);
  const nameWidth = doc.getTextWidth(data.contactInfo.name);
  const nameX = (PAGE_WIDTH - nameWidth) / 2;
  doc.text(data.contactInfo.name, nameX, yPos);
  yPos += SPACING.sm; // 3mm spacing to contact line

  // Contact info (centered, light gray, 10pt)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE.SMALL);
  const [contactR, contactG, contactB] = hexToRgb(COLORS.LIGHT_GRAY);
  doc.setTextColor(contactR, contactG, contactB);

  const contactParts = [
    data.contactInfo.location,
    data.contactInfo.phone,
    data.contactInfo.email,
    data.contactInfo.linkedin,
    data.contactInfo.website,
  ].filter(Boolean);

  const contactLine = contactParts.join(' · ');
  const contactWidth = doc.getTextWidth(contactLine);
  const contactX = (PAGE_WIDTH - contactWidth) / 2;
  doc.text(contactLine, contactX, yPos);
  yPos += SPACING.md; // 4.5mm padding to border

  // Add header bottom border (brand accent)
  const [borderR, borderG, borderB] = hexToRgb(COLORS.PRIMARY_ACCENT);
  doc.setDrawColor(borderR, borderG, borderB);
  doc.setLineWidth(0.3);
  doc.line(MARGIN.LEFT, yPos, PAGE_WIDTH - MARGIN.RIGHT, yPos);
  yPos += SPACING.xl; // 9mm spacing after header

  // ==================== SUMMARY ====================
  if (data.summary && data.summary.trim()) {
    yPos = checkPageBreak(doc, yPos, 20);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Professional Summary', yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE.BODY);
    const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
    doc.setTextColor(textR, textG, textB);
    yPos = addWrappedText(doc, data.summary, MARGIN.LEFT, yPos, CONTENT_WIDTH, 4.5);
    yPos += SPACING.md; // Section spacing
  }

  // ==================== SKILLS ====================
  if (data.skills && data.skills.length > 0) {
    yPos = checkPageBreak(doc, yPos, 20);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Skills', yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE.BODY);
    const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
    doc.setTextColor(textR, textG, textB);

    const skillsText = data.skills.join(', ');
    yPos = addWrappedText(doc, skillsText, MARGIN.LEFT, yPos, CONTENT_WIDTH, 4.5);
    yPos += SPACING.md; // Section spacing
  }

  // ==================== EXPERIENCE ====================
  if (data.experience && data.experience.length > 0) {
    yPos = checkPageBreak(doc, yPos, 30);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Experience', yPos);

    data.experience.forEach((exp, index) => {
      if (index > 0) yPos += SPACING.md; // 4.5mm between entries

      // Check if we need space for this entry
      yPos = checkPageBreak(doc, yPos, 30);

      // Company name (bold, 12pt, black) and location (small, light gray)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZE.COMPANY);
      const [blackR, blackG, blackB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(blackR, blackG, blackB);
      doc.text(exp.company, MARGIN.LEFT, yPos);

      // Location (inline, after company with small gap)
      if (exp.location) {
        const companyWidth = doc.getTextWidth(exp.company);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(exp.location, MARGIN.LEFT + companyWidth + 3, yPos); // 3mm gap
      }

      // Date range (right-aligned, small, light gray)
      const dateText = formatDateRange(exp.startDate, exp.endDate, exp.current);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE.SMALL);
      const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
      doc.setTextColor(grayR, grayG, grayB);
      const dateWidth = doc.getTextWidth(dateText);
      doc.text(dateText, PAGE_WIDTH - MARGIN.RIGHT - dateWidth, yPos);

      yPos += SPACING.xs + 1; // ~4mm spacing

      // Role (semi-bold, 11pt, gray)
      doc.setFont('helvetica', 'bold'); // jsPDF doesn't have semi-bold, use bold
      doc.setFontSize(FONT_SIZE.BODY);
      const [roleR, roleG, roleB] = hexToRgb(COLORS.GRAY);
      doc.setTextColor(roleR, roleG, roleB);
      doc.text(exp.title, MARGIN.LEFT, yPos);
      yPos += SPACING.xs + 1; // ~4mm spacing

      // Summary paragraph (if using new format)
      if ((exp as any).summary) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.BODY);
        const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
        doc.setTextColor(textR, textG, textB);
        yPos = addWrappedText(doc, (exp as any).summary, MARGIN.LEFT, yPos, CONTENT_WIDTH, 4.5);
        yPos += SPACING.xs; // Small spacing after summary
      }

      // Key Contributions (if using new format)
      if (
        (exp as any).keyContributions &&
        Array.isArray((exp as any).keyContributions) &&
        (exp as any).keyContributions.length > 0
      ) {
        // "Key Contributions" heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [headingR, headingG, headingB] = hexToRgb(COLORS.DARK_GRAY);
        doc.setTextColor(headingR, headingG, headingB);
        doc.text('Key Contributions', MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1; // ~4mm spacing

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.BODY);
        const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
        doc.setTextColor(textR, textG, textB);

        (exp as any).keyContributions.forEach((contribution: string) => {
          yPos = checkPageBreak(doc, yPos, 10);

          // Bullet point
          doc.text('•', MARGIN.LEFT + 2, yPos);

          // Bullet text with wrapping (paddingLeft: 20px = ~7mm)
          const bulletLines = doc.splitTextToSize(contribution, CONTENT_WIDTH - 7);
          doc.text(bulletLines, MARGIN.LEFT + 7, yPos);
          yPos += bulletLines.length * 4.3; // Line height 1.3 * font size ~11pt
        });
      }

      // Description bullets (fallback for old format)
      if (!(exp as any).summary && !(exp as any).keyContributions && exp.description) {
        const bullets = parseDescription(exp.description);
        if (bullets.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(FONT_SIZE.BODY);
          const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
          doc.setTextColor(textR, textG, textB);

          bullets.forEach((bullet) => {
            yPos = checkPageBreak(doc, yPos, 10);

            // Bullet point
            doc.text('•', MARGIN.LEFT + 2, yPos);

            // Bullet text with wrapping (paddingLeft: 20px = ~7mm)
            const bulletLines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 7);
            doc.text(bulletLines, MARGIN.LEFT + 7, yPos);
            yPos += bulletLines.length * 4.3; // Line height 1.3 * font size ~11pt
          });
        }
      }
    });

    yPos += SPACING.md; // Section spacing
  }

  // ==================== EDUCATION ====================
  if (data.education && data.education.length > 0) {
    yPos = checkPageBreak(doc, yPos, 25);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Education', yPos);

    data.education.forEach((edu, index) => {
      if (index > 0) yPos += SPACING.md; // 4.5mm between entries

      yPos = checkPageBreak(doc, yPos, 20);

      // School name (bold, 12pt, black)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZE.COMPANY);
      const [blackR, blackG, blackB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(blackR, blackG, blackB);
      doc.text(edu.school, MARGIN.LEFT, yPos);

      // Dates (right-aligned, small, light gray)
      if (edu.startYear && edu.endYear) {
        const dateText = `${edu.startYear} - ${edu.endYear}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        const dateWidth = doc.getTextWidth(dateText);
        doc.text(dateText, PAGE_WIDTH - MARGIN.RIGHT - dateWidth, yPos);
      }

      yPos += SPACING.xs + 1; // ~4mm spacing

      // Degree and field
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE.BODY);
      const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(textR, textG, textB);

      const degreeText =
        edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || '';

      if (degreeText) {
        doc.text(degreeText, MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1;
      }

      // Location
      if (edu.location) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(edu.location, MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1;
      }

      // GPA and honors
      if (edu.gpa || edu.honors) {
        const extraInfo = [edu.gpa && `GPA: ${edu.gpa}`, edu.honors].filter(Boolean).join(' · ');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(extraInfo, MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1;
      }
    });

    yPos += SPACING.md; // Section spacing
  }

  // ==================== PROJECTS ====================
  if (data.projects && data.projects.length > 0) {
    yPos = checkPageBreak(doc, yPos, 25);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Projects', yPos);

    data.projects.forEach((project, index) => {
      if (index > 0) yPos += SPACING.md; // 4.5mm between entries

      yPos = checkPageBreak(doc, yPos, 25);

      // Project name (bold, 12pt, black)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZE.COMPANY);
      const [blackR, blackG, blackB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(blackR, blackG, blackB);
      doc.text(project.name, MARGIN.LEFT, yPos);

      // Role (italic, small, gray, inline)
      if (project.role) {
        const nameWidth = doc.getTextWidth(project.name);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(project.role, MARGIN.LEFT + nameWidth + 3, yPos); // 3mm gap
      }

      yPos += SPACING.xs + 1; // ~4mm spacing

      // Technologies
      if (project.technologies) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(`Technologies: ${project.technologies}`, MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1;
      }

      // URL (brand accent color)
      if (project.url) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [accentR, accentG, accentB] = hexToRgb(COLORS.PRIMARY_ACCENT);
        doc.setTextColor(accentR, accentG, accentB);
        doc.text(project.url, MARGIN.LEFT, yPos);
        yPos += SPACING.xs + 1;
      }

      // Description bullets
      const bullets = parseDescription(project.description);
      if (bullets.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.BODY);
        const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
        doc.setTextColor(textR, textG, textB);

        bullets.forEach((bullet) => {
          yPos = checkPageBreak(doc, yPos, 10);

          doc.text('•', MARGIN.LEFT + 2, yPos);
          const bulletLines = doc.splitTextToSize(bullet, CONTENT_WIDTH - 7);
          doc.text(bulletLines, MARGIN.LEFT + 7, yPos);
          yPos += bulletLines.length * 4.3;
        });
      }
    });

    yPos += SPACING.md; // Section spacing
  }

  // ==================== ACHIEVEMENTS ====================
  if (data.achievements && data.achievements.length > 0) {
    yPos = checkPageBreak(doc, yPos, 25);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Achievements', yPos);

    data.achievements.forEach((achievement) => {
      yPos = checkPageBreak(doc, yPos, 15);

      // Bullet point
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE.BODY);
      const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(textR, textG, textB);
      doc.text('•', MARGIN.LEFT + 2, yPos);

      // Title (semi-bold/bold)
      doc.setFont('helvetica', 'bold');
      const titleText = achievement.title;
      doc.text(titleText, MARGIN.LEFT + 7, yPos);

      // Date (if provided, light gray)
      if (achievement.date) {
        const titleWidth = doc.getTextWidth(titleText);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        doc.text(`(${achievement.date})`, MARGIN.LEFT + 7 + titleWidth + 2, yPos);
      }

      yPos += SPACING.xs + 1; // ~4mm spacing

      // Description
      if (achievement.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.BODY);
        const [textR, textG, textB] = hexToRgb(COLORS.BLACK);
        doc.setTextColor(textR, textG, textB);
        const descLines = doc.splitTextToSize(achievement.description, CONTENT_WIDTH - 7);
        doc.text(descLines, MARGIN.LEFT + 7, yPos);
        yPos += descLines.length * 4.3 + SPACING.sm; // 3mm extra spacing between achievements
      } else {
        yPos += SPACING.sm; // 3mm spacing if no description
      }
    });

    yPos += SPACING.md; // Section spacing
  }

  // ==================== CERTIFICATIONS ====================
  if (data.certifications && data.certifications.length > 0) {
    yPos = checkPageBreak(doc, yPos, 25);
    yPos += SPACING.lg; // 6mm margin top for section
    yPos = addSectionHeading(doc, 'Certifications', yPos);

    data.certifications.forEach((cert, index) => {
      if (index > 0) yPos += SPACING.md; // 4.5mm between entries

      yPos = checkPageBreak(doc, yPos, 20);

      // Certification name (bold, 12pt, black)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZE.COMPANY);
      const [blackR, blackG, blackB] = hexToRgb(COLORS.BLACK);
      doc.setTextColor(blackR, blackG, blackB);
      doc.text(cert.name, MARGIN.LEFT, yPos);

      // Date and expiration (right-aligned, small, light gray)
      const dateText = cert.expirationDate ? `${cert.date} - ${cert.expirationDate}` : cert.date;
      if (dateText) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [grayR, grayG, grayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(grayR, grayG, grayB);
        const dateWidth = doc.getTextWidth(dateText);
        doc.text(dateText, PAGE_WIDTH - MARGIN.RIGHT - dateWidth, yPos);
      }

      yPos += SPACING.xs + 1; // ~4mm spacing

      // Issuer (normal, 11pt, gray)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE.BODY);
      const [grayR, grayG, grayB] = hexToRgb(COLORS.GRAY);
      doc.setTextColor(grayR, grayG, grayB);
      doc.text(cert.issuer, MARGIN.LEFT, yPos);
      yPos += SPACING.xs + 1;

      // Credential ID and URL
      if (cert.credentialId || cert.url) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_SIZE.SMALL);
        const [lightGrayR, lightGrayG, lightGrayB] = hexToRgb(COLORS.LIGHT_GRAY);
        doc.setTextColor(lightGrayR, lightGrayG, lightGrayB);

        let credentialLine = '';
        if (cert.credentialId) {
          credentialLine = `Credential ID: ${cert.credentialId}`;
        }

        if (credentialLine) {
          doc.text(credentialLine, MARGIN.LEFT, yPos);
        }

        // URL (brand accent color)
        if (cert.url) {
          const credentialWidth = credentialLine ? doc.getTextWidth(credentialLine + ' · ') : 0;
          const [accentR, accentG, accentB] = hexToRgb(COLORS.PRIMARY_ACCENT);
          doc.setTextColor(accentR, accentG, accentB);

          if (credentialLine) {
            doc.setTextColor(lightGrayR, lightGrayG, lightGrayB);
            doc.text(' · ', MARGIN.LEFT + doc.getTextWidth(credentialLine), yPos);
            doc.setTextColor(accentR, accentG, accentB);
          }

          doc.text('View Certificate', MARGIN.LEFT + credentialWidth, yPos);
        }

        yPos += SPACING.xs + 1;
      }
    });
  }

  // Save the PDF
  doc.save(filename);
}
