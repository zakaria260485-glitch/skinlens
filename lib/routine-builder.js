const SKIN_TYPES = new Set(['dry', 'normal', 'combination', 'oily', 'unsure']);
const SENSITIVITY_LEVELS = new Set(['yes', 'sometimes', 'no']);
const GOALS = new Set(['comfort', 'blemishes', 'texture', 'lines', 'maintain']);
const YES_NO = new Set(['yes', 'no']);

export const requiredProfileFields = Object.freeze([
  'skinType',
  'sensitivity',
  'goal',
  'activeUse',
  'knownReactions',
  'adultConsent'
]);

export function validateRoutineProfile(profile = {}) {
  const errors = [];
  if (!SKIN_TYPES.has(profile.skinType)) errors.push('skinType');
  if (!SENSITIVITY_LEVELS.has(profile.sensitivity)) errors.push('sensitivity');
  if (!GOALS.has(profile.goal)) errors.push('goal');
  if (!YES_NO.has(profile.activeUse)) errors.push('activeUse');
  if (!YES_NO.has(profile.knownReactions)) errors.push('knownReactions');
  if (profile.adultConsent !== true) errors.push('adultConsent');
  return { valid: errors.length === 0, errors };
}

const TYPE_COPY = Object.freeze({
  dry: {
    label: 'secca',
    cleanser: 'Detergente cremoso delicato, senza effetto sgrassante',
    moisturizer: 'Crema idratante dalla consistenza ricca'
  },
  normal: {
    label: 'normale',
    cleanser: 'Detergente delicato',
    moisturizer: 'Lozione o crema idratante leggera'
  },
  combination: {
    label: 'mista',
    cleanser: 'Detergente delicato, senza insistere sulle zone più asciutte',
    moisturizer: 'Lozione idratante leggera, modulata per zona'
  },
  oily: {
    label: 'grassa',
    cleanser: 'Gel detergente delicato, non sgrassante',
    moisturizer: 'Gel-crema idratante leggero'
  },
  unsure: {
    label: 'non definita',
    cleanser: 'Detergente delicato essenziale',
    moisturizer: 'Idratante semplice dalla consistenza leggera'
  }
});

const GOAL_GUIDANCE = Object.freeze({
  comfort: {
    label: 'comfort e semplicità',
    note: 'Mantieni pochi passaggi e scegli formule semplici che risultino confortevoli durante l’uso.'
  },
  blemishes: {
    label: 'lucidità e aspetto delle imperfezioni',
    note: 'Evita la sovra-detersione e non manipolare le imperfezioni; la routine resta essenziale.'
  },
  texture: {
    label: 'aspetto di texture e pori',
    note: 'Evita scrub ruvidi e sfregamenti; costanza e delicatezza hanno priorità.'
  },
  lines: {
    label: 'idratazione e protezione',
    note: 'Dai priorità all’idratazione regolare e alla protezione solare quotidiana.'
  },
  maintain: {
    label: 'mantenimento essenziale',
    note: 'Non aggiungere passaggi se la routine attuale è ben tollerata.'
  }
});

export function buildRoutine(profile) {
  const validation = validateRoutineProfile(profile);
  if (!validation.valid) {
    const error = new TypeError(`Profilo incompleto: ${validation.errors.join(', ')}`);
    error.fields = validation.errors;
    throw error;
  }

  const type = TYPE_COPY[profile.skinType];
  const goal = GOAL_GUIDANCE[profile.goal];
  const sensitive = profile.sensitivity !== 'no';
  const alreadyUsingActives = profile.activeUse === 'yes';
  const reactionsKnown = profile.knownReactions === 'yes';
  const minimalMode = sensitive || alreadyUsingActives || reactionsKnown;

  const morning = [];
  if (!minimalMode) morning.push(`${type.cleanser} · risciacqua con acqua tiepida`);
  morning.push(`${type.moisturizer}${sensitive ? ', preferibilmente senza profumo' : ''}`);
  morning.push('Protezione solare ad ampio spettro SPF 30 o superiore · applica come indicato in etichetta');

  const evening = [
    `${type.cleanser} · senza spazzole o sfregamenti`,
    `${type.moisturizer}${sensitive ? ', preferibilmente senza profumo' : ''}`
  ];

  const cautions = [
    goal.note,
    'Introduci un solo prodotto nuovo alla volta e sospendilo se compare irritazione.'
  ];

  if (minimalMode) {
    cautions.push('Per ridurre i passaggi, al mattino evita il detergente; usa acqua tiepida solo se ne senti la necessità.');
  }

  if (profile.sensitivity === 'yes') {
    cautions.push('Hai indicato sensibilità frequente: mantieni la versione minima e prova ogni novità su una piccola area.');
  } else if (profile.sensitivity === 'sometimes') {
    cautions.push('Hai indicato sensibilità occasionale: nei periodi reattivi usa soltanto detergente, idratante e protezione solare.');
  } else {
    cautions.push('Anche senza sensibilità dichiarata, evita di introdurre più novità insieme.');
  }

  if (alreadyUsingActives) {
    cautions.push('Hai già indicato attivi o terapie: RoutineGentile non ne aggiunge altri e non modifica una terapia prescritta.');
  } else {
    cautions.push('Non hai indicato attivi o terapie: questa routine resta volutamente priva di ingredienti intensivi.');
  }

  if (reactionsKnown) {
    cautions.push('Hai indicato reazioni note: controlla l’elenco ingredienti dei prodotti e chiedi consiglio professionale prima di una novità.');
  } else {
    cautions.push('Non hai indicato reazioni note: esegui comunque una prova su una piccola area.');
  }

  return Object.freeze({
    summary: `Pelle ${type.label} · preferenza: ${goal.label}`,
    morning: Object.freeze(morning),
    evening: Object.freeze(evening),
    cautions: Object.freeze(cautions),
    minimalMode,
    selections: Object.freeze({
      skinType: type.label,
      sensitivity: profile.sensitivity,
      goal: goal.label,
      activeUse: profile.activeUse,
      knownReactions: profile.knownReactions
    })
  });
}
