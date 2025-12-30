import React from 'react';

import type { ResumeData } from '@/components/resume/ResumeDocument';

import {
  BoldTemplate,
  ClassicTemplate,
  CleanTemplate,
  ExecutiveTemplate,
  MinimalTemplate,
  ModernTemplate,
} from './layouts';
import type { StyleConfig, TemplateId } from './types';

// ============================================================================
// Template Registry
// Central registry for all template components
// ============================================================================

export interface TemplateComponentProps {
  data: ResumeData;
  styleConfig?: StyleConfig;
  className?: string;
}

// Map of template IDs to their components
export const TEMPLATE_COMPONENTS: Record<
  TemplateId,
  React.ComponentType<TemplateComponentProps>
> = {
  clean: CleanTemplate,
  modern: ModernTemplate,
  bold: BoldTemplate,
  minimal: MinimalTemplate,
  classic: ClassicTemplate,
  // 'ats' uses ExecutiveTemplate: a two-column sidebar layout optimized for ATS parsers.
  // The template prioritizes machine readability with clean section hierarchy, standard
  // headings, and no complex formatting that could confuse applicant tracking systems.
  ats: ExecutiveTemplate,
  // 'executive' also uses ExecutiveTemplate for a professional corporate look
  executive: ExecutiveTemplate,
};

/**
 * Get the template component for a given template ID
 * Falls back to CleanTemplate if not found
 */
export function getTemplateComponent(
  templateId: TemplateId,
): React.ComponentType<TemplateComponentProps> {
  return TEMPLATE_COMPONENTS[templateId] ?? CleanTemplate;
}

/**
 * Render a template with given data
 * Utility function for programmatic rendering
 */
export function renderTemplate(
  templateId: TemplateId,
  data: ResumeData,
  styleConfig?: StyleConfig,
  className?: string,
): React.ReactElement {
  const TemplateComponent = getTemplateComponent(templateId);
  return React.createElement(TemplateComponent, { data, styleConfig, className });
}

/**
 * Get all available template IDs
 */
export function getAvailableTemplateIds(): TemplateId[] {
  return Object.keys(TEMPLATE_COMPONENTS) as TemplateId[];
}
