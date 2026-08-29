import { ageRange, median, stabilityLevel, stabilizeMetrics } from './lib/result-math.js';
import { FACIAL_HAIR_SENSITIVE, maskLabel, selectPriorityMasks, selectReliablePriorities } from './lib/mask-policy.js';

const $ = (selector) => document.querySelector(selector);

const ui = {
  input: $('#photoInput'), captureIntro: $('#captureIntro'), startCamera: $('#startCameraBtn'),
  chooseFile: $('#chooseFileBtn'), guidedCamera: $('#guidedCamera'), video: $('#cameraVideo'), direction: $('#directionArrow'),
  faceOval: $('#faceOval'), captureStep: $('#captureStep'), cameraTitle: $('#cameraTitle'), cameraCopy: $('#cameraCopy'),
  cameraQuality: $('#cameraQuality'), takePhoto: $('#takePhotoBtn'),
  cancelCamera: $('#cancelCameraBtn'), captureReview: $('#captureReview'), redoPhotos: $('#redoPhotosBtn'),
  frontThumb: $('#frontThumb'), leftThumb: $('#leftThumb'), rightThumb: $('#rightThumb'), captureTitle: $('#captureCompleteTitle'),
  captureNote: $('#captureNote'), qualityPanel: $('#qualityPanel'), qualityTitle: $('#qualityTitle'),
  qualityChecks: $('#qualityChecks'), qualityAdvice: $('#qualityAdvice'), resultQuality: $('#resultQuality'),
  resultCompleteness: $('#resultCompleteness'), stabilitySummary: $('#stabilitySummary'),
  age: $('#actualAge'), reportedAge: $('#reportedAge'), ageDifference: $('#ageDifference'),
  skinType: $('#skinType'), skinGoal: $('#skinGoal'), sensitivity: $('#sensitivity'), pregnancy: $('#pregnancy'), facialHair: $('#facialHair'),
  profileSummary: $('#profileSummary'), profileReason: $('#profileReason'),
  consent: $('#consent'), analyze: $('#analyzeBtn'), resume: $('#resumeAnalysisBtn'), message: $('#formMessage'), apiStatus: $('#apiStatus'),
  scanner: $('.scanner'), loading: $('#loadingPanel'), progress: $('#progressBar'), progressTrack: $('#progressTrack'), results: $('#results'),
  score: $('#overallScore'), scoreRing: $('#scoreRing'), headline: $('#scoreHeadline'), scoreDescription: $('#scoreDescription'),
  skinAge: $('#skinAge'), metrics: $('#metricsGrid'), priorities: $('#priorityList'), morning: $('#morningRoutine'),
  evening: $('#eveningRoutine'), newScan: $('#newScanBtn'), progressPanel: $('#progressPanel'), progressCopy: $('#progressCopy'),
  progressComparison: $('#progressComparison'), clearHistory: $('#clearHistoryBtn'), maskPanel: $('#maskPanel'), maskImage: $('#maskImage'),
  maskSelect: $('#maskSelect'), maskLoading: $('#maskLoading'), maskExplanation: $('#maskExplanation'), maskFootnote: $('#maskFootnote')
};

const PENDING_KEY = 'routinegentile-pending-analysis-v2';
const HISTORY_KEY = 'routinegentile-skin-history-v2';
const PENDING_MAX_AGE = 29 * 60 * 1000;

let selectedFile = null;
let currentAnalysisId = null;
let currentScanToken = null;
let mediaStream = null;
let liveQualityTimer = null;
let liveQualityBusy = false;
let captureIndex = 0;
let capturedAngles = {};
let qualityReport = null;
let qualityApproved = false;
let previewUrls = [];
let maskObjectUrl = null;

const captureSteps = [
  { key: 'front', title: 'Guarda avanti', copy: 'Centra occhi, naso e mento dentro l’ovale.', arrow: '↑' },
  { key: 'left', title: 'Porta il naso verso la spalla sinistra', copy: 'Muovi il viso lentamente e mantieni le spalle ferme.', arrow: '←' },
  { key: 'right', title: 'Porta il naso verso la spalla destra', copy: 'Mantieni guancia e mandibola dentro l’ovale.', arrow: '→' }
];

const metricDefs = [
  ['Imperfezioni visibili', 'hd_acne', 'Uniformità e aspetto delle imperfezioni'], ['Linee visibili', 'hd_wrinkle', 'Linee e segni visibili'],
  ['Pori', 'hd_pore', 'Visibilità dei pori'], ['Rossore', 'hd_redness', 'Uniformità del colorito'],
  ['Oleosità', 'hd_oiliness', 'Equilibrio del sebo'], ['Texture', 'hd_texture', 'Levigatezza superficiale'],
  ['Occhiaie', 'hd_dark_circles', 'Aspetto del contorno occhi'], ['Compattezza', 'hd_firmness', 'Elasticità percepita']
];

