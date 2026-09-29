import assert from 'node:assert/strict'
import {
  parseFactModelJson,
  validateFactsPayload,
  validateResumeFactInput,
} from '../server/resumeFactAnalysis.js'

const resumeText = `林同学
教育背景：东湖大学，信息管理与信息系统，本科，2022.09-2026.06。
智能知识助手｜课程项目
参与用户访谈及需求整理，负责 RAG 知识库问答方案和测试，使用 Python 与 MySQL 完成数据处理。
构建 20 组测试样本进行效果验证，当前完成可运行 Demo，尚未正式上线。
产品实习生｜云帆科技
主导用户行为看板需求分析，覆盖 120 名内部测试用户，转化率提升 8%。
参与相关工作，优化系统效果。`

let checks = 0
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks += 1 }
function check(value, message) { assert.ok(value, message); checks += 1 }
function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `预期错误码 ${code}`)
  checks += 1
}

function fact(overrides = {}) {
  return {
    factId: 'temporary',
    experienceId: 'temporary-exp',
    experienceName: '智能知识助手',
    content: '参与用户访谈及需求整理',
    type: '行动事实',
    sourceText: '参与用户访谈及需求整理',
    sourceLocation: '智能知识助手第 1 条',
    riskLevel: '普通风险',
    riskReason: '原文明确且不包含高风险结果',
    reviewReason: null,
    requiresConfirmation: false,
    confidence: 0.95,
    status: '已确认',
    ...overrides,
  }
}

equal(validateResumeFactInput({ resumeText: ` ${resumeText} ` }).resumeText, resumeText, '完整简历文本应通过输入校验')
expectCode(() => validateResumeFactInput({ resumeText: '姓名：林同学' }), 'RESUME_INSUFFICIENT')

const payload = { facts: [
  fact({ type: '背景事实', sourceText: '东湖大学，信息管理与信息系统，本科，2022.09-2026.06', content: '就读于东湖大学信息管理与信息系统本科', sourceLocation: '教育背景', experienceName: '教育背景' }),
  fact({ type: '职责事实', content: '参与用户访谈及需求整理', riskLevel: '普通风险' }),
  fact({ type: '职责事实', sourceText: '负责 RAG 知识库问答方案和测试', content: '负责 RAG 知识库问答方案和测试', riskLevel: '中风险', riskReason: '包含明确负责职责' }),
  fact({ type: '职责事实', sourceText: '主导用户行为看板需求分析', content: '主导用户行为看板需求分析', experienceName: '产品实习生', sourceLocation: '产品实习生第 1 条', riskLevel: '中风险', riskReason: '包含主导职责' }),
  fact({ type: '技术事实', sourceText: '使用 Python 与 MySQL 完成数据处理', content: '使用 Python 与 MySQL 完成数据处理', riskLevel: '低风险' }),
  fact({ type: '数字事实', sourceText: '构建 20 组测试样本进行效果验证', content: '构建 20 组测试样本', riskLevel: '普通风险', numericDetail: { value: '20', unit: '组', metric: '测试样本' } }),
  fact({ type: '结果事实', sourceText: '转化率提升 8%', content: '转化率提升 8%', experienceName: '产品实习生', sourceLocation: '产品实习生第 2 条', riskLevel: '普通风险', numericDetail: { value: '8%', unit: '%', metric: '转化率提升' } }),
  fact({ type: '项目状态事实', sourceText: '当前完成可运行 Demo', content: '智能知识助手当前完成可运行 Demo', riskLevel: '普通风险', projectStatus: 'Demo' }),
  fact({ type: '行动事实', sourceText: '参与相关工作，优化系统效果', content: '参与相关工作，具体行动与效果不明确', riskLevel: '中风险', riskReason: '原文无法说明具体行动或结果', reviewReason: '信息不足', requiresConfirmation: true, confidence: 0.55, status: '信息不足' }),
] }

const result = validateFactsPayload(payload, resumeText)
equal(result.length, 9, '正常项目经历应生成完整 Fact 集合')
equal(result[0].factId, 'fact-001', '服务端应生成稳定 Fact ID')
equal(result[1].experienceId, result[2].experienceId, '同一所属经历应复用 Experience ID')
equal(result[1].riskLevel, '中', '参与职责至少应按中风险处理')
equal(result[1].status, '待确认', '参与职责不能自动确认为低风险事实')
equal(result[2].riskLevel, '中', '负责职责应保持中风险')
equal(result[2].status, '待确认', '负责职责必须显式确认')
equal(result[3].riskLevel, '高', '主导职责必须升级为高风险')
equal(result[3].status, '待确认', '主导职责必须显式确认')
equal(result[4].type, '技术事实', '技术事实类型应保留')
equal(result[4].status, '已确认', '原文明确的低风险高置信度技术事实可自动进入已识别事实')
equal(result[5].numericDetail.value, '20', '数字事实必须保留原始数值')
equal(result[5].riskLevel, '低', '原文明确的普通过程数量不应自动升级为高风险')
equal(result[5].status, '已确认', '高置信度普通过程数量不应被强制确认')
equal(result[6].riskLevel, '高', '转化率结果必须为高风险')
equal(result[7].projectStatus, '演示版本', 'Demo 应安全归一化为演示版本')
equal(result[7].riskLevel, '中', '项目状态事实必须进入显式确认')
equal(result[8].status, '信息不足', '模糊描述必须保留为信息不足')
check(result.every((item) => resumeText.includes(item.sourceText)), '所有 Fact 必须能追溯到简历原文')

