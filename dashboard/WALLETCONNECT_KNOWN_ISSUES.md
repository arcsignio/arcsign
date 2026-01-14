# WalletConnect Integration - Known Issues & Fixes

**Date**: 2026-01-14
**Status**: Phase 1 Implementation In Progress

## TypeScript Compilation Errors

### 1. SessionTypes.Relay Type Missing ✅ FIXED

**Error**:
```
Namespace 'SessionTypes' has no exported member 'Relay'.
```

**Fix**: Define custom `RelayProtocol` interface in `types.ts`:
```typescript
export interface RelayProtocol {
  protocol: string;
  data?: string;
}
```

Then replace `SessionTypes.Relay` with `RelayProtocol` in `PersistedSession` interface.

### 2. Event Type Mismatch in WalletConnectContext.tsx

**Error**:
```
Argument of type '"session_proposal"' is not assignable to parameter of type
```

**Root Cause**: `client.on()` method expects typed event names from SignClient types, not string literals.

**Fix**: Use proper event types from `@walletconnect/types`:
```typescript
import type { SignClientTypes } from '@walletconnect/types';

// Correct usage
wcClient.on('session_proposal' as SignClientTypes.Event, (proposal) => {
  // ...
});
```

### 3. Unused Imports

Remove unused imports:
- `t` from `useTranslation` in PairingModal and SessionApprovalDialog
- `CHAIN_ID_MAP` in SessionApprovalDialog
- `useEffect` in WalletConnectContext
- `PersistedSession` and `SUPPORTED_CHAINS` in client.ts

### 4. approveSession Return Type

**Error**:
```
Type '{ topic: string; acknowledged: () => Promise<Struct>; }' is missing properties
```

**Fix**: The `client.approve()` method returns a session object. Update type expectations or await the session properly.

### 5. Error Response Data Type

**Error**:
```
Type 'unknown' is not assignable to type 'string | undefined'.
```

**Fix**: In `respondSessionRequest`, cast error data to string:
```typescript
response: {
  id: response.id,
  jsonrpc: '2.0',
  error: {
    ...response.error,
    data: response.error.data as string | undefined,
  },
},
```

## Implementation TODOs

### Phase 1 Completion

1. **Session Recovery Flow**
   - Implement proper session deserialization from USB
   - Call `client.core.pairing.restore()` if needed
   - Test app restart → unlock → session recovery

2. **Wallet Address Integration**
   - Currently using placeholder address `0x0000...`
   - Need to integrate with wallet selection context
   - Get active wallet address for session approval

3. **Session Persistence**
   - Save sessions to USB after approval
   - Integrate with `save_wc_sessions` Tauri command
   - Include sessionToken in save call

### Phase 2: Request Handlers

1. **eth_sendTransaction**
   - Validate/Normalize parameters
   - Sign transaction (requires wallet password)
   - Broadcast to RPC

2. **personal_sign**
   - Handle parameter order compatibility
   - Call `sign_message` Go FFI function

3. **eth_signTypedData_v4**
   - Parse and validate EIP-712 data
   - Call `sign_typed_data` Go FFI function

4. **RPC Passthrough**
   - Implement read-only methods routing
   - No password required for these methods

## Testing Checklist

- [ ] Compile TypeScript without errors
- [ ] Rust compilation passes
- [ ] App starts without crashes
- [ ] Can open pairing modal
- [ ] Can paste WC URI
- [ ] Session approval dialog appears
- [ ] Can approve/reject sessions
- [ ] Sessions persist to USB
- [ ] Sessions recover after app restart

## Next Steps

1. Fix all TypeScript compilation errors
2. Test basic pairing flow with WalletConnect Test dApp
3. Integrate wallet address selection
4. Implement session persistence
5. Move to Phase 2: Request handlers

---

**Last Updated**: 2026-01-14 17:10
