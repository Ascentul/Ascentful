/**
 * Interview Practice - Complete Session API
 *
 * POST: Complete a session and generate the coaching report
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { convexServer } from '@/lib/convex-server';
import {
  buildResponseEvaluationPrompt,
  buildSessionSummaryPrompt,
  buildTranscriptAnalysisPrompt,
  EVALUATOR_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from '@/lib/interview-practice/prompts';
import type {
  HireSignal,
  ResponseEvaluation,
  SessionSummary,
  TranscriptMeta,
} from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/interview-practice/session/[id]/complete
 * Complete a session and generate the coaching report
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: `/api/interview-practice/session/${sessionId}/complete`,
  });

  const startTime = Date.now();
  log.info('Session completion request', { event: 'request.start', extra: { sessionId } });

  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      log.warn('Unauthorized request', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const token = await getToken({ template: 'convex' });
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain auth token' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Get session with turns
    const session = await convexServer.query(
      api.interview_practice.getSessionWithTurns,
      { sessionId: sessionId as Id<'interview_practice_sessions'> },
      token,
    );

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Session is already completed' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Session must be in progress to complete' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const turns = session.turns ?? [];
    const roleProfile = session.role_profile;

    // Step 1: Evaluate all turns that haven't been evaluated yet
    log.info('Evaluating turns', { event: 'evaluate.start', extra: { turnCount: turns.length } });

    const evaluatedTurns: Array<{
      _id: string;
      question_text: string;
      question_type: string;
      transcript_text?: string;
      scores?: ResponseEvaluation['scores'];
      strengths?: string[];
      improvements?: string[];
      ideal_answer?: string;
      transcript_meta?: TranscriptMeta;
    }> = [];

    for (const turn of turns) {
      // Skip turns without transcripts
      if (!turn.transcript_text) {
        evaluatedTurns.push({
          _id: turn._id,
          question_text: turn.question_text,
          question_type: turn.question_type,
          transcript_text: turn.transcript_text ?? undefined,
        });
        continue;
      }

      // Skip turns that already have evaluation scores
      if (turn.scores?.overall) {
        evaluatedTurns.push({
          _id: turn._id,
          question_text: turn.question_text,
          question_type: turn.question_type,
          transcript_text: turn.transcript_text ?? undefined,
          scores: turn.scores ?? undefined,
          strengths: turn.strengths ?? undefined,
          improvements: turn.improvements ?? undefined,
        });
        continue;
      }

      // Evaluate this turn
      if (openai) {
        try {
          // Analyze transcript metadata
          let transcriptMeta: TranscriptMeta | undefined;
          try {
            const analysisPrompt = buildTranscriptAnalysisPrompt(turn.transcript_text);
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
                duration_sec: turn.response_duration_ms
                  ? turn.response_duration_ms / 1000
                  : undefined,
              };
            }
          } catch (analysisError) {
            log.warn('Transcript analysis failed for turn', {
              event: 'analysis.error',
              extra: { turnId: turn._id },
            });
          }

          // Evaluate response
          const evalPrompt = buildResponseEvaluationPrompt({
            question: turn.question_text,
            questionType: turn.question_type,
            transcript: turn.transcript_text,
            targetCompetencies: turn.target_competencies ?? undefined,
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
          if (evalContent) {
            const evaluation = JSON.parse(evalContent) as ResponseEvaluation;

            // Evaluate the AI evaluation
            await evaluate({
              tool_id: 'interview-response-evaluation',
              input: { question: turn.question_text, transcript: turn.transcript_text },
              output: evaluation as unknown as Record<string, unknown>,
              user_id: userId,
            });

            // Save evaluation to turn
            await convexServer.mutation(
              api.interview_practice.saveTurnResponse,
              {
                turn_id: turn._id as Id<'interview_practice_turns'>,
                transcript_meta: transcriptMeta,
                content_signals: evaluation.content_signals,
                scores: evaluation.scores,
                strengths: evaluation.strengths,
                improvements: evaluation.improvements,
                ideal_answer: evaluation.ideal_answer,
                keywords_to_include: evaluation.keywords_to_include,
              },
              token,
            );

            evaluatedTurns.push({
              _id: turn._id,
              question_text: turn.question_text,
              question_type: turn.question_type,
              transcript_text: turn.transcript_text ?? undefined,
              scores: evaluation.scores,
              strengths: evaluation.strengths,
              improvements: evaluation.improvements,
              ideal_answer: evaluation.ideal_answer,
              transcript_meta: transcriptMeta,
            });

            log.info('Turn evaluated', {
              event: 'evaluate.turn.success',
              extra: { turnId: turn._id, score: evaluation.scores?.overall },
            });
          }
        } catch (evalError) {
          log.error('Turn evaluation failed', toErrorCode(evalError), {
            event: 'evaluate.turn.error',
            extra: { turnId: turn._id },
          });
          evaluatedTurns.push({
            _id: turn._id,
            question_text: turn.question_text,
            question_type: turn.question_type,
            transcript_text: turn.transcript_text ?? undefined,
          });
        }
      } else {
        evaluatedTurns.push({
          _id: turn._id,
          question_text: turn.question_text,
          question_type: turn.question_type,
          transcript_text: turn.transcript_text ?? undefined,
        });
      }
    }

    log.info('All turns evaluated', {
      event: 'evaluate.complete',
      extra: { evaluatedCount: evaluatedTurns.filter((t) => t.scores).length },
    });

    // Step 2: Generate summary with AI
    let summary: SessionSummary;

    if (openai && evaluatedTurns.length > 0) {
      log.info('Generating session summary with AI', { event: 'ai.request' });

      try {
        const prompt = buildSessionSummaryPrompt({
          roleProfile: {
            job_title: roleProfile?.job_title ?? 'Unknown',
            company_name: roleProfile?.company_name ?? undefined,
            competencies: roleProfile?.competencies ?? undefined,
          },
          turns: evaluatedTurns.map((t) => ({
            question_text: t.question_text,
            question_type: t.question_type,
            transcript_text: t.transcript_text ?? undefined,
            scores: t.scores ?? undefined,
            strengths: t.strengths ?? undefined,
            improvements: t.improvements ?? undefined,
          })),
          totalDurationMs: session.started_at ? Date.now() - session.started_at : undefined,
        });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.6,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in AI response');
        }

        summary = JSON.parse(content) as SessionSummary;

        // Evaluate the summary
        await evaluate({
          tool_id: 'interview-session-summary',
          input: { turns: evaluatedTurns, roleProfile },
          output: summary as unknown as Record<string, unknown>,
          user_id: userId,
        });

        log.info('Session summary generated', {
          event: 'ai.success',
          extra: { overallScore: summary.overall_score, hireSignal: summary.hire_signal },
        });
      } catch (aiError) {
        log.error('AI summary generation failed', toErrorCode(aiError), { event: 'ai.error' });
        // Generate fallback summary from turn scores
        summary = generateFallbackSummary(evaluatedTurns);
      }
    } else {
      // Generate fallback summary
      summary = generateFallbackSummary(evaluatedTurns);
    }

    // Complete the session
    await convexServer.mutation(
      api.interview_practice.completeSession,
      {
        sessionId: sessionId as Id<'interview_practice_sessions'>,
        overall_score: summary.overall_score,
        dimension_scores: summary.dimension_scores,
        coach_summary: summary.coach_summary,
        key_takeaways: summary.key_takeaways,
        improvement_priorities: summary.improvement_priorities,
        hire_signal: summary.hire_signal as HireSignal,
      },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Session completed successfully', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { sessionId, overallScore: summary.overall_score },
    });

    return NextResponse.json(
      {
        sessionId,
        summary,
        turnsCount: turns.length,
      },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Session completion failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}

/**
 * Generate a fallback summary when AI is unavailable
 */
