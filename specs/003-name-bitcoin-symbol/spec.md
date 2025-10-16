# Feature Specification: Extended Multi-Chain Support

**Feature Branch**: `003-name-bitcoin-symbol`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "我支援的鏈要支援... 檢查在現有的基礎上檢查有沒有這些鏈，沒有的話填補上去"

## Executive Summary

Extend ArcSign wallet to support 24 additional blockchain networks beyond the current 30 supported chains. This expansion will cover major Layer 2 solutions (Arbitrum, Optimism, Base, zkSync, Starknet, Linea), regional chains (Klaytn, Cronos, HECO), Cosmos ecosystem chains (Osmosis, Juno, Evmos, Secret Network), and other popular networks (Fantom, Celo, Harmony, Tezos, Kusama, etc.).

**Current State**: 30 blockchains supported
**Target State**: 54 blockchains supported (+24 new chains)
**Primary Value**: Comprehensive multi-chain coverage for users managing diverse cryptocurrency portfolios

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Layer 2 Ecosystem Addresses (Priority: P1)

Users need addresses for major Ethereum Layer 2 networks (Arbitrum, Optimism, Base, zkSync, Starknet, Linea) to participate in lower-cost DeFi applications and manage assets on these growing ecosystems.

**Why this priority**: Layer 2 solutions represent the fastest-growing segment of blockchain usage, with billions in TVL (Total Value Locked). These chains (especially Arbitrum, Optimism, and Base) have become essential for cost-effective Ethereum interactions.

**Independent Test**: User creates a new wallet and immediately receives addresses for all 6 major L2 chains without manual derivation. User can view and use these addresses to receive tokens on any L2 network.

**Acceptance Scenarios**:

1. **Given** a user creates a new wallet, **When** wallet creation completes, **Then** they receive addresses for Arbitrum (ARB), Optimism (OP), Base (BASE), zkSync (ZKS), Starknet (STRK), and Linea (LINEA)
2. **Given** a user has an existing wallet (v0.2.0), **When** they request address generation for L2 chains, **Then** system generates L2 addresses using the same mnemonic seed
3. **Given** L2 addresses are generated, **When** user exports address list, **Then** all L2 addresses are included with proper chain identifiers

---

### User Story 2 - Manage Regional Blockchain Assets (Priority: P2)

Users in Asian markets and those using centralized exchange ecosystems need addresses for regional chains (Klaytn for Korea, Cronos for Crypto.com users, HECO for Huobi users, Harmony for low-fee transactions).

**Why this priority**: Regional chains have significant user bases in specific markets. Klaytn is dominant in Korea, Cronos serves millions of Crypto.com users, HECO serves Chinese markets. Supporting these enables wallet adoption in key geographic regions.

**Independent Test**: User creates wallet and receives addresses for 4 regional chains. User can receive KLAY tokens from Korean exchange, CRO from Crypto.com, and HT from Huobi without additional steps.

**Acceptance Scenarios**:

1. **Given** a new wallet is created, **When** address generation runs, **Then** addresses for KLAY, CRO, HT, and ONE are generated
2. **Given** a user receives tokens on Klaytn, **When** they check their KLAY address, **Then** the balance appears correctly
3. **Given** a user wants to withdraw from Crypto.com to Cronos, **When** they provide their CRO address, **Then** they can receive CRO tokens directly on Cronos chain

---

### User Story 3 - Access Cosmos Ecosystem Chains (Priority: P2)

Users participating in the Cosmos Inter-Blockchain Communication (IBC) ecosystem need addresses for Osmosis (DEX), Juno (smart contracts), Evmos (EVM bridge), and Secret Network (privacy).

**Why this priority**: Cosmos IBC ecosystem represents a major interoperable blockchain network with significant DeFi activity. Osmosis is a leading DEX, Juno enables CosmWasm contracts, Evmos bridges Ethereum and Cosmos ecosystems.

