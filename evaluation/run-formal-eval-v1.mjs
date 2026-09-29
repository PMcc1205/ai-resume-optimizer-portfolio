import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { runEvaluation } from './lib/runner-core.mjs'
import { adaptFrozenCase, buildFormalCaseResult, buildFormalReport, buildFormalSummary, loadFrozenEvaluationDataset } from './lib/formal-evaluation.mjs'
import { generateRewriteValidations, readRewriteValidationConfig } from '../server/rewriteValidation.js'

const evaluationId = process.env.FORMAL_EVALUATION_ID?.trim() || 'formal-eval-v1'
if (!/^formal-eval-v\d+$/.test(evaluationId)) throw new Error(`非法正式 Evaluation ID：${evaluationId}`)
const projectRootUrl = new URL('../', import.meta.url)
const projectRoot = fileURLToPath(projectRootUrl)
const manifestPath = fileURLToPath(new URL('./datasets/evaluation-dataset-v1.manifest.json', import.meta.url))
const resultsPath = fileURLToPath(new URL(`./results/${evaluationId}-results.json`, import.meta.url))
const summaryPath = fileURLToPath(new URL(`./results/${evaluationId}-summary.json`, import.meta.url))
const failuresPath = fileURLToPath(new URL(`./results/${evaluationId}-failures.json`, import.meta.url))
const reportPath = fileURLToPath(evaluationId === 'formal-eval-v1' ? new URL('../15_AI_Evaluation.md', import.meta.url) : new URL(`./results/${evaluationId}-run-report.md`, import.meta.url))

for (const path of [resultsPath, summaryPath, failuresPath, reportPath]) {
  if (existsSync(path)) throw new Error(`正式 Baseline 文件已存在，禁止覆盖：${path}`)
}

const frozen = loadFrozenEvaluationDataset({ manifestPath, projectRoot })
if (frozen.cases.length !== 61) throw new Error(`automatic-evaluation-v1 应为 61 条，实际 ${frozen.cases.length} 条。`)
process.stdout.write(`Dataset Manifest / SHA-256 校验通过：${frozen.manifest.datasetVersion}，${frozen.cases.length} 条。\n`)

const env = { ...loadEnv('development', projectRoot, ''), ...process.env }
const config = readRewriteValidationConfig(env)
if (!config.apiUrl || !config.apiKey || !config.model) throw new Error('真实 DeepSeek 尚未配置，无法运行正式 Evaluation。')
process.stdout.write(`模型配置：${config.model}，timeout=${config.timeoutMs}ms，maxRetries=${config.maxRetries}。\n`)

const sourceById = new Map(frozen.cases.map((item) => [item.caseId, item]))
const adaptedCases = frozen.cases.map(adaptFrozenCase)
const attemptsById = new Map()
const completedResults = []
const generatedAt = new Date().toISOString()
mkdirSync(dirname(resultsPath), { recursive: true })

const validationExecutor = async (modelConfig, input, diagnostics) => {
  const testCaseId = input.rewrites[0].rewriteId.replace(/^eval-/, '')
  const attempts = attemptsById.get(testCaseId) ?? []
  attemptsById.set(testCaseId, attempts)
  return generateRewriteValidations(modelConfig, input, undefined, {
    onAttempt(record) {
      attempts.push(record)
      diagnostics.onAttempt(record)
    },
  })
}

const evaluation = await runEvaluation(adaptedCases, {
  config,
  validationExecutor,
  onCaseStart(testCase, index, total) {
    process.stdout.write(`[${index + 1}/${total}] ${testCase.testCaseId} ${testCase.title}\n`)
  },
  onCaseComplete(runnerResult, index, total) {
    const sourceCase = sourceById.get(runnerResult.testCaseId)
    const formalResult = buildFormalCaseResult(sourceCase, runnerResult, attemptsById.get(runnerResult.testCaseId) ?? [])
    completedResults.push(formalResult)
    writeFileSync(resultsPath, `${JSON.stringify({ evaluationId, datasetVersion: frozen.manifest.datasetVersion, generatedAt, completed: false, completedCases: completedResults.length, totalCases: frozen.cases.length, results: completedResults }, null, 2)}\n`, 'utf8')
    process.stdout.write(`${formalResult.status}${formalResult.status === 'FAIL' ? `\n${formalResult.failedChecks.map((item) => `- ${item}`).join('\n')}` : formalResult.status === 'ERROR' ? ` ${formalResult.errorCode}` : ''}\n\n`)
    if (index + 1 === total) process.stdout.write('全部案例执行完成，正在生成汇总。\n')
  },
})

const results = evaluation.results.map((runnerResult) => buildFormalCaseResult(sourceById.get(runnerResult.testCaseId), runnerResult, attemptsById.get(runnerResult.testCaseId) ?? []))
const summary = buildFormalSummary(results, { pendingHumanReview: frozen.manifest.humanRubricDataset.caseCount })
const failures = results.filter((item) => item.status === 'FAIL')
const executionErrors = results.filter((item) => item.status === 'ERROR')
const report = buildFormalReport({ manifest: frozen.manifest, summary, generatedAt })

writeFileSync(resultsPath, `${JSON.stringify({ evaluationId, datasetVersion: frozen.manifest.datasetVersion, generatedAt, completed: true, results }, null, 2)}\n`, 'utf8')
writeFileSync(summaryPath, `${JSON.stringify({ evaluationId, datasetVersion: frozen.manifest.datasetVersion, generatedAt, ...summary }, null, 2)}\n`, 'utf8')
writeFileSync(failuresPath, `${JSON.stringify({ evaluationId, datasetVersion: frozen.manifest.datasetVersion, generatedAt, failures, executionErrors, failureAnalysis: summary.failures, executionErrorAnalysis: summary.executionErrors }, null, 2)}\n`, 'utf8')
writeFileSync(reportPath, report, 'utf8')

process.stdout.write(`Total：${summary.totalCases}\nPASS：${summary.passCases}\nFAIL：${summary.failCases}\nERROR：${summary.errorCases}\n`)
process.stdout.write(`Results：${resultsPath}\nSummary：${summaryPath}\nFailures：${failuresPath}\nReport：${reportPath}\n`)
