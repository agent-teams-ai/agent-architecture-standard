/* Generated from schemas/registry.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type envelopeVersionIdentifier = ConstrainedString;

export type AASRegistryEdition = ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("actions");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("operations");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("problems");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("resolutions");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("diagnostics");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("profiles");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("extensions");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>);
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": ("actions" | "operations" | "problems" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions") & ("envelope-versions");
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": (Array<{
  "id": (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "kind": ConstrainedString;
  "role"?: "canonicalization" | "snapshot-capture" | "portable-path" | "operation" | "vocabulary" | "evaluator" | "security" | "diagnostic" | "accounting";
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: (import("./common.js").identifier) | (envelopeVersionIdentifier);
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>) & (Array<{
  "id"?: envelopeVersionIdentifier;
  "kind"?: "envelope-version";
  "orderingRank": JsonInteger;
  "replacement"?: envelopeVersionIdentifier;
}>);
  "changes": Array<ConstrainedString>;
});
