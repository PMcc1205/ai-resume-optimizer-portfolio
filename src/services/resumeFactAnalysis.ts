import type { Fact } from '../types/domain'

export class ResumeFactAnalysisError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'FACT_ANALYSIS_FAILED', status = 500) {
    super(message)
    this.name = 'ResumeFactAnalysisError'
    this.code = code
    this.status = status
  }
}

export async function analyzeResumeFacts(resumeText: string): Promise<Fact[]> {
  let response: Response
  try {
    response = await fetch('/api/resume-facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText }),
    })
  } catch {
    throw new ResumeFactAnalysisError('无法连接简历事实提取服务，请确认本地服务已启动。', 'NETWORK_ERROR', 0)
  }

  const payload = await readJson(response)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === 'string' ? payload.message : '简历事实提取失败，请稍后重试。'
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'FACT_ANALYSIS_FAILED'
    throw new ResumeFactAnalysisError(message, code, response.status)
  }
  if (!isRecord(payload) || !Array.isArray(payload.facts) || !payload.facts.every(isFact)) {
    throw new ResumeFactAnalysisError('简历事实提取结果字段或枚举值不完整。', 'INVALID_RESPONSE', response.status)
  }
  if (payload.facts.length === 0) {
    throw new ResumeFactAnalysisError('简历中未识别到可用事实，请补充更完整的经历信息。', 'RESUME_INSUFFICIENT', 422)
  }
  return payload.facts
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json() } catch { throw new ResumeFactAnalysisError('事实提取服务返回的 JSON 无法解析。', 'INVALID_RESPONSE', response.status) }
}

function isFact(value: unknown): value is Fact {
  if (!isRecord(value)) return false
  const requiredStrings = ['factId', 'experienceId', 'experienceName', 'content', 'type', 'sourceText', 'sourceLocation', 'riskLevel', 'riskReason', 'status']
  if (requiredStrings.some((field) => typeof value[field] !== 'string' || !(value[field] as string).trim())) return false
  if (!['背景事实', '职责事实', '行动事实', '技术事实', '数字事实', '结果事实', '项目状态事实'].includes(value.type as string)) return false
  if (!['低', '中', '高'].includes(value.riskLevel as string)) return false
  if (!['已确认', '待确认', '信息不足'].includes(value.status as string)) return false
  if (value.reviewReason !== null && typeof value.reviewReason !== 'string') return false
  if (typeof value.requiresConfirmation !== 'boolean') return false
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) return false
  if (value.projectStatus !== undefined && !['方案设计', '原型', '演示版本', '最小可行产品', '内部测试', '正式上线'].includes(value.projectStatus as string)) return false
  if (value.numericDetail !== undefined) {
    if (!isRecord(value.numericDetail)) return false
    const numericDetail = value.numericDetail
    if (['value', 'unit', 'metric'].some((field) => typeof numericDetail[field] !== 'string' || !(numericDetail[field] as string).trim())) return false
  }
  if (value.conflictNote !== undefined && typeof value.conflictNote !== 'string') return false
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
