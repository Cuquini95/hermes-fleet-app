const JSON_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json',
};

const ROLES = new Set([
  'operador',
  'mecanico',
  'jefe_taller',
  'coordinador',
  'supervisor',
  'gerencia',
]);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status });
}

function configuredSessionSecret(): string | null {
  const secret = (process.env.HERMES_AUTH_SESSION_SECRET || '').trim();
  return secret.length >= 32 ? secret : null;
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization')?.trim() || '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(value);
  return match?.[1] ?? null;
}

export async function requireSession(request: Request): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) {
    return json({ detail: 'Authentication required.' }, 401);
  }

  const secret = configuredSessionSecret();
  if (!secret) {
    return json({ detail: 'Hermes auth session signing is not configured.' }, 503);
  }

  const [encodedPayload, encodedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra.length > 0) {
    return json({ detail: 'Invalid session.' }, 401);
  }

  const payloadBytes = decodeBase64Url(encodedPayload);
  const signatureBytes = decodeBase64Url(encodedSignature);
  if (!payloadBytes || !signatureBytes || signatureBytes.length === 0) {
    return json({ detail: 'Invalid session.' }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown;
  } catch {
    return json({ detail: 'Invalid session.' }, 401);
  }

  if (!payload || typeof payload !== 'object') {
    return json({ detail: 'Invalid session.' }, 401);
  }

  const claims = payload as { role?: unknown; exp?: unknown };
  if (
    typeof claims.role !== 'string' ||
    !ROLES.has(claims.role) ||
    typeof claims.exp !== 'string' ||
    Date.parse(claims.exp) <= Date.now()
  ) {
    return json({ detail: 'Invalid or expired session.' }, 401);
  }

  try {
    const signatureBuffer = new ArrayBuffer(signatureBytes.byteLength);
    new Uint8Array(signatureBuffer).set(signatureBytes);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'HMAC' },
      key,
      signatureBuffer,
      new TextEncoder().encode(encodedPayload),
    );
    return valid ? null : json({ detail: 'Invalid session.' }, 401);
  } catch {
    return json({ detail: 'Invalid session.' }, 401);
  }
}
