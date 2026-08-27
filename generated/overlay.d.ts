/* Generated from schemas/overlay.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type operation = ({
  "op": "add" | "replace";
  "path": import("./common.js").portablePath;
  "contentAasIdentity": import("./common.js").aasIdentity;
  "expectedAasIdentity"?: import("./common.js").aasIdentity;
}) | ({
  "op": "delete";
  "path": import("./common.js").portablePath;
  "expectedAasIdentity"?: import("./common.js").aasIdentity;
});

export type overlay = {
  "aasIdentity": import("./common.js").aasIdentity;
  "baseSnapshotAasIdentity": import("./common.js").aasIdentity;
  "pathProfile": import("./registry-values.js").portablePathProfile;
  "limits": import("./common.js").budgets;
  "operations": Array<operation>;
};

export type receipt = {
  "aasIdentity": import("./common.js").aasIdentity;
  "resultAasIdentity": import("./common.js").aasIdentity;
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "integrationSnapshotAasIdentity": import("./common.js").aasIdentity;
  "integrationRevisionAasIdentity": import("./common.js").aasIdentity;
  "integrationWorktreeState": {
  "status": "clean" | "dirty";
  "treeAasIdentity": import("./common.js").aasIdentity;
};
  "exceptionValidityRevisionAasIdentity": import("./common.js").aasIdentity;
  "qualificationContext": {
  "claimAasIdentities": Array<import("./common.js").aasIdentity>;
  "qualificationSidecarAasIdentities": Array<import("./common.js").aasIdentity>;
};
};

export type AASOverlayDeclarationAndValidationReceipt = (overlay) | (receipt);
