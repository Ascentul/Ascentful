let mockUserId: string | null = null;
const mockConvexQuery = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() =>
    Promise.resolve({
      userId: mockUserId,
      getToken: () => (mockUserId ? Promise.resolve('mock-convex-token') : Promise.resolve(null)),
    }),
  ),
}));

jest.mock('@/lib/convex-server', () => ({
  convexServer: {
    query: (...args: unknown[]) => mockConvexQuery(...args),
  },
}));

import { NextRequest } from 'next/server';

import { GET as getFile } from '@/app/api/files/[...path]/route';
import { POST as uploadAudio } from '@/app/api/upload/audio/route';
import { POST as uploadImage } from '@/app/api/upload/image/route';
import { POST as uploadResume } from '@/app/api/upload/resume/route';

const makeRequest = (url: string, method: 'GET' | 'POST' = 'GET') =>
  new NextRequest(url, { method });

describe('upload/file auth guards', () => {
  beforeEach(() => {
    mockUserId = null;
    mockConvexQuery.mockReset();
  });

  it('rejects unauthenticated resume uploads', async () => {
    const res = await uploadResume(makeRequest('http://localhost/api/upload/resume', 'POST'));
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated audio uploads', async () => {
    const res = await uploadAudio(makeRequest('http://localhost/api/upload/audio', 'POST'));
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated image uploads', async () => {
    const res = await uploadImage(makeRequest('http://localhost/api/upload/image', 'POST'));
    expect(res.status).toBe(401);
  });

  it('requires auth for resume file access', async () => {
    const res = await getFile(makeRequest('http://localhost/api/files/resumes/test.pdf'), {
      params: Promise.resolve({ path: ['resumes', 'test.pdf'] }),
    });
    expect(res.status).toBe(401);
  });

  it('allows public image access (returns 404 for missing file)', async () => {
    const res = await getFile(makeRequest('http://localhost/api/files/images/test.png'), {
      params: Promise.resolve({ path: ['images', 'test.png'] }),
    });
    expect(res.status).toBe(404);
  });

  it('forbids access to another user resume when not authorized', async () => {
    mockUserId = 'user_own';
    mockConvexQuery.mockRejectedValue(new Error('Unauthorized'));

    const res = await getFile(
      makeRequest('http://localhost/api/files/resumes/resume_user_other_123.pdf'),
      {
        params: Promise.resolve({ path: ['resumes', 'resume_user_other_123.pdf'] }),
      },
    );

    expect(res.status).toBe(403);
  });
});
