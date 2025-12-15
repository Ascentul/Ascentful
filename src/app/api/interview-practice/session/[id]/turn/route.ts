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

import { convexServer } from '@/lib/convex-server';
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
    let audioFile: File | null = null;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      turnId = formData.get('turnId') as string;
      audioStorageId = formData.get('audioStorageId') as string | undefined;
      providedTranscript = formData.get('transcript') as string | undefined;
      const durationStr = formData.get('responseDurationMs') as string | undefined;
      responseDurationMs = durationStr ? parseInt(durationStr, 10) : undefined;

      // Check for raw audio file
      const audioData = formData.get('audio');
      if (audioData instanceof File) {
        audioFile = audioData;
      }
    } else {
      const body = await request.json();
      turnId = body.turnId;
      audioStorageId = body.audioStorageId;
      providedTranscript = body.transcript;
      responseDurationMs = body.responseDurationMs;
    }

    // If we have raw audio file but no storage ID, upload to Convex storage first
    if (audioFile && !audioStorageId) {
      log.info('Uploading audio to Convex storage', { event: 'upload.start' });
      try {
        // Get upload URL from Convex
        const uploadUrl = await convexServer.mutation(
          api.interview_practice.generateAudioUploadUrl,
          {},
          token,
        );

        // Upload the audio file
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': audioFile.type || 'audio/webm',
          },
          body: audioFile,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        audioStorageId = uploadResult.storageId;
        log.info('Audio uploaded to Convex storage', {
          event: 'upload.success',
          extra: { storageId: audioStorageId },
        });
      } catch (uploadError) {
        log.error('Audio upload failed', toErrorCode(uploadError), { event: 'upload.error' });
        // Continue without audio storage - we might still have transcript
      }
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

    // Transcribe audio if we have storage ID or raw audio file and no provided transcript
    let transcript = providedTranscript;

    if (!transcript && openai) {
      log.info('Transcribing audio', { event: 'transcribe.start' });

      try {
        let audioToTranscribe: File | null = null;

        // Option 1: Use raw audio file directly if available
        if (audioFile) {
          audioToTranscribe = audioFile;
          log.info('Using raw audio file for transcription', { event: 'transcribe.source.raw' });
        }
        // Option 2: Download from Convex storage
        else if (audioStorageId) {
          const audioUrl = await convexServer.query(
            api.interview_practice.getAudioUrl,
            { storageId: audioStorageId as Id<'_storage'> },
            token,
          );

          if (audioUrl) {
            const audioResponse = await fetch(audioUrl);
            const audioBlob = await audioResponse.blob();
            audioToTranscribe = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
            log.info('Downloaded audio from storage for transcription', {
              event: 'transcribe.source.storage',
            });
          }
        }

        if (audioToTranscribe) {
          const transcription = await openai.audio.transcriptions.create({
            file: audioToTranscribe,
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

    // Save turn response (only transcript - evaluation happens at session completion)
    await convexServer.mutation(
      api.interview_practice.saveTurnResponse,
      {
        turn_id: turnId as Id<'interview_practice_turns'>,
        user_audio_storage_id: audioStorageId ? (audioStorageId as Id<'_storage'>) : undefined,
        transcript_text: transcript,
        response_duration_ms: responseDurationMs,
      },
      token,
    );

    // Check if this is the last question
    const isLastQuestion = turn.turn_index >= session.question_count_target - 1;

    const durationMs = Date.now() - startTime;
    log.info('Turn submitted successfully', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { turnId, hasTranscript: !!transcript },
    });

    return NextResponse.json(
      {
        turnId,
        transcript: transcript ?? null,
        nextQuestionAvailable: !isLastQuestion,
        isLastQuestion,
      },
      { status: 200, headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error('Turn submission failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
      extra: { errorMessage, stack: error instanceof Error ? error.stack : undefined },
    });
    return NextResponse.json(
      { error: errorMessage || 'Failed to submit turn' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
