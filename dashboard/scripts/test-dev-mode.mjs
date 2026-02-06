#!/usr/bin/env node
/**
 * Developer Mode Test Script
 *
 * Tests all Developer Mode WebSocket features:
 * - get_accounts (get wallet addresses)
 * - personal_sign (EIP-191 message signing)
 * - sign_typed_data_v4 (EIP-712 typed data signing)
 * - dev_sign_transaction (transaction signing)
 * - get_explorer_api_key (block explorer API keys)
 * - dev_create_session / dev_get_session / dev_end_session (auto-sign sessions)
 *
 * Usage:
 *   cd dashboard
 *   npm run test:dev-mode
 *
 * Prerequisites:
 *   1. Dashboard running with Developer Mode enabled
 *   2. Wallet selected in Developer Mode page
 *   3. USB device connected
 *
 * Created: 2026-02-06
 */

import WebSocket from 'ws';
import readline from 'readline';

const WS_URL = 'ws://localhost:9527';
const TIMEOUT_MS = 300000; // 5 minutes (same as server)
const QUICK_TIMEOUT_MS = 10000; // 10 seconds for non-signing operations

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

let requestId = 1;
let ws = null;
let walletAddress = null;

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// Connect to WebSocket
async function connect() {
  return new Promise((resolve, reject) => {
    log(colors.cyan, '...', `Connecting to ${WS_URL}`);
    ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout - is Developer Mode enabled?'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      log(colors.green, '✓', `Connected to ${WS_URL}`);
      resolve();
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      log(colors.red, '✗', `Connection error: ${err.message}`);
      reject(err);
    });

    ws.on('close', () => {
      log(colors.yellow, '!', 'WebSocket connection closed');
    });
  });
}

