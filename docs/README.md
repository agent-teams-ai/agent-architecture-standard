# Agent Architecture Standard documentation

This index routes agents to the correct authority. It is nonnormative and does not change publication or conformance prerequisites. Start with the [repository instructions](../AGENTS.md).

## Choose a task

| Task                                      | Start here                                                                                                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interpret a normative requirement         | [Normative document map](../README.md#normative-document-map), then the owning file in [spec](../spec/)                                                                                                                                        |
| Find the current implementation and phase | [Source status](../SOURCE.md), [implementation ledger](status/implementation-ledger.md)                                                                                                                                                        |
| Understand governance and relocation      | [Decision index](decisions/README.md), [normative governance](../spec/governance.md)                                                                                                                                                           |
| Work on the private verifier              | [Verifier module boundaries](architecture/private-verifier-modules.md), [conformance README](../conformance/README.md)                                                                                                                         |
| Find schemas, registries and traceability | [Artifact indexes](../README.md#artifact-indexes)                                                                                                                                                                                              |
| Investigate earlier design alternatives   | [Design research](research/agent-architecture-standard-design.md), [implementation plan](research/agent-architecture-standard-implementation-plan.md), [product decisions research](research/agent-architecture-standard-product-decisions.md) |

## Document organization

- [Architecture](architecture/): private implementation boundaries.
- [Decisions](decisions/): repository governance decisions; normative requirements remain in the owning specification.
- [Status](status/): implementation observations and qualification limits.
- [Research](research/): nonnormative historical input.

Keep normative specifications, generated artifacts, decisions and research separate. Preserve existing paths and versioned artifact bytes. Extend this map when adding a canonical route; do not repeat normative rules here or infer public conformance from private evidence.
