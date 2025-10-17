/**
 * Clipboard service with auto-clear
 * Feature: User Dashboard for Wallet Management
 * Task: T058 - Create clipboard service with 30s auto-clear
 * Generated: 2025-10-17
 */

let clearTimer: NodeJS.Timeout | null = null;
let lastCopied: { address: string; symbol: string; copiedAt: Date } | null = null;

/**
 * Copy text to clipboard with 30-second auto-clear (SEC-005)
 */
export async function copyWithAutoClear(
  text: string,
  symbol?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cancel previous timer if exists
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(text);

    // Track what was copied
    lastCopied = {
      address: text,
      symbol: symbol || '',
      copiedAt: new Date(),
    };

    // Set 30-second auto-clear timer
    clearTimer = setTimeout(async () => {
      await clearClipboard();
      clearTimer = null;
    }, 30000);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy to clipboard',
    };
  }
}

/**
 * Manually clear clipboard
 */
export async function clearClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText('');

    // Cancel auto-clear timer
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }

    lastCopied = null;
  } catch (error) {
    console.error('Failed to clear clipboard:', error);
  }
}

/**
 * Get time remaining until auto-clear (in seconds)
 */
export function getTimeRemaining(): number {
  if (!clearTimer || !lastCopied) {
    return 0;
  }

  const elapsed = Date.now() - lastCopied.copiedAt.getTime();
  const remaining = Math.max(0, 30 - Math.floor(elapsed / 1000));

  return remaining;
}

/**
 * Get last copied information
 */
export function getLastCopied(): typeof lastCopied {
  return lastCopied;
}

/**
 * Clear clipboard on page unload for security
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearClipboard().catch(console.error);
  });
}
