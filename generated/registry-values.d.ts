/* Generated from schemas/registry-values.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type actionId = "none";

export type problemCode = "aas.problem.no-common-envelope-version" | "aas.problem.binding-set-conflict";

export type diagnosticCode = "aas.json.raw-bytes-required" | "aas.example.ok" | "aas.json.input-too-large" | "aas.json.depth-exceeded" | "aas.json.duplicate-key" | "aas.json.invalid-utf8" | "aas.json.invalid-syntax" | "aas.json.invalid-number" | "aas.schema.unknown-id" | "aas.schema.duplicate-id" | "aas.schema.alias-id" | "aas.schema.network-ref" | "aas.schema.ref-cycle" | "aas.schema.invalid";

export type canonicalizationProfile = ({
  "version": "0";
  "id": "agent-architecture-canonical-json-rfc8785@0";
  "aasIdentity": import("./common.js").aasIdentity;
});

export type snapshotCaptureProfile = ({
  "version": "0";
  "id": "agent-architecture-snapshot-portable-bounded@0";
  "aasIdentity": import("./common.js").aasIdentity;
});

export type portablePathProfile = ({
  "version": "1";
  "id": "agent-architecture-portable-path-unicode17@1";
  "aasIdentity": "aas:v0:sha256:33506c698ffc526f13b18f0354a3b1138a3efc462dc14ae42ccd5a4d46343752";
});

export type accountingProfile = ({
  "version": "1";
  "id": "agent-architecture-resource-accounting-v0@1";
  "aasIdentity": "aas:v0:sha256:aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300";
});

export type GeneratedAASClosedRegistryWireValues = Record<PropertyKey, never>;
