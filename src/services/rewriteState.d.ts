import type { RewriteSuggestion, RewriteUserDecision, RewriteValidation } from '../types/domain'
export function applyRewriteDecision(items: RewriteSuggestion[], rewriteId: string, decision: RewriteUserDecision | '已采纳' | 'accepted' | 'rejected'): RewriteSuggestion[]
export function mergeRegeneratedRewrite(items: RewriteSuggestion[], regenerated: RewriteSuggestion): RewriteSuggestion[]
export function applyManualRewriteEdit(items: RewriteSuggestion[], rewriteId: string, optimizedText: string): RewriteSuggestion[]
export function confirmRewriteFacts(items: RewriteSuggestion[], rewriteId: string): RewriteSuggestion[]
export function mergeRewriteValidations(items: RewriteSuggestion[], validations: RewriteValidation[]): RewriteSuggestion[]
export function hasCurrentRewriteValidation(item: RewriteSuggestion): boolean
export function normalizeRewriteItems(items: RewriteSuggestion[]): RewriteSuggestion[]
export function effectiveRewriteText(item: RewriteSuggestion): string
export function finalRewriteText(item: RewriteSuggestion): string | null
export function canEnterFinalResume(items: RewriteSuggestion[]): boolean
export function normalizeRewriteDecision(decision: RewriteUserDecision | '已采纳' | 'accepted' | 'rejected' | 'pending' | unknown): RewriteUserDecision
export function normalizeRewriteValidationStatus(status: RewriteSuggestion['validationStatus'] | 'pending' | 'passed' | 'failed' | unknown): RewriteSuggestion['validationStatus']
export function acceptButtonState(item: RewriteSuggestion, regenerating?: boolean): { label: string; disabled: boolean; title: string; selected: boolean }
export function rejectButtonState(item: RewriteSuggestion, regenerating?: boolean): { label: string; disabled: boolean; title: string; selected: boolean }
