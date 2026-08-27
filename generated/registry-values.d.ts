/* Generated from schemas/registry-values.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type actionId = "none";

export type problemCode = "aas.problem.no-common-envelope-version";

export type canonicalizationProfile = ({
  "version": "0";
  "id": "agent-architecture-canonical-json-rfc8785@0";
  "aasIdentity": import("./common.js").aasIdentity;
}) | ({
  "version": "0";
  "id": "agent-architecture-snapshot-portable-bounded@0";
  "aasIdentity": import("./common.js").aasIdentity;
}) | ({
  "version": "1";
  "id": "agent-architecture-portable-path-unicode17@1";
  "aasIdentity": import("./common.js").aasIdentity;
});

export type GeneratedAASClosedRegistryWireValues = Record<PropertyKey, never>;
