let mockUserId: string | null = null;

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() =>
    Promise.resolve({
      userId: mockUserId,
    }),
  ),
}));

import { NextRequest } from 'next/server';

import { POST as searchJobs } from '@/app/api/jobs/search/route';

const makeRequest = (url: string) => new NextRequest(url, { method: 'POST' });

describe('jobs search auth guard', () => {
  beforeEach(() => {
    mockUserId = null;
  });

  it('rejects unauthenticated job search requests', async () => {
    const res = await searchJobs(makeRequest('http://localhost/api/jobs/search'));
    expect(res.status).toBe(401);
  });
});
