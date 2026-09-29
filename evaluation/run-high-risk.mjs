import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { loadEvaluationCases } from './lib/case-loader.mjs'
import { buildSummary, runEvaluation, writeEvaluationResults } from './lib/runner-core.mjs'
import { readRewriteValidationConfig } from '../server/rewriteValidation.js'

const projectRootUrl = new URL('../', import.meta.url)
const projectRoot = fileURLToPath(projectRootUrl)
const casesUrl = new URL('./cases/high-risk-v1.jsonl', import.meta.url)
const schemaUrl = new URL('./schema/test-case.schema.json', import.meta.url)
const resultsUrl = new URL('./results/high-risk-v1-results.json', import.meta.url)
const summaryUrl = new URL('./results/high-risk-v1-summary.json', import.meta.url)

const { cases } = loadEvaluationCases({ casesPath: casesUrl, schemaPath: schemaUrl })
const env = { ...loadEnv('development', projectRoot, ''), ...process.env }
const config = readRewriteValidationConfig(env)
if (!config.apiUrl || !config.apiKey || !config.model) throw new Error('真实 AI 尚未配置，无法运行高风险 Evaluation。')

const evaluation = await runEvaluation(cases, {
  config,
  onCaseStart(testCase, index, total) {
    process.stdout.write(`[${index + 1}/${total}] ${testCase.testCaseId} ${testCase.title}\n`)
  },
  onCaseComplete(result) {
    if (result.error) process.stdout.write(`ERROR ${result.error.code}: ${result.error.message}\n\n`)
    else if (result.passed) process.stdout.write('PASS\n\n')
    else process.stdout.write(`FAIL\n${result.failedChecks.map((check) => `- ${check}`).join('\n')}\n\n`)
  },
})

// Rebuild from the persisted case records to ensure the summary has no model/config secrets.
evaluation.summary = buildSummary(evaluation.results)
writeEvaluationResults(evaluation, { resultsPath: fileURLToPath(resultsUrl), summaryPath: fileURLToPath(summaryUrl) })

const summary = evaluation.summary
process.stdout.write(`总案例：${summary.totalCases}\n通过：${summary.passedCases}\n失败：${summary.failedCases}\n执行错误：${summary.executionErrors}\n`)
process.stdout.write(`结果：${fileURLToPath(resultsUrl)}\n汇总：${fileURLToPath(summaryUrl)}\n`)
