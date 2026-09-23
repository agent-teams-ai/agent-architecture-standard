# ADR-0003: Public source preview during D1 incubation

Status: Accepted by the repository owner

Date: 2026-09-23

Supersedes: only ADR-0002's requirement to keep the repository private and its
draft source files inaccessible. ADR-0002's finding that D1 is incomplete and
its prohibition on public release and conformance claims remain in force.

## Context

The owner has directed that this repository become public so its source and
checks can be inspected and developed openly. D1 relocation, independent
conformance and release authority, and namespace custody are still incomplete.
Repository visibility and qualification of a standard are separate decisions.

## Decision

The repository MAY be public as a source preview. Its current schemas,
identifiers, profiles, vectors, and implementation code are publicly readable
draft material, but remain provisional and unqualified. Public access does not
activate an identifier, publish a versioned AAS standard or package, authorize
a conformance mark, or qualify any implementation or consumer.

The `package.json` publication guard stays enabled. The release and authority
requirements in `spec/governance.md` and the accepted Phase 0 packet remain
binding before any official public 0.x schema, identifier, package, or claim.
Do not describe public repository visibility or a green CI run as satisfying D1.

## Consequences

- The README, security policy, and operational ledger must label this as a
  public, unpublished draft and keep the missing authority roles visible.
- Existing accepted decision and specification bytes remain unchanged.
- Publication, qualification, and consumer adoption require separate decisions
  and evidence; this visibility change grants none of them.