function generateFallbackSummary(
  turns: Array<{
    scores?: {
      communication?: number;
      specificity?: number;
      structure?: number;
      role_fit?: number;
      overall?: number;
    };
    strengths?: string[];
    improvements?: string[];
  }>,
): SessionSummary {
  // Calculate average scores
  const validTurns = turns.filter((t) => t.scores?.overall);
  const avgOverall =
    validTurns.length > 0
      ? validTurns.reduce((sum, t) => sum + (t.scores?.overall ?? 0), 0) / validTurns.length
      : 3;

  const avgCommunication =
    validTurns.length > 0
      ? validTurns.reduce((sum, t) => sum + (t.scores?.communication ?? 0), 0) / validTurns.length
      : 3;

  const avgSpecificity =
    validTurns.length > 0
      ? validTurns.reduce((sum, t) => sum + (t.scores?.specificity ?? 0), 0) / validTurns.length
      : 3;

  const avgStructure =
    validTurns.length > 0
      ? validTurns.reduce((sum, t) => sum + (t.scores?.structure ?? 0), 0) / validTurns.length
      : 3;

  const avgRoleFit =
    validTurns.length > 0
      ? validTurns.reduce((sum, t) => sum + (t.scores?.role_fit ?? 0), 0) / validTurns.length
      : 3;

  // Collect all strengths and improvements
  const allStrengths = turns.flatMap((t) => t.strengths ?? []);
  const allImprovements = turns.flatMap((t) => t.improvements ?? []);

  // Determine hire signal
  let hireSignal: HireSignal;
  if (avgOverall >= 4.5) hireSignal = 'strong_yes';
  else if (avgOverall >= 3.5) hireSignal = 'yes';
  else if (avgOverall >= 2.5) hireSignal = 'mixed';
  else if (avgOverall >= 1.5) hireSignal = 'no';
  else hireSignal = 'strong_no';

  return {
    overall_score: Math.round(avgOverall * 20), // Convert 1-5 to 1-100
    dimension_scores: {
      communication: Math.round(avgCommunication * 20),
      relevance: Math.round(avgRoleFit * 20),
      specificity: Math.round(avgSpecificity * 20),
      structure: Math.round(avgStructure * 20),
      confidence: Math.round(avgOverall * 20), // Use overall as proxy
    },
    hire_signal: hireSignal,
    coach_summary: `You completed ${turns.length} interview questions. ${
      avgOverall >= 3
        ? 'Overall, you demonstrated solid interview skills.'
        : 'There are some areas to focus on for improvement.'
    } Review the individual question feedback for detailed insights.`,
    key_takeaways: [
      allStrengths[0] ?? 'Continue practicing your storytelling',
      allImprovements[0] ?? 'Focus on providing specific examples',
      'Review your responses and practice areas marked for improvement',
    ],
    improvement_priorities: allImprovements.slice(0, 3),
  };
}
