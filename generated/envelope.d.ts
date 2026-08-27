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
  "standardVersion": import("./common.js").canonicalSemVer;
  "operation": import("./common.js").identifier;
  "targets": Array<target>;
  "snapshotAasIdentity": import("./common.js").aasIdentity;
  "policyAasIdentity": import("./common.js").aasIdentity;
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "accountingProfileAasIdentity": import("./common.js").aasIdentity;
  "budgets": import("./common.js").budgets;
  "extensions": import("./common.js").extensionMap;
  "criticalExtensions": import("./common.js").extensionMap;
};

export type coverageSummary = {
  "denominator": import("./common.js").nonnegativeInteger;
  "included": import("./common.js").nonnegativeInteger;
  "policyExcluded": import("./common.js").nonnegativeInteger;
  "unreadable": import("./common.js").nonnegativeInteger;
  "unsupported": import("./common.js").nonnegativeInteger;
  "unstable": import("./common.js").nonnegativeInteger;
  "unknown": import("./common.js").nonnegativeInteger;
  "budgetExhausted": import("./common.js").nonnegativeInteger;
};

export type severityCounts = {
  "info": import("./common.js").nonnegativeInteger;
  "warning": import("./common.js").nonnegativeInteger;
  "error": import("./common.js").nonnegativeInteger;
  "critical": import("./common.js").nonnegativeInteger;
};

export type diagnosticHeader = {
  "version": "0.1";
  "code": import("./common.js").identifier;
  "targetId": import("./common.js").identifier;
  "resolution": "decided" | "needs-input" | "indeterminate" | "unsupported" | "stale";
  "verdict"?: "pass" | "fail" | "not-applicable";
  "mode": "shadow" | "advisory" | "required";
  "rolloutDisposition": import("./common.js").identifier;
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "snapshotAasIdentity": import("./common.js").aasIdentity;
  "policyAasIdentity": import("./common.js").aasIdentity;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "analyzerAasIdentity": import("./common.js").aasIdentity;
  "overlayAasIdentity": import("./common.js").aasIdentity;
  "requestAasIdentity": import("./common.js").aasIdentity;
  "analysisKeyAasIdentity": import("./common.js").aasIdentity;
  "resultAasIdentity": import("./common.js").aasIdentity;
  "freshness": "fresh" | "stale";
  "coverageSummary": coverageSummary;
  "severityCounts": severityCounts;
  "highestSeverity": "none" | "info" | "warning" | "error" | "critical";
  "omissionCount": import("./common.js").nonnegativeInteger;
  "omissionReasons": Array<import("./common.js").identifier>;
  "nextAction": import("./common.js").identifier;
};

export type remediationAction = {
  "id": import("./common.js").identifier;
  "preconditions": Array<import("./common.js").identifier>;
};

export type decisionTrace = {
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "selectedBindingId": import("./common.js").identifier;
  "candidateBindings": Array<{
  "id": import("./common.js").identifier;
  "aasIdentity": import("./common.js").aasIdentity;
}>;
  "normalizedFacts": Array<import("./common.js").jsonValue>;
  "evaluatedBranch": import("./common.js").identifier;
  "exceptionDisposition": import("./common.js").identifier;
  "remediationPreconditions": Array<import("./common.js").identifier>;
};

export type paginationCursor = {
  "kind": "pagination-cursor";
  "aasIdentity": import("./common.js").aasIdentity;
  "resultAasIdentity": import("./common.js").aasIdentity;
  "requestAasIdentity": import("./common.js").aasIdentity;
  "profileAasIdentity": import("./common.js").aasIdentity;
  "orderingKey": import("./common.js").identifier;
  "nextPosition": import("./common.js").nonnegativeInteger;
};

export type diagnostic = {
  "code": import("./common.js").identifier;
  "severity": "info" | "warning" | "error" | "critical";
  "targetId": import("./common.js").identifier;
  "ruleOrProfile": import("./common.js").profileRef;
  "evidenceIds": Array<import("./common.js").identifier>;
  "terminalReason": import("./common.js").identifier;
  "decisionTrace": decisionTrace;
  "remediationActions": Array<remediationAction>;
};

export type omission = {
  "targetId": import("./common.js").identifier;
  "reason": import("./common.js").identifier;
  "count": import("./common.js").nonnegativeInteger;
};

export type realizedCounters = {
  "inputBytes": import("./common.js").nonnegativeInteger;
  "depth": import("./common.js").nonnegativeInteger;
  "pathSegments": import("./common.js").nonnegativeInteger;
  "pathBytes": import("./common.js").nonnegativeInteger;
  "entries": import("./common.js").nonnegativeInteger;
  "logicalBytes": import("./common.js").nonnegativeInteger;
  "readBytes": import("./common.js").nonnegativeInteger;
  "peakEntryBytes": import("./common.js").nonnegativeInteger;
  "overlayOperations": import("./common.js").nonnegativeInteger;
  "targets": import("./common.js").nonnegativeInteger;
  "evidenceReferences": import("./common.js").nonnegativeInteger;
  "extensionBytes": import("./common.js").nonnegativeInteger;
  "diagnostics": import("./common.js").nonnegativeInteger;
  "outputBytes": import("./common.js").nonnegativeInteger;
  "peakConcurrency": import("./common.js").nonnegativeInteger;
  "totalWork": import("./common.js").nonnegativeInteger;
};

export type extensionDisposition = {
  "extensionId": import("./common.js").identifier;
  "location": "request" | "target";
  "disposition": "understood" | "preserved" | "ignored";
  "requestBound": true;
  "affectsCoreSemantics": boolean;
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
  "analysisKeyAasIdentity": import("./common.js").aasIdentity;
  "resolutions": Array<resolution>;
  "coverage": Array<import("./artifacts.js").coverage>;
  "evidence": Array<import("./artifacts.js").evidence>;
  "omissions": Array<omission>;
  "realizedCounters": realizedCounters;
  "diagnostics": Array<diagnostic>;
  "extensionDispositions": Array<extensionDisposition>;
  "extensions": import("./common.js").extensionMap;
};

export type problem = {
  "kind": "problem";
  "envelopeVersion": import("./common.js").envelopeVersion;
  "code": import("./common.js").identifier;
};

export type AASRequestResultResolutionProblemAndDiagnosticEnvelopes = (request) | (result) | (problem) | (diagnosticHeader) | (diagnostic) | (paginationCursor);
