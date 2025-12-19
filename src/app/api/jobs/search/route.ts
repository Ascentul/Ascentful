import { NextRequest, NextResponse } from 'next/server';

import { createRequestLogger, getCorrelationIdFromRequest, toErrorCode } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createRequestLogger(correlationId, {
    feature: 'application',
    httpMethod: 'POST',
    httpPath: '/api/jobs/search',
  });

  const startTime = Date.now();
  log.debug('Job search request started', { event: 'request.start' });

  try {
    const body = await request.json().catch(() => ({}));
    let { query, location, jobType, experienceLevel, page = 1, perPage = 20, sortBy } = body;
    query = typeof query === 'string' ? query.trim() : '';
    location = typeof location === 'string' ? location.trim() : '';
    // Validate sortBy - Adzuna supports: relevance, date, salary
    const validSortOptions = ['relevance', 'date', 'salary'];
    sortBy = validSortOptions.includes(sortBy) ? sortBy : 'relevance';

    const appId = process.env.ADZUNA_APPLICATION_ID;
    const apiKey = process.env.ADZUNA_API_KEY;
    if (!appId || !apiKey) {
      return NextResponse.json(
        { error: 'Adzuna API keys are not configured on this server.' },
        { status: 500 },
      );
    }

    // Country selection: request override > env > default 'us'
    const bodyCountry = typeof body.country === 'string' ? body.country.trim().toLowerCase() : '';
    const envCountry =
      typeof process.env.ADZUNA_COUNTRY === 'string'
        ? process.env.ADZUNA_COUNTRY.trim().toLowerCase()
        : '';
    const country = (bodyCountry || envCountry || 'us').replace(/[^a-z]/g, '');

    const params = new URLSearchParams();
    params.set('app_id', appId);
    params.set('app_key', apiKey);
    const isRemote = Boolean(location && location.toLowerCase() === 'remote');
    let what = query || 'software engineer';
    if (isRemote) what = `${what} remote`;
    if (jobType === 'Internship') what = `${what} internship`;
    params.set('what', what);
    // Always include a "where" to avoid CDN HTML 400 responses
    if (location && !isRemote) params.set('where', location);
    else params.set('where', 'United States');
    params.set('results_per_page', String(perPage));

    // Map job type - Adzuna uses full_time/part_time/contract as boolean flags
    if (jobType === 'Full-time') params.set('full_time', '1');
    else if (jobType === 'Part-time') params.set('part_time', '1');
    else if (jobType === 'Contract') params.set('contract', '1');
    // Internship not directly supported; included in query keywords

    // Add sort_by parameter (Adzuna supports: relevance, date, salary)
    if (sortBy && sortBy !== 'relevance') {
      params.set('sort_by', sortBy);
    }

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Ascentful/1.0',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (process.env.ADZUNA_TEST_IP) {
      headers['X-Forwarded-For'] = process.env.ADZUNA_TEST_IP;
    }
    let res = await fetch(url, { headers, cache: 'no-store' });

    if (!res.ok) {
      let raw = await res.text();
      const looksHtml = /<html[\s\S]*>/i.test(raw);
      // Retry once with safer defaults if HTML error or 400
      if (res.status === 400 || looksHtml) {
        const retryParams = new URLSearchParams(params);
        retryParams.set('results_per_page', '10');
        if (!retryParams.has('where')) retryParams.set('where', 'United States');
        const retryUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${retryParams.toString()}`;
        const retryRes = await fetch(retryUrl, { headers, cache: 'no-store' });
        if (retryRes.ok) {
          res = retryRes;
        } else {
          raw = await retryRes.text();
          let parsedRetry: any = null;
          try {
            parsedRetry = JSON.parse(raw);
          } catch {}
          const meta: Record<string, any> = {
            country,
            page,
            perPage,
            retried: true,
            retryPerPage: 10,
            retryWhere: 'United States',
            hasWhat: Boolean(query || 'software engineer'),
          };
          return NextResponse.json(
            {
              error: 'Adzuna request failed',
              details: parsedRetry || raw,
              meta,
            },
            { status: retryRes.status },
          );
        }
      } else {
        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {}
        const meta: Record<string, any> = {
          country,
          page,
          perPage,
          hasWhat: Boolean(query || 'software engineer'),
          hasWhere: Boolean(location && location.toLowerCase() !== 'remote'),
        };
        return NextResponse.json(
          { error: 'Adzuna request failed', details: parsed || raw, meta },
          { status: res.status },
        );
      }
    }
    const data = await res.json();

    // Normalize Adzuna results to our UI shape
    // See https://developer.adzuna.com/docs/search
    const jobs = (data.results || []).map((r: any) => {
      const salary =
        r.salary_min && r.salary_max
          ? `$${Math.round(r.salary_min).toLocaleString()} - $${Math.round(r.salary_max).toLocaleString()}`
          : undefined;
      return {
        id: String(r.id ?? r.adref ?? r.redirect_url),
        title: r.title ?? 'Untitled',
        company: r.company?.display_name ?? 'Company',
        location: r.location?.display_name ?? '—',
        type: r.contract_time
          ? r.contract_time === 'full_time'
            ? 'Full-time'
            : 'Part-time'
          : jobType || '—',
        experience: experienceLevel || '—',
        description: r.description
          ? String(r.description)
              .replace(/<[^>]+>/g, '')
              .slice(0, 220) + '…'
          : '—',
        salary,
        url: r.redirect_url,
        posted: r.created || r.created_at || null,
        category: r.category?.label || r.category || null,
        contract_type: r.contract_type || null,
        company_logo: r.company?.logo || null,
      };
    });

    const durationMs = Date.now() - startTime;
    log.debug('Job search completed', {
      event: 'request.success',
      httpStatus: 200,
      durationMs,
      extra: { jobCount: jobs.length, total: Number(data.count ?? jobs.length) },
    });

    return NextResponse.json(
      {
        jobs,
        total: Number(data.count ?? jobs.length),
        page: Number(page),
        perPage: Number(perPage),
        totalPages: Math.max(1, Math.ceil(Number(data.count ?? jobs.length) / Number(perPage))),
        query: { query, location, jobType, experienceLevel, sortBy },
      },
      { headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error('Error searching jobs', toErrorCode(error), {
      event: 'request.error',
      httpStatus: 500,
      durationMs,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  }
}