const advice = {
  hd_acne: ['Imperfezioni', 'Punta su detersione delicata e formule non comedogene; gli attivi vanno introdotti gradualmente.'],
  hd_wrinkle: ['Linee visibili', 'Protezione solare, idratazione e sostegno della barriera sono la base più prudente.'],
  hd_pore: ['Pori visibili', 'Evita scrub aggressivi; niacinamide e una routine costante possono sostenere l’uniformità.'],
  hd_redness: ['Rossore', 'Riduci i passaggi, scegli formule senza profumo e privilegia ceramidi e ingredienti lenitivi.'],
  hd_oiliness: ['Equilibrio del sebo', 'Usa un detergente delicato e un idratante leggero senza sgrassare eccessivamente.'],
  hd_texture: ['Texture', 'Sostieni prima la barriera; valuta un’esfoliazione dolce solo se la pelle la tollera.'],
  hd_dark_circles: ['Contorno occhi', 'Protezione UV, sonno regolare e idratazione aiutano a mantenere uniforme la zona.'],
  hd_firmness: ['Compattezza', 'Protezione solare, antiossidanti e peptidi sono opzioni cosmetiche graduali.']
};

class PendingAnalysisError extends Error {
  constructor(message) { super(message); this.pending = true; }
}

function getProfile() {
  return { age: Number(ui.age.value), skinType: ui.skinType.value, goal: ui.skinGoal.value, sensitivity: ui.sensitivity.value, pregnancy: ui.pregnancy.value, facialHair: ui.facialHair.value };
}

function profileComplete(profile = getProfile()) {
  return Number.isInteger(profile.age) && profile.age >= 18 && profile.age <= 100 && Boolean(profile.skinType && profile.goal && profile.sensitivity && profile.pregnancy && profile.facialHair);
}

function updateReady() {
  const pending = getPendingAnalysis();
  ui.resume.hidden = !pending;
  ui.analyze.disabled = Boolean(pending) || !(selectedFile && qualityApproved && ui.consent.checked && profileComplete());
}

ui.input.addEventListener('change', async () => {
  const file = ui.input.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showMessage('Scegli una foto JPEG, PNG o WebP.');
  if (file.size > 10 * 1024 * 1024) return showMessage('La foto supera 10 MB. Scegline una più leggera.');
  clearCapturedPhotos();
  selectedFile = file;
  capturedAngles = { front: file };
  showCaptureReview(false);
  qualityReport = await assessImageQuality(file);
  renderQualityReport(qualityReport);
  qualityApproved = true;
  showMessage(qualityReport.pass ? '' : 'Foto accettata. Per risultati più leggibili, controlla i suggerimenti prima di continuare.');
  updateReady();
});

ui.startCamera.addEventListener('click', startGuidedCamera);
ui.chooseFile.addEventListener('click', () => ui.input.click());
ui.takePhoto.addEventListener('click', takeGuidedPhoto);
ui.cancelCamera.addEventListener('click', cancelGuidedCamera);
ui.redoPhotos.addEventListener('click', startGuidedCamera);
[ui.age, ui.skinType, ui.skinGoal, ui.sensitivity, ui.pregnancy, ui.facialHair].forEach((control) => control.addEventListener('input', updateReady));
ui.consent.addEventListener('change', updateReady);
ui.analyze.addEventListener('click', runAnalysis);
ui.resume.addEventListener('click', resumePendingAnalysis);
ui.newScan.addEventListener('click', resetScan);
ui.clearHistory.addEventListener('click', clearHistory);
ui.maskSelect.addEventListener('change', () => loadMask(ui.maskSelect.value));
window.addEventListener('pagehide', () => { stopCamera(); clearCapturedPhotos(); revokeMaskUrl(); });

async function startGuidedCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showMessage('La fotocamera guidata non è disponibile qui. Puoi scegliere una foto dalla galleria.');
    return ui.input.click();
  }
  stopCamera();
  clearCapturedPhotos();
  resetQuality();
  showMessage('');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
    ui.video.srcObject = mediaStream;
    await ui.video.play();
    captureIndex = 0;
    ui.captureIntro.hidden = true;
    ui.captureReview.hidden = true;
    ui.guidedCamera.hidden = false;
    updateCameraInstruction();
    startLiveQualityMonitor();
    updateReady();
  } catch {
    stopCamera();
    ui.captureIntro.hidden = false;
    showMessage('Non riesco ad aprire la fotocamera. Consenti l’accesso oppure scegli una foto dalla galleria.');
  }
}

function updateCameraInstruction() {
  const step = captureSteps[captureIndex];
  ui.captureStep.textContent = `Foto ${captureIndex + 1} di ${captureSteps.length}`;
  ui.cameraTitle.textContent = step.title;
  ui.cameraCopy.textContent = step.copy;
  ui.direction.textContent = step.arrow;
  ui.takePhoto.disabled = true;
  ui.cameraQuality.textContent = 'Controllo luce e stabilità…';
  ui.faceOval.classList.remove('ready', 'warning');
}

function startLiveQualityMonitor() {
  clearInterval(liveQualityTimer);
  liveQualityTimer = setInterval(updateLiveQuality, 700);
  updateLiveQuality();
}

