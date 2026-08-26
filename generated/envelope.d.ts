/* Generated from schemas/envelope.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type target = {
  "id": import("./common.js").identifier;
  "input": import("./overlay.js").overlay;
  "extensions": import("./common.js").extensionMap;
  "criticalExtensions": import("./common.js").extensionMap;
};

export type request = {
  "kind": "request";
  "envelopeVersion": import("./common.js").envelopeVersion;
  "aasIdentity": import("./common.js").aasIdentity;
  "standardVersion": import("./common.js").version;
  "operation": import("./common.js").identifier;
  "targets": Array<target>;
  "snapshotAasIdentity": import("./common.js").aasIdentity;
  "policyAasIdentity": import("./common.js").aasIdentity;
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "budgets": import("./common.js").budgets;
  "extensions": import("./common.js").extensionMap;
  "criticalExtensions": import("./common.js").extensionMap;
};

export type diagnosticHeader = {
  "version": "0.1";
  "code": import("./common.js").identifier;
  "targetId": import("./common.js").identifier;
  "resolution": "decided" | "needs-input" | "indeterminate" | "unsupported" | "stale";
  "verdict"?: "pass" | "fail" | "not-applicable";
  "mode": "shadow" | "advisory" | "required";
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "snapshotAasIdentity": import("./common.js").aasIdentity;
  "policyAasIdentity": import("./common.js").aasIdentity;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "requestAasIdentity": import("./common.js").aasIdentity;
  "resultAasIdentity": import("./common.js").aasIdentity;
  "freshness": "fresh" | "stale";
  "omissionCount": JsonInteger;
  "nextAction": import("./common.js").identifier;
};

export type resolution = {
  "targetId": import("./common.js").identifier;
  "resolution": "decided" | "needs-input" | "indeterminate" | "unsupported" | "stale";
  "verdict"?: "pass" | "fail" | "not-applicable";
  "reason"?: import("./common.js").identifier;
  "diagnostic": diagnosticHeader;
};

export type result = {
  "kind": "result";
  "envelopeVersion": import("./common.js").envelopeVersion;
  "aasIdentity": import("./common.js").aasIdentity;
  "requestAasIdentity": import("./common.js").aasIdentity;
  "resolutions": Array<resolution>;
  "extensions": import("./common.js").extensionMap;
};

export type problem = {
  "kind": "problem";
  "envelopeVersion": import("./common.js").envelopeVersion;
  "code": import("./common.js").identifier;
};

export type AASRequestResultResolutionProblemAndDiagnosticEnvelopes = (request) | (result) | (problem) | (diagnosticHeader);
