import { buildRoutine, validateRoutineProfile } from './lib/routine-builder.js';

const completionPath = '/routine-creata';
if (location.pathname === completionPath && !history.state?.routineCreated) {
  history.replaceState({}, '', '/');
}

const $ = (selector) => document.querySelector(selector);
const ui = {
  form: $('#profileForm'),
  skinType: $('#skinType'),
  sensitivity: $('#sensitivity'),
  goal: $('#skinGoal'),
  activeUse: $('#activeUse'),
  knownReactions: $('#knownReactions'),
  adultConsent: $('#adultConsent'),
  build: $('#buildRoutineBtn'),
  formMessage: $('#formMessage'),
  results: $('#results'),
  newRoutine: $('#newRoutineBtn'),
  routineSummary: $('#routineSummary'),
  routineMode: $('#routineMode'),
  selectionChips: $('#selectionChips'),
  morning: $('#morningRoutine'),
  evening: $('#eveningRoutine'),
  cautions: $('#routineCautions'),
  photoInput: $('#photoInput'),
  photoIntro: $('#photoIntro'),
  startCamera: $('#startCameraBtn'),
  chooseFile: $('#chooseFileBtn'),
  guidedCamera: $('#guidedCamera'),
  video: $('#cameraVideo'),
  cameraQuality: $('#cameraQuality'),
  takePhoto: $('#takePhotoBtn'),
  cancelCamera: $('#cancelCameraBtn'),
  photoReview: $('#photoReview'),
  photoPreview: $('#photoPreview'),
  qualityChecks: $('#qualityChecks'),
  qualityAdvice: $('#qualityAdvice'),
  clearPhoto: $('#clearPhotoBtn'),
  photoMessage: $('#photoMessage')
};

let mediaStream = null;
let liveFrameId = 0;
let cameraSession = 0;
let localPhoto = null;
let previewUrl = '';
let qualityCanvas = null;

function getProfile() {
  return {
    skinType: ui.skinType.value,
    sensitivity: ui.sensitivity.value,
    goal: ui.goal.value,
    activeUse: ui.activeUse.value,
    knownReactions: ui.knownReactions.value,
    adultConsent: ui.adultConsent.checked
  };
}

function updateReady() {
  ui.build.disabled = !validateRoutineProfile(getProfile()).valid;
  if (!ui.build.disabled) ui.formMessage.textContent = '';
}

ui.form.addEventListener('input', updateReady);
ui.form.addEventListener('change', updateReady);
ui.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = getProfile();
  const state = validateRoutineProfile(profile);
  if (!state.valid) {
    ui.formMessage.textContent = 'Completa tutti i campi obbligatori prima di continuare.';
    ui.form.reportValidity();
    return;
  }
  renderRoutine(buildRoutine(profile));
  if (location.pathname !== completionPath) {
    history.pushState({ routineCreated: true }, '', completionPath);
  }
});

ui.newRoutine.addEventListener('click', () => {
  ui.results.hidden = true;
  if (location.pathname !== '/') history.pushState({}, '', '/');
  ui.skinType.focus({ preventScroll: true });
  scrollToElement($('#profileTitle'));
});

window.addEventListener('popstate', () => {
  const canShowRoutine = location.pathname === completionPath
    && history.state?.routineCreated
    && Boolean(ui.routineSummary.textContent);
  ui.results.hidden = !canShowRoutine;
  if (canShowRoutine) scrollToElement(ui.results);
});

function renderRoutine(routine) {
  ui.routineSummary.textContent = routine.summary;
  ui.routineMode.textContent = routine.minimalMode
    ? 'Le tue risposte attivano la versione minima: meno prodotti al mattino e più cautele.'
    : 'Le tue risposte permettono la routine essenziale completa, senza passaggi intensivi.';
  ui.morning.replaceChildren(...routine.morning.map(routineItem));
  ui.evening.replaceChildren(...routine.evening.map(routineItem));
  ui.cautions.replaceChildren(...routine.cautions.map(routineItem));

  const labels = {
    sensitivity: { yes: 'Sensibilità: frequente', sometimes: 'Sensibilità: a volte', no: 'Sensibilità: no' },
    activeUse: { yes: 'Attivi o terapie: sì', no: 'Attivi o terapie: no' },
    knownReactions: { yes: 'Reazioni note: sì', no: 'Reazioni note: no' }
  };
  const chips = [
    `Pelle: ${routine.selections.skinType}`,
    labels.sensitivity[routine.selections.sensitivity],
    `Preferenza: ${routine.selections.goal}`,
    labels.activeUse[routine.selections.activeUse],
    labels.knownReactions[routine.selections.knownReactions]
  ];
  ui.selectionChips.replaceChildren(...chips.map((label) => {
    const chip = document.createElement('span');
    chip.textContent = label;
    return chip;
  }));

  ui.results.hidden = false;
  ui.results.focus({ preventScroll: true });
  scrollToElement(ui.results);
}

