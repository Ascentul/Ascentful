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
  ats: ExecutiveTemplate, // 'ats' ID maps to ExecutiveTemplate
};

/**
 * Get the template component for a given template ID
 * Falls back to CleanTemplate if not found
 */
export function getTemplateComponent(
  templateId: TemplateId,
): React.ComponentType<TemplateComponentProps> {
  switch (templateId) {
    case 'clean':
      return CleanTemplate;
    case 'modern':
      return ModernTemplate;
    case 'bold':
      return BoldTemplate;
    case 'minimal':
      return MinimalTemplate;
    case 'classic':
      return ClassicTemplate;
    case 'ats':
      return ExecutiveTemplate;
    default:
      return CleanTemplate;
  }
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
