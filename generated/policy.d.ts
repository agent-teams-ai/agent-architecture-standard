/* Generated from schemas/policy.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type provenanceEntry = {
  "sourceArtifact": import("./common.js").artifactRef;
  "semanticRole": "authoritative-source" | "commissioning-decision" | "generator";
  "sourceOwner": ConstrainedString;
  "supports": Array<ConstrainedString>;
};

export type exception = {
  "aasIdentity": import("./common.js").aasIdentity;
  "ruleId": import("./common.js").identifier;
  "scope": import("./common.js").portablePath;
  "owner": ConstrainedString;
  "reasonCode": import("./common.js").identifier;
  "creationPolicyAasIdentity": import("./common.js").aasIdentity;
  "validForRevision": import("./common.js").aasIdentity;
};

export type effectivePolicy = {
  "schemaVersion": "0.1";
  "aasIdentity": import("./common.js").aasIdentity;
  "consumer": import("./common.js").identifier;
  "scope": import("./common.js").portablePath;
  "profiles": Array<import("./common.js").profileRef>;
  "rules": Array<{
  "id": import("./common.js").identifier;
  "parameters": {
  [key: string]: JsonValue;
};
}>;
  "exceptions": Array<exception>;
  "provenance": Array<provenanceEntry>;
};

export type binding = {
  "schemaVersion": "0.1";
  "aasIdentity": import("./common.js").aasIdentity;
  "id": import("./common.js").identifier;
  "consumer": import("./common.js").identifier;
  "repository": import("./common.js").identifier;
  "scope": import("./common.js").portablePath;
  "rolloutScope": ConstrainedString;
  "mode": "shadow" | "advisory" | "required";
  "policyAasIdentity": import("./common.js").aasIdentity;
  "profiles": Array<import("./common.js").profileRef>;
  "budgets": import("./common.js").budgets;
  "exceptions": Array<import("./common.js").aasIdentity>;
  "owner": ConstrainedString;
};

export type AASEffectivePolicyBindingAndException = (effectivePolicy) | (binding) | (exception);
