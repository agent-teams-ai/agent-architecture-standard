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
  "definitionVersion": import("./common.js").definitionVersion;
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
  "exposureInterval": exposureInterval;
  "rolloutScope": ConstrainedString;
  "previousMode": "shadow" | "advisory";
  "nextMode": "advisory" | "required";
  "evidence": Array<import("./common.js").artifactRef>;
  "denominators": Array<namedCount>;
  "escapes": import("./common.js").nonnegativeInteger;
  "falseBlocks": import("./common.js").nonnegativeInteger;
  "confidenceIntervals": Array<confidenceInterval>;
  "incidents": import("./common.js").nonnegativeInteger;
  "thresholds": Array<threshold>;
  "owner": ConstrainedString;
  "rollbackAction": import("./common.js").identifier;
  "responseSla": ConstrainedString;
};

export type exposureInterval = {
  "start": ConstrainedString;
  "end": ConstrainedString;
};

export type namedCount = {
  "name": import("./common.js").identifier;
  "count": import("./common.js").nonnegativeInteger;
};

export type confidenceInterval = {
  "metric": import("./common.js").identifier;
  "lowerBasisPoints": JsonInteger;
  "upperBasisPoints": JsonInteger;
  "confidenceBasisPoints": JsonInteger;
};

export type threshold = {
  "metric": import("./common.js").identifier;
  "operator": "less-than" | "less-than-or-equal" | "equal" | "greater-than-or-equal" | "greater-than";
  "value": import("./common.js").nonnegativeInteger;
};

export type analysisKey = {
  "aasIdentity": import("./common.js").aasIdentity;
  "operationProfile": import("./common.js").profileRef;
  "evaluatorProfiles": Array<import("./common.js").profileRef>;
  "inputAasIdentities": Array<import("./common.js").aasIdentity>;
  "budgets": import("./common.js").budgets;
  "accountingProfile": import("./registry-values.js").accountingProfile;
  "semanticExtensions": {
  "request": import("./common.js").extensionMap;
  "criticalRequest": import("./common.js").extensionMap;
  "targets": Array<{
  "id": import("./common.js").identifier;
  "extensions": import("./common.js").extensionMap;
  "criticalExtensions": import("./common.js").extensionMap;
}>;
};
  "requestAasIdentity": import("./common.js").aasIdentity;
  "operation": import("./common.js").identifier;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "snapshotAasIdentity": import("./common.js").aasIdentity;
};

export type bindingSet = {
  "aasIdentity": import("./common.js").aasIdentity;
  "bindings": Array<import("./policy.js").binding>;
};

export type targetSelection = {
  "aasIdentity": import("./common.js").aasIdentity;
  "targetId": import("./common.js").identifier;
  "consumer": import("./common.js").identifier;
  "repository": import("./common.js").identifier;
  "pathProfile": import("./registry-values.js").portablePathProfile;
  "subjectId"?: import("./common.js").identifier;
  "path": import("./common.js").portablePath;
  "ruleId"?: import("./common.js").identifier;
  "rolloutCohorts": Array<import("./common.js").identifier>;
};

export type AASPrivateProvisionalIdentityBearingDocuments = (import("./artifacts.js").artifact) | (import("./artifacts.js").snapshot) | (profile) | (import("./policy.js").effectivePolicy) | (repositoryRevision) | (import("./policy.js").exception) | (promotionRecord) | (import("./policy.js").binding) | (analyzer) | (import("./overlay.js").overlay) | (import("./envelope.js").request) | (analysisKey) | (bindingSet) | (targetSelection) | (import("./envelope.js").result) | (import("./overlay.js").receipt) | (import("./conformance.js").releaseManifest);
