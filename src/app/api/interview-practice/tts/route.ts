/**
 * Interview Practice - Text-to-Speech API
 *
 * POST: Generate TTS audio for interview questions
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

interface TTSRequestBody {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}

/**
 * POST /api/interview-practice/tts
 * Generate TTS audio for interview questions
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'interview-practice',
    httpMethod: 'POST',
    httpPath: '/api/interview-practice/tts',
  });

  const startTime = Date.now();
  log.info('TTS request started', { event: 'request.start' });

  try {
    const { userId } = await auth();
    if (!userId) {
      log.warn('Unauthorized request', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!openai) {
      log.warn('OpenAI not configured', { event: 'config.missing' });
      return NextResponse.json(
        { error: 'TTS service not available' },
        { status: 503, headers: { 'x-correlation-id': correlationId } },
      );
    }

    let body: TTSRequestBody;
    try {
      body = (await request.json()) as TTSRequestBody;
    } catch {
      log.warn('Invalid JSON body', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }
    const { text, voice = 'nova' } = body;
    const allowedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (voice && !allowedVoices.includes(voice)) {
      log.warn('Invalid voice parameter', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Invalid voice parameter' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    if (!text || text.trim().length === 0) {
      log.warn('Missing text', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      );
    }

    // Limit text length to avoid long audio generation
    const maxLength = 1000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    log.info('Generating TTS audio', {
      event: 'tts.start',
      extra: { textLength: truncatedText.length, voice },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const mp3Response = await openai.audio.speech.create(
        {
          model: 'tts-1',
          voice,
          input: truncatedText,
          response_format: 'mp3',
          speed: 1.15, // Slightly faster speech for interview flow
        },
        { signal: controller.signal },
      );

      // Get the audio as a buffer
      const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());

      // Convert to base64 data URL for easy client-side playback
      const base64Audio = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

      const durationMs = Date.now() - startTime;
      log.info('TTS audio generated', {
        event: 'request.success',
        httpStatus: 200,
        durationMs,
        extra: { audioSize: audioBuffer.length },
      });

      // Return JSON with the audio URL
      return NextResponse.json(
        { audioUrl },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'x-correlation-id': correlationId,
          },
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('TTS generation failed', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
}
