# Private verifier modules

Status: private Phase 1 implementation; unpublished and nonnormative.

Immutable `spec/` Status headers name the normative edition. `SOURCE.md` names
the repository's distinct implementation phase; private Phase 1 work does not
revise the versioned `@1` profiles in place.

`lib/result-validation.mjs` is the compatibility and composition facade. It
preserves the existing 26-name synchronous API while the package manifest keeps
all `lib/` modules private.

```text
result-validation facade -> focused modules + lazy default schema adapter
invocation-kernel -> identity, binding, accounting, invariants + injected admission port
identity validation + release validation -> identity-framing leaf -> canonical-json primitive
binding/accounting/invariants -> canonical-json primitive
schema-admission adapter -> pure schema-admission-core
```

The kernel captures the synchronous admission port, resolver, integration
context, and authority documents once. Its per-instance `WeakMap` authenticates
opaque preflight capabilities. The binding module owns applicability,
precedence, indexing, query, and rollout; accounting owns canonical byte charges,
budget minima, counters, and lower bounds; invariants own request/result
cross-field checks. No focused module imports the facade, and no verifier module
depends on Engineering Foundation. The Node fs/Ajv adapter reads and compiles
schemas only on first admission, so facade and identity-only imports are inert.

## Bounded verification work

The normative request/result shape allows up to 100,000 target resolutions and
large shared diagnostic collections. Result invariants group diagnostics and
omissions by target once; per-target validation scans only the corresponding
group. After the exact ordered request/response bijection has been validated,
the invocation kernel reconciles target resolutions through a keyed lookup
instead of searching the entire result for each request target.

The private profile and closed schema dependency graphs traverse with explicit
stacks rather than relying on JavaScript call-stack depth. The schema catalog
uses canonical, uniquely prefixed IDs, so a duplicate basename is already a
duplicate ID. These changes are implementation-only:
they do not alter JSON schemas, identities, selected bindings, error codes,
published interfaces, or conformance claims.

## Foundation refactor guarantees and intentionally retained seams

- Binding decisions first match their coordinate, then sort by stable rank and
  ASCII identity, and inspect each equal-rank group once. All ranks (including
  lower ranks) must still reject semantic conflicts. The historic exact getter
  access count was an implementation trace, not a normative output contract.
- Registry replacements, release dependencies, profiles, and schema references
  use bounded iterative graph walks; cyclic in-memory schema inputs fail closed.
  Repeated shared acyclic schema nodes are examined only when reached at a
  deeper level, retaining maxDepth enforcement without exponential revisits.
- Strict raw-byte JSON admission uses an explicit stack; canonical identity
  serialization retains its proven recursive implementation under the existing
  schema-depth ceiling. Exact spelling, decoded-key, UTF-8 and identity vectors
  remain the compatibility oracle. The default admission depth is not widened.
  Identity framing hashes length-prefixed components without concatenating a
  second full frame.
- Accounting streams path upper bounds rather than constructing a second
  target-count-sized collection. Result checks retain aggregate diagnostic
  counts and omission reasons, not copies of all diagnostic objects per target.
  Request admission occurs once when result validation delegates to joint
  request/result invariants.

The private implementation stays source-owned; the 26-name facade and the
existing normative artifacts remain unchanged. This refactor does not qualify
a provider, introduce a public rule DSL, or make a publication claim.
