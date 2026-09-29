import { readFileSync } from 'node:fs'

export function loadEvaluationCases({ casesPath, schemaPath }) {
  const schema = parseJsonFile(schemaPath, 'Schema')
  const source = readFileSync(casesPath, 'utf8')
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  const cases = lines.map((line, index) => {
    let value
    try { value = JSON.parse(line) } catch (error) { throw new Error(`第 ${index + 1} 行不是合法 JSON：${error.message}`) }
    try { validateSchema(value, schema) } catch (error) { throw new Error(`第 ${index + 1} 行 ${value.testCaseId ?? '<无 ID>'} Schema 校验失败：${error.message}`) }
    validateCaseGold(value, index)
    return value
  })
  if (!cases.length) throw new Error('Evaluation JSONL 不能为空。')
  if (new Set(cases.map((item) => item.testCaseId)).size !== cases.length) throw new Error('testCaseId 必须唯一。')
  return { cases, schema }
}

export function validateSchema(value, rule, rootRule = rule, path = '$') {
  if (rule.$ref) return validateSchema(value, resolveRef(rootRule, rule.$ref), rootRule, path)
  if (rule.anyOf) {
    const accepted = rule.anyOf.some((variant) => {
      try { validateSchema(value, variant, rootRule, path); return true } catch { return false }
    })
    if (!accepted) throw new Error(`${path} 未满足 anyOf 中的任何一种结构`)
  }
  const allowedTypes = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : []
  if (allowedTypes.length && !allowedTypes.some((type) => matchesType(value, type))) throw new Error(`${path} 类型错误，期望 ${allowedTypes.join(' / ')}`)
  if (rule.enum && !rule.enum.some((entry) => Object.is(entry, value))) throw new Error(`${path} 不在允许枚举中`)
  if (typeof value === 'string' && rule.minLength != null && value.length < rule.minLength) throw new Error(`${path} 不能为空`)
  if (Array.isArray(value)) {
    if (rule.minItems != null && value.length < rule.minItems) throw new Error(`${path} 数量不足`)
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) throw new Error(`${path} 包含重复项`)
    if (rule.items) value.forEach((item, index) => validateSchema(item, rule.items, rootRule, `${path}[${index}]`))
  }
  if (isObject(value)) {
    if (rule.minProperties != null && Object.keys(value).length < rule.minProperties) throw new Error(`${path} 字段数量不足`)
    for (const required of rule.required ?? []) if (!(required in value)) throw new Error(`${path}.${required} 为必填字段`)
    for (const [key, child] of Object.entries(value)) {
      if (rule.properties?.[key]) validateSchema(child, rule.properties[key], rootRule, `${path}.${key}`)
      else if (rule.additionalProperties === false) throw new Error(`${path}.${key} 是未定义字段`)
    }
  }
}

export function validateCaseGold(testCase, index = 0) {
  if (!isObject(testCase.expected) || Object.keys(testCase.expected).length <= 1) throw new Error(`第 ${index + 1} 行 expected 不能为空。`)
  if (!Array.isArray(testCase.expected.acceptanceCriteria) || !testCase.expected.acceptanceCriteria.length) throw new Error(`第 ${index + 1} 行必须包含 acceptanceCriteria。`)
  const factIds = testCase.confirmedFacts.map((fact) => fact.factId)
  if (new Set(factIds).size !== factIds.length) throw new Error(`${testCase.testCaseId} 的 factId 必须唯一。`)
  for (const fact of testCase.confirmedFacts) {
    const userConfirmation = fact.experienceId === 'user-confirmation' || fact.status === '明确不存在'
    if (!userConfirmation && !testCase.resumeText.includes(fact.sourceText)) throw new Error(`${testCase.testCaseId} 的 ${fact.factId} sourceText 无法追溯到 resumeText。`)
  }
  for (const factId of testCase.candidateUsedFactIds ?? []) if (!factIds.includes(factId)) throw new Error(`${testCase.testCaseId} candidateUsedFactIds 引用了不存在的 ${factId}。`)
  for (const key of ['requiredFactIds', 'forbiddenFactIds']) for (const factId of testCase.expected[key] ?? []) if (!factIds.includes(factId)) throw new Error(`${testCase.testCaseId} expected.${key} 引用了不存在的 ${factId}。`)
}

function parseJsonFile(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { throw new Error(`${label} 不是合法 JSON：${error.message}`) }
}
function resolveRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`只支持本地 JSON Pointer：${ref}`)
  return ref.slice(2).split('/').reduce((value, key) => value[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema)
}
function matchesType(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return isObject(value)
  if (type === 'integer') return Number.isInteger(value)
  return typeof value === type
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
