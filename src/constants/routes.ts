import type { TaskStep } from '../types/domain'

export const DEMO_TASK_ID = 'demo-ai-pm-001'

export const ROUTES = {
  HOME: '/',
  NEW_TASK: '/task/new',
  JOB_ANALYSIS: (taskId: string) => `/task/${taskId}/job-analysis`,
  FACT_CONFIRMATION: (taskId: string) => `/task/${taskId}/fact-confirmation`,
  MATCHING: (taskId: string) => `/task/${taskId}/matching`,
  DIAGNOSIS: (taskId: string) => `/task/${taskId}/diagnosis`,
  OPTIMIZATION: (taskId: string) => `/task/${taskId}/optimization`,
  RESULT: (taskId: string) => `/task/${taskId}/result`,
} as const

export const TASK_STEPS: Array<{
  step: TaskStep
  label: string
  route: (taskId: string) => string
}> = [
  { step: 1, label: '岗位解析', route: ROUTES.JOB_ANALYSIS },
  { step: 2, label: '事实确认', route: ROUTES.FACT_CONFIRMATION },
  { step: 3, label: '匹配分析', route: ROUTES.MATCHING },
  { step: 4, label: '问题诊断', route: ROUTES.DIAGNOSIS },
  { step: 5, label: 'AI 优化', route: ROUTES.OPTIMIZATION },
  { step: 6, label: '优化结果', route: ROUTES.RESULT },
]