**Independent Test**: User creates wallet and receives 4 Cosmos ecosystem addresses (OSMO, JUNO, EVMOS, SCRT). User can participate in Osmosis liquidity pools, deploy Juno contracts, and use Secret Network privacy features using same seed.

**Acceptance Scenarios**:

1. **Given** a new wallet with Cosmos Hub (ATOM) address, **When** user requests Cosmos ecosystem addresses, **Then** OSMO, JUNO, EVMOS, and SCRT addresses are generated using same mnemonic
2. **Given** user has OSMO address, **When** they transfer ATOM via IBC to Osmosis, **Then** they can view and manage tokens on Osmosis DEX
3. **Given** user holds multiple Cosmos chain tokens, **When** they export seed phrase, **Then** one seed phrase recovers all Cosmos ecosystem addresses

---

### User Story 4 - Support Alternative EVM Chains (Priority: P3)

Users trading or holding assets on alternative EVM-compatible chains (Fantom, Celo, Moonbeam, Metis, Gnosis) need addresses for these networks.

**Why this priority**: These are established EVM chains with active ecosystems but smaller user bases than L2s. Fantom had peak popularity in 2021-2022, Celo focuses on mobile payments, Moonbeam connects Polkadot to EVM, Metis offers decentralized sequencing, Gnosis serves as stable transaction chain.

**Independent Test**: User creates wallet and receives 5 alternative EVM addresses. User can interact with Fantom DeFi protocols, receive Celo mobile payments, and use Moonbeam for Polkadot-Ethereum bridges.

**Acceptance Scenarios**:

1. **Given** a new wallet, **When** address generation completes, **Then** FTM, CELO, GLMR, METIS, and GNO addresses are created
2. **Given** user receives payment on Celo mobile app, **When** they check CELO address in ArcSign, **Then** balance reflects correctly
3. **Given** user wants to bridge assets via Moonbeam, **When** they provide GLMR address, **Then** cross-chain transfer succeeds

---

### User Story 5 - Access Specialized Chain Addresses (Priority: P3)

