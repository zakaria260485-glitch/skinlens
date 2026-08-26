export const FACIAL_HAIR_SENSITIVE = new Set(['hd_acne', 'hd_pore', 'hd_redness', 'hd_oiliness', 'hd_texture', 'hd_firmness']);

const MASK_RULES = [
  { key: 'hd_wrinkle', pattern: /^hd_wrinkle_output_(forehead|crowfeet|periocular|glabellar|all)\.png$/i, label: 'Linee visibili', beardSafe: (name) => !/_all\.png$/i.test(name) },
  { key: 'hd_pore', pattern: /^hd_pore_output_(nose|forehead|cheek|all)\.png$/i, label: 'Pori visibili', beardSafe: false },
  { key: 'hd_redness', pattern: /^hd_redness_output\.png$/i, label: 'Rossore', beardSafe: false },
  { key: 'hd_oiliness', pattern: /^hd_oiliness_output\.png$/i, label: 'Oleosità', beardSafe: false },
  { key: 'hd_texture', pattern: /^hd_texture_output\.png$/i, label: 'Texture', beardSafe: false },
  { key: 'hd_acne', pattern: /^hd_acne_output\.png$/i, label: 'Imperfezioni', beardSafe: false },
  { key: 'hd_dark_circles', pattern: /^hd_dark_circles?_output\.png$/i, label: 'Occhiaie', beardSafe: true }
];

export function describeMask(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_.-]+\.png$/i.test(name)) return null;
  return MASK_RULES.find((rule) => rule.pattern.test(name)) || null;
}

export function isMaskBeardSafe(descriptor, name) {
  return typeof descriptor?.beardSafe === 'function' ? descriptor.beardSafe(name) : descriptor?.beardSafe === true;
}

export function selectPriorityMasks(masks, priorities, facialHair) {
  const priorityKeys = new Set(priorities.filter((item) => item.observations >= 2 && item.stableScore < 75).map((item) => item.key));
  const hasFacialHair = facialHair !== 'none';
  const eligible = masks
    .map((name) => ({ name, descriptor: describeMask(name) }))
    .filter(({ name, descriptor }) => descriptor && priorityKeys.has(descriptor.key) && (!hasFacialHair || isMaskBeardSafe(descriptor, name)))
    .sort((a, b) => maskRank(a.name, hasFacialHair) - maskRank(b.name, hasFacialHair));
  const selected = [];
  for (const priority of priorities) {
    const match = eligible.find(({ descriptor }) => descriptor.key === priority.key && !selected.some((item) => item.descriptor.key === descriptor.key));
    if (match) selected.push(match);
  }
  return selected.slice(0, 3);
}

export function selectReliablePriorities(metrics, facialHair) {
  const hasFacialHair = facialHair !== 'none';
  return metrics
    .filter((item) => Number.isFinite(item.stableScore) && item.stableScore < 75 && !(hasFacialHair && FACIAL_HAIR_SENSITIVE.has(item.key)))
    .sort((a, b) => a.stableScore - b.stableScore)
    .slice(0, 3);
}

function maskRank(name, hasFacialHair) {
  const normalized = name.toLowerCase();
  if (hasFacialHair) {
    if (normalized.includes('_forehead.png')) return 0;
    if (normalized.includes('_crowfeet.png') || normalized.includes('_periocular.png')) return 1;
    if (normalized.includes('_glabellar.png')) return 2;
  }
  if (normalized.includes('_all.png') || !/_output_[a-z]+\.png$/i.test(normalized)) return 0;
  return 1;
}

export function maskLabel(descriptor, name) {
  const zones = { forehead: 'fronte', crowfeet: 'contorno occhi', periocular: 'zona perioculare', glabellar: 'tra le sopracciglia', nose: 'naso', cheek: 'guance', all: 'viso' };
  const zone = Object.entries(zones).find(([key]) => name.toLowerCase().includes(`_${key}.png`))?.[1];
  return zone ? `${descriptor.label} · ${zone}` : descriptor.label;
}
