# Agent Architecture Standard

Agent Architecture Standard is a machine-first, language-neutral contract for
coding agents to inspect declared repository architecture, evaluate planned
relations, validate exact virtual overlays, and emit deterministic evidence.

## Current status

🚧 Private incubation. No schema ID, package, profile, badge, or conformance
claim from this repository is public or stable yet.

The first normative boundary is intentionally small:

- closed immutable effective policy, digest, provenance, and binding;
- deterministic envelopes, identities, diagnostics, and evidence;
- a bounded portable security profile;
- independently authored black-box conformance vectors.

Foundation-specific presets, generators, consumer semantics, transports,
plugins, sessions, caches, and a universal architecture DSL are not normative.

## Authority model

- JSON Schemas own wire shape.
- Registries own identifiers and lifecycle state.
- Normative prose owns meaning.
- Vectors own exact observable examples.
- Generated language bindings are derived and own no semantics.

If artifacts disagree, publication stops until the owner artifact and all
derived artifacts are reconciled in one reviewed change.

See [GOVERNANCE.md](GOVERNANCE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the
initial [authority decision](docs/decisions/0001-authority-and-incubation.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
