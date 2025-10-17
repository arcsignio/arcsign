<!--
SYNC IMPACT REPORT
==================
Version Change: 0.0.0 → 1.0.0 (Initial Constitution)
Rationale: Initial constitution ratification with security-first blockchain wallet development principles

Modified Principles:
  - N/A (initial creation)

Added Sections:
  - I. Security-First Development (NON-NEGOTIABLE)
  - II. Test-Driven Development (NON-NEGOTIABLE)
  - III. Incremental Progress Over Big Bangs
  - IV. Composition Over Inheritance
  - V. Documentation-Driven Development
  - Architecture (MVC, Backend-First with Go, API Service Isolation)
  - Governance (Amendment Process, Compliance Review, Documentation)

Removed Sections:
  - N/A (initial creation)

Templates Status:
  ✅ .specify/templates/plan-template.md - Updated with detailed Constitution Check gates
     - Added Security-First Development checklist (6 items)
     - Added Test-Driven Development checklist (3 items)
     - Added Incremental Progress checklist (3 items)
     - Added Composition Over Inheritance checklist (3 items)
     - Added Documentation-Driven checklist (3 items)
     - Added Architecture checklist (3 items)
  ✅ .specify/templates/spec-template.md - Updated with Security Requirements section
     - Added 5 security requirement templates (SR-001 through SR-005)
     - Aligned with Security-First Development principle
  ✅ .specify/templates/tasks-template.md - Updated with security test tasks
     - Added security test tasks for each user story phase
     - Renumbered task IDs to accommodate security tests (T012, T021, T028)
     - Tests marked as OPTIONAL and aligned with TDD principle

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Verify project start date for accurate ratification date
-->

# ArcSign Constitution

## Core Principles

### I. Security-First Development

**NON-NEGOTIABLE**: Security is prioritized above schedule and features.

- Private keys and mnemonic phrases MUST NEVER leave the USB secure zone (Secure Element or protected storage).
- All sensitive data MUST be encrypted using Argon2id + AES-256-GCM (key source: environment variables or device secure storage).
- Multi-factor authentication MUST be enforced: Application password + Wallet password.
- API credentials MUST be isolated to the Proxy service (arcsign_api_service); the main system MUST NOT store external API keys.
- Logs MUST NOT contain sensitive information (passwords, keys, complete addresses, amounts).
- All secrets MUST use environment variables or OS Secret Store; hardcoding secrets is PROHIBITED.

**Rationale**: Blockchain wallet applications handle irreversible financial transactions. A single security breach can result in permanent loss of user assets. Security must be non-negotiable and enforced at every layer.

### II. Test-Driven Development

**NON-NEGOTIABLE**: Tests must be written before implementation.

- Follow the Red-Green-Refactor cycle: Write test (Red) → Minimal implementation (Green) → Refactor.
- All features MUST have unit + integration + contract tests.
- Security-sensitive features MUST have dedicated security tests.
- All tests MUST pass before committing; commits MUST NOT break existing tests.

**Rationale**: In security-critical applications, untested code is a liability. TDD ensures every code path is validated before deployment, reducing the risk of critical bugs in production.

### III. Incremental Progress Over Big Bangs

- Break features into 3-5 phases; each phase MUST be compilable, testable, and revertible.
- Every commit MUST be a runnable unit.
- Maximum 3 attempts per approach; on failure, document the issue and switch to an alternative approach.

**Rationale**: Large, monolithic changes increase risk and make debugging difficult. Incremental development enables faster feedback, easier rollback, and continuous validation.

### IV. Composition Over Inheritance

- Prefer interfaces and dependency injection over inheritance hierarchies.
- Each module MUST have a single responsibility.
- Avoid over-abstraction and "clever" code; favor explicit, readable implementations.

**Rationale**: Composition creates loosely coupled, testable, and maintainable systems. Deep inheritance hierarchies introduce tight coupling and make testing and modification difficult.

### V. Documentation-Driven Development

- Update SYSTEM_SPECIFICATION.md (single source of truth RFP) after deployment.
- All architectural decisions MUST be documented before implementation.
- API contracts MUST be documented before endpoint implementation.

**Rationale**: Documentation-driven development ensures alignment between design and implementation, reduces misunderstandings, and creates a single source of truth for the system.

## Architecture

### MVC Layered Architecture

The project MUST follow MVC (Model-View-Controller) architectural separation:

- **Model Layer**: Data entities, business logic, and persistence (isolated, testable, framework-agnostic).
- **View Layer**: User interface and presentation logic (decoupled from business logic).
- **Controller Layer**: Request handling, input validation, and orchestration between Model and View.

**Backend-First Approach**:

- Backend API development takes priority.
- Backend uses **Go** for performance, security, and strong typing.
- Future architecture: Frontend-backend separation (API-first design).

**API Service Isolation**:

- External API credentials are managed exclusively by `arcsign_api_service` proxy.
- Main system MUST NOT directly access or store third-party API keys.

**Rationale**: MVC separation ensures clear boundaries, testability, and maintainability. Backend-first with Go provides a secure, performant foundation for sensitive financial operations.

## Governance

### Amendment Process

- Constitution amendments require explicit documentation and approval before implementation.
- All amendments MUST include:
  - Clear rationale for the change
  - Impact analysis on existing templates and workflows
  - Migration plan if breaking changes are introduced
- Version increments follow semantic versioning:
  - **MAJOR**: Backward-incompatible governance or principle removal/redefinition
  - **MINOR**: New principle/section added or materially expanded guidance
  - **PATCH**: Clarifications, wording fixes, non-semantic refinements

### Compliance Review

- All pull requests and code reviews MUST verify compliance with constitutional principles.
- Any complexity or deviation from principles MUST be explicitly justified.
- Security principles (Principle I) are NON-NEGOTIABLE and MUST NOT be compromised.

### Documentation

- Runtime development guidance is maintained in this constitution.
- Templates (plan-template.md, spec-template.md, tasks-template.md) MUST remain aligned with constitutional principles.
- Template updates MUST be synchronized within the same commit as constitution amendments.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-10-15