function routineItem(text) {
  const item = document.createElement('li');
  item.textContent = text;
  return item;
}

function scrollToElement(element) {
  element.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start'
  });
}

ui.chooseFile.addEventListener('click', () => ui.photoInput.click());
ui.photoInput.addEventListener('change', async () => {
  const file = ui.photoInput.files?.[0];
  if (file) await useLocalPhoto(file);
});
ui.startCamera.addEventListener('click', startCamera);
ui.cancelCamera.addEventListener('click', () => {
  stopCamera();
  showPhotoIntro();
});
ui.takePhoto.addEventListener('click', takeCameraPhoto);
ui.clearPhoto.addEventListener('click', clearPhoto);

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setPhotoMessage('La fotocamera non è disponibile in questo browser. Puoi scegliere una foto dalla galleria.');
    return;
  }
  stopCamera();
  const session = ++cameraSession;
  setPhotoMessage('');
  ui.startCamera.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }
    });
    if (session !== cameraSession || document.hidden) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    mediaStream = stream;
    ui.video.srcObject = stream;
    ui.photoIntro.hidden = true;
    ui.photoReview.hidden = true;
    ui.guidedCamera.hidden = false;
    await ui.video.play();
    startLiveQuality(session);
  } catch {
    stopCamera();
    showPhotoIntro();
    setPhotoMessage('Non riesco ad aprire la fotocamera. Consenti l’accesso oppure scegli una foto dalla galleria.');
  } finally {
    ui.startCamera.disabled = false;
  }
}

function startLiveQuality(session) {
  let lastSample = 0;
  const sample = (time) => {
    if (session !== cameraSession || !mediaStream || ui.guidedCamera.hidden) return;
    if (time - lastSample > 320 && ui.video.videoWidth > 0) {
      lastSample = time;
      const { brightness, sharpness } = sampleVisual(ui.video, ui.video.videoWidth, ui.video.videoHeight, 180);
      ui.cameraQuality.textContent = liveQualityMessage(brightness, sharpness);
    }
    liveFrameId = requestAnimationFrame(sample);
  };
  liveFrameId = requestAnimationFrame(sample);
}

function liveQualityMessage(brightness, sharpness) {
  if (brightness < 58) return 'L’immagine è scura · avvicinati a una luce diffusa.';
  if (brightness > 220) return 'La luce è molto forte · evita una fonte diretta.';
  if (sharpness < 8) return 'Tieni il telefono più fermo e pulisci la lente.';
  return 'Luce e stabilità sembrano adatte allo scatto.';
}

