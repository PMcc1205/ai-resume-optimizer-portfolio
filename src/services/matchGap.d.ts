import type { EvidenceMapping, Fact, Gap, JobRequirement } from '../types/domain'

export const MATCH_GAP_RULE_VERSION: string
export function calculateMatchAndGaps(requirements: JobRequirement[], facts: Fact[], mappings: EvidenceMapping[]): { mappings: EvidenceMapping[]; gaps: Gap[] }
export function createMatchGapSnapshot(requirements: JobRequirement[], facts: Fact[], mappings: EvidenceMapping[]): string
