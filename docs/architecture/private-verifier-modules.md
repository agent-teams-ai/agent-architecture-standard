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
also checks duplicate names using a set. These changes are implementation-only:
they do not alter JSON schemas, identities, selected bindings, error codes,
published interfaces, or conformance claims.
