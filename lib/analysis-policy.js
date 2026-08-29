// The photo-analysis path is deliberately active again. Keep a server-side
// emergency switch so it can be stopped without exposing or rotating the key.
export function isDermiqAnalysisEnabled() {
  return process.env.DERMIQ_ANALYSIS_ENABLED !== 'false';
}

export function noStoreHeaders(headers = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
    ...headers
  };
}

export function analysisDisabledResponse() {
  return Response.json({
    error: 'Le analisi DermIQ non sono disponibili nella beta pubblica di RoutineGentile.',
    code: 'DERMIQ_ANALYSIS_DISABLED',
    analysisEnabled: false,
    creditsConsumed: false
  }, {
    status: 503,
    headers: noStoreHeaders()
  });
}
