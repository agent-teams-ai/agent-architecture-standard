/* Generated from schemas/common.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type nonnegativeInteger = JsonInteger;

export type aasIdentity = ConstrainedString;

export type contentDigest = ConstrainedString;

export type identifier = ConstrainedString;

export type definitionVersion = ConstrainedString;

export type version = definitionVersion;

export type canonicalSemVer = ConstrainedString;

export type envelopeVersion = "0.1";

export type schemaBundleVersion = "0.1";

export type registryEdition = "1";

export type vectorSuiteVersion = "0.1";

export type conformanceSuiteVersion = "0.1";

export type portablePath = ConstrainedString;

export type extensionMap = {
  [key: string]: JsonValue;
};

export type jsonValue = (ConstrainedString | boolean | null) | (JsonInteger) | (Array<jsonValue>) | ({
  [key: string]: jsonValue;
});

export type budgets = {
  "maxInputBytes": JsonInteger;
  "maxDepth": JsonInteger;
  "maxPathSegments": JsonInteger;
  "maxPathBytes": JsonInteger;
  "maxEntries": JsonInteger;
  "maxLogicalBytes": JsonInteger;
  "maxReadBytes": JsonInteger;
  "maxPerEntryBytes": JsonInteger;
  "maxOverlayOperations": JsonInteger;
  "maxTargets": JsonInteger;
  "maxEvidenceReferences": JsonInteger;
  "maxExtensionBytes": JsonInteger;
  "maxDiagnostics": JsonInteger;
  "maxOutputBytes": JsonInteger;
  "maxConcurrency": JsonInteger;
  "maxTotalWork": JsonInteger;
};

export type profileRef = {
  "version": definitionVersion;
  "id": identifier;
  "aasIdentity": aasIdentity;
};

export type artifactRef = {
  "aasIdentity": aasIdentity;
  "contentDigest": contentDigest;
  "byteLength": JsonInteger;
  "mediaType": ConstrainedString;
};

export type AASProvisionalCommonTypes = Record<PropertyKey, never>;