async function updateLiveQuality() {
  if (liveQualityBusy || !mediaStream || !ui.video.videoWidth) return;
  liveQualityBusy = true;
  try {
    const canvas = document.createElement('canvas');
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(ui.video, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const values = new Float32Array(size * size);
    let sum = 0;
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      const value = .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
      values[pixel] = value;
      sum += value;
    }
    const mean = sum / values.length;
    let edge = 0, count = 0;
    for (let y = 1; y < size; y += 1) {
      for (let x = 1; x < size; x += 1) {
        const index = y * size + x;
        edge += Math.abs(values[index] - values[index - 1]) + Math.abs(values[index] - values[index - size]);
        count += 2;
      }
    }
    const sharpness = edge / count;
    let issue = mean < 52 ? 'Serve più luce sul viso' : mean > 210 ? 'Luce troppo forte: evita il controluce' : sharpness < 4.5 ? 'Tieni fermo il telefono' : '';
    if (!issue && captureIndex === 0 && 'FaceDetector' in window) {
      try {
        const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }).detect(ui.video);
        if (faces.length !== 1) issue = faces.length ? 'Inquadra una sola persona' : 'Centra tutto il volto nell’ovale';
      } catch { /* il controllo finale verrà eseguito dopo lo scatto */ }
    }
    const ready = !issue;
    ui.takePhoto.disabled = !ready;
    ui.faceOval.classList.toggle('ready', ready);
    ui.faceOval.classList.toggle('warning', !ready);
    ui.cameraQuality.textContent = ready ? 'Inquadratura pronta · puoi scattare' : issue;
  } finally {
    liveQualityBusy = false;
  }
}

async function takeGuidedPhoto() {
  if (!ui.video.videoWidth) return showMessage('La fotocamera si sta avviando. Attendi un istante.');
  ui.takePhoto.disabled = true;
  showMessage('');
  try {
    const step = captureSteps[captureIndex];
    const file = await videoFrameToFile(step.key);
    if (step.key === 'front') {
      qualityReport = await assessImageQuality(file);
      renderQualityReport(qualityReport);
      qualityApproved = true;
      if (!qualityReport.pass) showMessage('Foto accettata. Per una lettura più stabile, controlla i suggerimenti prima dell’invio.');
    }
    capturedAngles[step.key] = file;
    setThumb(step.key, file);
    captureIndex += 1;
    if (captureIndex < captureSteps.length) return updateCameraInstruction();
    selectedFile = capturedAngles.front;
    stopCamera();
    showCaptureReview(true);
    updateReady();
  } catch {
    showMessage('Non sono riuscito a leggere lo scatto. Tieni fermo il telefono e riprova.');
    ui.takePhoto.disabled = false;
  }
}

async function videoFrameToFile(key) {
  const sourceWidth = ui.video.videoWidth;
  const sourceHeight = ui.video.videoHeight;
  const targetRatio = 4 / 5;
  let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
  if (sourceWidth / sourceHeight > targetRatio) { sw = sourceHeight * targetRatio; sx = (sourceWidth - sw) / 2; }
  else { sh = sourceWidth / targetRatio; sy = (sourceHeight - sh) / 2; }
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 1200;
  canvas.getContext('2d', { alpha: false }).drawImage(ui.video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, 'image/jpeg', .9);
  return new File([blob], `routinegentile-${key}.jpg`, { type: 'image/jpeg' });
}

function setThumb(key, file) {
  const image = key === 'front' ? ui.frontThumb : key === 'left' ? ui.leftThumb : ui.rightThumb;
  const url = URL.createObjectURL(file);
  previewUrls.push(url);
  image.src = url;
  image.parentElement.classList.add('ready');
}

function showCaptureReview(complete) {
  ui.captureIntro.hidden = true;
  ui.guidedCamera.hidden = true;
  ui.captureReview.hidden = false;
  ['front', 'left', 'right'].forEach((key) => {
    const file = capturedAngles[key];
    const image = key === 'front' ? ui.frontThumb : key === 'left' ? ui.leftThumb : ui.rightThumb;
    image.parentElement.classList.toggle('ready', Boolean(file));
    if (file && !image.getAttribute('src')) setThumb(key, file);
    if (!file) image.removeAttribute('src');
  });
  ui.captureTitle.textContent = complete ? 'Tre angoli completati' : 'Foto frontale pronta';
  ui.captureNote.textContent = complete ? 'Solo la foto frontale determina i punteggi DermIQ. Le viste laterali servono alla guida locale e non vengono inviate.' : 'Per la guida completa con avanti, sinistra e destra usa “Rifai le foto”.';
}

function cancelGuidedCamera() {
  stopCamera();
  clearCapturedPhotos();
  resetQuality();
  ui.guidedCamera.hidden = true;
  ui.captureReview.hidden = true;
  ui.captureIntro.hidden = false;
  updateReady();
}

function stopCamera() {
  clearInterval(liveQualityTimer);
  liveQualityTimer = null;
  liveQualityBusy = false;
  ui.faceOval?.classList.remove('ready', 'warning');
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (ui.video) ui.video.srcObject = null;
}

function clearCapturedPhotos() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
  selectedFile = null;
  capturedAngles = {};
  if (ui.input) ui.input.value = '';
  [ui.frontThumb, ui.leftThumb, ui.rightThumb].forEach((image) => { image.removeAttribute('src'); image.parentElement.classList.remove('ready'); });
}

function resetQuality() {
  qualityReport = null;
  qualityApproved = false;
  ui.qualityPanel.hidden = true;
  ui.qualityChecks.replaceChildren();
  ui.qualityAdvice.textContent = '';
}

