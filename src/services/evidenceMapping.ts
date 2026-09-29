import type { EvidenceMapping, Fact, JobRequirement } from '../types/domain'

const RELEVANCE = ['高相关', '中相关', '低相关', '无相关']
const EVIDENCE_STRENGTH = ['强证据', '中等证据', '弱证据', '无有效证据']
const EVIDENCE_LEVEL = ['L1 了解', 'L2 熟悉', 'L3 实践', 'L4 设计 / 主导']

export class EvidenceMappingError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'EVIDENCE_MAPPING_FAILED', status = 500) {
    super(message)
    this.name = 'EvidenceMappingError'
    this.code = code
    this.status = status
  }
}

export async function analyzeEvidenceMappings(requirements: JobRequirement[], facts: Fact[]): Promise<EvidenceMapping[]> {
  let response: Response
  try {
    response = await fetch('/api/evidence-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirements, facts }),
    })
  } catch {
    throw new EvidenceMappingError('无法连接 Evidence Mapping 服务，请确认本地服务已启动。', 'NETWORK_ERROR', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'Evidence Mapping 生成失败，请稍后重试。'
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'EVIDENCE_MAPPING_FAILED'
    throw new EvidenceMappingError(message, code, response.status)
  }
  if (!isRecord(payload) || !Array.isArray(payload.mappings) || !payload.mappings.every(isEvidenceMapping)) {
    throw new EvidenceMappingError('Evidence Mapping 返回字段或枚举值不完整。', 'INVALID_RESPONSE', response.status)
  }
  if (payload.mappings.length !== requirements.length) {
    throw new EvidenceMappingError('Evidence Mapping 未覆盖全部岗位要求。', 'INCOMPLETE_MAPPING_RESULT', response.status)
  }
  return payload.mappings
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() } catch { throw new EvidenceMappingError('Evidence Mapping 服务返回的 JSON 无法解析。', 'INVALID_RESPONSE', response.status) }
}

function isEvidenceMapping(value: unknown): value is EvidenceMapping {
  if (!isRecord(value)) return false
  if (['mappingId', 'requirementId', 'evidenceLevel', 'matchStatus', 'reason'].some((field) => typeof value[field] !== 'string' || !(value[field] as string).trim())) return false
  if (!Array.isArray(value.factIds) || value.factIds.some((factId) => typeof factId !== 'string' || !factId.trim())) return false
  if (!RELEVANCE.includes(value.relevance as string)) return false
  if (!EVIDENCE_STRENGTH.includes(value.evidenceStrength as string)) return false
  if (!EVIDENCE_LEVEL.includes(value.evidenceLevel as string)) return false
  if (value.matchStatus !== '待确认') return false
  return typeof value.confidence === 'number' && value.confidence >= 0 && value.confidence <= 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
