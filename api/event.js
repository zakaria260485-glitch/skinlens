export const config = { runtime: 'edge' };

const ALLOWED_EVENTS = new Set([
  'scan_start',
  'scan_complete',
  'scan_failed',
  'kit_offer_view',
  'kit_click',
  'kit_page_view',
  'checkout_click'
]);

const ALLOWED_SOURCES = new Set(['direct', 'instagram', 'tiktok', 'youtube', 'app', 'kit', 'routinegentile']);

export default async function handler(request) {
  if (request.method !== 'POST') return response(405);
  if (!isSameOrigin(request)) return response(403);
  if (Number(request.headers.get('content-length') || 0) > 1024) return response(413);

  const payload = await request.json().catch(() => ({}));
  if (!ALLOWED_EVENTS.has(payload.event)) return response(400);
  const source = ALLOWED_SOURCES.has(payload.source) ? payload.source : 'direct';

  console.log(JSON.stringify({
    level: 'info',
    msg: 'funnel_event',
    event: payload.event,
    source,
    route: new URL(request.url).pathname,
    requestId: request.headers.get('x-vercel-id') || undefined
  }));
  return response(204);
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === ownOrigin && (!fetchSite || fetchSite === 'same-origin');
}

function response(status) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
