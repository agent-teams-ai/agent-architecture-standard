/* Generated from schemas/identity-documents.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type repositoryRevision = {
  "aasIdentity": import("./common.js").aasIdentity;
  "repositoryId": import("./common.js").identifier;
  "revisionSystemProfile": import("./common.js").profileRef;
  "nativeRevision": ConstrainedString;
  "treeAasIdentity": import("./common.js").aasIdentity;
};

export type profile = {
  "aasIdentity": import("./common.js").aasIdentity;
  "kind": "canonicalization" | "operation" | "vocabulary" | "evaluator" | "security" | "path" | "diagnostic" | "accounting";
  "id": import("./common.js").identifier;
  "definitionVersion": import("./common.js").version;
  "schemas": Array<import("./common.js").artifactRef>;
  "dependencies": Array<import("./common.js").profileRef>;
  "limits": import("./common.js").budgets;
  "semanticsArtifacts": Array<import("./common.js").artifactRef>;
  "definitionVectorSuites": Array<import("./common.js").artifactRef>;
};

export type analyzer = {
  "aasIdentity": import("./common.js").aasIdentity;
  "implementationArtifacts": Array<import("./common.js").artifactRef>;
  "configuration": Array<configurationEntry>;
  "profiles": Array<import("./common.js").profileRef>;
};

export type configurationEntry = {
  "name": import("./common.js").identifier;
  "value": import("./common.js").jsonValue;
};

export type promotionRecord = {
  "aasIdentity": import("./common.js").aasIdentity;
  "ruleId": import("./common.js").identifier;
  "consumer": import("./common.js").identifier;
  "policy": import("./common.js").aasIdentity;
  "profiles": Array<import("./common.js").profileRef>;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "rolloutScope": ConstrainedString;
  "previousMode": "shadow" | "advisory";
  "nextMode": "advisory" | "required";
  "evidence": Array<import("./common.js").artifactRef>;
  "denominator": import("./common.js").nonnegativeInteger;
  "escapes": import("./common.js").nonnegativeInteger;
  "falseBlocks": import("./common.js").nonnegativeInteger;
  "incidents": import("./common.js").nonnegativeInteger;
  "owner": ConstrainedString;
  "rollbackAction": import("./common.js").identifier;
  "responseSla": ConstrainedString;
};

export type analysisKey = {
  "aasIdentity": import("./common.js").aasIdentity;
  "operationProfile": import("./common.js").profileRef;
  "evaluatorProfiles": Array<import("./common.js").profileRef>;
  "inputAasIdentities": Array<import("./common.js").aasIdentity>;
  "budgets": import("./common.js").budgets;
  "accountingProfile": import("./common.js").profileRef;
  "semanticExtensions": import("./common.js").extensionMap;
};

export type AASPrivateProvisionalIdentityBearingDocuments = (import("./artifacts.js").artifact) | (import("./artifacts.js").snapshot) | (profile) | (import("./policy.js").effectivePolicy) | (repositoryRevision) | (import("./policy.js").exception) | (promotionRecord) | (import("./policy.js").binding) | (analyzer) | (import("./overlay.js").overlay) | (import("./envelope.js").request) | (analysisKey) | (import("./envelope.js").result) | (import("./overlay.js").receipt) | (import("./conformance.js").releaseManifest);
