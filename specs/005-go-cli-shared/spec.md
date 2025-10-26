# Feature Specification: Backend Communication Architecture Upgrade

**Feature Branch**: `005-go-cli-shared`
**Created**: 2025-10-24
**Status**: Draft
**Input**: User description: "go不用cli串接前端，而是採用shared Library方式"

## Overview

This feature upgrades the desktop application's backend communication architecture from a subprocess-based CLI approach to a native shared library integration. This aligns the application with industry standards established by leading hardware wallet applications like Ledger Live and Trezor Suite.

## Clarifications

### Session 2025-10-24

- Q: When the shared library fails to load at startup, what should the application do? → A: Block startup with error dialog explaining the issue and suggesting reinstall
- Q: If the shared library crashes during a wallet operation, what should happen? → A: Force application restart with recovery prompt explaining what happened
- Q: What level of logging/monitoring should be implemented for shared library function calls? → A: Log entry/exit with timing only

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Wallet Operations (Priority: P1)

Users perform wallet operations (create, import, unlock, generate addresses) and experience immediate responses without noticeable delays.

**Why this priority**: Core wallet operations are the most frequently used features. Performance directly impacts user satisfaction and perceived application quality. This is the foundation that makes all other features feel responsive.

**Independent Test**: Can be fully tested by measuring wallet creation time and comparing before/after migration. Delivers immediate value through faster response times for all wallet operations.

**Acceptance Scenarios**:

1. **Given** user clicks "Create Wallet", **When** wallet creation begins, **Then** operation completes in under 100 milliseconds (vs. previous 500ms)
2. **Given** user enters password to unlock wallet, **When** authentication occurs, **Then** wallet unlocks in under 50 milliseconds (vs. previous 400ms)
3. **Given** user requests address generation, **When** system generates 54 addresses, **Then** operation completes in under 2 seconds (vs. previous 15-30 seconds)
4. **Given** user imports a wallet from mnemonic, **When** import process executes, **Then** operation completes in under 100 milliseconds (vs. previous 400ms)

---

### User Story 2 - Seamless Application Startup (Priority: P2)

Users launch the application and immediately access all wallet features without waiting for background services to initialize.

**Why this priority**: First impression matters. Users should not experience startup delays or see "waiting for service" messages. This builds confidence in application reliability.

**Independent Test**: Can be tested by launching the application and attempting to create a wallet immediately. Success means no service initialization wait time.

**Acceptance Scenarios**:

1. **Given** application is launched, **When** main window appears, **Then** all wallet operations are immediately available
2. **Given** application is closed and reopened, **When** user navigates to wallet creation, **Then** no "initializing service" delay occurs
3. **Given** multiple wallet operations in sequence, **When** user switches between operations, **Then** no process startup overhead is observed

---

### User Story 3 - Reliable Error Handling (Priority: P2)

When errors occur during wallet operations, users receive clear, immediate feedback without cryptic system messages.

**Why this priority**: Error clarity reduces user frustration and support burden. Direct function calls provide structured error responses rather than parsing subprocess output.

**Independent Test**: Can be tested by triggering known error conditions (wrong password, insufficient storage, invalid mnemonic) and verifying error message clarity and presentation timing.

**Acceptance Scenarios**:

1. **Given** user enters incorrect wallet password, **When** unlock attempt fails, **Then** specific error message appears within 100ms stating "Incorrect password"
2. **Given** USB storage becomes unavailable, **When** wallet operation is attempted, **Then** clear error message appears immediately stating "Storage device not accessible"
3. **Given** user provides invalid mnemonic phrase, **When** import is attempted, **Then** specific validation error appears instantly with guidance on what's wrong
4. **Given** system encounters unexpected error, **When** operation fails, **Then** user-friendly error message appears without exposing technical stack traces

---

### User Story 4 - Continuous Operation (Priority: P3)

Users can perform multiple wallet operations in quick succession without experiencing delays between operations.

**Why this priority**: Power users and testing scenarios require rapid consecutive operations. Eliminating per-operation startup overhead improves workflow efficiency.

**Independent Test**: Can be tested by performing 10 wallet operations back-to-back (e.g., multiple address exports, wallet switches) and measuring total time vs. previous implementation.

**Acceptance Scenarios**:

1. **Given** user unlocks wallet A, **When** user immediately switches to wallet B and unlocks it, **Then** second operation starts instantly without delay
2. **Given** user exports addresses multiple times, **When** export operations are triggered consecutively, **Then** each export responds immediately
3. **Given** user performs 20 consecutive operations, **When** measuring total time, **Then** total time is reduced by at least 60% compared to previous implementation

---

### Edge Cases

- **Library loading failure**: Application blocks startup with error dialog explaining issue and suggesting reinstall
- **Library crash during operation**: Application forces immediate restart with recovery prompt explaining what happened and guiding user to verify data integrity
- How does the system handle shared library version mismatches between updates?
- What occurs if memory allocation fails during a cryptographic operation within the shared library?
- What happens when the shared library is locked by another process (antivirus, backup software)?
- How does cross-platform compatibility work if shared library fails to compile on specific OS versions?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST communicate with backend wallet operations through direct function calls rather than subprocess execution
- **FR-002**: System MUST load shared library once at application startup and maintain it in memory throughout application lifecycle
- **FR-003**: All existing wallet operations (create, import, unlock, generate addresses, export, rename, list) MUST function identically to current behavior from user perspective
- **FR-004**: System MUST return structured error responses directly from function calls rather than parsing text output
- **FR-005**: System MUST complete wallet creation operations in under 100 milliseconds (p95, warm start, including USB I/O but excluding initial library load)
- **FR-006**: System MUST complete address generation for all 54 blockchain addresses in under 2 seconds (p95, warm start, including all cryptographic operations)
- **FR-007**: System MUST block application startup if shared library fails to load, displaying error dialog that explains the issue and suggests reinstallation
- **FR-008**: System MUST support all current platforms (Windows, macOS, Linux) with platform-specific shared library formats (.dll, .dylib, .so)
- **FR-009**: System MUST force immediate application restart if shared library crashes during operation, displaying recovery prompt that explains the crash and guides user to verify data integrity
- **FR-010**: System MUST clean up library resources when application closes
- **FR-011**: All security features (mnemonic protection, password handling, USB validation) MUST maintain identical security guarantees
- **FR-012**: System MUST pass all existing unit tests (48 tests) without modification to test expectations
- **FR-013**: System MUST maintain compatibility with existing wallet file formats and USB storage structure
- **FR-014**: System MUST log shared library function entry/exit points with execution timing for observability, excluding sensitive data (passwords, mnemonics)

### Assumptions

- Shared library will be bundled with application installer and located in application directory
- Function signatures between frontend and backend are agreed upon and stable
- Memory management follows standard C-compatible allocation patterns for cross-language interop
- Shared library is single-threaded or handles thread safety internally
- Application restart is acceptable if shared library becomes corrupted (no hot-reload requirement)

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Performance Measurement Standards**:
- **Percentile**: All latency targets use p95 (95th percentile) - 95% of operations must meet target
- **Environment**: Warm start (library already loaded, USB device already mounted)
- **I/O Scope**: Includes USB I/O operations and cryptographic operations, excludes initial library loading
- **Cold Start**: Initial library load allowed up to 1 second (one-time cost at app startup, measured separately in SC-003)
- **Verification Method**: Measure 100 consecutive operations, calculate p95 from FR-014 entry/exit timing logs

**Criteria**:
- **SC-001**: Wallet creation operations complete in under 100 milliseconds (p95, warm start, including USB write and encryption)
- **SC-002**: Address generation for 54 blockchain addresses completes in under 2 seconds (p95, warm start, including all 54 key derivations)
- **SC-003**: Application startup (cold start) to first wallet operation takes under 3 seconds total, including library load time (single measurement at app launch)
- **SC-004**: Error message display latency is under 100 milliseconds from error occurrence (p95, measured from FFI function return to UI display)
- **SC-005**: Zero increase in memory consumption compared to current implementation (within 10MB tolerance)
- **SC-006**: 100% of existing manual test checklist items pass without modification
- **SC-007**: All 48 existing unit tests pass without changes to test assertions
- **SC-008**: Application successfully builds and runs on Windows, macOS, and Linux without platform-specific behavioral differences

### Qualitative Outcomes

- Users perceive wallet operations as "instant" rather than having noticeable processing delays
- Error messages are clearer and more actionable than current subprocess stderr parsing
- Application feels more integrated and professional (no external process management visible)