expectCode(() => validateFactsPayload({ facts: [fact({ content: '主导用户访谈及需求整理' })] }, resumeText), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [fact({ type: '数字事实', sourceText: '构建 20 组测试样本进行效果验证', content: '构建 30 组测试样本', numericDetail: { value: '30', unit: '组', metric: '测试样本' } })] }, resumeText), 'UNSUPPORTED_FACT')

const percentageResumeText = '基于50+条简历片段完成4轮Prompt迭代，由3人统一评测，不可用输出占比从15%降至4%。'
function percentageFact(sourceText, value = '4') {
  return fact({
    type: '数字事实',
    content: '不可用输出占比降至4%',
    sourceText,
    numericDetail: { value, unit: '%', metric: '不可用输出占比（迭代后）' },
  })
}

equal(validateFactsPayload({ facts: [percentageFact('不可用输出占比降至4%')] }, `${percentageResumeText} 不可用输出占比降至4%`)[0].numericDetail.value, '4', 'value=4 + unit=% 应匹配 4%')
equal(validateFactsPayload({ facts: [percentageFact('不可用输出占比降至4 %')] }, `${percentageResumeText} 不可用输出占比降至4 %`)[0].numericDetail.value, '4', 'value=4 + unit=% 应匹配数字与单位间的空格')
equal(validateFactsPayload({ facts: [percentageFact('不可用输出占比降至4.0%')] }, `${percentageResumeText} 不可用输出占比降至4.0%`)[0].numericDetail.value, '4', 'value=4 + unit=% 应与 4.0% 数值等价')
equal(validateFactsPayload({ facts: [percentageFact('不可用输出占比从15%降至4%')] }, percentageResumeText)[0].numericDetail.value, '4', '多个百分比中应准确匹配 4% 而非 15%')
const changedPercentage = validateFactsPayload({ facts: [fact({
  type: '结果事实',
  content: '不可用输出占比从15%降至4%',
  sourceText: '不可用输出占比从15%降至4%',
  riskLevel: '普通风险',
  numericDetail: { value: '15→4', unit: '%', metric: '不可用输出占比' },
})] }, percentageResumeText)[0]
equal(changedPercentage.numericDetail.value, '15→4', '前后变化数字应保留在同一个 numericDetail 中')
equal(changedPercentage.riskLevel, '高', '百分比结果仍必须保持高风险保护')
equal(changedPercentage.status, '待确认', '关键数字结果仍必须显式确认')
expectCode(() => validateFactsPayload({ facts: [percentageFact('完成4轮Prompt迭代')] }, percentageResumeText), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [percentageFact('由3人统一评测', '30')] }, percentageResumeText), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [fact({
  type: '数字事实',
  content: '不可用输出占比达到30%',
  sourceText: '不可用输出占比从15%降至4%',
  numericDetail: { value: '30', unit: '%', metric: '不可用输出占比' },
})] }, percentageResumeText), 'UNSUPPORTED_FACT')

const commaResumeText = `${resumeText}\n累计处理 1,000 份简历。`
equal(validateFactsPayload({ facts: [fact({ type: '数字事实', sourceText: '累计处理 1,000 份简历', content: '累计处理 1000 份简历', numericDetail: { value: '1000', unit: '份', metric: '简历处理数量' } })] }, commaResumeText)[0].numericDetail.value, '1000', '1000 应与 1,000 数值等价')

function plusFact(sourceText, content, value, unit, metric) {
  return fact({ type: '数字事实', sourceText, content, numericDetail: { value, unit, metric } })
}

equal(validateFactsPayload({ facts: [plusFact('50+条简历片段', '简历片段数量为50+条', '50+', '条', '简历片段数量')] }, '基于50+条简历片段完成迭代。')[0].numericDetail.value, '50+', '50+条应保留并匹配 + 修饰符')
equal(validateFactsPayload({ facts: [plusFact('累计服务100+名用户', '累计服务100+名用户', '100+', '名', '用户数量')] }, '项目累计服务100+名用户。')[0].numericDetail.value, '100+', '100+名应保留并匹配 + 修饰符')
expectCode(() => validateFactsPayload({ facts: [plusFact('50条简历片段', '简历片段数量为50+条', '50+', '条', '简历片段数量')] }, '基于50条简历片段完成迭代。'), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [plusFact('完成50轮测试', '简历片段数量为50+条', '50+', '条', '简历片段数量')] }, '完成50轮测试并记录结果。'), 'UNSUPPORTED_FACT')

