// AI client wrapper for tiered OpenAI model calls

import OpenAI from 'openai';
import { z } from 'zod';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Model tiers for cost/performance optimization
export type ModelTier = 'pro' | 'standard' | 'mini';

const MODEL_MAP = {
  pro: 'gpt-5.2-pro',
  standard: 'gpt-5.2',
  mini: 'gpt-5.2-mini',
} as const;

// Temperature defaults by tier
const TEMPERATURE_DEFAULTS: Record<ModelTier, number> = {
  pro: 0.2, // More deterministic for complex analysis
  standard: 0.4, // Balanced for creative rewriting
  mini: 0.1, // Very deterministic for evaluation
};

// Max tokens by tier
const MAX_TOKENS_DEFAULTS: Record<ModelTier, number> = {
  pro: 6000,
  standard: 4096,
  mini: 2048,
};

export interface AICallOptions {
  tier?: ModelTier;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface AICallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model?: string;
  tier?: ModelTier;
}

/**
 * Extract JSON from AI response content
 * Handles markdown code blocks and raw JSON
 */
function extractJSON(content: string): string {
  // Try to extract from code block first (non-greedy, so takes first complete block)
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Find balanced JSON by tracking bracket depth
  const startChars = ['{', '['] as const;

  for (const startChar of startChars) {
    const startIndex = content.indexOf(startChar);
    if (startIndex === -1) continue;

    const endChar = startChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === startChar) depth++;
        if (char === endChar) depth--;

        if (depth === 0) {
          return content.slice(startIndex, i + 1);
        }
      }
    }
  }

  return content;
}

/**
 * Main AI call function with tiered model support
 * Uses OpenAI o3 models for optimal performance
 */
export async function callAI<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  options: AICallOptions = {},
): Promise<AICallResult<T>> {
  const {
    tier = 'standard',
    maxRetries = 3,
    temperature = TEMPERATURE_DEFAULTS[tier],
    maxTokens = MAX_TOKENS_DEFAULTS[tier],
    jsonMode = true,
    timeoutMs = 60000,
  } = options;

  if (!openai) {
    return {
      success: false,
      error: 'OpenAI API key not configured',
      tier,
    };
  }

  const model = MODEL_MAP[tier];
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          ...(jsonMode && { response_format: { type: 'json_object' as const } }),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          timeout: timeoutMs,
        },
      );

      const textContent = response.choices[0]?.message?.content;
      if (!textContent) {
        throw new Error('No text content in response');
      }

      const jsonString = extractJSON(textContent);
      const parsed = JSON.parse(jsonString);
      const validated = schema.parse(parsed);

      return {
        success: true,
        data: validated,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
        model,
        tier,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';

      // Log for debugging
      console.error(`AI call attempt ${attempt}/${maxRetries} failed:`, lastError);

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // If pro tier fails, try standard as fallback
  if (tier === 'pro' && maxRetries > 0) {
    console.warn(`Pro tier failed (${lastError}), falling back to standard tier`);
    return callAI(systemPrompt, userPrompt, schema, {
      ...options,
      tier: 'standard',
      maxRetries: 1,
    });
  }

  return {
    success: false,
    error: `AI call failed after ${maxRetries} attempts: ${lastError}`,
    tier,
  };
}

/**
 * Call AI without schema validation (for text-only responses)
 */
export async function callAIText(
  systemPrompt: string,
  userPrompt: string,
  options: Omit<AICallOptions, 'jsonMode'> = {},
): Promise<AICallResult<string>> {
  const {
    tier = 'standard',
    maxRetries = 3,
    temperature = TEMPERATURE_DEFAULTS[tier],
    maxTokens = MAX_TOKENS_DEFAULTS[tier],
    timeoutMs = 60000,
  } = options;

  if (!openai) {
    return {
      success: false,
      error: 'OpenAI API key not configured',
      tier,
    };
  }

  const model = MODEL_MAP[tier];
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create(
        {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          timeout: timeoutMs,
        },
      );

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No content in response');
      }

      return {
        success: true,
        data: content,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
        model,
        tier,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // If pro tier fails, try standard as fallback
  if (tier === 'pro' && maxRetries > 0) {
    console.warn(`Pro tier failed (${lastError}), falling back to standard tier`);
    return callAIText(systemPrompt, userPrompt, {
      ...options,
      tier: 'standard',
      maxRetries: 1,
    });
  }

  return {
    success: false,
    error: `AI text call failed: ${lastError}`,
    tier,
  };
}

/**
 * Get the current model for a tier (for logging/debugging)
 */
export function getModelForTier(tier: ModelTier): string {
  return MODEL_MAP[tier];
}
