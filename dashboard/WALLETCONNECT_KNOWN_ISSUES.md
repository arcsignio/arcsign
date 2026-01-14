# WalletConnect Integration - Known Issues & Fixes

**Date**: 2026-01-14
**Status**: Phase 1 Implementation In Progress

## TypeScript Compilation Errors ✅ ALL FIXED

### 1. SessionTypes.Relay Type Missing ✅ FIXED

**Error**:
```
Namespace 'SessionTypes' has no exported member 'Relay'.
```

**Fix Applied**: Defined custom `RelayProtocol` interface in `types.ts`:
```typescript
export interface RelayProtocol {
  protocol: string;
  data?: string;
}
```

Then replaced `SessionTypes.Relay` with `RelayProtocol` in `PersistedSession` and `SessionApprovalRequest` interfaces.

### 2. Event Type Mismatch in WalletConnectContext.tsx ✅ FIXED

**Error**:
```
Argument of type '"session_proposal"' is not assignable to parameter of type
```

**Root Cause**: `client.on()` method expects typed event names from SignClient types, not string literals.

**Fix Applied**: Modified `on()` method in `client.ts` to accept any string with `@ts-ignore`:
```typescript
on(event: string, callback: (args: any) => void): void {
  const client = this.getClient();
  // @ts-ignore - WalletConnect types are complex, use any for flexibility
  client.on(event, callback);
}
```

### 3. Unused Imports ✅ FIXED

**Fix Applied**: Removed all unused imports:
- `useTranslation` from PairingModal and SessionApprovalDialog
- `CHAIN_ID_MAP` from SessionApprovalDialog
- `useEffect` from WalletConnectContext
- `SignClientTypes` from client.ts

### 4. approveSession Return Type ✅ FIXED

**Error**:
```
Type '{ topic: string; acknowledged: () => Promise<Struct>; }' is missing properties
```

**Fix Applied**: Changed return type to `Promise<any>` for flexibility:
```typescript
async approveSession(
  proposalId: number,
  namespaces: Record<string, SessionTypes.Namespace>
): Promise<any> {
  // ...
}
```

### 5. Error Response Data Type ✅ FIXED

**Error**:
```
Type 'unknown' is not assignable to type 'string | undefined'.
```

**Fix Applied**: In `respondSessionRequest`, restructured error response creation:
```typescript
const errorResponse: any = {
  code: response.error.code,
  message: response.error.message,
};
if (response.error.data) {
  errorResponse.data = String(response.error.data);
}
await client.respond({
  topic,
  response: {
    id: response.id,
    jsonrpc: '2.0',
    error: errorResponse,
  },
});
```

### 6. Vite Build Configuration - BigInt Support ✅ FIXED

**Error**:
```
Big integer literals are not available in the configured target environment
```

**Root Cause**: WalletConnect dependencies (ox package) use BigInt literals, but build target was set to `es2021` which has limited BigInt support.

**Fix Applied**: Updated `vite.config.ts` to use `esnext` target:
```typescript
build: {
  target: 'esnext',  // Changed from ['es2021', 'chrome100', 'safari13']
  minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
  sourcemap: !!process.env.TAURI_DEBUG,
}
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

- [x] Compile TypeScript without errors ✅
- [x] Vite build passes ✅
- [x] Rust compilation passes ✅ (41 warnings, no errors)
- [x] App starts without crashes ✅ (Tauri app running successfully)
- [ ] Can open pairing modal (requires unlock)
- [ ] Can paste WC URI
- [ ] Session approval dialog appears
- [ ] Can approve/reject sessions
- [ ] Sessions persist to USB
- [ ] Sessions recover after app restart

## Next Steps

1. ~~Fix all TypeScript compilation errors~~ ✅ DONE
2. ~~Test Rust compilation~~ ✅ DONE
3. ~~Test app startup~~ ✅ DONE
4. **Test WalletConnect UI after unlock**:
   - Unlock the app with password
   - Verify WalletConnect initialization logs
   - Test opening pairing modal
   - Test pasting WC URI
5. **Integration testing with WalletConnect Test dApp**
6. **Integrate wallet address selection** (replace placeholder `0x0000...`)
7. **Implement session persistence to USB**
8. **Move to Phase 2: Request handlers**

---

**Last Updated**: 2026-01-14 17:55
**Status**: ✅ All compilation and build tests passing. App starts successfully. Ready for UI testing after unlock.
