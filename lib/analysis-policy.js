// RoutineGentile is a questionnaire-only public beta. DermIQ can only be restored
// through a reviewed code change after independent validation, never through a
// forgotten or accidentally inherited environment variable.
export function isDermiqAnalysisEnabled() {
  return false;
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
