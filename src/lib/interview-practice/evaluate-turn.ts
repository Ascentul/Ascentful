import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import {
  buildResponseEvaluationPrompt,
  buildTranscriptAnalysisPrompt,
  EVALUATOR_SYSTEM_PROMPT,
} from '@/lib/interview-practice/prompts';
import type {
  ResponseEvaluation,
  RoleProfile,
  RoleSnapshot,
  TranscriptMeta,
} from '@/lib/interview-practice/types';
import type { RequestLogger } from '@/lib/logger';

interface EvaluateTurnParams {
  openai: OpenAI;
  turnId: string;
  questionText: string;
  questionType: string;
  transcriptText: string;
  targetCompetencies?: string[];
  responseDurationMs?: number;
  roleProfile?: RoleProfile | RoleSnapshot | null;
  userId: string;
  log: RequestLogger;
}

interface EvaluateTurnResult {
  transcriptMeta?: TranscriptMeta;
  evaluation: ResponseEvaluation;
}

export async function evaluateTurnResponse(
  params: EvaluateTurnParams,
): Promise<EvaluateTurnResult> {
  const {
    openai,
    turnId,
    questionText,
    questionType,
    transcriptText,
    targetCompetencies,
    responseDurationMs,
    roleProfile,
    userId,
    log,
  } = params;

  let transcriptMeta: TranscriptMeta | undefined;

  try {
    const analysisPrompt = buildTranscriptAnalysisPrompt(transcriptText);
    const analysisCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const analysisContent = analysisCompletion.choices[0]?.message?.content;
    if (analysisContent) {
      const analysis = JSON.parse(analysisContent);
      transcriptMeta = {
        words_per_minute: analysis.estimated_wpm,
        filler_count: analysis.filler_count,
        filler_words: analysis.filler_words,
        duration_sec: responseDurationMs ? responseDurationMs / 1000 : undefined,
      };
    }
  } catch (analysisError) {
    log.warn('Transcript analysis failed for turn', {
      event: 'analysis.error',
      extra: { turnId },
    });
  }

  const evalPrompt = buildResponseEvaluationPrompt({
    question: questionText,
    questionType,
    transcript: transcriptText,
    targetCompetencies,
    roleProfile: {
      job_title: roleProfile?.job_title ?? 'Unknown',
      competencies: roleProfile?.competencies ?? undefined,
    },
  });

  const evalCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
      { role: 'user', content: evalPrompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  const evalContent = evalCompletion.choices[0]?.message?.content;
  if (!evalContent) {
    throw new Error('No evaluation content returned');
  }

  const evaluation = JSON.parse(evalContent) as ResponseEvaluation;

  await evaluate({
    tool_id: 'interview-response-evaluation',
    input: { question: questionText, transcript: transcriptText },
    output: evaluation as unknown as Record<string, unknown>,
    user_id: userId,
  });

  log.info('Turn evaluated', {
    event: 'evaluate.turn.success',
    extra: { turnId, score: evaluation.scores?.overall },
  });

  return { transcriptMeta, evaluation };
}
