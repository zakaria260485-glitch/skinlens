const encoder = new TextEncoder();
const TOKEN_LIFETIME_SECONDS = 30 * 60;

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, usage
  );
}

export async function createScanToken(id, secret) {
  const expires = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = `${id}.${expires}`;
  const key = await hmacKey(secret, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${expires}.${base64Url(signature)}`;
}

export async function verifyScanToken(id, token, secret) {
  if (!token || typeof token !== 'string') return false;
  const [expiresText, signatureText, extra] = token.split('.');
  const expires = Number(expiresText);
  if (extra || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  let signature;
  try {
    const normalized = signatureText.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    signature = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await hmacKey(secret, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${id}.${expires}`));
}