Users need addresses for specialized blockchains including Kusama (Polkadot's canary network), Tezos (NFT platform), Zilliqa (sharding), Wanchain (cross-chain), and ICON (Korean enterprise chain).

**Why this priority**: These chains serve niche use cases: Kusama for experimental features, Tezos for NFT art (Teia marketplace), Zilliqa for scalability research, Wanchain for multi-chain bridges, ICON for enterprise adoption in Korea.

**Independent Test**: User creates wallet and receives 5 specialized chain addresses. User can participate in Kusama parachain auctions, mint Tezos NFTs, bridge assets via Wanchain, and interact with ICON dApps.

**Acceptance Scenarios**:

1. **Given** a new wallet, **When** multi-chain generation runs, **Then** KSM, XTZ, ZIL, WAN, and ICX addresses are created
2. **Given** user participates in Kusama parachain crowdloan, **When** they provide KSM address, **Then** they can lock KSM tokens for parachain support
3. **Given** user mints NFT on Tezos, **When** they check XTZ address, **Then** NFT ownership appears in compatible wallet viewers

---

### Edge Cases

- What happens when a user upgrades from v0.2.0 to v0.3.0 with existing wallet? (Answer: New chain addresses are generated on-demand or during next wallet access, backwards compatible)
- How does system handle chains with multiple address formats (e.g., Starknet has two address types)? (Answer: Use most widely supported standard format for initial release)
- What happens when EVM-compatible chain requires special derivation path beyond m/44'/60'? (Answer: Use chain-specific SLIP-44 coin type with standard derivation; fallback to Ethereum formatter for address generation)
- How does system handle Cosmos chains that use different Bech32 prefixes? (Answer: Apply correct prefix based on chain identifier: osmo1 for Osmosis, juno1 for Juno, evmos1 for Evmos, secret1 for Secret Network)
- What happens when user tries to send tokens to wrong chain address (e.g., Arbitrum ETH to Optimism address)? (Answer: Technical limitation - addresses may be identical for EVM chains; user must select correct network in sending wallet; ArcSign displays clear chain labels)
- How does system handle Substrate chains (Kusama) with sr25519 key type vs secp256k1? (Answer: Derive sr25519 keys using same entropy source as other chains; use substrate-compatible derivation path)

## Requirements *(mandatory)*

### Functional Requirements

#### Layer 2 Support (P1)

- **FR-001**: System MUST generate addresses for Arbitrum (ARB, coin type 9001) using Ethereum address formatter
- **FR-002**: System MUST generate addresses for Optimism (OP, coin type 614) using Ethereum address formatter
- **FR-003**: System MUST generate addresses for Base (BASE, coin type 8453) using Ethereum address formatter
- **FR-004**: System MUST generate addresses for zkSync (ZKS, coin type 324) using Ethereum address formatter
- **FR-005**: System MUST generate addresses for Starknet (STRK, coin type 9004) using appropriate Starknet address format (0x prefix, 32 bytes)
- **FR-006**: System MUST generate addresses for Linea (LINEA, coin type 59144) using Ethereum address formatter

#### Regional Chains (P2)

- **FR-007**: System MUST generate addresses for Klaytn (KLAY, coin type 8217) using Ethereum address formatter
- **FR-008**: System MUST generate addresses for Cronos (CRO, coin type 394) using Ethereum address formatter
- **FR-009**: System MUST generate addresses for HECO (HT, coin type 1010) using Ethereum address formatter
- **FR-010**: System MUST generate addresses for Harmony (ONE, coin type 1023) using Harmony one1 address format with Bech32 encoding

#### Cosmos Ecosystem (P2)

- **FR-011**: System MUST generate addresses for Osmosis (OSMO, coin type 118) using Cosmos Bech32 format with osmo1 prefix
- **FR-012**: System MUST generate addresses for Juno (JUNO, coin type 118) using Cosmos Bech32 format with juno1 prefix
- **FR-013**: System MUST generate addresses for Evmos (EVMOS, coin type 60) using Ethereum AND Cosmos dual format (evmos1 Bech32 and 0x Ethereum)
- **FR-014**: System MUST generate addresses for Secret Network (SCRT, coin type 529) using Cosmos Bech32 format with secret1 prefix

#### Alternative EVM Chains (P3)

- **FR-015**: System MUST generate addresses for Fantom (FTM, coin type 60) using Ethereum address formatter
- **FR-016**: System MUST generate addresses for Celo (CELO, coin type 52752) using Ethereum address formatter
- **FR-017**: System MUST generate addresses for Moonbeam (GLMR, coin type 1284) using Ethereum address formatter
- **FR-018**: System MUST generate addresses for Metis (METIS, coin type 1088) using Ethereum address formatter
- **FR-019**: System MUST generate addresses for Gnosis (GNO, coin type 700) using Ethereum address formatter

#### Specialized Chains (P3)

- **FR-020**: System MUST generate addresses for Kusama (KSM, coin type 434) using Substrate sr25519 format
- **FR-021**: System MUST generate addresses for Tezos (XTZ, coin type 1729) using tz1 format with ed25519 key type
- **FR-022**: System MUST generate addresses for Zilliqa (ZIL, coin type 313) using Bech32 format with zil1 prefix and ed25519 key type
- **FR-023**: System MUST generate addresses for Wanchain (WAN, coin type 5718350) using Ethereum address formatter with 0x prefix
- **FR-024**: System MUST generate addresses for ICON (ICX, coin type 74) using hx prefix format with secp256k1 key type

#### General Requirements

- **FR-025**: System MUST maintain backward compatibility with v0.2.0 wallets (existing 30-chain AddressBook continues to work)
- **FR-026**: System MUST generate all 54 chain addresses (30 existing + 24 new) during wallet creation in under 15 seconds
- **FR-027**: System MUST allow users to view addresses grouped by chain type (UTXO, EVM, Layer 2, Cosmos, Substrate, Other)
- **FR-028**: System MUST display chain-specific identifiers (e.g., "Arbitrum (ARB) - Ethereum L2" vs "Ethereum (ETH) - Mainnet") to prevent user confusion
- **FR-029**: System MUST use BIP44 standard derivation paths for all chains (m/44'/coin_type'/0'/0/0) with appropriate coin_type from SLIP-44 registry
- **FR-030**: System MUST handle graceful failures if specific chain formatter is not yet implemented (log failure, continue with remaining chains)

### Key Entities *(include if feature involves data)*

- **Chain Metadata**: Represents blockchain configuration including symbol (e.g., ARB), full name (e.g., Arbitrum), chain type (EVM/Layer 2), coin type (SLIP-44 number), formatter ID (address generation method), key type (secp256k1/ed25519/sr25519)
- **Derived Address**: Represents generated blockchain address including chain symbol, address string, derivation path (BIP44), market cap rank (for sorting), chain category (UTXO/EVM/L2/Cosmos/etc.)
- **Address Book**: Collection of derived addresses for all supported chains, associated with single wallet/mnemonic seed
- **Chain Category**: Logical grouping (UTXO chains, EVM Mainnet, Layer 2, Cosmos SDK, Substrate, Custom) for display organization

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a wallet and receive addresses for 54 blockchains (30 existing + 24 new) in under 15 seconds
- **SC-002**: 95% of new chain address generation succeeds on first attempt (allows 2-3 chains to gracefully fail if formatters pending)
- **SC-003**: Users can locate specific chain address within 5 seconds using chain category grouping or search
- **SC-004**: Wallet upgrade from v0.2.0 to v0.3.0 completes without errors or data loss for 100% of users
- **SC-005**: Address derivation for all chains produces identical results when using same mnemonic seed (deterministic generation)
- **SC-006**: Users can receive tokens on any of the 24 new chains within 2 minutes of wallet creation (addresses immediately usable)
- **SC-007**: System maintains backward compatibility: v0.2.0 wallets with 30 chains continue to function when loaded in v0.3.0

## Assumptions

1. **SLIP-44 Coin Types**: All chains use registered SLIP-44 coin types. Where chain uses same type as Ethereum (60), addresses may be identical across chains (user must select correct network in sending wallet).

2. **Address Format Standards**: Each chain follows documented address format standards:
   - EVM chains: 0x-prefixed 40-character hex (Ethereum format)
   - Cosmos SDK: Bech32 with chain-specific prefix (osmo1, juno1, etc.)
   - Substrate (Kusama): ss58 format with sr25519 keys
   - Tezos: Base58Check with tz1 prefix
   - Zilliqa: Bech32 with zil1 prefix
   - Harmony: Bech32 with one1 prefix
   - ICON: hx-prefixed hex format
   - Starknet: 0x-prefixed 64-character hex

3. **Key Derivation**: All chains derive from same BIP39 mnemonic using appropriate key type (secp256k1 for most chains, ed25519 for Solana/Tezos/Zilliqa/Algorand/Near, sr25519 for Substrate chains).

4. **Chain Priority**: Layer 2 chains (P1) are implemented first due to high user demand and ecosystem growth. Regional chains (P2) and Cosmos ecosystem (P2) follow. Alternative EVM and specialized chains (P3) are lower priority but included for completeness.

5. **Formatter Availability**: Most new chains use existing formatters (18 chains use Ethereum formatter, 4 use Cosmos Bech32). Only 6 chains require new formatters: Starknet, Harmony, Kusama, Tezos, Zilliqa, ICON.

6. **Performance Target**: 15-second total generation time assumes ~300ms per chain average, with some chains faster (EVM reuse) and some slower (new formatters with complex encoding).

7. **Market Data**: Market cap rankings may shift over time; rankings at implementation time determine default sort order in address list displays.

8. **Evmos Dual Format**: Evmos supports both Ethereum-style (0x) and Cosmos-style (evmos1) addresses. System generates both formats for maximum compatibility.

## Out of Scope

- **Token Balance Display**: Showing token balances for each chain (requires RPC node integration)
- **Transaction Signing**: Creating and signing transactions for any chain
- **Custom Derivation Paths**: Support for non-standard BIP44 paths (future enhancement)
- **Address Labeling**: User-defined labels or notes for specific addresses
- **QR Code Generation**: Generating QR codes for addresses (future enhancement)
- **Chain-Specific Features**: SegWit for Bitcoin, ENS for Ethereum, etc.
- **Hardware Wallet Integration**: Ledger/Trezor support (separate feature)
- **Mobile App**: This spec focuses on CLI/desktop wallet

## Dependencies

- **SLIP-44 Registry**: Coin type numbers must be registered in SLIP-44 standard
- **BIP39/BIP32/BIP44**: Standards for mnemonic generation and key derivation
- **Cryptographic Libraries**: Support for secp256k1, ed25519, sr25519 key types
- **Address Format Libraries**: Bech32 encoding, Base58Check, ss58 format libraries
- **Existing Formatters**: Reuse Ethereum formatter for 18 EVM-compatible chains, Cosmos formatter for 4 IBC chains

## Security Considerations

- All private keys derived from single mnemonic seed; seed must be protected with existing security measures (Argon2id encryption, USB cold storage)
- Address generation must be deterministic (same seed always produces same addresses)
- No private keys stored in AddressBook (addresses only)
- Chain metadata (coin types, formatter IDs) must be validated to prevent incorrect derivation paths
- Users must be warned that EVM L2 addresses may match Ethereum mainnet address (requires correct network selection in sending wallet)

## Acceptance Criteria

### Phase 1: Layer 2 Support (MVP)

- [ ] Arbitrum, Optimism, Base, zkSync, Starknet, Linea addresses generate successfully
- [ ] L2 addresses display with clear "Layer 2" designation
- [ ] L2 addresses tested with actual tokens (mainnet or testnet)
- [ ] Performance: All 6 L2 addresses generate within 3 seconds

### Phase 2: Regional + Cosmos Chains

- [ ] Klaytn, Cronos, HECO, Harmony addresses generate successfully
- [ ] Osmosis, Juno, Evmos, Secret Network addresses generate with correct Bech32 prefixes
- [ ] Evmos generates both Ethereum and Cosmos format addresses
- [ ] Regional chains tested with tokens from respective exchanges

### Phase 3: Alternative EVM + Specialized Chains

- [ ] Fantom, Celo, Moonbeam, Metis, Gnosis addresses generate successfully
- [ ] Kusama, Tezos, Zilliqa, Wanchain, ICON addresses generate with correct formats
- [ ] Kusama sr25519 derivation produces valid substrate address
- [ ] Tezos tz1 addresses validated against testnet

### Final Validation

- [ ] All 54 chains generate addresses in under 15 seconds
- [ ] Backward compatibility: v0.2.0 wallet loads without errors
- [ ] Address determinism: Same mnemonic generates identical addresses across runs
- [ ] User can locate any chain address within 5 seconds using category view
- [ ] Documentation updated with all 54 supported chains

## Next Steps

After specification approval:
1. Run `/speckit.plan` to generate implementation plan with tasks
2. Prioritize Layer 2 chains (P1) for immediate implementation
3. Implement regional chains (P2) and Cosmos ecosystem (P2) in parallel
4. Complete alternative EVM (P3) and specialized chains (P3) as final phase
5. Conduct cross-chain testing with actual tokens on testnets
6. Update user documentation with comprehensive chain list
