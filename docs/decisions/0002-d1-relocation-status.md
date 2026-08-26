# ADR-0002: D1 relocation remains incomplete

Status: Accepted

Date: 2026-08-27

Supersedes: the claim in ADR-0001 that independent conformance authority is
already governed from this repository. ADR-0001's separation of artifact
authorities and Foundation's nonnormative role remains in force.

## Context

The repository is isolated from Engineering Foundation and is the intended
durable home for Agent Architecture Standard artifacts. Repository separation
alone does not establish neutral normative, conformance, and release authority.
The current bootstrap has one disclosed steward and no assigned independent
conformance or release maintainer.

## Decision

D1 is incomplete. This repository MUST remain private and all identifiers,
schemas, packages, marks, and conformance claims MUST remain unpublished until
the relocation and accountable-role requirements in
`spec/governance.md` are satisfied and recorded.

The accepted Phase 0 packet may be integrated and implementation work may
continue privately. That work does not activate public identifiers or grant a
conformance claim.

## Consequences

- The repository is a private neutralization target, not yet a neutral standards
  authority.
- No maintainer, reviewer, bot, or token may be presented as an unassigned human
  role.
- A later decision must record the accountable roles, custody separation, and
  preserved relocation evidence before the first public release candidate.
