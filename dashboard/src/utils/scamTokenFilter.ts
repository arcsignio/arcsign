/**
 * Scam Token Filter
 *
 * Filters out known scam tokens based on various heuristics and blacklists.
 * Protects users from phishing attacks and fraudulent tokens.
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  contractAddress?: string;
  balance?: string;
  verified?: boolean;
}

/**
 * Scam detection patterns
 *
 * These patterns identify common characteristics of scam tokens:
 * 1. Suspicious URLs in token names/symbols
 * 2. Fake airdrop claims
 * 3. Impersonation of legitimate projects
 * 4. Urgent/pressure tactics
 */
const SCAM_PATTERNS = [
  // URL patterns (telegram, discord, websites)
  /t\.me\//i,
  /discord\.gg\//i,
  /bit\.ly\//i,
  /tinyurl\./i,
  /claim.*(?:airdrop|token|reward)/i,
  /visit.*(?:site|website|link)/i,

  // Fake claim/airdrop patterns
  /claim.*(?:until|before|by)/i,
  /free.*(?:token|coin|nft|eth|bnb|usdt)/i,
  /bonus.*(?:token|reward)/i,
  /reward.*(?:claim|get|receive)/i,

  // Impersonation patterns
  /official.*(?:airdrop|token|claim)/i,
  /(?:uniswap|pancake|sushi).*(?:claim|airdrop)/i,

  // Urgency/pressure tactics
  /(?:limited|urgent|expire|deadline|last.*chance)/i,
  /(?:act.*now|hurry|don't.*miss)/i,

  // Distribution/giveaway scams
  /distribution.*(?:claim|get|receive)/i,
  /giveaway.*(?:claim|get|receive)/i,

  // Fake verification
  /✅.*(?:distribution|airdrop|claim)/i,
  /✓.*(?:distribution|airdrop|claim)/i,
  /verified.*(?:airdrop|claim)/i,
];

/**
 * Known scam token addresses (examples - should be updated regularly)
 *
 * Maintain a blacklist of confirmed scam token addresses.
 * This list should be updated based on community reports and analysis.
 */
const BLACKLISTED_ADDRESSES = new Set<string>([
  // Add confirmed scam token addresses here (lowercase)
  // Example: '0x123...abc',
]);

/**
 * Legitimate token patterns (whitelist)
 *
 * Well-known legitimate tokens that should never be filtered.
 */
const LEGITIMATE_TOKENS = new Set<string>([
  'ETH', 'WETH', 'BTC', 'WBTC',
  'USDT', 'USDC', 'DAI', 'BUSD',
  'BNB', 'MATIC', 'AVAX', 'FTM',
  'LINK', 'UNI', 'AAVE', 'CRV',
  'SUSHI', 'CAKE', 'DOT', 'ADA',
  // Add more legitimate tokens as needed
]);

/**
 * Check if a token name/symbol matches scam patterns
 */
function matchesScamPattern(text: string): boolean {
  if (!text) return false;

  // Check against all scam patterns
  return SCAM_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if a token is blacklisted
 */
function isBlacklisted(address?: string): boolean {
  if (!address) return false;
  return BLACKLISTED_ADDRESSES.has(address.toLowerCase());
}

/**
 * Check if a token is whitelisted (known legitimate token)
 */
function isLegitimate(symbol: string): boolean {
  return LEGITIMATE_TOKENS.has(symbol.toUpperCase());
}

/**
 * Calculate scam risk score (0-100)
 *
 * Higher score = higher risk
 *
 * Scoring criteria:
 * - 50+ points: High risk (should be filtered by default)
 * - 30-49 points: Medium risk (show warning)
 * - 0-29 points: Low risk (probably legitimate)
 */
function calculateScamScore(token: TokenInfo): number {
  let score = 0;

  // Whitelist check (immediately return 0)
  if (isLegitimate(token.symbol)) {
    return 0;
  }

  // Blacklist check (immediately return 100)
  if (isBlacklisted(token.contractAddress)) {
    return 100;
  }

  // Pattern matching in name
  if (matchesScamPattern(token.name)) {
    score += 60; // High weight for name patterns
  }

  // Pattern matching in symbol
  if (matchesScamPattern(token.symbol)) {
    score += 50; // High weight for symbol patterns
  }

  // Suspicious characters in symbol (emoji, special chars)
  if (/[✅✓❌⚠️🎁💰🔥⭐]/u.test(token.symbol) || /[✅✓❌⚠️🎁💰🔥⭐]/u.test(token.name)) {
    score += 30; // Emojis in token names are often scams
  }

  // Very long token names (often contain URLs or messages)
  if (token.name.length > 50) {
    score += 20;
  }

  // Token symbol too long (legitimate tokens usually have 2-6 char symbols)
  if (token.symbol.length > 10) {
    score += 15;
  }

  // Unverified token with zero or very small balance
  if (!token.verified && token.balance && parseFloat(token.balance) < 0.0001) {
    score += 10; // Dust amounts are often used for scam tokens
  }

  return Math.min(score, 100); // Cap at 100
}

/**
 * Filter out scam tokens from a token list
 *
 * @param tokens - Array of tokens to filter
 * @param threshold - Scam score threshold (default: 50)
 * @returns Object with filtered tokens and removed scam tokens
 */
export function filterScamTokens(
  tokens: TokenInfo[],
  threshold: number = 50
): {
  clean: TokenInfo[];
  scams: Array<TokenInfo & { scamScore: number }>;
  warnings: Array<TokenInfo & { scamScore: number }>;
} {
  const clean: TokenInfo[] = [];
  const scams: Array<TokenInfo & { scamScore: number }> = [];
  const warnings: Array<TokenInfo & { scamScore: number }> = [];

  tokens.forEach(token => {
    const scamScore = calculateScamScore(token);

    if (scamScore >= threshold) {
      // High risk - filter out
      scams.push({ ...token, scamScore });
    } else if (scamScore >= 30) {
      // Medium risk - show warning
      warnings.push({ ...token, scamScore });
      clean.push(token); // Still include but with warning
    } else {
      // Low risk - include normally
      clean.push(token);
    }
  });

  return { clean, scams, warnings };
}

/**
 * Check if a single token is likely a scam
 */
export function isScamToken(token: TokenInfo, threshold: number = 50): boolean {
  const scamScore = calculateScamScore(token);
  return scamScore >= threshold;
}

/**
 * Get scam risk level description
 */
export function getScamRiskLevel(score: number): {
  level: 'low' | 'medium' | 'high';
  label: string;
  color: string;
} {
  if (score >= 50) {
    return {
      level: 'high',
      label: '⚠️ 高風險（可能是詐騙代幣）',
      color: '#ef4444', // red-500
    };
  } else if (score >= 30) {
    return {
      level: 'medium',
      label: '⚠️ 中風險（請謹慎）',
      color: '#f59e0b', // amber-500
    };
  } else {
    return {
      level: 'low',
      label: '✅ 低風險',
      color: '#10b981', // green-500
    };
  }
}

/**
 * Add a token address to the blacklist
 *
 * This should be called when a user manually reports a scam token.
 * In production, this should sync with a backend database.
 */
export function reportScamToken(address: string): void {
  BLACKLISTED_ADDRESSES.add(address.toLowerCase());

  // TODO: Sync with backend API
  console.log(`📝 Scam token reported: ${address}`);
}

/**
 * Get explanation for why a token was flagged
 */
export function getScamReasons(token: TokenInfo): string[] {
  const reasons: string[] = [];

  if (isBlacklisted(token.contractAddress)) {
    reasons.push('已被列入黑名單（社群回報）');
  }

  if (matchesScamPattern(token.name)) {
    reasons.push('代幣名稱包含可疑內容（URL、claim、airdrop 等）');
  }

  if (matchesScamPattern(token.symbol)) {
    reasons.push('代幣符號包含可疑內容');
  }

  if (/[✅✓❌⚠️🎁💰🔥⭐]/u.test(token.name) || /[✅✓❌⚠️🎁💰🔥⭐]/u.test(token.symbol)) {
    reasons.push('使用表情符號（詐騙代幣常見特徵）');
  }

  if (token.name.length > 50) {
    reasons.push('代幣名稱過長（可能包含釣魚訊息）');
  }

  if (token.symbol.length > 10) {
    reasons.push('代幣符號異常長');
  }

  if (!token.verified) {
    reasons.push('未經驗證的代幣');
  }

  return reasons;
}
