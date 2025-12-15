/**
 * Interview Practice - Turn Submission API
 *
 * POST: Submit a turn response (audio + optional transcript)
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
  buildTranscriptAnalysisPrompt,
  EVALUATOR_SYSTEM_PROMPT,
} from '@/lib/interview-practice/prompts';
import type { ResponseEvaluation, TranscriptMeta } from '@/lib/interview-practice/types';
import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/interview-practice/session/[id]/turn
 * Submit a turn response with audio
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: `/api/interview-practice/session/${sessionId}/turn`,
  });

  const startTime = Date.now();
  log.info('Turn submission request', { event: 'request.start', extra: { sessionId } });

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

    // Parse form data or JSON
    let turnId: string;
    let audioStorageId: string | undefined;
    let providedTranscript: string | undefined;
    let responseDurationMs: number | undefined;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      turnId = formData.get('turnId') as string;
      audioStorageId = formData.get('audioStorageId') as string | undefined;
      providedTranscript = formData.get('transcript') as string | undefined;
      const durationStr = formData.get('responseDurationMs') as string | undefined;
      responseDurationMs = durationStr ? parseInt(durationStr, 10) : undefined;
    } else {
      const body = await request.json();
      turnId = body.turnId;
      audioStorageId = body.audioStorageId;
      providedTranscript = body.transcript;
      responseDurationMs = body.responseDurationMs;
    }

    if (!turnId) {
      log.warn('Missing turn ID', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Turn ID is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Get session and turn data
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

    const turn = await convexServer.query(
      api.interview_practice.getTurn,
      { turnId: turnId as Id<'interview_practice_turns'> },
      token,
    );

    if (!turn) {
      return NextResponse.json(
        { error: 'Turn not found' },
        { status: 404, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Transcribe audio if we have storage ID and no provided transcript
    let transcript = providedTranscript;

    if (!transcript && audioStorageId && openai) {
      log.info('Transcribing audio', { event: 'transcribe.start' });

      try {
        // Get audio URL from Convex storage
        const audioUrl = await convexServer.query(
          api.interview_practice.getAudioUrl,
          { storageId: audioStorageId as Id<'_storage'> },
          token,
        );

        if (audioUrl) {
          // Download audio and transcribe
          const audioResponse = await fetch(audioUrl);
          const audioBlob = await audioResponse.blob();

          // Create a File object for OpenAI
          const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'en',
          });

          transcript = transcription.text;
          log.info('Audio transcribed', {
            event: 'transcribe.success',
            extra: { wordCount: transcript.split(' ').length },
          });
        }
      } catch (transcribeError) {
        log.error('Transcription failed', toErrorCode(transcribeError), {
          event: 'transcribe.error',
        });
        // Continue without transcript
      }
    }

    // Analyze transcript metadata
    let transcriptMeta: TranscriptMeta | undefined;
    let evaluation: ResponseEvaluation | undefined;

    if (transcript && openai) {
      // Analyze transcript for delivery metrics
      try {
        log.info('Analyzing transcript', { event: 'analysis.start' });

        const analysisPrompt = buildTranscriptAnalysisPrompt(transcript);
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
        log.warn('Transcript analysis failed', {
          event: 'analysis.error',
          errorCode: toErrorCode(analysisError),
        });
      }

      // Evaluate response
      try {
        log.info('Evaluating response', { event: 'evaluate.start' });

        const roleProfile = session.role_profile;
        const evalPrompt = buildResponseEvaluationPrompt({
          question: turn.question_text,
          questionType: turn.question_type,
          transcript,
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
          evaluation = JSON.parse(evalContent) as ResponseEvaluation;

          // Evaluate the AI evaluation
          await evaluate({
            tool_id: 'interview-response-evaluation',
            input: { question: turn.question_text, transcript },
            output: evaluation as unknown as Record<string, unknown>,
            user_id: userId,
          });

          log.info('Response evaluated', {
            event: 'evaluate.success',
            extra: { overallScore: evaluation.scores?.overall },
          });
        }
      } catch (evalError) {
        log.error('Response evaluation failed', toErrorCode(evalError), {
          event: 'evaluate.error',
        });
      }
    }

    // Save turn response
    await convexServer.mutation(
      api.interview_practice.saveTurnResponse,
      {
        turn_id: turnId as Id<'interview_practice_turns'>,
        user_audio_storage_id: audioStorageId ? (audioStorageId as Id<'_storage'>) : undefined,
        transcript_text: transcript,
        response_duration_ms: responseDurationMs,
        transcript_meta: transcriptMeta,
        content_signals: evaluation?.content_signals,
        scores: evaluation?.scores,
        strengths: evaluation?.strengths,
        improvements: evaluation?.improvements,
        ideal_answer: evaluation?.ideal_answer,
        keywords_to_include: evaluation?.keywords_to_include,
      },
      token,
    );

    // Update agent state with this response
    const currentAgentState = session.agent_state as {
      coveredCompetencies: Record<string, number>;
      questionHistory: Array<{ question: string; type: string }>;
    } | null;

    if (currentAgentState && turn.target_competencies) {
      const updatedCoverage = { ...currentAgentState.coveredCompetencies };
      const score = evaluation?.scores?.overall ?? 3;
      const coverageIncrease = (score / 5) * 25; // 0-25% coverage per question

      for (const compId of turn.target_competencies) {
        const current = updatedCoverage[compId] ?? 0;
        updatedCoverage[compId] = Math.min(100, current + coverageIncrease);
      }

      await convexServer.mutation(
        api.interview_practice.updateAgentState,
        {
          sessionId: sessionId as Id<'interview_practice_sessions'>,
          agent_state: {
            ...currentAgentState,
            coveredCompetencies: updatedCoverage,
          },
        },
        token,
      );
    }

    // Check if this is the last question
    const isLastQuestion = turn.turn_index >= session.question_count_target - 1;

    const durationMs = Date.now() - startTime;
    log.info('Turn submitted successfully', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { turnId, hasTranscript: !!transcript, hasEvaluation: !!evaluation },
    });

    return NextResponse.json(
      {
        turnId,
        transcript: transcript ?? null,
        evaluation: evaluation ?? null,
        transcriptMeta: transcriptMeta ?? null,
        nextQuestionAvailable: !isLastQuestion,
        isLastQuestion,
      },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Turn submission failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to submit turn' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
