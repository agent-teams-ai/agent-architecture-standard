# Agent Architecture Standard

Status: private Phase 1 normative-artifact implementation; unpublished; identifiers provisional

This README is an index and has no independent semantic authority.

The Agent Architecture Standard (AAS) defines language-neutral contracts for
describing repository architecture policy, binding evaluation to immutable
inputs, and reporting deterministic enforcement results. Agent Architecture
Protocol (AAP) is only the request/response and negotiation component of AAS. It
is not a second umbrella standard or an independently promoted product.

This repository contains specification artifacts plus private deterministic
generation and verification tooling. It contains no provider runtime,
transport, plugin system, policy-module compiler, architecture inference, or
release automation. The artifacts describe an experimental 0.x boundary and
do not constitute a published release or conformance claim.

All public identifiers in this scaffold are provisional. Before any public 0.x
schema, identifier, conformance claim, or package, normative-standard authority
and independent conformance authority MUST move to a credibly neutral repository
and accountable roles with immutable history, identifiers, and resolution
preserved. A person or implementation MUST NOT make a public AAS conformance
claim, use an AAS conformance mark, or present an artifact as an AAS release
until that D1 relocation is complete and the neutral normative, conformance, and
release roles described in [governance.md](spec/governance.md) are assigned and
operational.

## Normative document map

| Document | Sole subject authority |
| --- | --- |
| [core.md](spec/core.md) | Scope, terminology, artifact authority, result semantics, versions, and registries |
| [identity.md](spec/identity.md) | Strict JSON input, RFC 8785 canonicalization, domain framing, and identity definitions |
| [policy-and-enforcement.md](spec/policy-and-enforcement.md) | Effective policy, bindings, precedence, defaults, exceptions, enforcement, and diagnostics |
| [security-and-conformance.md](spec/security-and-conformance.md) | Portable-bounded threat profile, claim requirements, and release manifests |
| [governance.md](spec/governance.md) | Phase 0 governance, publication sequence, and change control |

Normative keywords have the meanings assigned by BCP 14 when, and only when,
they appear in uppercase. Every normative requirement is intended to receive a
stable requirement ID before a public release. The current IDs and filenames
remain provisional.

## Artifact indexes

- [schemas/README.md](schemas/README.md) indexes future wire-shape schemas.
- [registries/README.md](registries/README.md) defines registry files and their
  lifecycle.
- [vectors/README.md](vectors/README.md) indexes future exact observable
  examples.
- [templates/normative-traceability.md](templates/normative-traceability.md)
  defines the mandatory traceability record.

The indexes are normative about artifact ownership and admission requirements,
but they do not fabricate schemas, registered values, or conformance evidence
that Phase 0 has not produced.

## Non-goals

AAS does not infer an architecture from directory names, define DDD, Clean
Architecture, Feature-Sliced Design, or SOLID compliance, execute repository
configuration, or guarantee domain correctness. It does not require Node,
TypeScript, Foundation, a daemon, an MCP server, an HTTP service, or a hosted
registry.

Engineering Foundation integrations, consumer presets, agent prompts, composed
workflows, and examples are nonnormative projections. A consumer owns its
vocabulary, architecture rules, exceptions, binding scopes, activation, and
merge policy. Installing or upgrading an implementation MUST NOT activate a
consumer rule; the normative rule is in `spec/policy-and-enforcement.md`.

## Repository governance

This private repository is the current incubation specification home, and the D1
neutral-authority prerequisite is not complete. [MAINTAINERS.md](MAINTAINERS.md)
records `@777genius` as repository steward, normative maintainer for private
incubation, and security responder for private incubation. The independent
conformance maintainer and release maintainer are unassigned, and no namespace
custodian is assigned or recorded. See [GOVERNANCE.md](GOVERNANCE.md),
[CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[repository decision index](docs/decisions/README.md).

## Research provenance

[SOURCE.md](SOURCE.md) identifies the unchanged research slice used as design
input. Files under `docs/research/` remain nonnormative historical research.
The current versioned [D0–D11 decision packet](decisions/phase-0-d0-d11-v2.md) records
the commissioning owner, disclosed approval status, source revision and digests,
outcomes, and compatibility effects. Where research conflicts with those
accepted Phase 0 decisions, this normative scaffold controls within its assigned
authority. Packet acceptance does not make the unassigned public governance
roles operational.

## License

Apache License 2.0. See [LICENSE](LICENSE).
