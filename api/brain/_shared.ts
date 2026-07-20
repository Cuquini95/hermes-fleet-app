import { requireSession } from '../auth/_session.js';

const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status });
}

export async function forwardBrainRequest(request: Request, upstreamPath: string): Promise<Response> {
  const authFailure = await requireSession(request);
  if (authFailure) return authFailure;

  const baseUrl = (process.env.GTP_BRAIN_URL || '').trim().replace(/\/$/, '');
  const token = (process.env.GTP_BRAIN_TOKEN || '').trim();

  if (!baseUrl || !token) {
    return json({ detail: 'GTP Brain proxy is not configured for Hermes.' }, 503);
  }

  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.json().catch(() => ({}));
  }

  try {
    const upstream = await fetch(`${baseUrl}${upstreamPath}`, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
      status: upstream.status,
    });
  } catch (error) {
    return json(
      {
        detail:
          error instanceof Error
            ? `Hermes could not reach GTP Brain: ${error.message}`
            : 'Hermes could not reach GTP Brain.',
      },
      502,
    );
  }
}
