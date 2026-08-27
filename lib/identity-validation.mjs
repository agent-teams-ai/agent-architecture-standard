import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

// The only source for closed identity domains and the pinned accounting identity.
const identitySource = Object.freeze({
  magic: 'AAS-ID',
  profile: 'agent-architecture-canonical-json-rfc8785@0',
  domains: Object.freeze({
    binding: 'aas.binding.v0', bindingSet: 'aas.binding-set.v0', targetSelection: 'aas.target-selection.v0',
    overlay: 'aas.overlay.v0', analysisKey: 'aas.analysis.v0', profile: 'aas.profile.v0',
    effectivePolicy: 'aas.policy.v0', analyzer: 'aas.analyzer.v0', promotion: 'aas.promotion.v0',
    exception: 'aas.exception.v0', request: 'aas.request.v0', result: 'aas.result.v0'
  }),
  resourceAccountingProfileAasIdentity: 'aas:v0:sha256:aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300'
});

const runtime = Object.freeze({
  magic: identitySource.magic, profile: identitySource.profile,
  domains: Object.freeze({ ...identitySource.domains })
});
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

const computeFramedIdentity = (name, value, project = identityProjection) => {
  const payload = Buffer.from(canonicalJson(project(value)), 'utf8');
  const magic = Buffer.from(runtime.magic), domain = Buffer.from(runtime.domains[name]), profile = Buffer.from(runtime.profile);
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain,
    u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
};
const identityProjection = (value) => { const projection = structuredClone(value); delete projection.aasIdentity; return projection; };

export const RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY = identitySource.resourceAccountingProfileAasIdentity;
export const resultIdentityProjection = (result) => {
  const projection = identityProjection(result);
  for (const resolution of projection.resolutions ?? []) delete resolution.diagnostic?.resultAasIdentity;
  return projection;
};
export const requestIdentityProjection = identityProjection;
export const exceptionIdentityProjection = identityProjection;

export const computeBindingAasIdentity = (value) => computeFramedIdentity('binding', value);
export const computeBindingSetAasIdentity = (value) => computeFramedIdentity('bindingSet', value);
export const computeTargetSelectionAasIdentity = (value) => computeFramedIdentity('targetSelection', value);
export const computeOverlayAasIdentity = (value) => computeFramedIdentity('overlay', value);
export const computeAnalysisKeyAasIdentity = (value) => computeFramedIdentity('analysisKey', value);
export const computeProfileAasIdentity = (value) => computeFramedIdentity('profile', value);
export const computeEffectivePolicyAasIdentity = (value) => computeFramedIdentity('effectivePolicy', value);
export const computeAnalyzerAasIdentity = (value) => computeFramedIdentity('analyzer', value);
export const computePromotionAasIdentity = (value) => computeFramedIdentity('promotion', value);
export const computeExceptionAasIdentity = (value) => computeFramedIdentity('exception', value, exceptionIdentityProjection);
export const computeRequestAasIdentity = (value) => computeFramedIdentity('request', value, requestIdentityProjection);
export const computeResultAasIdentity = (value) => computeFramedIdentity('result', value, resultIdentityProjection);
