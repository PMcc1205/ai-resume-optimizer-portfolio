import type { Fact, JobRequirement, RewriteSuggestion, RewriteValidation } from '../types/domain'
import { humanizeTechnicalError } from './validationPresentation'

export class RewriteValidationError extends Error {
  constructor(message: string, public code = 'VALIDATION_FAILED') { super(message); this.name = 'RewriteValidationError' }
}

type ValidationInput = { rewrites: RewriteSuggestion[]; facts: Fact[]; requirements: JobRequirement[] }
const pending = new Map<string, Promise<RewriteValidation[]>>()

export function rewriteValidationSnapshot(input: ValidationInput): string {
  return JSON.stringify({ version: 'rewrite-validation-v1', rewrites: input.rewrites.map((item) => ({ rewriteId: item.rewriteId, rewriteVersion: item.version || 'v1', text: effectiveText(item), usedFactIds: item.usedFactIds, experienceId: item.experienceId })), facts: input.facts.map((fact) => ({ factId: fact.factId, experienceId: fact.experienceId, content: fact.content, sourceText: fact.sourceText, status: fact.status, requiresConfirmation: fact.requiresConfirmation, conflictNote: fact.conflictNote })), requirements: input.requirements.map((requirement) => ({ requirementId: requirement.requirementId, normalizedRequirement: requirement.normalizedRequirement })) })
}

export function validateRewriteSuggestions(input: ValidationInput): Promise<RewriteValidation[]> {
  const key = rewriteValidationSnapshot(input)
  const existing = pending.get(key)
  if (existing) return existing
  const request = requestValidation(input).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

export function effectiveText(item: RewriteSuggestion): string { return item.editedText?.trim() || item.optimizedText }

async function requestValidation(input: ValidationInput): Promise<RewriteValidation[]> {
  let response: Response
  try { response = await fetch('/api/rewrite-validation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) } catch { throw new RewriteValidationError('无法连接事实校验服务，请确认本地服务已启动。', 'NETWORK_ERROR') }
  const text = await response.text(); let payload: unknown
  try { payload = text ? JSON.parse(text) : null } catch { throw new RewriteValidationError('事实校验服务返回了非 JSON 响应。', 'API_RESPONSE_INVALID') }
  if (!response.ok) { const error = payload as { message?: string; code?: string }; throw new RewriteValidationError(humanizeTechnicalError(error?.message || '事实校验失败，请重试。'), error?.code || 'VALIDATION_FAILED') }
  if (!payload || typeof payload !== 'object' || !('validations' in payload) || !Array.isArray(payload.validations)) throw new RewriteValidationError('事实校验响应缺少结果。', 'INVALID_RESPONSE')
  return payload.validations as RewriteValidation[]
}
