/**
 * Guards the production CSP against blocking hosts the WalletConnect SDK needs.
 *
 * Dev mode (Vite) does not apply this CSP, so a missing host only breaks the
 * release build — and silently. @walletconnect/core 2.23 fetches the Verify
 * public key from verify.walletconnect.org while handling a session proposal;
 * when the CSP blocks it, the SDK's internal promise never settles, so the
 * approval dialog never appears and no error is shown (v1.6.4/v1.6.5).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const conf = JSON.parse(
  readFileSync(resolve(__dirname, '../../../src-tauri/tauri.conf.json'), 'utf8'),
);
const csp: string = conf.app.security.csp;
const connectSrc = csp
  .split(';')
  .map((d) => d.trim())
  .find((d) => d.startsWith('connect-src'))!
  .split(/\s+/)
  .slice(1);

describe('production CSP connect-src', () => {
  it.each([
    'wss://relay.walletconnect.com', // relayUrl pinned in services/walletconnect/client.ts
    'https://verify.walletconnect.org', // SDK default Verify host (public key + attestations)
    'https://verify.walletconnect.com', // SDK trusted Verify host
  ])('allows %s', (host) => {
    expect(connectSrc).toContain(host);
  });
});
