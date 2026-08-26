export const config = { runtime: 'edge' };

import { isDermiqAnalysisEnabled, noStoreHeaders } from '../lib/analysis-policy.js';

export default function handler() {
  const configured = Boolean(process.env.DERMIQ_API_KEY);

  return Response.json({
    ok: true,
    service: 'routinegentile-backend',
    configured,
    analysisEnabled: configured && isDermiqAnalysisEnabled()
  }, {
    headers: noStoreHeaders()
  });
}
