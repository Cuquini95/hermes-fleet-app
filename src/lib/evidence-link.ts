export const EVIDENCE_ENDPOINT = '/hermes-api/api/evidence';
export const EVIDENCE_LINK_PATTERN = '/hermes-api/api/evidence\\?id=[a-f0-9]{64}';
const evidenceUrl = new RegExp(`^${EVIDENCE_LINK_PATTERN}$`);

export function isPrivateEvidenceUrl(value: unknown): value is string {
  return typeof value === 'string' && evidenceUrl.test(value);
}
