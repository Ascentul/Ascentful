/**
 * Interview Practice - Start Session API
 *
 * POST: Start a session and generate the first question
 */

import { auth } from '@clerk/nextjs/server';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { evaluate } from '@/lib/ai-evaluation';
import { convexServer } from '@/lib/convex-server';
import {
  buildQuestionGenerationPrompt,
  INTERVIEWER_SYSTEM_PROMPT,
} from '@/lib/interview-practice/prompts';
import type { GeneratedQuestion, QuestionType } from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/interview-practice/session/[id]/start
 * Start a session and generate the first question
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: `/api/interview-practice/session/${sessionId}/start`,
  });

  const startTime = Date.now();
  log.info('Session start request', { event: 'request.start', extra: { sessionId } });

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

    // Get session and verify ownership
    const session = await convexServer.query(
      api.interview_practice.getSession,
      { sessionId: sessionId as Id<'interview_practice_sessions'> },
      token,
    );

    if (!session) {
      log.warn('Session not found', { event: 'validation.failed', errorCode: 'NOT_FOUND' });
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (session.status !== 'setup') {
      log.warn('Session already started', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Session has already been started' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Generate first question BEFORE starting session to avoid inconsistent state
    // If question generation fails completely, session remains in 'setup' status
    let question: GeneratedQuestion;
    const roleProfile = session.role_profile;

    if (openai && roleProfile) {
      log.info('Generating first question with AI', { event: 'ai.request' });

      try {
        const prompt = buildQuestionGenerationPrompt({
          roleProfile: {
            job_title: roleProfile.job_title,
            company_name: roleProfile.company_name ?? undefined,
            role_summary: roleProfile.role_summary ?? undefined,
            competencies: roleProfile.competencies ?? undefined,
          },
          agentState: {
            coveredCompetencies: {},
            openThreads: [],
            difficultyLevel: 3,
            questionHistory: [],
          },
          turnIndex: 0,
          totalQuestions: session.question_count_target,
          mode: session.mode,
        });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in AI response');
        }

        question = JSON.parse(content) as GeneratedQuestion;

        // Evaluate the generated question
        await evaluate({
          tool_id: 'interview-question-generation',
          input: { roleProfile, turnIndex: 0, mode: session.mode },
          output: question as unknown as Record<string, unknown>,
          user_id: userId,
        });

        log.info('First question generated', {
          event: 'ai.success',
          extra: { questionType: question.question_type },
        });
      } catch (aiError) {
        log.error('AI question generation failed', toErrorCode(aiError), { event: 'ai.error' });
        // Fallback question
        question = {
          question_text:
            "Let's start with an introduction. Tell me about yourself and what interests you about this role.",
          question_type: 'behavioral',
          question_intent: 'Get to know the candidate and understand their motivation',
          target_competencies: [],
          evaluation_focus: ['communication', 'motivation', 'relevance'],
        };
      }
    } else {
      // Fallback when OpenAI not configured
      question = {
        question_text:
          "Let's start with an introduction. Tell me about yourself and what interests you about this role.",
        question_type: 'behavioral',
        question_intent: 'Get to know the candidate and understand their motivation',
        target_competencies: [],
        evaluation_focus: ['communication', 'motivation', 'relevance'],
      };
    }

    // Now that we have a valid question, start the session
    // This ensures we don't have an in_progress session without any turns
    await convexServer.mutation(
      api.interview_practice.startSession,
      { sessionId: sessionId as Id<'interview_practice_sessions'> },
      token,
    );

    // Create the first turn
    const turnId = await convexServer.mutation(
      api.interview_practice.createTurn,
      {
        session_id: sessionId as Id<'interview_practice_sessions'>,
        turn_index: 0,
        question_text: question.question_text,
        question_type: question.question_type as QuestionType,
        question_intent: question.question_intent,
        target_competencies: question.target_competencies,
        evaluation_focus: question.evaluation_focus,
      },
      token,
    );

    // Fetch the created turn to return to frontend
    const turn = await convexServer.query(
      api.interview_practice.getTurn,
      { turnId: turnId as Id<'interview_practice_turns'> },
      token,
    );

    // Update agent state with first question
    const updatedAgentState = {
      coveredCompetencies: {},
      openThreads: [],
      followUpQueue: [],
      difficultyLevel: 3,
      evidenceGaps: [],
      questionHistory: [
        {
          question: question.question_text,
          type: question.question_type,
        },
      ],
    };

    await convexServer.mutation(
      api.interview_practice.updateAgentState,
      {
        sessionId: sessionId as Id<'interview_practice_sessions'>,
        agent_state: updatedAgentState,
      },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Session started successfully', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { sessionId, turnId },
    });

    return NextResponse.json(
      {
        sessionId,
        turnId,
        turn: turn
          ? {
              _id: turn._id,
              turn_index: turn.turn_index,
              question_text: turn.question_text,
              question_type: turn.question_type,
              tts_audio_url: turn.tts_audio_url,
              transcript_text: turn.transcript_text,
              answered_at: turn.answered_at,
            }
          : null,
        question,
        currentIndex: 0,
        totalQuestions: session.question_count_target,
      },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Session start failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
      extra: { errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
