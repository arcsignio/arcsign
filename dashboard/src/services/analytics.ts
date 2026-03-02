/**
 * Anonymous App Heartbeat
 * Sends version + OS to arcsign.io once per session after unlock.
 * HMAC-signed to prevent spoofed requests.
 * Silently fails — never affects app functionality.
 */

const HEARTBEAT_URL = 'https://arcsign.io/api/heartbeat';
const HMAC_SECRET = 'ARCSIGN_HEARTBEAT_2026';

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function sendHeartbeat(version: string): Promise<void> {
  try {
    const os = navigator.platform.startsWith('Mac')
      ? 'darwin'
      : navigator.platform.startsWith('Win')
        ? 'win32'
        : 'linux';
    const t = Math.floor(Date.now() / 1000);
    const sig = await hmacSign(`${version}|${os}|${t}`, HMAC_SECRET);

    await fetch(HEARTBEAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: version, os, t, sig }),
    });
  } catch {
    // Silent failure — never affects app functionality
  }
}
