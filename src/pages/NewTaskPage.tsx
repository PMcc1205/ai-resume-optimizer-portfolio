import { ArrowRight, CheckCircle2, FileInput, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { TopNavigation } from '../components/layout/TopNavigation'
import { AnalysisProgressModal, ANALYSIS_STEPS } from '../components/new-task/AnalysisProgressModal'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { FileUploadPlaceholder } from '../components/ui/FileUploadPlaceholder'
import { TextInput, Textarea } from '../components/ui/FormFields'
import { DEMO_TASK_ID, ROUTES } from '../constants/routes'
import { REQUIREMENTS_STATE_KEY, TASK_INPUT_STATE_KEY, resetWorkflowState } from '../constants/storage'
import { mockResumeText } from '../mocks/resumeOptimization'
import { JdAnalysisError, analyzeJobDescription } from '../services/jdAnalysis'
import type { TaskInputState } from '../types/domain'

const MIN_JOB_DESCRIPTION_LENGTH = 80
const emptyForm: TaskInputState = { jobTitle: '', companyName: '', jobDescription: '', resumeText: '' }

export function NewTaskPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<TaskInputState>(emptyForm)
  const [resumeFile, setResumeFile] = useState<File>()
  const [touched, setTouched] = useState({ jobTitle: false, jobDescription: false, resume: false })
  const [demoDataLoaded, setDemoDataLoaded] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [analysisError, setAnalysisError] = useState('')

  const updateField = (field: keyof TaskInputState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setDemoDataLoaded(false)
    setAnalysisError('')
  }

  const fillExampleData = () => {
    setForm({
      jobTitle: 'AI 产品经理（校招）',
      companyName: '星云科技（演示公司）',
      jobDescription: '负责 AI 产品需求分析、方案设计与迭代落地；结合用户场景设计检索增强生成（RAG）产品方案；通过用户研究、实验复盘与数据分析验证产品价值；推动算法、设计和研发团队协作。本科及以上学历，理解大语言模型基本原理与能力边界，具备 AI 产品项目实践。',
      resumeText: mockResumeText,
    })
    setResumeFile(undefined)
    setTouched({ jobTitle: true, jobDescription: true, resume: true })
    setDemoDataLoaded(true)
    setAnalysisError('')
  }

  const valid = Boolean(
    form.jobTitle.trim()
    && form.jobDescription.trim().length >= MIN_JOB_DESCRIPTION_LENGTH
    && (form.resumeText.trim() || resumeFile),
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched({ jobTitle: true, jobDescription: true, resume: true })
    if (!valid || isAnalyzing) return

    resetWorkflowState()
    sessionStorage.setItem(TASK_INPUT_STATE_KEY, JSON.stringify(form))
    setAnalysisError('')
    setAnalysisStep(0)
    setIsAnalyzing(true)

    const progressTimer = window.setInterval(() => {
      setAnalysisStep((current) => Math.min(current + 1, ANALYSIS_STEPS.length - 2))
    }, 900)

    try {
      const requirements = await analyzeJobDescription({
        jobTitle: form.jobTitle.trim(),
        companyName: form.companyName.trim(),
        jobDescription: form.jobDescription.trim(),
      })
      window.clearInterval(progressTimer)
      setAnalysisStep(ANALYSIS_STEPS.length - 1)
      sessionStorage.setItem(REQUIREMENTS_STATE_KEY, JSON.stringify(requirements))
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      navigate(ROUTES.JOB_ANALYSIS(DEMO_TASK_ID))
    } catch (error) {
      const message = error instanceof JdAnalysisError ? error.message : '岗位解析失败，请稍后重试。'
      setAnalysisError(message)
    } finally {
      window.clearInterval(progressTimer)
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <TopNavigation />
      <main>
        <PageContainer className="py-7 sm:py-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="flex max-w-3xl items-start gap-4">
              <span className="mt-1 hidden h-12 w-12 items-center justify-center rounded-xl border border-brand-100 bg-brand-100 text-brand-700 sm:flex"><Sparkles className="h-6 w-6" /></span>
              <div>
                <p className="text-sm font-semibold text-brand-700">AI 简历优化助手</p>
                <h1 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[2rem]">新建简历优化任务</h1>
                <p className="mt-2 text-base leading-7 text-slate-600">基于目标岗位和真实经历，定位简历问题并完成可信的针对性优化。</p>
              </div>
            </div>
            <Button variant="secondary" onClick={fillExampleData}><WandSparkles className="h-4 w-4" />填入示例数据</Button>
          </div>

          {demoDataLoaded && <div className="inline-feedback mt-5 border-brand-200 bg-brand-50 text-brand-900"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />已填入示例数据，可以直接测试真实 JD 解析。</span></div>}
          {analysisError && <div className="mt-5"><Alert title="岗位解析未完成" tone="warning">{analysisError} 输入内容已保留，可以检查配置后重试。</Alert></div>}
          <div className="mt-5"><Alert title="真实性原则">系统只基于你的真实经历进行分析，不会自动添加不存在的职责、技能、数据或项目结果。</Alert></div>

          <form className="mt-5" onSubmit={submit}>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><div className="flex items-center gap-3"><span className="step-number">1</span><div><h2 className="section-title">目标岗位</h2><p className="section-description">提供完整 JD，帮助系统准确识别岗位要求。</p></div></div></CardHeader>
                <CardContent className="space-y-5">
                  <TextInput id="job-title" label="岗位名称" required value={form.jobTitle} error={touched.jobTitle && !form.jobTitle ? '请输入岗位名称' : undefined} onChange={(event) => updateField('jobTitle', event.target.value)} />
                  <TextInput id="company-name" label="公司名称（选填）" value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
                  <Textarea id="job-description" label="完整岗位描述（JD）" required rows={10} value={form.jobDescription} error={touched.jobDescription && form.jobDescription.trim().length < MIN_JOB_DESCRIPTION_LENGTH ? '请提供完整岗位职责和任职要求。' : undefined} onChange={(event) => updateField('jobDescription', event.target.value)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><div className="flex items-center gap-3"><span className="step-number">2</span><div><h2 className="section-title">上传基础简历</h2><p className="section-description">上传 PDF 或粘贴文本，至少完成一种。</p></div></div></CardHeader>
                <CardContent>
                  <FileUploadPlaceholder file={resumeFile} onFileSelect={setResumeFile} onClear={() => setResumeFile(undefined)} />
                  <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-sm text-slate-400">或</span><span className="h-px flex-1 bg-slate-200" /></div>
                  <Textarea id="resume-text" label="粘贴简历文本" rows={10} value={form.resumeText} onChange={(event) => updateField('resumeText', event.target.value)} />
                </CardContent>
              </Card>
            </div>
            <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-card sm:flex-row sm:items-center">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-brand-700" /><div><p className="font-semibold text-ink">准备好后开始岗位解析</p><p className="mt-1 text-sm text-slate-500">目标岗位、完整 JD 和简历内容填写完成后即可开始。</p></div></div>
              <Button type="submit" disabled={!valid || isAnalyzing}>{isAnalyzing ? <><FileInput className="h-4 w-4" />解析中</> : <>开始分析<ArrowRight className="h-4 w-4" /></>}</Button>
            </div>
          </form>
        </PageContainer>
      </main>
      <AnalysisProgressModal open={isAnalyzing} currentStep={analysisStep} />
    </div>
  )
}
