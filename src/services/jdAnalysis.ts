import { REQUIREMENT_CATEGORY, REQUIREMENT_IMPORTANCE, REQUIREMENT_LEVEL } from '../constants/status'
import type { JobRequirement } from '../types/domain'

export type JdAnalysisInput = {
  jobTitle: string
  companyName: string
  jobDescription: string
}

export class JdAnalysisError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'JD_ANALYSIS_FAILED', status = 500) {
    super(message)
    this.name = 'JdAnalysisError'
    this.code = code
    this.status = status
  }
}

export async function analyzeJobDescription(input: JdAnalysisInput): Promise<JobRequirement[]> {
  let response: Response
  try {
    response = await fetch('/api/jd-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new JdAnalysisError('无法连接岗位解析服务，请确认本地服务已启动。', 'NETWORK_ERROR', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === 'string'
      ? payload.message
      : '岗位解析失败，请稍后重试。'
    const code = isRecord(payload) && typeof payload.code === 'string'
      ? payload.code
      : 'JD_ANALYSIS_FAILED'
    throw new JdAnalysisError(message, code, response.status)
  }

  if (!isRecord(payload) || !Array.isArray(payload.requirements)) {
    throw new JdAnalysisError('岗位解析服务返回格式错误。', 'INVALID_RESPONSE', response.status)
  }
  if (payload.requirements.length === 0) {
    throw new JdAnalysisError('岗位描述信息不足，未识别到有效岗位要求。', 'JD_INSUFFICIENT', 422)
  }

  const requirements = payload.requirements.filter(isJobRequirement)
  if (requirements.length !== payload.requirements.length) {
    throw new JdAnalysisError('岗位解析结果字段或枚举值不完整。', 'INVALID_RESPONSE', response.status)
  }
  const normalized = new Set(requirements.map((item) => item.normalizedRequirement.trim().toLowerCase()))
  if (normalized.size !== requirements.length) {
    throw new JdAnalysisError('岗位解析结果包含重复要求，请重试。', 'DUPLICATE_REQUIREMENT', 502)
  }
  return requirements
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new JdAnalysisError('岗位解析服务返回的 JSON 无法解析。', 'INVALID_RESPONSE', response.status)
  }
}

function isJobRequirement(value: unknown): value is JobRequirement {
  if (!isRecord(value)) return false
  const stringFields = [
    'requirementId',
    'capabilityGroupId',
    'sourceText',
    'sourceSection',
    'normalizedRequirement',
    'category',
    'importance',
    'capability',
    'evaluationType',
    'requiredLevel',
    'status',
  ]
  if (stringFields.some((field) => typeof value[field] !== 'string' || !(value[field] as string).trim())) return false
  if (value.parentRequirementId !== null && typeof value.parentRequirementId !== 'string') return false
  if (!Array.isArray(value.keywords) || value.keywords.some((keyword) => typeof keyword !== 'string')) return false
  if (typeof value.explicitRequirement !== 'boolean') return false
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) return false
  if (!Object.values(REQUIREMENT_CATEGORY).includes(value.category as typeof REQUIREMENT_CATEGORY[keyof typeof REQUIREMENT_CATEGORY])) return false
  if (!Object.values(REQUIREMENT_IMPORTANCE).includes(value.importance as typeof REQUIREMENT_IMPORTANCE[keyof typeof REQUIREMENT_IMPORTANCE])) return false
  if (!Object.values(REQUIREMENT_LEVEL).includes(value.requiredLevel as JobRequirement['requiredLevel'])) return false
  return value.status === '待确认'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
