export function median(values) {
  if (!Array.isArray(values) || !values.length || !values.every(Number.isFinite)) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function ageRange(estimatedAge, observations = 1) {
  if (!Number.isFinite(estimatedAge)) return { lower: null, upper: null };
  const margin = observations >= 3 ? 4 : 5;
  return {
    lower: Math.max(18, Math.round(estimatedAge) - margin),
    upper: Math.min(100, Math.round(estimatedAge) + margin)
  };
}

export function stabilizeMetrics(current, history) {
  const recent = Array.isArray(history) ? history.slice(-2) : [];
  return current.map((metric) => {
    const previous = recent
      .map((entry) => entry.metrics?.find((item) => item.key === metric.key)?.score)
      .filter(Number.isFinite);
    const values = [...previous, metric.score].filter(Number.isFinite);
    return { ...metric, stableScore: Math.round(median(values)), observations: values.length };
  });
}

export function stabilityLevel(variation) {
  if (!Number.isFinite(variation)) return 'non misurabile';
  if (variation <= 4) return 'buona';
  if (variation <= 8) return 'media';
  return 'bassa';
}