const consolidatedActionFacts = validateFactsPayload({ facts: [
  fact({ sourceText: '基于问卷、5次深访及3款竞品分析', content: '基于问卷、5次深访及3款竞品分析开展调研' }),
  fact({ type: '数字事实', sourceText: '5次深访', content: '深访次数为5次', numericDetail: { value: '5', unit: '次', metric: '深访次数' } }),
  fact({ type: '数字事实', sourceText: '3款竞品分析', content: '竞品分析数量为3款', numericDetail: { value: '3', unit: '款', metric: '竞品分析数量' } }),
] }, '基于问卷、5次深访及3款竞品分析开展用户调研。')
equal(consolidatedActionFacts.length, 1, '行动主 Fact 应吸收同源普通数字子 Fact')
equal(consolidatedActionFacts[0].status, '已确认', '原文明确的普通数字行动只保留一次且无需确认')

const consolidatedResultFacts = validateFactsPayload({ facts: [
  fact({ type: '结果事实', sourceText: '不可用输出占比从15%降至4%', content: '不可用输出占比从15%降至4%', riskLevel: '高风险', requiresConfirmation: true, status: '待确认' }),
  fact({ type: '数字事实', sourceText: '从15%', content: '不可用输出占比初始值为15%', numericDetail: { value: '15', unit: '%', metric: '不可用输出占比（初始）' } }),
  fact({ type: '数字事实', sourceText: '降至4%', content: '不可用输出占比最终值为4%', numericDetail: { value: '4', unit: '%', metric: '不可用输出占比（最终）' } }),
] }, percentageResumeText)
equal(consolidatedResultFacts.length, 1, '前后变化结果不应拆成两个端点 Fact')
equal(consolidatedResultFacts[0].numericDetail.value, '15→4', '结果主 Fact 应保留变化前后数字')
equal(consolidatedResultFacts[0].numericDetail.metric, '不可用输出占比', '变化结果应保留统一指标')
equal(consolidatedResultFacts[0].riskLevel, '高', '合并后的关键结果仍必须保持高风险')
equal(consolidatedResultFacts[0].status, '待确认', '合并后的关键结果仍必须显式确认')

const normalizedStrategyFact = validateFactsPayload({ facts: [fact({
  type: '技术事实',
  sourceText: '将改写拆为STAR重构、关键词融入、动词强化、量化补充4类策略',
  content: '将改写拆为STAR重构、关键词融入、动词强化、量化补充4类策略',
})] }, '将改写拆为STAR重构、关键词融入、动词强化、量化补充4类策略。')[0]
equal(normalizedStrategyFact.type, '行动事实', '产品策略拆分应归为行动事实而不是技术事实')

const userScaleFact = validateFactsPayload({ facts: [plusFact('累计服务100+名用户', '累计服务100+名用户', '100+', '名', '用户数量')] }, '项目累计服务100+名用户。')[0]
equal(userScaleFact.riskLevel, '高', '用户规模数字仍必须保持高风险')
equal(userScaleFact.status, '待确认', '用户规模数字仍必须显式确认')
expectCode(() => validateFactsPayload({ facts: [fact({ type: '技术事实', content: '使用 Agent 完成用户访谈及需求整理' })] }, resumeText), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [fact({ type: '项目状态事实', sourceText: '当前完成可运行 Demo', content: '项目已正式上线', projectStatus: '正式上线' })] }, resumeText), 'UNSUPPORTED_FACT')
expectCode(() => validateFactsPayload({ facts: [fact({ sourceText: '原文中不存在的事实' })] }, resumeText), 'AI_OUTPUT_INVALID')
expectCode(() => validateFactsPayload({ facts: [fact(), fact()] }, resumeText), 'DUPLICATE_FACT')
expectCode(() => validateFactsPayload({ facts: [fact({ type: '能力事实' })] }, resumeText), 'AI_OUTPUT_INVALID')
expectCode(() => validateFactsPayload({ facts: [fact({ riskLevel: '极高风险' })] }, resumeText), 'AI_OUTPUT_INVALID')
expectCode(() => validateFactsPayload({ facts: [] }, resumeText), 'RESUME_INSUFFICIENT')
expectCode(() => parseFactModelJson('{invalid json'), 'AI_JSON_INVALID')
equal(parseFactModelJson('```json\n{"facts":[]}\n```').facts.length, 0, 'JSON 代码块应安全解析')

process.stdout.write(`${JSON.stringify({ ok: true, checks, facts: result.length })}\n`)
