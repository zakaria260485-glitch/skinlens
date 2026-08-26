export const config = { runtime: 'edge' };

import { verifyScanToken } from '../lib/scan-token.js';
import { analysisDisabledResponse, isDermiqAnalysisEnabled, noStoreHeaders } from '../lib/analysis-policy.js';

const BASE_URL = 'https://dev.dermiq.cloud';

function json(body, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders() });
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Metodo non consentito.' }, 405);
  if (!isDermiqAnalysisEnabled()) return analysisDisabledResponse();
  const apiKey = process.env.DERMIQ_API_KEY;
  if (!apiKey) return json({ error: 'RoutineGentile non è collegato a servizi di analisi.' }, 503);

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) return json({ error: 'Identificativo di analisi non valido.' }, 400);
  const scanToken = request.headers.get('x-routinegentile-token');
  if (!(await verifyScanToken(id, scanToken, apiKey))) return json({ error: 'Sessione di analisi scaduta o non valida.' }, 403);

  try {
    const resultResponse = await fetch(`${BASE_URL}/v1/results/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store'
    });
    const result = await resultResponse.json().catch(() => ({}));
    if (!resultResponse.ok) return dermiqError(resultResponse.status, result);
    if (result.status === 'failed') {
      return json({ error: result.message || 'DermIQ non è riuscito ad analizzare questa foto. Prova con luce migliore e viso frontale.' }, 422);
    }
    const safeResult = {
      id, analysis_id: id,
      status: result.status || 'processing',
      overall_score: result.overall_score,
      skin_age: result.skin_age,
      result_json: result.result_json,
      mask_filenames: Array.isArray(result.mask_filenames) ? result.mask_filenames : []
    };
    if (result.status === 'completed') return json(safeResult);
    return json(safeResult, 202);
  } catch (error) {
    console.error('RoutineGentile results error', error instanceof Error ? error.message : error);
    return json({ error: 'Il servizio di analisi non è momentaneamente raggiungibile.' }, 502);
  }
}

function dermiqError(status, body) {
  if (status === 401) return json({ error: 'La chiave DermIQ configurata non è valida.' }, 502);
  if (status === 403) return json({ error: 'I crediti DermIQ sono esauriti.' }, 402);
  if (status === 429) return json({ error: 'Troppe richieste ravvicinate. Attendi un minuto e riprova.' }, 429);
  return json({ error: body?.detail || body?.message || 'DermIQ ha restituito un errore.' }, 502);
}
