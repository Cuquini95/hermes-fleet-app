/**
 * Edge fail-closed gate: anonymous sheet traffic never reaches the VPS proxy.
 * Full session HMAC verification remains in api/hermes-sheets-gate.js when routed.
 * This middleware guarantees missing Authorization => 401 even if rewrites misconfigure.
 */
export default function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/hermes-api/api/sheets')) {
    return;
  }
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) {
    return new Response(JSON.stringify({ detail: 'Authentication required.' }), {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  }
}

export const config = {
  matcher: ['/hermes-api/api/sheets/:path*'],
};