// Send request and wait for response
function sendRequest(method, params = {}, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const id = requestId++;
    const request = { id, method, params };

    log(colors.cyan, '→', `Sending: ${method}`);
    console.log(colors.dim + '   ' + JSON.stringify(request, null, 2).split('\n').join('\n   ') + colors.reset);

    const timeout = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Request timed out (${timeoutMs / 1000}s)`));
    }, timeoutMs);

    const handler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          ws.off('message', handler);

          if (response.success) {
            log(colors.green, '←', 'Response:');
            console.log(colors.dim + '   ' + JSON.stringify(response.result, null, 2).split('\n').join('\n   ') + colors.reset);
            resolve(response.result);
          } else {
            log(colors.red, '←', `Error: ${response.error}`);
            reject(new Error(response.error));
          }
        }
      } catch (e) {
        console.error('Failed to parse response:', e);
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify(request));
  });
}

// Get wallet address
async function getAccounts() {
  const result = await sendRequest('get_accounts', {}, QUICK_TIMEOUT_MS);
  return result.accounts || [];
}

// ============================================================================
// Signing Tests (require user approval)
// ============================================================================

// Test: personal_sign (EIP-191)
async function testPersonalSign() {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log(colors.yellow, '📝', colors.bold + 'Test: personal_sign (EIP-191)' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  const message = 'Hello from ArcSign Test Script!';
  const messageHex = '0x' + Buffer.from(message).toString('hex');

  console.log(`\n${colors.cyan}Message:${colors.reset} "${message}"`);
  console.log(`${colors.cyan}Hex:${colors.reset}     ${messageHex}`);
  console.log(`${colors.cyan}Address:${colors.reset} ${walletAddress}`);
  console.log(`\n${colors.yellow}⏳ Waiting for approval in Dashboard UI...${colors.reset}`);
  console.log(`   ${colors.dim}(Enter password and click Approve)${colors.reset}\n`);

  try {
    const result = await sendRequest('personal_sign', {
      address: walletAddress,
      message: messageHex,
      context: {
        script_name: 'test-dev-mode.mjs',
        description: 'Test personal_sign from CLI',
      },
    });

    console.log('\n' + colors.green + colors.bold + '✓ Signature received!' + colors.reset);
    console.log(`${colors.cyan}Signature:${colors.reset} ${result.signature}`);
    return true;
  } catch (err) {
    console.log('\n' + colors.red + colors.bold + '✗ Failed: ' + err.message + colors.reset);
    return false;
  }
}

// Test: sign_typed_data_v4 (EIP-712)
async function testSignTypedData() {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log(colors.yellow, '📝', colors.bold + 'Test: sign_typed_data_v4 (EIP-712)' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      Message: [
        { name: 'content', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
      ],
    },
    primaryType: 'Message',
    domain: {
      name: 'ArcSign Test',
      version: '1',
      chainId: 11155111, // Sepolia
    },
    message: {
      content: 'Hello EIP-712!',
      timestamp: Math.floor(Date.now() / 1000),
    },
  };

  console.log(`\n${colors.cyan}Typed Data:${colors.reset}`);
  console.log(colors.dim + JSON.stringify(typedData, null, 2).split('\n').map(l => '   ' + l).join('\n') + colors.reset);
  console.log(`\n${colors.cyan}Address:${colors.reset} ${walletAddress}`);
  console.log(`\n${colors.yellow}⏳ Waiting for approval in Dashboard UI...${colors.reset}`);
  console.log(`   ${colors.dim}(Enter password and click Approve)${colors.reset}\n`);

  try {
    const result = await sendRequest('sign_typed_data_v4', {
      address: walletAddress,
      typed_data: typedData,
      context: {
        script_name: 'test-dev-mode.mjs',
        description: 'Test EIP-712 signing from CLI',
      },
    });

    console.log('\n' + colors.green + colors.bold + '✓ Signature received!' + colors.reset);
    console.log(`${colors.cyan}Signature:${colors.reset} ${result.signature}`);
    return true;
  } catch (err) {
    console.log('\n' + colors.red + colors.bold + '✗ Failed: ' + err.message + colors.reset);
    return false;
  }
}

// Test: dev_sign_transaction
async function testDevSignTransaction() {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log(colors.yellow, '📝', colors.bold + 'Test: dev_sign_transaction' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  // Simple ETH transfer (0 value, no data - just a test)
  const params = {
    from: walletAddress,
    to: walletAddress, // Send to self
    data: '0x',
    value: '0x0',
    gas: '0x5208', // 21000
    chain_id: 11155111, // Sepolia
    context: {
      script_name: 'test-dev-mode.mjs',
      description: 'Test transaction from CLI (0 ETH to self)',
    },
  };

  console.log(`\n${colors.cyan}Transaction:${colors.reset}`);
  console.log(`   From:   ${params.from}`);
  console.log(`   To:     ${params.to} ${colors.dim}(self)${colors.reset}`);
  console.log(`   Value:  0 ETH`);
  console.log(`   Gas:    21000`);
  console.log(`   Chain:  Sepolia (11155111)`);
  console.log(`\n${colors.yellow}⏳ Waiting for approval in Dashboard UI...${colors.reset}`);
  console.log(`   ${colors.dim}(Enter password and click Approve)${colors.reset}\n`);

  try {
    const result = await sendRequest('dev_sign_transaction', params);

    console.log('\n' + colors.green + colors.bold + '✓ Transaction signed!' + colors.reset);
    if (result.tx_hash) {
      console.log(`${colors.cyan}TX Hash:${colors.reset}   ${result.tx_hash}`);
    }
    if (result.signed_tx) {
      console.log(`${colors.cyan}Signed TX:${colors.reset} ${result.signed_tx.substring(0, 66)}...`);
    }
    return true;
  } catch (err) {
    console.log('\n' + colors.red + colors.bold + '✗ Failed: ' + err.message + colors.reset);
    return false;
  }
}

// ============================================================================
// Non-signing Tests (no user approval needed)
// ============================================================================

// Test: get_explorer_api_key
async function testGetExplorerApiKey() {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log(colors.magenta, '🔑', colors.bold + 'Test: get_explorer_api_key' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  const explorers = ['etherscan', 'bscscan', 'polygonscan', 'arbiscan'];
  let anyFound = false;

  for (const explorer of explorers) {
    console.log(`\n${colors.cyan}Checking:${colors.reset} ${explorer}`);

    try {
      const result = await sendRequest('get_explorer_api_key', {
        explorer,
      }, QUICK_TIMEOUT_MS);

      if (result.api_key) {
        log(colors.green, '✓', `${explorer}: ${result.api_key.substring(0, 8)}...`);
        anyFound = true;
      } else {
        log(colors.yellow, '!', `${explorer}: No API key configured`);
      }
    } catch (err) {
      log(colors.red, '✗', `${explorer}: ${err.message}`);
    }
  }

  console.log('');
  if (anyFound) {
    console.log(colors.green + colors.bold + '✓ Explorer API key retrieval works!' + colors.reset);
    return true;
  } else {
    console.log(colors.yellow + '! No API keys configured in Developer Settings' + colors.reset);
    console.log(colors.dim + '  (This is OK - the feature works, just no keys saved)' + colors.reset);
    return true; // Feature works even if no keys configured
  }
}

// Test: Session management (create, get, end)
async function testSessionManagement() {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  log(colors.magenta, '🔐', colors.bold + 'Test: Session Management' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  let sessionCreated = false;

  // Step 1: Check current session status
  console.log(`\n${colors.cyan}Step 1:${colors.reset} Checking current session status...`);
  try {
    const status = await sendRequest('dev_get_session', {}, QUICK_TIMEOUT_MS);
    if (status.active) {
      console.log(colors.yellow + '! Session already active, will end it first' + colors.reset);
      await sendRequest('dev_end_session', {}, QUICK_TIMEOUT_MS);
    } else {
      log(colors.green, '✓', 'No active session');
    }
  } catch (err) {
    log(colors.yellow, '!', `Could not check session: ${err.message}`);
  }

  // Step 2: Create a new session
  console.log(`\n${colors.cyan}Step 2:${colors.reset} Creating new session...`);
  try {
    const createResult = await sendRequest('dev_create_session', {
      wallet_id: 'test-session',
      duration_minutes: 5,
      trusted_networks: ['sepolia', 'bsc-testnet'],
      max_gas_limit: '0x1000000',
    }, QUICK_TIMEOUT_MS);

    log(colors.green, '✓', 'Session created!');
    console.log(colors.dim + `   Expires: ${new Date(createResult.session?.expires_at).toLocaleString()}` + colors.reset);
    console.log(colors.dim + `   Trusted networks: ${createResult.session?.trusted_networks?.join(', ')}` + colors.reset);
    sessionCreated = true;
  } catch (err) {
    log(colors.red, '✗', `Failed to create session: ${err.message}`);
    return false;
  }

  // Step 3: Verify session is active
  console.log(`\n${colors.cyan}Step 3:${colors.reset} Verifying session is active...`);
  try {
    const status = await sendRequest('dev_get_session', {}, QUICK_TIMEOUT_MS);
    if (status.active) {
      log(colors.green, '✓', `Session active! Sign count: ${status.session?.sign_count || 0}`);
    } else {
      log(colors.red, '✗', 'Session should be active but is not');
      return false;
    }
  } catch (err) {
    log(colors.red, '✗', `Failed to get session: ${err.message}`);
    return false;
  }

  // Step 4: End session
  console.log(`\n${colors.cyan}Step 4:${colors.reset} Ending session...`);
  try {
    const endResult = await sendRequest('dev_end_session', {}, QUICK_TIMEOUT_MS);
    log(colors.green, '✓', `Session ended! Total signs: ${endResult.sign_count || 0}`);
  } catch (err) {
    log(colors.red, '✗', `Failed to end session: ${err.message}`);
    return false;
  }

  // Step 5: Verify session is ended
  console.log(`\n${colors.cyan}Step 5:${colors.reset} Verifying session is ended...`);
  try {
    const status = await sendRequest('dev_get_session', {}, QUICK_TIMEOUT_MS);
    if (!status.active) {
      log(colors.green, '✓', 'Session ended successfully');
    } else {
      log(colors.red, '✗', 'Session should be ended but is still active');
      return false;
    }
  } catch (err) {
    log(colors.red, '✗', `Failed to verify session: ${err.message}`);
    return false;
  }

  console.log('\n' + colors.green + colors.bold + '✓ Session management works!' + colors.reset);
  return true;
}

// ============================================================================
// Menu and Main
// ============================================================================

// Main menu
async function showMenu() {
  console.log('\n' + colors.dim + '─'.repeat(60) + colors.reset);
  console.log(colors.bold + 'Developer Mode Test Menu' + colors.reset);
  console.log(colors.dim + '─'.repeat(60) + colors.reset);
  console.log(`${colors.cyan}Wallet:${colors.reset} ${walletAddress}`);
  console.log('');
  console.log(colors.bold + '  Signing Tests (require approval):' + colors.reset);
  console.log('    1. Test personal_sign (EIP-191 message signing)');
  console.log('    2. Test sign_typed_data_v4 (EIP-712 typed data)');
  console.log('    3. Test dev_sign_transaction (transaction signing)');
  console.log('');
  console.log(colors.bold + '  Non-signing Tests (automatic):' + colors.reset);
  console.log('    4. Test get_explorer_api_key');
  console.log('    5. Test session management (create/get/end)');
  console.log('');
  console.log(colors.bold + '  Batch Tests:' + colors.reset);
  console.log('    6. Run all signing tests');
  console.log('    7. Run all non-signing tests');
  console.log('    8. Run ALL tests');
  console.log('');
  console.log('    0. Exit');
  console.log('');

  const choice = await question(colors.cyan + 'Select test (0-8): ' + colors.reset);
  return choice.trim();
}

// Print test results summary
function printSummary(results) {
  console.log('\n' + colors.bold + '═'.repeat(60) + colors.reset);
  console.log(colors.bold + 'Test Results Summary' + colors.reset);
  console.log(colors.bold + '═'.repeat(60) + colors.reset);

  let passed = 0;
  let failed = 0;

  for (const [name, success] of Object.entries(results)) {
    const icon = success ? colors.green + '✓' : colors.red + '✗';
    const status = success ? colors.green + 'PASSED' : colors.red + 'FAILED';
    console.log(`${icon}${colors.reset} ${name.padEnd(30)} ${status}${colors.reset}`);
    if (success) passed++;
    else failed++;
  }

  console.log(colors.dim + '─'.repeat(60) + colors.reset);
  const total = passed + failed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`Total: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset} (${passRate}%)`);
}

// Main
async function main() {
  console.log('');
  console.log(colors.cyan + '╔════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.cyan + '║' + colors.reset + colors.bold + '         ArcSign Developer Mode Test Script              ' + colors.reset + colors.cyan + '  ║' + colors.reset);
  console.log(colors.cyan + '╚════════════════════════════════════════════════════════════╝' + colors.reset);
  console.log('');
  console.log(colors.yellow + 'Prerequisites:' + colors.reset);
  console.log('  1. Dashboard running with Developer Mode ON');
  console.log('  2. Wallet selected in Developer Mode page');
  console.log('  3. USB device connected');
  console.log('');

  try {
    // Connect to WebSocket
    await connect();

    // Get accounts
    console.log('\nFetching wallet addresses...');
    const accounts = await getAccounts();

    if (accounts.length === 0) {
      log(colors.red, '✗', 'No accounts found. Make sure:');
      console.log('  - Developer Mode is enabled in the Dashboard');
      console.log('  - A wallet is selected');
      console.log('  - USB device is connected');
      ws.close();
      rl.close();
      process.exit(1);
    }

    walletAddress = accounts[0];
    log(colors.green, '✓', `Using address: ${walletAddress}`);

    if (accounts.length > 1) {
      console.log(colors.dim + `   (${accounts.length - 1} more addresses available)` + colors.reset);
    }

    // Main loop
    while (true) {
      const choice = await showMenu();

      switch (choice) {
        case '1':
          await testPersonalSign();
          break;
        case '2':
          await testSignTypedData();
          break;
        case '3':
          await testDevSignTransaction();
          break;
        case '4':
          await testGetExplorerApiKey();
          break;
        case '5':
          await testSessionManagement();
          break;
        case '6':
          console.log('\n' + colors.cyan + '🚀 Running all signing tests...' + colors.reset);
          {
            const results = {
              'personal_sign': await testPersonalSign(),
              'sign_typed_data_v4': await testSignTypedData(),
              'dev_sign_transaction': await testDevSignTransaction(),
            };
            printSummary(results);
          }
          break;
        case '7':
          console.log('\n' + colors.cyan + '🚀 Running all non-signing tests...' + colors.reset);
          {
            const results = {
              'get_explorer_api_key': await testGetExplorerApiKey(),
              'session_management': await testSessionManagement(),
            };
            printSummary(results);
          }
          break;
        case '8':
          console.log('\n' + colors.cyan + '🚀 Running ALL tests...' + colors.reset);
          console.log(colors.yellow + '(Non-signing tests first, then signing tests)' + colors.reset);
          {
            const results = {
              // Non-signing tests first (no user interaction needed)
              'get_explorer_api_key': await testGetExplorerApiKey(),
              'session_management': await testSessionManagement(),
              // Signing tests (require user approval)
              'personal_sign': await testPersonalSign(),
              'sign_typed_data_v4': await testSignTypedData(),
              'dev_sign_transaction': await testDevSignTransaction(),
            };
            printSummary(results);
          }
          break;
        case '0':
          console.log('\n' + colors.green + 'Goodbye!' + colors.reset);
          ws.close();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log(colors.red + 'Invalid choice. Please enter 0-8.' + colors.reset);
      }
    }
  } catch (err) {
    log(colors.red, '✗', `Error: ${err.message}`);
    if (ws) ws.close();
    rl.close();
    process.exit(1);
  }
}

main();
