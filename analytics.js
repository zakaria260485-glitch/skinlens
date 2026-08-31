window.va = window.va || function () {
  (window.vaq = window.vaq || []).push(arguments);
};

window.va('beforeSend', (event) => {
  const url = new URL(event.url);
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
});

const FUNNEL_EVENTS = new Set([
  'scan_start',
  'scan_complete',
  'scan_failed',
  'kit_offer_view',
  'kit_click',
  'kit_page_view',
  'checkout_click'
]);

function funnelSource() {
  const source = new URLSearchParams(window.location.search).get('utm_source')?.toLowerCase();
  if (['instagram', 'ig', 'tiktok', 'youtube', 'app', 'kit', 'routinegentile'].includes(source)) return source === 'ig' ? 'instagram' : source;
  const referrer = document.referrer.toLowerCase();
  if (referrer.includes('instagram.com')) return 'instagram';
  if (referrer.includes('tiktok.com')) return 'tiktok';
  if (referrer.includes('youtube.com') || referrer.includes('youtu.be')) return 'youtube';
  return 'direct';
}

window.rgTrack = (name) => {
  if (!FUNNEL_EVENTS.has(name)) return;
  window.va('event', { name, data: { source: funnelSource() } });

  const body = JSON.stringify({ event: name, source: funnelSource() });
  const sent = navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }));
  if (!sent) fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
};

document.addEventListener('DOMContentLoaded', () => {
  const pageEvent = document.body.dataset.trackPage;
  if (pageEvent) window.rgTrack(pageEvent);
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-track]');
    if (target) window.rgTrack(target.dataset.track);
  });
});
