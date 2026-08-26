/* Generated from schemas/registry.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type AASRegistryEdition = {
  "registry": "operations" | "resolutions" | "diagnostics" | "profiles" | "extensions" | "envelope-versions";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id": (import("./common.js").identifier) | (import("./common.js").envelopeVersion);
  "kind": ConstrainedString;
  "owner": ConstrainedString;
  "contact": ConstrainedString;
  "status": "provisional" | "active" | "deprecated" | "withdrawn" | "reserved";
  "semanticAuthority": ConstrainedString;
  "introducedEdition": ConstrainedString;
  "replacement"?: import("./common.js").identifier;
  "semanticsAasIdentity"?: import("./common.js").aasIdentity;
  "orderingRank"?: JsonInteger;
  "vectors": Array<ConstrainedString>;
  "collisionReview": ConstrainedString;
}>;
  "changes": Array<ConstrainedString>;
};
