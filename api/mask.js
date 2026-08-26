export const config = { runtime: 'edge' };

import { verifyScanToken } from '../lib/scan-token.js';
import { analysisDisabledResponse, isDermiqAnalysisEnabled } from '../lib/analysis-policy.js';

const BASE_URL = 'https://dev.dermiq.cloud';

export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Metodo non consentito', { status: 405 });
  if (!isDermiqAnalysisEnabled()) return analysisDisabledResponse();
  const apiKey = process.env.DERMIQ_API_KEY;
  if (!apiKey) return new Response('Servizio non configurato', { status: 503 });
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const name = url.searchParams.get('name') || '';
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || !/^[a-zA-Z0-9_.-]+\.png$/i.test(name)) return new Response('Parametri non validi', { status: 400 });
  const scanToken = request.headers.get('x-routinegentile-token');
  if (!(await verifyScanToken(id, scanToken, apiKey))) return new Response('Sessione non valida', { status: 403 });

  try {
    const upstream = await fetch(`${BASE_URL}/v1/results/${encodeURIComponent(id)}/masks/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    if (!upstream.ok) return new Response('Mappa non disponibile', { status: upstream.status });
    return new Response(upstream.body, {
      status: 200,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' }
    });
  } catch {
    return new Response('Mappa non disponibile', { status: 502 });
  }
}
