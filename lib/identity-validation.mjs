import { computeFramedIdentity } from './identity-framing.mjs';

const identityProjection = (value) => { const projection = structuredClone(value); delete projection.aasIdentity; return projection; };

export { computeProfileAasIdentity, RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY } from './identity-framing.mjs';

export function resultIdentityProjection(result) {
  const projection = identityProjection(result);
  for (const resolution of projection.resolutions ?? []) {delete resolution.diagnostic?.resultAasIdentity;}
  return projection;
}
export function requestIdentityProjection(request) {
  return identityProjection(request);
}
export function exceptionIdentityProjection(exception) {
  return identityProjection(exception);
}

export const computeBindingAasIdentity = (value) => computeFramedIdentity('binding', value, identityProjection);
export const computeBindingSetAasIdentity = (value) => computeFramedIdentity('bindingSet', value, identityProjection);
export const computeTargetSelectionAasIdentity = (value) => computeFramedIdentity('targetSelection', value, identityProjection);
export const computeOverlayAasIdentity = (value) => computeFramedIdentity('overlay', value, identityProjection);
export const computeAnalysisKeyAasIdentity = (value) => computeFramedIdentity('analysisKey', value, identityProjection);
export const computeEffectivePolicyAasIdentity = (value) => computeFramedIdentity('effectivePolicy', value, identityProjection);
export const computeAnalyzerAasIdentity = (value) => computeFramedIdentity('analyzer', value, identityProjection);
export const computePromotionAasIdentity = (value) => computeFramedIdentity('promotion', value, identityProjection);
export function computeExceptionAasIdentity(exception) {
  return computeFramedIdentity('exception', exceptionIdentityProjection(exception), identityProjection);
}
export function computeRequestAasIdentity(request) {
  return computeFramedIdentity('request', request, requestIdentityProjection);
}
export function computeResultAasIdentity(result) {
  return computeFramedIdentity('result', result, resultIdentityProjection);
}
