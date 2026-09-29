import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateSchema } from '../lib/case-loader.mjs'

const casesPath = fileURLToPath(new URL('../cases/v2.1-development.jsonl', import.meta.url))
const schemaPath = fileURLToPath(new URL('../schema/development-case-v2.1.schema.json', import.meta.url))
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const lines = readFileSync(casesPath, 'utf8').split(/\r?\n/).filter((line) => line.trim())
const cases = lines.map((line, index) => {
  let value
  try { value = JSON.parse(line) } catch (error) { throw new Error(`第 ${index + 1} 行不是合法 JSON：${error.message}`) }
  try { validateSchema(value, schema) } catch (error) { throw new Error(`${value.caseId ?? `第 ${index + 1} 行`} Schema 校验失败：${error.message}`) }
  return value
})

const expectedCounts = { 'normal-clean': 14, 'single-risk': 18, 'multi-risk': 8, boundary: 16, adversarial: 9 }
if (cases.length !== 65) throw new Error(`Development Case 应为 65 条，实际 ${cases.length} 条。`)
if (new Set(cases.map((item) => item.caseId)).size !== cases.length) throw new Error('caseId 必须唯一。')
if (new Set(cases.map((item) => item.candidateText)).size !== cases.length) throw new Error('candidateText 不应重复。')

const categoryCounts = Object.fromEntries(Object.keys(expectedCounts).map((key) => [key, cases.filter((item) => item.category === key).length]))
for (const [category, expected] of Object.entries(expectedCounts)) if (categoryCounts[category] !== expected) throw new Error(`${category} 应为 ${expected} 条，实际 ${categoryCounts[category]} 条。`)

for (const testCase of cases) {
  if (testCase.sourceType !== 'synthetic-evaluation') throw new Error(`${testCase.caseId} sourceType 必须为 synthetic-evaluation。`)
  if (testCase.expectedValidation === 'pass' && testCase.expectedViolations.length) throw new Error(`${testCase.caseId} PASS Gold 不应包含 violation。`)
  if (testCase.expectedValidation === 'fail' && !testCase.expectedViolations.length) throw new Error(`${testCase.caseId} FAIL Gold 必须包含 violation。`)
  if (testCase.expectedValidation === 'not_run' && !testCase.expectedViolations.includes('rewrite_not_allowed')) throw new Error(`${testCase.caseId} not_run 必须标记 rewrite_not_allowed。`)
  const factIds = testCase.sourceFacts.map((fact) => fact.factId)
  if (new Set(factIds).size !== factIds.length) throw new Error(`${testCase.caseId} factId 不可重复。`)
}

const boundaryCases = cases.filter((item) => item.category === 'boundary')
const pairIds = [...new Set(boundaryCases.map((item) => item.boundaryPairId))]
if (pairIds.length !== 8 || boundaryCases.some((item) => !item.boundaryPairId || !item.boundarySide)) throw new Error('Boundary 必须包含 8 组完整 Pair。')
for (const pairId of pairIds) {
  const pair = boundaryCases.filter((item) => item.boundaryPairId === pairId)
  if (pair.length !== 2 || !pair.some((item) => item.boundarySide === 'pass') || !pair.some((item) => item.boundarySide === 'fail')) throw new Error(`${pairId} 必须包含一条 PASS 和一条 FAIL。`)
  if (new Set(pair.map((item) => JSON.stringify(item.sourceFacts))).size !== 1) throw new Error(`${pairId} 的 PASS / FAIL 必须使用相同 sourceFacts。`)
  if (pair.some((item) => item.expectedValidation !== item.boundarySide)) throw new Error(`${pairId} 的 boundarySide 必须与 expectedValidation 一致。`)
}

const majorViolations = ['unsupported_claim', 'unsupported_number', 'unsupported_result', 'unsupported_technology', 'unsupported_experiment', 'numeric_value_changed', 'numeric_metric_changed', 'project_status_upgrade', 'responsibility_upgrade', 'responsibility_scope_expanded', 'capability_overstatement', 'cross_project_fact', 'rewrite_not_allowed']
const violationCounts = Object.fromEntries(majorViolations.map((label) => [label, cases.filter((item) => item.expectedViolations.includes(label)).length]))
for (const [label, count] of Object.entries(violationCounts)) if (!count) throw new Error(`${label} 尚未覆盖。`)

const validationCounts = {
  pass: cases.filter((item) => item.expectedValidation === 'pass').length,
  fail: cases.filter((item) => item.expectedValidation === 'fail').length,
  not_run: cases.filter((item) => item.expectedValidation === 'not_run').length,
}

process.stdout.write(`${JSON.stringify({ ok: true, totalCases: cases.length, categoryCounts, validationCounts, violationCounts, boundaryPairs: pairIds }, null, 2)}\n`)
