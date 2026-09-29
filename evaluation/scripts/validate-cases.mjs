import { fileURLToPath } from 'node:url'
import { loadEvaluationCases } from '../lib/case-loader.mjs'

const casesUrl = new URL('../cases/high-risk-v1.jsonl', import.meta.url)
const schemaUrl = new URL('../schema/test-case.schema.json', import.meta.url)
const { cases, schema } = loadEvaluationCases({ casesPath: casesUrl, schemaPath: schemaUrl })
if (cases.length !== 12) throw new Error('高风险 V1 必须恰好包含 12 个案例。')
const expectedCoverage = new Set(schema.properties.coverageKey.enum)
const actualCoverage = new Set(cases.map((item) => item.coverageKey))
if (actualCoverage.size !== 12 || [...expectedCoverage].some((key) => !actualCoverage.has(key))) throw new Error('12 个高风险 coverageKey 必须完整覆盖且不可重复。')
const forbiddenMetricKeys = new Set(['accuracy', 'passRate', 'hallucinationRate', 'recall', 'stability', '准确率', '通过率', '幻觉率', '召回率', '稳定性指标'])
inspectKeys(cases)

function inspectKeys(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectKeys(item, `${path}[${index}]`))
  if (value === null || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenMetricKeys.has(key)) throw new Error(`${path}.${key} 不得保存未经运行的 Evaluation 指标。`)
    inspectKeys(child, `${path}.${key}`)
  }
}

process.stdout.write(`${JSON.stringify({ ok: true, file: fileURLToPath(casesUrl), cases: cases.length, uniqueTestCaseIds: cases.length, coveredRisks: actualCoverage.size })}\n`)