async function takeCameraPhoto() {
  if (!ui.video.videoWidth) {
    setPhotoMessage('La fotocamera si sta avviando. Attendi un istante.');
    return;
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / ui.video.videoWidth);
  canvas.width = Math.round(ui.video.videoWidth * scale);
  canvas.height = Math.round(ui.video.videoHeight * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(ui.video, 0, 0, canvas.width, canvas.height);
  try {
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    stopCamera();
    await useLocalPhoto(blob);
  } catch {
    setPhotoMessage('Non sono riuscito a creare lo scatto. Riprova tenendo fermo il telefono.');
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function useLocalPhoto(file) {
  setPhotoMessage('');
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) {
    setPhotoMessage('Scegli una foto JPEG, PNG o WebP.');
    ui.photoInput.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setPhotoMessage('La foto supera 10 MB. Scegline una più leggera.');
    ui.photoInput.value = '';
    return;
  }

  clearPhotoResources();
  localPhoto = file;
  previewUrl = URL.createObjectURL(file);
  ui.photoPreview.src = previewUrl;
  ui.photoIntro.hidden = true;
  ui.guidedCamera.hidden = true;
  ui.photoReview.hidden = false;
  ui.qualityChecks.replaceChildren();
  ui.qualityAdvice.textContent = 'Controllo tecnico in corso…';
  try {
    renderPhotoQuality(await assessPhotoQuality(file));
  } catch {
    clearPhotoResources();
    ui.photoInput.value = '';
    showPhotoIntro();
    setPhotoMessage('Non sono riuscito a leggere la foto. Scegline un’altra.');
  }
}

async function assessPhotoQuality(file) {
  const decoded = await decodeImage(file);
  try {
    const { brightness, sharpness } = sampleVisual(decoded.source, decoded.width, decoded.height, 360);
    const checks = [
      {
        label: 'Risoluzione',
        pass: Math.min(decoded.width, decoded.height) >= 720,
        detail: `${decoded.width} × ${decoded.height} px`
      },
      {
        label: 'Luce generale',
        pass: brightness >= 58 && brightness <= 220,
        detail: brightness < 58 ? 'Immagine scura' : brightness > 220 ? 'Luce molto forte' : 'Bilanciata'
      },
      {
        label: 'Nitidezza generale',
        pass: sharpness >= 8,
        detail: sharpness >= 8 ? 'Adeguata' : 'Possibile movimento o lente sporca'
      }
    ];
    return { checks, pass: checks.every((check) => check.pass) };
  } finally {
    decoded.close();
  }
}

function renderPhotoQuality(report) {
  ui.qualityChecks.replaceChildren(...report.checks.map((check) => {
    const item = document.createElement('li');
    item.className = check.pass ? 'pass' : 'retry';
    const status = document.createElement('b');
    status.textContent = check.pass ? '✓' : '!';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = check.label;
    const detail = document.createElement('small');
    detail.textContent = check.detail;
    copy.append(title, detail);
    item.append(status, copy);
    return item;
  }));
  ui.qualityAdvice.textContent = report.pass
    ? 'Lo scatto è tecnicamente chiaro. Questo controllo non modifica la routine.'
    : 'Per esercitarti, riprova con luce diffusa, lente pulita e telefono fermo.';
}

function sampleVisual(source, sourceWidth, sourceHeight, maxSide) {
  qualityCanvas ||= document.createElement('canvas');
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(2, Math.round(sourceWidth * scale));
  const height = Math.max(2, Math.round(sourceHeight * scale));
  qualityCanvas.width = width;
  qualityCanvas.height = height;
  const context = qualityCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let luminanceTotal = 0;
  let edgeTotal = 0;
  let previous = 0;
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
    luminanceTotal += luminance;
    if (pixel % width !== 0) edgeTotal += Math.abs(luminance - previous);
    previous = luminance;
  }
  const count = width * height;
  return { brightness: luminanceTotal / count, sharpness: edgeTotal / Math.max(1, count - height) };
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => { image.removeAttribute('src'); URL.revokeObjectURL(url); }
    };
  } catch (error) {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Immagine non disponibile'));
  }, type, quality));
}

function stopCamera() {
  cameraSession += 1;
  if (liveFrameId) cancelAnimationFrame(liveFrameId);
  liveFrameId = 0;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  ui.video.pause();
  ui.video.srcObject = null;
}

function showPhotoIntro() {
  ui.guidedCamera.hidden = true;
  ui.photoReview.hidden = true;
  ui.photoIntro.hidden = false;
}

function clearPhotoResources() {
  localPhoto = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  ui.photoPreview.removeAttribute('src');
}

function clearPhoto() {
  stopCamera();
  clearPhotoResources();
  ui.photoInput.value = '';
  ui.qualityChecks.replaceChildren();
  ui.qualityAdvice.textContent = '';
  setPhotoMessage('');
  showPhotoIntro();
}

function setPhotoMessage(text) {
  ui.photoMessage.textContent = text;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaStream) {
    stopCamera();
    showPhotoIntro();
  }
});
window.addEventListener('pagehide', () => {
  stopCamera();
  clearPhotoResources();
  qualityCanvas = null;
});

updateReady();