async function assessImageQuality(file) {
  const decoded = await decodeImage(file);
  const { source, width, height, close } = decoded;
  const sampleSize = 144;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const luminance = new Float32Array(sampleSize * sampleSize);
  let sum = 0;
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
    luminance[pixel] = value;
    sum += value;
  }
  const mean = sum / luminance.length;
  let variance = 0, edgeSum = 0, edgeCount = 0;
  for (let y = 1; y < sampleSize - 1; y += 1) {
    for (let x = 1; x < sampleSize - 1; x += 1) {
      const index = y * sampleSize + x;
      const value = luminance[index];
      variance += (value - mean) ** 2;
      edgeSum += Math.abs(value - luminance[index - 1]) + Math.abs(value - luminance[index - sampleSize]);
      edgeCount += 2;
    }
  }
  const contrast = Math.sqrt(variance / ((sampleSize - 2) ** 2));
  const sharpness = edgeSum / edgeCount;
  const checks = [
    { label: 'Risoluzione', pass: Math.min(width, height) >= 720, detail: `${width} × ${height}px`, fix: 'Usa la fotocamera originale, non uno screenshot piccolo.' },
    { label: 'Luce uniforme', pass: mean >= 55 && mean <= 205 && contrast >= 20, detail: mean < 55 ? 'Troppo scura' : mean > 205 ? 'Troppo chiara' : contrast < 20 ? 'Poco contrasto' : 'Buona', fix: 'Mettiti davanti a una finestra, senza controluce.' },
    { label: 'Nitidezza', pass: sharpness >= 5.5, detail: sharpness >= 5.5 ? 'Buona' : 'Possibile sfocatura', fix: 'Pulisci la lente e tieni fermo il telefono.' }
  ];
  if ('FaceDetector' in window) {
    try {
      const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }).detect(source);
      const onlyFace = faces.length === 1;
      let centered = false;
      if (onlyFace) {
        const box = faces[0].boundingBox;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const coverage = (box.width * box.height) / (width * height);
        centered = Math.abs(centerX / width - .5) < .16 && Math.abs(centerY / height - .48) < .2 && coverage >= .12 && coverage <= .72;
      }
      checks.push({ label: 'Un solo volto', pass: onlyFace, detail: onlyFace ? 'Rilevato' : faces.length ? 'Più volti' : 'Volto non rilevato', fix: 'Inquadra un solo volto, senza occlusioni.' });
      checks.push({ label: 'Viso centrato', pass: centered, detail: centered ? 'Dentro l’ovale' : 'Da riposizionare', fix: 'Porta occhi, naso e mento al centro dell’ovale.' });
    } catch { checks.push({ label: 'Centratura', pass: null, detail: 'Controllo visivo nell’ovale', fix: '' }); }
  } else checks.push({ label: 'Centratura', pass: null, detail: 'Controllo visivo nell’ovale', fix: '' });
  close?.();
  const required = checks.filter((check) => check.pass !== null);
  const passed = required.filter((check) => check.pass).length;
  const ideal = required.every((check) => check.pass);
  return { pass: ideal, checks, score: Math.round((passed / required.length) * 100), label: ideal ? 'Ottima' : passed >= required.length - 1 ? 'Utilizzabile' : 'Da migliorare' };
}

function renderQualityReport(report) {
  ui.qualityPanel.hidden = false;
  ui.qualityTitle.textContent = report.pass ? 'Foto pronta per l’analisi' : 'Foto accettata · controlla i suggerimenti';
  ui.qualityChecks.replaceChildren(...report.checks.map((check) => {
    const item = document.createElement('li');
    item.className = check.pass === null ? 'info' : check.pass ? 'pass' : 'fail';
    const symbol = document.createElement('b');
    symbol.textContent = check.pass === null ? 'i' : check.pass ? '✓' : '!';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = check.label;
    const detail = document.createElement('small');
    detail.textContent = check.detail;
    copy.append(title, detail);
    item.append(symbol, copy);
    return item;
  }));
  const firstFailure = report.checks.find((check) => check.pass === false);
  ui.qualityAdvice.textContent = firstFailure ? firstFailure.fix : 'Le condizioni sono abbastanza stabili per creare un confronto utile nel tempo.';
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
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Conversione immagine non riuscita')), type, quality));
}

async function checkApi() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    const available = Boolean(data.configured && data.analysisEnabled);
    ui.apiStatus.classList.toggle('online', available);
    ui.apiStatus.classList.toggle('offline', !available);
    ui.apiStatus.innerHTML = `<i></i>${available ? 'Analisi disponibile' : 'Analisi non disponibile'}`;
  } catch {
    ui.apiStatus.classList.add('offline');
    ui.apiStatus.innerHTML = '<i></i>Servizio non raggiungibile';
  }
  updateReady();
}

