export const config = { runtime: 'edge' };

import { createScanToken } from '../lib/scan-token.js';
import { analysisDisabledResponse, isDermiqAnalysisEnabled, noStoreHeaders } from '../lib/analysis-policy.js';

const BASE_URL = 'https://dev.dermiq.cloud';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SCANS_PER_WINDOW = 6;
const rateBuckets = globalThis.__routinegentileRateBuckets || new Map();
globalThis.__routinegentileRateBuckets = rateBuckets;

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: noStoreHeaders(headers)
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Metodo non consentito.' }, 405);
  if (!isDermiqAnalysisEnabled()) return analysisDisabledResponse();
  const apiKey = process.env.DERMIQ_API_KEY;
  if (!apiKey) return json({ error: 'RoutineGentile non è collegato a servizi di analisi.' }, 503);
  if (!isSameOrigin(request)) return json({ error: 'Richiesta non autorizzata.' }, 403);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 11 * 1024 * 1024) return json({ error: 'La richiesta supera il limite consentito.' }, 413);
  const limited = checkRateLimit(request);
  if (limited) return limited;

  try {
    const incoming = await request.formData();
    const file = incoming.get('file');
    const age = Number(incoming.get('age'));
    if (!(file instanceof File)) return json({ error: 'Foto mancante.' }, 400);
    if (!Number.isInteger(age) || age < 18 || age > 100) return json({ error: 'Età reale non valida.' }, 400);
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return json({ error: 'Formato immagine non supportato.' }, 415);
    if (file.size > 10 * 1024 * 1024) return json({ error: 'La foto supera il limite di 10 MB.' }, 413);
    if (file.size < 20 * 1024 || !(await hasValidImageSignature(file))) return json({ error: 'Il file non sembra essere una foto valida.' }, 415);

    const form = new FormData();
    form.append('file', file, file.name || 'routinegentile-photo.jpg');
    form.append('age_override', String(age));
    const submitted = await fetch(`${BASE_URL}/v1/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(20000)
    });
    const submission = await submitted.json().catch(() => ({}));
    if (!submitted.ok) return dermiqError(submitted.status, submission);
    const id = submission.analysis_id || submission.id;
    if (!id) return json({ error: 'DermIQ non ha restituito un identificativo di analisi.' }, 502);
    const scanToken = await createScanToken(id, apiKey);

    // DermIQ elabora la foto in modo asincrono. Restituiamo subito l'ID per
    // evitare il limite di 25 secondi delle Edge Function; il browser controllerà
    // lo stato tramite /api/results.
    return json({ analysis_id: id, id, scan_token: scanToken, status: submission.status || 'processing' }, 202);
  } catch (error) {
    console.error('RoutineGentile analyze error', error instanceof Error ? error.message : error);
    return json({ error: 'Il servizio di analisi non è momentaneamente raggiungibile.' }, 502);
  }
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === ownOrigin && (!fetchSite || fetchSite === 'same-origin');
}

function checkRateLimit(request) {
  const now = Date.now();
  const forwarded = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const ip = forwarded.split(',')[0].trim();
  const recent = (rateBuckets.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_SCANS_PER_WINDOW) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    rateBuckets.set(ip, recent);
    return json({ error: 'Hai raggiunto il limite temporaneo di analisi. Attendi qualche minuto.' }, 429, { 'Retry-After': String(retryAfter) });
  }
  recent.push(now);
  rateBuckets.set(ip, recent);
  if (rateBuckets.size > 1000) {
    for (const [key, timestamps] of rateBuckets) {
      if (!timestamps.some((timestamp) => now - timestamp < WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return null;
}

async function hasValidImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return jpeg || png || webp;
}

function dermiqError(status, body) {
  if (status === 401) return json({ error: 'La chiave DermIQ configurata non è valida.' }, 502);
  if (status === 403) return json({ error: 'I crediti DermIQ sono esauriti.' }, 402);
  if (status === 413) return json({ error: 'La foto è troppo grande per DermIQ.' }, 413);
  if (status === 429) return json({ error: 'Troppe analisi ravvicinate. Attendi un minuto e riprova.' }, 429);
  return json({ error: body?.detail || body?.message || 'DermIQ ha restituito un errore.' }, 502);
}
