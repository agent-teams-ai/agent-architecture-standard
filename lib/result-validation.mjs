// Compatibility/composition facade. Verifier modules remain private package internals.
import { assertSchema, parseSchemaBytes } from './schema-admission.mjs';
import { createInvocationKernel as createKernel } from './invocation-kernel.mjs';

export { deriveBindingSelection } from './binding-selection.mjs';
export {
  computeAnalysisKeyAasIdentity, computeAnalyzerAasIdentity, computeBindingAasIdentity,
  computeBindingSetAasIdentity, computeEffectivePolicyAasIdentity, computeExceptionAasIdentity,
  computeOverlayAasIdentity, computeProfileAasIdentity, computePromotionAasIdentity,
  computeRequestAasIdentity, computeResultAasIdentity, computeTargetSelectionAasIdentity,
  exceptionIdentityProjection, requestIdentityProjection, resultIdentityProjection,
  RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY
} from './identity-validation.mjs';
export { assertRequestInvariants, assertRequestResultInvariants, assertResultInvariants } from './result-invariants.mjs';
export {
  canonicalRequestExtensionBytes, canonicalRequestWireBytes, canonicalResultOutputBytes,
  deriveEffectiveBudgets, terminalFields
} from './resource-accounting.mjs';

const defaultSchemaAdmission = Object.freeze({ assertSchema, parseSchemaBytes });
export function createInvocationKernel({ operatorAuthority, targetAuthority, providerBudgets, ingressLimits } = {}) {
  return createKernel({ operatorAuthority, targetAuthority, providerBudgets, ingressLimits }, defaultSchemaAdmission);
}
