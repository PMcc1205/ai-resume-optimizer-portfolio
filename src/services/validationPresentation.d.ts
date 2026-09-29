import type { JobRequirement, ResumeDiagnosis } from '../types/domain'
export function validationReasonPresentation(reason?: string, unsupportedClaims?: string[]): { kind:string; title:string; explanation:string }
export function diagnosisDisplayNames(diagnosisIds: string[], diagnoses: ResumeDiagnosis[], requirements: JobRequirement[]): string[]
export function humanizeTechnicalError(message: string): string
export function stripInternalIdentifiers(text: string): string
