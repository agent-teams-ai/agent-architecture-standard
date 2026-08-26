# Contributing

Thank you for helping make architecture tooling safer and easier for coding
agents.

Before implementation, open a proposal describing the agent workflow, two real
consumer examples when requesting shared semantics, compatibility impact,
security boundaries, and the smallest observable contract.

Normative contributions must update the owning artifacts together:

- wire shape in schemas;
- identifier lifecycle in registries;
- meaning in normative prose;
- exact behavior in positive and negative vectors.

Reference implementation output cannot generate its own expected conformance
answers. Do not add executable repository configuration, dynamic imports,
network resolution, hidden sessions, or implicit architecture inference.

Commits use Conventional Commits. By contributing, you agree that your
contribution is licensed under Apache-2.0 and that you have the right to submit
it. Public release changes follow [GOVERNANCE.md](GOVERNANCE.md).
