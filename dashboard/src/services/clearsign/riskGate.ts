import type { SecurityReport } from '@/services/tauri-api';

/**
 * True only when txguard has positively detected danger:
 * a blacklist match, or riskLevel === 'danger'.
 *
 * Both signals come from the txguard blacklist, which is seeded offline
 * (embedded OFAC sanctions + MIT MEW/Revoke lists) so detection works on first
 * sign and without network, and merges a fuller list (incl. ScamSniffer) when
 * online. No API key needed.
 * Free users (proRequired) and undefined reports (check skipped / failed)
 * return false — friction is added ONLY on a positive danger signal, never
 * because a check failed to run. intent.risks (unlimited approve etc.) are
 * deliberately NOT part of this gate; they stay as red warnings, not blockers.
 */
export function isHighRiskSign(security?: SecurityReport): boolean {
  if (!security || security.proRequired) return false;
  return security.blacklistMatch !== undefined || security.riskLevel === 'danger';
}
