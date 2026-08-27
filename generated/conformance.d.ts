/* Generated from schemas/conformance.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type versionedArtifact = {
  "version": import("./common.js").canonicalSemVer;
  "artifact": import("./common.js").artifactRef;
};

export type claimedProfile = {
  "kind": "operation" | "evaluator" | "vocabulary" | "security" | "diagnostic";
  "id": import("./common.js").identifier;
  "aasIdentity": import("./common.js").aasIdentity;
};

export type versionedProfile = {
  "version": import("./common.js").definitionVersion;
  "id": import("./common.js").identifier;
  "aasIdentity": import("./common.js").aasIdentity;
};

export type platform = {
  "os": ConstrainedString;
  "architecture": ConstrainedString;
  "runtime": ConstrainedString;
  "toolchain": Array<ConstrainedString>;
};

export type oracle = {
  "artifact": import("./common.js").artifactRef;
  "independentlyAuthored": boolean;
  "independentlyReviewed": boolean;
  "dependencies": Array<import("./common.js").artifactRef>;
  "lineageAudit": import("./common.js").artifactRef;
};

export type claim = {
  "schemaVersion": "0.1";
  "status": "provisional";
  "visibility": "private";
  "qualification": "unqualified";
  "claimant": ConstrainedString;
  "providerArtifact": import("./common.js").artifactRef;
  "standard": versionedArtifact;
  "canonicalizationProfile": versionedProfile;
  "envelope": versionedArtifact;
  "schemaBundle": versionedArtifact;
  "registryEdition": versionedArtifact;
  "vectorSuite": versionedArtifact;
  "conformanceSuite": versionedArtifact;
  "profiles": Array<claimedProfile>;
  "supportedPlatforms": Array<platform>;
  "unsupportedAreas": Array<ConstrainedString>;
  "conformanceManifest": import("./common.js").artifactRef;
  "reportArtifacts": Array<import("./common.js").artifactRef>;
  "testDisposition": {
  "total": import("./common.js").nonnegativeInteger;
  "passed": import("./common.js").nonnegativeInteger;
  "failed": import("./common.js").nonnegativeInteger;
  "omitted": import("./common.js").nonnegativeInteger;
};
  "omissions": Array<import("./common.js").identifier>;
  "replayArtifacts": Array<import("./common.js").artifactRef>;
  "oracles": Array<oracle>;
  "issuedAt": ConstrainedString;
  "expiresAt": ConstrainedString;
  "withdrawalReferences": Array<import("./common.js").artifactRef>;
  "rollbackReferences": Array<import("./common.js").artifactRef>;
  "limitations": Array<ConstrainedString>;
};

export type reportResult = {
  "caseId": import("./common.js").identifier;
  "outcome": "pass" | "fail" | "omitted";
  "durationMilliseconds": import("./common.js").nonnegativeInteger;
};

export type report = {
  "schemaVersion": "0.1";
  "repository": import("./common.js").identifier;
  "sourceRevision": ConstrainedString;
  "runnerArtifact": import("./common.js").artifactRef;
  "providerArtifact": import("./common.js").artifactRef;
  "profiles": Array<import("./common.js").profileRef>;
  "fixtures": Array<import("./common.js").artifactRef>;
  "platform": platform;
  "inputs": Array<import("./common.js").artifactRef>;
  "results": Array<reportResult>;
  "coverage": Array<import("./artifacts.js").coverage>;
  "omissions": Array<import("./common.js").identifier>;
  "durationMilliseconds": import("./common.js").nonnegativeInteger;
  "replaySeeds": Array<ConstrainedString>;
  "attemptId": import("./common.js").identifier;
};

export type qualificationSidecar = {
  "schemaVersion": "0.1";
  "subject": import("./common.js").artifactRef;
  "status": "provisional" | "qualified" | "suspended" | "withdrawn" | "expired";
  "authority": ConstrainedString;
  "evidence": Array<import("./common.js").artifactRef>;
  "approvalEvidence": Array<import("./common.js").artifactRef>;
  "issuedAt": ConstrainedString;
  "expiresAt": ConstrainedString;
  "withdrawalReferences": Array<import("./common.js").artifactRef>;
};

export type releaseMember = {
  "name": import("./common.js").identifier;
  "version": import("./common.js").canonicalSemVer;
  "artifact": import("./common.js").artifactRef;
  "provenance": import("./common.js").artifactRef;
  "sbom": import("./common.js").artifactRef;
};

export type releaseDependency = {
  "from": import("./common.js").identifier;
  "to": import("./common.js").identifier;
  "version": import("./common.js").canonicalSemVer;
  "artifactAasIdentity": import("./common.js").aasIdentity;
};

export type releaseEvidence = {
  "registryInstallation": import("./common.js").artifactRef;
  "packageInventory": import("./common.js").artifactRef;
  "upgrade": import("./common.js").artifactRef;
  "downgrade": import("./common.js").artifactRef;
  "publicApi": import("./common.js").artifactRef;
  "rollback": import("./common.js").artifactRef;
  "consumerCanary": import("./common.js").artifactRef;
};

export type approvalSidecars = {
  "normative": import("./common.js").aasIdentity;
  "conformance": import("./common.js").aasIdentity;
  "release": import("./common.js").aasIdentity;
};

export type releaseManifest = {
  "schemaVersion": "0.1";
  "aasIdentity": import("./common.js").aasIdentity;
  "cohort": import("./common.js").identifier;
  "maturity": "experimental";
  "members": Array<releaseMember>;
  "dependencies": Array<releaseDependency>;
  "schemas": Array<import("./common.js").aasIdentity>;
  "registries": Array<import("./common.js").aasIdentity>;
  "vectors": Array<import("./common.js").aasIdentity>;
  "profiles": Array<import("./common.js").aasIdentity>;
  "claims": Array<import("./common.js").aasIdentity>;
  "traceabilityMatrices": Array<import("./common.js").aasIdentity>;
  "governanceRoleIds": Array<import("./common.js").identifier>;
  "sourceCommit": ConstrainedString;
  "releaseCommit": ConstrainedString;
  "qualificationSidecars": Array<import("./common.js").aasIdentity>;
  "releaseEvidence": releaseEvidence;
  "publicationOrder": Array<import("./common.js").identifier>;
  "completionStatus": "incomplete" | "complete";
  "approvalSidecars": approvalSidecars;
  "limitations": Array<ConstrainedString>;
  "supportedVersions": Array<import("./common.js").canonicalSemVer>;
  "withdrawalInstructions": Array<ConstrainedString>;
};

export type AASConformanceClaimReportReleaseManifestAndQualificationSidecar = (claim) | (report) | (qualificationSidecar) | (releaseManifest);
