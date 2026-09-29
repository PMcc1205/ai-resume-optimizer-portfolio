import type { EvidenceMapping, Gap } from '../types/domain'

export function resolutionStorageKey(baseKey: string, taskId: string): string
export function readSkippedRequirements(storage: Pick<Storage, 'getItem'>, key: string): string[]
export function updateSkippedRequirements(storage: Pick<Storage, 'setItem'>, key: string, current: string[], requirementId: string, skipped: boolean): string[]
export function summarizeFactGapActions(mappings: EvidenceMapping[], gaps: Gap[], skippedIds: string[]): {
  factGapCount: number
  skippedCount: number
  blockingCount: number
}
