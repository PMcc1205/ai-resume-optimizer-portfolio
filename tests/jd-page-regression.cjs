const { chromium } = require('playwright')

const baseUrl = process.env.JD_PAGE_BASE_URL || 'http://127.0.0.1:5173'
const storage = {
  'resume-task-input-state': {
    jobTitle: 'AI 产品经理',
    companyName: '匿名测试公司',
    jobDescription: '岗位职责：负责 AI 产品方向定义与方案设计；推动产品从概念到上线。任职要求：熟悉大语言模型能力边界，有 AI 产品项目经验者优先。',
    resumeText: '页面回归测试不解析简历。',
  },
  'resume-requirements-state': [
    requirement('req-001', '负责 AI 产品方向定义与方案设计', 'AI 产品方向定义与方案设计', '岗位职责', '核心要求', 'L4 设计 / 主导'),
    requirement('req-002', '熟悉大语言模型能力边界', '熟悉大语言模型能力边界', 'AI 技术能力', '一般要求', 'L2 熟悉'),
    requirement('req-003', '有 AI 产品项目经验者优先', '具备 AI 产品项目经验', '加分项', '加分项', 'L3 实践'),
  ],
}

function requirement(requirementId, sourceText, normalizedRequirement, category, importance, requiredLevel) {
  return {
    requirementId,
    parentRequirementId: null,
    capabilityGroupId: requirementId.replace('req-', 'cap-'),
    sourceText,
    sourceSection: category === '岗位职责' ? '岗位职责' : '任职要求',
    normalizedRequirement,
    category,
    importance,
    capability: normalizedRequirement,
    keywords: [],
    explicitRequirement: true,
    evaluationType: '实践深度',
    requiredLevel,
    confidence: 0.9,
    status: '待确认',
  }
}

function check(value, message) {
  if (!value) throw new Error(message)
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript((entries) => {
      if (sessionStorage.getItem('jd-page-regression-initialized')) return
      for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, JSON.stringify(value))
      sessionStorage.setItem('jd-page-regression-initialized', 'true')
    }, storage)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

    await page.goto(`${baseUrl}/task/demo-ai-pm-001/job-analysis`)
    await page.getByRole('heading', { name: '岗位描述解析' }).waitFor()

    const first = page.locator('[data-requirement-id="req-001"]')
    await first.getByRole('button', { name: '查看原文' }).click()
    await first.getByText(storage['resume-requirements-state'][0].sourceText, { exact: true }).waitFor()

    await first.getByRole('button', { name: '编辑' }).click()
    const edited = '定义 AI 产品方向并完成方案设计'
    await page.locator('#edit-requirement-text').fill(edited)
    await page.getByRole('button', { name: '保存修改' }).click()
    await first.getByText(edited, { exact: true }).waitFor()

    const second = page.locator('[data-requirement-id="req-002"]')
    await second.getByRole('combobox').selectOption('核心要求')
    const third = page.locator('[data-requirement-id="req-003"]')
    await third.getByRole('button', { name: '删除' }).click()
    await page.getByRole('heading', { name: '确认删除岗位要求' }).waitFor()
    await page.getByRole('button', { name: '确认删除' }).click()
    check(await third.count() === 0, '删除 Requirement 未生效')

    await page.reload()
    await page.getByText(edited, { exact: true }).waitFor()
    check(await page.locator('[data-requirement-id="req-002"] select').inputValue() === '核心要求', '重要程度刷新后未恢复')
    check(await page.locator('[data-requirement-id="req-003"]').count() === 0, '删除结果刷新后未恢复')

    await page.getByRole('button', { name: '查看原始 JD' }).click()
    await page.getByRole('heading', { name: '原始岗位描述' }).waitFor()
    await page.getByRole('button', { name: '完成查看' }).click()
    await page.getByRole('button', { name: /确认岗位要求并继续/ }).click()
    await page.waitForURL('**/fact-confirmation')
    check(errors.length === 0, `页面出现运行错误：${errors.join(' | ')}`)

    process.stdout.write(`${JSON.stringify({ ok: true, checks: ['修改', '删除', '调整重要程度', '查看原文', '确认继续', '刷新恢复'] })}\n`)
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error.stack || error)
  process.exitCode = 1
})
