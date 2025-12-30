/**
 * AI Institution Config Module
 *
 * Manages per-institution AI assistant configuration including:
 * - Personality and behavior settings
 * - Feature flags
 * - Referral information (counseling, career centers)
 * - Knowledge documents (RAG sources)
 * - Guardrails (topic blocks, content filters)
 *
 * All mutations require university_admin role with tenant isolation.
 */

import { v } from 'convex/values';

import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireTenant } from './advisor_auth';
import { assertUniversityAccess, requireUniversityAdmin } from './lib/roles';

// ============================================================================
// CONFIG QUERIES
// ============================================================================

/**
 * Get AI config for an institution
 */
export const getConfigByInstitution = query({
  args: {
    institutionId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any institution
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const config = await ctx.db
      .query('ai_institution_config')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .first();

    return config;
  },
});

/**
 * Get AI config with all related documents and guardrails
 */
export const getFullConfig = query({
  args: {
    institutionId: v.id('universities'),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any institution
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const config = await ctx.db
      .query('ai_institution_config')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .first();

    if (!config) {
      return null;
    }

    const [documents, guardrails] = await Promise.all([
      ctx.db
        .query('ai_knowledge_documents')
        .withIndex('by_config', (q) => q.eq('config_id', config._id))
        .filter((q) => q.neq(q.field('is_active'), false))
        .collect(),
      ctx.db
        .query('ai_guardrails')
        .withIndex('by_config', (q) => q.eq('config_id', config._id))
        .filter((q) => q.neq(q.field('is_active'), false))
        .collect(),
    ]);

    return {
      config,
      documents,
      guardrails,
    };
  },
});

// ============================================================================
// CONFIG MUTATIONS
// ============================================================================

/**
 * Create or update AI config for an institution
 * Requires university_admin role
 */
export const upsertConfig = mutation({
  args: {
    institutionId: v.id('universities'),
    assistantName: v.optional(v.string()),
    personality: v.optional(
      v.union(
        v.literal('professional'),
        v.literal('friendly'),
        v.literal('encouraging'),
        v.literal('direct'),
        v.literal('custom'),
      ),
    ),
    formalityLevel: v.optional(
      v.union(v.literal('formal'), v.literal('semiformal'), v.literal('casual')),
    ),
    customPersonalityPrompt: v.optional(v.string()),
    enableSalaryAdvice: v.optional(v.boolean()),
    enableJobRecommendations: v.optional(v.boolean()),
    enableInterviewPrep: v.optional(v.boolean()),
    enableResumeCritique: v.optional(v.boolean()),
    enableNetworkingAdvice: v.optional(v.boolean()),
    counselingCenterName: v.optional(v.string()),
    counselingCenterUrl: v.optional(v.string()),
    counselingCenterPhone: v.optional(v.string()),
    careerCenterName: v.optional(v.string()),
    careerCenterUrl: v.optional(v.string()),
    careerCenterPhone: v.optional(v.string()),
    emergencyProtocol: v.optional(v.string()),
    modelPreference: v.optional(v.string()),
    maxTokensPerResponse: v.optional(v.number()),
    temperature: v.optional(v.number()),
    blockedTopics: v.optional(v.array(v.string())),
    requiredDisclaimers: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);
    assertUniversityAccess(user, args.institutionId);

    const existing = await ctx.db
      .query('ai_institution_config')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing config
      const updates: Record<string, unknown> = { updated_at: now };

      if (args.assistantName !== undefined) updates.assistant_name = args.assistantName;
      if (args.personality !== undefined) updates.personality = args.personality;
      if (args.formalityLevel !== undefined) updates.formality_level = args.formalityLevel;
      if (args.customPersonalityPrompt !== undefined)
        updates.custom_personality_prompt = args.customPersonalityPrompt;
      if (args.enableSalaryAdvice !== undefined)
        updates.enable_salary_advice = args.enableSalaryAdvice;
      if (args.enableJobRecommendations !== undefined)
        updates.enable_job_recommendations = args.enableJobRecommendations;
      if (args.enableInterviewPrep !== undefined)
        updates.enable_interview_prep = args.enableInterviewPrep;
      if (args.enableResumeCritique !== undefined)
        updates.enable_resume_critique = args.enableResumeCritique;
      if (args.enableNetworkingAdvice !== undefined)
        updates.enable_networking_advice = args.enableNetworkingAdvice;
      if (args.counselingCenterName !== undefined)
        updates.counseling_center_name = args.counselingCenterName;
      if (args.counselingCenterUrl !== undefined)
        updates.counseling_center_url = args.counselingCenterUrl;
      if (args.counselingCenterPhone !== undefined)
        updates.counseling_center_phone = args.counselingCenterPhone;
      if (args.careerCenterName !== undefined) updates.career_center_name = args.careerCenterName;
      if (args.careerCenterUrl !== undefined) updates.career_center_url = args.careerCenterUrl;
      if (args.careerCenterPhone !== undefined)
        updates.career_center_phone = args.careerCenterPhone;
      if (args.emergencyProtocol !== undefined) updates.emergency_protocol = args.emergencyProtocol;
      if (args.modelPreference !== undefined) updates.model_preference = args.modelPreference;
      if (args.maxTokensPerResponse !== undefined)
        updates.max_tokens_per_response = args.maxTokensPerResponse;
      if (args.temperature !== undefined) updates.temperature = args.temperature;
      if (args.blockedTopics !== undefined) updates.blocked_topics = args.blockedTopics;
      if (args.requiredDisclaimers !== undefined)
        updates.required_disclaimers = args.requiredDisclaimers;
      if (args.isActive !== undefined) updates.is_active = args.isActive;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new config
      const configId = await ctx.db.insert('ai_institution_config', {
        institution_id: args.institutionId,
        assistant_name: args.assistantName,
        personality: args.personality,
        formality_level: args.formalityLevel,
        custom_personality_prompt: args.customPersonalityPrompt,
        enable_salary_advice: args.enableSalaryAdvice,
        enable_job_recommendations: args.enableJobRecommendations,
        enable_interview_prep: args.enableInterviewPrep,
        enable_resume_critique: args.enableResumeCritique,
        enable_networking_advice: args.enableNetworkingAdvice,
        counseling_center_name: args.counselingCenterName,
        counseling_center_url: args.counselingCenterUrl,
        counseling_center_phone: args.counselingCenterPhone,
        career_center_name: args.careerCenterName,
        career_center_url: args.careerCenterUrl,
        career_center_phone: args.careerCenterPhone,
        emergency_protocol: args.emergencyProtocol,
        model_preference: args.modelPreference,
        max_tokens_per_response: args.maxTokensPerResponse,
        temperature: args.temperature,
        blocked_topics: args.blockedTopics,
        required_disclaimers: args.requiredDisclaimers,
        is_active: args.isActive ?? true,
        created_at: now,
        updated_at: now,
      });
      return configId;
    }
  },
});

