import type { EvidenceMapping, Fact, Gap, JobRequirement, ResumeDiagnosis, RewriteSuggestion } from '../types/domain'
import { humanizeTechnicalError } from './validationPresentation'

export type RewriteInput = {
  diagnoses: ResumeDiagnosis[]
  requirements: JobRequirement[]
  mappings: EvidenceMapping[]
  gaps: Gap[]
  facts: Fact[]
  selectedDiagnosisIds: string[]
  regenerateDiagnosisId?: string
  previousOptimizedText?: string
  existingRewrites?: RewriteSuggestion[]
}

export class RewriteError extends Error {
  constructor(message: string, public code = 'REWRITE_FAILED') {
    super(message)
    this.name = 'RewriteError'
  }
}

export function rewriteSnapshot(input: RewriteInput): string {
  const { regenerateDiagnosisId: _regenerate, previousOptimizedText: _previous, existingRewrites: _existing, ...stable } = input
  return JSON.stringify({ version: 'rewrite-v8-deterministic-project-plan', ...stable })
}

const pending = new Map<string, Promise<RewriteSuggestion[]>>()

export function generateRewriteSuggestions(input: RewriteInput): Promise<RewriteSuggestion[]> {
  const key = JSON.stringify(input)
  const existing = pending.get(key)
  if (existing) return existing
  const request = requestRewrites(input).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

async function requestRewrites(input: RewriteInput): Promise<RewriteSuggestion[]> {
  let response: Response
  try {
    response = await fetch('/api/rewrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  } catch {
    throw new RewriteError('无法连接真实 Rewrite 服务，请确认本地服务已启动。', 'NETWORK_ERROR')
  }
  const text = await response.text()
  let payload: unknown
  try { payload = text ? JSON.parse(text) : null }
  catch { throw new RewriteError('Rewrite 接口返回了非 JSON 响应，请重启本地开发服务后重试。', 'API_RESPONSE_INVALID') }
  if (!response.ok) {
    const error = payload as { message?: string; code?: string }
    const structuralCodes = new Set(['REWRITE_COUNT_EXCEEDS_PLAN', 'DUPLICATE_RESUME_ITEM', 'UNKNOWN_DIAGNOSIS', 'UNKNOWN_RESUME_ITEM', 'MISSING_PLAN_ITEM'])
    if (error?.code && structuralCodes.has(error.code)) {
      throw new RewriteError('AI 优化结果结构异常，请重新生成。', error.code)
    }
    throw new RewriteError(humanizeTechnicalError(error?.message || 'Rewrite 生成失败。'), error?.code)
  }
  if (!payload || typeof payload !== 'object' || !('rewrites' in payload) || !Array.isArray(payload.rewrites)) {
    throw new RewriteError('Rewrite 响应缺少 rewrites 数组。', 'INVALID_RESPONSE')
  }
  return payload.rewrites as RewriteSuggestion[]
}
