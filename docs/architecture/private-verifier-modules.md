# Private verifier modules

Status: private Phase 1 implementation; unpublished and nonnormative.

`lib/result-validation.mjs` is the compatibility and composition facade. It
preserves the existing 26-name synchronous API while the package manifest keeps
all `lib/` modules private.

```text
result-validation facade -> focused modules + lazy default schema adapter
invocation-kernel -> identity, binding, accounting, invariants + injected admission port
identity/binding/accounting/invariants -> canonical-json primitive
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
