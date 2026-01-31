import { auth } from '@clerk/nextjs/server';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ensureUploadsPath(...segments: string[]) {
  return path.join(process.cwd(), 'uploads', ...segments);
}

function getExtFromFilename(name: string | undefined, fallback: string) {
  if (!name) return fallback;
  const ext = path.extname(name);
  return ext || fallback;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'file',
    httpMethod: 'POST',
    httpPath: '/api/upload/resume',
  });

  const startTime = Date.now();
  log.info('Resume upload request started', { event: 'request.start' });

  try {
    const { userId } = await auth();
    if (!userId) {
      log.warn('Unauthorized resume upload', { event: 'auth.failed', errorCode: 'UNAUTHORIZED' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    // Sanitize userId to prevent path traversal attacks
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!file) {
      log.warn('Missing file field', { event: 'validation.failed', errorCode: 'BAD_REQUEST' });
      return NextResponse.json(
        { error: 'Missing file field' },
        {
          status: 400,
          headers: { 'x-correlation-id': correlationId },
        },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = getExtFromFilename(file.name, '.pdf');
    const filename = `resume_${safeUserId}_${Date.now()}${ext}`;
    const dir = ensureUploadsPath('resumes');
    const fullPath = path.join(dir, filename);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    const durationMs = Date.now() - startTime;
    log.info('Resume upload completed', {
      event: 'file.uploaded',
      httpStatus: 201,
      durationMs,
      extra: { fileSize: buffer.length, fileType: ext },
    });

    return NextResponse.json(
      {
        ok: true,
        file: {
          name: filename,
          path: `/api/files/resumes/${filename}`,
          localPath: fullPath,
          size: buffer.length,
        },
      },
      {
        status: 201,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error('Resume upload failed', toErrorCode(err), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Failed to upload resume' },
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
