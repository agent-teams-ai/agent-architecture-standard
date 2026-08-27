/* Generated from schemas/artifact-manifest.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type manifestPath = ConstrainedString;

export type AASNormativeArtifactManifest = {
  "manifestVersion": "1";
  "standardVersion": import("./common.js").canonicalSemVer;
  "status": "provisional-unpublished";
  "schemaDialect": "https://json-schema.org/draft/2020-12/schema";
  "identityPolicy": {
  "contentDigest": "raw-sha256-over-exact-content-bytes";
  "aasIdentity": "domain-framed-identity-deferred-to-phase-2";
};
  "artifacts": Array<{
  "path": manifestPath;
  "class": "schema" | "registry" | "vector" | "normative-prose" | "generated-declaration" | "version-matrix";
  "schemaId"?: ConstrainedString;
  "contentDigest": import("./common.js").contentDigest;
  "aasIdentityStatus": "not-computed-phase-1";
  "byteLength": JsonInteger;
  "mediaType": ConstrainedString;
}>;
};
