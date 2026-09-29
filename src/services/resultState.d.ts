import type { EvidenceMapping, Gap, RewriteSuggestion } from '../types/domain'
export class ResultStateError extends Error { code:string }
export type FinalResumeLine = { text:string; rewriteId:string|null; source:'original'|'manual'|'ai' }
export type FinalResume = { lines:FinalResumeLine[]; sections:Array<{title:string;lines:FinalResumeLine[]}>; text:string }
export function buildFinalResume(resumeText:string, rewrites:RewriteSuggestion[]):FinalResume
export function buildResultStats(rewrites:RewriteSuggestion[]):{suggestionCount:number;adoptedCount:number;retainedCount:number;remainingCount:number}
export function buildDiagnosisStats(selectedDiagnosisIds:string[], rewrites:RewriteSuggestion[]):{issueCount:number;resolvedCount:number;retainedCount:number;uncoveredCount:number}
export function buildGapStats(mappings:EvidenceMapping[], gaps:Gap[], skippedIds:string[]):{factGapCount:number;skippedCount:number;blockingFactGapCount:number;capabilityShortfallCount:number;capabilityMissingCount:number;capabilityGapCount:number}
