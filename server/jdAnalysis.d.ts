import type { Plugin } from 'vite'

export function createJdAnalysisPlugin(env: Record<string, string>): Plugin
export function validateRequirementsPayload(payload: unknown, jobDescription: string): unknown[]
export function normalizeRequiredLevel(value: unknown): { value: 'L1 了解' | 'L2 熟悉' | 'L3 实践' | 'L4 设计 / 主导'; normalized: boolean; needsReview: boolean }
export function parseModelJson(content: string): unknown
export function validateJdInput(input: unknown): { jobTitle: string; companyName: string; jobDescription: string }