// ============================================================================
// KNOWLEDGE DOCUMENT QUERIES
// ============================================================================

/**
 * Get knowledge documents for a config
 */
export const getKnowledgeDocuments = query({
  args: {
    configId: v.id('ai_institution_config'),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error('Config not found');
    }

    // Super admins can access any config
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (config.institution_id !== universityId) {
        throw new Error('Unauthorized: Config is not in your university');
      }
    }

    const documents = await ctx.db
      .query('ai_knowledge_documents')
      .withIndex('by_config', (q) => q.eq('config_id', args.configId))
      .collect();

    if (args.includeInactive) {
      return documents;
    }

    return documents.filter((d) => d.is_active !== false);
  },
});

/**
 * Get knowledge documents by institution
 */
export const getKnowledgeDocumentsByInstitution = query({
  args: {
    institutionId: v.id('universities'),
    documentType: v.optional(
      v.union(
        v.literal('policy'),
        v.literal('faq'),
        v.literal('resource'),
        v.literal('guideline'),
        v.literal('employer_list'),
        v.literal('alumni_network'),
        v.literal('other'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any institution
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    let query = ctx.db
      .query('ai_knowledge_documents')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId));

    const documents = await query.collect();

    let filtered = documents.filter((d) => d.is_active !== false);

    if (args.documentType) {
      filtered = filtered.filter((d) => d.document_type === args.documentType);
    }

    return filtered;
  },
});

// ============================================================================
// KNOWLEDGE DOCUMENT MUTATIONS
// ============================================================================

/**
 * Create a knowledge document
 * Requires university_admin role
 */
export const createKnowledgeDocument = mutation({
  args: {
    configId: v.id('ai_institution_config'),
    title: v.string(),
    description: v.optional(v.string()),
    documentType: v.union(
      v.literal('policy'),
      v.literal('faq'),
      v.literal('resource'),
      v.literal('guideline'),
      v.literal('employer_list'),
      v.literal('alumni_network'),
      v.literal('other'),
    ),
    fileUrl: v.optional(v.string()),
    fileStorageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error('Config not found');
    }

    assertUniversityAccess(user, config.institution_id);

    const now = Date.now();

    const documentId = await ctx.db.insert('ai_knowledge_documents', {
      config_id: args.configId,
      institution_id: config.institution_id,
      title: args.title,
      description: args.description,
      document_type: args.documentType,
      file_url: args.fileUrl,
      file_storage_id: args.fileStorageId,
      file_name: args.fileName,
      file_size: args.fileSize,
      mime_type: args.mimeType,
      content: args.content,
      is_processed: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    return documentId;
  },
});

/**
 * Update a knowledge document
 * Requires university_admin role
 */
export const updateKnowledgeDocument = mutation({
  args: {
    documentId: v.id('ai_knowledge_documents'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    documentType: v.optional(
      v.union(
        v.literal('policy'),
        v.literal('faq'),
        v.literal('resource'),
        v.literal('guideline'),
        v.literal('employer_list'),
        v.literal('alumni_network'),
        v.literal('other'),
      ),
    ),
    content: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    assertUniversityAccess(user, document.institution_id);

    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.documentType !== undefined) updates.document_type = args.documentType;
    if (args.content !== undefined) {
      updates.content = args.content;
      updates.is_processed = false; // Mark for reprocessing
    }
    if (args.isActive !== undefined) updates.is_active = args.isActive;

    await ctx.db.patch(args.documentId, updates);
    return args.documentId;
  },
});

/**
 * Delete a knowledge document (soft delete)
 * Requires university_admin role
 */
export const deleteKnowledgeDocument = mutation({
  args: {
    documentId: v.id('ai_knowledge_documents'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    assertUniversityAccess(user, document.institution_id);

    await ctx.db.patch(args.documentId, {
      is_active: false,
      updated_at: Date.now(),
    });

    return args.documentId;
  },
});

/**
 * Mark a document as processed (called after RAG indexing)
 * Internal use - requires university_admin or super_admin
 */
export const markDocumentProcessed = mutation({
  args: {
    documentId: v.id('ai_knowledge_documents'),
    embeddingId: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
    processingError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    assertUniversityAccess(user, document.institution_id);

    const now = Date.now();

    if (args.processingError) {
      await ctx.db.patch(args.documentId, {
        is_processed: false,
        processing_error: args.processingError,
        updated_at: now,
      });
    } else {
      await ctx.db.patch(args.documentId, {
        is_processed: true,
        embedding_id: args.embeddingId,
        chunk_count: args.chunkCount,
        processed_at: now,
        processing_error: undefined,
        updated_at: now,
      });
    }

    return args.documentId;
  },
});

// ============================================================================
// GUARDRAIL QUERIES
// ============================================================================

/**
 * Get guardrails for a config
 */
export const getGuardrails = query({
  args: {
    configId: v.id('ai_institution_config'),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error('Config not found');
    }

    // Super admins can access any config
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (config.institution_id !== universityId) {
        throw new Error('Unauthorized: Config is not in your university');
      }
    }

    const guardrails = await ctx.db
      .query('ai_guardrails')
      .withIndex('by_config', (q) => q.eq('config_id', args.configId))
      .collect();

    const filtered = args.includeInactive
      ? guardrails
      : guardrails.filter((g) => g.is_active !== false);

    // Sort by priority (higher priority first)
    return filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  },
});

/**
 * Get guardrails by institution
 */
export const getGuardrailsByInstitution = query({
  args: {
    institutionId: v.id('universities'),
    ruleType: v.optional(
      v.union(
        v.literal('topic_block'),
        v.literal('topic_redirect'),
        v.literal('content_filter'),
        v.literal('response_modifier'),
        v.literal('disclaimer_inject'),
        v.literal('escalation'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const sessionCtx = await getCurrentUser(ctx);

    // Super admins can access any institution
    if (sessionCtx.role !== 'super_admin') {
      const universityId = requireTenant(sessionCtx);
      if (universityId !== args.institutionId) {
        throw new Error('Unauthorized: Different university');
      }
    }

    const guardrails = await ctx.db
      .query('ai_guardrails')
      .withIndex('by_institution', (q) => q.eq('institution_id', args.institutionId))
      .collect();

    let filtered = guardrails.filter((g) => g.is_active !== false);

    if (args.ruleType) {
      filtered = filtered.filter((g) => g.rule_type === args.ruleType);
    }

    // Sort by priority (higher priority first)
    return filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  },
});

// ============================================================================
// GUARDRAIL MUTATIONS
// ============================================================================

/**
 * Create a guardrail
 * Requires university_admin role
 */
export const createGuardrail = mutation({
  args: {
    configId: v.id('ai_institution_config'),
    name: v.string(),
    description: v.optional(v.string()),
    ruleType: v.union(
      v.literal('topic_block'),
      v.literal('topic_redirect'),
      v.literal('content_filter'),
      v.literal('response_modifier'),
      v.literal('disclaimer_inject'),
      v.literal('escalation'),
    ),
    condition: v.optional(v.any()),
    action: v.optional(v.any()),
    customResponse: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    priority: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error('Config not found');
    }

    assertUniversityAccess(user, config.institution_id);

    const now = Date.now();

    const guardrailId = await ctx.db.insert('ai_guardrails', {
      config_id: args.configId,
      institution_id: config.institution_id,
      name: args.name,
      description: args.description,
      rule_type: args.ruleType,
      condition: args.condition,
      action: args.action,
      custom_response: args.customResponse,
      redirect_url: args.redirectUrl,
      priority: args.priority ?? 0,
      is_active: true,
      is_default: args.isDefault ?? false,
      created_by: user._id,
      created_at: now,
      updated_at: now,
    });

    return guardrailId;
  },
});

/**
 * Update a guardrail
 * Requires university_admin role
 */
export const updateGuardrail = mutation({
  args: {
    guardrailId: v.id('ai_guardrails'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    ruleType: v.optional(
      v.union(
        v.literal('topic_block'),
        v.literal('topic_redirect'),
        v.literal('content_filter'),
        v.literal('response_modifier'),
        v.literal('disclaimer_inject'),
        v.literal('escalation'),
      ),
    ),
    condition: v.optional(v.any()),
    action: v.optional(v.any()),
    customResponse: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    priority: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const guardrail = await ctx.db.get(args.guardrailId);
    if (!guardrail) {
      throw new Error('Guardrail not found');
    }

    assertUniversityAccess(user, guardrail.institution_id);

    const updates: Record<string, unknown> = { updated_at: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.ruleType !== undefined) updates.rule_type = args.ruleType;
    if (args.condition !== undefined) updates.condition = args.condition;
    if (args.action !== undefined) updates.action = args.action;
    if (args.customResponse !== undefined) updates.custom_response = args.customResponse;
    if (args.redirectUrl !== undefined) updates.redirect_url = args.redirectUrl;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.isActive !== undefined) updates.is_active = args.isActive;
    if (args.isDefault !== undefined) updates.is_default = args.isDefault;

    await ctx.db.patch(args.guardrailId, updates);
    return args.guardrailId;
  },
});

/**
 * Delete a guardrail (soft delete)
 * Requires university_admin role
 */
export const deleteGuardrail = mutation({
  args: {
    guardrailId: v.id('ai_guardrails'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const guardrail = await ctx.db.get(args.guardrailId);
    if (!guardrail) {
      throw new Error('Guardrail not found');
    }

    assertUniversityAccess(user, guardrail.institution_id);

    await ctx.db.patch(args.guardrailId, {
      is_active: false,
      updated_at: Date.now(),
    });

    return args.guardrailId;
  },
});

/**
 * Create default guardrails for an institution
 * Called when first setting up AI config
 */
export const createDefaultGuardrails = mutation({
  args: {
    configId: v.id('ai_institution_config'),
  },
  handler: async (ctx, args) => {
    const user = await requireUniversityAdmin(ctx);

    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error('Config not found');
    }

    assertUniversityAccess(user, config.institution_id);

    const now = Date.now();
    const createdIds: Id<'ai_guardrails'>[] = [];

    // Default guardrails
    const defaults = [
      {
        name: 'Mental Health Escalation',
        description: 'Detect and respond to mental health concerns with appropriate referrals',
        rule_type: 'escalation' as const,
        condition: {
          keywords: ['depressed', 'anxiety', 'suicidal', 'self-harm', 'overwhelmed', 'hopeless'],
        },
        custom_response:
          "I notice you may be going through a difficult time. Your well-being matters. Please consider reaching out to your institution's counseling services for support.",
        priority: 100,
        is_default: true,
      },
      {
        name: 'Academic Integrity',
        description: 'Redirect requests that may violate academic integrity policies',
        rule_type: 'topic_redirect' as const,
        condition: {
          keywords: ['write my essay', 'do my homework', 'complete my assignment', 'cheat'],
        },
        custom_response:
          "I'm designed to help you develop your own skills rather than complete assignments for you. I'd be happy to help you understand concepts, review your work, or discuss study strategies instead.",
        priority: 90,
        is_default: true,
      },
      {
        name: 'Career Advice Disclaimer',
        description: 'Add disclaimer to salary and career advice',
        rule_type: 'disclaimer_inject' as const,
        condition: {
          topics: ['salary', 'compensation', 'career_advice'],
        },
        action: {
          disclaimer:
            'Note: Career and salary information is for general guidance only. Actual outcomes may vary based on many factors including location, experience, and market conditions.',
        },
        priority: 50,
        is_default: true,
      },
    ];

    for (const guardrail of defaults) {
      const id = await ctx.db.insert('ai_guardrails', {
        config_id: args.configId,
        institution_id: config.institution_id,
        name: guardrail.name,
        description: guardrail.description,
        rule_type: guardrail.rule_type,
        condition: guardrail.condition,
        action: guardrail.action,
        custom_response: guardrail.custom_response,
        priority: guardrail.priority,
        is_active: true,
        is_default: guardrail.is_default,
        created_by: user._id,
        created_at: now,
        updated_at: now,
      });
      createdIds.push(id);
    }

    return createdIds;
  },
});
