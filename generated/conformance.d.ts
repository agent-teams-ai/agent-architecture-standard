/* Generated from schemas/conformance.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type claim = {
  "schemaVersion": "0.1";
  "status": "provisional";
  "visibility": "private";
  "qualification": "unqualified";
  "claimant": ConstrainedString;
  "providerArtifact": import("./common.js").artifactRef;
  "standardVersion": import("./common.js").version;
  "profiles": Array<import("./common.js").profileRef>;
  "suiteArtifact": import("./common.js").artifactRef;
  "reportArtifacts": Array<import("./common.js").artifactRef>;
  "limitations": Array<ConstrainedString>;
};

export type report = {
  "schemaVersion": "0.1";
  "sourceRevision": ConstrainedString;
  "runnerArtifact": import("./common.js").artifactRef;
  "providerArtifact": import("./common.js").artifactRef;
  "fixtureDigests": Array<import("./common.js").contentDigest>;
  "platform": ConstrainedString;
  "results": Array<{
  "caseId": import("./common.js").identifier;
  "outcome": "pass" | "fail";
}>;
  "omissions": Array<ConstrainedString>;
};

export type qualificationSidecar = {
  "schemaVersion": "0.1";
  "subject": import("./common.js").artifactRef;
  "status": "provisional" | "qualified" | "suspended" | "withdrawn" | "expired";
  "evidence": Array<import("./common.js").artifactRef>;
};

export type releaseManifest = {
  "schemaVersion": "0.1";
  "cohort": import("./common.js").identifier;
  "maturity": "experimental";
  "members": Array<{
  "name": import("./common.js").identifier;
  "version": import("./common.js").version;
  "artifact": import("./common.js").artifactRef;
}>;
  "dependencies": Array<{
  "from": import("./common.js").identifier;
  "to": import("./common.js").identifier;
}>;
  "qualificationSidecars": Array<import("./common.js").aasIdentity>;
  "completionStatus": "incomplete" | "complete";
  "limitations": Array<ConstrainedString>;
};

export type AASConformanceClaimReportReleaseManifestAndQualificationSidecar = (claim) | (report) | (qualificationSidecar) | (releaseManifest);
