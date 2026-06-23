import type { SecurityReport } from '@/services/tauri-api';

/**
 * Reads the BACKEND's danger conclusion. The danger judgment (blacklist hit /
 * danger risk) is computed in Go (txguard guard.Check → RequiresAcknowledge);
 * the frontend only surfaces it. See CLAUDE.md: asset-safety judgments live in
 * the backend, the frontend only presents.
 */
export function isHighRiskSign(security?: SecurityReport): boolean {
  return security?.requiresAcknowledge === true;
}
