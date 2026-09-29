import type { Fact, JobRequirement } from '../types/domain'

export const EVIDENCE_MAPPING_RULE_VERSION: string

export function createEvidenceMappingInputSnapshot(requirements: JobRequirement[], facts: Fact[]): string
export function isLatestMappingRequest(requestId: number, latestRequestId: number): boolean

export function createSupplementalFact(input: {
  facts: Fact[]
  requirement: JobRequirement
  experience: { experienceId: string; experienceName: string }
  supplement: { experienceId: string; action: string; responsibility: string; result: string }
}): Fact
