/* Generated from schemas/artifacts.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type artifact = import("./common.js").artifactRef;

export type coverage = {
  "stage": "discovery" | "capture" | "classification" | "evaluation" | "overlay-reevaluation";
  "denominator": JsonInteger;
  "included": JsonInteger;
  "policyExcluded": JsonInteger;
  "unreadable": JsonInteger;
  "unsupported": JsonInteger;
  "unstable": JsonInteger;
  "unknown": JsonInteger;
  "budgetExhausted": JsonInteger;
};

export type evidence = {
  "id": import("./common.js").identifier;
  "artifact": import("./common.js").artifactRef;
  "location": ({
  "kind": "byte-range";
  "offset": import("./common.js").nonnegativeInteger;
  "length": JsonInteger;
}) | ({
  "kind": "structured-pointer";
  "pointer": ConstrainedString;
});
  "producerAasIdentity": import("./common.js").aasIdentity;
  "derivation": {
  "method": import("./common.js").profileRef;
  "inputs": Array<import("./common.js").contentDigest>;
};
  "sensitivity": "public" | "internal" | "confidential" | "restricted";
  "inputContentDigest": import("./common.js").contentDigest;
  "applicableRuleOrProfile": import("./common.js").profileRef;
  "integrityStatus": "unresolved" | "digest-matched" | "snapshot-bound";
  "producerAssurance": "self-asserted" | "policy-allowlisted" | "externally-attested";
  "semanticStatus": "unchecked" | "schema-valid" | "conformance-checked";
};

export type snapshot = {
  "aasIdentity": import("./common.js").aasIdentity;
  "repositoryId": import("./common.js").identifier;
  "captureProfile": import("./registry-values.js").snapshotCaptureProfile;
  "pathProfile": import("./registry-values.js").portablePathProfile;
  "entries": Array<{
  "path": import("./common.js").portablePath;
  "artifact": import("./common.js").artifactRef;
}>;
  "coverage": Array<coverage>;
};

export type AASArtifactSnapshotCoverageAndEvidenceDescriptors = (artifact) | (snapshot) | (coverage) | (evidence);
