/**
 * Interview Practice - Next Question API
 *
 * POST: Generate the next interview question
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
import type { AgentState, GeneratedQuestion, QuestionType } from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Fallback questions when AI is unavailable
const FALLBACK_QUESTIONS: GeneratedQuestion[] = [
  {
    question_text:
      'Tell me about a challenging project you worked on. What was your role and what was the outcome?',
    question_type: 'behavioral',
    question_intent: 'Assess problem-solving and project experience',
    target_competencies: [],
    evaluation_focus: ['specificity', 'structure', 'outcome focus'],
  },
  {
    question_text:
      'Describe a time when you had to work with a difficult team member. How did you handle it?',
    question_type: 'behavioral',
    question_intent: 'Assess interpersonal skills and conflict resolution',
    target_competencies: [],
    evaluation_focus: ['communication', 'empathy', 'resolution'],
  },
  {
    question_text: 'What would you do if you disagreed with a decision made by your manager?',
    question_type: 'situational',
    question_intent: 'Assess communication style and professional judgment',
    target_competencies: [],
    evaluation_focus: ['diplomacy', 'assertiveness', 'problem-solving'],
  },
  {
    question_text:
      'Tell me about a time when you had to learn something new quickly. How did you approach it?',
    question_type: 'behavioral',
    question_intent: 'Assess learning ability and adaptability',
    target_competencies: [],
    evaluation_focus: ['learning strategy', 'resourcefulness', 'outcome'],
  },
  {
    question_text:
      'Describe your ideal work environment. What conditions help you do your best work?',
    question_type: 'culture',
    question_intent: 'Assess cultural fit and self-awareness',
    target_competencies: [],
    evaluation_focus: ['self-awareness', 'values alignment'],
  },
];

/**
 * POST /api/interview-practice/session/[id]/next
 * Generate the next interview question
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: `/api/interview-practice/session/${sessionId}/next`,
  });

  const startTime = Date.now();
  log.info('Next question request', { event: 'request.start', extra: { sessionId } });

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

    // Get session
    const session = await convexServer.query(
      api.interview_practice.getSession,
      { sessionId: sessionId as Id<'interview_practice_sessions'> },
      token,
    );

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Session is not in progress' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    const nextIndex = session.current_question_index + 1;

    // Check if we've reached the end
    if (nextIndex >= session.question_count_target) {
      log.info('Interview complete', { event: 'interview.complete' });
      return NextResponse.json(
        {
          isComplete: true,
          interviewComplete: true,
          message: 'All questions have been asked',
          currentIndex: session.current_question_index,
          totalQuestions: session.question_count_target,
        },
        { status: 200, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Get the previous turn to inform the next question
    const sessionWithTurns = await convexServer.query(
      api.interview_practice.getSessionWithTurns,
      { sessionId: sessionId as Id<'interview_practice_sessions'> },
      token,
    );

    const previousTurn = sessionWithTurns?.turns?.find(
      (t) => t.turn_index === session.current_question_index,
    );

    // Generate next question
    let question: GeneratedQuestion;
    const roleProfile = session.role_profile;
    const agentState = (session.agent_state as AgentState) ?? {
      coveredCompetencies: {},
      openThreads: [],
      difficultyLevel: 3,
      questionHistory: [],
    };

    if (openai && roleProfile) {
      log.info('Generating next question with AI', { event: 'ai.request' });

      try {
        const prompt = buildQuestionGenerationPrompt({
          roleProfile: {
            job_title: roleProfile.job_title,
            company_name: roleProfile.company_name ?? undefined,
            role_summary: roleProfile.role_summary ?? undefined,
            competencies: roleProfile.competencies ?? undefined,
          },
          agentState: {
            coveredCompetencies: agentState.coveredCompetencies ?? {},
            openThreads: agentState.openThreads ?? [],
            difficultyLevel: agentState.difficultyLevel ?? 3,
            questionHistory: agentState.questionHistory ?? [],
          },
          previousTurn: previousTurn
            ? {
                question_text: previousTurn.question_text,
                transcript_text: previousTurn.transcript_text ?? undefined,
                scores: previousTurn.scores ?? undefined,
              }
            : undefined,
          turnIndex: nextIndex,
          totalQuestions: session.question_count_target,
          mode: session.mode,
        });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: INTERVIEWER_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          // Lower temperature for consistent JSON structure (0.8 was too high for structured output)
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in AI response');
        }

        // Parse and validate JSON response
        let parsedQuestion: GeneratedQuestion;
        try {
          parsedQuestion = JSON.parse(content) as GeneratedQuestion;
        } catch (parseError) {
          log.error('Failed to parse AI response as JSON', toErrorCode(parseError), {
            event: 'ai.parse_error',
            extra: { content: content.substring(0, 200) },
          });
          throw new Error('Invalid JSON response from AI');
        }

        // Validate required fields
        if (!parsedQuestion.question_text || typeof parsedQuestion.question_text !== 'string') {
          throw new Error('AI response missing required question_text field');
        }
        if (!parsedQuestion.question_type || typeof parsedQuestion.question_type !== 'string') {
          throw new Error('AI response missing required question_type field');
        }

        question = parsedQuestion;

        // Evaluate the generated question
        await evaluate({
          tool_id: 'interview-question-generation',
          input: { roleProfile, turnIndex: nextIndex, mode: session.mode, previousTurn },
          output: question as unknown as Record<string, unknown>,
          user_id: userId,
        });

        log.info('Next question generated', {
          event: 'ai.success',
          extra: { questionType: question.question_type },
        });
      } catch (aiError) {
        log.error('AI question generation failed', toErrorCode(aiError), { event: 'ai.error' });
        // Use fallback question
        question = FALLBACK_QUESTIONS[nextIndex % FALLBACK_QUESTIONS.length];
      }
    } else {
      // Use fallback question when OpenAI not configured
      question = FALLBACK_QUESTIONS[nextIndex % FALLBACK_QUESTIONS.length];
    }

    // Create the turn
    const turnId = await convexServer.mutation(
      api.interview_practice.createTurn,
      {
        session_id: sessionId as Id<'interview_practice_sessions'>,
        turn_index: nextIndex,
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

    // Update agent state
    const updatedQuestionHistory = [
      ...(agentState.questionHistory ?? []),
      {
        question: question.question_text,
        type: question.question_type,
      },
    ];

    await convexServer.mutation(
      api.interview_practice.updateAgentState,
      {
        sessionId: sessionId as Id<'interview_practice_sessions'>,
        agent_state: {
          ...agentState,
          questionHistory: updatedQuestionHistory,
        },
      },
      token,
    );

    const durationMs = Date.now() - startTime;
    log.info('Next question generated successfully', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { turnId, questionIndex: nextIndex },
    });

    return NextResponse.json(
      {
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
        currentIndex: nextIndex,
        totalQuestions: session.question_count_target,
        isComplete: false,
        isLastQuestion: nextIndex >= session.question_count_target - 1,
      },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Next question generation failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
      extra: { errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return NextResponse.json(
      { error: 'Failed to generate next question' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