async function compressImage(file) {
  const decoded = await decodeImage(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(decoded.width * scale);
  canvas.height = Math.round(decoded.height * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, 'image/jpeg', .86);
  decoded.close?.();
  return blob;
}

async function runAnalysis() {
  const pending = getPendingAnalysis();
  if (pending) return resumePendingAnalysis();
  if (!selectedFile || !qualityApproved || !profileComplete() || !ui.consent.checked) return showMessage('Completa foto, controllo qualità, profilo e consenso prima di continuare.');
  setLoadingState(true);
  try {
    const photo = await compressImage(selectedFile);
    const form = new FormData();
    form.append('file', photo, 'routinegentile-photo.jpg');
    form.append('age', String(getProfile().age));
    const response = await fetch('/api/analyze', { method: 'POST', body: form });
    let data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Analisi non riuscita. La foto non è stata reinviata automaticamente.');
    const id = data.analysis_id || data.id;
    const token = data.scan_token;
    if (!id || !token) throw new Error('Il servizio non ha restituito una sessione di analisi valida.');
    currentAnalysisId = id;
    currentScanToken = token;
    savePendingAnalysis({ id, token, profile: getProfile(), quality: { label: qualityReport?.label || 'Controllata', score: qualityReport?.score }, startedAt: Date.now() });
    clearCapturedPhotos();
    data = await waitForResults(id, token);
    finishAnalysis(data);
  } catch (error) { handleAnalysisError(error); }
  finally { updateReady(); }
}

async function resumePendingAnalysis() {
  const pending = getPendingAnalysis();
  if (!pending) return updateReady();
  restoreProfile(pending.profile);
  currentAnalysisId = pending.id;
  currentScanToken = pending.token;
  qualityReport = typeof pending.quality === 'object' ? pending.quality : { label: pending.quality || 'Controllata' };
  qualityApproved = true;
  setLoadingState(true);
  try { finishAnalysis(await waitForResults(pending.id, pending.token)); }
  catch (error) { handleAnalysisError(error); }
  finally { updateReady(); }
}

function setLoadingState(active) {
  ui.analyze.disabled = true;
  ui.resume.hidden = true;
  ui.scanner.hidden = active;
  ui.results.hidden = true;
  ui.loading.hidden = !active;
  if (active) { showMessage(''); animateProgress(); ui.loading.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

async function waitForResults(id, token) {
  if (!id || !token) throw new Error('Sessione di analisi mancante.');
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 1800 + attempt * 300)));
    let response;
    try {
      response = await fetch(`/api/results?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { 'X-RoutineGentile-Token': token } });
    } catch { throw new PendingAnalysisError('Connessione interrotta, ma l’analisi non viene pagata di nuovo. Premi “Riprendi l’analisi”.'); }
    const data = await response.json().catch(() => ({}));
    if (response.status === 202) continue;
    if (!response.ok) {
      if (response.status === 403 || response.status === 422) clearPendingAnalysis();
      throw new Error(data.error || 'Analisi non riuscita.');
    }
    return data;
  }
  throw new PendingAnalysisError('L’analisi continua sul server. Premi “Riprendi l’analisi” senza inviare una seconda foto.');
}

function finishAnalysis(data) {
  clearPendingAnalysis();
  renderResults(data);
  ui.progress.style.width = '100%';
  ui.progressTrack.setAttribute('aria-valuenow', '100');
  ui.loading.hidden = true;
  ui.results.hidden = false;
  ui.results.focus({ preventScroll: true });
  ui.results.scrollIntoView({ behavior: 'smooth' });
}

function handleAnalysisError(error) {
  ui.loading.hidden = true;
  ui.scanner.hidden = false;
  ui.resume.hidden = !getPendingAnalysis();
  showMessage(error.message || 'Analisi non riuscita.');
  ui.scanner.scrollIntoView({ behavior: 'smooth' });
  ui.message.focus?.();
}

function savePendingAnalysis(value) { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(value)); } catch { /* storage non disponibile */ } }

function getPendingAnalysis() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    if (!value?.id || !value?.token || Date.now() - value.startedAt > PENDING_MAX_AGE) {
      if (value) sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}

function clearPendingAnalysis() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* storage non disponibile */ } }

function restoreProfile(profile = {}) {
  if (profile.age) ui.age.value = profile.age;
  if (profile.skinType) ui.skinType.value = profile.skinType;
  if (profile.goal) ui.skinGoal.value = profile.goal;
  if (profile.sensitivity) ui.sensitivity.value = profile.sensitivity;
  if (profile.pregnancy) ui.pregnancy.value = profile.pregnancy;
  ui.facialHair.value = profile.facialHair || 'beard';
}

function animateProgress() {
  ui.progress.style.width = '8%';
  ui.progressTrack.setAttribute('aria-valuenow', '8');
  let value = 8;
  const timer = setInterval(() => {
    if (ui.loading.hidden || value >= 92) return clearInterval(timer);
    value += Math.max(1.5, (92 - value) * .1);
    ui.progress.style.width = `${value}%`;
    ui.progressTrack.setAttribute('aria-valuenow', String(Math.round(value)));
  }, 650);
}

function extractScore(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.ui_score === 'number') return value.ui_score;
  if (typeof value.score === 'number') return value.score;
  if (value.whole) return extractScore(value.whole);
  return null;
}

function renderResults(payload) {
  const result = payload.result_json || {};
  const rawOverall = Number(payload.overall_score ?? result.all?.score);
  const overall = Number.isFinite(rawOverall) ? Math.max(0, Math.min(100, Math.round(rawOverall))) : null;
  const profile = getProfile();
  // result_json is the canonical analysis object documented by DermIQ. The
  // top-level field is only a convenience copy and can lag behind overrides.
  const rawEstimatedAge = Number(result.skin_age ?? payload.skin_age);
  const estimatedAge = Number.isFinite(rawEstimatedAge) ? Math.round(rawEstimatedAge) : null;
  const history = getHistory();
  const overallSeries = [...history.slice(-2).map((entry) => entry.overall), overall].filter(Number.isFinite);
  const stableOverall = overallSeries.length ? Math.round(median(overallSeries)) : null;
  const ageSeries = [...history.slice(-2).map((entry) => entry.estimatedAge), estimatedAge].filter(Number.isFinite);
  const stableAge = ageSeries.length ? Math.round(median(ageSeries)) : null;
  currentAnalysisId = payload.id || payload.analysis_id;
  ui.score.textContent = stableOverall ?? '—';
  ui.scoreRing.style.background = `conic-gradient(var(--mint) ${(stableOverall || 0) * 3.6}deg, rgba(255,255,255,.14) 0deg)`;
  ui.reportedAge.textContent = profile.age || '—';
  renderAgeRange(stableAge, profile.age, ageSeries.length);
  ui.resultQuality.textContent = Number.isFinite(qualityReport?.score) ? `${qualityReport.score}/100` : qualityReport?.label || 'Controllata';
  ui.headline.textContent = stableOverall === null ? 'Risultato parziale' : stableOverall >= 80 ? 'Una base molto equilibrata' : stableOverall >= 65 ? 'Una buona base da sostenere' : 'Piccoli gesti, grande costanza';

  const scored = metricDefs.map(([label, key, description]) => ({ label, key, description, score: extractScore(result[key]) })).filter((item) => Number.isFinite(item.score)).map((item) => ({ ...item, score: Math.max(0, Math.min(100, Math.round(item.score))) }));
  const stableMetrics = stabilizeMetrics(scored, history);
  ui.resultCompleteness.textContent = `${scored.length}/${metricDefs.length} indicatori disponibili`;
  renderStability(stableMetrics, history);
  ui.scoreDescription.textContent = buildScoreDescription(stableOverall, overallSeries.length);
  const hasFacialHair = profile.facialHair !== 'none';
  ui.metrics.innerHTML = stableMetrics.map(({ label, key, description, score, stableScore, observations }) => {
    const level = stableScore >= 80 ? 'Molto buono' : stableScore >= 65 ? 'Buono' : stableScore >= 50 ? 'Da sostenere' : 'Priorità';
    const hairAffected = hasFacialHair && FACIAL_HAIR_SENSITIVE.has(key);
    const evidence = hairAffected ? 'Possibile interferenza di barba/baffi · escluso dalle priorità' : observations > 1 ? `Mediana di ${observations} prove · ultima ${score}` : 'Prima prova · dato provvisorio';
    return `<article class="metric${hairAffected ? ' excluded' : ''}"><div class="metric-top"><h3>${label}</h3><strong>${stableScore}</strong></div><div class="metric-bar"><i style="width:${stableScore}%"></i></div><small>${description} · ${hairAffected ? 'Da non interpretare' : level}</small><em>${evidence}</em></article>`;
  }).join('') || '<p>Nessun indicatore dettagliato disponibile nella risposta.</p>';
  const priorities = selectReliablePriorities(stableMetrics, profile.facialHair);
  ui.priorities.innerHTML = priorities.map(({ key, observations }) => `<li><strong>${advice[key][0]}</strong><small>${advice[key][1]} ${observations < 2 ? 'Prima lettura: da confermare con una seconda scansione nelle stesse condizioni.' : 'Confermato dal confronto tra scansioni.'}</small></li>`).join('') || '<li><strong>Nessuna priorità cosmetica affidabile</strong><small>Gli indicatori disponibili non mostrano un segnale abbastanza solido. Non inventiamo un problema quando la foto non lo supporta.</small></li>';
  buildRoutines(priorities.map((item) => item.key), profile);
  renderProfileSummary(profile, priorities);
  renderProgress({ overall, metrics: scored, profile, quality: qualityReport?.label || 'Controllata', estimatedAge });
  buildMasks(payload.mask_filenames || [], priorities, profile);
}

function renderAgeRange(estimatedAge, actualAge, observations) {
  if (!Number.isFinite(estimatedAge)) {
    ui.skinAge.textContent = '—';
    ui.ageDifference.textContent = 'Il modello non ha prodotto una fascia utilizzabile.';
    return;
  }
  const { lower, upper } = ageRange(estimatedAge, observations);
  ui.skinAge.textContent = `${lower}–${upper}`;
  if (!Number.isFinite(actualAge)) return;
  ui.ageDifference.textContent = actualAge >= lower && actualAge <= upper
    ? 'La tua età rientra nella fascia: nessuno scarto significativo.'
    : actualAge < lower
      ? 'Il modello percepisce alcuni segni più maturi; non è una misura anagrafica.'
      : 'Il modello percepisce alcuni segni più giovani; non è una misura anagrafica.';
}

function buildScoreDescription(overall, observations) {
  if (overall === null) return 'Alcuni valori non sono disponibili: evita conclusioni dal singolo risultato.';
  const method = observations > 1 ? `Indice stabilizzato sulla mediana di ${observations} prove.` : 'Prima lettura provvisoria: servono altre prove nelle stesse condizioni per confermarla.';
  const summary = overall >= 80 ? 'Il quadro appare complessivamente uniforme.' : overall >= 65 ? 'Il quadro è positivo, con alcune aree da sostenere.' : 'Conviene partire da una routine essenziale e delicata.';
  return `${method} ${summary}`;
}

function renderStability(metrics, history) {
  if (!history.length || !metrics.some((metric) => metric.observations > 1)) {
    ui.stabilitySummary.className = 'stability-note provisional';
    ui.stabilitySummary.innerHTML = '<strong>Risultato provvisorio</strong><span>Una sola foto non basta per parlare di andamento. Le priorità verranno stabilizzate automaticamente fino a tre scansioni.</span>';
    return;
  }
  const previous = history.at(-1);
  const deltas = metrics.map((metric) => {
    const prior = previous.metrics?.find((item) => item.key === metric.key)?.score;
    return Number.isFinite(prior) ? Math.abs(metric.score - prior) : null;
  }).filter(Number.isFinite);
  const variation = deltas.length ? median(deltas) : null;
  const state = stabilityLevel(variation);
  ui.stabilitySummary.className = `stability-note ${state === 'buona' ? 'stable' : state === 'bassa' ? 'variable' : 'provisional'}`;
  ui.stabilitySummary.innerHTML = `<strong>Coerenza tra le prove: ${state}</strong><span>${variation === null ? 'Servono altre scansioni confrontabili.' : `Variazione tipica di ${Math.round(variation)} punti rispetto alla prova precedente.`} Le priorità usano la mediana, non il dato più estremo.</span>`;
}

function buildRoutines(keys, profile) {
  const cleanser = profile.skinType === 'dry' ? 'Detergente cremoso delicato · una piccola noce' : profile.skinType === 'oily' ? 'Gel detergente non sgrassante · 30–45 secondi' : 'Detergente delicato · 30–45 secondi';
  const moisturizer = profile.skinType === 'dry' ? 'Crema con ceramidi · quantità di due piselli' : profile.skinType === 'oily' ? 'Gel-crema leggero non comedogeno · due piselli' : 'Idratante con ceramidi e umettanti · due piselli';
  const morning = [cleanser, moisturizer, 'Protezione solare SPF 30–50 · due dita per viso e collo'];
  const evening = [cleanser, moisturizer];
  const cautious = profile.sensitivity !== 'no' || profile.pregnancy === 'yes';
  if (profile.goal === 'calm' || keys.includes('hd_redness')) {
    morning.splice(1, 0, 'Siero lenitivo senza profumo · 2–3 gocce');
    evening.splice(1, 0, 'Pantenolo o centella · a sere alterne la prima settimana');
  } else if ((profile.goal === 'clarity' || keys.includes('hd_acne')) && !cautious) {
    morning.splice(1, 0, 'Niacinamide 4–5% · 2–3 gocce');
    evening.splice(1, 0, 'Acido salicilico · 1 sera a settimana, poi massimo 2 se tollerato');
  } else if (profile.goal === 'texture' && !cautious) evening.splice(1, 0, 'Esfoliante delicato · 1 sera a settimana, mai su pelle irritata');
  else if ((profile.goal === 'ageing' || keys.includes('hd_wrinkle') || keys.includes('hd_firmness')) && profile.pregnancy !== 'yes' && profile.sensitivity === 'no') {
    morning.splice(1, 0, 'Antiossidante delicato · 2–3 gocce');
    evening.splice(1, 0, 'Retinoide a bassa intensità · 1 sera a settimana, gradualmente');
  } else {
    morning.splice(1, 0, 'Siero idratante semplice · opzionale');
    evening.splice(1, 0, 'Sostegno barriera con ceramidi · ogni sera');
  }
  ui.morning.innerHTML = morning.map((item) => `<li>${item}</li>`).join('');
  ui.evening.innerHTML = evening.map((item) => `<li>${item}</li>`).join('');
}

function renderProfileSummary(profile, priorities) {
  const typeNames = { dry: 'secca', normal: 'normale', combination: 'mista', oily: 'grassa', unsure: 'da definire' };
  const goalNames = { calm: 'calmare', clarity: 'ridurre le imperfezioni', texture: 'migliorare texture e pori', ageing: 'sostenere compattezza e linee', balance: 'mantenere equilibrio' };
  ui.profileSummary.textContent = `Pelle ${typeNames[profile.skinType] || 'da definire'} · obiettivo: ${goalNames[profile.goal] || 'equilibrio'}`;
  const firstPriority = priorities[0]?.key ? advice[priorities[0].key][0].toLowerCase() : 'barriera cutanea';
  ui.profileReason.textContent = `La routine combina il profilo dichiarato con la priorità visiva “${firstPriority}”. ${profile.sensitivity !== 'no' ? 'Poiché hai indicato sensibilità, gli attivi sono ridotti.' : ''} ${profile.pregnancy === 'yes' ? 'I retinoidi sono esclusi.' : ''} ${profile.facialHair !== 'none' ? 'Gli indicatori che possono confondere barba o baffi con la pelle sono esclusi dalle priorità.' : ''}`.trim();
}

function getHistory() {
  try { const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(history) ? history : []; }
  catch { return []; }
}

function renderProgress(current) {
  const history = getHistory();
  const previous = history.at(-1);
  ui.progressComparison.replaceChildren();
  if (!previous) {
    ui.progressCopy.textContent = 'Questa analisi crea il punto di partenza. Lo storico resta soltanto su questo dispositivo e non contiene fotografie.';
    ui.progressComparison.append(progressCard('Punto di partenza', current.overall, null));
  } else {
    ui.progressCopy.textContent = `Confronto con ${new Date(previous.date).toLocaleDateString('it-IT')}. Ripeti le scansioni nella stessa luce e non più di una volta a settimana.`;
    ui.progressComparison.append(progressCard('Skin score', current.overall, difference(current.overall, previous.overall)));
    current.metrics.slice().sort((a, b) => a.score - b.score).slice(0, 3).forEach((metric) => {
      const before = previous.metrics?.find((item) => item.key === metric.key)?.score;
      ui.progressComparison.append(progressCard(metric.label, metric.score, difference(metric.score, before)));
    });
  }
  const entry = { date: new Date().toISOString(), overall: current.overall, estimatedAge: current.estimatedAge, metrics: current.metrics.map(({ key, label, score }) => ({ key, label, score })), profile: current.profile, quality: current.quality };
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, entry].slice(-12))); }
  catch { ui.progressCopy.textContent += ' Il browser non consente di salvare lo storico.'; }
}

function progressCard(label, value, delta) {
  const card = document.createElement('article');
  const title = document.createElement('small'); title.textContent = label;
  const score = document.createElement('strong'); score.textContent = Number.isFinite(value) ? value : '—';
  const change = document.createElement('span');
  change.className = delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
  change.textContent = delta === null ? 'baseline' : delta === 0 ? 'stabile' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} dal precedente`;
  card.append(title, score, change);
  return card;
}

function difference(current, previous) { return Number.isFinite(current) && Number.isFinite(previous) ? Math.round(current - previous) : null; }

function clearHistory() {
  if (!confirm('Cancellare definitivamente lo storico RoutineGentile da questo dispositivo? Le fotografie non sono mai incluse.')) return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* storage non disponibile */ }
  ui.progressComparison.replaceChildren();
  ui.progressCopy.textContent = 'Storico locale cancellato. La prossima analisi creerà un nuovo punto di partenza.';
}

function buildMasks(masks, priorities, profile) {
  const hasAnalysis = Boolean(currentAnalysisId && currentScanToken);
  ui.maskPanel.hidden = !hasAnalysis;
  ui.maskSelect.replaceChildren();
  if (!hasAnalysis) return;
  const hasFacialHair = profile.facialHair !== 'none';
  const selectedMasks = selectPriorityMasks(masks, priorities, profile.facialHair);
  ui.maskSelect.hidden = !selectedMasks.length;
  if (!selectedMasks.length) {
    revokeMaskUrl();
    ui.maskImage.classList.remove('loaded');
    ui.maskLoading.hidden = false;
    ui.maskLoading.textContent = hasFacialHair ? 'Nessuna mappa affidabile: la zona con barba/baffi è stata esclusa.' : 'Nessuna mappa affidabile ancora disponibile.';
    ui.maskExplanation.textContent = 'Una mappa appare soltanto quando la stessa priorità è confermata da almeno due scansioni coerenti.';
    ui.maskFootnote.textContent = hasFacialHair ? 'Barba e baffi non vengono interpretati come problemi della pelle.' : 'Ripeti la scansione nelle stesse condizioni, non più di una volta a settimana.';
    return;
  }
  ui.maskExplanation.textContent = `Mostriamo ${selectedMasks.length === 1 ? 'una sola area' : `solo ${selectedMasks.length} aree`} collegata${selectedMasks.length === 1 ? '' : 'e'} a priorità confermate.`;
  ui.maskFootnote.textContent = hasFacialHair ? 'Le zone influenzate da barba o baffi sono escluse. La mappa resta sperimentale e non diagnostica.' : 'La mappa è sperimentale e non rappresenta una diagnosi.';
  selectedMasks.forEach(({ name, descriptor }) => { const option = document.createElement('option'); option.value = name; option.textContent = maskLabel(descriptor, name); ui.maskSelect.append(option); });
  loadMask(ui.maskSelect.value);
}

async function loadMask(name) {
  if (!currentAnalysisId || !currentScanToken || !name) return;
  revokeMaskUrl();
  ui.maskImage.classList.remove('loaded');
  ui.maskLoading.hidden = false;
  ui.maskLoading.textContent = 'Caricamento mappa…';
  try {
    const response = await fetch(`/api/mask?id=${encodeURIComponent(currentAnalysisId)}&name=${encodeURIComponent(name)}`, { cache: 'no-store', headers: { 'X-RoutineGentile-Token': currentScanToken } });
    if (!response.ok) throw new Error('Mappa non disponibile');
    maskObjectUrl = URL.createObjectURL(await response.blob());
    ui.maskImage.onload = () => { ui.maskImage.classList.add('loaded'); ui.maskLoading.hidden = true; };
    ui.maskImage.src = maskObjectUrl;
  } catch { ui.maskLoading.textContent = 'Mappa non disponibile'; }
}

function revokeMaskUrl() {
  if (maskObjectUrl) URL.revokeObjectURL(maskObjectUrl);
  maskObjectUrl = null;
  ui.maskImage.removeAttribute('src');
}

function resetScan() {
  stopCamera();
  clearCapturedPhotos();
  resetQuality();
  revokeMaskUrl();
  ui.results.hidden = true;
  ui.scanner.hidden = false;
  currentAnalysisId = null;
  currentScanToken = null;
  captureIndex = 0;
  ui.input.value = '';
  ui.consent.checked = false;
  ui.guidedCamera.hidden = true;
  ui.captureReview.hidden = true;
  ui.captureIntro.hidden = false;
  updateReady();
  ui.scanner.scrollIntoView({ behavior: 'smooth' });
  ui.startCamera.focus();
}

function showMessage(text) { ui.message.textContent = text; }

checkApi();
