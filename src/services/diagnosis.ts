import type { EvidenceMapping, Fact, Gap, JobRequirement, ResumeDiagnosis } from '../types/domain'

export type DiagnosisInput = {
  requirements: JobRequirement[]
  facts: Fact[]
  mappings: EvidenceMapping[]
  gaps: Gap[]
  skippedIds: string[]
  resumeText: string
}

export class DiagnosisError extends Error {
  constructor(message: string, public code = 'DIAGNOSIS_FAILED') {
    super(message)
    this.name = 'DiagnosisError'
  }
}

export function diagnosisSnapshot(input: DiagnosisInput): string {
  return JSON.stringify({ version: 'diagnosis-v2-text-consistency', ...input })
}

const pendingRequests = new Map<string, Promise<ResumeDiagnosis[]>>()

export function analyzeDiagnoses(input: DiagnosisInput): Promise<ResumeDiagnosis[]> {
  const key = diagnosisSnapshot(input)
  const pending = pendingRequests.get(key)
  if (pending) return pending
  const request = requestDiagnoses(input).finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, request)
  return request
}

async function requestDiagnoses(input: DiagnosisInput): Promise<ResumeDiagnosis[]> {
  let response: Response
  try {
    response = await fetch('/api/diagnosis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    })
  } catch {
    throw new DiagnosisError('无法连接真实 Diagnosis 服务，请确认本地服务已启动。', 'NETWORK_ERROR')
  }
  const contentType = response.headers.get('content-type') ?? ''
  const responseText = await response.text()
  let payload: unknown
  try { payload = responseText ? JSON.parse(responseText) : null }
  catch { throw new DiagnosisError('Diagnosis 接口返回了非 JSON 响应，请重启本地开发服务后重试。', 'API_RESPONSE_INVALID') }
  if (!responseText || !contentType.includes('application/json')) {
    throw new DiagnosisError(response.status === 404 ? 'Diagnosis 接口尚未加载，请重启本地开发服务后重试。' : 'Diagnosis 服务返回了空响应。', response.status === 404 ? 'API_NOT_AVAILABLE' : 'EMPTY_RESPONSE')
  }
  if (!response.ok) {
    const error = payload as { message?: string; code?: string }
    throw new DiagnosisError(error?.message || 'Diagnosis 生成失败。', error?.code)
  }
  if (!payload || typeof payload !== 'object' || !('diagnoses' in payload) || !Array.isArray(payload.diagnoses)) {
    throw new DiagnosisError('Diagnosis 响应缺少 diagnoses 数组。', 'INVALID_RESPONSE')
  }
  return payload.diagnoses as ResumeDiagnosis[]
}
